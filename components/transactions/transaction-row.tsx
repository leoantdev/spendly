"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { deleteTransactionAction } from "@/app/actions/transactions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/format"
import type { TransactionType } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  id: string
  amount: number
  type: TransactionType
  occurredAt: string
  note: string | null
  categoryName: string
  categoryColor: string | null
  currency: string
}

export function TransactionRow({
  id,
  amount,
  type,
  occurredAt,
  note,
  categoryName,
  categoryColor,
  currency,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-3 shadow-xs">
      <span
        className="mt-1.5 size-3 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor ?? "hsl(var(--muted-foreground))" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium">{categoryName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{occurredAt}</span>
        </div>
        {note ? (
          <p className="truncate text-sm text-muted-foreground" title={note}>
            {note}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "text-base font-semibold tabular-nums",
            type === "income"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          {type === "income" ? "+" : "−"}
          {formatCurrency(amount, currency)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              disabled={pending}
              aria-label="Transaction actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/transactions/new?id=${id}`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData()
                  fd.set("id", id)
                  const res = await deleteTransactionAction(fd)
                  if (res && "error" in res && res.error) {
                    toast.error(res.error)
                    return
                  }
                  toast.success("Transaction deleted")
                  router.refresh()
                })
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
