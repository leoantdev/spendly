import "server-only"

import { format, subDays } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getAccounts,
  getCardTransactions,
  getCards,
  getTransactions,
  TrueLayerApiError,
  type TrueLayerTransaction,
} from "@/lib/truelayer/client"
import { hashSensitiveValue } from "@/lib/truelayer/secret-store"
import { BankConnectionError, ensureBankConnectionAccessToken } from "@/lib/truelayer/tokens"
import {
  UNCATEGORISED_EXPENSE_KEY,
  UNCATEGORISED_INCOME_KEY,
} from "@/lib/category-system"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { BankConnection, TransactionType } from "@/lib/types"
import { classifySyncRunOutcome, type SyncRunOutcome } from "@/lib/truelayer/sync-outcome"
import { selectSyncHint } from "@/lib/truelayer/sync-hint"
import {
  mergeLinkedResourcesWithStats,
  type ParsedTrueLayerLinkedResource,
} from "@/lib/truelayer/sync-parse"
import {
  addDedupeKeysForRow,
  isPostgresUniqueViolation,
  markTransactionRowSeenInBatch,
  transactionRowIsDuplicate,
} from "@/lib/truelayer/sync-utils"

export type { SyncRunOutcome } from "@/lib/truelayer/sync-outcome"

/** `accountsSynced` counts bank accounts and credit cards that completed a transaction fetch. */
export type SyncBankDataStats = {
  accountsSynced: number
  newTransactionsImported: number
  hint?: string | null
  /** Set from connection/token/hint metrics; use for cron scheduling, not manual UI. */
  outcome: SyncRunOutcome
}

/** Who triggered the sync (manual UI vs Vercel cron). Used for logging only. */
export type SyncBankDataSource = "manual" | "cron"

export type SyncBankDataForUserOptions = {
  /** Session-scoped client (manual) or service-role client (cron). Defaults to cookie session client. */
  supabase?: SupabaseClient
  /** Inclusive start date `YYYY-MM-DD` for transaction fetches. Defaults to 90 days ago (manual UX). */
  from?: string
  /** Inclusive end date `YYYY-MM-DD`. Defaults to today. */
  to?: string
  source?: SyncBankDataSource
  /** Correlates logs when `source` is `cron`. */
  runId?: string
}

type SyncSupabase = SupabaseClient

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function readString(r: Record<string, unknown>, key: string): string | null {
  const v = r[key]
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function readNumber(r: Record<string, unknown>, key: string): number | null {
  const v = r[key]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Unknown error"
}

function isCardsScopeLikelyDenied(error: unknown): boolean {
  if (error instanceof TrueLayerApiError) {
    if (error.status === 403 || error.status === 401) return true
    const msg = error.message.toLowerCase()
    if (
      msg.includes("scope") ||
      msg.includes("forbidden") ||
      msg.includes("access denied") ||
      msg.includes("insufficient") ||
      msg.includes("not allowed")
    ) {
      return true
    }
  }
  return false
}

function parseOccurredAtDate(timestamp: string | null): string | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (!Number.isFinite(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

function mapTrueLayerTransaction(
  tl: TrueLayerTransaction,
  ctx: {
    userId: string
    accountId: string
    categoryIdExpense: string
    categoryIdIncome: string
  },
): Record<string, unknown> | null {
  if (!isRecord(tl)) return null

  const normalised = readString(tl, "normalised_provider_transaction_id")
  const providerId = readString(tl, "provider_transaction_id")
  const normalisedHash = normalised ? hashSensitiveValue(normalised) : null
  const providerIdHash = providerId ? hashSensitiveValue(providerId) : null
  if (!normalisedHash && !providerIdHash) return null

  const tlTransactionId = readString(tl, "transaction_id")
  const ts = readString(tl, "timestamp")
  const occurredAt = parseOccurredAtDate(ts)
  if (!occurredAt) return null

  const rawAmount = readNumber(tl, "amount")
  if (rawAmount === null) return null

  const txTypeRaw = readString(tl, "transaction_type")
  const type: TransactionType =
    txTypeRaw?.toUpperCase() === "CREDIT" ? "income" : "expense"
  const categoryId =
    type === "income" ? ctx.categoryIdIncome : ctx.categoryIdExpense

  const description = readString(tl, "description")
  const merchant = readString(tl, "merchant_name")
  const note = description ?? merchant ?? null

  const abs = Math.abs(rawAmount)
  const amountStr = abs.toFixed(2)

  return {
    user_id: ctx.userId,
    account_id: ctx.accountId,
    category_id: categoryId,
    type,
    amount: amountStr,
    occurred_at: occurredAt,
    note,
    truelayer_transaction_id: tlTransactionId,
    normalised_provider_transaction_id_hash: normalisedHash,
    provider_transaction_id_hash: providerIdHash,
  }
}

async function loadUncategorisedCategoryIds(
  supabase: SyncSupabase,
  userId: string,
): Promise<{ expense: string; income: string }> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, system_key")
    .eq("user_id", userId)
    .in("system_key", [UNCATEGORISED_EXPENSE_KEY, UNCATEGORISED_INCOME_KEY])

  if (error) {
    throw new Error(`Failed to load system import categories: ${error.message}`)
  }

  let expense: string | undefined
  let income: string | undefined
  for (const row of data ?? []) {
    if (row.system_key === UNCATEGORISED_EXPENSE_KEY && typeof row.id === "string") {
      expense = row.id
    }
    if (row.system_key === UNCATEGORISED_INCOME_KEY && typeof row.id === "string") {
      income = row.id
    }
  }

  if (!expense || !income) {
    throw new Error(
      "Missing system import categories for this user. Run migrations or seed categories.",
    )
  }

  return { expense, income }
}

async function loadExistingDedupeKeys(
  supabase: SyncSupabase,
  userId: string,
  normalisedIds: string[],
  providerIds: string[],
): Promise<Set<string>> {
  const keys = new Set<string>()

  const normUnique = [...new Set(normalisedIds.filter(Boolean))]
  const provUnique = [...new Set(providerIds.filter(Boolean))]

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  for (const part of chunk(normUnique, 200)) {
    if (part.length === 0) continue
    const { data, error } = await supabase
      .from("transactions")
      .select("normalised_provider_transaction_id_hash, provider_transaction_id_hash")
      .eq("user_id", userId)
      .in("normalised_provider_transaction_id_hash", part)

    if (error) {
      throw new Error(`Failed to check existing transactions: ${error.message}`)
    }
    for (const row of data ?? []) {
      addDedupeKeysForRow(keys, row as Record<string, unknown>)
    }
  }

  for (const part of chunk(provUnique, 200)) {
    if (part.length === 0) continue
    const { data, error } = await supabase
      .from("transactions")
      .select("normalised_provider_transaction_id_hash, provider_transaction_id_hash")
      .eq("user_id", userId)
      .in("provider_transaction_id_hash", part)

    if (error) {
      throw new Error(`Failed to check existing transactions: ${error.message}`)
    }
    for (const row of data ?? []) {
      addDedupeKeysForRow(keys, row as Record<string, unknown>)
    }
  }

  return keys
}

async function insertTransactionsBatched(
  supabase: SyncSupabase,
  rows: Record<string, unknown>[],
): Promise<number> {
  const BATCH = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from("transactions").insert(batch)
    if (!error) {
      inserted += batch.length
      continue
    }

    for (const row of batch) {
      const { error: oneErr } = await supabase.from("transactions").insert(row)
      if (!oneErr) {
        inserted += 1
        continue
      }
      const msg = oneErr.message ?? ""
      const isDup = isPostgresUniqueViolation(oneErr as { code?: string; message?: string })
      if (isDup) continue
      throw new Error(`Transaction insert failed: ${msg}`)
    }
  }

  return inserted
}

async function runInBatches<T>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item) => fn(item)))
  }
}

function syncLog(
  source: SyncBankDataSource | undefined,
  runId: string | undefined,
  message: string,
  extra?: Record<string, unknown>,
) {
  const base = source === "cron" ? "[TrueLayer sync][cron]" : "[TrueLayer sync]"
  if (source === "cron" && runId) {
    console.info(
      JSON.stringify({
        msg: message,
        source: "cron",
        runId,
        ...extra,
      }),
    )
    return
  }
  if (extra && Object.keys(extra).length > 0) {
    console.info(base, message, extra)
    return
  }
  console.info(base, message)
}

/**
 * Pulls TrueLayer bank accounts, credit cards, and recent transactions into `bank_accounts` and `transactions`.
 * Use `options.supabase` from a cookie session (manual) or service role (cron); default is the current request session.
 */
export async function syncBankDataForUser(
  userId: string,
  options?: SyncBankDataForUserOptions,
): Promise<SyncBankDataStats> {
  const supabase = options?.supabase ?? (await createServerSupabaseClient())
  const source = options?.source ?? "manual"
  const runId = options?.runId

  const to = options?.to ?? format(new Date(), "yyyy-MM-dd")
  const from =
    options?.from ??
    format(subDays(new Date(), 90), "yyyy-MM-dd")

  if (source === "cron") {
    syncLog(source, runId, "sync_start", { userId, from, to })
  }

  const { data: connections, error: connErr } = await supabase
    .from("bank_connections")
    .select("id, user_id, consent_created_at, expires_at, status, created_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })

  if (connErr) {
    throw new Error(`Failed to load bank connections: ${connErr.message}`)
  }

  const list = (connections ?? []) as BankConnection[]
  if (list.length === 0) {
    if (source === "cron") {
      syncLog(source, runId, "sync_no_connections", { userId })
    }
    return {
      accountsSynced: 0,
      newTransactionsImported: 0,
      outcome: "success",
    }
  }

  const [cats, baLoadResult] = await Promise.all([
    loadUncategorisedCategoryIds(supabase, userId),
    supabase
      .from("bank_accounts")
      .select("id, account_id, truelayer_account_id_hash")
      .eq("user_id", userId),
  ])

  if (baLoadResult.error) {
    throw new Error(`Failed to load bank accounts: ${baLoadResult.error.message}`)
  }

  const bankAccountByHash = new Map<
    string,
    { id: string; account_id: string }
  >()
  for (const row of baLoadResult.data ?? []) {
    const h = row.truelayer_account_id_hash
    if (typeof h === "string" && h.length > 0) {
      bankAccountByHash.set(h, {
        id: row.id as string,
        account_id: row.account_id as string,
      })
    }
  }

  let accountsSynced = 0
  let newTransactionsImported = 0
  let tokenSkips = 0
  let connectionsFetched = 0
  let bothEndpointsFailedConnections = 0
  let emptyListConnections = 0
  let parseDropConnections = 0
  let cardsLikelyScopeDeniedConnections = 0
  let hadMergedResources = false

  for (const connection of list) {
    let accessToken: string
    try {
      accessToken = await ensureBankConnectionAccessToken(connection)
    } catch (e) {
      if (e instanceof BankConnectionError) {
        tokenSkips += 1
        console.warn(
          `[TrueLayer sync] Skipping connection ${connection.id}: ${e.message}`,
        )
        continue
      }
      throw e
    }

    connectionsFetched += 1

    const accountsPromise = getAccounts(accessToken).then(
      (data) => ({ ok: true as const, data }),
      (e) => ({ ok: false as const, error: e }),
    )
    const cardsPromise = getCards(accessToken).then(
      (data) => ({ ok: true as const, data }),
      (e) => ({ ok: false as const, error: e }),
    )
    const [accOutcome, cardOutcome] = await Promise.all([
      accountsPromise,
      cardsPromise,
    ])

    const accountsErr = !accOutcome.ok
    const tlAccounts = accOutcome.ok ? accOutcome.data : []
    if (!accOutcome.ok) {
      console.warn(
        `[TrueLayer sync] getAccounts failed for ${connection.id}: ${getErrorMessage(accOutcome.error)}`,
      )
    }

    const cardsErr = !cardOutcome.ok
    const cardsCaught: unknown = cardOutcome.ok ? undefined : cardOutcome.error
    const tlCards = cardOutcome.ok ? cardOutcome.data : []
    if (!cardOutcome.ok) {
      console.warn(
        `[TrueLayer sync] getCards failed for ${connection.id}: ${getErrorMessage(cardOutcome.error)}`,
      )
    }

    if (cardsErr && isCardsScopeLikelyDenied(cardsCaught)) {
      cardsLikelyScopeDeniedConnections += 1
    }

    if (accountsErr && cardsErr) {
      bothEndpointsFailedConnections += 1
    }

    const { merged } = mergeLinkedResourcesWithStats(tlAccounts, tlCards)
    const rawTotal = tlAccounts.length + tlCards.length
    const bothListCallsSucceeded = !accountsErr && !cardsErr

    if (bothListCallsSucceeded && rawTotal === 0) {
      emptyListConnections += 1
    } else if (bothListCallsSucceeded && rawTotal > 0 && merged.size === 0) {
      parseDropConnections += 1
    }

    if (merged.size > 0) {
      hadMergedResources = true
    }

    if (merged.size === 0) {
      console.warn(
        `[TrueLayer sync] No parseable accounts or cards for connection ${connection.id}`,
      )
      continue
    }

    const pendingRows: Record<string, unknown>[] = []

    type Resolved = {
      parsed: ParsedTrueLayerLinkedResource
      internalAccountId: string
      accountIdHash: string
    }
    const resolved: Resolved[] = []

    for (const parsed of merged.values()) {
      const accountIdHash = hashSensitiveValue(parsed.accountId)
      const existingBa = bankAccountByHash.get(accountIdHash)

      let internalAccountId: string | null = existingBa?.account_id ?? null

      if (!internalAccountId) {
        const suffix = parsed.kind === "card" ? " · Card" : ""
        const accountName = `${parsed.displayName} (${parsed.institution})${suffix}`
        const { data: newAcc, error: accErr } = await supabase
          .from("accounts")
          .insert({ user_id: userId, name: accountName })
          .select("id")
          .single()

        if (accErr || !newAcc?.id) {
          console.warn(
            `[TrueLayer sync] accounts insert failed:`,
            accErr?.message,
          )
          continue
        }

        internalAccountId = newAcc.id as string

        const nowIso = new Date().toISOString()
        const { data: insertedBa, error: baInsErr } = await supabase
          .from("bank_accounts")
          .insert({
            user_id: userId,
            account_id: internalAccountId,
            bank_connection_id: connection.id,
            truelayer_account_id_hash: accountIdHash,
            name: parsed.displayName,
            institution: parsed.institution,
            currency: parsed.currency,
            updated_at: nowIso,
          })
          .select("id")
          .single()

        if (baInsErr) {
          if (isPostgresUniqueViolation(baInsErr)) {
            await supabase
              .from("accounts")
              .delete()
              .eq("id", internalAccountId)
              .eq("user_id", userId)
            const { data: winnerBa, error: reSelErr } = await supabase
              .from("bank_accounts")
              .select("id, account_id")
              .eq("user_id", userId)
              .eq("truelayer_account_id_hash", accountIdHash)
              .maybeSingle()
            if (reSelErr || !winnerBa?.account_id || !winnerBa.id) {
              console.warn(
                `[TrueLayer sync] bank_accounts race recovery failed:`,
                reSelErr?.message ?? "missing row",
              )
              continue
            }
            internalAccountId = winnerBa.account_id as string
            bankAccountByHash.set(accountIdHash, {
              id: winnerBa.id as string,
              account_id: internalAccountId,
            })
          } else {
            console.warn(
              `[TrueLayer sync] bank_accounts insert failed:`,
              baInsErr.message,
            )
            await supabase
              .from("accounts")
              .delete()
              .eq("id", internalAccountId)
              .eq("user_id", userId)
            continue
          }
        } else if (insertedBa?.id) {
          bankAccountByHash.set(accountIdHash, {
            id: insertedBa.id as string,
            account_id: internalAccountId,
          })
        } else {
          await supabase
            .from("accounts")
            .delete()
            .eq("id", internalAccountId)
            .eq("user_id", userId)
          continue
        }
      } else if (existingBa?.id) {
        const nowIso = new Date().toISOString()
        const { error: baUpErr } = await supabase
          .from("bank_accounts")
          .update({
            name: parsed.displayName,
            institution: parsed.institution,
            currency: parsed.currency,
            bank_connection_id: connection.id,
            updated_at: nowIso,
          })
          .eq("id", existingBa.id)

        if (baUpErr) {
          console.warn(
            `[TrueLayer sync] bank_accounts update failed:`,
            baUpErr.message,
          )
        }
        if (internalAccountId) {
          bankAccountByHash.set(accountIdHash, {
            id: existingBa.id as string,
            account_id: internalAccountId,
          })
        }
      }

      if (!internalAccountId) continue

      resolved.push({ parsed, internalAccountId, accountIdHash })
    }

    await runInBatches(resolved, 2, async ({ parsed, internalAccountId, accountIdHash }) => {
      let txs: TrueLayerTransaction[]
      try {
        txs =
          parsed.kind === "card"
            ? await getCardTransactions(accessToken, parsed.accountId, {
                from,
                to,
              })
            : await getTransactions(accessToken, parsed.accountId, { from, to })
      } catch (e) {
        const label = parsed.kind === "card" ? "card" : "account"
        console.warn(
          `[TrueLayer sync] transaction fetch failed for ${label} hash ${accountIdHash.slice(0, 12)}: ${getErrorMessage(e)}`,
        )
        return
      }

      accountsSynced += 1

      const nowIso = new Date().toISOString()
      const { error: lastSyncErr } = await supabase
        .from("bank_accounts")
        .update({ last_synced_at: nowIso, updated_at: nowIso })
        .eq("user_id", userId)
        .eq("truelayer_account_id_hash", accountIdHash)
      if (lastSyncErr) {
        console.warn(
          `[TrueLayer sync] last_synced_at update failed for account hash ${accountIdHash.slice(0, 12)}:`,
          lastSyncErr.message,
        )
      }

      for (const tl of txs) {
        const row = mapTrueLayerTransaction(tl, {
          userId,
          accountId: internalAccountId,
          categoryIdExpense: cats.expense,
          categoryIdIncome: cats.income,
        })
        if (row) pendingRows.push(row)
      }
    })

    if (pendingRows.length === 0) continue

    const normalisedIds: string[] = []
    const providerIds: string[] = []
    for (const row of pendingRows) {
      const n = row.normalised_provider_transaction_id_hash
      const p = row.provider_transaction_id_hash
      if (typeof n === "string" && n) normalisedIds.push(n)
      if (typeof p === "string" && p) providerIds.push(p)
    }

    const existingKeys = await loadExistingDedupeKeys(
      supabase,
      userId,
      normalisedIds,
      providerIds,
    )

    const toInsert: Record<string, unknown>[] = []
    const seenInBatch = new Set<string>()

    for (const row of pendingRows) {
      if (transactionRowIsDuplicate(existingKeys, seenInBatch, row)) continue
      markTransactionRowSeenInBatch(seenInBatch, row)
      toInsert.push(row)
    }

    if (toInsert.length === 0) continue

    const n = await insertTransactionsBatched(supabase, toInsert)
    newTransactionsImported += n
  }

  const hint = selectSyncHint({
    connectionCount: list.length,
    accountsSynced,
    newTransactionsImported,
    tokenSkips,
    connectionsFetched,
    bothEndpointsFailedConnections,
    emptyListConnections,
    parseDropConnections,
    cardsLikelyScopeDeniedConnections,
    hadMergedResources,
  })

  const outcome = classifySyncRunOutcome(list.length, tokenSkips, hint)

  const stats: SyncBankDataStats = {
    accountsSynced,
    newTransactionsImported,
    outcome,
    ...(hint !== undefined ? { hint } : {}),
  }

  if (source === "cron") {
    syncLog(source, runId, "sync_done", {
      userId,
      accountsSynced,
      newTransactionsImported,
      ...(hint !== undefined ? { hint } : {}),
    })
  }

  return stats
}
