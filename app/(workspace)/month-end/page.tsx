"use client"

import React, { useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { CheckSquare, CheckCircle, Clock, AlertTriangle, PlayCircle, ToggleLeft } from "lucide-react"

export default function MonthEndPage() {
  const { checklist, updateChecklistItem, currentUser } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  // Progress stats
  const progressStats = useMemo(() => {
    const total = checklist.length
    if (total === 0) return { percent: 0, completed: 0, pending: 0, inProgress: 0 }
    const completed = checklist.filter(c => c.status === "Complete").length
    const inProgress = checklist.filter(c => c.status === "In Progress").length
    const pending = total - completed - inProgress
    return {
      percent: Math.round((completed / total) * 100),
      completed,
      pending,
      inProgress
    }
  }, [checklist])

  const handleStatusChange = (id: string, nextStatus: typeof checklist[0]["status"]) => {
    updateChecklistItem(id, nextStatus, nextStatus === "Complete" ? currentUser : null)
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Month-End close checklist</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Standardize and track financial closing sequences across operations for corporate management auditing.</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 bg-white dark:bg-zinc-950 border px-3 py-1.5">
          <span>PERIOD CLOSE: JUNE 2026</span>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progress Gauge */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Close Progress Percentage</span>
          <div className="space-y-1.5">
            <span className="text-base font-bold font-mono text-zinc-850 dark:text-zinc-150">{progressStats.percent}% Complete</span>
            <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1 overflow-hidden" style={{ borderRadius: cardRadius === "sharp" ? "0" : "999px" }}>
              <div className={`h-full ${accentBg} transition-all`} style={{ width: `${progressStats.percent}%` }} />
            </div>
          </div>
        </div>

        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-emerald-600">Tasks Reconciled</span>
          <span className="text-base font-bold font-mono text-emerald-600">{progressStats.completed} completed</span>
        </div>

        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-amber-500">In Progress Audits</span>
          <span className="text-base font-bold font-mono text-amber-500">{progressStats.inProgress} in progress</span>
        </div>

        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
          <span className="text-[9px] font-mono uppercase text-zinc-400">Pending Actions</span>
          <span className="text-base font-bold font-mono text-zinc-500">{progressStats.pending} waiting</span>
        </div>
      </div>

      {/* Checklist Table */}
      <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
        <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
          <CheckSquare className="h-4 w-4 text-zinc-400" />
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Month Close Operations Roster</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                <th className="py-2">Task Sequence Detail</th>
                <th className="py-2">Assigned Lead</th>
                <th className="py-2 text-center">Status</th>
                <th className="py-2 text-center font-mono">Date Signoff</th>
                <th className="py-2 text-center">Authorized Sign</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
              {checklist.map((item) => {
                const isComplete = item.status === "Complete"
                return (
                  <tr key={item.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 ${isComplete ? "opacity-75" : ""}`}>
                    <td className="py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                      <p>{item.task}</p>
                      <span className="text-[9px] text-zinc-400 font-mono uppercase">ID: {item.id}</span>
                    </td>
                    <td className="py-3 font-mono text-zinc-500">{item.assigned_to}</td>
                    <td className="py-3 text-center">
                      <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                        isComplete
                          ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : item.status === "In Progress"
                          ? "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                          : item.status === "On Hold"
                          ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 text-center font-mono text-zinc-400">{item.completed_date || "-"}</td>
                    <td className="py-3 text-center font-mono text-zinc-500">{item.approver || "-"}</td>
                    <td className="py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                          className={`bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 text-[9px] font-mono focus:outline-none ${buttonRadius}`}
                        >
                          <option value="Pending">Set Pending</option>
                          <option value="In Progress">Set Active</option>
                          <option value="On Hold">Set Hold</option>
                          <option value="Complete">Set Signoff</option>
                        </select>
                      </div>
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
