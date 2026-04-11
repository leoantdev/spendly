import { describe, expect, it } from "vitest"

import {
  pickDominantCategoryPerMerchantNorm,
  representativeMerchantPatternPerNorm,
} from "@/lib/categorize-ai-helpers"

describe("pickDominantCategoryPerMerchantNorm", () => {
  it("picks the category with the highest count per merchant", () => {
    const m = pickDominantCategoryPerMerchantNorm([
      { merchantNorm: "tesco", categoryId: "a1111111-1111-4111-8111-111111111111" },
      { merchantNorm: "tesco", categoryId: "a1111111-1111-4111-8111-111111111111" },
      { merchantNorm: "tesco", categoryId: "b2222222-2222-4222-8222-222222222222" },
    ])
    expect(m.get("tesco")).toBe("a1111111-1111-4111-8111-111111111111")
  })

  it("breaks ties with lexicographically smallest category id", () => {
    const a = "b0000000-0000-4000-8000-000000000002"
    const b = "a0000000-0000-4000-8000-000000000001"
    const m = pickDominantCategoryPerMerchantNorm([
      { merchantNorm: "x", categoryId: a },
      { merchantNorm: "x", categoryId: b },
    ])
    expect(m.get("x")).toBe(b)
  })
})

describe("representativeMerchantPatternPerNorm", () => {
  it("picks the lexicographically smallest pattern per norm", () => {
    const m = representativeMerchantPatternPerNorm([
      { merchantNorm: "tesco", merchantPattern: "Tesco Extra" },
      { merchantNorm: "tesco", merchantPattern: "A Tesco" },
    ])
    expect(m.get("tesco")).toBe("A Tesco")
  })
})
