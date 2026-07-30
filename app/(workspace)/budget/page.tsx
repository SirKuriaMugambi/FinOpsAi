"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { PieChart, ArrowUpRight, ArrowDownRight, CheckCircle, AlertTriangle, Filter } from "lucide-react"

export default function BudgetPage() {
  const { budgets, invoices } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [costCentreFilter, setCostCentreFilter] = useState("All")

  // Recalculate actual expense sums based on currently uploaded & posted invoices!
  const computedBudgets = useMemo(() => {
    return budgets.map((b) => {
      // Find invoices matching cost centre and ledger account
      const matchedInvoices = invoices.filter(
        (inv) => inv.cost_centre === b.cost_centre && inv.gl_account.includes(b.gl_account.split(" ")[0])
      )

      // Sum subtotal in KES
      const actualSum = matchedInvoices.reduce((sum, inv) => {
        const rate = inv.kra_rate || (inv.currency === "USD" ? 129.5 : 1.0)
        return sum + (inv.subtotal * (inv.currency === "KES" ? 1 : rate))
      }, 0)

      // If we don't have invoices for this budget item yet, fallback to the seeded actual to prevent "empty" visuals
      const actualAmount = actualSum > 0 ? actualSum : b.actual_amount
      const variance = b.budget_amount - actualAmount
      const percentageUsed = Math.round((actualAmount / b.budget_amount) * 100)

      return {
        ...b,
        actual_amount: actualAmount,
        variance,
        percentageUsed,
        status: variance >= 0 ? ("Favorable" as const) : ("Unfavorable" as const),
        isOverLimit: percentageUsed > 110 // Trigger alarm if 10% over budget
      }
    })
  }, [budgets, invoices])

  const filteredBudgets = useMemo(() => {
    if (costCentreFilter === "All") return computedBudgets
    return computedBudgets.filter(b => b.cost_centre.includes(costCentreFilter))
  }, [computedBudgets, costCentreFilter])

  // Aggregate totals
  const aggregates = useMemo(() => {
    let totBudget = 0
    let totActual = 0

    filteredBudgets.forEach(b => {
      totBudget += b.budget_amount
      totActual += b.actual_amount
    })

    const totVariance = totBudget - totActual
    const totPercentage = totBudget > 0 ? Math.round((totActual / totBudget) * 100) : 0

    return { totBudget, totActual, totVariance, totPercentage }
  }, [filteredBudgets])

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Budget vs Actual Analytics</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Analyze departmental spending thresholds against approved corporate capital allocations.</p>
        </div>

        {/* Cost centre filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={costCentreFilter}
            onChange={(e) => setCostCentreFilter(e.target.value)}
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none ${buttonRadius}`}
          >
            <option value="All">All Cost Centres</option>
            <option value="511">511 (Production / OPS)</option>
            <option value="121">121 (Finance / FIN)</option>
          </select>
        </div>
      </div>

      {/* Aggregate Overview Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Aggregated Budget Caps</span>
          <span className="text-base font-bold font-mono text-zinc-800 dark:text-zinc-100">KES {aggregates.totBudget.toLocaleString()}</span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Ledger Expensed Actuals</span>
          <span className="text-base font-bold font-mono text-zinc-850 dark:text-zinc-150">KES {aggregates.totActual.toLocaleString()} ({aggregates.totPercentage}%)</span>
        </div>
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Combined variance</span>
          <span className={`text-base font-bold font-mono ${aggregates.totVariance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            KES {aggregates.totVariance.toLocaleString()} {aggregates.totVariance >= 0 ? "FAV" : "UNFAV"}
          </span>
        </div>
      </div>

      {/* Budgets Comparative table */}
      <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
        <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
          <PieChart className="h-4 w-4 text-zinc-400" />
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Capital Allocation Auditing Ledger</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                <th className="py-2">Cost Centre & Account</th>
                <th className="py-2 text-right">Budget Limit</th>
                <th className="py-2 text-right">Actual Expense</th>
                <th className="py-2 text-right">Variance</th>
                <th className="py-2 text-center">Usage %</th>
                <th className="py-2 text-center">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
              {filteredBudgets.map((b) => {
                const isFavorable = b.status === "Favorable"
                return (
                  <tr key={b.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 ${b.isOverLimit ? "bg-rose-50/10 dark:bg-rose-950/5" : ""}`}>
                    <td className="py-3">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{b.gl_account}</p>
                      <span className="text-[9px] text-zinc-400 font-mono uppercase">Centre: {b.cost_centre}</span>
                    </td>
                    <td className="py-3 text-right font-mono font-medium">
                      KES {b.budget_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      KES {b.actual_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`py-3 text-right font-mono font-semibold ${isFavorable ? "text-emerald-600" : "text-rose-500"}`}>
                      {isFavorable ? "+" : ""}
                      {b.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono font-bold">{b.percentageUsed}%</span>
                        <div className="w-16 bg-zinc-100 dark:bg-zinc-900 h-1 overflow-hidden" style={{ borderRadius: cardRadius === "sharp" ? "0" : "999px" }}>
                          <div
                            className={`h-full ${b.isOverLimit ? "bg-rose-600" : isFavorable ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(100, b.percentageUsed)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                        b.isOverLimit
                          ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 animate-pulse font-bold"
                          : isFavorable
                          ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                      }`}>
                        {b.isOverLimit ? "🚨 Alarmed_Overrun" : isFavorable ? "Favorable" : "Variance_Warn"}
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
  )
}
