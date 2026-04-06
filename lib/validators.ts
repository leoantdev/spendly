import { z } from "zod"

export const emailSchema = z.string().email("Enter a valid email")

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "At least 6 characters"),
})

export const signupSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(6, "At least 6 characters"),
    confirm: z.string(),
    displayName: z.string().min(1, "Enter a display name").max(80),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don’t match",
    path: ["confirm"],
  })

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(80),
  currency: z.string().min(3).max(3),
  monthStartDay: z.coerce.number().int().min(1).max(28),
})

export const transactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid("Pick a category"),
  occurredAt: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  accountId: z.string().uuid().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color"),
})

export const budgetUpsertSchema = z.object({
  categoryId: z.string().uuid(),
  monthYear: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().min(0),
})
