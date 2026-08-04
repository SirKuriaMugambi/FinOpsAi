import { computePayroll, type PayrollInputs, type PayrollResult } from "@/lib/payroll-engine"
import { jsPDF } from "jspdf"
import * as XLSX from "xlsx"

export interface PayrollEmployeeRecord {
  id: string
  name: string
  kra_pin: string
  grade: string
  cost_centre: string
  department: string
  inputs: PayrollInputs
  result: PayrollResult
}

export interface PayrollRunResult {
  month: string
  employees: PayrollEmployeeRecord[]
  totalGross: number
  totalNet: number
  totalPaye: number
  totalNssf: number
  totalShif: number
  totalAhl: number
  variance: { totalVariance: number; favorable: number; unfavorable: number; byCostCentre: Array<{ code: string; name: string; variance: number }> }
}

export function buildPayrollRun(month: string, employees: PayrollEmployeeRecord[]): PayrollRunResult {
  const totalGross = employees.reduce((sum, emp) => sum + emp.result.gross_salary, 0)
  const totalNet = employees.reduce((sum, emp) => sum + emp.result.net_salary, 0)
  const totalPaye = employees.reduce((sum, emp) => sum + emp.result.net_paye, 0)
  const totalNssf = employees.reduce((sum, emp) => sum + emp.result.nssf_t1 + emp.result.nssf_t2, 0)
  const totalShif = employees.reduce((sum, emp) => sum + emp.result.shif, 0)
  const totalAhl = employees.reduce((sum, emp) => sum + emp.result.ahl, 0)

  const byCostCentre = employees.reduce((map, emp) => {
    const entry = map.get(emp.cost_centre) ?? { code: emp.cost_centre, name: emp.cost_centre, variance: 0 }
    entry.variance += emp.result.net_salary - emp.result.gross_salary
    map.set(emp.cost_centre, entry)
    return map
  }, new Map<string, { code: string; name: string; variance: number }>())

  const variance = {
    totalVariance: totalGross - totalNet,
    favorable: Math.max(0, totalGross - totalNet),
    unfavorable: Math.max(0, totalNet - totalGross),
    byCostCentre: Array.from(byCostCentre.values()),
  }

  return {
    month,
    employees,
    totalGross,
    totalNet,
    totalPaye,
    totalNssf,
    totalShif,
    totalAhl,
    variance,
  }
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number)
  return new Date(year, (m ?? 1) - 1, 1).toLocaleString("en-KE", { month: "long", year: "numeric" })
}

const LEFT = 40
const RIGHT = 555
const SECTION_GREEN: [number, number, number] = [21, 128, 61]

// Matches Chrysal's real payslip layout (sectioned Earnings / Deductions /
// Net Pay / PAYE Information, with subtotals) — but the figures are this
// system's own verified numbers (gross − NSSF − pension = taxable pay, per
// Tony's Nov 2024 source file), not the different pre-tax basis a specific
// real slip happened to show (SHIF + Housing Levy + pension). Format
// matched; calculation basis intentionally left as-is per instruction.
function drawPayslipPage(doc: jsPDF, employee: PayrollEmployeeRecord, month: string) {
  let y = 50

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("CHRYSAL AFRICA LTD", LEFT, y)
  y += 18
  doc.setTextColor(...SECTION_GREEN)
  doc.setFontSize(11)
  doc.text("Payslip", LEFT, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  y += 22

  const infoRows: [string, string][] = [
    ["Employee No.", employee.id],
    ["Name", employee.name],
    ["Pay Period", monthLabel(month)],
    ["Admin Unit", employee.department],
    ["Currency", "KES"],
  ]
  for (const [label, value] of infoRows) {
    doc.text(label + ":", LEFT, y)
    doc.text(value, LEFT + 90, y)
    y += 14
  }
  y += 10

  const section = (title: string) => {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...SECTION_GREEN)
    doc.text(title, LEFT, y)
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "normal")
    y += 16
  }
  const line = (label: string, amount: number, opts: { bold?: boolean; indent?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.text(label, LEFT + (opts.indent ?? 0), y)
    doc.text(amount.toFixed(2), RIGHT, y, { align: "right" })
    doc.setFont("helvetica", "normal")
    y += 14
  }
  const subtotal = (amount: number) => {
    doc.setFont("helvetica", "bold")
    doc.text(amount.toFixed(2), RIGHT, y, { align: "right" })
    doc.setFont("helvetica", "normal")
    y += 16
  }
  const divider = () => { doc.line(LEFT, y - 8, RIGHT, y - 8) }

  const r = employee.result
  const i = employee.inputs

  // Earnings
  section("Earnings:")
  const earnings: [string, number][] = [["Basic Pay", i.base_salary]]
  if (i.bonus_commission > 0) earnings.push(["Bonus / Commission", i.bonus_commission])
  if (i.transport_allowance > 0) earnings.push(["Transport Allowance", i.transport_allowance])
  if (i.fringe_benefit > 0) earnings.push(["Fringe Benefit (FBT)", i.fringe_benefit])
  if (i.arrears > 0) earnings.push(["Arrears", i.arrears])
  if (i.ot_other > 0) earnings.push(["OT / Other", i.ot_other])
  earnings.forEach(([label, amount]) => line(label, amount))
  subtotal(r.gross_salary)
  y += 6

  // Deductions
  section("Deductions:")
  const deductions: [string, number][] = [
    ["PAYE", r.net_paye],
    ["NSSF (Tier I)", r.nssf_t1],
    ["NSSF (Tier II)", r.nssf_t2],
    ["SHIF", r.shif],
    ["Housing Levy", r.ahl],
    ["Pension Contribution", r.defined_pension_ee],
  ]
  if (i.voluntary_pension > 0) deductions.push(["Voluntary Pension", i.voluntary_pension])
  if (i.advances > 0) deductions.push(["Advances", i.advances])
  if (i.helb > 0) deductions.push(["HELB", i.helb])
  if (i.company_loan > 0) deductions.push(["Company Loan", i.company_loan])
  if (i.bank_loan > 0) deductions.push(["Bank Loan", i.bank_loan])
  if (i.sacco > 0) deductions.push(["SACCO", i.sacco])
  deductions.forEach(([label, amount]) => line(label, amount))
  const deductionsTotal = deductions.reduce((s, [, amount]) => s + amount, 0)
  subtotal(deductionsTotal)
  y += 6

  // Net Pay
  divider()
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Net Pay", LEFT, y)
  doc.text(r.net_salary.toFixed(2), RIGHT, y, { align: "right" })
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  y += 24

  // PAYE Information
  section("PAYE Information:")
  line("Total Earnings", r.gross_salary)
  doc.text("Less Pre-Tax Deductions:", LEFT, y)
  y += 14
  line("NSSF (Tier I)", r.nssf_t1, { indent: 14 })
  line("NSSF (Tier II)", r.nssf_t2, { indent: 14 })
  line("Pension Contribution", r.defined_pension_ee, { indent: 14 })
  line("Taxable Pay", r.taxable_pay, { bold: true })
  y += 6
  line("Personal Relief", r.personal_relief)
  line("PAYE", r.net_paye)
}

export function generatePayslipPDF(employee: PayrollEmployeeRecord, month: string): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  drawPayslipPage(doc, employee, month)
  return doc.output("blob")
}

// One PDF, one page per employee — avoids needing a zip library for the
// "generate all payslips" one-click action.
export function generateAllPayslipsPDF(employees: PayrollEmployeeRecord[], month: string): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  employees.forEach((employee, i) => {
    if (i > 0) doc.addPage()
    drawPayslipPage(doc, employee, month)
  })
  return doc.output("blob")
}

export function generatePayrollWorkbook(run: PayrollRunResult): Blob {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      Month: run.month,
      Headcount: run.employees.length,
      GrossSalary: run.totalGross,
      NetSalary: run.totalNet,
      PAYE: run.totalPaye,
      NSSF: run.totalNssf,
      SHIF: run.totalShif,
      AHL: run.totalAhl,
      VarianceTotal: run.variance.totalVariance,
    },
    ...run.employees.map((emp) => ({
      StaffNo: emp.id,
      Name: emp.name,
      KRA_PIN: emp.kra_pin,
      CostCentre: emp.cost_centre,
      GrossSalary: emp.result.gross_salary,
      NetPAYE: emp.result.net_paye,
      TotalDeductions: emp.result.total_deductions,
      NetSalary: emp.result.net_salary,
    })),
  ])

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll")
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function buildVarianceSummary(run: PayrollRunResult) {
  return {
    month: run.month,
    totalVariance: run.variance.totalVariance,
    favorable: run.variance.favorable,
    unfavorable: run.variance.unfavorable,
    byCostCentre: run.variance.byCostCentre,
  }
}
