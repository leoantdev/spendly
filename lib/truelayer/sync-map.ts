import { format } from "date-fns"

import type { TransactionType } from "@/lib/types"
import { hashSensitiveValue } from "@/lib/truelayer/secret-store"
import {
  sanitizeMeta,
  sanitizeTrueLayerTransactionPayload,
} from "@/lib/truelayer/payload-sanitize"
import type { TrueLayerTransaction } from "@/lib/truelayer/client"
import { isRecord, readNumber, readString } from "@/lib/truelayer/parse-helpers"

function parseOccurredAtDate(timestamp: string | null): string | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (!Number.isFinite(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

function parseProviderOccurredAt(timestamp: string | null): string | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}

function readRunningBalance(
  tl: Record<string, unknown>,
): { amount: number | null; currency: string | null } {
  const rb = tl.running_balance
  if (!isRecord(rb)) return { amount: null, currency: null }
  const amount = readNumber(rb, "amount")
  const currency = readString(rb, "currency")
  return { amount, currency }
}

export type MapTrueLayerTransactionContext = {
  userId: string
  accountId: string
  categoryIdExpense: string
  categoryIdIncome: string
}

/**
 * Maps a TrueLayer transaction row to a `transactions` insert payload.
 * Uses provider IDs when present; otherwise falls back to `import_fingerprint_hash` for dedupe.
 */
export function mapTrueLayerTransaction(
  tl: TrueLayerTransaction,
  ctx: MapTrueLayerTransactionContext,
): Record<string, unknown> | null {
  if (!isRecord(tl)) return null

  const normalised = readString(tl, "normalised_provider_transaction_id")
  const providerId = readString(tl, "provider_transaction_id")
  const normalisedHash = normalised ? hashSensitiveValue(normalised) : null
  const providerIdHash = providerId ? hashSensitiveValue(providerId) : null

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
  /** Many providers omit `merchant_name`; use description so auto-categorise / rules can match. */
  const merchantForRow = merchant ?? description ?? null

  const abs = Math.abs(rawAmount)
  const amountStr = abs.toFixed(2)

  const txCurrency = readString(tl, "currency")
  const txCategory = readString(tl, "transaction_category")
  const tcRaw = tl.transaction_classification
  const classification = Array.isArray(tcRaw) ? tcRaw : null
  const { amount: rbAmt, currency: rbCur } = readRunningBalance(tl)
  const providerOccurredAt = parseProviderOccurredAt(ts)

  const metaRaw = tl.meta
  const providerMeta = isRecord(metaRaw) ? sanitizeMeta(metaRaw) : null

  const safePayload = sanitizeTrueLayerTransactionPayload(tl)

  let importFingerprintHash: string | null = null
  if (!normalisedHash && !providerIdHash) {
    const fingerprintSource = [
      ctx.accountId,
      ts ?? "",
      amountStr,
      description ?? "",
      tlTransactionId ?? "",
    ].join("|")
    importFingerprintHash = hashSensitiveValue(fingerprintSource)
  }

  return {
    user_id: ctx.userId,
    account_id: ctx.accountId,
    category_id: categoryId,
    type,
    amount: amountStr,
    occurred_at: occurredAt,
    note,
    merchant_name: merchantForRow,
    truelayer_transaction_id: tlTransactionId,
    normalised_provider_transaction_id_hash: normalisedHash,
    provider_transaction_id_hash: providerIdHash,
    import_fingerprint_hash: importFingerprintHash,
    provider_occurred_at: providerOccurredAt,
    transaction_currency: txCurrency,
    transaction_category: txCategory,
    ...(classification !== null ? { transaction_classification: classification } : {}),
    ...(providerMeta !== null ? { provider_meta: providerMeta } : {}),
    ...(rbAmt !== null ? { running_balance_amount: rbAmt.toFixed(2) } : {}),
    ...(rbCur !== null ? { running_balance_currency: rbCur } : {}),
    ...(safePayload !== null ? { truelayer_payload: safePayload } : {}),
  }
}
