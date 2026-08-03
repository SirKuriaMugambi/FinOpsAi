"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { runAPReconciliation } from "@/lib/api-logic"
import { createSupabaseBrowserClient } from "@/lib/supabase"
import { Scale, CheckCircle2, AlertCircle, FileSpreadsheet, Send, ShieldAlert, ArrowRight } from "lucide-react"

export default function APReconciliationPage() {
  const { invoices, addAuditLog, currentUser } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()
  const [approving, setApproving] = useState(false)

  // Mock list of vendor payments issued this month
  const [payments, setPayments] = useState([
    { id: "PAY001", vendor_id: "V001", vendor_name: "Bayer East Africa", amount: 1368000, currency: "KES", date: "2026-06-28", ref: "EFT-BYR-88221" }, // Matches INV-001 Gross (1,392,000) minus 2% WHT on Subtotal (24,000)
    { id: "PAY002", vendor_id: "V002", vendor_name: "DHL Express Kenya", amount: 9690, currency: "USD", date: "2026-06-29", ref: "EFT-DHL-11990" }, // Matches INV-002 Gross (9,860 USD) minus 2% WHT on Subtotal (170 USD) = 9,690 USD
    { id: "PAY003", vendor_id: "V003", vendor_name: "Deloitte Kenya", amount: 500000, currency: "KES", date: "2026-06-30", ref: "EFT-DL-001" }, // Unmatched (Outstanding invoice DL-554433 is 2.9M, this is 500k partial or unrelated)
  ])

  // Get only approved invoices for matching
  const approvedInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status === "Approved")
  }, [invoices])

  // Run the AP Reconciliation Engine
  const reconReport = useMemo(() => {
    return runAPReconciliation(payments, approvedInvoices)
  }, [payments, approvedInvoices])

  const [activeReconIdx, setActiveReconIdx] = useState<number | null>(null)

  const approveReconciliation = async () => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      alert("Backend is not configured — cannot save reconciliation.")
      return
    }

    setApproving(true)

    const rows = reconReport.flatMap((recon) => {
      const base = {
        payment_ref: recon.reference,
        vendor_name: recon.vendorName,
        payment_amount_kes: recon.paymentAmountKES,
        payment_date: recon.paymentDate,
        match_status: recon.status,
        confidence: recon.confidence,
        approved_by: currentUser,
      }
      if (recon.matchedInvoiceIds.length === 0) {
        return [{ ...base, invoice_id: null as string | null }]
      }
      return recon.matchedInvoiceIds.map((invoiceId) => ({ ...base, invoice_id: invoiceId as string | null }))
    })

    const { error } = await supabase.from("reconciliation_ledger").insert(rows)
    setApproving(false)

    if (error) {
      alert(`Failed to save reconciliation: ${error.message}`)
      return
    }

    addAuditLog("RECON APPROVED", "AP Statement Reconcile", `${currentUser} approved the AP ledger matching run of ${payments.length} bank payments.`)
    alert("AP reconciliation approved & logged in audit history successfully!")
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 space-y-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">AP Ledger Reconciliation</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Continuous statement matching matching vendor payments against Accounts Payable invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={approveReconciliation}
            disabled={approving}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 disabled:opacity-50 ${accentBg} ${buttonRadius}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{approving ? "Saving…" : "Approve Recon Run"}</span>
          </button>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Total Payments Audited</span>
          <span className="text-base font-bold tracking-tight font-mono text-zinc-800 dark:text-zinc-100">{payments.length} items</span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Auto-Matched Clearances</span>
          <span className="text-base font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {reconReport.filter(r => r.status === "Matched" || r.status === "Multi-Invoice Match").length} items
          </span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-rose-400">Unresolved Variances</span>
          <span className="text-base font-bold tracking-tight font-mono text-rose-600 dark:text-rose-400">
            {reconReport.filter(r => r.status === "Unmatched").length} items
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main matching table (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Automated Statement Match Log</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2">Reference</th>
                    <th className="py-2">Vendor</th>
                    <th className="py-2 text-right">Payment KES</th>
                    <th className="py-2 text-center">Confidence</th>
                    <th className="py-2 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {reconReport.map((recon, index) => {
                    const isMatched = recon.status === "Matched" || recon.status === "Multi-Invoice Match"
                    return (
                      <tr key={recon.paymentId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3 font-mono">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{recon.reference}</p>
                          <span className="text-[9px] text-zinc-400">{recon.paymentDate}</span>
                        </td>
                        <td className="py-3 font-medium text-zinc-800 dark:text-zinc-200">{recon.vendorName}</td>
                        <td className="py-3 text-right font-mono font-semibold">
                          {recon.paymentAmountKES.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                            recon.confidence === "High Confidence ✅"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : recon.confidence === "Medium Confidence 🟡"
                              ? "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {recon.confidence.replace(/[^a-zA-Z\s]/g, "")}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => setActiveReconIdx(index)}
                            className={`px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-mono text-[9px] uppercase ${buttonRadius}`}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audit / Remittance Panel (1 col) */}
        <div className="space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Remittance & Match Inspection</h3>

            {activeReconIdx === null ? (
              <div className="py-12 text-center text-zinc-400 font-mono text-[10px] uppercase">
                Select a payment from the checklist table to inspect invoice offsets.
              </div>
            ) : (
              <div className="space-y-4 text-[11px]">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">PAYMENT METADATA</span>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 font-mono text-[10px] space-y-1.5 border border-zinc-200 dark:border-zinc-950">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Ref:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{reconReport[activeReconIdx].reference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Date:</span>
                      <span>{reconReport[activeReconIdx].paymentDate}</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-850 pt-1.5 mt-1">
                      <span className="text-zinc-400">Amount KES:</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-50">
                        {reconReport[activeReconIdx].paymentAmountKES.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">MATCHING OffSETS</span>
                  {reconReport[activeReconIdx].matchedInvoiceIds.length === 0 ? (
                    <div className="p-3 border border-rose-200 bg-rose-50/40 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 dark:border-rose-900/60 space-y-2">
                      <div className="flex gap-1.5 items-center">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span className="font-bold font-mono text-[9px] uppercase">HOLD: UNMATCHED_VARIANCE</span>
                      </div>
                      <p className="leading-normal font-sans text-[11px]">
                        {reconReport[activeReconIdx].reason} Check whether payment has been allocated to a deposit account or represents a multi-vendor logistics pool charge.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reconReport[activeReconIdx].matchedInvoiceIds.map((invId) => {
                        const inv = approvedInvoices.find(i => i.id === invId)
                        if (!inv) return null
                        return (
                          <div key={invId} className="p-3 border border-zinc-200 dark:border-zinc-900 bg-emerald-50/10 dark:bg-emerald-950/5 space-y-2">
                            <div className="flex justify-between font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                              <span>Invoice ID: {inv.id}</span>
                              <span className="font-bold border border-current px-1 py-0.2 uppercase">OFFSET_APPROVED</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Invoice Num:</span>
                                <span className="font-mono">{inv.invoice_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Gross total:</span>
                                <span className="font-mono">{inv.currency} {inv.total.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                <span>2% KRA WHT Deducted:</span>
                                <span className="font-mono">-{inv.currency} {inv.wht_amount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-t dark:border-zinc-800 pt-1 font-bold">
                                <span>Net Expected Disbursement:</span>
                                <span className="font-mono">
                                  {inv.currency} {(inv.total - inv.wht_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      alert(`Remittance report generated for ${reconReport[activeReconIdx].vendorName}. Ready for download.`)
                    }}
                    className={`w-full py-2 border border-zinc-250 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5 ${buttonRadius}`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Download Remittance Advice</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
