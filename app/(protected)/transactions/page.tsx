import { addMonths, format } from "date-fns"

import { TransactionsFilters } from "@/components/transactions/transactions-filters"
import { TransactionRow } from "@/components/transactions/transaction-row"
import { getBillingPeriodContaining, parseMonthParam } from "@/lib/billing"
import { getCategories, getProfile, getSessionUser } from "@/lib/data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TransactionType } from "@/lib/types"

type TxRow = {
  id: string
  type: TransactionType
  amount: string
  occurred_at: string
  note: string | null
  category_id: string
  categories:
    | {
        id: string
        name: string
        color: string | null
      }
    | {
        id: string
        name: string
        color: string | null
      }[]
    | null
}

function categoryFromRow(
  categories: TxRow["categories"],
): { id: string; name: string; color: string | null } | null {
  if (!categories) return null
  if (Array.isArray(categories)) return categories[0] ?? null
  return categories
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    category?: string
    type?: string
  }>
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const categories = await getCategories()

  const now = new Date()
  const ref = parseMonthParam(sp.month, now)
  const period = getBillingPeriodContaining(ref, profile.month_start_day)
  const start = format(period.start, "yyyy-MM-dd")
  const end = format(period.end, "yyyy-MM-dd")

  const categoryFilter =
    typeof sp.category === "string" && sp.category.length > 0
      ? sp.category
      : null
  const typeFilter: TransactionType | null =
    sp.type === "income" || sp.type === "expense" ? sp.type : null

  const supabase = await createServerSupabaseClient()
  let txQuery = supabase
    .from("transactions")
    .select(
      "id, type, amount, occurred_at, note, category_id, categories (id, name, color)",
    )
    .eq("user_id", user.id)
    .gte("occurred_at", start)
    .lte("occurred_at", end)
    .order("occurred_at", { ascending: false })
    .limit(500)

  if (categoryFilter) {
    txQuery = txQuery.eq("category_id", categoryFilter)
  }
  if (typeFilter) {
    txQuery = txQuery.eq("type", typeFilter)
  }

  const { data: transactions } = await txQuery
  const rows = (transactions ?? []) as TxRow[]

  const monthValue = format(ref, "yyyy-MM")
  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = addMonths(now, -i)
    const v = format(d, "yyyy-MM")
    const p = getBillingPeriodContaining(d, profile.month_start_day)
    return { value: v, label: p.label }
  })

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TransactionsFilters
        monthOptions={monthOptions}
        categories={categories}
        currentMonth={monthValue}
        currentCategory={categoryFilter}
        currentType={typeFilter ?? "all"}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions for these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Transactions">
          {rows.map((t) => {
            const cat = categoryFromRow(t.categories)
            return (
              <TransactionRow
                key={t.id}
                id={t.id}
                amount={Number(t.amount)}
                type={t.type}
                occurredAt={t.occurred_at}
                note={t.note}
                categoryName={cat?.name ?? "Category"}
                categoryColor={cat?.color ?? null}
                currency={profile.currency}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
