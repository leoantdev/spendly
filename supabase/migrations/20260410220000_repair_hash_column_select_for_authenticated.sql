-- Repair migration: an earlier applied `sensitive_data_hardening` revision revoked SELECT on
-- provider id hash columns from `authenticated`. The session-scoped client needs those columns
-- for TrueLayer sync (account match + transaction dedupe); RLS still applies.
--
-- Safe to run if grants already exist (duplicate GRANT is a no-op in Postgres).

GRANT SELECT (truelayer_account_id_hash) ON public.bank_accounts TO authenticated;

GRANT SELECT (normalised_provider_transaction_id_hash, provider_transaction_id_hash)
  ON public.transactions
  TO authenticated;
