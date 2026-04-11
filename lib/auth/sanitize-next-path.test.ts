import { describe, expect, it } from "vitest"

import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path"

describe("sanitizeNextPath", () => {
  it("accepts simple app paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard")
    expect(sanitizeNextPath("/transactions?x=1")).toBe("/transactions?x=1")
    expect(sanitizeNextPath("/")).toBe("/")
  })

  it("rejects protocol-relative and off-site patterns", () => {
    expect(sanitizeNextPath("//evil.example/path")).toBeNull()
    expect(sanitizeNextPath("/\\evil")).toBeNull()
    expect(sanitizeNextPath("https://evil.example")).toBeNull()
  })

  it("rejects encoded open redirects", () => {
    expect(sanitizeNextPath("/%2F%2Fevil.example")).toBeNull()
  })

  it("rejects non-paths", () => {
    expect(sanitizeNextPath("dashboard")).toBeNull()
    expect(sanitizeNextPath("")).toBeNull()
    expect(sanitizeNextPath(null)).toBeNull()
  })
})
