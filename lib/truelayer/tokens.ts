import "server-only"

import { refreshAccessToken, TrueLayerApiError } from "@/lib/truelayer/client"
import {
  loadBankConnectionSecrets,
  updateBankConnectionStatus,
  updateBankConnectionTokenState,
} from "@/lib/truelayer/secret-store"
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

  const secrets = await loadBankConnectionSecrets(connection.user_id, connection.id)

  if (!expiresAtNeedsRefresh(connection.expires_at)) {
    return secrets.accessToken
  }

  if (!secrets.refreshToken.trim()) {
    throw new BankConnectionError(
      "Bank connection has no refresh token. Reconnect with offline access enabled.",
      "missing_refresh_token",
    )
  }

  try {
    const tokens = await refreshAccessToken(secrets.refreshToken)
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString()

    const nextRefresh =
      typeof tokens.refresh_token === "string" && tokens.refresh_token.length > 0
        ? tokens.refresh_token
        : secrets.refreshToken

    await updateBankConnectionTokenState({
      userId: connection.user_id,
      connectionId: connection.id,
      accessToken: tokens.access_token,
      refreshToken: nextRefresh,
      expiresAt,
      status: "active",
      updatedAt: new Date().toISOString(),
    })

    return tokens.access_token
  } catch (e) {
    if (e instanceof BankConnectionError) {
      throw e
    }
    if (isInvalidGrant(e)) {
      await updateBankConnectionStatus(connection.user_id, connection.id, "revoked")

      throw new BankConnectionError(
        "Bank connection was revoked or expired. Please reconnect your bank.",
        "revoked",
        e,
      )
    }

    // Transient throttling: do not mark the connection as error (would alarm users / block retries).
    if (e instanceof TrueLayerApiError && e.status === 429) {
      throw new BankConnectionError(
        e.message || "TrueLayer rate limited token refresh. Try again later.",
        "refresh_failed",
        e,
      )
    }

    await updateBankConnectionStatus(connection.user_id, connection.id, "error")

    const msg =
      e instanceof Error ? e.message : "Unknown error refreshing bank connection"
    throw new BankConnectionError(
      `Could not refresh bank access: ${msg}`,
      "refresh_failed",
      e,
    )
  }
}
