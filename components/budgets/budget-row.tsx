import { ChevronRight } from "lucide-react"

import { BudgetEditSheet } from "@/components/budgets/budget-edit-sheet"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
}

export function BudgetRow(props: Props) {
  const { budgetAmount, spent, currency } = props

  const hasBudget = budgetAmount !== null && budgetAmount > 0
  const pct =
    hasBudget && budgetAmount
      ? Math.round((spent / budgetAmount) * 100)
      : 0
  const over = hasBudget && budgetAmount !== null && spent > budgetAmount

  const indicator =
    !hasBudget ? "muted" : over || pct >= 100 ? "red" : pct >= 75 ? "amber" : "green"

  const progressValue = hasBudget ? Math.min(100, Math.max(0, pct)) : 0

  return (
    <BudgetEditSheet {...props}>
      <button
        type="button"
        className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Card className="w-full">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    props.categoryColor ?? "hsl(var(--muted-foreground))",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{props.categoryName}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Spent{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrency(spent, currency)}
                  </span>
                </p>
              </div>
            </div>

            {hasBudget ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Budget {formatCurrency(budgetAmount!, currency)}</span>
                  {over ? (
                    <span className="font-medium text-destructive tabular-nums">
                      Over by {formatCurrency(spent - budgetAmount!, currency)}
                    </span>
                  ) : (
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(budgetAmount! - spent, currency)} left
                    </span>
                  )}
                </div>
                <Progress
                  value={progressValue}
                  className={cn(
                    "h-2",
                    indicator === "green" && "[&>div]:bg-emerald-500",
                    indicator === "amber" && "[&>div]:bg-amber-500",
                    (indicator === "red" || indicator === "muted") &&
                      "[&>div]:bg-destructive",
                  )}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tap to set a monthly budget
              </p>
            )}
          </CardContent>
        </Card>
      </button>
    </BudgetEditSheet>
  )
}
