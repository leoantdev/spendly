"use client"

import { useActionState } from "react"

import { loginAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type Props = {
  nextPath?: string
}

export function LoginForm({ nextPath }: Props) {
  const [state, formAction, pending] = useActionState(loginAction, undefined)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <FieldGroup>
        <Field data-invalid={!!state?.error && !pending}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-11 text-base"
            aria-invalid={!!state?.error}
          />
        </Field>
        <Field data-invalid={!!state?.error && !pending}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="min-h-11 text-base"
            aria-invalid={!!state?.error}
          />
        </Field>
        {state?.error ? (
          <FieldError>{state.error}</FieldError>
        ) : (
          <FieldDescription>
            Use the password you chose at sign up.
          </FieldDescription>
        )}
      </FieldGroup>
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  )
}
