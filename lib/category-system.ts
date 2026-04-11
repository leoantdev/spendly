/** Stable keys for categories required by server-side importers (e.g. bank sync). */
export const UNCATEGORISED_EXPENSE_KEY = "uncategorised_expense" as const
export const UNCATEGORISED_INCOME_KEY = "uncategorised_income" as const

export type CategorySystemKey =
  | typeof UNCATEGORISED_EXPENSE_KEY
  | typeof UNCATEGORISED_INCOME_KEY

export function isSystemCategory(systemKey: string | null | undefined): boolean {
  return Boolean(systemKey)
}

export function isUncategorisedSystemKey(systemKey: string | null | undefined): boolean {
  return (
    systemKey === UNCATEGORISED_EXPENSE_KEY || systemKey === UNCATEGORISED_INCOME_KEY
  )
}
