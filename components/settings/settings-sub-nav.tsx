"use client"

import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"

export function SettingsSubNav() {
  const pathname = usePathname()
  if (pathname === "/settings") return null

  return (
    <div className="-mt-1 mb-3">
      <Button variant="ghost" className="-ms-2 h-9 px-2 text-muted-foreground" asChild>
        <Link href="/settings">
          <ChevronLeftIcon className="size-4" aria-hidden />
          Settings
        </Link>
      </Button>
    </div>
  )
}
