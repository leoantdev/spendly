/**
 * Shared JSON-shape helpers for TrueLayer Data API objects (no "server-only").
 */

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function readString(r: Record<string, unknown>, key: string): string | null {
  const v = r[key]
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

export function readNumber(r: Record<string, unknown>, key: string): number | null {
  const v = r[key]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
