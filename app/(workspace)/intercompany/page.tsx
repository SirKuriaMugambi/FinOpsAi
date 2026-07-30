"use client"

import React, { useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { Globe, ArrowRightLeft, CheckCircle2, ShieldAlert, FileText, CheckCircle } from "lucide-react"

export default function IntercompanyPage() {
  const { addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [balancesReconciled, setBalancesReconciled] = useState(false)

  // Intercompany ledger entries
  const africaLedger = [
    { id: "TX-IC-01", date: "2026-06-10", desc: "Export of Dutch Rose Formulations", amount: 48500, currency: "EUR", type: "AR", gl_acct: "1110 (AR Intercompany)" },
    { id: "TX-IC-02", date: "2026-06-15", desc: "Raw Material Import: Bulbs & Cutters", amount: -35000, currency: "USD", type: "AP", gl_acct: "2010 (AP Intercompany)" },
    { id: "TX-IC-03", date: "2026-06-25", desc: "June Management Allocations Head-Office Fee", amount: -15000, currency: "EUR", type: "AP", gl_acct: "7100 (Intercompany Charges)" }
  ]

  // Corresponding parent ledger entries (Chrysal BV)
  const parentLedger = [
    { id: "BV-IC-01", date: "2026-06-10", desc: "Purchase Invoice from Chrysal Africa", amount: -48500, currency: "EUR", status: "Matched" },
    { id: "BV-IC-02", date: "2026-06-15", desc: "Sales Invoice: Cut Flower Materials to Africa", amount: 35000, currency: "USD", status: "Matched" },
    { id: "BV-IC-03", date: "2026-06-25", desc: "Africa Management Fee Allocation Charge", amount: 15000, currency: "EUR", status: "Matched" }
  ]

  const signoffIntercompany = () => {
    setBalancesReconciled(true)
    addAuditLog(
      "INTERCOMPANY RECON SIGNED",
      "Chrysal BV parent close",
      "Tony signed off and reconciled intercompany accounts receivable and payable balances with Chrysal BV Netherlands."
    )
    alert("Intercompany balances signed off! Reconciled records committed to global finance archive.")
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Intercompany Reconciliation</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Verify cross-border flower shipments, bulk import materials, and management fee allocations with parent entity Chrysal BV.</p>
        </div>
        {!balancesReconciled ? (
          <button
            onClick={signoffIntercompany}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Sign-off IC Balances</span>
          </button>
        ) : (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] border border-emerald-200 bg-emerald-50/20 px-2 py-1">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>INTERCOMPANY BALANCES LOCKED & MATCHED</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[11px]">
        {/* Africa ledger (1.5 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
              <Globe className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Chrysal Africa Ledger (Nairobi, KES Base)</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2">Date / ID</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">GL Account Affected</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {africaLedger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="py-3 font-mono">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">{tx.date}</p>
                        <span className="text-[9px] text-zinc-400 uppercase">{tx.id}</span>
                      </td>
                      <td className="py-3 font-medium text-zinc-800 dark:text-zinc-200">{tx.desc}</td>
                      <td className="py-3 font-mono text-zinc-500">{tx.gl_acct}</td>
                      <td className={`py-3 text-right font-mono font-semibold ${tx.amount > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {tx.currency} {tx.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Parent Chrysal BV ledger (1.5 cols) */}
        <div className="space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
              <ArrowRightLeft className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Chrysal BV Ledger (Netherlands, EUR Base)</h3>
            </div>

            <div className="space-y-3">
              {parentLedger.map((tx) => (
                <div key={tx.id} className="p-3 border border-zinc-150 dark:border-zinc-900 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/10">
                  <div className="flex justify-between items-center font-mono text-[9px]">
                    <span className="text-zinc-400 uppercase font-bold">{tx.id} — {tx.date}</span>
                    <span className="text-emerald-600 uppercase font-bold border border-current px-1">{tx.status}</span>
                  </div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">{tx.desc}</div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-zinc-400">Offsetting Value:</span>
                    <span className={`font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {tx.currency} {tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
