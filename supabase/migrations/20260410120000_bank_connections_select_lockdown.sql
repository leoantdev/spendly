-- Lock down bank_connections so user-scoped clients can only read non-secret metadata.

REVOKE ALL ON TABLE public.bank_connections FROM anon, authenticated;

GRANT SELECT (id, user_id, consent_created_at, expires_at, status, created_at, updated_at)
  ON TABLE public.bank_connections
  TO authenticated;
