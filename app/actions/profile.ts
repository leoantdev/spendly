"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { profileUpdateSchema } from "@/lib/validators"

export type ActionResult = { error?: string; success?: boolean }

export async function updateProfileAction(
  _: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    currency: formData.get("currency"),
    monthStartDay: formData.get("monthStartDay"),
  })
  if (!parsed.success) {
    return { error: "Check your inputs" }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      currency: parsed.data.currency,
      month_start_day: parsed.data.monthStartDay,
    })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  return { success: true }
}
