"use client"

import React, { useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import {
  GitCompare,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  Lock
} from "lucide-react"

interface MatchPreset {
  id: string
  poNum: string
  vendor: string
  poDetails: { item: string; qty: number; unitPrice: number; total: number }[]
  invDetails: { item: string; qty: number; unitPrice: number; total: number }[]
  dnDetails: { item: string; qty: number; ref: string }[]
  status: "matched" | "discrepancy" | "partial"
  discrepancies: { type: "error" | "warning"; message: string }[]
}

const PRESET_MATCHES: MatchPreset[] = [
  {
    id: "match-01",
    poNum: "PO-BYR-2026-902",
    vendor: "Bayer East Africa",
    status: "matched",
    poDetails: [{ item: "Copper Oxychloride Fungicide (kg)", qty: 500, unitPrice: 2400, total: 1200000 }],
    invDetails: [{ item: "Copper Oxychloride Fungicide (kg)", qty: 500, unitPrice: 2400, total: 1200000 }],
    dnDetails: [{ item: "Copper Oxychloride Fungicide (kg)", qty: 500, ref: "DN-BYR-88001" }],
    discrepancies: []
  },
  {
    id: "match-02",
    poNum: "PO-DHL-2026-114",
    vendor: "DHL Express Kenya",
    status: "discrepancy",
    poDetails: [{ item: "Express Import Customs Clearance", qty: 1, unitPrice: 5000, total: 5000 }],
    invDetails: [{ item: "Express Import Customs Clearance", qty: 1, unitPrice: 6500, total: 6500 }], // Price discrepancy
    dnDetails: [{ item: "Express Import Customs Clearance", qty: 1, ref: "DN-DHL-11990" }],
    discrepancies: [
      { type: "error", message: "Price variance detected: Billed price USD 6,500 exceeds PO commitment USD 5,000 by 30%." }
    ]
  },
  {
    id: "match-03",
    poNum: "PO-SYN-2026-340",
    vendor: "Syngenta Flowers East Africa",
    status: "partial",
    poDetails: [{ item: "Chrysanthemum Cutting Rootstock (Crates)", qty: 1000, unitPrice: 18500, total: 1850000 }],
    invDetails: [{ item: "Chrysanthemum Cutting Rootstock (Crates)", qty: 600, unitPrice: 18500, total: 1110000 }], // Partial billing
    dnDetails: [{ item: "Chrysanthemum Cutting Rootstock (Crates)", qty: 600, ref: "DN-SYN-33441" }],
    discrepancies: [
      { type: "warning", message: "Partial shipment cleared: Delivered and billed 600 of 1,000 crates ordered. (Remaining: 400)" }
    ]
  }
]

export default function ThreeWayMatchPage() {
  const { addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()
  const [selectedMatch, setSelectedMatch] = useState<MatchPreset>(PRESET_MATCHES[0])
  const [overrideReason, setOverrideReason] = useState("")
  const [isOverrideMode, setIsOverrideMode] = useState(false)
  const [matchLog, setMatchLog] = useState<Record<string, "Cleared" | "Overridden" | "Pending">>(() => {
    const initial: Record<string, any> = {}
    PRESET_MATCHES.forEach((p) => {
      initial[p.id] = p.status === "matched" ? "Cleared" : "Pending"
    })
    return initial
  })

  const handleSelect = (m: MatchPreset) => {
    setSelectedMatch(m)
    setIsOverrideMode(false)
    setOverrideReason("")
  }

  const clearForPayment = (presetId: string) => {
    setMatchLog((prev) => ({ ...prev, [presetId]: "Cleared" }))
    addAuditLog(
      "3-WAY MATCH CLEARED",
      selectedMatch.poNum,
      `Fully matched & cleared PO: ${selectedMatch.poNum} for vendor ${selectedMatch.vendor}`
    )
  }

  const handleOverride = (presetId: string) => {
    if (!overrideReason.trim()) return
    setMatchLog((prev) => ({ ...prev, [presetId]: "Overridden" }))
    addAuditLog(
      "3-WAY MATCH OVERRIDDEN",
      selectedMatch.poNum,
      `Manually bypassed discrepancies for PO ${selectedMatch.poNum}. Reason: ${overrideReason}`
    )
    setIsOverrideMode(false)
    setOverrideReason("")
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 space-y-0.5">
        <h1 className="text-base font-bold font-mono uppercase tracking-wider">3-Way Matching Engine</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs">Verify Purchase Orders, Vendor Invoices, and Delivery Notes prior to treasury payment disbursements.</p>
      </div>

      {/* Preset Select Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRESET_MATCHES.map((p) => {
          const state = matchLog[p.id]
          return (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className={`p-3 text-left border flex flex-col justify-between h-20 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                selectedMatch.id === p.id ? `${accentBadge} font-semibold border-current` : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
              } ${cardRadius}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase">{p.poNum}</span>
                <span className={`px-1 py-0.2 text-[8px] font-mono uppercase border ${
                  state === "Cleared" || state === "Overridden"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                    : p.status === "discrepancy"
                    ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                    : "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                }`}>
                  {state === "Cleared" ? "Cleared" : state === "Overridden" ? "Overridden" : p.status}
                </span>
              </div>
              <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate mt-1">
                {p.vendor}
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison grid (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-6 ${cardRadius}`}>
            <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-900 pb-2">
              <GitCompare className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Three-Way Comparative Audit</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px]">
              {/* Box 1: PO */}
              <div className="p-3 border border-zinc-200 dark:border-zinc-900 space-y-3 bg-zinc-50/40 dark:bg-zinc-900/10">
                <span className="font-mono text-[9px] uppercase text-zinc-400 block font-bold border-b pb-1 dark:border-zinc-900">1. Purchase Order</span>
                <div className="space-y-2">
                  <div className="font-mono">
                    <span className="text-zinc-400">ID:</span> <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedMatch.poNum}</span>
                  </div>
                  {selectedMatch.poDetails.map((po, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-300">{po.item}</p>
                      <p className="font-mono text-zinc-500">Qty: {po.qty} @ KES {po.unitPrice}</p>
                      <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">Total: KES {po.total.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 2: Delivery Note */}
              <div className="p-3 border border-zinc-200 dark:border-zinc-900 space-y-3 bg-zinc-50/40 dark:bg-zinc-900/10">
                <span className="font-mono text-[9px] uppercase text-zinc-400 block font-bold border-b pb-1 dark:border-zinc-900">2. Delivery Note</span>
                <div className="space-y-2">
                  {selectedMatch.dnDetails.map((dn, i) => (
                    <div key={i} className="space-y-1">
                      <div className="font-mono">
                        <span className="text-zinc-400">Ref:</span> <span className="font-bold text-zinc-800 dark:text-zinc-200">{dn.ref}</span>
                      </div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-300">{dn.item}</p>
                      <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">Delivered: {dn.qty}</p>
                      <span className={`px-1 py-0.2 text-[8px] font-mono uppercase inline-block border ${
                        dn.qty === selectedMatch.poDetails[i]?.qty
                          ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                      }`}>
                        {dn.qty === selectedMatch.poDetails[i]?.qty ? "Full Delivery" : "Partial Delivery"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 3: Billed Invoice */}
              <div className="p-3 border border-zinc-200 dark:border-zinc-900 space-y-3 bg-zinc-50/40 dark:bg-zinc-900/10">
                <span className="font-mono text-[9px] uppercase text-zinc-400 block font-bold border-b pb-1 dark:border-zinc-900">3. Billed Invoice</span>
                <div className="space-y-2">
                  {selectedMatch.invDetails.map((inv, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-300">{inv.item}</p>
                      <p className="font-mono text-zinc-500">Qty: {inv.qty} @ KES {inv.unitPrice}</p>
                      <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">Total: KES {inv.total.toLocaleString()}</p>
                      <div className="pt-1 flex flex-col gap-1">
                        <span className={`px-1 py-0.2 text-[8px] font-mono uppercase inline-block text-center border ${
                          inv.qty === selectedMatch.dnDetails[i]?.qty
                            ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                        }`}>
                          Qty Match: {inv.qty === selectedMatch.dnDetails[i]?.qty ? "YES" : "NO"}
                        </span>
                        <span className={`px-1 py-0.2 text-[8px] font-mono uppercase inline-block text-center border ${
                          inv.unitPrice === selectedMatch.poDetails[i]?.unitPrice
                            ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                        }`}>
                          Price Match: {inv.unitPrice === selectedMatch.poDetails[i]?.unitPrice ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel (1 col) */}
        <div className="space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Matching Verdict</h3>

            {/* Verdict Alerts */}
            {selectedMatch.discrepancies.length === 0 ? (
              <div className="p-3 border border-emerald-200 bg-emerald-50/40 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/60 text-[11px] space-y-2">
                <div className="flex gap-2 items-center">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span className="font-bold font-mono text-[9px] uppercase">VERDICT: MATCHED_CLEARED</span>
                </div>
                <p className="leading-relaxed font-sans text-[11px]">
                  All items, unit values, delivery quantities, and billing numbers reconcile exactly. Cleared for immediate posting to Accounts Payable ledger.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedMatch.discrepancies.map((d, i) => (
                  <div
                    key={i}
                    className={`p-3 border text-[11px] space-y-2 ${
                      d.type === "error"
                        ? "bg-rose-50/40 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-950"
                        : "bg-amber-50/40 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-950"
                    }`}
                  >
                    <div className="flex gap-2 items-center">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span className="font-bold font-mono text-[9px] uppercase">
                        {d.type === "error" ? "VERDICT: DISCREPANCY_HOLD" : "VERDICT: CONDITION_WARN"}
                      </span>
                    </div>
                    <p className="leading-relaxed font-sans text-[11px]">{d.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reconciliation log state */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 uppercase">Current state:</span>
                <span className="font-bold uppercase text-zinc-800 dark:text-zinc-200">{matchLog[selectedMatch.id]}</span>
              </div>

              {matchLog[selectedMatch.id] === "Pending" ? (
                <div className="space-y-2 pt-1">
                  {selectedMatch.status === "matched" || selectedMatch.status === "partial" ? (
                    <button
                      onClick={() => clearForPayment(selectedMatch.id)}
                      className={`w-full py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-center ${accentBg} ${buttonRadius}`}
                    >
                      Approve & Clear Payment
                    </button>
                  ) : null}

                  {selectedMatch.status === "discrepancy" && !isOverrideMode && (
                    <button
                      onClick={() => setIsOverrideMode(true)}
                      className={`w-full py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-center border border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 ${buttonRadius}`}
                    >
                      Bypass & Override Hold
                    </button>
                  )}

                  {isOverrideMode && (
                    <div className="space-y-2 pt-1 border-t dark:border-zinc-900">
                      <label className="text-[9px] font-mono text-zinc-400 uppercase block">Override audit explanation (REQUIRED)</label>
                      <textarea
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono h-16 focus:outline-none focus:ring-1 focus:ring-rose-500 ${buttonRadius}`}
                        placeholder="e.g. Received business controller email approval to absorb shipping rate adjustments."
                        required
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setIsOverrideMode(false)}
                          className={`flex-1 py-1 text-center border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono uppercase text-zinc-500 ${buttonRadius}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleOverride(selectedMatch.id)}
                          disabled={!overrideReason.trim()}
                          className={`flex-1 py-1 text-center bg-rose-600 disabled:opacity-50 text-white hover:bg-rose-700 text-[10px] font-mono uppercase font-bold ${buttonRadius}`}
                        >
                          Force Post Override
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 border border-dashed text-zinc-400 text-center font-mono text-[9px] uppercase">
                  <Lock className="h-3.5 w-3.5 mx-auto mb-1 text-zinc-400" />
                  Transaction Locked (Audited)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
