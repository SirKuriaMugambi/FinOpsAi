-- Payroll and employee data (salary, PII, bank details) restricted to
-- finance_manager only — previously senior_accountant and business_controller
-- could also read it. The actual enforcement for the app's API routes lives
-- in lib/supabase.ts's requireRole() (those routes use the service-role
-- admin client, which bypasses RLS entirely); this migration is defense in
-- depth so the same rule holds for any direct Supabase access too.

DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'finance_manager');

DROP POLICY IF EXISTS "employees_write" ON public.employees;
CREATE POLICY "employees_write" ON public.employees
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'finance_manager')
  WITH CHECK (public.get_user_role() = 'finance_manager');

DROP POLICY IF EXISTS "payroll_runs_select" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select" ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'finance_manager');

DROP POLICY IF EXISTS "payroll_runs_write" ON public.payroll_runs;
CREATE POLICY "payroll_runs_write" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'finance_manager')
  WITH CHECK (public.get_user_role() = 'finance_manager');

DROP POLICY IF EXISTS "payroll_register_entries_select" ON public.payroll_register_entries;
CREATE POLICY "payroll_register_entries_select" ON public.payroll_register_entries
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'finance_manager');

DROP POLICY IF EXISTS "payroll_register_entries_write" ON public.payroll_register_entries;
CREATE POLICY "payroll_register_entries_write" ON public.payroll_register_entries
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'finance_manager')
  WITH CHECK (public.get_user_role() = 'finance_manager');
