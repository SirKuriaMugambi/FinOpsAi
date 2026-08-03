-- Adds the reconciliation_ledger table referenced in BACKEND_IMPLEMENTATION.md §4.4
-- (AP Reconciliation) but never given a column definition in §2. One row per
-- matched (payment, invoice) pair; unmatched payments get a single row with
-- invoice_id = NULL. Mirrors the invoices table's RLS pattern (§3.3): broad
-- read, senior_accountant/finance_manager write, matching the role matrix's
-- "finance_manager: AP Recon Approvals" entry.

CREATE TABLE public.reconciliation_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_ref VARCHAR(100) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    payment_amount_kes NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    match_status VARCHAR(30) NOT NULL, -- 'Matched' | 'Unmatched' | 'Multi-Invoice Match'
    confidence VARCHAR(50),
    approved_by VARCHAR(100) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Nairobi'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Nairobi'::text, now())
);

ALTER TABLE public.reconciliation_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconciliation_ledger_select_all_authenticated" ON public.reconciliation_ledger
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reconciliation_ledger_write" ON public.reconciliation_ledger
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('senior_accountant', 'finance_manager'))
  WITH CHECK (public.get_user_role() IN ('senior_accountant', 'finance_manager'));
