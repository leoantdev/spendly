/**
 * Pure helper: choose a user-facing hint when a sync run imported nothing.
 * Kept separate from `sync.ts` for unit testing without DB / TrueLayer mocks.
 */

export type SyncHintInput = {
  connectionCount: number
  accountsSynced: number
  newTransactionsImported: number
  /** Connections skipped because refresh token / access failed */
  tokenSkips: number
  /** Connections that obtained an access token and ran list fetches */
  connectionsFetched: number
  /** Per connection: both getAccounts and getCards threw */
  bothEndpointsFailedConnections: number
  /** Per connection: both calls succeeded (no throw) and returned zero raw rows */
  emptyListConnections: number
  /** Per connection: both calls succeeded, raw rows > 0, but nothing parsed into merged */
  parseDropConnections: number
  /** Per connection: getCards threw and looks like missing scope / forbidden */
  cardsLikelyScopeDeniedConnections: number
  /** At least one connection had merged resources before transaction import */
  hadMergedResources: boolean
}

export function selectSyncHint(input: SyncHintInput): string | undefined {
  const {
    connectionCount,
    accountsSynced,
    newTransactionsImported,
    tokenSkips,
    connectionsFetched,
    bothEndpointsFailedConnections,
    emptyListConnections,
    parseDropConnections,
    cardsLikelyScopeDeniedConnections,
    hadMergedResources,
  } = input

  if (connectionCount === 0) return undefined
  if (accountsSynced > 0 || newTransactionsImported > 0) return undefined

  if (tokenSkips === connectionCount) {
    return "Could not refresh bank access for any connection. Disconnect and connect your bank again."
  }

  if (hadMergedResources) {
    return "Accounts or cards were found but nothing could be imported this run. Try syncing again in a few minutes."
  }

  if (tokenSkips > 0) {
    return "Some connections could not be refreshed. Disconnect and reconnect those banks, then try Sync now again."
  }

  if (
    connectionsFetched > 0 &&
    bothEndpointsFailedConnections === connectionsFetched
  ) {
    return "Could not load accounts or cards from your bank. Try again later."
  }

  if (cardsLikelyScopeDeniedConnections > 0) {
    return "Card access may be missing on this connection. Reconnect your bank to grant card access (new connections include this automatically)."
  }

  if (parseDropConnections > 0) {
    return "Your bank returned data we could not read. Try reconnecting; if it keeps happening, contact support."
  }

  if (
    connectionsFetched > 0 &&
    emptyListConnections === connectionsFetched &&
    parseDropConnections === 0
  ) {
    return "Your bank returned no accounts or cards. If you use a credit card, reconnect so Spendly can request card access."
  }

  return "Nothing was imported this run. Try Sync now again, or reconnect your bank if accounts or cards are still missing."
}
