"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { runBankReconciliation } from "@/lib/api-logic"
import { Coins, Upload, CheckCircle2, AlertTriangle, FileText, ChevronDown, Check, X } from "lucide-react"

export default function BankReconciliationPage() {
  const { addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [bankFileLoaded, setBankFileLoaded] = useState(false)
  const [glFileLoaded, setGLFileLoaded] = useState(false)

  // Mock bank statement lines
  const bankStatementLines = [
    { id: "BSL001", date: "2026-06-28", desc: "NCBA EFT INWARD BYR AGRO", amount: 1368000, type: "CR" as const }, // Matches AP Payment PAY001 KES
    { id: "BSL002", date: "2026-06-29", desc: "STCH TRF OUTWARD DHL EX", amount: 1254850, type: "DR" as const }, // Matches USD DHL invoice at live rates
    { id: "BSL003", date: "2026-06-30", desc: "NCBA BANK CHARGES JUN26", amount: 4500, type: "DR" as const }, // Unrecorded bank charge
    { id: "BSL004", date: "2026-07-01", desc: "M-PESA PAYBILL 888888 KPLC", amount: 125000, type: "DR" as const }, // Matches GL electric charge
  ]

  // Mock ledger extracts
  const ledgerExtractLines = [
    { id: "GLL001", date: "2026-06-28", desc: "AP Disb: Bayer East Africa BY-998822", amount: 1368000, type: "Cr" as const }, // Matches Deposit credit BSL001
    { id: "GLL002", date: "2026-06-29", desc: "AP Disb: DHL Freight", amount: 1254850, type: "Cr" as const }, // Matches DHL
    { id: "GLL003", date: "2026-07-01", desc: "Utilities: KPLC June Invoice", amount: 125000, type: "Cr" as const }, // Matches KPLC
    { id: "GLL004", date: "2026-06-25", desc: "Pending Supplier Cheque V005", amount: 450000, type: "Cr" as const }, // Outstanding cheque (no bank line yet)
  ]

  // Reconcile
  const reconList = useMemo(() => {
    if (!bankFileLoaded || !glFileLoaded) return []
    return runBankReconciliation(bankStatementLines, ledgerExtractLines)
  }, [bankFileLoaded, glFileLoaded])

  const totals = useMemo(() => {
    if (reconList.length === 0) return { matched: 0, unmatched: 0, bankCharges: 0 }
    return {
      matched: reconList.filter(r => r.matchStatus === "Auto-Matched").length,
      unmatched: reconList.filter(r => r.matchStatus === "Unmatched").length,
      bankCharges: reconList.filter(r => r.matchStatus === "Unmatched" && r.description.includes("CHARGES")).length
    }
  }, [reconList])

  const runMockAutoMatch = () => {
    setBankFileLoaded(true)
    setGLFileLoaded(true)
    addAuditLog("BANK RECON RUN", "Statement Reconcile", "Executed auto-matching bank statement run for June close.")
  }

  const approveReconciliation = () => {
    addAuditLog("RECON APPROVED", "Bank Statement Close", "Tony signed off on Bank Statement Reconciliation for June 2026.")
    alert("Bank Statement Reconciliation verified and signed off for month close!")
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Bank Reconciliation Module</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Verify general ledger entries against bank statements to audit cash reserves.</p>
        </div>
        {bankFileLoaded && glFileLoaded && (
          <button
            onClick={approveReconciliation}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Sign-off Reconciliation</span>
          </button>
        )}
      </div>

      {/* File Upload Simulator */}
      {!bankFileLoaded || !glFileLoaded ? (
        <div className={`p-8 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 text-center space-y-6 ${cardRadius}`}>
          <div className="max-w-md mx-auto space-y-2">
            <Coins className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono">Simulate Statement Ingestion</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">Ingest bank statement CSV files and corporate general ledger extracts from AX to activate reconciliation logs.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
            {/* Bank statement card */}
            <div className={`p-4 border ${bankFileLoaded ? "border-emerald-500 bg-emerald-50/5" : "border-zinc-200 dark:border-zinc-850"} flex justify-between items-center ${cardRadius}`}>
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase">1. Statement File</span>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">NCBA_June_Statement.csv</p>
              </div>
              <button
                onClick={() => setBankFileLoaded(true)}
                className={`px-2.5 py-1 text-[9px] font-mono border uppercase tracking-wider ${
                  bankFileLoaded ? "border-emerald-500 text-emerald-600 bg-emerald-50/20" : "border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                } ${buttonRadius}`}
              >
                {bankFileLoaded ? "Loaded" : "Upload"}
              </button>
            </div>

            {/* General ledger card */}
            <div className={`p-4 border ${glFileLoaded ? "border-emerald-500 bg-emerald-50/5" : "border-zinc-200 dark:border-zinc-850"} flex justify-between items-center ${cardRadius}`}>
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase">2. General Ledger Extract</span>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">AX_GL_Bank_Extract.xlsx</p>
              </div>
              <button
                onClick={() => setGLFileLoaded(true)}
                className={`px-2.5 py-1 text-[9px] font-mono border uppercase tracking-wider ${
                  glFileLoaded ? "border-emerald-500 text-emerald-600 bg-emerald-50/20" : "border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                } ${buttonRadius}`}
              >
                {glFileLoaded ? "Loaded" : "Upload"}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={runMockAutoMatch}
              className={`px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider ${accentBg} ${buttonRadius}`}
            >
              Execute Ingestion & Matching
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dashboard row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Auto-Matched Entries</span>
              <span className="text-base font-bold font-mono text-emerald-600">{totals.matched} reconciled</span>
            </div>
            <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
              <span className="text-[9px] font-mono uppercase text-rose-400">Unreconciled Variances</span>
              <span className="text-base font-bold font-mono text-rose-600">{totals.unmatched} flagged</span>
            </div>
            <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
              <span className="text-[9px] font-mono uppercase text-amber-500">Unrecorded Bank Charges</span>
              <span className="text-base font-bold font-mono text-amber-500">{totals.bankCharges} items</span>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-900 pb-2">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Statement Intersect Reconciliation Log</h3>
              <button
                onClick={() => {
                  setBankFileLoaded(false)
                  setGLFileLoaded(false)
                }}
                className={`px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-mono text-[9px] uppercase ${buttonRadius}`}
              >
                Clear Files
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2">Date</th>
                    <th className="py-2">Statement Line Description</th>
                    <th className="py-2 text-right">Value (KES)</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2">GL Matching Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {reconList.map((recon) => {
                    const matchedGL = ledgerExtractLines.find(l => l.id === recon.ledgerLineId)
                    return (
                      <tr key={recon.bankLineId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3 font-mono text-zinc-500">{recon.date}</td>
                        <td className="py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                          <p>{recon.description}</p>
                          <span className="text-[9px] text-zinc-400 font-mono uppercase">{recon.type}</span>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold">
                          {recon.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                            recon.matchStatus === "Auto-Matched"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {recon.matchStatus}
                          </span>
                        </td>
                        <td className="py-3">
                          {matchedGL ? (
                            <div className="font-mono text-[10px] space-y-0.5">
                              <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate block max-w-[200px]" title={matchedGL.desc}>{matchedGL.desc}</span>
                              <span className="text-zinc-400 text-[9px]">ID: {matchedGL.id} — Date: {matchedGL.date}</span>
                            </div>
                          ) : (
                            <div className="text-rose-500 flex items-center gap-1 font-mono text-[10px]">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>Variance flagged: {recon.reason}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
