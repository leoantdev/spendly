/**
 * Pure helpers for AI auto-categorisation rule persistence (testable, deterministic).
 */

/**
 * For each distinct `merchantNorm`, picks the `categoryId` with the highest count.
 * When counts tie, picks the lexicographically smallest `categoryId` for stability.
 */
export function pickDominantCategoryPerMerchantNorm(
  entries: Array<{ merchantNorm: string; categoryId: string }>,
): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const { merchantNorm, categoryId } of entries) {
    let inner = counts.get(merchantNorm)
    if (!inner) {
      inner = new Map()
      counts.set(merchantNorm, inner)
    }
    inner.set(categoryId, (inner.get(categoryId) ?? 0) + 1)
  }

  const out = new Map<string, string>()
  for (const [norm, inner] of counts) {
    let maxCount = 0
    for (const c of inner.values()) {
      if (c > maxCount) maxCount = c
    }
    const winners = [...inner.entries()]
      .filter(([, n]) => n === maxCount)
      .map(([id]) => id)
      .sort()
    const best = winners[0]
    if (best) out.set(norm, best)
  }
  return out
}

/**
 * One canonical merchant_pattern string per normalised merchant (lexicographically smallest trim).
 */
export function representativeMerchantPatternPerNorm(
  entries: Array<{ merchantNorm: string; merchantPattern: string }>,
): Map<string, string> {
  const byNorm = new Map<string, string[]>()
  for (const { merchantNorm, merchantPattern } of entries) {
    const list = byNorm.get(merchantNorm) ?? []
    list.push(merchantPattern)
    byNorm.set(merchantNorm, list)
  }
  const out = new Map<string, string>()
  for (const [norm, patterns] of byNorm) {
    out.set(norm, patterns.sort()[0]!)
  }
  return out
}
