import { type z } from "zod"

import { OFFLINE_QUEUE_STORAGE_KEY } from "@/lib/constants"
import { transactionSchema } from "@/lib/validators"

export type QueuedTransaction = z.infer<typeof transactionSchema> & {
  localId: string
  queuedAt: string
}

function safeParseQueue(raw: string | null): QueuedTransaction[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data as QueuedTransaction[]
  } catch {
    return []
  }
}

export function getOfflineTransactionQueue(): QueuedTransaction[] {
  if (typeof window === "undefined") return []
  try {
    return safeParseQueue(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY))
  } catch {
    return []
  }
}

export function enqueueOfflineTransaction(
  payload: z.infer<typeof transactionSchema>,
): QueuedTransaction {
  const item: QueuedTransaction = {
    ...payload,
    localId: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  }
  const next = [...getOfflineTransactionQueue(), item]
  localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(next))
  return item
}

export function removeQueuedTransaction(localId: string) {
  const next = getOfflineTransactionQueue().filter((q) => q.localId !== localId)
  localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(next))
}

export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY)
}
