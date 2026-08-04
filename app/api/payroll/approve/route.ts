import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { requireRole } from "@/lib/supabase"

// Submitted → Approved. Restricted to finance_manager, matching the RLS
// policy already enforced elsewhere in this app for payroll/invoice approval.
export async function POST(request: Request) {
  const guard = await requireRole("finance_manager")
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = (await request.json()) as { month?: string }
  if (!body.month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Backend is not configured" }, { status: 503 })
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("month", body.month)
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: `No payroll run found for month "${body.month}".` }, { status: 404 })
  }

  if (run.status !== "Submitted") {
    return NextResponse.json(
      { error: `Cannot approve a run with status "${run.status}" — only Submitted runs can be approved.` },
      { status: 409 },
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from("payroll_runs")
    .update({ status: "Approved", approved_by: guard.user.id })
    .eq("id", run.id)
    .select("*")
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ run: updated })
}
