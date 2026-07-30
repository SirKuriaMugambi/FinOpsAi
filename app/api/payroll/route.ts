import { NextResponse } from "next/server"
import { buildPayrollVarianceReport, computePayroll, type EmployeeSummary } from "@/lib/payroll-engine"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    month?: string
    employees?: Array<{
      id: string
      name: string
      kra_pin: string
      grade?: string
      cost_centre?: string
      department?: string
      base_salary: number
      bonus_commission: number
      fringe_benefit: number
      transport_allowance: number
      arrears: number
      ot_other: number
      voluntary_pension: number
      advances: number
      helb: number
      company_loan: number
      bank_loan: number
      sacco: number
    }>
  }

  const employees = body.employees ?? []
  const month = body.month ?? new Date().toISOString().slice(0, 7)

  const payrollRun = employees.map((employee) => {
    const result = computePayroll({
      base_salary: employee.base_salary,
      bonus_commission: employee.bonus_commission,
      fringe_benefit: employee.fringe_benefit,
      transport_allowance: employee.transport_allowance,
      arrears: employee.arrears,
      ot_other: employee.ot_other,
      voluntary_pension: employee.voluntary_pension,
      advances: employee.advances,
      helb: employee.helb,
      company_loan: employee.company_loan,
      bank_loan: employee.bank_loan,
      sacco: employee.sacco,
    })

    return {
      id: employee.id,
      name: employee.name,
      kra_pin: employee.kra_pin,
      cost_centre: employee.cost_centre ?? "511",
      gross_salary: result.gross_salary,
      net_paye: result.net_paye,
      nssf_t1: result.nssf_t1,
      nssf_t2: result.nssf_t2,
      shif: result.shif,
      ahl: result.ahl,
      defined_pension_ee: result.defined_pension_ee,
      defined_pension_er: result.defined_pension_er,
      helb: employee.helb,
      company_loan: employee.company_loan,
      bank_loan: employee.bank_loan,
      sacco: employee.sacco,
      advances: employee.advances,
      net_salary: result.net_salary,
    } satisfies EmployeeSummary
  })

  const variance = buildPayrollVarianceReport(payrollRun)

  return NextResponse.json({
    month,
    headcount: payrollRun.length,
    totals: {
      gross_salary: payrollRun.reduce((s, e) => s + e.gross_salary, 0),
      net_salary: payrollRun.reduce((s, e) => s + e.net_salary, 0),
      paye: payrollRun.reduce((s, e) => s + e.net_paye, 0),
      nssf: payrollRun.reduce((s, e) => s + e.nssf_t1 + e.nssf_t2, 0),
      shif: payrollRun.reduce((s, e) => s + e.shif, 0),
      ahl: payrollRun.reduce((s, e) => s + e.ahl, 0),
    },
    variance,
    employees: payrollRun,
  })
}
