import { cache } from "react"

import type { Account, Category, CategoryRuleWithCategory, Profile } from "@/lib/types"
import { unwrapSupabaseJoin } from "@/lib/postgrest-join"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const getSessionUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()
  if (error || !data) return null
  return data as Profile
})

export const getDefaultAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as Account
})

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("type", { ascending: true })
    .order("name", { ascending: true })
  if (error || !data) return []
  return data as Category[]
})

export const getCategoryRules = cache(async (): Promise<CategoryRuleWithCategory[]> => {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("category_rules")
    .select(
      `
      id,
      user_id,
      category_id,
      merchant_pattern,
      match_type,
      source,
      created_at,
      categories (id, name, color, type)
    `,
    )
    .eq("user_id", user.id)
    .order("merchant_pattern", { ascending: true })
  if (error || !data) return []

  const out: CategoryRuleWithCategory[] = []
  for (const row of data) {
    const cat = unwrapSupabaseJoin(
      row.categories as
        | { id: string; name: string; color: string | null; type: string }
        | { id: string; name: string; color: string | null; type: string }[]
        | null,
    )
    if (
      !cat ||
      typeof cat.id !== "string" ||
      typeof cat.name !== "string" ||
      (cat.type !== "income" && cat.type !== "expense")
    ) {
      continue
    }
    out.push({
      id: row.id as string,
      user_id: row.user_id as string,
      category_id: row.category_id as string,
      merchant_pattern: row.merchant_pattern as string,
      match_type: row.match_type as CategoryRuleWithCategory["match_type"],
      source: row.source as CategoryRuleWithCategory["source"],
      created_at: row.created_at as string,
      category: {
        id: cat.id,
        name: cat.name,
        color: cat.color ?? null,
        type: cat.type,
      },
    })
  }
  return out
})
