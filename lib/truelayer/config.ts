import "server-only"

import { z } from "zod"

const truelayerModeSchema = z.enum(["sandbox", "live"])

const truelayerEnvSchema = z.object({
  TRUELAYER_CLIENT_ID: z.string().min(1, "TRUELAYER_CLIENT_ID is required"),
  TRUELAYER_CLIENT_SECRET: z.string().min(1, "TRUELAYER_CLIENT_SECRET is required"),
  TRUELAYER_REDIRECT_URI: z.string().url("TRUELAYER_REDIRECT_URI must be a valid URL"),
  TRUELAYER_BASE_URL: z.string().url("TRUELAYER_BASE_URL must be a valid URL"),
  TRUELAYER_MODE: truelayerModeSchema,
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

function loadTruelayerConfig(): TrueLayerConfig {
  const result = truelayerEnvSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    throw new Error(`Invalid TrueLayer environment: ${issues}`)
  }

  const env = result.data
  const baseUrl = env.TRUELAYER_BASE_URL.replace(/\/+$/, "")

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
