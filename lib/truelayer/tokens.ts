import "server-only"

import { refreshAccessToken, TrueLayerApiError } from "@/lib/truelayer/client"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { BankConnection } from "@/lib/types"

/** Proactive refresh if access token expires within this window (ms). */
const EXPIRY_SKEW_MS = 60_000

export type BankConnectionErrorCode =
  | "not_active"
  | "revoked"
  | "missing_refresh_token"
  | "refresh_failed"

export class BankConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: BankConnectionErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "BankConnectionError"
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isInvalidGrant(err: unknown): boolean {
  if (!(err instanceof TrueLayerApiError)) return false
  if (!isRecord(err.body)) return false
  return err.body.error === "invalid_grant"
}

function expiresAtNeedsRefresh(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return true
  const t = Date.parse(expiresAtIso)
  if (!Number.isFinite(t)) return true
  return t <= Date.now() + EXPIRY_SKEW_MS
}

/**
 * Returns a usable Data API access token for this bank connection, refreshing
 * and persisting new tokens via Supabase when needed.
 *
 * Call only from server code (Server Components, Server Actions, Route Handlers).
 * Never return tokens to the client.
 */
export async function ensureBankConnectionAccessToken(
  connection: BankConnection,
): Promise<string> {
  if (connection.status !== "active") {
    throw new BankConnectionError(
      `Bank connection is not active (status: ${connection.status}). Reconnect your bank in settings.`,
      "not_active",
    )
  }

  if (!expiresAtNeedsRefresh(connection.expires_at)) {
    return connection.access_token
  }

  if (!connection.refresh_token?.trim()) {
    throw new BankConnectionError(
      "Bank connection has no refresh token. Reconnect with offline access enabled.",
      "missing_refresh_token",
    )
  }

  const supabase = await createServerSupabaseClient()

  try {
    const tokens = await refreshAccessToken(connection.refresh_token)
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString()

    const nextRefresh =
      typeof tokens.refresh_token === "string" && tokens.refresh_token.length > 0
        ? tokens.refresh_token
        : connection.refresh_token

    const { error: updateError } = await supabase
      .from("bank_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: nextRefresh,
        expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)

    if (updateError) {
      throw new BankConnectionError(
        `Failed to save refreshed tokens: ${updateError.message}`,
        "refresh_failed",
        updateError,
      )
    }

    return tokens.access_token
  } catch (e) {
    if (e instanceof BankConnectionError) {
      throw e
    }
    if (isInvalidGrant(e)) {
      await supabase
        .from("bank_connections")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id)

      throw new BankConnectionError(
        "Bank connection was revoked or expired. Please reconnect your bank.",
        "revoked",
        e,
      )
    }

    await supabase
      .from("bank_connections")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)

    const msg =
      e instanceof Error ? e.message : "Unknown error refreshing bank connection"
    throw new BankConnectionError(
      `Could not refresh bank access: ${msg}`,
      "refresh_failed",
      e,
    )
  }
}
