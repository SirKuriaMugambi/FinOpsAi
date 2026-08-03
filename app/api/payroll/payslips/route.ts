import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { generateAllPayslipsPDF, type PayrollEmployeeRecord } from "@/lib/payroll-backend"
import type { PayrollResult } from "@/lib/payroll-engine"

interface PayrollRegisterRow {
  employee_id: string
  basic_salary: number
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
  gross_salary: number
  nssf_t1: number
  nssf_t2: number
  shif: number
  ahl: number
  defined_pension_ee: number
  employer_pension: number
  taxable_pay: number
  gross_paye: number
  personal_relief: number
  nhif_relief: number
  ahl_relief: number
  net_paye: number
  total_deductions: number
  net_pay: number
}

function toPayrollResult(row: PayrollRegisterRow): PayrollResult {
  return {
    gross_salary: row.gross_salary,
    nssf_t1: row.nssf_t1,
    nssf_t2: row.nssf_t2,
    shif: row.shif,
    ahl: row.ahl,
    defined_pension_ee: row.defined_pension_ee,
    defined_pension_er: row.employer_pension,
    taxable_pay: row.taxable_pay,
    gross_paye: row.gross_paye,
    personal_relief: row.personal_relief,
    nhif_relief: row.nhif_relief,
    ahl_relief: row.ahl_relief,
    net_paye: row.net_paye,
    allowances: 0,
    deductions: row.total_deductions,
    nssf: row.nssf_t1 + row.nssf_t2,
    nhif: row.shif,
    paye: row.net_paye,
    net_salary: row.net_pay,
    total_deductions: row.total_deductions,
  }
}

// Generates one PDF (one page per employee) for a payroll run. Only
// available once a run is Approved or Posted — payslips shouldn't circulate
// before the finance manager has signed off on the numbers.
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month")
  if (!month) {
    return NextResponse.json({ error: "month query param is required, e.g. ?month=2026-08" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Backend is not configured" }, { status: 503 })
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("month", month)
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: `No payroll run found for month "${month}".` }, { status: 404 })
  }

  if (run.status !== "Approved" && run.status !== "Posted") {
    return NextResponse.json(
      { error: `Cannot generate payslips for a run with status "${run.status}" — it must be Approved first.` },
      { status: 409 },
    )
  }

  const { data: entries, error: entriesError } = await supabase
    .from("payroll_register_entries")
    .select("*")
    .eq("payroll_run_id", run.id)

  if (entriesError || !entries || entries.length === 0) {
    return NextResponse.json({ error: `No payroll register entries found for month "${month}".` }, { status: 404 })
  }

  const employeeIds = entries.map((e) => e.employee_id)
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, kra_pin, grade, cost_centre, department")
    .in("id", employeeIds)

  const employeeById = new Map((employees ?? []).map((e) => [e.id, e]))

  const records: PayrollEmployeeRecord[] = entries.map((entry) => {
    const employee = employeeById.get(entry.employee_id) ?? {
      id: entry.employee_id, name: entry.employee_id, kra_pin: "", grade: "Staff",
      cost_centre: "511", department: "Production",
    }
    return {
      id: employee.id,
      name: employee.name,
      kra_pin: employee.kra_pin,
      grade: employee.grade,
      cost_centre: employee.cost_centre,
      department: employee.department,
      inputs: {
        base_salary: entry.basic_salary,
        bonus_commission: entry.bonus_commission,
        fringe_benefit: entry.fringe_benefit,
        transport_allowance: entry.transport_allowance,
        arrears: entry.arrears,
        ot_other: entry.ot_other,
        voluntary_pension: entry.voluntary_pension,
        advances: entry.advances,
        helb: entry.helb,
        company_loan: entry.company_loan,
        bank_loan: entry.bank_loan,
        sacco: entry.sacco,
      },
      result: toPayrollResult(entry as PayrollRegisterRow),
    }
  })

  const pdfBlob = generateAllPayslipsPDF(records, month)
  const buffer = Buffer.from(await pdfBlob.arrayBuffer())

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="chrysal-payslips-${month}.pdf"`,
    },
  })
}
