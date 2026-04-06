"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/app/actions/transactions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORY_COLOR_PRESETS } from "@/lib/constants"
import { enqueueOfflineTransaction } from "@/lib/offline-queue"
import { parseAmountInput } from "@/lib/format"
import type { Category, TransactionType } from "@/lib/types"
import { transactionSchema } from "@/lib/validators"

type Props = {
  categories: Category[]
  defaultAccountId: string
  initial?: {
    id: string
    amount: number
    type: TransactionType
    categoryId: string
    occurredAt: string
    note: string | null
  }
}

export function TransactionForm({
  categories,
  defaultAccountId,
  initial,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense")
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "")
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : "",
  )
  const [occurredAt, setOccurredAt] = useState(
    initial?.occurredAt ?? format(new Date(), "yyyy-MM-dd"),
  )
  const [note, setNote] = useState(initial?.note ?? "")
  const [error, setError] = useState<string | null>(null)

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  function buildFormData(): FormData | null {
    setError(null)
    const amt = parseAmountInput(amount)
    if (!amt) {
      setError("Enter a valid amount")
      return null
    }
    const parsed = transactionSchema.safeParse({
      amount: amt,
      type,
      categoryId: categoryId || undefined,
      occurredAt,
      note: note.trim() || null,
      accountId: defaultAccountId,
    })
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.categoryId?.[0] ??
        parsed.error.flatten().fieldErrors.amount?.[0] ??
        "Check your inputs"
      setError(msg)
      return null
    }

    const fd = new FormData()
    if (initial?.id) fd.set("id", initial.id)
    fd.set("amount", String(parsed.data.amount))
    fd.set("type", parsed.data.type)
    fd.set("categoryId", parsed.data.categoryId)
    fd.set("occurredAt", parsed.data.occurredAt)
    fd.set("note", parsed.data.note ?? "")
    fd.set("accountId", defaultAccountId)
    return fd
  }

  function submitOnline(fd: FormData) {
    startTransition(async () => {
      const fn = initial ? updateTransactionAction : createTransactionAction
      const res = await fn(undefined, fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Updated" : "Saved")
      router.push("/transactions")
      router.refresh()
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = buildFormData()
    if (!fd) return

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const amt = Number(fd.get("amount"))
      enqueueOfflineTransaction({
        amount: amt,
        type: type,
        categoryId: categoryId,
        occurredAt,
        note: note.trim() || null,
        accountId: defaultAccountId,
      })
      toast.success("Saved offline — will sync when you’re back online")
      router.push("/transactions")
      return
    }

    submitOnline(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel>Type</FieldLabel>
          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => {
              if (v === "income" || v === "expense") {
                setType(v)
                setCategoryId("")
              }
            }}
            variant="outline"
            className="grid w-full grid-cols-2 gap-2"
          >
            <ToggleGroupItem value="expense" className="min-h-11 text-base">
              Expense
            </ToggleGroupItem>
            <ToggleGroupItem value="income" className="min-h-11 text-base">
              Income
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Field data-invalid={!!error && error.includes("amount")}>
          <FieldLabel htmlFor="amount">Amount</FieldLabel>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="transaction-amount"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-16 text-center text-3xl font-semibold tracking-tight tabular-nums"
            autoFocus={!initial}
          />
        </Field>

        <Field>
          <FieldLabel>Category</FieldLabel>
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            required
          >
            <SelectTrigger className="min-h-11 w-full text-base">
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          c.color ?? CATEGORY_COLOR_PRESETS[0],
                      }}
                    />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="occurredAt">Date</FieldLabel>
          <Input
            id="occurredAt"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="min-h-11 text-base"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="min-h-[4.5rem] text-base"
            placeholder="Coffee with Sam"
          />
          <FieldDescription>Shown in your activity list</FieldDescription>
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <Button type="submit" className="min-h-12 w-full text-base" disabled={pending}>
          {pending ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : initial ? (
            "Save changes"
          ) : (
            "Save transaction"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
