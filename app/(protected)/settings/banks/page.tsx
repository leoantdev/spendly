import { BanksPageClient } from "@/components/banks/banks-page-client"
import type { BankAccountVm, BankConnectionVm } from "@/components/banks/types"
import { getSessionUser } from "@/lib/data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { BankAccount, BankConnection } from "@/lib/types"

type ConnRow = Pick<
  BankConnection,
  | "id"
  | "status"
  | "consent_created_at"
  | "expires_at"
  | "created_at"
  | "updated_at"
  | "truelayer_provider_id"
>

type AccRow = Pick<
  BankAccount,
  | "id"
  | "bank_connection_id"
  | "name"
  | "institution"
  | "currency"
  | "last_synced_at"
  | "created_at"
>

export default async function SettingsBanksPage({
  searchParams,
}: {
  searchParams: Promise<{ bankConnection?: string }>
}) {
  const sp = await searchParams
  const callbackStatus = sp.bankConnection

  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()

  const { data: connectionsRaw, error: connErr } = await supabase
    .from("bank_connections")
    .select(
      "id, status, consent_created_at, expires_at, created_at, updated_at, truelayer_provider_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  const { data: accountsRaw, error: accErr } = await supabase
    .from("bank_accounts")
    .select(
      "id, bank_connection_id, name, institution, currency, last_synced_at, created_at",
    )
    .eq("user_id", user.id)

  const loadError = connErr?.message ?? accErr?.message ?? null

  const connections = (connectionsRaw ?? []) as ConnRow[]
  const accounts = (accountsRaw ?? []) as AccRow[]

  const byConn = new Map<string, AccRow[]>()
  for (const a of accounts) {
    const list = byConn.get(a.bank_connection_id) ?? []
    list.push(a)
    byConn.set(a.bank_connection_id, list)
  }

  const vms: BankConnectionVm[] = connections.map((c) => {
    const accs = byConn.get(c.id) ?? []
    const institutionLabel = accs[0]?.institution ?? "Bank connection"
    let lastSynced: string | null = null
    for (const a of accs) {
      if (!a.last_synced_at) continue
      if (!lastSynced || a.last_synced_at > lastSynced) lastSynced = a.last_synced_at
    }
    const accountVms: BankAccountVm[] = accs
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        currency: a.currency,
        lastSyncedAt: a.last_synced_at,
      }))

    return {
      id: c.id,
      status: c.status,
      institutionLabel,
      providerId:
        typeof c.truelayer_provider_id === "string" &&
        c.truelayer_provider_id.trim().length > 0
          ? c.truelayer_provider_id.trim()
          : null,
      lastSyncedAt: lastSynced,
      accounts: accountVms,
    }
  })

  return (
    <BanksPageClient
      connections={vms}
      loadError={loadError}
      callbackStatus={callbackStatus}
    />
  )
}
