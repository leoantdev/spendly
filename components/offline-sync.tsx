"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  getOfflineTransactionQueue,
  removeQueuedTransaction,
} from "@/lib/offline-queue"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

const INSERT_CHUNK = 100

async function flushQueue(onSynced: () => void) {
  if (typeof window === "undefined" || !navigator.onLine) return

  const queue = getOfflineTransactionQueue()
  if (!queue.length) return

  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const needsDefaultAccount = queue.some((q) => !q.accountId)
  let defaultAccountId: string | null = null
  if (needsDefaultAccount) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    defaultAccountId = account?.id ?? null
    if (!defaultAccountId) return
  }

  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .select("id, type")
    .eq("user_id", user.id)

  if (catErr) {
    toast.error(`Could not load categories: ${catErr.message}`)
    return
  }

  const typeByCategoryId = new Map(
    (categories ?? []).map((c) => [c.id, c.type as string]),
  )

  type Row = Record<string, unknown>
  const rows: Row[] = []
  const localIds: string[] = []

  for (const item of queue) {
    const catType = typeByCategoryId.get(item.categoryId)
    if (!catType || catType !== item.type) {
      toast.error("Skipped an offline item: category no longer matches type")
      removeQueuedTransaction(item.localId)
      continue
    }

    const accountId = item.accountId ?? defaultAccountId
    if (!accountId) continue

    rows.push({
      user_id: user.id,
      account_id: accountId,
      category_id: item.categoryId,
      type: item.type,
      amount: item.amount,
      occurred_at: item.occurredAt,
      note: item.note,
    })
    localIds.push(item.localId)
  }

  if (rows.length === 0) return

  let synced = 0
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const chunkIds = localIds.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from("transactions").insert(chunk)
    if (!error) {
      for (const id of chunkIds) {
        removeQueuedTransaction(id)
      }
      synced += chunk.length
      continue
    }
    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j]
      const localId = chunkIds[j]
      if (!row || !localId) continue
      const { error: oneErr } = await supabase.from("transactions").insert(row)
      if (!oneErr) {
        removeQueuedTransaction(localId)
        synced += 1
      } else {
        toast.error(`Could not sync offline transaction: ${oneErr.message}`)
      }
    }
  }

  if (synced > 0) {
    toast.success(
      `Synced ${synced} offline transaction${synced === 1 ? "" : "s"}`,
    )
    onSynced()
  }
}

export function OfflineSync() {
  const router = useRouter()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function scheduleFlush() {
      if (debounce.current) clearTimeout(debounce.current)
      debounce.current = setTimeout(() => {
        void flushQueue(() => router.refresh())
      }, 800)
    }

    function onOnline() {
      scheduleFlush()
    }

    function onVisibility() {
      if (document.visibilityState === "visible") scheduleFlush()
    }

    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisibility)
    scheduleFlush()

    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisibility)
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [router])

  useEffect(() => {
    const q = getOfflineTransactionQueue()
    if (q.length > 0 && typeof navigator !== "undefined" && navigator.onLine) {
      toast.message("Offline queue", {
        description: `${q.length} transaction(s) waiting to sync.`,
      })
    }
  }, [])

  return null
}
