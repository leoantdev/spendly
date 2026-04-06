import { format } from "date-fns"

import { CategoryBreakdown } from "@/components/dashboard/category-breakdown"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { getBillingPeriodContaining } from "@/lib/billing"
import { getProfile, getSessionUser } from "@/lib/data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TransactionType } from "@/lib/types"

type CatEmbed = {
  id: string
  name: string
  color: string | null
  type: TransactionType
}

type TxRow = {
  type: TransactionType
  amount: string
  categories: CatEmbed | CatEmbed[] | null
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const period = getBillingPeriodContaining(new Date(), profile.month_start_day)
  const start = format(period.start, "yyyy-MM-dd")
  const end = format(period.end, "yyyy-MM-dd")

  const supabase = await createServerSupabaseClient()
  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, categories (id, name, color, type)")
    .eq("user_id", user.id)
    .gte("occurred_at", start)
    .lte("occurred_at", end)

  const rows = transactions ?? []

  function categoryFromRow(categories: TxRow["categories"]): CatEmbed | null {
    if (!categories) return null
    if (Array.isArray(categories)) return categories[0] ?? null
    return categories
  }

  let income = 0
  let expense = 0
  const byCategory = new Map<
    string,
    { name: string; value: number; color: string }
  >()

  for (const t of rows as TxRow[]) {
    const n = Number(t.amount)
    if (t.type === "income") income += n
    else expense += n

    const cat = categoryFromRow(t.categories)
    if (t.type === "expense" && cat) {
      const id = cat.id
      const prev = byCategory.get(id)
      const color = cat.color ?? "hsl(var(--muted-foreground))"
      const name = cat.name
      if (prev) {
        byCategory.set(id, { ...prev, value: prev.value + n })
      } else {
        byCategory.set(id, { name, value: n, color })
      }
    }
  }

  const slices = [...byCategory.entries()].map(([id, v]) => ({
    key: id,
    name: v.name,
    value: v.value,
    color: v.color,
  }))
  slices.sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-col gap-6 pb-4">
      <p className="text-sm text-muted-foreground">{period.label}</p>
      <MonthlySummary currency={profile.currency} income={income} expense={expense} />
      <CategoryBreakdown
        currency={profile.currency}
        slices={slices}
        periodLabel={period.label}
      />
    </div>
  )
}
