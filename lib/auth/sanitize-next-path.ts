/**
 * Returns a safe in-app path for post-login redirects, or null if `raw` must not be used.
 * Rejects open redirects (`//host`), backslashes, and URL-like absolute targets.
 */
export function sanitizeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(trimmed.replace(/\+/g, " "))
  } catch {
    return null
  }

  if (decoded.startsWith("//")) return null
  if (decoded.includes("\\")) return null
  if (decoded.includes("://")) return null

  const rest = decoded.slice(1)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rest)) return null

  return decoded
}
