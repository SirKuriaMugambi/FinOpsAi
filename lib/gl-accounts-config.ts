/**
 * Chart-of-accounts mapping for payroll → AX journal postings.
 *
 * PROVENANCE — read before changing anything here:
 *
 * - Codes marked "SOURCED" were pulled directly from the AX main-account
 *   numbers already hard-coded in app/(workspace)/payroll/page.tsx's GL tab
 *   (41000, 41770, 41800, 11500, 18150) — those in turn trace back to the
 *   finance manager's own reference workbook, sheet "Integrating with AX
 *   cost center" (rows 152–183), so they're the most authoritative codes
 *   available in this repo.
 * - Codes marked "ASSUMPTION" are new — introduced because the existing UI
 *   mock's account mapping doesn't actually balance (it never credited a
 *   payable for the Pension Fund debit, and it reused account 11500 for
 *   BOTH "Net Salaries Payable" and "KRA PAYE Payable", which is almost
 *   certainly a copy-paste bug rather than a deliberate shared account).
 *   These need finance-manager confirmation before anything posts for real.
 */

export const PAYROLL_GL_ACCOUNTS = {
  // ── Expense accounts (dimensioned per cost centre) ──────────────────────
  salaryExpense: { code: "41000", name: "Salary & Wages Expense", provenance: "SOURCED" as const },
  employerStatutoryExpense: {
    code: "41770",
    name: "Employer Statutory Contributions Expense (Pension-ER, NITA)",
    provenance: "SOURCED" as const,
  },
  nonCashBenefitsClearing: {
    code: "41790",
    name: "Non-Cash Benefits in Kind (Fringe Benefit Tax) Clearing",
    provenance: "ASSUMPTION" as const,
  },

  // ── Liability accounts (company-wide, not dimensioned by cost centre —
  //    KRA/NSSF/SHIF/pension fund don't care which department the pay came
  //    from; the remittance is one aggregate payment) ─────────────────────
  netPayPayable: { code: "11500", name: "Net Salaries Payable", provenance: "SOURCED" as const },
  payePayable: {
    code: "18100",
    name: "KRA PAYE Payable",
    provenance: "ASSUMPTION" as const,
    note: "The existing UI mock reused account 11500 (same as Net Salaries Payable) for this — almost certainly a bug. Given a distinct code here instead.",
  },
  statutoryPayable: {
    code: "18150",
    name: "Statutory Payable (NSSF, SHIF, AHL)",
    provenance: "SOURCED" as const,
  },
  pensionPayable: {
    code: "18160",
    name: "Pension Fund Payable (Employee + Employer)",
    provenance: "ASSUMPTION" as const,
    note: "The existing UI mock only ever debited Pension (41800) with no matching credit — its totals didn't actually balance. Added this payable to close the loop.",
  },
  nitaPayable: { code: "18170", name: "NITA Payable", provenance: "ASSUMPTION" as const },
  otherDeductionsPayable: {
    code: "18180",
    name: "Other Payroll Deductions Payable (Advances, HELB, Loans, SACCO)",
    provenance: "ASSUMPTION" as const,
  },
} as const

/**
 * Liability/payable postings are booked to this dimension — payroll
 * statutory remittances are a Finance-department, company-wide obligation,
 * not attributable to the originating employee's own cost centre.
 */
export const PAYROLL_LIABILITY_DIMENSION = {
  department: "FIN",
  costCentre: "121",
} as const
