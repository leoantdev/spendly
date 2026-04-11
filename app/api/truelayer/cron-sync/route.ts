import { format, subDays } from "date-fns"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import {
  claimBankSyncUsers,
  isTrueLayerRateLimited,
  markBankSyncFailure,
  markBankSyncSuccess,
  readBankSyncCronEnv,
} from "@/lib/truelayer/cron-sync"
import { syncBankDataForUser } from "@/lib/truelayer/sync"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    console.error("[TrueLayer cron] CRON_SECRET missing or too short (min 16 chars)")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runId = crypto.randomUUID()
  const env = readBankSyncCronEnv()
  const admin = createAdminSupabaseClient()

  console.info(
    JSON.stringify({
      msg: "cron_run_start",
      source: "cron",
      runId,
      batchSize: env.batchSize,
      cronTransactionDays: env.cronTransactionDays,
    }),
  )

  let claimed: string[] = []
  try {
    claimed = await claimBankSyncUsers(admin, {
      runId,
      batchSize: env.batchSize,
      leaseSeconds: env.leaseSeconds,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "claim_failed"
    console.error(
      JSON.stringify({
        msg: "cron_claim_batch_failed",
        source: "cron",
        runId,
        error: message,
      }),
    )
    return NextResponse.json(
      { error: "Claim failed", runId },
      { status: 500 },
    )
  }

  const to = format(new Date(), "yyyy-MM-dd")
  const from = format(subDays(new Date(), env.cronTransactionDays), "yyyy-MM-dd")

  const results: {
    userId: string
    ok: boolean
    outcome?: "success" | "partial_failure" | "failure"
    accountsSynced?: number
    newTransactionsImported?: number
    error?: string
  }[] = []

  for (let i = 0; i < claimed.length; i++) {
    const userId = claimed[i]!
    if (i > 0 && env.interUserDelayMs > 0) {
      await sleep(env.interUserDelayMs)
    }

    try {
      const stats = await syncBankDataForUser(userId, {
        supabase: admin,
        source: "cron",
        runId,
        from,
        to,
      })

      if (stats.outcome === "success") {
        await markBankSyncSuccess(admin, userId, {
          intervalMinutes: env.intervalMinutes,
        })
        results.push({
          userId,
          ok: true,
          outcome: stats.outcome,
          accountsSynced: stats.accountsSynced,
          newTransactionsImported: stats.newTransactionsImported,
        })
        continue
      }

      const hintMsg =
        typeof stats.hint === "string" && stats.hint.length > 0
          ? stats.hint
          : `sync_${stats.outcome}`

      const failureBackoffBase =
        stats.outcome === "failure"
          ? Math.max(env.backoffBaseSeconds, 1800)
          : env.backoffBaseSeconds

      await markBankSyncFailure(admin, userId, {
        backoffBaseSeconds: failureBackoffBase,
        errorMessage: hintMsg,
      })
      console.warn(
        JSON.stringify({
          msg: "cron_user_sync_degraded",
          source: "cron",
          runId,
          userId,
          outcome: stats.outcome,
          hint: hintMsg,
        }),
      )
      results.push({
        userId,
        ok: false,
        outcome: stats.outcome,
        accountsSynced: stats.accountsSynced,
        newTransactionsImported: stats.newTransactionsImported,
        error: hintMsg,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      const rateLimited = isTrueLayerRateLimited(e)
      const backoffBase = rateLimited
        ? Math.max(env.backoffBaseSeconds, 3600)
        : env.backoffBaseSeconds
      await markBankSyncFailure(admin, userId, {
        backoffBaseSeconds: backoffBase,
        errorMessage: rateLimited ? `rate_limited: ${message}` : message,
      })
      console.error(
        JSON.stringify({
          msg: "cron_user_sync_failed",
          source: "cron",
          runId,
          userId,
          rateLimited,
          error: message,
        }),
      )
      results.push({ userId, ok: false, error: message })
    }
  }

  console.info(
    JSON.stringify({
      msg: "cron_run_done",
      source: "cron",
      runId,
      claimed: claimed.length,
      processed: results.length,
    }),
  )

  return NextResponse.json({
    ok: true,
    runId,
    claimed: claimed.length,
    from,
    to,
    results,
  })
}
