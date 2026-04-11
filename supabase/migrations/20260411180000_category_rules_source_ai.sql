-- Allow 'ai' as a category_rules.source value (AI auto-categorisation persisted as rules)

ALTER TABLE public.category_rules DROP CONSTRAINT IF EXISTS category_rules_source_check;

ALTER TABLE public.category_rules
  ADD CONSTRAINT category_rules_source_check
  CHECK (source IN ('learned', 'manual', 'ai'));
