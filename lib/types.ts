export type TransactionType = "income" | "expense"

export type BankConnectionStatus = "active" | "revoked" | "error"

export type BankConnection = {
  id: string
  user_id: string
  consent_created_at: string | null
  expires_at: string | null
  status: BankConnectionStatus
  created_at: string
  updated_at: string
}

export type BankAccount = {
  id: string
  user_id: string
  account_id: string
  bank_connection_id: string
  name: string
  institution: string
  currency: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

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
  /** When set, row is protected (import fallbacks); see migration `system_key`. */
  system_key: string | null
  created_at: string
}

export type Account = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type CategoryRuleMatchType = "exact" | "contains"

export type CategoryRuleSource = "learned" | "manual"

export type CategoryRule = {
  id: string
  user_id: string
  category_id: string
  merchant_pattern: string
  match_type: CategoryRuleMatchType
  source: CategoryRuleSource
  created_at: string
}

export type CategoryRuleWithCategory = CategoryRule & {
  category: Pick<Category, "id" | "name" | "color" | "type">
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
  /** Provider merchant name at bank import; used for rule matching. */
  merchant_name: string | null
  truelayer_transaction_id: string | null
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
