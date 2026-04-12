import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { disconnectBankConnectionForUser } from "@/lib/truelayer/secret-store"

const bodySchema = z.object({
  connectionId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid connection id" }, { status: 400 })
  }

  try {
    const { removed } = await disconnectBankConnectionForUser({
      userId: user.id,
      connectionId: parsed.data.connectionId,
    })
    revalidatePath("/settings/banks")
    if (removed) {
      revalidatePath("/transactions")
      revalidatePath("/dashboard")
      revalidatePath("/budgets")
    }
    return NextResponse.json({ removed })
  } catch (e) {
    console.error("[TrueLayer disconnect] POST /api/truelayer/disconnect:", e)
    return NextResponse.json(
      { error: "Could not disconnect. Try again later." },
      { status: 500 },
    )
  }
}
