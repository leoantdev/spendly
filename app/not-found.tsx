import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        This link may be broken or the page was moved.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  )
}
