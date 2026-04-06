"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import { updateProfileAction } from "@/app/actions/profile"
import { Button } from "@/components/ui/button"
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
import { CURRENCIES } from "@/lib/constants"
import type { Profile } from "@/lib/types"

export function ProfileForm({ profile }: { profile: Profile }) {
  const [currency, setCurrency] = useState(profile.currency)
  const [state, action, pending] = useActionState(updateProfileAction, undefined)

  useEffect(() => {
    if (state?.success) toast.success("Profile saved")
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="currency" value={currency} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={profile.display_name ?? ""}
            required
            className="min-h-11 text-base"
          />
        </Field>
        <Field>
          <FieldLabel>Currency</FieldLabel>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="min-h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="monthStartDay">First day of month</FieldLabel>
          <Input
            id="monthStartDay"
            name="monthStartDay"
            type="number"
            min={1}
            max={28}
            defaultValue={profile.month_start_day}
            required
            className="min-h-11 text-base tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Use 1 for a normal calendar month, or e.g. 15 if your pay cycle
            starts mid-month (1–28).
          </p>
        </Field>
      </FieldGroup>
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          "Save profile"
        )}
      </Button>
    </form>
  )
}
