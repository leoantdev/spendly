import { describe, expect, it } from "vitest"

import {
  addDedupeKeysForRow,
  isPostgresUniqueViolation,
  markTransactionRowSeenInBatch,
  transactionRowIsDuplicate,
} from "@/lib/truelayer/sync-utils"

describe("addDedupeKeysForRow", () => {
  it("adds both keys when row has normalised and provider IDs", () => {
    const set = new Set<string>()
    addDedupeKeysForRow(set, {
      normalised_provider_transaction_id: "norm-1",
      provider_transaction_id: "prov-1",
    })
    expect(set.has("n:norm-1")).toBe(true)
    expect(set.has("p:prov-1")).toBe(true)
  })

  it("adds only provider key when normalised is null", () => {
    const set = new Set<string>()
    addDedupeKeysForRow(set, {
      normalised_provider_transaction_id: null,
      provider_transaction_id: "prov-only",
    })
    expect(set.has("p:prov-only")).toBe(true)
    expect(set.size).toBe(1)
  })
})

describe("transactionRowIsDuplicate / markTransactionRowSeenInBatch", () => {
  it("treats new row with normalised as duplicate when DB only had provider key for same tx", () => {
    const existing = new Set<string>(["p:shared-prov"])
    const batch = new Set<string>()
    const row = {
      normalised_provider_transaction_id: "new-norm",
      provider_transaction_id: "shared-prov",
    }
    expect(transactionRowIsDuplicate(existing, batch, row)).toBe(true)
  })

  it("allows insert when keys are new", () => {
    const existing = new Set<string>(["p:other"])
    const batch = new Set<string>()
    const row = {
      normalised_provider_transaction_id: "n1",
      provider_transaction_id: "p1",
    }
    expect(transactionRowIsDuplicate(existing, batch, row)).toBe(false)
    markTransactionRowSeenInBatch(batch, row)
    expect(batch.has("n:n1")).toBe(true)
    expect(batch.has("p:p1")).toBe(true)
  })

  it("blocks second in-batch row that shares provider ID with first", () => {
    const existing = new Set<string>()
    const batch = new Set<string>()
    const first = {
      normalised_provider_transaction_id: null,
      provider_transaction_id: "dup",
    }
    const second = {
      normalised_provider_transaction_id: "norm-x",
      provider_transaction_id: "dup",
    }
    expect(transactionRowIsDuplicate(existing, batch, first)).toBe(false)
    markTransactionRowSeenInBatch(batch, first)
    expect(transactionRowIsDuplicate(existing, batch, second)).toBe(true)
  })

  it("treats row with no IDs as duplicate (skip insert)", () => {
    expect(
      transactionRowIsDuplicate(new Set(), new Set(), {
        normalised_provider_transaction_id: null,
        provider_transaction_id: null,
      }),
    ).toBe(true)
  })
})

describe("isPostgresUniqueViolation", () => {
  it("detects code 23505", () => {
    expect(isPostgresUniqueViolation({ code: "23505", message: "" })).toBe(true)
  })

  it("detects message patterns", () => {
    expect(
      isPostgresUniqueViolation({
        message: 'duplicate key value violates unique constraint "idx_foo"',
      }),
    ).toBe(true)
    expect(
      isPostgresUniqueViolation({
        message: "unique constraint violation on transactions",
      }),
    ).toBe(true)
  })

  it("returns false for unrelated errors", () => {
    expect(
      isPostgresUniqueViolation({ code: "42P01", message: "relation missing" }),
    ).toBe(false)
  })
})
