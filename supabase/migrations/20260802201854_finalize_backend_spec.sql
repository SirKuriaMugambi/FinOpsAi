-- Finalize backend spec per BACKEND_IMPLEMENTATION.md sections 3 (Auth/RLS) and 4 (Storage).
-- Live inspection (2026-08-02) confirmed: all 12 tables + enums already match the doc,
-- and the 3 composite UNIQUE constraints (unique_vendor_invoice, unique_run_employee,
-- unique_budget_cc_gl_month) already exist on the remote DB, so no table/constraint DDL
-- is needed here. What was missing: get_user_role(), RLS (disabled on all tables, 0
-- policies), a profile-creation trigger for the auth.users -> profiles handoff assumed by
-- section 4.1, and the `finops-documents` storage bucket referenced in sections 4.3/4.7.

-- ============================================================================
-- 1. Role helper function (doc section 3.2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 2. auth.users -> public.profiles provisioning trigger
-- Required for doc section 4.1 (sign-in reads the profiles row for role/name);
-- without it, a new auth user has no profiles row and login breaks.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'senior_accountant')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. Row Level Security — enable on all 12 tables
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_register_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
-- Broad read (names are shown for approvals/attribution across the app); users may only
-- edit their own row; inserts happen exclusively via the handle_new_user() trigger above.
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---- vendors ----
DROP POLICY IF EXISTS "vendors_select_all_authenticated" ON public.vendors;
CREATE POLICY "vendors_select_all_authenticated" ON public.vendors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vendors_write_accountants" ON public.vendors;
CREATE POLICY "vendors_write_accountants" ON public.vendors
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- invoices (doc section 3.3, applied verbatim) ----
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.invoices;
CREATE POLICY "Allow authenticated read access"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow invoice management for accountants" ON public.invoices;
CREATE POLICY "Allow invoice management for accountants"
  ON public.invoices FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

DROP POLICY IF EXISTS "Allow status approval by finance manager only" ON public.invoices;
CREATE POLICY "Allow status approval by finance manager only"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'finance_manager');

-- ---- wht_payments (tax/vendor data; production_manager has no access per role matrix) ----
DROP POLICY IF EXISTS "wht_payments_select" ON public.wht_payments;
CREATE POLICY "wht_payments_select" ON public.wht_payments
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'business_controller'));

DROP POLICY IF EXISTS "wht_payments_write" ON public.wht_payments;
CREATE POLICY "wht_payments_write" ON public.wht_payments
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- gl_accounts (chart of accounts reference data) ----
DROP POLICY IF EXISTS "gl_accounts_select_all_authenticated" ON public.gl_accounts;
CREATE POLICY "gl_accounts_select_all_authenticated" ON public.gl_accounts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gl_accounts_write_finance_manager" ON public.gl_accounts;
CREATE POLICY "gl_accounts_write_finance_manager" ON public.gl_accounts
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'finance_manager')
  WITH CHECK (public.get_user_role() = 'finance_manager');

-- ---- employees (PII/payroll master; production_manager has no access per role matrix) ----
DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'business_controller'));

DROP POLICY IF EXISTS "employees_write" ON public.employees;
CREATE POLICY "employees_write" ON public.employees
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- payroll_runs (salary data; production_manager has no access per role matrix) ----
DROP POLICY IF EXISTS "payroll_runs_select" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select" ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'business_controller'));

DROP POLICY IF EXISTS "payroll_runs_write" ON public.payroll_runs;
CREATE POLICY "payroll_runs_write" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- payroll_register_entries (salary data; production_manager has no access) ----
DROP POLICY IF EXISTS "payroll_register_entries_select" ON public.payroll_register_entries;
CREATE POLICY "payroll_register_entries_select" ON public.payroll_register_entries
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'business_controller'));

DROP POLICY IF EXISTS "payroll_register_entries_write" ON public.payroll_register_entries;
CREATE POLICY "payroll_register_entries_write" ON public.payroll_register_entries
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- checklist_items ----
DROP POLICY IF EXISTS "checklist_items_select_all_authenticated" ON public.checklist_items;
CREATE POLICY "checklist_items_select_all_authenticated" ON public.checklist_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_items_write" ON public.checklist_items;
CREATE POLICY "checklist_items_write" ON public.checklist_items
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));

-- ---- budgets (production_manager is explicitly read-only per role matrix) ----
DROP POLICY IF EXISTS "budgets_select_all_authenticated" ON public.budgets;
CREATE POLICY "budgets_select_all_authenticated" ON public.budgets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "budgets_write_finance_manager" ON public.budgets;
CREATE POLICY "budgets_write_finance_manager" ON public.budgets
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'finance_manager')
  WITH CHECK (public.get_user_role() = 'finance_manager');

-- ---- documents (production_manager may write per role matrix; no hard delete —
-- doc section 4.7 requires soft-delete via is_deleted, so no DELETE policy is granted) ----
DROP POLICY IF EXISTS "documents_select_all_authenticated" ON public.documents;
CREATE POLICY "documents_select_all_authenticated" ON public.documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager'));

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager'));

-- ---- audit_logs (immutable ledger — insert only, no UPDATE/DELETE policy at all) ----
DROP POLICY IF EXISTS "audit_logs_select_all_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_select_all_authenticated" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager'));

-- ============================================================================
-- 4. Storage bucket (doc sections 4.3, 4.7 reference `finops-documents`)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('finops-documents', 'finops-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finops_documents_select" ON storage.objects;
CREATE POLICY "finops_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finops-documents');

DROP POLICY IF EXISTS "finops_documents_insert" ON storage.objects;
CREATE POLICY "finops_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'finops-documents'
    AND public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager')
  );

DROP POLICY IF EXISTS "finops_documents_update" ON storage.objects;
CREATE POLICY "finops_documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'finops-documents'
    AND public.get_user_role() IN ('senior_accountant', 'finance_manager', 'production_manager')
  );
