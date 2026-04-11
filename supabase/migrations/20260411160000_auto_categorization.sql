-- Auto-categorisation: provider merchant name on transactions + user category rules

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_name text;

COMMENT ON COLUMN public.transactions.merchant_name IS
  'Provider merchant name at import; used for auto-categorisation rules (not user-editable).';

CREATE TABLE public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  merchant_pattern text NOT NULL CHECK (btrim(merchant_pattern) <> ''),
  merchant_pattern_normalized text GENERATED ALWAYS AS (lower(btrim(merchant_pattern))) STORED,
  match_type text NOT NULL CHECK (match_type IN ('exact', 'contains')),
  source text NOT NULL CHECK (source IN ('learned', 'manual')) DEFAULT 'learned',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_rules_user_pattern_unique UNIQUE (user_id, merchant_pattern_normalized)
);

CREATE INDEX idx_category_rules_user_id ON public.category_rules (user_id);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_rules_all_own ON public.category_rules
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
