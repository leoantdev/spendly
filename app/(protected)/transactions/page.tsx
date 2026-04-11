import { addMonths, format } from "date-fns"

import {
  TRANSACTIONS_PAGE_SIZE,
  TransactionsPagination,
} from "@/components/transactions/transactions-pagination"
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

type EqBuilder = { eq: (col: string, val: string) => unknown }

function applyFilters<Q>(
  query: Q,
  filters: { categoryFilter: string | null; typeFilter: string | null },
): Q {
  let q: unknown = query
  if (filters.categoryFilter) {
    q = (q as EqBuilder).eq("category_id", filters.categoryFilter)
  }
  if (filters.typeFilter) {
    q = (q as EqBuilder).eq("type", filters.typeFilter)
  }
  return q as Q
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    category?: string
    type?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user) return null

  const [profile, categories] = await Promise.all([
    getProfile(),
    getCategories(),
  ])
  if (!profile) return null

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

  const pageRaw = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1
  const pageGuess =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1

  const supabase = await createServerSupabaseClient()

  const countQuery = applyFilters(
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("occurred_at", start)
      .lte("occurred_at", end),
    { categoryFilter, typeFilter },
  )

  const { count: totalCountRaw } = await countQuery
  const totalCount = totalCountRaw ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / TRANSACTIONS_PAGE_SIZE))
  const page = Math.min(pageGuess, totalPages)
  const rangeFrom = (page - 1) * TRANSACTIONS_PAGE_SIZE
  const rangeTo = rangeFrom + TRANSACTIONS_PAGE_SIZE - 1

  const dataQuery = applyFilters(
    supabase
      .from("transactions")
      .select(
        "id, type, amount, occurred_at, note, category_id, categories (id, name, color)",
      )
      .eq("user_id", user.id)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false })
      .range(rangeFrom, rangeTo),
    { categoryFilter, typeFilter },
  )

  const { data: transactions } = await dataQuery
  const rows = (transactions ?? []) as TxRow[]

  const monthValue = format(ref, "yyyy-MM")
  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = addMonths(now, -i)
    const v = format(d, "yyyy-MM")
    const p = getBillingPeriodContaining(d, profile.month_start_day)
    return { value: v, label: p.label }
  })

  const paginationQuery: Record<string, string | undefined> = {}
  if (typeof sp.month === "string" && sp.month.length > 0) {
    paginationQuery.month = sp.month
  }
  if (categoryFilter) paginationQuery.category = categoryFilter
  if (typeFilter) paginationQuery.type = typeFilter

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
        <>
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
          <TransactionsPagination
            page={page}
            totalCount={totalCount}
            query={paginationQuery}
          />
        </>
      )}
    </div>
  )
}
