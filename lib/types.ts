export type TransactionType = "income" | "expense"

export type Profile = {
  id: string
  display_name: string | null
  currency: string
  month_start_day: number
  created_at: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  type: TransactionType
  color: string | null
  is_default: boolean
  created_at: string
}

export type Account = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string
  type: TransactionType
  amount: string
  occurred_at: string
  note: string | null
  created_at: string
}

export type Budget = {
  id: string
  user_id: string
  category_id: string
  month_year: string
  amount: string
  created_at: string
}

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, "id" | "name" | "color" | "type">
}
