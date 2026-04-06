import { cache } from "react"

import type { Account, Category, Profile } from "@/lib/types"
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
