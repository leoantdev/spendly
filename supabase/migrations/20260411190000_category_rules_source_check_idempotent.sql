-- Idempotent: ensure public.category_rules has an explicit CHECK on source including 'ai'.
-- Drops any existing CHECK whose definition references column source, then recreates a named constraint.
-- Safe to run after 20260411180000_category_rules_source_ai.sql (re-applies the same rule).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON c.conrelid = rel.oid
    JOIN pg_namespace n ON rel.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND rel.relname = 'category_rules'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.category_rules DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.category_rules
  ADD CONSTRAINT category_rules_source_check
  CHECK (source IN ('learned', 'manual', 'ai'));
