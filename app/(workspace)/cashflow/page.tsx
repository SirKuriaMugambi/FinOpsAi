"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { TrendingUp, ArrowDown, ArrowUp, Zap, HelpCircle, CalendarRange } from "lucide-react"

export default function CashFlowPage() {
  const { invoices } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [collectionSpeed, setCollectionSpeed] = useState<"standard" | "accelerated" | "delayed">("standard")

  // Generate 90 days projection splits (12 weeks)
  const projections = useMemo(() => {
    let startingCash = 9270000 // KES reserves

    // Base collection modifiers
    let collectionsMultiplier = 1.0
    if (collectionSpeed === "accelerated") collectionsMultiplier = 1.12 // +12% collections due to prompt invoice clearing
    if (collectionSpeed === "delayed") collectionsMultiplier = 0.85 // Delayed certificate signoffs

    // Outstanding AR / AP totals
    const tradeCollectionsBase = [
      4000000, 3200000, 2800000, 4500000, 3800000, 2900000, 3100000, 4800000, 3900000, 4200000, 3500000, 4900000
    ]

    const supplierPaymentsBase = [
      1392000, 2500000, 800000, 1500000, 3000000, 1200000, 450000, 1800000, 2200000, 1100000, 1900000, 2800000
    ]

    const fixedWages = 126020 + 188720 + 119020 + 288820 // Payroll base

    let rollingCash = startingCash

    return tradeCollectionsBase.map((ar, index) => {
      const week = index + 1
      const collections = ar * collectionsMultiplier
      // Every 4th week add a payroll cycle payment
      const payrollCycle = week % 4 === 0 ? fixedWages : 0
      const payments = supplierPaymentsBase[index] + payrollCycle
      const netChange = collections - payments
      rollingCash += netChange

      return {
        week: `Week ${week}`,
        collections,
        payments,
        netChange,
        endingCash: rollingCash,
        isShortfall: rollingCash < 2000000 // Flag alarm if bank balance drops below safety ceiling
      }
    })
  }, [collectionSpeed])

  const stats = useMemo(() => {
    const finalBalance = projections[projections.length - 1].endingCash
    const totalCollections = projections.reduce((sum, p) => sum + p.collections, 0)
    const totalPayments = projections.reduce((sum, p) => sum + p.payments, 0)
    const averageNet = projections.reduce((sum, p) => sum + p.netChange, 0) / projections.length

    return { finalBalance, totalCollections, totalPayments, averageNet }
  }, [projections])

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">90-Day Cash Flow Forecaster</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Simulate liquid flower revenue cash reserves, AP statements schedules, and wage payroll cycles.</p>
        </div>

        {/* Collection Speed Sim Controls */}
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-zinc-400" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Speed Sim:</span>
          <div className="flex border rounded-none p-0.5 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            {[
              { id: "standard", name: "Standard" },
              { id: "accelerated", name: "Fast (+10d)" },
              { id: "delayed", name: "Delayed (-15d)" }
            ].map((speed) => (
              <button
                key={speed.id}
                onClick={() => setCollectionSpeed(speed.id as any)}
                className={`px-2 py-1 text-[10px] font-mono uppercase font-semibold ${
                  collectionSpeed === speed.id
                    ? `${accentBadge} font-bold`
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                } ${buttonRadius}`}
              >
                {speed.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aggregate Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px]">
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Total Simulated Collections</span>
          <span className="text-base font-bold font-mono text-emerald-600">KES {stats.totalCollections.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-rose-500">Total Scheduled Disbursals</span>
          <span className="text-base font-bold font-mono text-rose-500">KES {stats.totalPayments.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Net Average Weekly Change</span>
          <span className={`text-base font-bold font-mono ${stats.averageNet >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
            KES {stats.averageNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Projected Ending Cash (90d)</span>
          <span className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">KES {stats.finalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[11px]">
        {/* Waterfall table (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
              <CalendarRange className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">12-Week Rolling Waterfall Projection</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2">Horizon</th>
                    <th className="py-2 text-right">Inward Receipts</th>
                    <th className="py-2 text-right">Outward Payments</th>
                    <th className="py-2 text-right">Net Weekly Change</th>
                    <th className="py-2 text-right">Ending Bank Cash</th>
                    <th className="py-2 text-center">Safety Ceiling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {projections.map((p) => (
                    <tr key={p.week} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 ${p.isShortfall ? "bg-rose-50/5" : ""}`}>
                      <td className="py-3 font-mono font-bold text-zinc-700 dark:text-zinc-300">{p.week}</td>
                      <td className="py-3 text-right font-mono text-emerald-600">+{p.collections.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-3 text-right font-mono text-rose-500">-{p.payments.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className={`py-3 text-right font-mono font-semibold ${p.netChange >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {p.netChange >= 0 ? "+" : ""}
                        {p.netChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">
                        KES {p.endingCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                          p.isShortfall
                            ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse"
                            : "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                        }`}>
                          {p.isShortfall ? "Low Cash Reserve" : "Stable"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Informative advice (1 col) */}
        <div className="space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3.5 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Projection Parameters</h3>

            <div className="space-y-3 font-sans text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              <div className="flex gap-2">
                <HelpCircle className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
                <p>
                  <strong>Simulating Acceleration:</strong> Select "Fast (+10d)" to simulate cash changes when customers submit local iTax WHT certificates prompt, allowing immediate VAT offset clearances.
                </p>
              </div>
              <div className="flex gap-2">
                <ArrowDown className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <p>
                  <strong>Safety Cash Ceiling:</strong> Chrysal corporate targets a liquid cash balance ceiling of <strong>KES 2,000,000</strong> to buffer operations. Any weekly drop triggers warning flags.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
