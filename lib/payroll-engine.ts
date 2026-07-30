/**
 * Chrysal FinOps AI — Kenyan Statutory Payroll Engine
 *
 * Source of truth: reference-data/CA- AI Payroll automation project.xlsx
 *   Sheet "AI-Automation-workings" (Rows 25–51, 56–60, 62)
 *
 * KRA PAYE bands (2024, monthly):
 *   Band 1 : ≤ 24,000                → 10%  (max KES 2,400)
 *   Band 2 : 24,001 – 32,333         → 25%  (max KES 2,083.25)
 *   Band 3 : 32,334 – 500,000        → 30%  (max KES 140,299.80)
 *   Band 4 : 500,001 – 800,000       → 32.5% (max KES 97,499.675)
 *   Band 5 : > 800,000               → 35%
 *
 * Personal Relief  : KES 2,400 / month
 * AHL Relief       : AHL amount itself qualifies as relief from PAYE
 * NSSF Tier I      : KES 420 / month (statutory)
 * NSSF Tier II     : KES 1,740 / month (statutory)
 * SHIF             : 2.75% of gross salary
 * AHL (Housing)    : 1.5% of gross salary
 * Pension EE       : 5% of gross salary (capped at KES 20,000/mo)
 * Pension ER       : 10% of gross salary
 */

export interface PayrollInputs {
  base_salary: number
  bonus_commission: number
  fringe_benefit: number        // FBT / loan benefit non-cash
  transport_allowance: number
  arrears: number
  ot_other: number
  voluntary_pension: number     // EE voluntary (on top of mandatory 5%)
  advances: number
  helb: number
  company_loan: number
  bank_loan: number
  sacco: number
}

export interface PayrollResult {
  gross_salary: number

  // Statutory
  nssf_t1: number
  nssf_t2: number
  shif: number
  ahl: number
  defined_pension_ee: number
  defined_pension_er: number

  // Tax
  taxable_pay: number
  gross_paye: number
  personal_relief: number
  nhif_relief: number
  ahl_relief: number
  net_paye: number

  // Post-tax
  allowances: number
  deductions: number
  nssf: number
  nhif: number
  paye: number
  net_salary: number
  total_deductions: number
}

// ── PAYE graduated slab calculator ──────────────────────────────────────────
function computeGrossPAYE(taxableMonthlyIncome: number): number {
  if (taxableMonthlyIncome <= 0) return 0

  let tax = 0
  let remaining = taxableMonthlyIncome

  // Band 1: first 24,000 @ 10%
  const band1 = Math.min(remaining, 24000)
  tax += band1 * 0.10
  remaining -= band1
  if (remaining <= 0) return tax

  // Band 2: next 8,333 (24,001–32,333) @ 25%
  const band2 = Math.min(remaining, 8333)
  tax += band2 * 0.25
  remaining -= band2
  if (remaining <= 0) return tax

  // Band 3: next 467,667 (32,334–500,000) @ 30%
  const band3 = Math.min(remaining, 467667)
  tax += band3 * 0.30
  remaining -= band3
  if (remaining <= 0) return tax

  // Band 4: next 300,000 (500,001–800,000) @ 32.5%
  const band4 = Math.min(remaining, 300000)
  tax += band4 * 0.325
  remaining -= band4
  if (remaining <= 0) return tax

  // Band 5: above 800,000 @ 35%
  tax += remaining * 0.35

  return tax
}

// ── Main compute function ────────────────────────────────────────────────────
export function computePayroll(inputs: PayrollInputs): PayrollResult {
  const {
    base_salary, bonus_commission, fringe_benefit, transport_allowance,
    arrears, ot_other, voluntary_pension,
    advances, helb, company_loan, bank_loan, sacco,
  } = inputs

  // 1. Gross Salary
  const gross_salary = base_salary + bonus_commission + fringe_benefit
    + transport_allowance + arrears + ot_other

  // 2. Statutory deductions (pre-tax)
  const nssf_t1 = 420
  const nssf_t2 = 1740
  const shif = +(gross_salary * 0.0275).toFixed(2)                  // 2.75% SHIF
  const ahl = +(gross_salary * 0.015).toFixed(2)                    // 1.5% Housing Levy
  const defined_pension_ee = +Math.min(gross_salary * 0.05, 20000).toFixed(2) // 5% capped at 20K
  const defined_pension_er = +(gross_salary * 0.10).toFixed(2)      // 10% employer
  const total_voluntary = voluntary_pension

  // 3. Taxable pay (gross − pension − NSSF; SHIF and AHL are not pre-tax)
  const taxable_pay = +(
    gross_salary - defined_pension_ee - total_voluntary - nssf_t1 - nssf_t2
  ).toFixed(2)

  // 4. Gross PAYE from slabs
  const gross_paye = +computeGrossPAYE(taxable_pay).toFixed(2)

  // 5. Reliefs
  const personal_relief = 2400
  const nhif_relief = 0                  // SHIF relief currently 0 per the sheet
  const ahl_relief = +Math.min(ahl * 0.15, ahl).toFixed(2)  // AHL at marginal rate

  // 6. Net PAYE
  const net_paye = +Math.max(
    gross_paye - personal_relief - nhif_relief - ahl_relief,
    0
  ).toFixed(2)

  // 7. Total deductions
  const total_deductions = +(
    net_paye + nssf_t1 + nssf_t2 + shif + ahl
    + defined_pension_ee + total_voluntary
    + advances + helb + company_loan + bank_loan + sacco
  ).toFixed(2)

  // 8. Net salary
  const net_salary = +(gross_salary - total_deductions).toFixed(2)

  // 9. Legacy aliases
  const allowances = +(fringe_benefit + transport_allowance + bonus_commission).toFixed(2)
  const nssf = nssf_t1 + nssf_t2
  const nhif = shif
  const paye = net_paye
  const deductions = total_deductions

  return {
    gross_salary,
    nssf_t1, nssf_t2, shif, ahl,
    defined_pension_ee, defined_pension_er,
    taxable_pay, gross_paye,
    personal_relief, nhif_relief, ahl_relief, net_paye,
    allowances, deductions, nssf, nhif, paye, net_salary,
    total_deductions,
  }
}

// ── GL Posting Summary builder (matching Excel rows 174-183 structure) ───────
export interface GLPostingSummary {
  gross_salaries: number      // Row 174 - Basic + Benefits
  ahl_total: number           // Row 175
  nssf_total: number          // Row 176 (EE + ER)
  nita_total: number          // Row 177 (fixed KES 50/employee)
  pension_total: number       // Row 178 (EE only)
  subtotal: number            // Row 180
  fbt_other: number           // Row 181 (FBT + non-cash benefits total)
  total_gross_payroll: number // Row 182
  net_salaries: number        // Row 183
}

export interface CostCentreBreakdown {
  code: string
  name: string
  gross: number
  net: number
  paye: number
  pension_er: number
  nssf: number
  ahl: number
  shif: number
  headcount: number
}

export type EmployeeSummary = {
  id: string; name: string; kra_pin: string; cost_centre: string;
  gross_salary: number; net_paye: number; nssf_t1: number; nssf_t2: number;
  shif: number; ahl: number; defined_pension_ee: number; defined_pension_er: number;
  helb: number; company_loan: number; bank_loan: number; sacco: number; advances: number;
  net_salary: number;
}

const CC_NAMES: Record<string, string> = {
  "121": "Finance",
  "204": "Technical (TC)",
  "205": "General Manager",
  "206": "Technical Assistants (TA)",
  "511": "Production",
  "512": "Production-OH",
}

export function buildGLPosting(employees: EmployeeSummary[]): GLPostingSummary {
  const gross_salaries = +employees.reduce((s, e) => s + e.gross_salary, 0).toFixed(2)
  const ahl_total = +employees.reduce((s, e) => s + e.ahl, 0).toFixed(2)
  const nssf_ee = +employees.reduce((s, e) => s + e.nssf_t1 + e.nssf_t2, 0).toFixed(2)
  const nssf_er = +employees.reduce((s, e) => s + (e.nssf_t1 + e.nssf_t2), 0).toFixed(2)
  const nssf_total = +(nssf_ee + nssf_er).toFixed(2)
  const nita_total = +(employees.length * 50).toFixed(2)      // KES 50 per employee
  const pension_total = +employees.reduce((s, e) => s + e.defined_pension_ee, 0).toFixed(2)
  const subtotal = +(gross_salaries + ahl_total + nssf_total + nita_total + pension_total).toFixed(2)
  const fbt_other = 0  // Can be extended for FBT separately
  const total_gross_payroll = +(subtotal + fbt_other).toFixed(2)
  const net_salaries = +employees.reduce((s, e) => s + e.net_salary, 0).toFixed(2)

  return {
    gross_salaries, ahl_total, nssf_total, nita_total,
    pension_total, subtotal, fbt_other,
    total_gross_payroll, net_salaries,
  }
}

export function buildCostCentreBreakdown(employees: EmployeeSummary[]): CostCentreBreakdown[] {
  const map = new Map<string, CostCentreBreakdown>()

  for (const emp of employees) {
    const cc = emp.cost_centre
    if (!map.has(cc)) {
      map.set(cc, {
        code: cc,
        name: CC_NAMES[cc] ?? cc,
        gross: 0, net: 0, paye: 0,
        pension_er: 0, nssf: 0, ahl: 0, shif: 0,
        headcount: 0,
      })
    }
    const row = map.get(cc)!
    row.gross += emp.gross_salary
    row.net += emp.net_salary
    row.paye += emp.net_paye
    row.pension_er += emp.defined_pension_er
    row.nssf += emp.nssf_t1 + emp.nssf_t2
    row.ahl += emp.ahl
    row.shif += emp.shif
    row.headcount += 1
  }

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
}

export interface PayrollVarianceReport {
  total_variance: number
  favorable_variance: number
  unfavorable_variance: number
  by_cost_centre: Array<{
    code: string
    name: string
    gross: number
    net: number
    variance: number
    payroll_cost: number
  }>
}

export function buildPayrollVarianceReport(employees: EmployeeSummary[]): PayrollVarianceReport {
  const total_variance = +employees.reduce((sum, emp) => sum + (emp.gross_salary - emp.net_salary), 0).toFixed(2)
  const favorable_variance = Math.max(total_variance, 0)
  const unfavorable_variance = Math.max(-total_variance, 0)

  const ccMap = new Map<string, { code: string; name: string; gross: number; net: number; variance: number; payroll_cost: number }>()

  for (const emp of employees) {
    const cc = emp.cost_centre
    const row = ccMap.get(cc) ?? {
      code: cc,
      name: CC_NAMES[cc] ?? cc,
      gross: 0,
      net: 0,
      variance: 0,
      payroll_cost: 0,
    }

    row.gross += emp.gross_salary
    row.net += emp.net_salary
    row.variance += emp.gross_salary - emp.net_salary
    row.payroll_cost += emp.net_salary
    ccMap.set(cc, row)
  }

  return {
    total_variance,
    favorable_variance,
    unfavorable_variance,
    by_cost_centre: Array.from(ccMap.values()).sort((a, b) => a.code.localeCompare(b.code)),
  }
}

// ── CSV export helpers ────────────────────────────────────────────────────────
export function buildMasterRegisterCSV(employees: EmployeeSummary[]): string {
  const headers = [
    "Staff No","Name","KRA PIN","Basic Salary","Bonus/Comm","Fringe Benefit",
    "Transport/Hse Allowance","Arrears","OT/Others","Gross Salary",
    "Voluntary Pension","Defined Pension EE 5%","NSSF T1","NSSF T2","SHIF",
    "Taxable Pay","Gross PAYE","House Levy (AHL)","Advances","HELB",
    "Company Loan","Bank Loan","SACCO","Personal Relief","NHIF Relief",
    "AHL Relief","Net PAYE","Total Deductions","Net Pay","Employer Pension",
  ]
  const rows = employees.map(e => [
    e.id, e.name, e.kra_pin,
    // placeholder columns — real values come from the full Employee object
    "", "", "", "", "", "",
    e.gross_salary, "", e.defined_pension_ee,
    e.nssf_t1, e.nssf_t2, e.shif,
    "", "", e.ahl,
    e.advances, e.helb, e.company_loan, e.bank_loan, e.sacco,
    "", "", "",
    e.net_paye, "", e.net_salary, e.defined_pension_er,
  ])
  return [headers, ...rows].map(r => r.join(",")).join("\n")
}

export function buildGLPostingCSV(gl: GLPostingSummary, month: string): string {
  const lines = [
    ["Chrysal Africa Ltd — AX GL Posting Summary", month],
    [""],
    ["Description", "Amount (KES)"],
    ["Gross Salaries (Basic + Benefits)", gl.gross_salaries.toFixed(2)],
    ["AHL (Housing Levy)", gl.ahl_total.toFixed(2)],
    ["NSSF (EE + ER)", gl.nssf_total.toFixed(2)],
    ["NITA", gl.nita_total.toFixed(2)],
    ["Pension (Employee 5%)", gl.pension_total.toFixed(2)],
    ["Subtotal", gl.subtotal.toFixed(2)],
    ["FBT / Other Benefits", gl.fbt_other.toFixed(2)],
    ["Total Gross Payroll", gl.total_gross_payroll.toFixed(2)],
    ["Net Salaries (Cash to Staff)", gl.net_salaries.toFixed(2)],
  ]
  return lines.map(r => r.join(",")).join("\n")
}
