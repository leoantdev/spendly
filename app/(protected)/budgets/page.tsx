import { format } from "date-fns"

import { BudgetRow } from "@/components/budgets/budget-row"
import { getBillingPeriodContaining } from "@/lib/billing"
import { getCategories, getProfile, getSessionUser } from "@/lib/data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
type TxAgg = {
  category_id: string
}

export default async function BudgetsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const period = getBillingPeriodContaining(new Date(), profile.month_start_day)
  const start = format(period.start, "yyyy-MM-dd")
  const end = format(period.end, "yyyy-MM-dd")
  const monthYear = format(period.start, "yyyy-MM-dd")

  const supabase = await createServerSupabaseClient()

  const [categories, txsResult, budgetsResult] = await Promise.all([
    getCategories(),
    supabase
      .from("transactions")
      .select("category_id, type, amount")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("occurred_at", start)
      .lte("occurred_at", end),
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", user.id)
      .eq("month_year", monthYear),
  ])

  const expenseCategories = categories.filter((c) => c.type === "expense")

  const { data: txs } = txsResult

  const spentByCategory = new Map<string, number>()
  for (const row of (txs ?? []) as (TxAgg & { amount: string })[]) {
    const n = Number(row.amount)
    spentByCategory.set(
      row.category_id,
      (spentByCategory.get(row.category_id) ?? 0) + n,
    )
  }

  const { data: budgets } = budgetsResult

  const budgetByCategory = new Map<string, number>()
  for (const b of budgets ?? []) {
    budgetByCategory.set(b.category_id, Number(b.amount))
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <p className="text-sm text-muted-foreground">{period.label}</p>
      <div className="flex flex-col gap-3">
        {expenseCategories.map((c) => (
          <BudgetRow
            key={c.id}
            categoryId={c.id}
            categoryName={c.name}
            categoryColor={c.color}
            monthYear={monthYear}
            currency={profile.currency}
            budgetAmount={budgetByCategory.get(c.id) ?? null}
            spent={spentByCategory.get(c.id) ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
