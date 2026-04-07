-- TrueLayer bank connections, mirrored bank accounts, transaction provider IDs, RLS, import categories

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  truelayer_user_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  consent_created_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL CHECK (status IN ('active', 'revoked', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  truelayer_account_id text NOT NULL,
  name text NOT NULL,
  institution text NOT NULL,
  currency text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, truelayer_account_id)
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS truelayer_transaction_id text,
  ADD COLUMN IF NOT EXISTS normalised_provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_normalised_provider_unique
  ON public.transactions (user_id, normalised_provider_transaction_id)
  WHERE normalised_provider_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_provider_fallback_unique
  ON public.transactions (user_id, provider_transaction_id)
  WHERE normalised_provider_transaction_id IS NULL
    AND provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON public.bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_connection_id ON public.bank_accounts(bank_connection_id);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_connections_all_own"
  ON public.bank_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "bank_accounts_all_own"
  ON public.bank_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Default import categories for existing users (required category_id on transactions)
INSERT INTO public.categories (user_id, name, type, color, is_default)
SELECT p.id, 'Uncategorised', 'expense', '#94a3b8', true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id AND c.name = 'Uncategorised' AND c.type = 'expense'
);

INSERT INTO public.categories (user_id, name, type, color, is_default)
SELECT p.id, 'Uncategorised', 'income', '#94a3b8', true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id AND c.name = 'Uncategorised' AND c.type = 'income'
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, currency, month_start_day)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'GBP',
    1
  );

  INSERT INTO public.accounts (user_id, name)
  VALUES (NEW.id, 'Main');

  INSERT INTO public.categories (user_id, name, type, color, is_default) VALUES
    (NEW.id, 'Groceries', 'expense', '#22c55e', true),
    (NEW.id, 'Rent', 'expense', '#3b82f6', true),
    (NEW.id, 'Transport', 'expense', '#a855f7', true),
    (NEW.id, 'Eating out', 'expense', '#f97316', true),
    (NEW.id, 'Utilities', 'expense', '#eab308', true),
    (NEW.id, 'Entertainment', 'expense', '#ec4899', true),
    (NEW.id, 'Health', 'expense', '#14b8a6', true),
    (NEW.id, 'Other', 'expense', '#64748b', true),
    (NEW.id, 'Salary', 'income', '#22c55e', true),
    (NEW.id, 'Freelance', 'income', '#06b6d4', true),
    (NEW.id, 'Other income', 'income', '#64748b', true),
    (NEW.id, 'Uncategorised', 'expense', '#94a3b8', true),
    (NEW.id, 'Uncategorised', 'income', '#94a3b8', true);

  RETURN NEW;
END;
$$;
