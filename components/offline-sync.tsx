"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  getOfflineTransactionQueue,
  removeQueuedTransaction,
} from "@/lib/offline-queue"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

async function flushQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return

  const queue = getOfflineTransactionQueue()
  if (!queue.length) return

  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!account?.id) return

  let synced = 0
  for (const item of queue) {
    const { data: category } = await supabase
      .from("categories")
      .select("type")
      .eq("id", item.categoryId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!category || category.type !== item.type) {
      toast.error("Skipped an offline item: category no longer matches type")
      removeQueuedTransaction(item.localId)
      continue
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: account.id,
      category_id: item.categoryId,
      type: item.type,
      amount: item.amount,
      occurred_at: item.occurredAt,
      note: item.note,
    })

    if (error) {
      toast.error(`Could not sync offline transaction: ${error.message}`)
      return
    }

    removeQueuedTransaction(item.localId)
    synced += 1
  }

  if (synced > 0) {
    toast.success(`Synced ${synced} offline transaction${synced === 1 ? "" : "s"}`)
    window.location.reload()
  }
}

export function OfflineSync() {
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function scheduleFlush() {
      if (debounce.current) clearTimeout(debounce.current)
      debounce.current = setTimeout(() => {
        void flushQueue()
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
  }, [])

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
