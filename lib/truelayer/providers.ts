import "server-only"

import { truelayerConfig } from "@/lib/truelayer/config"
import { isRecord } from "@/lib/truelayer/parse-helpers"

/**
 * Provider row from TrueLayer Auth API GET /api/providers.
 * @see https://docs.truelayer.com/reference/getproviders
 */
export type TrueLayerProviderRecord = {
  provider_id: string
  display_name: string
  logo_url: string
  country: string
  scopes: string[]
  availability?: {
    recommended_status?: string
    updated_at?: string
  }
  steps?: unknown[]
}

function authApiBase(): string {
  return truelayerConfig.mode === "sandbox"
    ? "https://auth.truelayer-sandbox.com"
    : "https://auth.truelayer.com"
}

function parseScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string")
  }
  if (typeof raw === "string") {
    return raw.split(/[\s,]+/).filter(Boolean)
  }
  return []
}

function parseProviderRow(raw: unknown): TrueLayerProviderRecord | null {
  if (!isRecord(raw)) return null
  const provider_id = raw.provider_id
  const display_name = raw.display_name
  const logo_url = raw.logo_url
  const country = raw.country
  if (
    typeof provider_id !== "string" ||
    typeof display_name !== "string" ||
    typeof logo_url !== "string" ||
    typeof country !== "string"
  ) {
    return null
  }
  const scopes = parseScopes(raw.scopes)
  const availability = raw.availability
  return {
    provider_id,
    display_name,
    logo_url,
    country,
    scopes,
    ...(isRecord(availability)
      ? {
          availability: {
            recommended_status:
              typeof availability.recommended_status === "string"
                ? availability.recommended_status
                : undefined,
            updated_at:
              typeof availability.updated_at === "string"
                ? availability.updated_at
                : undefined,
          },
        }
      : {}),
    ...(raw.steps !== undefined ? { steps: raw.steps as unknown[] } : {}),
  }
}

export type ListTrueLayerProvidersOptions = {
  /** ISO country codes, e.g. ["uk"] */
  countries?: string[]
  /**
   * Filter to providers that support all of these scopes (TrueLayer uses space-delimited list).
   */
  scopes?: string[]
  /** If true, only providers enabled for this app in Console (recommended). */
  clientId?: string
}

/**
 * List financial institutions available via TrueLayer for the current environment.
 * Uses the Auth API (not Data API); no user access token required.
 *
 * **Cache:** In-memory only; effective per warm serverless instance (e.g. Vercel), not shared
 * across instances or durable across cold starts. Safe for occasional settings-page loads.
 */
let providersCache: {
  key: string
  at: number
  data: TrueLayerProviderRecord[]
} | null = null

const PROVIDERS_CACHE_TTL_MS = 3_600_000

export async function listTrueLayerProviders(
  options?: ListTrueLayerProvidersOptions,
): Promise<TrueLayerProviderRecord[]> {
  const cacheKey = JSON.stringify(options ?? {})
  if (
    providersCache &&
    providersCache.key === cacheKey &&
    Date.now() - providersCache.at < PROVIDERS_CACHE_TTL_MS
  ) {
    return providersCache.data
  }

  const u = new URL(`${authApiBase()}/api/providers`)
  const clientId = options?.clientId ?? truelayerConfig.clientId
  u.searchParams.set("clientId", clientId)

  if (options?.countries?.length) {
    u.searchParams.set("country", options.countries.join(" "))
  }
  if (options?.scopes?.length) {
    u.searchParams.set("scopes", options.scopes.join(" "))
  }

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : []
  } catch {
    throw new Error(`TrueLayer providers: invalid JSON (${res.status})`)
  }

  if (!res.ok) {
    const msg =
      isRecord(parsed) && typeof parsed.error_description === "string"
        ? parsed.error_description
        : `TrueLayer providers request failed (${res.status})`
    throw new Error(msg)
  }

  if (!Array.isArray(parsed)) {
    throw new Error("TrueLayer providers: expected JSON array")
  }

  const out: TrueLayerProviderRecord[] = []
  for (const item of parsed) {
    const row = parseProviderRow(item)
    if (row) out.push(row)
  }
  providersCache = { key: cacheKey, at: Date.now(), data: out }
  return out
}

/**
 * Returns whether a provider supports all required scopes (subset check).
 */
export function providerSupportsScopes(
  provider: TrueLayerProviderRecord,
  required: readonly string[],
): boolean {
  if (required.length === 0) return true
  const set = new Set(provider.scopes.map((s) => s.toLowerCase()))
  return required.every((r) => set.has(r.toLowerCase()))
}

/** Minimal shape for client UI (banks settings); omits logo_url, steps, availability. */
export type TrueLayerProviderLean = {
  provider_id: string
  display_name: string
  scopes: string[]
  country: string
}

export function leanTrueLayerProviders(
  providers: TrueLayerProviderRecord[],
): TrueLayerProviderLean[] {
  return providers.map(({ provider_id, display_name, scopes, country }) => ({
    provider_id,
    display_name,
    scopes,
    country,
  }))
}
