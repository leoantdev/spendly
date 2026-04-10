"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Building2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import type { BankConnectionVm } from "@/components/banks/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

/** Survives React Strict Mode remount in dev (refs reset); blocks duplicate toasts only. */
const BANK_CALLBACK_DEDUPE_MS = 2_000
let lastBankCallbackHandled: { status: string; at: number } | null = null

type SyncStats = {
  accountsSynced: number
  newTransactionsImported: number
}

function isSyncStats(value: unknown): value is SyncStats {
  if (typeof value !== "object" || value === null) return false
  const o = value as Record<string, unknown>
  const a = o.accountsSynced
  const n = o.newTransactionsImported
  return (
    typeof a === "number" &&
    Number.isFinite(a) &&
    typeof n === "number" &&
    Number.isFinite(n)
  )
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Never synced"
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm")
  } catch {
    return "Never synced"
  }
}

function statusBadgeVariant(
  status: BankConnectionVm["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "secondary"
    case "error":
      return "destructive"
    case "revoked":
      return "outline"
    default:
      return "outline"
  }
}

function statusLabel(status: BankConnectionVm["status"]): string {
  switch (status) {
    case "active":
      return "Active"
    case "error":
      return "Error"
    case "revoked":
      return "Revoked"
    default:
      return status
  }
}

export function BanksPageClient({
  connections,
  loadError,
  callbackStatus,
}: {
  connections: BankConnectionVm[]
  loadError: string | null
  callbackStatus: string | undefined
}) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!callbackStatus) {
      lastBankCallbackHandled = null
      return
    }

    const now = Date.now()
    const duplicate =
      lastBankCallbackHandled !== null &&
      lastBankCallbackHandled.status === callbackStatus &&
      now - lastBankCallbackHandled.at < BANK_CALLBACK_DEDUPE_MS

    if (duplicate) {
      router.replace("/banks")
      return
    }

    lastBankCallbackHandled = { status: callbackStatus, at: now }

    switch (callbackStatus) {
      case "success":
        toast.success("Bank connected. You can sync to import recent transactions.")
        break
      case "cancelled":
        toast.message("Connection cancelled", {
          description: "No bank was linked.",
        })
        break
      case "session":
        toast.error("Your session expired. Sign in and try again.")
        break
      case "failed":
      case "error":
        toast.error("Could not complete bank connection. Please try again.")
        break
      default:
        break
    }

    router.replace("/banks")
  }, [callbackStatus, router])

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch("/api/truelayer/start", { method: "POST" })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(body?.error ?? "Could not start bank connection.")
        return
      }
      const data = (await res.json()) as {
        url?: string
        diagnostics?: {
          mode: string
          authorizeHost: string
          redirectUri: string
          redirectUriHostPath?: string
          requestOrigin: string | null
          originMatchesRedirectHost: boolean
          hint?: string
        }
      }
      if (!data.url) {
        toast.error("Invalid response from server.")
        return
      }
      if (process.env.NODE_ENV === "development" && data.diagnostics) {
        console.info("[TrueLayer] POST /api/truelayer/start diagnostics:", data.diagnostics)
        if (data.diagnostics.hint) {
          console.warn("[TrueLayer]", data.diagnostics.hint)
        }
      }
      window.location.href = data.url
    } catch {
      toast.error("Something went wrong. Check your connection and try again.")
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/truelayer/sync", { method: "POST" })
      const body = (await res.json().catch(() => null)) as
        | SyncStats
        | { error?: string }
        | null

      if (!res.ok) {
        const msg =
          body && typeof body === "object" && "error" in body && body.error
            ? body.error
            : "Sync failed."
        toast.error(msg)
        return
      }

      if (!isSyncStats(body)) {
        toast.success("Sync complete")
        router.refresh()
        return
      }

      toast.success("Sync complete", {
        description: `${body.accountsSynced} account(s) checked, ${body.newTransactionsImported} new transaction(s) imported.`,
      })
      router.refresh()
    } catch {
      toast.error("Sync failed. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank feeds</CardTitle>
          <CardDescription>
            Link your bank to import transactions for viewing and budgeting in
            Spendly. Read-only access—this app cannot move money.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            type="button"
            className="min-h-11 w-full"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Spinner />
                Connecting…
              </>
            ) : (
              <>
                <Building2Icon data-icon="inline-start" />
                Connect a bank
              </>
            )}
          </Button>
          {connections.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <Spinner />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCwIcon data-icon="inline-start" />
                  Sync now
                </>
              )}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {loadError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Could not load connections
            </CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loadError && connections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No banks linked yet</CardTitle>
            <CardDescription>
              Connect a bank above to see your accounts here and import
              transactions.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loadError && connections.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            Connected banks
          </p>
          {connections.map((conn) => (
            <Card key={conn.id} size="sm">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <CardTitle className="truncate text-base">
                      {conn.institutionLabel}
                    </CardTitle>
                    <CardDescription>
                      Last synced: {formatSyncedAt(conn.lastSyncedAt)}
                    </CardDescription>
                  </div>
                  <Badge variant={statusBadgeVariant(conn.status)}>
                    {statusLabel(conn.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {conn.accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Accounts will appear after the first sync.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3" aria-label="Accounts">
                    {conn.accounts.map((acc) => (
                      <li key={acc.id}>
                        <div className="flex flex-col gap-1">
                          <p className="font-medium leading-snug">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {acc.currency} · {formatSyncedAt(acc.lastSyncedAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
