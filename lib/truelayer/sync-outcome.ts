/**
 * Classifies a completed sync run for scheduling / observability (e.g. Vercel cron).
 * Pure helper — unit tested without DB or TrueLayer.
 */

export type SyncRunOutcome = "success" | "partial_failure" | "failure"

/**
 * @param connectionCount Active connections considered for this run
 * @param tokenSkips Connections skipped because refresh/access failed
 * @param hint User-facing hint from `selectSyncHint`; undefined means healthy
 */
export function classifySyncRunOutcome(
  connectionCount: number,
  tokenSkips: number,
  hint: string | undefined,
): SyncRunOutcome {
  if (hint === undefined) return "success"
  if (connectionCount > 0 && tokenSkips === connectionCount) return "failure"
  return "partial_failure"
}
