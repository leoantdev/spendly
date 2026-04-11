"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  createCategoryRuleAction,
  deleteCategoryRuleAction,
} from "@/app/actions/category-rules"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { CATEGORY_COLOR_PRESETS } from "@/lib/constants"
import type { Category, CategoryRuleWithCategory } from "@/lib/types"

function DeleteRuleButton({ rule }: { rule: CategoryRuleWithCategory }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Transactions already categorised stay as they are. Future imports
              won&apos;t use this pattern.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                const fd = new FormData()
                fd.set("id", rule.id)
                const res = await deleteCategoryRuleAction(fd)
                setPending(false)
                if (res?.error) {
                  toast.error(res.error)
                  return
                }
                toast.success("Rule deleted")
                setOpen(false)
                router.refresh()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AddRuleDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [matchType, setMatchType] = useState<"exact" | "contains">("contains")
  const [categoryId, setCategoryId] = useState<string>(
    categories[0]?.id ?? "",
  )
  const [pending, startTransition] = useTransition()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && categories[0]?.id) setCategoryId(categories[0].id)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Add rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New auto-categorise rule</DialogTitle>
          <DialogDescription>
            Match bank merchant names (from imports) to a category. Exact
            matches win over &quot;contains&quot; rules.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            startTransition(async () => {
              const res = await createCategoryRuleAction(undefined, fd)
              if (res?.error) {
                toast.error(res.error)
                return
              }
              toast.success("Rule created")
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rule-merchant">Merchant text</FieldLabel>
              <Input
                id="rule-merchant"
                name="merchantPattern"
                required
                maxLength={200}
                placeholder="e.g. Tesco, Netflix"
                className="min-h-11 text-base"
              />
            </Field>
            <Field>
              <FieldLabel>Match</FieldLabel>
              <input type="hidden" name="matchType" value={matchType} />
              <Select
                value={matchType}
                onValueChange={(v) =>
                  setMatchType(v === "exact" ? "exact" : "contains")
                }
              >
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact (case-insensitive)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <input type="hidden" name="categoryId" value={categoryId} />
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              c.color ?? CATEGORY_COLOR_PRESETS[0],
                          }}
                        />
                        <span className="capitalize">{c.type}</span>
                        <span>·</span>
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" className="min-h-11" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : null}
              Save rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryRulesManager({
  rules,
  categories,
}: {
  rules: CategoryRuleWithCategory[]
  categories: Category[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Auto-categorise rules</h2>
          <p className="text-sm text-muted-foreground">
            Match imported merchant names. Rules also learn when you move a
            transaction out of Uncategorised.
          </p>
        </div>
        {categories.length > 0 ? (
          <AddRuleDialog categories={categories} />
        ) : null}
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rules yet. Add one or categorise an imported transaction to create
          a learned rule.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium break-all">
                  {r.match_type === "exact" ? "=" : "~"} {r.merchant_pattern}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          r.category.color ?? CATEGORY_COLOR_PRESETS[0],
                      }}
                    />
                    <span className="capitalize text-muted-foreground">
                      {r.category.type}
                    </span>
                    <span className="font-medium">{r.category.name}</span>
                  </span>
                  <Badge variant={r.source === "learned" ? "secondary" : "outline"}>
                    {r.source === "learned" ? "Learned" : "Manual"}
                  </Badge>
                </div>
              </div>
              <div className="shrink-0">
                <DeleteRuleButton rule={r} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
