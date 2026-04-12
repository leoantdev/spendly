"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TagsIcon } from "lucide-react"
import { toast } from "sonner"

import { autoCategorizeAction } from "@/app/actions/categorize"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function AutoCategorizeButton({
  uncategorisedCount,
}: {
  uncategorisedCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (uncategorisedCount <= 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        Auto-categorise runs on every uncategorised import (all billing periods), not only the
        month you are viewing.
      </p>
    <Button
      type="button"
      variant="secondary"
      className="min-h-11 w-full gap-2 sm:w-auto"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await autoCategorizeAction()
          if ("error" in res) {
            toast.error(res.error)
            return
          }
          if (res.categorized === 0) {
            toast.message("Nothing categorised", {
              description:
                res.total === 0
                  ? "No uncategorised transactions."
                  : "No transactions were categorised this time.",
            })
          } else {
            toast.success(
              res.categorized === 1
                ? "1 transaction categorised"
                : `${res.categorized} transactions categorised`,
              {
                description: `Categorised ${res.categorized} of ${res.total} uncategorised.`,
              },
            )
          }
          router.refresh()
        })
      }}
    >
      {pending ? (
        <Spinner className="size-4" />
      ) : (
        <TagsIcon className="size-4" aria-hidden />
      )}
      Auto-categorise
    </Button>
    </div>
  )
}
