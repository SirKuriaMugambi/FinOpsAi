import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { requireRole } from "@/lib/supabase"
import { parsePayrollWorkbook, type ParsedPayrollRow } from "@/lib/excel-ingest"

export interface ImportPreviewRow {
  parsed: ParsedPayrollRow
  matchStatus: "matched" | "unmatched"
  existingName?: string
}

export interface ImportPreviewResult {
  matched: ImportPreviewRow[]
  unmatched: ImportPreviewRow[]
  skipped: Array<{ row: number; reason: string }>
}

// Parses an uploaded monthly variable-pay workbook and returns a PREVIEW
// only — it never writes to Supabase. The finance manager reviews matched
// vs. unmatched staff numbers and skipped rows here, then the client merges
// the confirmed values into the existing employee set and calls the normal
// POST /api/payroll flow to actually compute and save the run. Keeping the
// write step separate and explicit avoids silently overwriting salary data
// from a malformed or wrong-month upload.
export async function POST(request: Request) {
  const guard = await requireRole("finance_manager")
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const password = formData.get("password")

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded (expected a 'file' field)" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let parseResult
  try {
    parseResult = await parsePayrollWorkbook(buffer, {
      password: typeof password === "string" && password.length > 0 ? password : undefined,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse workbook" },
      { status: 422 },
    )
  }

  const { data: existingEmployees, error } = await supabase.from("employees").select("id, name")
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const existingById = new Map((existingEmployees ?? []).map((e) => [e.id, e.name as string]))

  const matched: ImportPreviewRow[] = []
  const unmatched: ImportPreviewRow[] = []

  for (const row of parseResult.rows) {
    if (existingById.has(row.id)) {
      matched.push({ parsed: row, matchStatus: "matched", existingName: existingById.get(row.id) })
    } else {
      unmatched.push({ parsed: row, matchStatus: "unmatched" })
    }
  }

  const preview: ImportPreviewResult = { matched, unmatched, skipped: parseResult.skipped }
  return NextResponse.json(preview)
}
