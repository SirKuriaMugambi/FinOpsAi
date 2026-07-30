"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { runARReceipting } from "@/lib/api-logic"
import { Receipt, CheckCircle, ShieldAlert, FileText, CheckCircle2, HelpCircle, UploadCloud } from "lucide-react"

export default function ARReceiptingPage() {
  const { addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  // Seed AR Trade Invoices
  const [arInvoices, setArInvoices] = useState([
    { id: "AR-INV-001", customer: "Royal FloraHolland (Netherlands)", net_amount: 32000, vat: 0, received: 32000, currency: "EUR", certificate: "Received" as const }, // Foreign customer - Exempt from KRA WHT
    { id: "AR-INV-002", customer: "Simbi Roses Ltd (Local)", net_amount: 500000, vat: 80000, received: 570000, currency: "KES", certificate: "Pending" as const }, // Net 500k, VAT 16% = 80k. Gross: 580k. 2% net WHT = 10k. Expected received = 570k. Match!
    { id: "AR-INV-003", customer: "Zuri Flora Kenya (Local)", net_amount: 800000, vat: 128000, received: 0, currency: "KES", certificate: "Pending" as const }, // Gross: 928k. 2% net WHT = 16k. Expected received = 912k. Unpaid.
    { id: "AR-INV-004", customer: "Kenia Flowers (Local)", net_amount: 200000, vat: 32000, received: 232000, currency: "KES", certificate: "Pending" as const } // Paid full Gross (232k) instead of Gross - 2% WHT. Overpaid/Discrepancy.
  ])

  const [receivedPayments, setReceivedPayments] = useState<{ invoice_id: string; amount: number }[]>([])

  const arReport = useMemo(() => {
    return runARReceipting(arInvoices, receivedPayments)
  }, [arInvoices, receivedPayments])

  const handleReceiveCertificate = (id: string, ref: string) => {
    setArInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, certificate: "Received" } : inv))
    )
    addAuditLog(
      "AR CERTIFICATE SECURED",
      id,
      `Received KRA WHT Certificate for ${id}. Claimed input tax credit. Reference: ${ref}`
    )
    alert("WHT Certificate logged! Outstanding invoice offset resolved for input tax claims.")
  }

  const [activeCertId, setActiveCertId] = useState<string | null>(null)
  const [certRef, setCertRef] = useState("")

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 space-y-0.5">
        <h1 className="text-base font-bold font-mono uppercase tracking-wider">AR Customer Receipting</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs">Track client invoice receipt offsets and reconciles local withholding VAT certificates.</p>
      </div>

      {/* Customer Payment Formula Alert box */}
      <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 text-[11px] space-y-2 ${cardRadius}`}>
        <div className="flex gap-2 items-center text-zinc-800 dark:text-zinc-200">
          <HelpCircle className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">KRA Customer 2% Withholding Rule Formula</span>
        </div>
        <p className="leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-3xl">
          On local sales, customers withhold 2% of the net taxable invoice amount (before 16% VAT) and remit it directly to KRA on Chrysal's behalf.
          Chrysal expects to receive: <strong className="font-mono">Expected Receipt = Gross Invoice (Net + VAT) − 2% Net Withholding</strong>.
          We record the collection and track the customer's KRA payment certificate to offset our tax ledger input credits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AR Ledger matching check (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Accounts Receivable Ledger</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2">ID & Client</th>
                    <th className="py-2 text-right">Gross Total</th>
                    <th className="py-2 text-right">Expected (Gross - 2% Net)</th>
                    <th className="py-2 text-right">Received</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2 text-center">WHT Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {arReport.map((recon) => {
                    const original = arInvoices.find(i => i.id === recon.invoiceId)!
                    return (
                      <tr key={recon.invoiceId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3 font-mono">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{original.customer}</p>
                          <span className="text-[9px] text-zinc-400">Invoice: {recon.invoiceId} — Net: {original.net_amount.toLocaleString()}</span>
                        </td>
                        <td className="py-3 text-right font-mono text-zinc-500">
                          {original.currency} {recon.grossAmountKES.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                          {original.currency} {recon.expectedReceiptKES.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold">
                          {original.currency} {recon.receivedAmountKES.toLocaleString()}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                            recon.status === "Fully Paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : recon.status === "Underpaid (WHT Discrepancy)"
                              ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                              : "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                          }`}>
                            {recon.status.replace(/[^a-zA-Z\s]/g, "")}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                            recon.certificateStatus === "Received"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : recon.certificateStatus === "Discrepancy"
                              ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse"
                              : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400"
                          }`}>
                            {recon.certificateStatus}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Certificate Upload / Log (1 col) */}
        <div className="space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Claim Input Tax (WHT Certificates)</h3>

            {activeCertId === null ? (
              <div className="space-y-3 text-[11px]">
                <p className="text-zinc-500 leading-relaxed font-sans">
                  Select a local invoice below with a pending KRA certificate status to log and claim input tax recovered credits.
                </p>
                <div className="space-y-2">
                  {arInvoices
                    .filter((inv) => inv.certificate === "Pending")
                    .map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => setActiveCertId(inv.id)}
                        className={`w-full p-2.5 text-left border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 flex justify-between items-center ${buttonRadius}`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-[10px] text-zinc-400 uppercase">{inv.id}</span>
                          <span className="font-semibold block text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">{inv.customer}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {inv.currency} {(inv.net_amount * 0.02).toLocaleString()} WHT
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-[11px]">
                <div className="flex justify-between items-center pb-2 border-b dark:border-zinc-900">
                  <span className="font-mono text-[10px] font-bold uppercase text-zinc-400">LOG KRA iTax CERTIFICATE</span>
                  <button onClick={() => { setActiveCertId(null); setCertRef(""); }} className="text-zinc-400">×</button>
                </div>

                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 font-mono text-[10px] space-y-1">
                  <div><span className="text-zinc-400">Invoice:</span> {activeCertId}</div>
                  <div><span className="text-zinc-400">Client:</span> {arInvoices.find(i => i.id === activeCertId)?.customer}</div>
                  <div className="border-t dark:border-zinc-800 pt-1 mt-1 font-bold flex justify-between text-zinc-900 dark:text-zinc-100">
                    <span>Reclaimable Input WHT:</span>
                    <span>KES {((arInvoices.find(i => i.id === activeCertId)?.net_amount || 0) * 0.02).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase block">TIMS Certificate Reference Number</label>
                    <input
                      type="text"
                      value={certRef}
                      onChange={(e) => setCertRef(e.target.value)}
                      placeholder="e.g. CERT-KRA-99882"
                      className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setActiveCertId(null); setCertRef(""); }}
                      className={`flex-1 py-1.5 border border-zinc-200 dark:border-zinc-800 font-mono text-[9px] uppercase text-zinc-500 ${buttonRadius}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (certRef.trim()) {
                          handleReceiveCertificate(activeCertId, certRef)
                          setActiveCertId(null)
                          setCertRef("")
                        }
                      }}
                      disabled={!certRef.trim()}
                      className={`flex-1 py-1.5 font-mono text-[9px] uppercase text-white font-bold disabled:opacity-50 ${accentBg} ${buttonRadius}`}
                    >
                      Log Receipt
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
