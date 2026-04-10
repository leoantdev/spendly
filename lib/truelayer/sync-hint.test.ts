import { describe, expect, it } from "vitest"

import { selectSyncHint, type SyncHintInput } from "@/lib/truelayer/sync-hint"

function base(over: Partial<SyncHintInput> = {}): SyncHintInput {
  return {
    connectionCount: 1,
    accountsSynced: 0,
    newTransactionsImported: 0,
    tokenSkips: 0,
    connectionsFetched: 1,
    bothEndpointsFailedConnections: 0,
    emptyListConnections: 0,
    parseDropConnections: 0,
    cardsLikelyScopeDeniedConnections: 0,
    hadMergedResources: false,
    ...over,
  }
}

describe("selectSyncHint", () => {
  it("returns undefined when something was imported", () => {
    expect(selectSyncHint(base({ accountsSynced: 1 }))).toBeUndefined()
    expect(selectSyncHint(base({ newTransactionsImported: 3 }))).toBeUndefined()
  })

  it("returns undefined when there are no connections", () => {
    expect(
      selectSyncHint(
        base({ connectionCount: 0, connectionsFetched: 0, tokenSkips: 0 }),
      ),
    ).toBeUndefined()
  })

  it("all token skips", () => {
    const h = selectSyncHint(
      base({
        tokenSkips: 2,
        connectionCount: 2,
        connectionsFetched: 0,
      }),
    )
    expect(h).toContain("Could not refresh bank access for any connection")
  })

  it("had merged resources but no successful transaction import", () => {
    const h = selectSyncHint(
      base({
        hadMergedResources: true,
        tokenSkips: 0,
      }),
    )
    expect(h).toContain("Accounts or cards were found")
  })

  it("partial token skips before other diagnoses", () => {
    const h = selectSyncHint(
      base({
        connectionCount: 2,
        tokenSkips: 1,
        connectionsFetched: 1,
        emptyListConnections: 1,
      }),
    )
    expect(h).toContain("Some connections could not be refreshed")
  })

  it("every fetched connection had both list endpoints fail", () => {
    const h = selectSyncHint(
      base({
        bothEndpointsFailedConnections: 1,
        connectionsFetched: 1,
      }),
    )
    expect(h).toContain("Could not load accounts or cards")
  })

  it("both endpoints failed takes precedence over card-scope hint", () => {
    const h = selectSyncHint(
      base({
        bothEndpointsFailedConnections: 1,
        connectionsFetched: 1,
        cardsLikelyScopeDeniedConnections: 1,
      }),
    )
    expect(h).toContain("Could not load accounts or cards")
    expect(h).not.toContain("Card access may be missing")
  })

  it("card scope likely denied", () => {
    const h = selectSyncHint(
      base({
        cardsLikelyScopeDeniedConnections: 1,
        emptyListConnections: 1,
      }),
    )
    expect(h).toContain("Card access may be missing")
  })

  it("parse drops", () => {
    const h = selectSyncHint(
      base({
        parseDropConnections: 1,
        emptyListConnections: 0,
      }),
    )
    expect(h).toContain("could not read")
  })

  it("empty lists on all fetched connections", () => {
    const h = selectSyncHint(
      base({
        emptyListConnections: 1,
        connectionsFetched: 1,
        parseDropConnections: 0,
      }),
    )
    expect(h).toContain("returned no accounts or cards")
  })

  it("generic fallback", () => {
    const h = selectSyncHint(
      base({
        connectionsFetched: 1,
        emptyListConnections: 0,
        parseDropConnections: 0,
        bothEndpointsFailedConnections: 0,
      }),
    )
    expect(h).toContain("Nothing was imported")
  })
})
