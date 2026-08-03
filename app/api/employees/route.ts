import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import type { Employee } from "@/lib/seeds"

export async function GET() {
  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const { data, error } = await supabase.from("employees").select("*").order("id")
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employees: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const body = (await request.json()) as Partial<Employee>
  if (!body.id || !body.name || !body.kra_pin) {
    return NextResponse.json({ error: "id, name, and kra_pin are required" }, { status: 400 })
  }

  const row = {
    id: body.id,
    name: body.name,
    national_id: body.national_id ?? `NID-${body.id}`,
    kra_pin: body.kra_pin,
    sha_pin: body.sha_pin ?? null,
    grade: body.grade ?? "Staff",
    cost_centre: body.cost_centre ?? "511",
    department: body.department ?? "Production",
    bank_name: body.bank_name ?? "N/A",
    bank_account_number: body.bank_account_number ?? "N/A",
    base_salary: body.base_salary ?? 0,
    bonus_commission: body.bonus_commission ?? 0,
    fringe_benefit: body.fringe_benefit ?? 0,
    transport_allowance: body.transport_allowance ?? 0,
    arrears: body.arrears ?? 0,
    ot_other: body.ot_other ?? 0,
    voluntary_pension: body.voluntary_pension ?? 0,
    advances: body.advances ?? 0,
    helb: body.helb ?? 0,
    company_loan: body.company_loan ?? 0,
    bank_loan: body.bank_loan ?? 0,
    sacco: body.sacco ?? 0,
    personal_relief_override: body.personal_relief_override ?? null,
    exclude_nssf_from_paye_bands: body.exclude_nssf_from_paye_bands ?? false,
  }

  const { data, error } = await supabase.from("employees").insert(row).select("*").single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employee: data }, { status: 201 })
}
