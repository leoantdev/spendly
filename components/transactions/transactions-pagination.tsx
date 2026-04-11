import Link from "next/link"

import { Button } from "@/components/ui/button"

export const TRANSACTIONS_PAGE_SIZE = 100

type Props = {
  page: number
  totalCount: number
  query: Record<string, string | undefined>
}

function buildHref(nextPage: number, query: Props["query"]) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, v)
  }
  if (nextPage <= 1) params.delete("page")
  else params.set("page", String(nextPage))
  const q = params.toString()
  return q ? `/transactions?${q}` : "/transactions"
}

export function TransactionsPagination({ page, totalCount, query }: Props) {
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / TRANSACTIONS_PAGE_SIZE),
  )
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={buildHref(page - 1, query)} prefetch={false}>
            Previous
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={buildHref(page + 1, query)} prefetch={false}>
            Next
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}
