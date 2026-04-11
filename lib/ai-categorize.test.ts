import { afterEach, describe, expect, it, vi } from "vitest"

describe("getAiCategorizeMaxTransactionsPerRun", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("defaults to 500", async () => {
    vi.stubEnv("AI_CATEGORIZE_MAX_TRANSACTIONS", undefined)
    const { getAiCategorizeMaxTransactionsPerRun } = await import("@/lib/ai-categorize")
    expect(getAiCategorizeMaxTransactionsPerRun()).toBe(500)
  })

  it("returns Infinity when set to 0", async () => {
    vi.stubEnv("AI_CATEGORIZE_MAX_TRANSACTIONS", "0")
    const { getAiCategorizeMaxTransactionsPerRun } = await import("@/lib/ai-categorize")
    expect(getAiCategorizeMaxTransactionsPerRun()).toBe(Number.POSITIVE_INFINITY)
  })

  it("parses a positive cap", async () => {
    vi.stubEnv("AI_CATEGORIZE_MAX_TRANSACTIONS", "42")
    const { getAiCategorizeMaxTransactionsPerRun } = await import("@/lib/ai-categorize")
    expect(getAiCategorizeMaxTransactionsPerRun()).toBe(42)
  })
})

describe("aiCategorizeTransactions", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("returns empty map when API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    const { aiCategorizeTransactions } = await import("@/lib/ai-categorize")
    const out = await aiCategorizeTransactions(
      [
        {
          id: "c0000000-0000-4000-8000-000000000001",
          merchant_name: "Test",
          type: "expense",
          note: null,
        },
      ],
      [
        {
          id: "d0000000-0000-4000-8000-000000000001",
          name: "Groceries",
          type: "expense",
        },
      ],
    )
    expect(out.size).toBe(0)
  })
})

describe("shouldIncludeTransactionNotesInAi", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("is false by default", async () => {
    vi.stubEnv("AI_CATEGORIZE_INCLUDE_TRANSACTION_NOTES", undefined)
    const { shouldIncludeTransactionNotesInAi } = await import("@/lib/ai-categorize")
    expect(shouldIncludeTransactionNotesInAi()).toBe(false)
  })

  it("is true when set to 1", async () => {
    vi.stubEnv("AI_CATEGORIZE_INCLUDE_TRANSACTION_NOTES", "1")
    const { shouldIncludeTransactionNotesInAi } = await import("@/lib/ai-categorize")
    expect(shouldIncludeTransactionNotesInAi()).toBe(true)
  })
})
