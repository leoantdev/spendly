import type { BankConnectionStatus } from "@/lib/types"

export type BankAccountVm = {
  id: string
  name: string
  institution: string
  currency: string
  lastSyncedAt: string | null
}

export type BankConnectionVm = {
  id: string
  status: BankConnectionStatus
  institutionLabel: string
  /** TrueLayer `provider_id` when known (from GET /me at link time). */
  providerId: string | null
  lastSyncedAt: string | null
  accounts: BankAccountVm[]
}
