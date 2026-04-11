"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Building2Icon, RefreshCwIcon, UnlinkIcon } from "lucide-react"
import { toast } from "sonner"

import type { BankConnectionVm } from "@/components/banks/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  transactionsAutoCategorized?: number
  hint?: string | null
}

function isSyncStats(value: unknown): value is SyncStats {
  if (typeof value !== "object" || value === null) return false
  const o = value as Record<string, unknown>
  const a = o.accountsSynced
  const n = o.newTransactionsImported
  const hintOk =
    o.hint === undefined || o.hint === null || typeof o.hint === "string"
  const c = o.transactionsAutoCategorized
  const cOk =
    c === undefined || (typeof c === "number" && Number.isFinite(c) && c >= 0)
  return (
    typeof a === "number" &&
    Number.isFinite(a) &&
    typeof n === "number" &&
    Number.isFinite(n) &&
    hintOk &&
    cOk
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

function BankConnectionDisconnect({
  connectionId,
  institutionLabel,
}: {
  connectionId: string
  institutionLabel: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirmDisconnect() {
    setPending(true)
    try {
      const res = await fetch("/api/truelayer/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })
      const body = (await res.json().catch(() => null)) as
        | { removed?: boolean; error?: string }
        | null

      if (!res.ok) {
        toast.error(
          body && typeof body.error === "string" && body.error
            ? body.error
            : "Could not disconnect.",
        )
        return
      }

      const alreadyGone = body?.removed === false
      if (alreadyGone) {
        toast.message("Already disconnected", {
          description:
            "This bank link was already removed. Imported history in Spendly is unchanged.",
        })
      } else {
        toast.success("Bank disconnected", {
          description:
            "Spendly will stop syncing this bank. Your imported transactions and accounts stay in the app.",
        })
      }
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Could not disconnect. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <UnlinkIcon className="size-4" data-icon="inline-start" />
        Disconnect
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect “{institutionLabel}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Spendly will remove this bank link and stop syncing. Accounts and
              transactions you already imported stay in the app. You can connect
              this bank again later if you want.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                void confirmDisconnect()
              }}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
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
        toast.success("Sync finished", {
          description:
            "The server response was unexpected. Refresh the page or try Sync now again if accounts look out of date.",
        })
        router.refresh()
        return
      }

      const resourceLabel =
        body.accountsSynced === 1
          ? "1 linked account or card checked"
          : `${body.accountsSynced} linked accounts or cards checked`
      const txLabel =
        body.newTransactionsImported === 1
          ? "1 new transaction imported"
          : `${body.newTransactionsImported} new transactions imported`
      const cat =
        typeof body.transactionsAutoCategorized === "number" &&
        body.transactionsAutoCategorized > 0
          ? body.transactionsAutoCategorized === 1
            ? "1 auto-categorised"
            : `${body.transactionsAutoCategorized} auto-categorised`
          : null
      const base = [resourceLabel, txLabel, cat].filter(Boolean).join(", ") + "."
      const description =
        typeof body.hint === "string" && body.hint.trim()
          ? `${base} ${body.hint}`
          : base

      toast.success("Sync complete", { description })
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
            Spendly. Read-only access—this app cannot move money. If you linked
            before card support was added, reconnect once so credit cards can be
            requested.
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
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <BankConnectionDisconnect
                      connectionId={conn.id}
                      institutionLabel={conn.institutionLabel}
                    />
                    <Badge
                      variant={statusBadgeVariant(conn.status)}
                      className="self-end sm:self-center"
                    >
                      {statusLabel(conn.status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {conn.accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Accounts and cards show up after a successful sync. If nothing
                    appears, use Sync now and read any message in the toast—older
                    connections may need reconnecting for card access.
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
