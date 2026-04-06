# Spendly

Mobile-first PWA for quick expense and income tracking. Built with **Next.js (App Router)**, **Supabase** (auth + Postgres + RLS), **Tailwind**, and **shadcn/ui**.

## Setup

1. Copy [`.env.example`](.env.example) to `.env.local` and add your Supabase URL and anon key:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Apply the database schema (see [`supabase/migrations/20260406200000_spendly_mvp.sql`](supabase/migrations/20260406200000_spendly_mvp.sql)) in the Supabase SQL editor, or use the Supabase CLI.

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — development server (Turbopack)
- `npm run build` — production build (service worker via `@ducanh2912/next-pwa` in production)
- `npm run start` — production server
- `npm run lint` / `npm run typecheck`

## Features (MVP)

- Email/password auth, profile (currency, month start day)
- Quick add transaction, filtered activity list, monthly overview with category chart
- Budgets per expense category with progress
- Offline queue for new transactions (syncs when back online)
- Installable PWA (`manifest`, icons via `app/icon.tsx` / `app/apple-icon.tsx`)

## Adding UI components

```bash
npx shadcn@latest add <component>
```
