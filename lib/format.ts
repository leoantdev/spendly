export function formatCurrency(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`
  }
}

export function parseAmountInput(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""))
  if (Number.isNaN(n) || n <= 0) return null
  return n
}
