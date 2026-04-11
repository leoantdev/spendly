"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions/categories"
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
import {
  Field,
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
import { isSystemCategory } from "@/lib/category-system"
import { CATEGORY_COLOR_PRESETS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Category, TransactionType } from "@/lib/types"

function hexColorsEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function CategoryDialog({
  title,
  category,
  trigger,
}: {
  title: string
  category?: Category
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [type, setType] = useState<TransactionType>(
    category?.type ?? "expense",
  )
  const [color, setColor] = useState(
    category?.color ?? CATEGORY_COLOR_PRESETS[0],
  )
  const [pending, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const fn = category ? updateCategoryAction : createCategoryAction
    startTransition(async () => {
      const res = await fn(undefined, fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(category ? "Category updated" : "Category created")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Categories help you see where money goes. Income and expense lists are
            separate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cat-name">Name</FieldLabel>
              <Input
                id="cat-name"
                name="name"
                defaultValue={category?.name ?? ""}
                required
                className="min-h-11 text-base"
              />
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <input type="hidden" name="type" value={type} />
              <Select
                value={type}
                disabled={Boolean(category?.system_key)}
                onValueChange={(v) =>
                  setType(v === "income" || v === "expense" ? v : "expense")
                }
              >
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Color</FieldLabel>
              <input type="hidden" name="color" value={color} />
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLOR_PRESETS.map((c) => {
                  const selected = hexColorsEqual(color, c)
                  return (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "size-9 shrink-0 rounded-full transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                        selected
                          ? "z-[1] scale-[1.04] ring-1 ring-foreground ring-offset-1 ring-offset-background"
                          : "ring-1 ring-transparent ring-offset-1 ring-offset-background hover:scale-[1.02]",
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      aria-label={`Color ${c}`}
                      aria-pressed={selected}
                    />
                  )
                })}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : category ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCategoryButton({ category }: { category: Category }) {
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
              <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                You can’t delete a category that still has transactions. Remove or
                reassign transactions first.
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
                  fd.set("id", category.id)
                  const res = await deleteCategoryAction(fd)
                  setPending(false)
                  if (res && "error" in res && res.error) {
                    toast.error(res.error)
                    return
                  }
                  toast.success("Category deleted")
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

export function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Categories</h2>
        <CategoryDialog
          title="New category"
          trigger={
            <Button type="button" size="sm">
              Add
            </Button>
          }
        />
      </div>
      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: c.color ?? "#999" }}
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <CategoryDialog
                title="Edit category"
                category={c}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    Edit
                  </Button>
                }
              />
              {isSystemCategory(c.system_key) ? null : (
                <DeleteCategoryButton category={c} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
