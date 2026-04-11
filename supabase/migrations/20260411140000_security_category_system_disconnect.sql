-- System category keys for bank import fallbacks; atomic bank disconnect (row + Vault).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_system_key_unique
  ON public.categories (user_id, system_key)
  WHERE system_key IS NOT NULL;

UPDATE public.categories
SET system_key = 'uncategorised_expense'
WHERE name = 'Uncategorised' AND type = 'expense' AND system_key IS NULL;

UPDATE public.categories
SET system_key = 'uncategorised_income'
WHERE name = 'Uncategorised' AND type = 'income' AND system_key IS NULL;

INSERT INTO public.categories (user_id, name, type, color, is_default, system_key)
SELECT p.id, 'Uncategorised', 'expense', '#94a3b8', true, 'uncategorised_expense'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id AND c.system_key = 'uncategorised_expense'
);

INSERT INTO public.categories (user_id, name, type, color, is_default, system_key)
SELECT p.id, 'Uncategorised', 'income', '#94a3b8', true, 'uncategorised_income'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id AND c.system_key = 'uncategorised_income'
);

CREATE OR REPLACE FUNCTION public.categories_protect_system()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.system_key IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot delete system category';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.system_key IS NOT NULL THEN
      IF NEW.system_key IS DISTINCT FROM OLD.system_key OR NEW.type IS DISTINCT FROM OLD.type THEN
        RAISE EXCEPTION 'Cannot change type or system key of system category';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS categories_protect_system ON public.categories;
CREATE TRIGGER categories_protect_system
  BEFORE DELETE OR UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.categories_protect_system();

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

  INSERT INTO public.categories (user_id, name, type, color, is_default, system_key) VALUES
    (NEW.id, 'Groceries', 'expense', '#22c55e', true, NULL),
    (NEW.id, 'Rent', 'expense', '#3b82f6', true, NULL),
    (NEW.id, 'Transport', 'expense', '#a855f7', true, NULL),
    (NEW.id, 'Eating out', 'expense', '#f97316', true, NULL),
    (NEW.id, 'Utilities', 'expense', '#eab308', true, NULL),
    (NEW.id, 'Entertainment', 'expense', '#ec4899', true, NULL),
    (NEW.id, 'Health', 'expense', '#14b8a6', true, NULL),
    (NEW.id, 'Other', 'expense', '#64748b', true, NULL),
    (NEW.id, 'Salary', 'income', '#22c55e', true, NULL),
    (NEW.id, 'Freelance', 'income', '#06b6d4', true, NULL),
    (NEW.id, 'Other income', 'income', '#64748b', true, NULL),
    (NEW.id, 'Uncategorised', 'expense', '#94a3b8', true, 'uncategorised_expense'),
    (NEW.id, 'Uncategorised', 'income', '#94a3b8', true, 'uncategorised_income');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_bank_connection_for_user(
  p_user_id uuid,
  p_connection_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_access uuid;
  v_refresh uuid;
BEGIN
  SELECT access_token_secret_id, refresh_token_secret_id
  INTO v_access, v_refresh
  FROM public.bank_connections
  WHERE id = p_connection_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_access IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_access;
  END IF;
  IF v_refresh IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_refresh;
  END IF;

  DELETE FROM public.bank_connections
  WHERE id = p_connection_id AND user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_bank_connection_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_bank_connection_for_user(uuid, uuid) TO service_role;
