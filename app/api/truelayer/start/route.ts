import { type NextRequest, NextResponse } from "next/server"

import { redactTrueLayerClientIdForLog, truelayerConfig } from "@/lib/truelayer/config"
import {
  buildTrueLayerAuthorizationUrl,
  createPkcePair,
  generateOAuthSecret,
  getTrueLayerAuthAuthorizeUrl,
  setTrueLayerOAuthCookies,
} from "@/lib/truelayer/oauth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function buildTrueLayerStartDiagnostics(request: NextRequest): {
  mode: string
  authorizeHost: string
  redirectUri: string
  redirectUriHostPath?: string
  requestOrigin: string | null
  originMatchesRedirectHost: boolean
  hint?: string
} {
  const authBase = new URL(getTrueLayerAuthAuthorizeUrl())
  const redirectUri = truelayerConfig.redirectUri
  const requestOrigin = request.headers.get("origin")

  let originMatchesRedirectHost = true
  let hint: string | undefined
  let redirectUriHostPath: string | undefined

  try {
    const ru = new URL(redirectUri)
    redirectUriHostPath = `${ru.protocol}//${ru.host}${ru.pathname}`
    if (requestOrigin) {
      const ou = new URL(requestOrigin)
      originMatchesRedirectHost = ru.host === ou.host
      if (!originMatchesRedirectHost) {
        hint =
          `You opened the app at ${ou.host} but TRUELAYER_REDIRECT_URI uses ${ru.host}. ` +
          `TrueLayer requires an exact redirect URI match in Console — register both or use one host consistently ` +
          `(e.g. always http://localhost:3000/...).`
      }
    }
  } catch {
    // redirectUri already validated at config load
  }

  return {
    mode: truelayerConfig.mode,
    authorizeHost: authBase.host,
    redirectUri,
    requestOrigin,
    originMatchesRedirectHost,
    ...(redirectUriHostPath !== undefined ? { redirectUriHostPath } : {}),
    ...(hint !== undefined ? { hint } : {}),
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const state = generateOAuthSecret()
  const nonce = generateOAuthSecret()
  const { codeVerifier, codeChallenge } = createPkcePair()
  const url = buildTrueLayerAuthorizationUrl({ state, nonce, codeChallenge })

  const devDiagnostics =
    process.env.NODE_ENV === "development"
      ? buildTrueLayerStartDiagnostics(request)
      : undefined

  if (devDiagnostics) {
    console.log("[TrueLayer start] TRUELAYER_MODE:", devDiagnostics.mode)
    console.log("[TrueLayer start] Authorize host:", devDiagnostics.authorizeHost)
    console.log(
      "[TrueLayer start] TRUELAYER_CLIENT_ID (redacted):",
      redactTrueLayerClientIdForLog(truelayerConfig.clientId),
    )
    if (devDiagnostics.redirectUriHostPath !== undefined) {
      console.log(
        "[TrueLayer start] OAuth redirect_uri (host + path):",
        devDiagnostics.redirectUriHostPath,
      )
    }
    if (devDiagnostics.requestOrigin) {
      console.log("[TrueLayer start] Request Origin:", devDiagnostics.requestOrigin)
      console.log(
        "[TrueLayer start] Origin matches redirect host:",
        devDiagnostics.originMatchesRedirectHost,
      )
    }
    if (devDiagnostics.hint) console.warn("[TrueLayer start]", devDiagnostics.hint)
  }

  const res = NextResponse.json({
    url,
    ...(devDiagnostics !== undefined ? { diagnostics: devDiagnostics } : {}),
  })
  setTrueLayerOAuthCookies(res, { state, nonce, codeVerifier })
  return res
}
