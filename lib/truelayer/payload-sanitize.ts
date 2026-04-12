/**
 * Redact sensitive substrings from TrueLayer transaction payloads before DB storage.
 * `truelayer_payload` is for debugging/support — not a full raw API mirror; top-level keys are allowlisted.
 */

import { isRecord } from "@/lib/truelayer/parse-helpers"

/** Top-level Data API fields safe to retain (excludes IDs used for dedupe and free-text PII). */
const ALLOWED_TRUELAYER_PAYLOAD_TOP_KEYS = new Set([
  "transaction_id",
  "timestamp",
  "amount",
  "currency",
  "transaction_type",
  "merchant_name",
  "transaction_category",
  "transaction_classification",
  "running_balance",
])

function redactString(s: string): string {
  const digits = s.replace(/\D/g, "")
  if (digits.length >= 12 && digits.length <= 19) {
    return "[redacted]"
  }
  // Sort codes, short account fragments, etc. (digits only / separators)
  if (digits.length >= 6 && digits.length <= 11) {
    const compact = s.replace(/\s/g, "")
    if (/^[\d-]+$/.test(compact) && digits.length >= 6) {
      return "[redacted]"
    }
  }
  return s
}

export function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    const keyLower = k.toLowerCase()
    if (
      keyLower.includes("card") ||
      keyLower.includes("pan") ||
      keyLower.includes("number") ||
      keyLower.includes("iban") ||
      keyLower.includes("sort") ||
      keyLower.includes("account")
    ) {
      if (typeof v === "string") {
        out[k] = redactString(v)
      } else {
        out[k] = "[redacted]"
      }
      continue
    }
    if (isRecord(v)) {
      out[k] = sanitizeMeta(v)
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        isRecord(item) ? sanitizeMeta(item) : item,
      ) as unknown
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Returns a JSON-serializable copy safe to store in `transactions.truelayer_payload`.
 */
export function sanitizeTrueLayerTransactionPayload(
  raw: unknown,
): Record<string, unknown> | null {
  if (!isRecord(raw)) return null
  const out: Record<string, unknown> = {}
  for (const key of ALLOWED_TRUELAYER_PAYLOAD_TOP_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      out[key] = raw[key]
    }
  }
  if (isRecord(raw.meta)) {
    out.meta = sanitizeMeta(raw.meta)
  }
  return Object.keys(out).length > 0 ? out : null
}
