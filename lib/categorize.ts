import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  UNCATEGORISED_EXPENSE_KEY,
  UNCATEGORISED_INCOME_KEY,
} from "@/lib/category-system"
import { unwrapSupabaseJoin } from "@/lib/postgrest-join"
import type { CategoryRuleMatchType, TransactionType } from "@/lib/types"

type CategorizeSupabase = SupabaseClient

/**
 * Loads the two system "Uncategorised" category ids for bank import / auto-categorisation.
 */
export async function loadUncategorisedCategoryIds(
  supabase: CategorizeSupabase,
  userId: string,
): Promise<{ expense: string; income: string }> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, system_key")
    .eq("user_id", userId)
    .in("system_key", [UNCATEGORISED_EXPENSE_KEY, UNCATEGORISED_INCOME_KEY])

  if (error) {
    throw new Error(`Failed to load system import categories: ${error.message}`)
  }

  let expense: string | undefined
  let income: string | undefined
  for (const row of data ?? []) {
    if (row.system_key === UNCATEGORISED_EXPENSE_KEY && typeof row.id === "string") {
      expense = row.id
    }
    if (row.system_key === UNCATEGORISED_INCOME_KEY && typeof row.id === "string") {
      income = row.id
    }
  }

  if (!expense || !income) {
    throw new Error(
      "Missing system import categories for this user. Run migrations or seed categories.",
    )
  }

  return { expense, income }
}

type RuleRow = {
  id: string
  category_id: string
  match_type: CategoryRuleMatchType
  merchant_pattern: string
  created_at: string
  categories: { type: TransactionType } | { type: TransactionType }[] | null
}

function categoryTypeFromRule(row: RuleRow): TransactionType | null {
  const joined = unwrapSupabaseJoin(row.categories)
  if (!joined) return null
  const t = joined.type
  return t === "income" || t === "expense" ? t : null
}

function matchesPattern(
  merchantNorm: string,
  pattern: string,
  matchType: CategoryRuleMatchType,
): boolean {
  const p = pattern.trim().toLowerCase()
  if (!p) return false
  if (matchType === "exact") return merchantNorm === p
  return merchantNorm.includes(p)
}

export type CategorizeTransactionsResult = {
  categorized: number
  total: number
}

/**
 * Assigns categories to uncategorised transactions using the user's rules.
 * Only considers rows with non-empty `merchant_name`. Rules must match transaction `type`.
 */
export async function categorizeTransactions(
  supabase: CategorizeSupabase,
  userId: string,
  transactionIds?: string[],
): Promise<CategorizeTransactionsResult> {
  const uncategorised = await loadUncategorisedCategoryIds(supabase, userId)

  const { data: rulesData, error: rulesErr } = await supabase
    .from("category_rules")
    .select("id, category_id, match_type, merchant_pattern, created_at, categories (type)")
    .eq("user_id", userId)

  if (rulesErr) {
    throw new Error(`Failed to load category rules: ${rulesErr.message}`)
  }

  const rules = (rulesData ?? []) as RuleRow[]
  const validRules = rules.filter((r) => categoryTypeFromRule(r) !== null)

  const exactRules = validRules
    .filter((r) => r.match_type === "exact")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const containsRules = validRules
    .filter((r) => r.match_type === "contains")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  /** PostgREST default max rows per request; paginate to avoid silent truncation. */
  const PAGE = 1000
  type UncatTxRow = {
    id: unknown
    merchant_name: unknown
    type: unknown
    category_id: unknown
  }
  const rows: UncatTxRow[] = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    let q = supabase
      .from("transactions")
      .select("id, merchant_name, type, category_id")
      .eq("user_id", userId)
      .in("category_id", [uncategorised.expense, uncategorised.income])
    if (transactionIds !== undefined && transactionIds.length > 0) {
      q = q.in("id", transactionIds)
    }
    const { data: batch, error: txErr } = await q.range(from, to)
    if (txErr) {
      throw new Error(`Failed to load transactions: ${txErr.message}`)
    }
    const chunk = batch ?? []
    rows.push(...chunk)
    if (chunk.length < PAGE) break
  }

  const total = rows.length

  const updates = new Map<string, string[]>()

  for (const tx of rows) {
    if (typeof tx.id !== "string") continue
    const rawM = tx.merchant_name
    if (typeof rawM !== "string" || !rawM.trim()) continue

    const merchantNorm = rawM.trim().toLowerCase()
    const txType = tx.type as TransactionType

    let matchedCategory: string | null = null

    for (const r of exactRules) {
      if (categoryTypeFromRule(r) !== txType) continue
      if (matchesPattern(merchantNorm, r.merchant_pattern, "exact")) {
        matchedCategory = r.category_id
        break
      }
    }
    if (!matchedCategory) {
      for (const r of containsRules) {
        if (categoryTypeFromRule(r) !== txType) continue
        if (matchesPattern(merchantNorm, r.merchant_pattern, "contains")) {
          matchedCategory = r.category_id
          break
        }
      }
    }

    if (matchedCategory) {
      const list = updates.get(matchedCategory) ?? []
      list.push(tx.id)
      updates.set(matchedCategory, list)
    }
  }

  let categorized = 0
  for (const [categoryId, ids] of updates) {
    if (ids.length === 0) continue
    const { error } = await supabase
      .from("transactions")
      .update({ category_id: categoryId })
      .eq("user_id", userId)
      .in("id", ids)
    if (error) {
      throw new Error(`Failed to categorise transactions: ${error.message}`)
    }
    categorized += ids.length
  }

  return { categorized, total }
}

/**
 * Creates or updates a learned exact-match rule for a merchant pattern.
 * Uses upsert on (user_id, merchant_pattern_normalized) to avoid a select/insert race.
 */
export async function learnCategoryRule(
  supabase: CategorizeSupabase,
  userId: string,
  merchantName: string,
  categoryId: string,
): Promise<void> {
  const trimmed = merchantName.trim()
  if (!trimmed) return

  const { error } = await supabase.from("category_rules").upsert(
    {
      user_id: userId,
      category_id: categoryId,
      merchant_pattern: trimmed,
      match_type: "exact",
      source: "learned",
    },
    { onConflict: "user_id,merchant_pattern_normalized" },
  )
  if (error) {
    throw new Error(`Failed to save category rule: ${error.message}`)
  }
}
