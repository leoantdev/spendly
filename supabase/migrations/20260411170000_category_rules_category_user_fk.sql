-- Ensure category_rules only reference categories owned by the same user (defense in depth vs RLS-only checks).

ALTER TABLE public.categories
  ADD CONSTRAINT categories_id_user_unique UNIQUE (id, user_id);

ALTER TABLE public.category_rules
  DROP CONSTRAINT IF EXISTS category_rules_category_id_fkey;

ALTER TABLE public.category_rules
  ADD CONSTRAINT category_rules_category_user_fkey
  FOREIGN KEY (category_id, user_id)
  REFERENCES public.categories (id, user_id)
  ON DELETE CASCADE;
