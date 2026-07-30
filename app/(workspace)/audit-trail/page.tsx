"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { History, Search, Download, ShieldCheck, Filter } from "lucide-react"

export default function AuditTrailPage() {
  const { auditTrail } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [searchQuery, setSearchQuery] = useState("")
  const [userFilter, setUserFilter] = useState("All")
  const [actionFilter, setActionFilter] = useState("All")

  // Extract unique users and actions for filter options
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>()
    auditTrail.forEach(log => set.add(log.user))
    return ["All", ...Array.from(set)]
  }, [auditTrail])

  const uniqueActions = useMemo(() => {
    const set = new Set<string>()
    auditTrail.forEach(log => set.add(log.action))
    return ["All", ...Array.from(set)]
  }, [auditTrail])

  // Apply filters
  const filteredTrail = useMemo(() => {
    return auditTrail.filter((log) => {
      const matchesSearch =
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.document_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesUser = userFilter === "All" || log.user === userFilter
      const matchesAction = actionFilter === "All" || log.action === actionFilter

      return matchesSearch && matchesUser && matchesAction
    })
  }, [auditTrail, searchQuery, userFilter, actionFilter])

  const downloadAuditCSV = () => {
    let csvContent = "AuditID,Timestamp,User,Action,DocRef,Details,ValueKES\n"
    filteredTrail.forEach((log) => {
      csvContent += `"${log.id}","${log.timestamp}","${log.user}","${log.action}","${log.document_ref}","${log.details.replace(/"/g, '""')}",${log.amount || ""}\n`
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `FinOps_Audit_Trail_${new Date().toISOString().substring(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Immutable Compliance Audit Trail</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Append-only, permanent transaction logs tracking every financial action, user session, and document declassification.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadAuditCSV}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 ${buttonRadius}`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Security alert box */}
      <div className={`p-4 border border-emerald-200 bg-emerald-50/40 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/60 text-[11px] space-y-2 ${cardRadius}`}>
        <div className="flex gap-2 items-center">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Auditor cryptographic guarantee</span>
        </div>
        <p className="leading-relaxed font-sans">
          This log is cryptographically append-only. General ledger deletions do not wipe histories; they trigger corrective debit/credit offsets and are locked into this immutable ledger alongside operator identity stamps and local Nairobi times.
        </p>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Text Search */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search details, refs, log IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-[11px] focus:outline-none w-full font-mono"
          />
        </div>

        {/* User filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5 text-[11px] font-mono">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-400">User:</span>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-transparent border-none w-full focus:outline-none"
          >
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5 text-[11px] font-mono">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-400">Event:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-transparent border-none w-full focus:outline-none"
          >
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
        <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
          <History className="h-4 w-4 text-zinc-400" />
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Cryptographic Ledger Ledger</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                <th className="py-2">Log ID / Timestamp</th>
                <th className="py-2">Operator</th>
                <th className="py-2">Action Event Code</th>
                <th className="py-2">Document Ref</th>
                <th className="py-2">Audit Description Details</th>
                <th className="py-2 text-right">Associated Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
              {filteredTrail.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                  <td className="py-3 font-mono">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{log.id}</p>
                    <span className="text-[9px] text-zinc-400">{log.timestamp}</span>
                  </td>
                  <td className="py-3 font-semibold text-zinc-700 dark:text-zinc-300 font-mono">{log.user}</td>
                  <td className="py-3">
                    <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase border inline-block ${
                      log.action.includes("DELETED")
                        ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                        : log.action.includes("APPROVED") || log.action.includes("FILED") || log.action.includes("SECURED")
                        ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 font-mono font-medium text-zinc-500">{log.document_ref}</td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-400 max-w-xs sm:max-w-md leading-relaxed">{log.details}</td>
                  <td className="py-3 text-right font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {log.amount ? `KES ${log.amount.toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
