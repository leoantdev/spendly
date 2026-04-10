import "server-only"

import { z } from "zod"

const truelayerModeSchema = z.enum(["sandbox", "live"])

const trimmedNonEmpty = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1))

const truelayerEnvSchema = z.object({
  TRUELAYER_CLIENT_ID: trimmedNonEmpty.pipe(
    z.string().min(4, "TRUELAYER_CLIENT_ID looks too short"),
  ),
  TRUELAYER_CLIENT_SECRET: trimmedNonEmpty,
  TRUELAYER_REDIRECT_URI: trimmedNonEmpty.pipe(z.string().url("TRUELAYER_REDIRECT_URI must be a valid URL")),
  TRUELAYER_BASE_URL: trimmedNonEmpty.pipe(z.string().url("TRUELAYER_BASE_URL must be a valid URL")),
  TRUELAYER_MODE: z
    .string()
    .transform((s) => s.trim())
    .pipe(truelayerModeSchema),
})

export type TrueLayerMode = z.infer<typeof truelayerModeSchema>

export type TrueLayerConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Data API v1 base URL (no trailing slash), e.g. https://api.truelayer.com/data/v1 */
  baseUrl: string
  mode: TrueLayerMode
}

/**
 * TrueLayer rejects authorize requests when redirect_uri is not allowlisted in Console.
 * Catch common copy-paste mistakes from .env.example before users hit a cryptic auth error.
 */
function assertNonPlaceholderRedirectUri(redirectUri: string): void {
  let hostname: string
  try {
    hostname = new URL(redirectUri).hostname.toLowerCase()
  } catch {
    return
  }

  if (hostname === "your-app.example.com" || hostname.endsWith(".example.com")) {
    throw new Error(
      "Invalid TrueLayer environment: TRUELAYER_REDIRECT_URI uses a placeholder hostname (e.g. your-app.example.com). " +
        "Set it to your real callback URL (must match TrueLayer Console exactly), e.g. " +
        "http://localhost:3000/api/truelayer/callback for local dev or https://your-domain.com/api/truelayer/callback for production.",
    )
  }
}

const PLACEHOLDER_CLIENT_ID = "your-truelayer-client-id"
const PLACEHOLDER_CLIENT_SECRET = "your-truelayer-client-secret"

function assertNonPlaceholderCredentials(clientId: string, clientSecret: string): void {
  const id = clientId.toLowerCase()
  const secret = clientSecret.toLowerCase()
  if (id === PLACEHOLDER_CLIENT_ID || id.includes("your-truelayer")) {
    throw new Error(
      "Invalid TrueLayer environment: TRUELAYER_CLIENT_ID is still a placeholder. " +
        "Copy the real client_id from TrueLayer Console for your app.",
    )
  }
  if (secret === PLACEHOLDER_CLIENT_SECRET || secret.includes("your-truelayer")) {
    throw new Error(
      "Invalid TrueLayer environment: TRUELAYER_CLIENT_SECRET is still a placeholder. " +
        "Copy the real client_secret from TrueLayer Console for your app.",
    )
  }
}

/**
 * OAuth authorize + token hosts are chosen from TRUELAYER_MODE. The Data API base URL must
 * use the same environment or TrueLayer returns invalid_client / Invalid client_id on authorize.
 */
function assertModeMatchesBaseUrl(mode: TrueLayerMode, baseUrl: string): void {
  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return
  }

  const sandboxHost = "api.truelayer-sandbox.com"
  const liveHost = "api.truelayer.com"

  if (mode === "sandbox" && hostname !== sandboxHost) {
    throw new Error(
      `Invalid TrueLayer environment: TRUELAYER_MODE is sandbox but TRUELAYER_BASE_URL host is "${hostname}". ` +
        `Use https://${sandboxHost}/data/v1 (and sandbox credentials from Console).`,
    )
  }

  if (mode === "live" && hostname !== liveHost) {
    throw new Error(
      `Invalid TrueLayer environment: TRUELAYER_MODE is live but TRUELAYER_BASE_URL host is "${hostname}". ` +
        `Use https://${liveHost}/data/v1 (and live credentials from Console).`,
    )
  }
}

/**
 * TrueLayer assigns sandbox client_ids with a `sandbox-` prefix; live client_ids do not use it.
 * Mixing modes is the most common cause of "Invalid client_id" on the authorize page.
 * @see https://docs.truelayer.com/docs/quickstart-create-a-console-account
 */
function assertClientIdMatchesMode(clientId: string, mode: TrueLayerMode): void {
  if (mode === "sandbox" && !clientId.startsWith("sandbox-")) {
    throw new Error(
      "Invalid TrueLayer environment: TRUELAYER_MODE is sandbox but TRUELAYER_CLIENT_ID does not start with " +
        "`sandbox-`. New Console apps are sandbox by default — copy the sandbox client_id from Console, " +
        "or set TRUELAYER_MODE=live with live credentials and https://api.truelayer.com/data/v1.",
    )
  }
  if (mode === "live" && clientId.startsWith("sandbox-")) {
    throw new Error(
      "Invalid TrueLayer environment: TRUELAYER_CLIENT_ID starts with `sandbox-` but TRUELAYER_MODE is live. " +
        "Sandbox credentials only work with TRUELAYER_MODE=sandbox and https://api.truelayer-sandbox.com/data/v1.",
    )
  }
}

function loadTruelayerConfig(): TrueLayerConfig {
  const result = truelayerEnvSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    throw new Error(`Invalid TrueLayer environment: ${issues}`)
  }

  const env = result.data
  assertNonPlaceholderCredentials(env.TRUELAYER_CLIENT_ID, env.TRUELAYER_CLIENT_SECRET)
  assertNonPlaceholderRedirectUri(env.TRUELAYER_REDIRECT_URI)

  const baseUrl = env.TRUELAYER_BASE_URL.replace(/\/+$/, "")
  assertModeMatchesBaseUrl(env.TRUELAYER_MODE, baseUrl)
  assertClientIdMatchesMode(env.TRUELAYER_CLIENT_ID, env.TRUELAYER_MODE)

  return Object.freeze({
    clientId: env.TRUELAYER_CLIENT_ID,
    clientSecret: env.TRUELAYER_CLIENT_SECRET,
    redirectUri: env.TRUELAYER_REDIRECT_URI,
    baseUrl,
    mode: env.TRUELAYER_MODE,
  })
}

/**
 * Server-only TrueLayer Data API configuration (OAuth + data reads).
 * Do not import from Client Components or any file marked `"use client"`.
 */
export const truelayerConfig: TrueLayerConfig = loadTruelayerConfig()

/** Safe dev log line for correlating env with authorize URL (does not print full client_id). */
export function redactTrueLayerClientIdForLog(clientId: string): string {
  const n = clientId.length
  if (n <= 6) return `(${n} chars)`
  return `${clientId.slice(0, 4)}…${clientId.slice(-2)} (${n} chars)`
}
