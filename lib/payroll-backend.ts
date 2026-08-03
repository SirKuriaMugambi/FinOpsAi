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

function drawPayslipPage(doc: jsPDF, employee: PayrollEmployeeRecord, month: string) {
  const y = 40

  doc.setFont("helvetica", "bold")
  doc.text("CHRYSAL AFRICA LTD", 40, y)
  doc.setFont("helvetica", "normal")
  doc.text(`Monthly Payslip — ${month}`, 40, y + 20)
  doc.text(`Employee: ${employee.name}`, 40, y + 45)
  doc.text(`Staff No: ${employee.id}`, 40, y + 65)
  doc.text(`KRA PIN: ${employee.kra_pin}`, 40, y + 85)
  doc.text(`Cost Centre: ${employee.cost_centre}`, 40, y + 105)

  const rows = [
    ["Gross Salary", employee.result.gross_salary],
    ["NSSF Tier I", employee.result.nssf_t1],
    ["NSSF Tier II", employee.result.nssf_t2],
    ["SHIF", employee.result.shif],
    ["AHL", employee.result.ahl],
    ["Defined Pension EE", employee.result.defined_pension_ee],
    ["Net PAYE", employee.result.net_paye],
    ["Total Deductions", employee.result.total_deductions],
    ["Net Salary", employee.result.net_salary],
  ]

  let currentY = y + 135
  rows.forEach(([label, amount]) => {
    doc.text(String(label), 40, currentY)
    doc.text(`KES ${Number(amount).toFixed(2)}`, 380, currentY)
    currentY += 18
  })
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
