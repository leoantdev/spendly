import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import {
  exchangeAuthCode,
  getMe,
  TrueLayerApiError,
} from "@/lib/truelayer/client"
import {
  appendBankConnectionStatus,
  clearTrueLayerOAuthCookies,
  mapTrueLayerOAuthRedirectError,
  readTrueLayerOAuthCookies,
  type BankConnectionRedirectStatus,
} from "@/lib/truelayer/oauth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function redirectWithBankStatus(
  origin: string,
  status: BankConnectionRedirectStatus,
): NextResponse {
  const url = appendBankConnectionStatus(origin, status)
  const res = NextResponse.redirect(url)
  clearTrueLayerOAuthCookies(res)
  return res
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const searchParams = request.nextUrl.searchParams

  const oauthError = searchParams.get("error")
  if (oauthError) {
    console.warn(
      "[TrueLayer callback] OAuth redirect error:",
      oauthError,
      searchParams.get("error_description"),
    )
    return redirectWithBankStatus(
      origin,
      mapTrueLayerOAuthRedirectError(oauthError),
    )
  }

  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")

  const cookieStore = await cookies()
  const stored = readTrueLayerOAuthCookies(cookieStore)

  if (!code?.trim()) {
    return redirectWithBankStatus(origin, "error")
  }

  if (
    !stateParam ||
    !stored.state ||
    stateParam !== stored.state ||
    !stored.codeVerifier?.trim()
  ) {
    return redirectWithBankStatus(origin, "error")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectWithBankStatus(origin, "session")
  }

  let tokens: Awaited<ReturnType<typeof exchangeAuthCode>>
  try {
    tokens = await exchangeAuthCode(code, {
      codeVerifier: stored.codeVerifier,
    })
  } catch (e) {
    const isInvalidGrant =
      e instanceof TrueLayerApiError &&
      typeof e.body === "object" &&
      e.body !== null &&
      "error" in e.body &&
      (e.body as { error?: string }).error === "invalid_grant"
    console.warn("[TrueLayer callback] Token exchange failed:", e)
    return redirectWithBankStatus(origin, isInvalidGrant ? "error" : "failed")
  }

  if (!tokens.refresh_token?.trim()) {
    console.warn(
      "[TrueLayer callback] Missing refresh_token; enable offline_access in TrueLayer Console.",
    )
    return redirectWithBankStatus(origin, "failed")
  }

  let me: Awaited<ReturnType<typeof getMe>>
  try {
    me = await getMe(tokens.access_token)
  } catch (e) {
    console.warn("[TrueLayer callback] GET /me failed:", e)
    return redirectWithBankStatus(origin, "failed")
  }

  if (!me) {
    return redirectWithBankStatus(origin, "failed")
  }

  const credentialsId = me.credentials_id?.trim()
  if (!credentialsId) {
    return redirectWithBankStatus(origin, "failed")
  }

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString()
  const consentCreatedAt =
    me.consent_created_at && me.consent_created_at.length > 0
      ? new Date(me.consent_created_at).toISOString()
      : null
  const nowIso = new Date().toISOString()

  const payload = {
    user_id: user.id,
    truelayer_user_id: credentialsId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    consent_created_at: consentCreatedAt,
    expires_at: expiresAt,
    status: "active" as const,
    updated_at: nowIso,
  }

  const { error: upsertError } = await supabase.from("bank_connections").upsert(payload, {
    onConflict: "user_id,truelayer_user_id",
  })

  if (upsertError) {
    console.warn("[TrueLayer callback] Upsert bank_connections failed:", upsertError)
    return redirectWithBankStatus(origin, "failed")
  }

  return redirectWithBankStatus(origin, "success")
}
