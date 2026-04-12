import { NextResponse } from "next/server"

import { TRUELAYER_DATA_SCOPES } from "@/lib/truelayer/oauth"
import {
  leanTrueLayerProviders,
  listTrueLayerProviders,
  providerSupportsScopes,
} from "@/lib/truelayer/providers"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Catalog of TrueLayer providers for the current app (filtered by `clientId` in Console).
 * Used for capability hints on the banks settings page.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const providers = await listTrueLayerProviders({
      countries: ["uk"],
    })
    const requiredScopes = TRUELAYER_DATA_SCOPES.split(/\s+/).filter(Boolean)
    const fullySupported = providers.filter((p) =>
      providerSupportsScopes(p, requiredScopes),
    )
    return NextResponse.json({
      providers: leanTrueLayerProviders(providers),
      count: providers.length,
      fullySupportedCount: fullySupported.length,
      requiredScopes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    console.error("[TrueLayer providers] GET failed:", message)
    return NextResponse.json(
      {
        error: message,
        providers: [],
        count: 0,
        fullySupportedCount: 0,
        requiredScopes: TRUELAYER_DATA_SCOPES.split(/\s+/).filter(Boolean),
      },
      { status: 500 },
    )
  }
}
