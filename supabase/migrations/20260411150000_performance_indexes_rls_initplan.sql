-- FK-style indexes for common filters and RLS-friendly auth.uid() evaluation (initplan)

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets (category_id);

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "categories_all_own" ON public.categories;
DROP POLICY IF EXISTS "accounts_all_own" ON public.accounts;
DROP POLICY IF EXISTS "transactions_all_own" ON public.transactions;
DROP POLICY IF EXISTS "budgets_all_own" ON public.budgets;
DROP POLICY IF EXISTS "bank_connections_all_own" ON public.bank_connections;
DROP POLICY IF EXISTS "bank_accounts_all_own" ON public.bank_accounts;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = (select auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (select auth.uid()));

CREATE POLICY "categories_all_own" ON public.categories FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "accounts_all_own" ON public.accounts FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "transactions_all_own" ON public.transactions FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "budgets_all_own" ON public.budgets FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "bank_connections_all_own"
  ON public.bank_connections
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()))
  WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));

CREATE POLICY "bank_accounts_all_own"
  ON public.bank_accounts
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()))
  WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));
