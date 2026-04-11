-- Per-user bank sync coordination for Vercel cron: leases, backoff, durable last_error.

CREATE TABLE IF NOT EXISTS public.bank_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error text,
  lease_expires_at timestamptz,
  next_sync_after timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid,
  failure_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_state_next_sync
  ON public.bank_sync_state (next_sync_after ASC);

CREATE INDEX IF NOT EXISTS idx_bank_sync_state_lease_expires
  ON public.bank_sync_state (lease_expires_at);

ALTER TABLE public.bank_sync_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bank_sync_state FROM anon, authenticated;

-- No policies for authenticated: only service_role (cron/admin) touches this table.

COMMENT ON TABLE public.bank_sync_state IS
  'Background TrueLayer sync scheduling: lease, backoff, and last run metadata for cron.';

CREATE OR REPLACE FUNCTION public.claim_bank_sync_user(
  p_user_id uuid,
  p_lease_seconds integer,
  p_run_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease timestamptz := v_now + make_interval(secs => p_lease_seconds);
  n int;
BEGIN
  INSERT INTO public.bank_sync_state (
    user_id,
    next_sync_after,
    lease_expires_at,
    last_started_at,
    updated_at,
    last_run_id
  )
  VALUES (p_user_id, v_now, v_lease, v_now, v_now, p_run_id)
  ON CONFLICT (user_id) DO UPDATE SET
    lease_expires_at = EXCLUDED.lease_expires_at,
    last_started_at = EXCLUDED.last_started_at,
    updated_at = EXCLUDED.updated_at,
    last_run_id = EXCLUDED.last_run_id
  WHERE (
    bank_sync_state.lease_expires_at IS NULL
    OR bank_sync_state.lease_expires_at < v_now
  )
  AND bank_sync_state.next_sync_after <= v_now;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bank_sync_user(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bank_sync_user(uuid, integer, uuid) TO service_role;
