"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import {
  FileText,
  Percent,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ShieldCheck,
  Building,
  ArrowRight,
  Wallet,
  Hourglass,
} from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { invoices, whtPayments, checklist, auditTrail, vendors } = useFinOps()
  const { cardRadius, buttonRadius, accentText, accentBg, accentBadge } = useTheme()

  // Payroll data lives outside FinOpsProvider (see app/(workspace)/payroll/page.tsx —
  // it's Supabase-backed via /api/payroll, not the provider's local state), so the
  // dashboard fetches it independently, same pattern as the payroll page itself.
  const payrollMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const [payrollHeadcount, setPayrollHeadcount] = useState(0)
  const [payrollRunStatus, setPayrollRunStatus] = useState<string | null>(null)
  // /api/payroll is finance_manager-only (payroll is salary/PII data) — a
  // 403 here means "not your role", not "no run yet". Tracked separately so
  // the cards below don't show a misleading empty state for other roles.
  const [payrollRestricted, setPayrollRestricted] = useState(false)

  useEffect(() => {
    let ignore = false
    fetch(`/api/payroll?month=${payrollMonth}`)
      .then(async (r) => {
        if (r.status === 403) return { restricted: true }
        return r.ok ? r.json() : null
      })
      .then((payload) => {
        if (ignore || !payload) return
        if (payload.restricted) {
          setPayrollRestricted(true)
          return
        }
        setPayrollHeadcount(Array.isArray(payload.employees) ? payload.employees.length : 0)
        setPayrollRunStatus(payload.run?.status ?? null)
      })
      .catch(() => {
        if (!ignore) {
          setPayrollHeadcount(0)
          setPayrollRunStatus(null)
        }
      })
    return () => { ignore = true }
  }, [payrollMonth])

  // Payroll statutory remittance deadline — PAYE/NSSF/SHIF/AHL are due by the
  // 9th of the month FOLLOWING the pay month, distinct from the 20th-of-month
  // VAT/WHT deadline computed below (kraDeadlineStats) — different tax, different date.
  const payrollDeadlineStats = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const deadline = new Date(currentYear, currentMonth, 9, 23, 59, 59)
    let daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysRemaining < 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
      const nextDeadline = new Date(nextYear, nextMonth, 9, 23, 59, 59)
      daysRemaining = Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    let status: "urgent" | "warning" | "secure" = "secure"
    if (daysRemaining <= 2) status = "urgent"
    else if (daysRemaining <= 5) status = "warning"

    const formattedDeadline = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return { daysRemaining, status, formattedDeadline }
  }, [])

  // 1. Calculations
  const invoiceStats = useMemo(() => {
    let totalValueKES = 0
    let count = 0
    let readyToPost = 0
    let flaggedReview = 0

    invoices.forEach((inv) => {
      count++
      // Convert to KES
      const rate = inv.kra_rate || (inv.currency === "USD" ? 129.5 : inv.currency === "EUR" ? 140.2 : 1.0)
      const valueKES = inv.total * (inv.currency === "KES" ? 1 : rate)
      totalValueKES += valueKES

      if (inv.status === "Approved" || inv.status === "Posted") {
        readyToPost++
      } else {
        flaggedReview++
      }
    })

    return { totalValueKES, count, readyToPost, flaggedReview }
  }, [invoices])

  const totalWhtKES = useMemo(() => {
    return whtPayments.reduce((sum, pay) => sum + pay.wht_amount, 0)
  }, [whtPayments])

  // 2. KRA Deadline Calculation (20th of current month in Nairobi timezone)
  const kraDeadlineStats = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed

    // Nairobi deadline is 20th of the month
    const deadline = new Date(currentYear, currentMonth, 20, 23, 59, 59)
    let daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // If past 20th, set to 20th of next month
    if (daysRemaining < 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
      const nextDeadline = new Date(nextYear, nextMonth, 20, 23, 59, 59)
      daysRemaining = Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    let status: "urgent" | "warning" | "secure" = "secure"
    if (daysRemaining <= 3) status = "urgent"
    else if (daysRemaining <= 7) status = "warning"

    const formattedDeadline = deadline.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })

    return { daysRemaining, status, formattedDeadline }
  }, [])

  // 3. Outstanding AP by Vendor
  const apOutstanding = useMemo(() => {
    const outstanding: Record<string, number> = {}
    vendors.forEach(v => { outstanding[v.name] = 0 })

    invoices.forEach((inv) => {
      if (inv.status !== "Posted") { // Unpaid/Outstanding
        const rate = inv.kra_rate || (inv.currency === "USD" ? 129.5 : 1.0)
        outstanding[inv.vendor_name] = (outstanding[inv.vendor_name] || 0) + (inv.total * (inv.currency === "KES" ? 1 : rate))
      }
    })

    return Object.entries(outstanding)
      .map(([name, val]) => ({ name, value: val }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [invoices, vendors])

  // 4. Checklist Progress
  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0
    const completed = checklist.filter((item) => item.status === "Complete").length
    return Math.round((completed / checklist.length) * 100)
  }, [checklist])

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`p-6 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${cardRadius}`}>
        <div className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">Financial Operations Command Center</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Chrysal Africa Ltd — Cut flower processing and export metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">KRA TIMS INTEGRATION STATUS: ONLINE</span>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Invoices */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Processed Invoices</span>
            <FileText className={`h-4 w-4 ${accentText}`} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
              {invoiceStats.count} <span className="text-xs font-normal text-zinc-400">items</span>
            </span>
            <p className="text-zinc-400 text-[10px] mt-1 font-mono">
              Total: KES {invoiceStats.totalValueKES.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Metric 2: WHT Withheld */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Withholding Tax (WHT)</span>
            <Percent className={`h-4 w-4 ${accentText}`} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
              KES {totalWhtKES.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <p className="text-zinc-400 text-[10px] mt-1 font-mono">
              Pending KRA Bulk Remittance
            </p>
          </div>
        </div>

        {/* Metric 3: KRA iTax Close Deadline */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">KRA iTax Close Countdown</span>
            <Clock className={`h-4 w-4 ${kraDeadlineStats.status === "urgent" ? "text-rose-500 animate-pulse" : kraDeadlineStats.status === "warning" ? "text-amber-500" : accentText}`} />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
                {kraDeadlineStats.daysRemaining}
              </span>
              <span className="text-xs font-normal text-zinc-400">days left</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-zinc-400 text-[9px] font-mono">Deadline: {kraDeadlineStats.formattedDeadline}</span>
              <span className={`px-1 py-0.2 text-[8px] font-mono uppercase border ${
                kraDeadlineStats.status === "urgent"
                  ? "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                  : kraDeadlineStats.status === "warning"
                  ? "bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
              }`}>
                {kraDeadlineStats.status}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4: Month-End Progress */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Month-End Close Checklist</span>
            <CheckCircle className={`h-4 w-4 ${accentText}`} />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
                {checklistProgress}%
              </span>
              <span className="text-xs font-normal text-zinc-400">completed</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 mt-2 overflow-hidden" style={{ borderRadius: cardRadius === "sharp" ? "0" : "999px" }}>
              <div
                className={`h-full ${accentBg} transition-all duration-300`}
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payroll KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Payroll Progress */}
        {payrollRestricted ? (
          <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payroll Progress</span>
              <Wallet className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
            </div>
            <p className="text-zinc-400 text-[10px] font-mono uppercase">Finance Manager only</p>
          </div>
        ) : (
          <Link href="/payroll" className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors ${cardRadius}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payroll Progress</span>
              <Wallet className={`h-4 w-4 ${accentText}`} />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
                {payrollHeadcount} <span className="text-xs font-normal text-zinc-400">staff</span>
              </span>
              <p className="text-zinc-400 text-[10px] mt-1 font-mono uppercase">
                Status: {payrollRunStatus ?? "No run yet"} — {payrollMonth}
              </p>
            </div>
          </Link>
        )}

        {/* Pending Approvals */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Pending Approvals</span>
            <Hourglass className={`h-4 w-4 ${payrollRunStatus === "Submitted" ? "text-amber-500" : accentText}`} />
          </div>
          {payrollRestricted ? (
            <p className="text-zinc-400 text-[10px] font-mono uppercase">Finance Manager only</p>
          ) : (
            <div>
              <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
                {payrollRunStatus === "Submitted" ? 1 : 0} <span className="text-xs font-normal text-zinc-400">runs</span>
              </span>
              <p className="text-zinc-400 text-[10px] mt-1 font-mono">
                {payrollRunStatus === "Submitted" ? `${payrollMonth} awaiting finance manager sign-off` : "Nothing awaiting sign-off"}
              </p>
            </div>
          )}
        </div>

        {/* Payroll Statutory Remittance Countdown */}
        <div className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-28 ${cardRadius}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payroll Remittance Countdown</span>
            <Clock className={`h-4 w-4 ${payrollDeadlineStats.status === "urgent" ? "text-rose-500 animate-pulse" : payrollDeadlineStats.status === "warning" ? "text-amber-500" : accentText}`} />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-100">
                {payrollDeadlineStats.daysRemaining}
              </span>
              <span className="text-xs font-normal text-zinc-400">days left</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-zinc-400 text-[9px] font-mono">PAYE/NSSF/SHIF/AHL by {payrollDeadlineStats.formattedDeadline}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AP Outstanding Breakdown */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Outstanding Accounts Payable (By Vendor)</h3>
              </div>
              <Link href="/ap-reconciliation" className={`text-[10px] font-mono ${accentText} hover:underline flex items-center gap-1`}>
                <span>Reconcile Ledger</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {apOutstanding.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 font-mono text-[10px]">
                No outstanding invoices. All bills fully paid and posted!
              </div>
            ) : (
              <div className="space-y-3">
                {apOutstanding.map((vendor) => {
                  const percentage = Math.round((vendor.value / invoiceStats.totalValueKES) * 100) || 5
                  return (
                    <div key={vendor.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{vendor.name}</span>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          KES {vendor.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2" style={{ borderRadius: cardRadius === "sharp" ? "0" : "999px" }}>
                        <div
                          className={`h-full ${accentBg}`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Upload Portal Callout & Actions */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4`}>
            <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3 flex flex-col justify-between ${cardRadius}`}>
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold">Invoice Extraction Hub</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-1 leading-relaxed">
                  Upload PDF or Excel invoices to initiate OCR, vendor matching, VAT compliance checks, and approval chains.
                </p>
              </div>
              <Link href="/invoice" className={`w-full py-1.5 text-center text-[10px] font-mono uppercase block ${accentBg} ${buttonRadius}`}>
                Extract New Invoice
              </Link>
            </div>

            <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3 flex flex-col justify-between ${cardRadius}`}>
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold">WHT Filing Agent (iTax)</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-1 leading-relaxed">
                  Bulk calculate withheld taxes, generate iTax compliant CSV files, and logs transactions into the immutable auditor history.
                </p>
              </div>
              <Link href="/wht-calculator" className={`w-full py-1.5 text-center text-[10px] font-mono uppercase block border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}>
                Manage KRA Filing
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (1 col) */}
        <div className="space-y-6">
          {/* Invoice Compliance Status breakdown */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-5 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold border-b border-zinc-150 dark:border-zinc-900 pb-2">Compliance Review Status</h3>

            <div className="flex flex-col items-center py-2 space-y-4">
              {/* Minimalist SVG Circle Chart */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background track */}
                  <circle className="text-zinc-100 dark:text-zinc-900" strokeWidth="2.5" stroke="currentColor" fill="none" r="16" cx="18" cy="18" />

                  {/* Dynamic Ring */}
                  {invoiceStats.count > 0 && (
                    <circle
                      className={accentText}
                      strokeWidth="2.5"
                      strokeDasharray={`${(invoiceStats.readyToPost / invoiceStats.count) * 100} 100`}
                      strokeLinecap="square"
                      stroke="currentColor"
                      fill="none"
                      r="16"
                      cx="18"
                      cy="18"
                    />
                  )}
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-50">
                    {invoiceStats.readyToPost}
                  </span>
                  <span className="text-[8px] text-zinc-400 font-mono uppercase">Ready / Posted</span>
                </div>
              </div>

              {/* Status Labels */}
              <div className="w-full space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-zinc-900 dark:bg-zinc-100" />
                    <span>Cleared for Posting</span>
                  </div>
                  <span className="font-mono font-semibold">{invoiceStats.readyToPost}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-zinc-500">Flagged / Pending Review</span>
                  </div>
                  <span className="font-mono font-semibold text-zinc-500">{invoiceStats.flaggedReview}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log Mini-widget */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3 ${cardRadius}`}>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-900">
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Latest Audit Logs</h3>
              <Link href="/audit-trail" className="text-[10px] text-zinc-400 hover:underline font-mono">View All</Link>
            </div>

            <div className="space-y-3">
              {auditTrail.slice(0, 3).map((log) => (
                <div key={log.id} className="text-[10px] space-y-0.5 border-b border-zinc-100 dark:border-zinc-900/60 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-zinc-400 font-mono text-[9px]">
                    <span>{log.user}</span>
                    <span>{log.timestamp.substring(11, 16)}</span>
                  </div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">{log.action}</div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[10px] leading-tight line-clamp-1">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
