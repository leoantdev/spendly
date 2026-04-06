import { notFound } from "next/navigation"

import { TransactionForm } from "@/components/transactions/transaction-form"
import { getCategories, getDefaultAccount, getSessionUser } from "@/lib/data"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user) return null

  const account = await getDefaultAccount()
  if (!account) notFound()

  const categories = await getCategories()

  let initial:
    | {
        id: string
        amount: number
        type: "income" | "expense"
        categoryId: string
        occurredAt: string
        note: string | null
      }
    | undefined

  if (sp.id) {
    const supabase = await createServerSupabaseClient()
    const { data: row, error } = await supabase
      .from("transactions")
      .select("id, amount, type, category_id, occurred_at, note")
      .eq("id", sp.id)
      .eq("user_id", user.id)
      .single()
    if (error || !row) notFound()
    initial = {
      id: row.id,
      amount: Number(row.amount),
      type: row.type as "income" | "expense",
      categoryId: row.category_id,
      occurredAt: row.occurred_at,
      note: row.note,
    }
  }

  return (
    <div className="pb-8">
      <TransactionForm
        categories={categories}
        defaultAccountId={account.id}
        initial={initial}
      />
    </div>
  )
}
