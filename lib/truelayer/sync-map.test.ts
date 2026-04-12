import { describe, expect, it } from "vitest"

import { mapTrueLayerTransaction } from "@/lib/truelayer/sync-map"

describe("mapTrueLayerTransaction", () => {
  const ctx = {
    userId: "user-1",
    accountId: "acc-1",
    categoryIdExpense: "cat-exp",
    categoryIdIncome: "cat-inc",
  }

  it("maps a standard account transaction with provider IDs", () => {
    const row = mapTrueLayerTransaction(
      {
        transaction_id: "tx-1",
        normalised_provider_transaction_id: "norm-abc",
        provider_transaction_id: "prov-xyz",
        timestamp: "2024-01-15T12:00:00.000Z",
        amount: -12.34,
        currency: "GBP",
        transaction_type: "DEBIT",
        description: "COFFEE",
        merchant_name: "Cafe",
        transaction_category: "PURCHASE",
        transaction_classification: ["Eating out"],
        running_balance: { amount: 100, currency: "GBP" },
        meta: { foo: "bar" },
      },
      ctx,
    )
    expect(row).not.toBeNull()
    expect(row?.import_fingerprint_hash).toBeNull()
    expect(row?.transaction_currency).toBe("GBP")
    expect(row?.transaction_category).toBe("PURCHASE")
    expect(row?.provider_occurred_at).toMatch(/2024-01-15/)
    expect(row?.occurred_at).toBe("2024-01-15")
    expect(row?.truelayer_payload).toMatchObject({ transaction_id: "tx-1" })
  })

  it("uses import fingerprint when provider IDs are missing", () => {
    const row = mapTrueLayerTransaction(
      {
        transaction_id: "tx-2",
        timestamp: "2024-02-01T00:00:00.000Z",
        amount: 5,
        currency: "EUR",
        transaction_type: "DEBIT",
        description: "ONLY DESC",
      },
      ctx,
    )
    expect(row).not.toBeNull()
    const fp = row?.import_fingerprint_hash
    expect(typeof fp).toBe("string")
    expect((fp as string).length).toBeGreaterThan(10)
    expect(row?.normalised_provider_transaction_id_hash).toBeNull()
    expect(row?.provider_transaction_id_hash).toBeNull()
  })
})
