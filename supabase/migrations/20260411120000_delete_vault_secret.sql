-- Allow service role to remove Vault secrets when disconnecting a bank connection.

CREATE OR REPLACE FUNCTION public.delete_vault_secret(secret_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault
AS $$
  DELETE FROM vault.secrets WHERE id = secret_id;
$$;

REVOKE ALL ON FUNCTION public.delete_vault_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vault_secret(uuid) TO service_role;
