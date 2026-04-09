import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { syncBankDataForUser } from "@/lib/truelayer/sync"

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await syncBankDataForUser(user.id)
    if (stats.newTransactionsImported > 0 || stats.accountsSynced > 0) {
      revalidatePath("/transactions")
      revalidatePath("/dashboard")
      revalidatePath("/budgets")
    }
    return NextResponse.json(stats)
  } catch (e) {
    console.error("[TrueLayer sync] POST /api/truelayer/sync:", e)
    return NextResponse.json(
      { error: "Sync failed. Please try again later." },
      { status: 500 },
    )
  }
}
