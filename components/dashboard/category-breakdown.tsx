"use client"

import * as React from "react"
import { Cell, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/format"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export type CategorySlice = {
  name: string
  value: number
  color: string
  key: string
}

type Props = {
  currency: string
  slices: CategorySlice[]
  periodLabel: string
}

export function CategoryBreakdown({ currency, slices, periodLabel }: Props) {
  const config = React.useMemo(() => {
    const c: ChartConfig = {}
    slices.forEach((s) => {
      c[s.key] = { label: s.name, color: s.color }
    })
    return c
  }, [slices])

  if (!slices.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending by category</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No expense transactions this period yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const total = slices.reduce((acc, s) => acc + s.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by category</CardTitle>
        <CardDescription>{periodLabel}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[260px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              strokeWidth={2}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <ScrollArea className="h-48 pr-3 md:h-auto">
          <ul className="flex flex-col gap-2 text-sm" aria-label="Category totals">
            {slices.map((s) => {
              const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{pct}%</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(s.value, currency)}
                  </span>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
