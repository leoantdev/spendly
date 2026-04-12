-- TrueLayer bank readiness: provider id on connections, richer transaction fields, fallback dedupe.

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS truelayer_provider_id text;

COMMENT ON COLUMN public.bank_connections.truelayer_provider_id IS
  'TrueLayer provider_id from GET /me (e.g. ob-barclays); used for capability hints.';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS provider_occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS transaction_currency text,
  ADD COLUMN IF NOT EXISTS transaction_category text,
  ADD COLUMN IF NOT EXISTS transaction_classification jsonb,
  ADD COLUMN IF NOT EXISTS provider_meta jsonb,
  ADD COLUMN IF NOT EXISTS running_balance_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS running_balance_currency text,
  ADD COLUMN IF NOT EXISTS truelayer_payload jsonb,
  ADD COLUMN IF NOT EXISTS import_fingerprint_hash text;

COMMENT ON COLUMN public.transactions.provider_occurred_at IS
  'Original transaction timestamp from TrueLayer (preserves time; occurred_at stays date-only for UI).';
COMMENT ON COLUMN public.transactions.transaction_currency IS
  'ISO 4217 currency from TrueLayer transaction; display may still use profile currency.';
COMMENT ON COLUMN public.transactions.truelayer_payload IS
  'Sanitized snapshot of the TrueLayer transaction object for debugging and future fields.';
COMMENT ON COLUMN public.transactions.import_fingerprint_hash IS
  'SHA-256 hex dedupe key when provider normalised/provider ids are missing.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_import_fingerprint_unique
  ON public.transactions (user_id, import_fingerprint_hash)
  WHERE import_fingerprint_hash IS NOT NULL;

-- Expose provider id on bank_connections to authenticated clients (see 20260410120000 lockdown).
GRANT SELECT (truelayer_provider_id) ON public.bank_connections TO authenticated;
