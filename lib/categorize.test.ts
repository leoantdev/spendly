import { describe, expect, it } from "vitest"

import { categorizationMerchantLabel } from "@/lib/categorize"

describe("categorizationMerchantLabel", () => {
  it("prefers trimmed merchant_name over note", () => {
    expect(
      categorizationMerchantLabel({
        merchant_name: "  Tesco  ",
        note: "Something else",
      }),
    ).toBe("Tesco")
  })

  it("falls back to note when merchant_name is empty", () => {
    expect(
      categorizationMerchantLabel({
        merchant_name: null,
        note: "  CURSOR, AI POWERED IDE  ",
      }),
    ).toBe("CURSOR, AI POWERED IDE")
  })

  it("returns null when both are missing or blank", () => {
    expect(categorizationMerchantLabel({ merchant_name: "", note: "   " })).toBeNull()
    expect(categorizationMerchantLabel({ merchant_name: null, note: null })).toBeNull()
  })
})
