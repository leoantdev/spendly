import { describe, expect, it } from "vitest"

import {
  mergeLinkedResources,
  mergeLinkedResourcesWithStats,
  parseTrueLayerLinkedResource,
} from "@/lib/truelayer/sync-parse"

describe("parseTrueLayerLinkedResource", () => {
  it("parses account-shaped payload", () => {
    const p = parseTrueLayerLinkedResource(
      {
        account_id: "acc-1",
        display_name: "Current",
        currency: "GBP",
        provider: { display_name: "Test Bank", provider_id: "test" },
      },
      "account",
    )
    expect(p).toEqual({
      kind: "account",
      accountId: "acc-1",
      displayName: "Current",
      currency: "GBP",
      institution: "Test Bank",
    })
  })

  it("parses card-shaped payload", () => {
    const p = parseTrueLayerLinkedResource(
      {
        account_id: "card-acc-1",
        display_name: "Visa Credit",
        currency: "GBP",
        provider: { provider_id: "uk-mock" },
      },
      "card",
    )
    expect(p).toEqual({
      kind: "card",
      accountId: "card-acc-1",
      displayName: "Visa Credit",
      currency: "GBP",
      institution: "uk-mock",
    })
  })

  it("uses account_id as display name when display_name blank", () => {
    const p = parseTrueLayerLinkedResource(
      { account_id: "acc-short", display_name: "  ", currency: "GBP" },
      "account",
    )
    expect(p).toEqual({
      kind: "account",
      accountId: "acc-short",
      displayName: "acc-short",
      currency: "GBP",
      institution: "Bank",
    })
  })

  it("uses name when display_name missing", () => {
    const p = parseTrueLayerLinkedResource(
      {
        account_id: "a1",
        name: "Nickname",
        currency: "EUR",
        provider: { display_name: "Bank" },
      },
      "account",
    )
    expect(p?.displayName).toBe("Nickname")
    expect(p?.currency).toBe("EUR")
  })

  it("defaults currency to GBP when missing", () => {
    const p = parseTrueLayerLinkedResource(
      {
        account_id: "a1",
        display_name: "Current",
        provider: {},
      },
      "account",
    )
    expect(p?.currency).toBe("GBP")
  })

  it("uses defaultCurrency option when provider omits currency", () => {
    const p = parseTrueLayerLinkedResource(
      {
        account_id: "a1",
        display_name: "Current",
        provider: {},
      },
      "account",
      { defaultCurrency: "EUR" },
    )
    expect(p?.currency).toBe("EUR")
  })

  it("returns null when account_id missing", () => {
    expect(
      parseTrueLayerLinkedResource(
        { display_name: "x", currency: "GBP" },
        "account",
      ),
    ).toBeNull()
    expect(parseTrueLayerLinkedResource(null, "card")).toBeNull()
  })
})

describe("mergeLinkedResources", () => {
  it("merges accounts then cards without duplicate account_id", () => {
    const m = mergeLinkedResources(
      [
        {
          account_id: "shared",
          display_name: "Bank",
          currency: "GBP",
          provider: { display_name: "Bank A" },
        },
      ],
      [
        {
          account_id: "shared",
          display_name: "Should not win",
          currency: "GBP",
          provider: { display_name: "Card Co" },
        },
        {
          account_id: "card-only",
          display_name: "Extra",
          currency: "EUR",
          provider: {},
        },
      ],
    )
    expect(m.size).toBe(2)
    expect(m.get("shared")?.kind).toBe("account")
    expect(m.get("shared")?.institution).toBe("Bank A")
    expect(m.get("card-only")?.kind).toBe("card")
  })

  it("mergeLinkedResourcesWithStats counts parse failures and superseded cards", () => {
    const s = mergeLinkedResourcesWithStats(
      [{ not: "an account" }],
      [{ not: "a card" }],
    )
    expect(s.merged.size).toBe(0)
    expect(s.accountParseFailures).toBe(1)
    expect(s.cardParseFailures).toBe(1)
    expect(s.cardSupersededByAccount).toBe(0)
  })

  it("mergeLinkedResourcesWithStats counts card superseded by account id", () => {
    const s = mergeLinkedResourcesWithStats(
      [
        {
          account_id: "shared",
          display_name: "Bank",
          currency: "GBP",
          provider: { display_name: "Bank A" },
        },
      ],
      [
        {
          account_id: "shared",
          display_name: "Card dup",
          currency: "GBP",
          provider: { display_name: "Ignored" },
        },
      ],
    )
    expect(s.merged.size).toBe(1)
    expect(s.cardSupersededByAccount).toBe(1)
    expect(s.accountParseFailures).toBe(0)
    expect(s.cardParseFailures).toBe(0)
  })

  it("mergeLinkedResources matches mergeLinkedResourcesWithStats.merged", () => {
    const rows = [
      {
        account_id: "a",
        display_name: "A",
        currency: "GBP",
        provider: {},
      },
    ]
    expect(mergeLinkedResources(rows, []).size).toBe(
      mergeLinkedResourcesWithStats(rows, []).merged.size,
    )
  })
})
