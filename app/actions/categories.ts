"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { categorySchema } from "@/lib/validators"

export type ActionResult = { error?: string; success?: boolean }

export async function createCategoryAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color"),
  })
  if (!parsed.success) return { error: "Invalid category" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    color: parsed.data.color,
    is_default: false,
  })
  if (error) return { error: error.message }
  revalidatePath("/settings")
  revalidatePath("/transactions")
  revalidatePath("/transactions/new")
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function updateCategoryAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id")
  if (typeof id !== "string") return { error: "Missing id" }
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color"),
  })
  if (!parsed.success) return { error: "Invalid category" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color,
    })
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  revalidatePath("/transactions")
  revalidatePath("/transactions/new")
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function deleteCategoryAction(formData: FormData) {
  const id = formData.get("id")
  if (typeof id !== "string") return { error: "Missing id" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  revalidatePath("/transactions")
  revalidatePath("/transactions/new")
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return { success: true }
}
