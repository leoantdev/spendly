import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { type NextResponse } from "next/server"

import { truelayerConfig } from "@/lib/truelayer/config"

/** Data API read scopes + long-lived refresh (no payments). */
export const TRUELAYER_DATA_SCOPES =
  "info accounts balance transactions offline_access" as const

export const TRUELAYER_OAUTH_COOKIE_STATE = "tl_oauth_state"
export const TRUELAYER_OAUTH_COOKIE_NONCE = "tl_oauth_nonce"
export const TRUELAYER_OAUTH_COOKIE_VERIFIER = "tl_oauth_code_verifier"

const OAUTH_COOKIE_MAX_AGE_SEC = 10 * 60

export type BankConnectionRedirectStatus =
  | "success"
  | "cancelled"
  | "failed"
  | "error"
  | "session"

function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

function oauthCookieOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SEC,
  }
}

function clearCookieOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: 0
} {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  }
}

export function getTrueLayerAuthAuthorizeUrl(): string {
  return truelayerConfig.mode === "sandbox"
    ? "https://auth.truelayer-sandbox.com/"
    : "https://auth.truelayer.com/"
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** RFC 7636: URL-safe random verifier + S256 challenge. */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64Url(randomBytes(32))
  const hash = createHash("sha256").update(codeVerifier, "utf8").digest()
  const codeChallenge = base64Url(Buffer.from(hash))
  return { codeVerifier, codeChallenge }
}

export function generateOAuthSecret(): string {
  return base64Url(randomBytes(32))
}

/**
 * Build the browser authorization URL (authorization code + PKCE).
 * @see https://docs.truelayer.com/docs/create-a-connection
 */
export function buildTrueLayerAuthorizationUrl(params: {
  state: string
  nonce: string
  codeChallenge: string
}): string {
  const u = new URL(getTrueLayerAuthAuthorizeUrl())
  u.searchParams.set("response_type", "code")
  u.searchParams.set("client_id", truelayerConfig.clientId)
  u.searchParams.set("redirect_uri", truelayerConfig.redirectUri)
  u.searchParams.set("scope", TRUELAYER_DATA_SCOPES)
  u.searchParams.set("state", params.state)
  u.searchParams.set("nonce", params.nonce)
  u.searchParams.set("code_challenge", params.codeChallenge)
  u.searchParams.set("code_challenge_method", "S256")
  return u.toString()
}

export function appendBankConnectionStatus(
  origin: string,
  status: BankConnectionRedirectStatus,
): URL {
  const url = new URL("/banks", origin)
  url.searchParams.set("bankConnection", status)
  return url
}

/** Attach short-lived OAuth cookies to a JSON response from POST /start. */
export function setTrueLayerOAuthCookies(
  response: NextResponse,
  values: { state: string; nonce: string; codeVerifier: string },
): void {
  const opts = oauthCookieOptions()
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_STATE, values.state, opts)
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_NONCE, values.nonce, opts)
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_VERIFIER, values.codeVerifier, opts)
}

export function clearTrueLayerOAuthCookies(response: NextResponse): void {
  const opts = clearCookieOptions()
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_STATE, "", opts)
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_NONCE, "", opts)
  response.cookies.set(TRUELAYER_OAUTH_COOKIE_VERIFIER, "", opts)
}

export type TrueLayerOAuthCookies = {
  state: string | undefined
  nonce: string | undefined
  codeVerifier: string | undefined
}

export function readTrueLayerOAuthCookies(cookieStore: {
  get(name: string): { value: string } | undefined
}): TrueLayerOAuthCookies {
  return {
    state: cookieStore.get(TRUELAYER_OAUTH_COOKIE_STATE)?.value,
    nonce: cookieStore.get(TRUELAYER_OAUTH_COOKIE_NONCE)?.value,
    codeVerifier: cookieStore.get(TRUELAYER_OAUTH_COOKIE_VERIFIER)?.value,
  }
}

/**
 * Map TrueLayer / OAuth redirect `error` query param to a user-facing status.
 */
export function mapTrueLayerOAuthRedirectError(
  error: string | null | undefined,
): BankConnectionRedirectStatus {
  if (!error) return "failed"
  const e = error.toLowerCase()
  if (e === "access_denied" || e === "user_cancelled" || e === "cancelled") {
    return "cancelled"
  }
  return "failed"
}
