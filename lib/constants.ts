export const CURRENCIES = [
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
] as const

export const CATEGORY_COLOR_PRESETS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#64748b",
  "#ef4444",
  "#06b6d4",
] as const

export const OFFLINE_QUEUE_STORAGE_KEY = "spendly:txn-queue:v1"
