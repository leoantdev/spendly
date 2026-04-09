import "server-only"

import { truelayerConfig } from "@/lib/truelayer/config"

/** OAuth2 token response from TrueLayer auth server (Data API user tokens). */
export type TrueLayerTokenResponse = {
  access_token: string
  expires_in: number
  token_type: string
  refresh_token?: string
  scope?: string
}

/** Account object shape from Data API `results` (fields vary by provider). */
export type TrueLayerAccount = Record<string, unknown>

/** Transaction object shape from Data API `results`. */
export type TrueLayerTransaction = Record<string, unknown>

/**
 * First connection object from Data API `GET /me` (`results[0]`).
 * @see https://docs.truelayer.com/reference/getme
 */
export type TrueLayerMeConnection = {
  client_id?: string
  credentials_id?: string
  consent_status?: string
  consent_status_updated_at?: string
  consent_created_at?: string
  consent_expires_at?: string
  provider?: {
    display_name?: string
    logo_uri?: string
    provider_id?: string
  }
  scopes?: string[]
  privacy_policy?: string
}

export class TrueLayerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = "TrueLayerApiError"
  }
}

function authTokenUrl(): string {
  return truelayerConfig.mode === "sandbox"
    ? "https://auth.truelayer-sandbox.com/connect/token"
    : "https://auth.truelayer.com/connect/token"
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function readTrueLayerErrorMessage(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const err = body.error
  const desc = body.error_description
  if (typeof err === "string" && typeof desc === "string" && desc.length > 0) {
    return `${err}: ${desc}`
  }
  if (typeof err === "string") return err
  if (typeof desc === "string") return desc
  return undefined
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function postConnectToken(body: Record<string, string>): Promise<TrueLayerTokenResponse> {
  const url = authTokenUrl()
  const params = new URLSearchParams(body)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  })

  const parsed = await parseJsonBody(res)

  if (!res.ok) {
    const msg =
      readTrueLayerErrorMessage(parsed) ??
      `TrueLayer token request failed (${res.status})`
    throw new TrueLayerApiError(msg, res.status, parsed)
  }

  if (!isRecord(parsed)) {
    throw new TrueLayerApiError("Invalid token response shape", res.status, parsed)
  }

  const access_token = parsed.access_token
  const token_type = parsed.token_type
  let expires_in: number

  if (typeof parsed.expires_in === "number" && Number.isFinite(parsed.expires_in)) {
    expires_in = parsed.expires_in
  } else if (typeof parsed.expires_in === "string") {
    const n = Number(parsed.expires_in)
    expires_in = Number.isFinite(n) ? n : NaN
  } else {
    expires_in = NaN
  }

  if (typeof access_token !== "string" || access_token.length === 0) {
    throw new TrueLayerApiError("Token response missing access_token", res.status, parsed)
  }
  if (typeof token_type !== "string" || token_type.length === 0) {
    throw new TrueLayerApiError("Token response missing token_type", res.status, parsed)
  }
  if (!Number.isFinite(expires_in) || expires_in <= 0) {
    throw new TrueLayerApiError("Token response missing or invalid expires_in", res.status, parsed)
  }

  const refresh_token =
    typeof parsed.refresh_token === "string" && parsed.refresh_token.length > 0
      ? parsed.refresh_token
      : undefined
  const scope =
    typeof parsed.scope === "string" && parsed.scope.length > 0 ? parsed.scope : undefined

  return {
    access_token,
    expires_in,
    token_type,
    ...(refresh_token !== undefined ? { refresh_token } : {}),
    ...(scope !== undefined ? { scope } : {}),
  }
}

/**
 * Exchange an authorization code for Data API tokens.
 * @see https://docs.truelayer.com/reference/generateaccesstoken
 */
export async function exchangeAuthCode(
  code: string,
  options?: { codeVerifier?: string },
): Promise<TrueLayerTokenResponse> {
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: truelayerConfig.clientId,
    client_secret: truelayerConfig.clientSecret,
    redirect_uri: truelayerConfig.redirectUri,
    code,
  }
  if (options?.codeVerifier) {
    body.code_verifier = options.codeVerifier
  }
  return postConnectToken(body)
}

/**
 * Refresh a Data API access token using a refresh token.
 * @see https://docs.truelayer.com/reference/generateaccesstoken
 */
export async function refreshAccessToken(refreshToken: string): Promise<TrueLayerTokenResponse> {
  return postConnectToken({
    grant_type: "refresh_token",
    client_id: truelayerConfig.clientId,
    client_secret: truelayerConfig.clientSecret,
    refresh_token: refreshToken,
  })
}

function dataUrl(path: string, query?: Record<string, string | undefined>): string {
  const base = truelayerConfig.baseUrl.replace(/\/+$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  const u = new URL(`${base}${p}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, v)
    }
  }
  return u.toString()
}

async function getDataJson<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const res = await fetch(dataUrl(path, query), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const parsed = await parseJsonBody(res)

  if (res.status === 202) {
    throw new TrueLayerApiError(
      "TrueLayer returned 202 (async). This client does not handle async Data API responses; retry without async or implement webhook handling.",
      res.status,
      parsed,
    )
  }

  if (!res.ok) {
    const msg =
      readTrueLayerErrorMessage(parsed) ??
      `TrueLayer Data API request failed (${res.status})`
    throw new TrueLayerApiError(msg, res.status, parsed)
  }

  return parsed as T
}

type DataListResponse<T> = {
  results?: T[]
  status?: string
  [key: string]: unknown
}

/**
 * List accounts for the connection behind `accessToken`.
 * @see https://docs.truelayer.com/reference/getaccounts
 */
export async function getAccounts(accessToken: string): Promise<TrueLayerAccount[]> {
  const data = await getDataJson<DataListResponse<TrueLayerAccount>>(
    "/accounts",
    accessToken,
  )
  if (!Array.isArray(data.results)) {
    throw new TrueLayerApiError(
      "Accounts response missing results array",
      200,
      data,
    )
  }
  return data.results
}

/**
 * Connection metadata for the current access token (consent, credentials id).
 * @see https://docs.truelayer.com/reference/getme
 */
export async function getMe(accessToken: string): Promise<TrueLayerMeConnection | null> {
  const data = await getDataJson<DataListResponse<TrueLayerMeConnection>>(
    "/me",
    accessToken,
  )
  if (!Array.isArray(data.results) || data.results.length === 0) {
    return null
  }
  const first = data.results[0]
  return typeof first === "object" && first !== null ? first : null
}

/**
 * List settled transactions for an account.
 * `from` / `to` are `YYYY-MM-DD` per Data API docs.
 * @see https://docs.truelayer.com/reference/getaccounttransactions
 */
export async function getTransactions(
  accessToken: string,
  accountId: string,
  range?: { from?: string; to?: string },
): Promise<TrueLayerTransaction[]> {
  const encodedId = encodeURIComponent(accountId)
  const data = await getDataJson<DataListResponse<TrueLayerTransaction>>(
    `/accounts/${encodedId}/transactions`,
    accessToken,
    {
      from: range?.from,
      to: range?.to,
    },
  )
  if (!Array.isArray(data.results)) {
    throw new TrueLayerApiError(
      "Transactions response missing results array",
      200,
      data,
    )
  }
  return data.results
}
