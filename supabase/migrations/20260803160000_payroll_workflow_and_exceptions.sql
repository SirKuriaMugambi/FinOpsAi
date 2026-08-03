-- Payroll approval workflow + per-employee statutory exceptions.
--
-- payroll_run_status was Draft|Approved|Posted only (confirmed against the
-- live schema before writing this migration) — adding Submitted/Rejected so
-- the workflow can distinguish "not yet sent for approval" from "awaiting
-- the finance_manager's decision" and "sent back for correction".
ALTER TYPE public.payroll_run_status ADD VALUE IF NOT EXISTS 'Submitted';
ALTER TYPE public.payroll_run_status ADD VALUE IF NOT EXISTS 'Rejected';

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id);

-- Per-employee exceptions traced from Tony's source workbook (see
-- lib/payroll-engine.ts header comment). Both default to "standard
-- treatment" — only the specific employees Tony confirms need them get
-- set explicitly; this is a data edit, not a code change.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS personal_relief_override numeric,
  ADD COLUMN IF NOT EXISTS exclude_nssf_from_paye_bands boolean NOT NULL DEFAULT false;
