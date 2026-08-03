/**
 * ASSUMPTION — this is NOT the real KRA P10 iTax template. KRA's guidance
 * confirms the actual P10 bulk-upload CSV/template is only available after
 * logging into itax.kra.go.ke; it's not publicly published anywhere this
 * could be sourced from without that access. This builds a best-effort CSV
 * using the field categories KRA's own public filing guidance confirms
 * exist (PIN, name, gross pay, benefits, NSSF, SHIF, AHL, taxable pay, tax
 * charged, personal relief, PAYE due) so the one-click flow can be
 * demonstrated end-to-end — it must be checked against the real template
 * downloaded from iTax (and corrected to match column-for-column) before
 * ever being submitted to KRA for a real filing.
 */

export interface ItaxExportRow {
  kraPin: string
  name: string
  grossPay: number
  nssf: number
  shif: number
  ahl: number
  taxablePay: number
  taxCharged: number
  personalRelief: number
  ahlRelief: number
  payeDue: number
}

export function buildItaxExportCSV(rows: ItaxExportRow[], month: string): string {
  const headers = [
    "KRA PIN", "Employee Name", "Gross Pay", "NSSF", "SHIF", "AHL",
    "Taxable Pay", "Tax Charged", "Personal Relief", "AHL Relief", "PAYE Due",
  ]
  const dataRows = rows.map((r) => [
    r.kraPin, r.name,
    r.grossPay.toFixed(2), r.nssf.toFixed(2), r.shif.toFixed(2), r.ahl.toFixed(2),
    r.taxablePay.toFixed(2), r.taxCharged.toFixed(2),
    r.personalRelief.toFixed(2), r.ahlRelief.toFixed(2), r.payeDue.toFixed(2),
  ])
  return [
    [`Chrysal Africa Ltd — PAYE Return (ASSUMPTION FORMAT, NOT the real KRA P10 template) — ${month}`],
    headers,
    ...dataRows,
  ].map((r) => r.join(",")).join("\n")
}
