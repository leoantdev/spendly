import { NextResponse } from "next/server"

import {
  buildTrueLayerAuthorizationUrl,
  createPkcePair,
  generateOAuthSecret,
  setTrueLayerOAuthCookies,
} from "@/lib/truelayer/oauth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST() {
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

  const res = NextResponse.json({ url })
  setTrueLayerOAuthCookies(res, { state, nonce, codeVerifier })
  return res
}
