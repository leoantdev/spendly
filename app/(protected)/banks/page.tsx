import { redirect } from "next/navigation"

/** Legacy `/banks` URL — bank management lives under settings. */
export default async function BanksLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const raw = sp.bankConnection
  const bankConnection =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined

  const q = new URLSearchParams()
  if (bankConnection) q.set("bankConnection", bankConnection)
  const qs = q.toString()
  redirect(`/settings/banks${qs ? `?${qs}` : ""}`)
}
