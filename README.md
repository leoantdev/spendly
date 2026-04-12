# Spendly

Mobile-first PWA for quick expense and income tracking. Built with **Next.js (App Router)**, **Supabase** (auth + Postgres + RLS), **Tailwind**, and **shadcn/ui**.

## Setup

1. Copy [`.env.example`](.env.example) to `.env.local` and add your Supabase URL and anon key:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` for server-only Vault/token management. Never expose this to the browser.

   For **TrueLayer Data API** (bank connection and reading accounts/transactions only — this app does **not** use TrueLayer Payments):

   - `TRUELAYER_CLIENT_ID` / `TRUELAYER_CLIENT_SECRET` — from TrueLayer Console
   - `TRUELAYER_REDIRECT_URI` — OAuth callback URL; must **exactly** match a URI allowlisted in TrueLayer Console (same scheme, host, path; no trailing slash unless registered). For local dev use `http://localhost:3000/api/truelayer/callback` and add that URI in Console; production uses your deployed origin + `/api/truelayer/callback`. Console changes can take up to ~15 minutes to apply.
   - `TRUELAYER_BASE_URL` — Data API v1 base: `https://api.truelayer.com/data/v1` (live) or `https://api.truelayer-sandbox.com/data/v1` (sandbox)
   - `TRUELAYER_MODE` — `live` or `sandbox` (must match the environment toggle in TrueLayer Console and your base URL)

   Server code reads these via [`lib/truelayer/config.ts`](lib/truelayer/config.ts) (`import "server-only"`); do not prefix with `NEXT_PUBLIC_`.

   **TrueLayer Console checklist** (fixes most `Invalid client_id` issues):

   1. In TrueLayer Console, note whether you are in **sandbox** or **live** for this app.
   2. Copy `client_id` and `client_secret` from **that same** environment only.
   3. Set `TRUELAYER_MODE` and `TRUELAYER_BASE_URL` to the matching pair:
      - Sandbox: `TRUELAYER_MODE=sandbox` and `TRUELAYER_BASE_URL=https://api.truelayer-sandbox.com/data/v1` (sandbox `client_id` values start with `sandbox-`).
      - Live: `TRUELAYER_MODE=live` and `TRUELAYER_BASE_URL=https://api.truelayer.com/data/v1` (live `client_id` does **not** use the `sandbox-` prefix).
   4. Allowlist `TRUELAYER_REDIRECT_URI` exactly in Console (scheme, host, path; trailing slash only if registered).

   On `npm run dev`, `POST /api/truelayer/start` logs `TRUELAYER_MODE`, authorize host, and a **redacted** `client_id` fingerprint to help verify the pairing. The same response includes a `diagnostics` object (dev only): check **`authorizeHost`** (`auth.truelayer.com` for live, `auth.truelayer-sandbox.com` for sandbox) and that **`originMatchesRedirectHost`** is true (otherwise register both `localhost` and `127.0.0.1` callback URLs, or use one consistently).

   **If TrueLayer shows “Invalid client_id”** (or redirects to `login.truelayer.com/error`): that screen is used for several failures, not only a bad client id. In practice, fix these in order:

   1. **Redirect URI** — In TrueLayer Console, allowlist **`TRUELAYER_REDIRECT_URI` exactly** (scheme, host, port, path). A typo or using `127.0.0.1` while the env has `localhost` (or the reverse) triggers the same error flow as an unknown client.
   2. **Environment** — Live credentials require `TRUELAYER_MODE=live` and `authorizeHost` `auth.truelayer.com`. Sandbox credentials use `sandbox-…` client ids and `auth.truelayer-sandbox.com`.
   3. **Credentials** — Re-copy `client_id` / `client_secret` from the same app in Console as the environment you configured.

2. Apply the database schema (see [`supabase/migrations/20260406200000_spendly_mvp.sql`](supabase/migrations/20260406200000_spendly_mvp.sql)) in the Supabase SQL editor, or use the Supabase CLI. For TrueLayer bank readiness (provider id on connections, richer imported transaction fields, fallback dedupe), also apply [`supabase/migrations/20260412120000_truelayer_bank_readiness.sql`](supabase/migrations/20260412120000_truelayer_bank_readiness.sql).

   The banks settings page uses `GET /api/truelayer/providers` to show how many UK institutions TrueLayer exposes for your `TRUELAYER_CLIENT_ID` and whether each connection’s provider supports the same data scopes the app requests.

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scheduled TrueLayer sync (Vercel Cron)

Optional background import of bank transactions uses **Vercel Cron** → `GET /api/truelayer/cron-sync` (see [`vercel.json`](vercel.json)).

1. Apply the migration that creates `public.bank_sync_state` and `claim_bank_sync_user` ([`supabase/migrations/20260411120000_bank_sync_state.sql`](supabase/migrations/20260411120000_bank_sync_state.sql)).
2. Set **`CRON_SECRET`** in Vercel project environment variables (Vercel recommends **at least 16 characters**). With `CRON_SECRET` defined, Vercel sends `Authorization: Bearer <CRON_SECRET>` when invoking cron routes.
3. Deploy; cron schedule is defined in `vercel.json` (default: every 30 minutes). Adjust `schedule` or batching env vars as needed.

**Vercel plan:** On **Hobby**, cron frequency is limited (typically **once per day**); schedules like every 30 minutes may **fail at deploy** or be downgraded. Use a **daily** `schedule` in `vercel.json` on Hobby, or upgrade to **Pro** (or another tier that allows your desired cadence) for frequent syncs. See [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

**Local manual test** (after `CRON_SECRET` is in `.env.local`):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/truelayer/cron-sync"
```

Sync state, leases, and `last_error` are stored in `bank_sync_state` for observability and backoff.

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
