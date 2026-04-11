"use server"

import { revalidatePath } from "next/cache"

import { categoryRuleSchema } from "@/lib/validators"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type CategoryRuleActionResult = { error?: string; success?: boolean }

export async function createCategoryRuleAction(
  _: CategoryRuleActionResult | undefined,
  formData: FormData,
): Promise<CategoryRuleActionResult> {
  const parsed = categoryRuleSchema.safeParse({
    merchantPattern: formData.get("merchantPattern"),
    matchType: formData.get("matchType"),
    categoryId: formData.get("categoryId"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.merchantPattern?.[0] ?? "Invalid" }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { data: cat, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (catErr || !cat?.id) {
    return { error: "Category not found" }
  }

  const { error } = await supabase.from("category_rules").insert({
    user_id: user.id,
    category_id: parsed.data.categoryId,
    merchant_pattern: parsed.data.merchantPattern,
    match_type: parsed.data.matchType,
    source: "manual",
  })
  if (error) {
    if (error.code === "23505") {
      return { error: "A rule for this merchant text already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function deleteCategoryRuleAction(formData: FormData): Promise<CategoryRuleActionResult> {
  const id = formData.get("id")
  if (typeof id !== "string" || !id) return { error: "Missing id" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase
    .from("category_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}
