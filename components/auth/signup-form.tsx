"use client"

import { useActionState } from "react"

import { signupAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, undefined)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!state?.error}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            required
            className="min-h-11 text-base"
          />
        </Field>
        <Field data-invalid={!!state?.error}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-11 text-base"
          />
        </Field>
        <Field data-invalid={!!state?.error}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="min-h-11 text-base"
          />
        </Field>
        <Field data-invalid={!!state?.error}>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="min-h-11 text-base"
          />
        </Field>
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </FieldGroup>
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Creating account…
          </>
        ) : (
          "Sign up"
        )}
      </Button>
    </form>
  )
}
