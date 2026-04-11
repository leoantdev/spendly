import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  aiCategorizeTransactions,
  getAiCategorizeMaxTransactionsPerRun,
  isAiCategorizationEnabled,
  shouldIncludeTransactionNotesInAi,
  type AiCategorizeCategoryInput,
  type AiCategorizeTxInput,
} from "@/lib/ai-categorize"
import {
  pickDominantCategoryPerMerchantNorm,
  representativeMerchantPatternPerNorm,
} from "@/lib/categorize-ai-helpers"
import {
  UNCATEGORISED_EXPENSE_KEY,
  UNCATEGORISED_INCOME_KEY,
  isUncategorisedSystemKey,
} from "@/lib/category-system"
import { unwrapSupabaseJoin } from "@/lib/postgrest-join"
import type { CategoryRuleMatchType, CategoryRuleSource, TransactionType } from "@/lib/types"
import { categoryRuleSourceSchema } from "@/lib/validators"

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
  const includeNotesInAi = shouldIncludeTransactionNotesInAi()

  type UncatTxRow = {
    id: unknown
    merchant_name: unknown
    type: unknown
    category_id: unknown
    note?: unknown
  }
  const rows: UncatTxRow[] = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    let q = includeNotesInAi
      ? supabase
          .from("transactions")
          .select("id, merchant_name, type, category_id, note")
          .eq("user_id", userId)
          .in("category_id", [uncategorised.expense, uncategorised.income])
      : supabase
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

  const matchedIds = new Set<string>()
  for (const ids of updates.values()) {
    for (const id of ids) matchedIds.add(id)
  }

  if (!isAiCategorizationEnabled()) {
    return { categorized, total }
  }

  /** Any existing rule row blocks AI for that merchant pattern (upsert would no-op; saves tokens). */
  const existingMerchantNorms = new Set(
    validRules.map((r) => r.merchant_pattern.trim().toLowerCase()).filter(Boolean),
  )

  type EligibleAiTx = {
    id: string
    merchant_name: string
    type: TransactionType
    note: string | null
  }

  const eligibleForAi: EligibleAiTx[] = []
  for (const tx of rows) {
    if (typeof tx.id !== "string") continue
    const rawM = tx.merchant_name
    if (typeof rawM !== "string" || !rawM.trim()) continue
    if (matchedIds.has(tx.id)) continue
    const txType = tx.type
    if (txType !== "income" && txType !== "expense") continue
    const norm = rawM.trim().toLowerCase()
    if (existingMerchantNorms.has(norm)) continue
    const noteRaw = includeNotesInAi ? tx.note : undefined
    eligibleForAi.push({
      id: tx.id,
      merchant_name: rawM.trim(),
      type: txType,
      note:
        includeNotesInAi && typeof noteRaw === "string" && noteRaw.trim()
          ? noteRaw
          : null,
    })
  }

  if (eligibleForAi.length === 0) {
    return { categorized, total }
  }

  try {
    const { data: catRows, error: catErr } = await supabase
      .from("categories")
      .select("id, name, type, system_key")
      .eq("user_id", userId)

    if (catErr) {
      throw new Error(`Failed to load categories for AI categorisation: ${catErr.message}`)
    }

    const assignable: AiCategorizeCategoryInput[] = []
    for (const c of catRows ?? []) {
      if (typeof c.id !== "string" || typeof c.name !== "string") continue
      const t = c.type
      if (t !== "income" && t !== "expense") continue
      if (isUncategorisedSystemKey(c.system_key)) continue
      assignable.push({ id: c.id, name: c.name, type: t })
    }

    if (assignable.length === 0) {
      return { categorized, total }
    }

    const maxAi = getAiCategorizeMaxTransactionsPerRun()
    const cappedEligible =
      maxAi === Number.POSITIVE_INFINITY
        ? eligibleForAi
        : eligibleForAi.slice(0, Math.max(0, Math.floor(maxAi)))

    const aiTxInputs: AiCategorizeTxInput[] = cappedEligible.map((t) => ({
      id: t.id,
      merchant_name: t.merchant_name,
      type: t.type,
      note: t.note,
    }))
    const rowById = new Map(cappedEligible.map((t) => [t.id, t]))

    const aiAssignments = await aiCategorizeTransactions(aiTxInputs, assignable)

    const aiUpdates = new Map<string, string[]>()
    for (const [txId, categoryId] of aiAssignments) {
      const list = aiUpdates.get(categoryId) ?? []
      list.push(txId)
      aiUpdates.set(categoryId, list)
    }

    for (const [categoryId, ids] of aiUpdates) {
      if (ids.length === 0) continue
      const { error } = await supabase
        .from("transactions")
        .update({ category_id: categoryId })
        .eq("user_id", userId)
        .in("id", ids)
      if (error) {
        throw new Error(`Failed to apply AI categorisation: ${error.message}`)
      }
      categorized += ids.length
    }

    const dominanceEntries: Array<{ merchantNorm: string; categoryId: string }> = []
    const patternEntries: Array<{ merchantNorm: string; merchantPattern: string }> = []
    for (const [txId, categoryId] of aiAssignments) {
      const row = rowById.get(txId)
      if (!row) continue
      const norm = row.merchant_name.trim().toLowerCase()
      dominanceEntries.push({ merchantNorm: norm, categoryId })
      patternEntries.push({ merchantNorm: norm, merchantPattern: row.merchant_name.trim() })
    }

    const dominantByNorm = pickDominantCategoryPerMerchantNorm(dominanceEntries)
    const patternByNorm = representativeMerchantPatternPerNorm(patternEntries)

    const ruleRows: Array<{
      user_id: string
      category_id: string
      merchant_pattern: string
      match_type: "exact"
      source: CategoryRuleSource
    }> = []

    for (const [norm, categoryId] of dominantByNorm) {
      const merchant_pattern = patternByNorm.get(norm)
      if (!merchant_pattern) continue
      ruleRows.push({
        user_id: userId,
        category_id: categoryId,
        merchant_pattern,
        match_type: "exact",
        source: categoryRuleSourceSchema.parse("ai"),
      })
    }

    if (ruleRows.length > 0) {
      const { error: ruleErr } = await supabase.from("category_rules").upsert(ruleRows, {
        onConflict: "user_id,merchant_pattern_normalized",
        ignoreDuplicates: true,
      })
      if (ruleErr) {
        throw new Error(`Failed to persist AI category rules: ${ruleErr.message}`)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn("[categorize] AI categorisation failed (rule-based results kept):", msg)
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
      source: categoryRuleSourceSchema.parse("learned"),
    },
    { onConflict: "user_id,merchant_pattern_normalized" },
  )
  if (error) {
    throw new Error(`Failed to save category rule: ${error.message}`)
  }
}
