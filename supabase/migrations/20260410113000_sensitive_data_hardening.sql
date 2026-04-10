-- Protect bank secrets with Vault references and replace plaintext provider IDs with hashes.

CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- pgcrypto may already exist from an older migration without a fixed schema; unqualified
-- digest() must resolve (public and/or extensions).
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.create_vault_secret(
  secret_value text,
  secret_name text DEFAULT NULL,
  secret_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault
AS $$
  SELECT vault.create_secret(secret_value, secret_name, secret_description);
$$;

CREATE OR REPLACE FUNCTION public.update_vault_secret(
  secret_id uuid,
  secret_value text,
  secret_name text DEFAULT NULL,
  secret_description text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault
AS $$
  SELECT vault.update_secret(secret_id, secret_value, secret_name, secret_description);
$$;

CREATE OR REPLACE FUNCTION public.read_vault_secret(secret_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = vault
AS $$
  SELECT ds.decrypted_secret
  FROM vault.decrypted_secrets AS ds
  WHERE ds.id = secret_id;
$$;

REVOKE ALL ON FUNCTION public.create_vault_secret(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_vault_secret(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_vault_secret(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_vault_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(uuid) TO service_role;

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS truelayer_user_id_hash text,
  ADD COLUMN IF NOT EXISTS access_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS refresh_token_secret_id uuid;

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS truelayer_account_id_hash text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS normalised_provider_transaction_id_hash text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id_hash text;

UPDATE public.bank_connections
SET truelayer_user_id_hash = encode(digest(truelayer_user_id, 'sha256'), 'hex')
WHERE truelayer_user_id IS NOT NULL
  AND truelayer_user_id_hash IS NULL;

UPDATE public.bank_accounts
SET truelayer_account_id_hash = encode(digest(truelayer_account_id, 'sha256'), 'hex')
WHERE truelayer_account_id IS NOT NULL
  AND truelayer_account_id_hash IS NULL;

UPDATE public.transactions
SET normalised_provider_transaction_id_hash = encode(digest(normalised_provider_transaction_id, 'sha256'), 'hex')
WHERE normalised_provider_transaction_id IS NOT NULL
  AND normalised_provider_transaction_id_hash IS NULL;

UPDATE public.transactions
SET provider_transaction_id_hash = encode(digest(provider_transaction_id, 'sha256'), 'hex')
WHERE provider_transaction_id IS NOT NULL
  AND provider_transaction_id_hash IS NULL;

DO $$
DECLARE
  row record;
  access_secret_id uuid;
  refresh_secret_id uuid;
BEGIN
  FOR row IN
    SELECT
      id,
      user_id,
      truelayer_user_id_hash,
      access_token,
      refresh_token,
      access_token_secret_id,
      refresh_token_secret_id
    FROM public.bank_connections
    WHERE access_token IS NOT NULL
      AND refresh_token IS NOT NULL
      AND (access_token_secret_id IS NULL OR refresh_token_secret_id IS NULL)
  LOOP
    IF row.access_token_secret_id IS NULL THEN
      access_secret_id := vault.create_secret(
        row.access_token,
        'bank_connection:' || row.user_id::text || ':' || row.truelayer_user_id_hash || ':access',
        'TrueLayer access token for Spendly bank connection'
      );
    ELSE
      access_secret_id := row.access_token_secret_id;
    END IF;

    IF row.refresh_token_secret_id IS NULL THEN
      refresh_secret_id := vault.create_secret(
        row.refresh_token,
        'bank_connection:' || row.user_id::text || ':' || row.truelayer_user_id_hash || ':refresh',
        'TrueLayer refresh token for Spendly bank connection'
      );
    ELSE
      refresh_secret_id := row.refresh_token_secret_id;
    END IF;

    UPDATE public.bank_connections
    SET access_token_secret_id = access_secret_id,
        refresh_token_secret_id = refresh_secret_id
    WHERE id = row.id;
  END LOOP;
END
$$;

ALTER TABLE public.bank_connections
  ALTER COLUMN truelayer_user_id_hash SET NOT NULL,
  ALTER COLUMN access_token_secret_id SET NOT NULL,
  ALTER COLUMN refresh_token_secret_id SET NOT NULL;

ALTER TABLE public.bank_accounts
  ALTER COLUMN truelayer_account_id_hash SET NOT NULL;

DROP INDEX IF EXISTS idx_bank_connections_user_truelayer_user_id_unique;
DROP INDEX IF EXISTS idx_transactions_user_normalised_provider_unique;
DROP INDEX IF EXISTS idx_transactions_user_provider_fallback_unique;
ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_user_id_truelayer_account_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_user_truelayer_user_hash_unique
  ON public.bank_connections (user_id, truelayer_user_id_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_user_truelayer_account_hash_unique
  ON public.bank_accounts (user_id, truelayer_account_id_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_normalised_provider_hash_unique
  ON public.transactions (user_id, normalised_provider_transaction_id_hash)
  WHERE normalised_provider_transaction_id_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_provider_hash_fallback_unique
  ON public.transactions (user_id, provider_transaction_id_hash)
  WHERE normalised_provider_transaction_id_hash IS NULL
    AND provider_transaction_id_hash IS NOT NULL;

REVOKE SELECT ON TABLE vault.decrypted_secrets FROM anon, authenticated;
REVOKE SELECT (access_token_secret_id, refresh_token_secret_id, truelayer_user_id_hash) ON public.bank_connections FROM anon, authenticated;
-- Hash columns stay SELECTable for authenticated clients: RLS still applies; hashes are not
-- reversible secrets but are required for sync dedupe and account matching (see lib/truelayer/sync.ts).

ALTER TABLE public.bank_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS truelayer_user_id;

ALTER TABLE public.bank_accounts
  DROP COLUMN IF EXISTS truelayer_account_id;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS normalised_provider_transaction_id,
  DROP COLUMN IF EXISTS provider_transaction_id;
