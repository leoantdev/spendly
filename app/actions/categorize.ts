"use server"

import { revalidatePath } from "next/cache"

import { categorizeTransactions } from "@/lib/categorize"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type AutoCategorizeResult =
  | { success: true; categorized: number; total: number }
  | { error: string }

export async function autoCategorizeAction(): Promise<AutoCategorizeResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  try {
    const { categorized, total } = await categorizeTransactions(supabase, user.id)
    revalidatePath("/transactions")
    revalidatePath("/dashboard")
    revalidatePath("/budgets")
    revalidatePath("/settings")
    return { success: true, categorized, total }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auto-categorise failed"
    return { error: msg }
  }
}
