"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { upsertBudgetAction } from "@/app/actions/budgets"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  categoryId: string
  categoryName: string
  categoryColor: string | null
  monthYear: string
  currency: string
  budgetAmount: number | null
  spent: number
  children: React.ReactNode
}

export function BudgetEditSheet({
  categoryId,
  categoryName,
  categoryColor,
  monthYear,
  currency,
  budgetAmount,
  spent,
  children,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const remaining =
    budgetAmount === null ? null : Math.max(0, budgetAmount - spent)
  const over = budgetAmount !== null && spent > budgetAmount
  const pct =
    budgetAmount && budgetAmount > 0
      ? Math.min(100, Math.round((spent / budgetAmount) * 100))
      : 0

  const progressClass =
    over || pct >= 100
      ? "bg-destructive"
      : pct >= 75
        ? "bg-amber-500"
        : "bg-emerald-500"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await upsertBudgetAction(undefined, fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Budget updated")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{
                backgroundColor: categoryColor ?? "hsl(var(--muted-foreground))",
              }}
            />
            {categoryName}
          </DialogTitle>
          <DialogDescription>
            Set a budget for this category. Use 0 to clear.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="monthYear" value={monthYear} />
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="budget-amount">Monthly budget</FieldLabel>
              <Input
                id="budget-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={budgetAmount ?? ""}
                placeholder="0.00"
                className="min-h-11 px-4 py-2.5 text-base tabular-nums"
                required
              />
              <FieldDescription>
                Spent so far:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(spent, currency)}
                </span>
                {budgetAmount !== null ? (
                  <>
                    {" "}
                    · Remaining:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        over ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {formatCurrency(remaining ?? 0, currency)}
                    </span>
                  </>
                ) : null}
              </FieldDescription>
            </Field>
            {budgetAmount !== null ? (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct}% used</span>
                  {over ? <span className="text-destructive">Over budget</span> : null}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", progressClass)}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                "Save budget"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
