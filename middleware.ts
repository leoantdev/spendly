import { type NextRequest, NextResponse } from "next/server"

import { applyCookies, updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/budgets") ||
    pathname.startsWith("/settings")

  const isAuthPage = pathname === "/login" || pathname === "/signup"

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    const redirect = NextResponse.redirect(url)
    return applyCookies(response, redirect)
  }

  if (isAuthPage && user) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url))
    return applyCookies(response, redirect)
  }

  if (pathname === "/") {
    if (user) {
      const redirect = NextResponse.redirect(
        new URL("/dashboard", request.url),
      )
      return applyCookies(response, redirect)
    }
    const redirect = NextResponse.redirect(new URL("/login", request.url))
    return applyCookies(response, redirect)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
                                ],
}
