/**
 * Normalise TrueLayer `/accounts` and `/cards` items for import.
 * Both use `account_id`, `display_name`, `currency`, and nested `provider`.
 */

import { isRecord, readString } from "@/lib/truelayer/parse-helpers"

export type TrueLayerLinkedResourceKind = "account" | "card"

export type ParsedTrueLayerLinkedResource = {
  kind: TrueLayerLinkedResourceKind
  accountId: string
  displayName: string
  currency: string
  institution: string
}

/**
 * Parse a single TrueLayer account or card object from Data API `results`.
 */
/** UK-first default when the provider omits currency (matches profile default in migrations). */
const FALLBACK_CURRENCY = "GBP"

export type ParseTrueLayerLinkedResourceOptions = {
  /** Used when the provider omits account/card currency (e.g. profile currency). */
  defaultCurrency?: string
}

function fallbackDisplayName(accountId: string, raw: Record<string, unknown>): string {
  const fromAlt = readString(raw, "name")
  if (fromAlt) return fromAlt
  // Short stable label when the API omits display_name
  if (accountId.length <= 12) return accountId
  return `${accountId.slice(0, 6)}…${accountId.slice(-4)}`
}

export function parseTrueLayerLinkedResource(
  raw: unknown,
  kind: TrueLayerLinkedResourceKind,
  options?: ParseTrueLayerLinkedResourceOptions,
): ParsedTrueLayerLinkedResource | null {
  if (!isRecord(raw)) return null
  const accountId = readString(raw, "account_id")
  if (!accountId) return null
  const displayName =
    readString(raw, "display_name") ?? fallbackDisplayName(accountId, raw)
  const dc = options?.defaultCurrency?.trim()
  const currency =
    readString(raw, "currency") ?? (dc && dc.length > 0 ? dc : null) ?? FALLBACK_CURRENCY

  let institution = "Bank"
  const provider = raw.provider
  if (isRecord(provider)) {
    const dn = readString(provider, "display_name")
    const pid = readString(provider, "provider_id")
    institution = dn ?? pid ?? institution
  }

  return { kind, accountId, displayName, currency, institution }
}

export type MergeLinkedResourcesStats = {
  merged: Map<string, ParsedTrueLayerLinkedResource>
  /** Rows in accountRows where parse returned null */
  accountParseFailures: number
  /** Rows in cardRows where parse returned null */
  cardParseFailures: number
  /** Card rows that parsed but lost to an existing account with the same id */
  cardSupersededByAccount: number
}

export type MergeLinkedResourcesOptions = ParseTrueLayerLinkedResourceOptions

/**
 * Merge `/accounts` and `/cards` results by TrueLayer `account_id`.
 * Bank accounts win when the same id appears in both (unlikely).
 */
export function mergeLinkedResourcesWithStats(
  accountRows: unknown[],
  cardRows: unknown[],
  options?: MergeLinkedResourcesOptions,
): MergeLinkedResourcesStats {
  const merged = new Map<string, ParsedTrueLayerLinkedResource>()
  let accountParseFailures = 0
  let cardParseFailures = 0
  let cardSupersededByAccount = 0

  for (const raw of accountRows) {
    const p = parseTrueLayerLinkedResource(raw, "account", options)
    if (p) merged.set(p.accountId, p)
    else accountParseFailures += 1
  }
  for (const raw of cardRows) {
    const p = parseTrueLayerLinkedResource(raw, "card", options)
    if (!p) {
      cardParseFailures += 1
      continue
    }
    if (merged.has(p.accountId)) {
      cardSupersededByAccount += 1
      continue
    }
    merged.set(p.accountId, p)
  }

  return {
    merged,
    accountParseFailures,
    cardParseFailures,
    cardSupersededByAccount,
  }
}

/**
 * Merge `/accounts` and `/cards` results by TrueLayer `account_id`.
 * Bank accounts win when the same id appears in both (unlikely).
 */
export function mergeLinkedResources(
  accountRows: unknown[],
  cardRows: unknown[],
  options?: MergeLinkedResourcesOptions,
): Map<string, ParsedTrueLayerLinkedResource> {
  return mergeLinkedResourcesWithStats(accountRows, cardRows, options).merged
}
