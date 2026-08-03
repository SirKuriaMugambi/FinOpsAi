import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { getAuthedUserWithRole } from "@/lib/supabase"

// Submitted → Rejected, sending a run back for correction. Same approver
// gate as /api/payroll/approve — rejecting is a sign-off decision too.
export async function POST(request: Request) {
  const authedUser = await getAuthedUserWithRole()
  if (!authedUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (authedUser.role !== "finance_manager") {
    return NextResponse.json({ error: "Only the finance manager can reject a payroll run" }, { status: 403 })
  }

  const body = (await request.json()) as { month?: string; reason?: string }
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
      { error: `Cannot reject a run with status "${run.status}" — only Submitted runs can be rejected.` },
      { status: 409 },
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from("payroll_runs")
    .update({ status: "Rejected", approved_by: authedUser.id })
    .eq("id", run.id)
    .select("*")
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ run: updated })
}
