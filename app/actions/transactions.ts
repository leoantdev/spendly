"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { transactionSchema } from "@/lib/validators"

export type ActionResult = { error?: string; success?: boolean }

async function getAccountId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  preferred?: string,
) {
  if (preferred) {
    const { data } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("id", preferred)
      .maybeSingle()
    if (data?.id) return data.id
  }
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function createTransactionAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse({
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || null,
    accountId: formData.get("accountId") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.amount?.[0] ?? "Invalid" }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const accountId = await getAccountId(supabase, user.id, parsed.data.accountId)
  if (!accountId) return { error: "No account" }

  const { data: cat } = await supabase
    .from("categories")
    .select("type")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", user.id)
    .single()
  if (!cat || cat.type !== parsed.data.type) {
    return { error: "Category must match type" }
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    category_id: parsed.data.categoryId,
    type: parsed.data.type,
    amount: parsed.data.amount,
    occurred_at: parsed.data.occurredAt,
    note: parsed.data.note,
  })
  if (error) return { error: error.message }

  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return { success: true }
}

export async function updateTransactionAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id")
  if (typeof id !== "string") return { error: "Missing id" }

  const parsed = transactionSchema.safeParse({
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || null,
    accountId: formData.get("accountId") || undefined,
  })
  if (!parsed.success) return { error: "Invalid" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const accountId = await getAccountId(supabase, user.id, parsed.data.accountId)
  if (!accountId) return { error: "No account" }

  const { data: cat } = await supabase
    .from("categories")
    .select("type")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", user.id)
    .single()
  if (!cat || cat.type !== parsed.data.type) {
    return { error: "Category must match type" }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: accountId,
      category_id: parsed.data.categoryId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      occurred_at: parsed.data.occurredAt,
      note: parsed.data.note,
    })
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { error: error.message }

  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return { success: true }
}

export async function deleteTransactionAction(formData: FormData) {
  const id = formData.get("id")
  if (typeof id !== "string") return { error: "Missing id" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { error: error.message }
  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return { success: true }
}
