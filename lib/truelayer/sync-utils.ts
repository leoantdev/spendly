/**
 * Pure helpers for TrueLayer bank sync (dedupe keys, Postgres error checks).
 * Kept separate from `sync.ts` so they can be unit-tested without server-only / Supabase.
 */

export type TransactionIdFields = {
  normalised_provider_transaction_id_hash: string | null
  provider_transaction_id_hash: string | null
}

export function parseTransactionIdFields(
  row: Record<string, unknown>,
): TransactionIdFields {
  const n = row.normalised_provider_transaction_id_hash
  const p = row.provider_transaction_id_hash
  return {
    normalised_provider_transaction_id_hash:
      typeof n === "string" && n.length > 0 ? n : null,
    provider_transaction_id_hash:
      typeof p === "string" && p.length > 0 ? p : null,
  }
}

/** Add every dedupe key represented by this DB or insert row (both IDs when present). */
export function addDedupeKeysForRow(
  set: Set<string>,
  row: Record<string, unknown>,
): void {
  const { normalised_provider_transaction_id_hash: n, provider_transaction_id_hash: p } =
    parseTransactionIdFields(row)
  if (n) set.add(`n:${n}`)
  if (p) set.add(`p:${p}`)
}

/**
 * True if this row should not be inserted: any of its keys already exists in DB or batch.
 */
export function transactionRowIsDuplicate(
  existingKeys: Set<string>,
  seenInBatch: Set<string>,
  row: Record<string, unknown>,
): boolean {
  const { normalised_provider_transaction_id_hash: n, provider_transaction_id_hash: p } =
    parseTransactionIdFields(row)
  const keys: string[] = []
  if (n) keys.push(`n:${n}`)
  if (p) keys.push(`p:${p}`)
  if (keys.length === 0) return true
  return keys.some((k) => existingKeys.has(k) || seenInBatch.has(k))
}

/** Record this row's keys in the per-batch seen set (call after deciding to insert). */
export function markTransactionRowSeenInBatch(
  seenInBatch: Set<string>,
  row: Record<string, unknown>,
): void {
  const { normalised_provider_transaction_id_hash: n, provider_transaction_id_hash: p } =
    parseTransactionIdFields(row)
  if (n) seenInBatch.add(`n:${n}`)
  if (p) seenInBatch.add(`p:${p}`)
}

export function isPostgresUniqueViolation(err: {
  code?: string
  message?: string
}): boolean {
  if (err.code === "23505") return true
  const msg = err.message ?? ""
  return msg.includes("duplicate key") || msg.includes("unique constraint")
}
