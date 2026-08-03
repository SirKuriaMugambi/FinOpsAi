/**
 * ASSUMPTION — no real bank batch-upload template exists in this project.
 * Which bank Chrysal Africa uses, and that bank's exact column spec/file
 * format (fixed-width text? CSV? specific column order/date format?), are
 * both unknown. This builds a generic, reasonable CSV structure (staff no,
 * name, bank name, account number, amount, reference) that demonstrates the
 * one-click flow end-to-end, but it MUST be checked against the real bank's
 * template before ever being used for an actual payment run. Bank details
 * are also placeholder ("N/A") for every employee today — see the
 * ASSUMPTIONS_NEEDING_CONFIRMATION output of scripts/import-employees-to-supabase.js.
 */

export interface BankBatchRow {
  staffNo: string
  name: string
  bankName: string
  bankAccountNumber: string
  netSalary: number
}

export function buildBankBatchCSV(rows: BankBatchRow[], month: string): string {
  const headers = ["Staff No", "Name", "Bank Name", "Account Number", "Amount (KES)", "Reference"]
  const dataRows = rows.map((r) => [
    r.staffNo,
    r.name,
    r.bankName,
    r.bankAccountNumber,
    r.netSalary.toFixed(2),
    `SALARY-${month}-${r.staffNo}`,
  ])
  return [headers, ...dataRows].map((r) => r.join(",")).join("\n")
}
