import {
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns"

/** Inclusive date range for the billing period that contains `reference`. */
export function getBillingPeriodContaining(
  reference: Date,
  monthStartDay: number,
): { start: Date; end: Date; label: string } {
  const ref = startOfDay(reference)

  if (monthStartDay <= 1) {
    const start = startOfMonth(ref)
    const end = endOfMonth(ref)
    return {
      start,
      end,
      label: format(start, "MMMM yyyy"),
    }
  }

  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()

  let periodStart: Date
  if (d >= monthStartDay) {
    periodStart = new Date(y, m, monthStartDay)
  } else {
    periodStart = new Date(y, m - 1, monthStartDay)
  }

  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  periodEnd.setDate(periodEnd.getDate() - 1)

  return {
    start: startOfDay(periodStart),
    end: startOfDay(periodEnd),
    label: `${format(periodStart, "d MMM")} – ${format(periodEnd, "d MMM yyyy")}`,
  }
}

export function isDateInBillingPeriod(
  occurredAt: string,
  start: Date,
  end: Date,
): boolean {
  const day = startOfDay(parseISO(occurredAt))
  return isWithinInterval(day, { start, end })
}

/** First calendar day used as `month_year` key for budgets (period start). */
export function budgetMonthKeyFromPeriodStart(start: Date): string {
  return format(start, "yyyy-MM-01")
}

export function parseMonthParam(
  monthStr: string | undefined,
  fallback: Date,
): Date {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return startOfMonth(fallback)
  }
  const [y, m] = monthStr.split("-").map(Number)
  return new Date(y, m - 1, 1)
}
