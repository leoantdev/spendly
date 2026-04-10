import "server-only"

import { createHash } from "node:crypto"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { BankConnectionStatus } from "@/lib/types"

type VaultUpdateArgs = {
  secret_id: string
  secret_value: string
  secret_name?: string | null
  secret_description?: string | null
}

type VaultCreateArgs = {
  secret_value: string
  secret_name?: string | null
  secret_description?: string | null
}

export function hashSensitiveValue(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function buildSecretName(kind: "access" | "refresh", userId: string, hash: string) {
  return `bank_connection:${userId}:${hash}:${kind}`
}

async function createVaultSecret(args: VaultCreateArgs): Promise<string> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.rpc("create_vault_secret", args)
  if (error || typeof data !== "string" || data.length === 0) {
    throw new Error(error?.message ?? "Failed to create Vault secret")
  }
  return data
}

async function updateVaultSecret(args: VaultUpdateArgs): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { error } = await admin.rpc("update_vault_secret", args)
  if (error) {
    throw new Error(error.message)
  }
}

async function readVaultSecret(secretId: string): Promise<string> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.rpc("read_vault_secret", {
    secret_id: secretId,
  })
  if (error || typeof data !== "string" || data.length === 0) {
    throw new Error(error?.message ?? "Failed to read Vault secret")
  }
  return data
}

async function upsertVaultSecret(
  existingSecretId: string | null,
  secretValue: string,
  secretName: string,
  secretDescription: string,
): Promise<string> {
  if (existingSecretId) {
    await updateVaultSecret({
      secret_id: existingSecretId,
      secret_value: secretValue,
      secret_name: secretName,
      secret_description: secretDescription,
    })
    return existingSecretId
  }

  return createVaultSecret({
    secret_value: secretValue,
    secret_name: secretName,
    secret_description: secretDescription,
  })
}

export async function upsertBankConnectionSecretState(args: {
  userId: string
  truelayerUserId: string
  accessToken: string
  refreshToken: string
  consentCreatedAt: string | null
  expiresAt: string | null
  status: BankConnectionStatus
  updatedAt: string
}): Promise<string> {
  const admin = createAdminSupabaseClient()
  const truelayerUserIdHash = hashSensitiveValue(args.truelayerUserId)

  const { data: existing, error: existingError } = await admin
    .from("bank_connections")
    .select("id, access_token_secret_id, refresh_token_secret_id")
    .eq("user_id", args.userId)
    .eq("truelayer_user_id_hash", truelayerUserIdHash)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load bank connection secret refs: ${existingError.message}`)
  }

  const accessTokenSecretId = await upsertVaultSecret(
    existing?.access_token_secret_id ?? null,
    args.accessToken,
    buildSecretName("access", args.userId, truelayerUserIdHash),
    "TrueLayer access token for Spendly bank connection",
  )
  const refreshTokenSecretId = await upsertVaultSecret(
    existing?.refresh_token_secret_id ?? null,
    args.refreshToken,
    buildSecretName("refresh", args.userId, truelayerUserIdHash),
    "TrueLayer refresh token for Spendly bank connection",
  )

  const payload = {
    user_id: args.userId,
    truelayer_user_id_hash: truelayerUserIdHash,
    access_token_secret_id: accessTokenSecretId,
    refresh_token_secret_id: refreshTokenSecretId,
    consent_created_at: args.consentCreatedAt,
    expires_at: args.expiresAt,
    status: args.status,
    updated_at: args.updatedAt,
  }

  const { data, error } = await admin
    .from("bank_connections")
    .upsert(payload, {
      onConflict: "user_id,truelayer_user_id_hash",
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to save bank connection metadata")
  }

  return data.id as string
}

export async function loadBankConnectionSecrets(
  userId: string,
  connectionId: string,
): Promise<{
  accessToken: string
  refreshToken: string
}> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("bank_connections")
    .select("access_token_secret_id, refresh_token_secret_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load bank connection secret refs")
  }

  if (!data.access_token_secret_id || !data.refresh_token_secret_id) {
    throw new Error("Bank connection is missing Vault secret refs")
  }

  const [accessToken, refreshToken] = await Promise.all([
    readVaultSecret(data.access_token_secret_id),
    readVaultSecret(data.refresh_token_secret_id),
  ])

  return { accessToken, refreshToken }
}

export async function updateBankConnectionTokenState(args: {
  userId: string
  connectionId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  status: BankConnectionStatus
  updatedAt: string
}): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("bank_connections")
    .select("access_token_secret_id, refresh_token_secret_id")
    .eq("id", args.connectionId)
    .eq("user_id", args.userId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load bank connection secrets for update")
  }

  if (!data.access_token_secret_id || !data.refresh_token_secret_id) {
    throw new Error("Bank connection is missing Vault secret refs")
  }

  // Sequential updates avoid a half-applied rotation if one Vault RPC fails mid-flight.
  await updateVaultSecret({
    secret_id: data.access_token_secret_id,
    secret_value: args.accessToken,
  })
  await updateVaultSecret({
    secret_id: data.refresh_token_secret_id,
    secret_value: args.refreshToken,
  })

  const { error: updateError } = await admin
    .from("bank_connections")
    .update({
      expires_at: args.expiresAt,
      status: args.status,
      updated_at: args.updatedAt,
    })
    .eq("id", args.connectionId)
    .eq("user_id", args.userId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export async function updateBankConnectionStatus(
  userId: string,
  connectionId: string,
  status: BankConnectionStatus,
): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from("bank_connections")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }
}
