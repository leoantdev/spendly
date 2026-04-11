import { describe, expect, it } from "vitest"
import { NextResponse } from "next/server"

import { applyCookies } from "@/lib/supabase/middleware"

describe("applyCookies", () => {
  it("preserves HttpOnly, Secure, SameSite, Path, and maxAge on redirect", () => {
    const from = NextResponse.next()
    from.cookies.set("sb-test", "token-value", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    const to = NextResponse.redirect("https://example.com/login")
    applyCookies(from, to)

    const c = to.cookies.get("sb-test")
    expect(c?.value).toBe("token-value")
    expect(c?.httpOnly).toBe(true)
    expect(c?.secure).toBe(true)
    expect(c?.sameSite).toBe("lax")
    expect(c?.path).toBe("/")
    expect(c?.maxAge).toBe(3600)
  })
})
