import { afterEach, describe, expect, it, vi } from "vitest"

import {
  envFiniteNumber,
  isTrueLayerRateLimited,
  readBankSyncCronEnv,
} from "@/lib/truelayer/cron-sync"

function trueLayerApiError(status: number, message = "err"): Error & { status: number } {
  const e = new Error(message) as Error & { status: number }
  e.name = "TrueLayerApiError"
  e.status = status
  return e
}

function bankConnectionError(cause: unknown): Error & { cause: unknown } {
  const e = new Error("refresh failed") as Error & { cause: unknown }
  e.name = "BankConnectionError"
  e.cause = cause
  return e
}

describe("envFiniteNumber", () => {
  it("returns fallback for undefined, empty, NaN, Infinity", () => {
    expect(envFiniteNumber(undefined, 8)).toBe(8)
    expect(envFiniteNumber("", 8)).toBe(8)
    expect(envFiniteNumber("not-a-number", 8)).toBe(8)
    expect(envFiniteNumber("Infinity", 8)).toBe(8)
  })

  it("parses valid integers", () => {
    expect(envFiniteNumber("12", 8)).toBe(12)
    expect(envFiniteNumber("0", 8)).toBe(0)
  })
})

describe("readBankSyncCronEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses defaults when vars unset", () => {
    vi.unstubAllEnvs()
    const env = readBankSyncCronEnv()
    expect(env.batchSize).toBe(8)
    expect(env.leaseSeconds).toBe(900)
    expect(env.intervalMinutes).toBe(30)
    expect(env.backoffBaseSeconds).toBe(300)
    expect(env.cronTransactionDays).toBe(7)
    expect(env.interUserDelayMs).toBe(0)
  })

  it("falls back to defaults on invalid numeric strings", () => {
    vi.stubEnv("BANK_SYNC_CRON_BATCH_SIZE", "oops")
    vi.stubEnv("BANK_SYNC_LEASE_SECONDS", "nan")
    const env = readBankSyncCronEnv()
    expect(env.batchSize).toBe(8)
    expect(env.leaseSeconds).toBe(900)
  })
})

describe("isTrueLayerRateLimited", () => {
  it("detects top-level TrueLayerApiError 429", () => {
    expect(isTrueLayerRateLimited(trueLayerApiError(429, "slow down"))).toBe(
      true,
    )
  })

  it("detects 429 nested in BankConnectionError cause", () => {
    const inner = trueLayerApiError(429, "rate limit")
    const outer = bankConnectionError(inner)
    expect(isTrueLayerRateLimited(outer)).toBe(true)
  })

  it("false for other errors", () => {
    expect(isTrueLayerRateLimited(new Error("nope"))).toBe(false)
    expect(isTrueLayerRateLimited(trueLayerApiError(500, "bad"))).toBe(false)
  })
})
