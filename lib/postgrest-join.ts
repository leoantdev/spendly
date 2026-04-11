/**
 * PostgREST returns embedded relations as either an object or a single-element array.
 * Use this helper so callers handle both shapes consistently.
 */
export function unwrapSupabaseJoin<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}
