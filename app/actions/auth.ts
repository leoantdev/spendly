"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { loginSchema, signupSchema } from "@/lib/validators"

export type ActionResult = { error?: string; success?: boolean }

export async function loginAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid input" }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  const next = formData.get("next")
  if (typeof next === "string" && next.startsWith("/")) {
    redirect(next)
  }
  redirect("/dashboard")
}

export async function signupAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    displayName: formData.get("displayName"),
  })
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.displayName?.[0] ??
      parsed.error.flatten().fieldErrors.email?.[0] ??
      parsed.error.flatten().fieldErrors.password?.[0] ??
      parsed.error.flatten().fieldErrors.confirm?.[0] ??
      "Invalid input"
    return { error: msg }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
      },
    },
  })
  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
