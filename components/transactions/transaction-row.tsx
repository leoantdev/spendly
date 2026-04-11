import { TransactionRowActions } from "@/components/transactions/transaction-row-actions"
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
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-3 shadow-xs">
      <span
        className="mt-1.5 size-3 shrink-0 rounded-full"
        style={{
          backgroundColor: categoryColor ?? "hsl(var(--muted-foreground))",
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium">{categoryName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {occurredAt}
          </span>
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
        <TransactionRowActions transactionId={id} />
      </div>
    </li>
  )
}
