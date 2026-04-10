-- One TrueLayer connection per user + credentials (idempotent OAuth callback)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_user_truelayer_user_id_unique
  ON public.bank_connections (user_id, truelayer_user_id);
