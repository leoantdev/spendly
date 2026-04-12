import { describe, expect, it } from "vitest"

import { sanitizeTrueLayerTransactionPayload } from "@/lib/truelayer/payload-sanitize"

describe("sanitizeTrueLayerTransactionPayload", () => {
  it("redacts card-like meta strings", () => {
    const out = sanitizeTrueLayerTransactionPayload({
      transaction_id: "t1",
      meta: {
        cardNumber: "1234567890123456",
        safe: "ok",
      },
    })
    expect(out?.meta).toMatchObject({
      cardNumber: "[redacted]",
      safe: "ok",
    })
  })

  it("allowlists top-level fields and drops provider IDs and description", () => {
    const out = sanitizeTrueLayerTransactionPayload({
      transaction_id: "t1",
      amount: -10,
      provider_transaction_id: "secret-prov",
      normalised_provider_transaction_id: "secret-norm",
      description: "PII HERE",
    })
    expect(out).toMatchObject({ transaction_id: "t1", amount: -10 })
    expect(out).not.toHaveProperty("provider_transaction_id")
    expect(out).not.toHaveProperty("normalised_provider_transaction_id")
    expect(out).not.toHaveProperty("description")
  })
})
