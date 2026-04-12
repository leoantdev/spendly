"use client"

import { usePathname } from "next/navigation"

import { BottomNav } from "@/components/layout/bottom-nav"
import { OfflineSync } from "@/components/offline-sync"

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/transactions": "Transactions",
  "/transactions/new": "Add",
  "/budgets": "Budgets",
  "/settings": "Settings",
  "/settings/categories": "Categories",
  "/settings/rules": "Auto-categorise rules",
  "/settings/banks": "Banks",
}

function titleForPath(pathname: string) {
  if (pathname.startsWith("/transactions/new")) return titles["/transactions/new"]
  if (pathname.startsWith("/transactions")) return titles["/transactions"]
  if (pathname.startsWith("/settings/categories")) return titles["/settings/categories"]
  if (pathname.startsWith("/settings/rules")) return titles["/settings/rules"]
  if (pathname.startsWith("/settings/banks")) return titles["/settings/banks"]
  return titles[pathname] ?? "Spendly"
}

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titleForPath(pathname)
  const hideNav = pathname.startsWith("/transactions/new")

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
      <main
        className={
          hideNav
            ? "mx-auto w-full max-w-lg flex-1 px-4 pb-[env(safe-area-inset-bottom)] pt-2"
            : "mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-2"
        }
      >
        {children}
      </main>
      <OfflineSync />
      {hideNav ? null : <BottomNav />}
    </div>
  )
}
