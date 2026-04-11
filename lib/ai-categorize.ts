import "server-only"

import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

import type { TransactionType } from "@/lib/types"

const BATCH_SIZE = 50

export type AiCategorizeTxInput = {
  id: string
  merchant_name: string
  type: TransactionType
  /** Only sent to the model when `shouldIncludeTransactionNotesInAi()` is true. */
  note: string | null
}

export type AiCategorizeCategoryInput = {
  id: string
  name: string
  type: TransactionType
}

const batchResponseSchema = z.object({
  assignments: z.array(
    z.object({
      transactionId: z.string().uuid(),
      categoryId: z.string().uuid(),
    }),
  ),
})

function resolveOpenAiModel(): string {
  return process.env.AI_CATEGORIZE_MODEL?.trim() || "gpt-4o-mini"
}

/** When false (default), transaction notes are not sent to OpenAI (privacy). */
export function shouldIncludeTransactionNotesInAi(): boolean {
  const e = process.env.AI_CATEGORIZE_INCLUDE_TRANSACTION_NOTES?.trim().toLowerCase()
  return e === "true" || e === "1" || e === "yes"
}

function buildCategoriesPrompt(categories: AiCategorizeCategoryInput[]): string {
  const income = categories.filter((c) => c.type === "income")
  const expense = categories.filter((c) => c.type === "expense")
  const lines: string[] = []
  lines.push("## Assignable categories (use exact category id strings only)")
  lines.push("### Income")
  for (const c of income) {
    lines.push(`- id=${c.id} name="${c.name}"`)
  }
  lines.push("### Expense")
  for (const c of expense) {
    lines.push(`- id=${c.id} name="${c.name}"`)
  }
  return lines.join("\n")
}

function buildTransactionsPrompt(transactions: AiCategorizeTxInput[]): string {
  const lines: string[] = []
  lines.push("## Transactions to categorise")
  for (const t of transactions) {
    const note =
      shouldIncludeTransactionNotesInAi() && t.note?.trim()
        ? ` note="${t.note.replace(/"/g, "'")}"`
        : ""
    lines.push(
      `- transactionId=${t.id} type=${t.type} merchant="${t.merchant_name.replace(/"/g, "'")}"${note}`,
    )
  }
  return lines.join("\n")
}

/**
 * Returns true when OPENAI_API_KEY is set (server-side AI categorisation available).
 */
export function isAiCategorizationEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/**
 * Max transactions sent to the model per `categorizeTransactions` run (cost guardrail).
 * Default 500. Set `AI_CATEGORIZE_MAX_TRANSACTIONS=0` for no limit (not recommended for large imports).
 */
export function getAiCategorizeMaxTransactionsPerRun(): number {
  const raw = process.env.AI_CATEGORIZE_MAX_TRANSACTIONS?.trim()
  if (raw === undefined || raw === "") return 500
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 500
  if (n === 0) return Number.POSITIVE_INFINITY
  return n
}

/**
 * Uses the Vercel AI SDK + OpenAI to assign categories. Returns transaction id → category id.
 * On failure, logs a warning and returns an empty map.
 */
export async function aiCategorizeTransactions(
  transactions: AiCategorizeTxInput[],
  categories: AiCategorizeCategoryInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!isAiCategorizationEnabled() || transactions.length === 0 || categories.length === 0) {
    return out
  }

  const validCategoryIds = new Set(categories.map((c) => c.id))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const txById = new Map(transactions.map((t) => [t.id, t]))
  const modelId = resolveOpenAiModel()

  const batchCount = Math.ceil(transactions.length / BATCH_SIZE)
  console.info(
    `[ai-categorize] ${transactions.length} transaction(s), ${batchCount} batch(es), model=${modelId}`,
  )

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE)
    try {
      const { object } = await generateObject({
        model: openai(modelId),
        schema: batchResponseSchema,
        system:
          "You categorise personal finance transactions. Each transaction must use exactly one category id from the list. " +
          "Match category type to transaction type (income vs expense). " +
          "Prefer obvious merchant-based categories (e.g. supermarkets → Groceries). " +
          "Include every transaction id in assignments with a category id, or omit a transaction only if truly impossible.",
        prompt: `${buildCategoriesPrompt(categories)}

${buildTransactionsPrompt(batch)}

Respond with JSON only: assignments is an array of { transactionId, categoryId } for this batch.`,
      })

      for (const a of object.assignments) {
        if (!txById.has(a.transactionId)) continue
        const tx = txById.get(a.transactionId)!
        if (categoryById.get(a.categoryId)?.type !== tx.type) continue
        if (!validCategoryIds.has(a.categoryId)) continue
        out.set(a.transactionId, a.categoryId)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn("[ai-categorize] batch failed:", msg)
    }
  }

  return out
}
