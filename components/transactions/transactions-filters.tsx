"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category, TransactionType } from "@/lib/types"

type Props = {
  monthOptions: { value: string; label: string }[]
  categories: Category[]
  currentMonth: string
  currentCategory: string | null
  currentType: TransactionType | "all"
}

export function TransactionsFilters({
  monthOptions,
  categories,
  currentMonth,
  currentCategory,
  currentType,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function navigate(next: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === undefined || v === "" || v === "all") {
        params.delete(k)
      } else {
        params.set(k, v)
      }
    }
    startTransition(() => {
      router.push(`/transactions?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="grid gap-2">
        <Label htmlFor="filter-month" className="text-xs text-muted-foreground">
          Month
        </Label>
        <Select
          value={currentMonth}
          onValueChange={(v) => navigate({ month: v })}
          disabled={pending}
        >
          <SelectTrigger id="filter-month" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-type" className="text-xs text-muted-foreground">
          Type
        </Label>
        <Select
          value={currentType}
          onValueChange={(v) =>
            navigate({
              type: v === "all" ? null : v,
            })
          }
          disabled={pending}
        >
          <SelectTrigger id="filter-type" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-cat" className="text-xs text-muted-foreground">
          Category
        </Label>
        <Select
          value={currentCategory ?? "all"}
          onValueChange={(v) =>
            navigate({
              category: v === "all" ? null : v,
            })
          }
          disabled={pending}
        >
          <SelectTrigger id="filter-cat" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => {
          startTransition(() => {
            router.push("/transactions")
          })
        }}
      >
        Clear filters
      </Button>
    </div>
  )
}
