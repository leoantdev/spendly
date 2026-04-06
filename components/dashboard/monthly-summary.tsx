import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

type Props = {
  currency: string
  income: number
  expense: number
}

export function MonthlySummary({ currency, income, expense }: Props) {
  const net = income - expense

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(income, currency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(expense, currency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={
              net >= 0
                ? "text-2xl font-semibold tabular-nums text-foreground"
                : "text-2xl font-semibold tabular-nums text-destructive"
            }
          >
            {formatCurrency(net, currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
