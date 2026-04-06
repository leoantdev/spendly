"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  List,
  PiggyBank,
  Plus,
  Settings,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: List },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
      aria-label="Main"
    >
      <div className="relative mx-auto flex max-w-lg items-end justify-around gap-1 px-2">
        {items.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 min-w-[4.5rem] flex-1 flex-col items-center justify-end gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors",
                active && "text-foreground",
              )}
            >
              <Icon
                className={cn("size-6", active ? "text-foreground" : "text-muted-foreground")}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}

        <div className="relative flex flex-1 flex-col items-center justify-end">
          <Button
            asChild
            size="icon-lg"
            className="absolute -top-7 size-14 rounded-full shadow-md"
            aria-label="Add transaction"
          >
            <Link href="/transactions/new">
              <Plus />
            </Link>
          </Button>
          <span className="invisible h-6 text-[0.7rem]">Add</span>
        </div>

        {items.slice(2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 min-w-[4.5rem] flex-1 flex-col items-center justify-end gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors",
                active && "text-foreground",
              )}
            >
              <Icon
                className={cn("size-6", active ? "text-foreground" : "text-muted-foreground")}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
