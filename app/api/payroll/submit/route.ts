import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { createSupabaseServerClient } from "@/lib/supabase"

// Draft → Submitted. Any authenticated user may submit a run they've
// computed — approval (the actual sign-off gate) is a separate, role-gated
// step below, not this one.
export async function POST(request: Request) {
  const authedSupabase = await createSupabaseServerClient()
  if (!authedSupabase) {
    return NextResponse.json({ error: "Backend is not configured" }, { status: 503 })
  }

  const { data: { user } } = await authedSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
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

  if (run.status !== "Draft") {
    return NextResponse.json(
      { error: `Cannot submit a run with status "${run.status}" — only Draft runs can be submitted.` },
      { status: 409 },
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from("payroll_runs")
    .update({ status: "Submitted", submitted_by: user.id, submitted_at: new Date().toISOString() })
    .eq("id", run.id)
    .select("*")
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ run: updated })
}
