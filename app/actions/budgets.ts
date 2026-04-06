"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { budgetUpsertSchema } from "@/lib/validators"

export type ActionResult = { error?: string; success?: boolean }

export async function upsertBudgetAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = budgetUpsertSchema.safeParse({
    categoryId: formData.get("categoryId"),
    monthYear: formData.get("monthYear"),
    amount: formData.get("amount"),
  })
  if (!parsed.success) return { error: "Invalid budget" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  if (parsed.data.amount === 0) {
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("user_id", user.id)
      .eq("category_id", parsed.data.categoryId)
      .eq("month_year", parsed.data.monthYear)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        category_id: parsed.data.categoryId,
        month_year: parsed.data.monthYear,
        amount: parsed.data.amount,
      },
      { onConflict: "user_id,category_id,month_year" },
    )
    if (error) return { error: error.message }
  }

  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return { success: true }
}
