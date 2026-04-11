import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type BankSyncCronEnv = {
  batchSize: number
  leaseSeconds: number
  intervalMinutes: number
  backoffBaseSeconds: number
  cronTransactionDays: number
  interUserDelayMs: number
}

/** Parses `process.env` numeric tuning vars; invalid / non-finite values fall back to defaults. */
export function envFiniteNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function readBankSyncCronEnv(): BankSyncCronEnv {
  const batchSize = envFiniteNumber(process.env.BANK_SYNC_CRON_BATCH_SIZE, 8)
  const leaseSeconds = envFiniteNumber(process.env.BANK_SYNC_LEASE_SECONDS, 900)
  const intervalMinutes = envFiniteNumber(process.env.BANK_SYNC_INTERVAL_MINUTES, 30)
  const backoffBaseSeconds = envFiniteNumber(process.env.BANK_SYNC_BACKOFF_BASE_SECONDS, 300)
  const cronTransactionDays = envFiniteNumber(process.env.BANK_SYNC_CRON_TRANSACTION_DAYS, 7)
  const interUserDelayMs = envFiniteNumber(process.env.BANK_SYNC_INTER_USER_DELAY_MS, 0)

  return {
    batchSize: Math.max(1, Math.min(50, batchSize)),
    leaseSeconds: Math.max(60, leaseSeconds),
    intervalMinutes: Math.max(5, intervalMinutes),
    backoffBaseSeconds: Math.max(60, backoffBaseSeconds),
    cronTransactionDays: Math.max(1, Math.min(90, cronTransactionDays)),
    interUserDelayMs: Math.max(0, interUserDelayMs),
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Users with at least one active bank connection, ordered by soonest `next_sync_after`
 * (users without a state row are treated as due immediately).
 */
export async function listDueBankSyncUserCandidates(
  admin: SupabaseClient,
  scanLimit: number,
): Promise<string[]> {
  const { data: connections, error: connErr } = await admin
    .from("bank_connections")
    .select("user_id")
    .eq("status", "active")

  if (connErr) {
    throw new Error(`Failed to list active bank connections: ${connErr.message}`)
  }

  const userIds = [
    ...new Set(
      (connections ?? [])
        .map((r) => r.user_id as string | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]

  if (userIds.length === 0) return []

  const stateByUser = new Map<
    string,
    { next_sync_after: string; lease_expires_at: string | null }
  >()

  for (const part of chunk(userIds, 150)) {
    const { data: states, error: sErr } = await admin
      .from("bank_sync_state")
      .select("user_id, next_sync_after, lease_expires_at")
      .in("user_id", part)

    if (sErr) {
      throw new Error(`Failed to load bank_sync_state: ${sErr.message}`)
    }
    for (const row of states ?? []) {
      const uid = row.user_id as string
      stateByUser.set(uid, {
        next_sync_after: row.next_sync_after as string,
        lease_expires_at: (row.lease_expires_at as string | null) ?? null,
      })
    }
  }

  const now = Date.now()
  const due: { userId: string; sortKey: number }[] = []

  for (const userId of userIds) {
    const row = stateByUser.get(userId)
    if (!row) {
      due.push({ userId, sortKey: Number.NEGATIVE_INFINITY })
      continue
    }
    const leaseOk =
      !row.lease_expires_at || new Date(row.lease_expires_at).getTime() < now
    const nextOk = new Date(row.next_sync_after).getTime() <= now
    if (leaseOk && nextOk) {
      due.push({
        userId,
        sortKey: new Date(row.next_sync_after).getTime(),
      })
    }
  }

  due.sort((a, b) => a.sortKey - b.sortKey)
  return due.slice(0, scanLimit).map((d) => d.userId)
}

/**
 * Atomically claims up to `batchSize` users via `claim_bank_sync_user` RPC.
 */
export async function claimBankSyncUsers(
  admin: SupabaseClient,
  args: {
    runId: string
    batchSize: number
    leaseSeconds: number
  },
): Promise<string[]> {
  const scanLimit = Math.max(args.batchSize * 4, args.batchSize)
  const candidates = await listDueBankSyncUserCandidates(admin, scanLimit)
  const claimed: string[] = []

  for (const userId of candidates) {
    if (claimed.length >= args.batchSize) break

    const { data, error } = await admin.rpc("claim_bank_sync_user", {
      p_user_id: userId,
      p_lease_seconds: args.leaseSeconds,
      p_run_id: args.runId,
    })

    if (error) {
      console.warn(
        JSON.stringify({
          msg: "claim_bank_sync_user_rpc_error",
          source: "cron",
          runId: args.runId,
          userId,
          error: error.message,
        }),
      )
      continue
    }

    if (data === true) {
      claimed.push(userId)
    }
  }

  return claimed
}

export async function markBankSyncSuccess(
  admin: SupabaseClient,
  userId: string,
  args: { intervalMinutes: number },
): Promise<void> {
  const now = new Date().toISOString()
  const next = new Date(
    Date.now() + args.intervalMinutes * 60_000,
  ).toISOString()

  const { error } = await admin
    .from("bank_sync_state")
    .update({
      lease_expires_at: null,
      last_succeeded_at: now,
      last_error: null,
      next_sync_after: next,
      failure_count: 0,
      updated_at: now,
    })
    .eq("user_id", userId)

  if (error) {
    console.warn(
      JSON.stringify({
        msg: "mark_bank_sync_success_failed",
        source: "cron",
        userId,
        error: error.message,
      }),
    )
  }
}

function isTrueLayerApi429(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name !== "TrueLayerApiError") return false
  if (!("status" in error)) return false
  const s = (error as { status: unknown }).status
  return typeof s === "number" && s === 429
}

function isBankConnectionErrorWithCause(
  error: unknown,
): error is Error & { cause: unknown } {
  return (
    error instanceof Error &&
    error.name === "BankConnectionError" &&
    "cause" in error &&
    (error as { cause: unknown }).cause !== undefined
  )
}

/** TrueLayer 429 at any depth (e.g. wrapped in `BankConnectionError` from token refresh). */
export function isTrueLayerRateLimited(error: unknown): boolean {
  if (isTrueLayerApi429(error)) return true
  if (isBankConnectionErrorWithCause(error)) {
    return isTrueLayerRateLimited(error.cause)
  }
  return false
}

export async function markBankSyncFailure(
  admin: SupabaseClient,
  userId: string,
  args: { backoffBaseSeconds: number; errorMessage: string },
): Promise<void> {
  const { data: row, error: loadErr } = await admin
    .from("bank_sync_state")
    .select("failure_count")
    .eq("user_id", userId)
    .maybeSingle()

  if (loadErr) {
    console.warn(
      JSON.stringify({
        msg: "mark_bank_sync_failure_load_failed",
        source: "cron",
        userId,
        error: loadErr.message,
      }),
    )
    return
  }

  const prev = typeof row?.failure_count === "number" ? row.failure_count : 0
  const nextFc = prev + 1
  const exp = Math.min(nextFc - 1, 8)
  const backoffSec = Math.min(
    args.backoffBaseSeconds * 2 ** exp,
    86_400,
  )
  const next = new Date(Date.now() + backoffSec * 1000).toISOString()
  const now = new Date().toISOString()
  const errMsg = args.errorMessage.slice(0, 2000)

  const { error } = await admin
    .from("bank_sync_state")
    .update({
      lease_expires_at: null,
      last_failed_at: now,
      last_error: errMsg,
      next_sync_after: next,
      failure_count: nextFc,
      updated_at: now,
    })
    .eq("user_id", userId)

  if (error) {
    console.warn(
      JSON.stringify({
        msg: "mark_bank_sync_failure_update_failed",
        source: "cron",
        userId,
        error: error.message,
      }),
    )
  }
}
