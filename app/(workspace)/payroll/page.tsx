"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import {
  Wallet, CheckCircle2, FileSpreadsheet, Eye, Printer,
  Download, Upload, ChevronDown, ChevronUp, Building2,
  Calculator, TrendingUp, Users, DollarSign, X, RotateCcw
} from "lucide-react"
import {
  computePayroll,
  buildGLPosting,
  buildCostCentreBreakdown,
  buildMasterRegisterCSV,
  buildGLPostingCSV,
  type EmployeeSummary,
} from "@/lib/payroll-engine"
import type { Employee } from "@/lib/seeds"

// ── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-KE", { maximumFractionDigits: 0 })
}
function fmtD(n: number) {
  return n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Derive a full EmployeeSummary from an Employee object
function toSummary(emp: Employee): EmployeeSummary {
  return {
    id: emp.id, name: emp.name, kra_pin: emp.kra_pin ?? "",
    cost_centre: emp.cost_centre ?? "121",
    gross_salary: emp.gross_salary ?? emp.base_salary + emp.allowances,
    net_paye: emp.net_paye ?? emp.paye,
    nssf_t1: emp.nssf_t1 ?? 420, nssf_t2: emp.nssf_t2 ?? 1740,
    shif: emp.shif ?? emp.nhif,
    ahl: emp.ahl ?? 0,
    defined_pension_ee: emp.defined_pension_ee ?? 0,
    defined_pension_er: emp.defined_pension_er ?? 0,
    helb: emp.helb ?? 0,
    company_loan: emp.company_loan ?? 0,
    bank_loan: emp.bank_loan ?? 0,
    sacco: emp.sacco ?? 0,
    advances: emp.advances ?? 0,
    net_salary: emp.net_salary,
  }
}

// ── PAYE band visual helper ──────────────────────────────────────────────────
const BANDS = [
  { label: "≤ 24K", rate: "10%", range: "0 – 24,000" },
  { label: "24K–32K", rate: "25%", range: "24,001 – 32,333" },
  { label: "32K–500K", rate: "30%", range: "32,334 – 500,000" },
  { label: "500K–800K", rate: "32.5%", range: "500,001 – 800,000" },
  { label: "> 800K", rate: "35%", range: "800,001+" },
]

// ── PAYROLL ADD/EDIT FORM ────────────────────────────────────────────────────
interface EmployeeFormProps {
  initial?: Employee
  onSave: (emp: Employee) => void
  onCancel: () => void
  cardRadius: string
  buttonRadius: string
  accentBg: string
}
function EmployeeForm({ initial, onSave, onCancel, cardRadius, buttonRadius, accentBg }: EmployeeFormProps) {
  const blank: Partial<Employee> = {
    id: "", name: "", kra_pin: "", grade: "", cost_centre: "511", department: "Production",
    base_salary: 0, bonus_commission: 0, fringe_benefit: 0, transport_allowance: 0,
    arrears: 0, ot_other: 0, voluntary_pension: 0,
    advances: 0, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0,
  }
  const [form, setForm] = useState<Partial<Employee>>(initial ?? blank)

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    const num = ["base_salary","bonus_commission","fringe_benefit","transport_allowance",
                  "arrears","ot_other","voluntary_pension","advances","helb",
                  "company_loan","bank_loan","sacco"]
    setForm(f => ({ ...f, [name]: num.includes(name) ? parseFloat(value) || 0 : value }))
  }

  function save() {
    const inputs = {
      base_salary: form.base_salary ?? 0,
      bonus_commission: form.bonus_commission ?? 0,
      fringe_benefit: form.fringe_benefit ?? 0,
      transport_allowance: form.transport_allowance ?? 0,
      arrears: form.arrears ?? 0,
      ot_other: form.ot_other ?? 0,
      voluntary_pension: form.voluntary_pension ?? 0,
      advances: form.advances ?? 0,
      helb: form.helb ?? 0,
      company_loan: form.company_loan ?? 0,
      bank_loan: form.bank_loan ?? 0,
      sacco: form.sacco ?? 0,
    }
    const computed = computePayroll(inputs)
    const full: Employee = {
      id: form.id ?? "", name: form.name ?? "", kra_pin: form.kra_pin ?? "",
      grade: form.grade ?? "", cost_centre: form.cost_centre ?? "511",
      department: form.department ?? "Production",
      ...inputs, ...computed,
    }
    onSave(full)
  }

  const F = ({ label, name: n, type = "number" }: { label: string; name: string; type?: string }) => (
    <div className="space-y-0.5">
      <label className="text-[9px] font-mono uppercase text-zinc-400">{label}</label>
      <input
        name={n} type={type}
        value={(form as Record<string, unknown>)[n] as string ?? ""}
        onChange={handle}
        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 rounded"
      />
    </div>
  )

  return (
    <div className={`p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider font-bold">
          {initial ? "Edit Employee" : "Add Employee"}
        </h3>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <F label="Staff No" name="id" type="text" />
        <F label="Name" name="name" type="text" />
        <F label="KRA PIN" name="kra_pin" type="text" />
        <F label="Grade" name="grade" type="text" />
        <div className="space-y-0.5">
          <label className="text-[9px] font-mono uppercase text-zinc-400">Cost Centre</label>
          <select name="cost_centre" value={form.cost_centre ?? "511"} onChange={handle}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none rounded">
            <option value="121">121 — Finance</option>
            <option value="204">204 — Technical (TC)</option>
            <option value="205">205 — General Manager</option>
            <option value="206">206 — Technical Assistants</option>
            <option value="511">511 — Production</option>
            <option value="512">512 — Production-OH</option>
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-mono uppercase text-zinc-400">Department</label>
          <select name="department" value={form.department ?? "Production"} onChange={handle}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none rounded">
            <option>Finance</option>
            <option>Technical</option>
            <option>General Manager</option>
            <option>Production</option>
            <option>Production-OH</option>
          </select>
        </div>
      </div>

      <p className="text-[9px] font-mono uppercase text-zinc-400 pt-1 border-t dark:border-zinc-800">Earnings</p>
      <div className="grid grid-cols-2 gap-3">
        <F label="Basic Salary" name="base_salary" />
        <F label="Bonus / Commission" name="bonus_commission" />
        <F label="Fringe Benefit (FBT)" name="fringe_benefit" />
        <F label="Transport Allowance" name="transport_allowance" />
        <F label="Arrears" name="arrears" />
        <F label="OT / Other" name="ot_other" />
      </div>

      <p className="text-[9px] font-mono uppercase text-zinc-400 pt-1 border-t dark:border-zinc-800">Deductions (Post-Tax)</p>
      <div className="grid grid-cols-2 gap-3">
        <F label="Voluntary Pension" name="voluntary_pension" />
        <F label="Advances" name="advances" />
        <F label="HELB" name="helb" />
        <F label="Company Loan" name="company_loan" />
        <F label="Bank Loan" name="bank_loan" />
        <F label="SACCO" name="sacco" />
      </div>

      <p className="text-[9px] text-zinc-400 font-mono">
        Statutory items (NSSF, SHIF, AHL, PAYE) are computed automatically from earnings.
      </p>

      <div className="flex gap-2 pt-2">
        <button onClick={save} className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-wider font-bold ${accentBg} rounded`}>
          {initial ? "Update & Recalculate" : "Add & Calculate"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] uppercase rounded">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── PAYSLIP PANEL ────────────────────────────────────────────────────────────
function PayslipPanel({ emp, onClose, buttonRadius }: {
  emp: Employee; onClose: () => void; buttonRadius: string
}) {
  const rows: [string, string, string][] = [
    ["Basic Pay", `KES ${fmt(emp.base_salary)}`, ""],
    ...(emp.bonus_commission > 0 ? [["Bonus/Commission", `KES ${fmt(emp.bonus_commission)}`, ""] as [string,string,string]] : []),
    ...(emp.fringe_benefit > 0 ? [["Fringe Benefit (FBT)", `KES ${fmt(emp.fringe_benefit)}`, ""] as [string,string,string]] : []),
    ...(emp.transport_allowance > 0 ? [["Transport Allowance", `KES ${fmt(emp.transport_allowance)}`, ""] as [string,string,string]] : []),
    ...(emp.ot_other > 0 ? [["OT / Other", `KES ${fmt(emp.ot_other)}`, ""] as [string,string,string]] : []),
    ["", `GROSS: KES ${fmt(emp.gross_salary ?? 0)}`, ""],
    ["NSSF Tier I", `–KES ${fmt(emp.nssf_t1 ?? 420)}`, "deduction"],
    ["NSSF Tier II", `–KES ${fmt(emp.nssf_t2 ?? 1740)}`, "deduction"],
    ["SHIF (2.75%)", `–KES ${fmt(emp.shif ?? emp.nhif)}`, "deduction"],
    ["AHL/Housing Levy (1.5%)", `–KES ${fmt(emp.ahl ?? 0)}`, "deduction"],
    ["Pension EE (5%)", `–KES ${fmt(emp.defined_pension_ee ?? 0)}`, "deduction"],
    ["KRA PAYE", `–KES ${fmt(emp.net_paye ?? emp.paye)}`, "tax"],
    ...(emp.advances > 0 ? [["Salary Advance", `–KES ${fmt(emp.advances)}`, "deduction"] as [string,string,string]] : []),
    ...(emp.helb > 0 ? [["HELB", `–KES ${fmt(emp.helb)}`, "deduction"] as [string,string,string]] : []),
    ...(emp.company_loan > 0 ? [["Company Loan", `–KES ${fmt(emp.company_loan)}`, "deduction"] as [string,string,string]] : []),
    ...(emp.bank_loan > 0 ? [["Bank Loan", `–KES ${fmt(emp.bank_loan)}`, "deduction"] as [string,string,string]] : []),
    ...(emp.sacco > 0 ? [["SACCO", `–KES ${fmt(emp.sacco)}`, "deduction"] as [string,string,string]] : []),
  ]

  function print() {
    window.print()
  }

  return (
    <div className="space-y-4 text-[11px]">
      <div className="flex justify-between items-center pb-2 border-b dark:border-zinc-900">
        <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase">Monthly Payslip</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
      </div>

      <div className="font-mono p-4 border border-zinc-150 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-3">
        <div className="text-center pb-2 border-b dark:border-zinc-800">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-50">CHRYSAL AFRICA LTD</h4>
          <span className="text-[9px] text-zinc-400">P.O. Box 44023-00100 Nairobi | Pay Month: {new Date().toLocaleString("en-KE", { month: "long", year: "numeric" })}</span>
        </div>

        <div className="text-[9px] space-y-0.5 text-zinc-500">
          <div><strong>Staff No:</strong> {emp.id}</div>
          <div><strong>Name:</strong> {emp.name}</div>
          <div><strong>KRA PIN:</strong> {emp.kra_pin ?? "—"}</div>
          <div><strong>Grade:</strong> {emp.grade} | <strong>Dept:</strong> {emp.department ?? "—"} | <strong>CC:</strong> {emp.cost_centre ?? "—"}</div>
        </div>

        <div className="border-t dark:border-zinc-800 pt-2 space-y-1 text-[10px]">
          {rows.map(([label, value, type], i) => (
            label === "" ? (
              <div key={i} className="flex justify-between font-bold border-t border-b dark:border-zinc-800 py-1 mt-1">
                <span>Gross Salary</span><span>{value.replace("GROSS: ", "")}</span>
              </div>
            ) : (
              <div key={i} className={`flex justify-between ${type === "tax" ? "text-rose-600" : type === "deduction" ? "text-rose-400" : ""}`}>
                <span>{label}</span><span>{value}</span>
              </div>
            )
          ))}
        </div>

        <div className="flex justify-between text-sm font-bold text-emerald-600 border-t dark:border-zinc-700 pt-2">
          <span>NET SALARY:</span>
          <span>KES {fmt(emp.net_salary)}</span>
        </div>

        {/* Tax breakdown mini */}
        <div className="text-[8px] text-zinc-400 border-t dark:border-zinc-800 pt-2 space-y-0.5">
          <div className="font-bold text-zinc-500 uppercase">PAYE Computation</div>
          <div className="flex justify-between"><span>Taxable Pay</span><span>KES {fmt(emp.taxable_pay ?? 0)}</span></div>
          <div className="flex justify-between"><span>Gross PAYE</span><span>KES {fmt(emp.gross_paye ?? 0)}</span></div>
          <div className="flex justify-between"><span>Less Personal Relief</span><span>–KES {fmt(emp.personal_relief ?? 2400)}</span></div>
          <div className="flex justify-between"><span>Less AHL Relief</span><span>–KES {fmt(emp.ahl_relief ?? 0)}</span></div>
          <div className="flex justify-between font-bold text-rose-500"><span>Net PAYE</span><span>KES {fmt(emp.net_paye ?? emp.paye)}</span></div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={print}
          className={`flex-1 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 ${buttonRadius}`}
        >
          <Printer className="h-3.5 w-3.5" /><span>Print Payslip</span>
        </button>
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
type Tab = "register" | "statutory" | "gl" | "calculator"

export default function PayrollPage() {
  const { addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("register")
  const [payrollSubmitted, setPayrollSubmitted] = useState(false)
  const [activeEmpIdx, setActiveEmpIdx] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [payMonth] = useState(() =>
    new Date().toLocaleString("en-KE", { month: "long", year: "numeric" })
  )

  // Calculator state
  const [calcInputs, setCalcInputs] = useState({
    basic: 0, bonus: 0, fbt: 0, transport: 0, arrears: 0, ot: 0,
    voluntary_pension: 0, advances: 0, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0
  })

  useEffect(() => {
    let ignore = false

    async function loadEmployees() {
      try {
        const response = await fetch("/api/payroll")
        if (!response.ok) {
          throw new Error("Unable to load employees")
        }

        const payload = (await response.json()) as { employees?: Employee[] }
        if (!ignore && Array.isArray(payload.employees)) {
          setEmployees(payload.employees)
        }
      } catch {
        if (!ignore) {
          setEmployees([])
        }
      } finally {
        if (!ignore) {
          setLoadingEmployees(false)
        }
      }
    }

    loadEmployees()
    return () => {
      ignore = true
    }
  }, [])

  // Aggregated data
  const summaries = useMemo(() => employees.map(toSummary), [employees])

  const totals = useMemo(() => {
    return employees.reduce((acc, emp) => {
      acc.headcount += 1
      acc.gross += emp.gross_salary ?? (emp.base_salary + emp.allowances)
      acc.nssf += (emp.nssf_t1 ?? 420) + (emp.nssf_t2 ?? 1740)
      acc.shif += emp.shif ?? emp.nhif
      acc.ahl += emp.ahl ?? 0
      acc.paye += emp.net_paye ?? emp.paye
      acc.pension_ee += emp.defined_pension_ee ?? 0
      acc.pension_er += emp.defined_pension_er ?? 0
      acc.deductions += emp.deductions
      acc.net += emp.net_salary
      return acc
    }, { headcount: 0, gross: 0, nssf: 0, shif: 0, ahl: 0, paye: 0, pension_ee: 0, pension_er: 0, deductions: 0, net: 0 })
  }, [employees])

  const glPosting = useMemo(() => buildGLPosting(summaries), [summaries])
  const ccBreakdown = useMemo(() => buildCostCentreBreakdown(summaries), [summaries])

  // Calculator result
  const calcResult = useMemo(() => {
    return computePayroll({
      base_salary: calcInputs.basic, bonus_commission: calcInputs.bonus,
      fringe_benefit: calcInputs.fbt, transport_allowance: calcInputs.transport,
      arrears: calcInputs.arrears, ot_other: calcInputs.ot,
      voluntary_pension: calcInputs.voluntary_pension,
      advances: calcInputs.advances, helb: calcInputs.helb,
      company_loan: calcInputs.company_loan, bank_loan: calcInputs.bank_loan,
      sacco: calcInputs.sacco,
    })
  }, [calcInputs])

  function toggleRow(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function submitPayroll() {
    try {
      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: new Date().toISOString().slice(0, 7),
          employees,
        }),
      })

      if (!response.ok) {
        throw new Error("Payroll save failed")
      }

      const payload = (await response.json()) as { month?: string }
      setPayrollSubmitted(true)
      addAuditLog(
        "PAYROLL POSTED",
        payload.month ?? "Statutory PAYE/NSSF/AHL Ledger Run",
        `Tony approved and posted monthly payroll for ${employees.length} staff. GL posting summary exported. AHL: ${fmt(totals.ahl)}, NSSF: ${fmt(totals.nssf)}, PAYE: ${fmt(totals.paye)}.`,
        totals.gross
      )
    } catch {
      addAuditLog(
        "PAYROLL POST FAILED",
        "Statutory PAYE/NSSF/AHL Ledger Run",
        `Payroll submission attempt failed for ${employees.length} staff. Please verify the Supabase-backed payroll API is available.`,
        totals.gross
      )
    }
  }

  function handleExportRegister() {
    const csv = buildMasterRegisterCSV(summaries)
    downloadCSV(csv, `chrysal-payroll-register-${payMonth.replace(" ", "-")}.csv`)
  }

  function handleExportGL() {
    const csv = buildGLPostingCSV(glPosting, payMonth)
    downloadCSV(csv, `chrysal-ax-gl-posting-${payMonth.replace(" ", "-")}.csv`)
  }

  function handleSaveEmployee(emp: Employee) {
    setEmployees((prev) => {
      const updated = prev.some((entry) => entry.id === emp.id)
        ? prev.map((entry) => (entry.id === emp.id ? emp : entry))
        : [...prev, emp]

      return updated
    })
    setShowAddForm(false)
    setEditIdx(null)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "register", label: "Payroll Register", icon: <Wallet className="h-3.5 w-3.5" /> },
    { id: "statutory", label: "Statutory Summary", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: "gl", label: "AX GL Posting", icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "calculator", label: "PAYE Calculator", icon: <Calculator className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Payroll &amp; Statutory Compliance</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-2xl">
            Automate monthly payroll using KRA PAYE graduated slabs, NSSF Tier I/II, SHIF (2.75%), and AHL (1.5%). Generate downloadable AX GL posting summary matching Chrysal&apos;s ERP format.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!payrollSubmitted ? (
            <button
              onClick={submitPayroll}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approve &amp; Post</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] border border-emerald-200 bg-emerald-50/20 px-2 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>POSTED TO LEDGER</span>
            </span>
          )}
          <button
            onClick={handleExportRegister}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
          >
            <Download className="h-3.5 w-3.5" /><span>Export Register</span>
          </button>
          <button
            onClick={handleExportGL}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /><span>Export AX GL</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Headcount", value: totals.headcount.toString(), sub: "Active Staff", color: "" },
          { label: "Total Gross", value: `KES ${fmt(totals.gross)}`, sub: "This Month", color: "" },
          { label: "Net PAYE", value: `KES ${fmt(totals.paye)}`, sub: "KRA Liability", color: "text-rose-600" },
          { label: "NSSF (EE)", value: `KES ${fmt(totals.nssf)}`, sub: "T1 + T2", color: "" },
          { label: "SHIF", value: `KES ${fmt(totals.shif)}`, sub: "2.75%", color: "" },
          { label: "Net Disbursed", value: `KES ${fmt(totals.net)}`, sub: "Cash to Staff", color: "text-emerald-600" },
        ].map(card => (
          <div key={card.label} className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-20 ${cardRadius}`}>
            <span className="text-[9px] font-mono uppercase text-zinc-400">{card.label}</span>
            <span className={`text-sm font-bold font-mono ${card.color || "text-zinc-800 dark:text-zinc-100"}`}>{card.value}</span>
            <span className="text-[8px] text-zinc-400 font-mono">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-900 flex gap-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-zinc-800 dark:border-zinc-200 text-zinc-800 dark:text-zinc-200"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Payroll Register ──────────────────────────────────────────────── */}
      {activeTab === "register" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-mono uppercase tracking-wider font-bold">Employee Payroll Register — {payMonth}</span>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className={`px-2.5 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
            >
              <Upload className="h-3.5 w-3.5" /><span>Add Employee</span>
            </button>
          </div>

          {loadingEmployees && (
            <div className="text-[10px] font-mono uppercase text-zinc-400">Loading payroll data from Supabase…</div>
          )}

          {showAddForm && (
            <EmployeeForm
              onSave={handleSaveEmployee}
              onCancel={() => setShowAddForm(false)}
              cardRadius={cardRadius}
              buttonRadius={buttonRadius}
              accentBg={accentBg}
            />
          )}

          {editIdx !== null && (
            <EmployeeForm
              initial={employees[editIdx]}
              onSave={handleSaveEmployee}
              onCancel={() => setEditIdx(null)}
              cardRadius={cardRadius}
              buttonRadius={buttonRadius}
              accentBg={accentBg}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Register table */}
            <div className={`lg:col-span-2 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 overflow-hidden ${cardRadius}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                      <th className="px-4 py-2.5"></th>
                      <th className="px-4 py-2.5">Staff</th>
                      <th className="px-4 py-2.5 text-right">Basic</th>
                      <th className="px-4 py-2.5 text-right">Gross</th>
                      <th className="px-4 py-2.5 text-right">Net PAYE</th>
                      <th className="px-4 py-2.5 text-right">Total Ded.</th>
                      <th className="px-4 py-2.5 text-right">Net Pay</th>
                      <th className="px-4 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                    {employees.map((emp, idx) => {
                      const expanded = expandedRows.has(idx)
                      return (
                        <React.Fragment key={emp.id}>
                          <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                            <td className="px-2 py-3">
                              <button onClick={() => toggleRow(idx)} className="text-zinc-400 hover:text-zinc-600">
                                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{emp.name}</p>
                              <span className="text-[9px] text-zinc-400 font-mono">
                                {emp.id} · CC {emp.cost_centre ?? "—"} · {emp.grade}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{fmt(emp.base_salary)}</td>
                            <td className="px-4 py-3 text-right font-mono">{fmt(emp.gross_salary ?? 0)}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-500">–{fmt(emp.net_paye ?? emp.paye)}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-400">–{fmt(emp.deductions)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{fmt(emp.net_salary)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { setActiveEmpIdx(idx); setEditIdx(null) }}
                                  className={`p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
                                  title="View payslip"
                                >
                                  <Eye className="h-3.5 w-3.5 text-zinc-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-zinc-50/30 dark:bg-zinc-900/10">
                              <td colSpan={8} className="px-6 py-3">
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-[10px] font-mono">
                                  {[
                                    ["NSSF T1", `420`],
                                    ["NSSF T2", `1,740`],
                                    ["SHIF 2.75%", fmt(emp.shif ?? emp.nhif)],
                                    ["AHL 1.5%", fmt(emp.ahl ?? 0)],
                                    ["Pension EE 5%", fmt(emp.defined_pension_ee ?? 0)],
                                    ["Pension ER 10%", fmt(emp.defined_pension_er ?? 0)],
                                    ["Taxable Pay", fmt(emp.taxable_pay ?? 0)],
                                    ["Gross PAYE", fmt(emp.gross_paye ?? 0)],
                                    ["Personal Relief", "2,400"],
                                    ["AHL Relief", fmt(emp.ahl_relief ?? 0)],
                                    ["Net PAYE", fmt(emp.net_paye ?? emp.paye)],
                                    ["Advances", fmt(emp.advances ?? 0)],
                                    ["HELB", fmt(emp.helb ?? 0)],
                                    ["Company Loan", fmt(emp.company_loan ?? 0)],
                                    ["Bank Loan", fmt(emp.bank_loan ?? 0)],
                                    ["SACCO", fmt(emp.sacco ?? 0)],
                                  ].map(([l, v]) => (
                                    <div key={l}>
                                      <p className="text-[8px] uppercase text-zinc-400">{l}</p>
                                      <p className="text-zinc-700 dark:text-zinc-300">{v}</p>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-900 font-bold font-mono text-[10px]">
                      <td></td>
                      <td className="px-4 py-2.5 text-zinc-500 uppercase">Totals</td>
                      <td className="px-4 py-2.5 text-right">{fmt(employees.reduce((s,e) => s + e.base_salary, 0))}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(totals.gross)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-500">–{fmt(totals.paye)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-400">–{fmt(totals.deductions)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600">{fmt(totals.net)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payslip panel */}
            <div className={`border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-5 ${cardRadius}`}>
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2 mb-4">Payslip Terminal</h3>
              {activeEmpIdx === null ? (
                <div className="py-16 text-center text-zinc-400 font-mono text-[10px] uppercase">
                  Click the <Eye className="inline h-3 w-3" /> icon on a row to view the payslip.
                </div>
              ) : (
                <PayslipPanel
                  emp={employees[activeEmpIdx]}
                  onClose={() => setActiveEmpIdx(null)}
                  buttonRadius={buttonRadius}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Statutory Summary ─────────────────────────────────────────────── */}
      {activeTab === "statutory" && (
        <div className="space-y-6">
          {/* PAYE slab reference */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 ${cardRadius}`}>
            <div className="flex items-center gap-2 mb-4 border-b dark:border-zinc-900 pb-2">
              <TrendingUp className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">KRA PAYE Graduated Slabs (Monthly)</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {BANDS.map(band => (
                <div key={band.rate} className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 p-3 rounded text-center">
                  <div className="text-base font-bold font-mono text-zinc-800 dark:text-zinc-200">{band.rate}</div>
                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{band.range}</div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-zinc-400 font-mono mt-3">
              Personal Relief: KES 2,400/mo · AHL Relief applied at marginal rate · Source: KRA 2024 Tax Bands
            </p>
          </div>

          {/* Per-employee statutory detail */}
          <div className={`border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 overflow-hidden ${cardRadius}`}>
            <div className="px-5 py-3 border-b dark:border-zinc-900">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Statutory Deductions Breakdown — All Staff</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-400 font-mono text-[9px] uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-900">
                    <th className="px-4 py-2.5">Staff</th>
                    <th className="px-4 py-2.5 text-right">Gross</th>
                    <th className="px-4 py-2.5 text-right">NSSF T1</th>
                    <th className="px-4 py-2.5 text-right">NSSF T2</th>
                    <th className="px-4 py-2.5 text-right">SHIF 2.75%</th>
                    <th className="px-4 py-2.5 text-right">AHL 1.5%</th>
                    <th className="px-4 py-2.5 text-right">Pen. EE 5%</th>
                    <th className="px-4 py-2.5 text-right">Pen. ER 10%</th>
                    <th className="px-4 py-2.5 text-right">Net PAYE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 font-mono">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">{emp.name}</p>
                        <span className="text-[9px] text-zinc-400">{emp.id} · CC {emp.cost_centre ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.gross_salary ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.nssf_t1 ?? 420)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.nssf_t2 ?? 1740)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.shif ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.ahl ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(emp.defined_pension_ee ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500">{fmt(emp.defined_pension_er ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-500 font-bold">{fmt(emp.net_paye ?? emp.paye)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-900 font-bold font-mono text-[10px]">
                    <td className="px-4 py-2.5 text-zinc-500 uppercase">Totals</td>
                    <td className="px-4 py-2.5 text-right">{fmt(totals.gross)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(employees.length * 420)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(employees.length * 1740)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(totals.shif)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(totals.ahl)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(totals.pension_ee)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500">{fmt(totals.pension_er)}</td>
                    <td className="px-4 py-2.5 text-right text-rose-500">{fmt(totals.paye)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: AX GL Posting ────────────────────────────────────────────────── */}
      {activeTab === "gl" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GL Posting Summary — matching rows 174-183 format */}
            <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
              <div className="flex items-center justify-between border-b dark:border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold">AX GL Posting Summary</h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 ${accentBadge}`}>{payMonth}</span>
              </div>

              <div className="font-mono text-[11px] space-y-0">
                {/* Header */}
                <div className="flex justify-between text-[9px] uppercase text-zinc-400 border-b dark:border-zinc-800 pb-1.5 mb-1.5">
                  <span>Description</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48"><span>DR</span><span>CR</span></span>
                </div>
                {/* Salary expense DR */}
                <div className="flex justify-between py-1">
                  <span>Dr: Salary &amp; Wages Exp (41000)</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.gross_salaries)}</span><span className="text-zinc-400">—</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 text-zinc-500">
                  <span>Dr: AHL / Housing Levy (41770)</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.ahl_total)}</span><span className="text-zinc-400">—</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 text-zinc-500">
                  <span>Dr: NSSF Contributions (41770)</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.nssf_total)}</span><span className="text-zinc-400">—</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 text-zinc-500">
                  <span>Dr: NITA (41770)</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.nita_total)}</span><span className="text-zinc-400">—</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 text-zinc-500">
                  <span>Dr: Pension Fund EE (41800)</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.pension_total)}</span><span className="text-zinc-400">—</span>
                  </span>
                </div>

                {/* Credits */}
                <div className="border-t dark:border-zinc-800 pt-1.5 mt-1.5">
                  <div className="flex justify-between py-1 text-emerald-600">
                    <span>Cr: Net Salaries Payable (11500)</span>
                    <span className="grid grid-cols-2 gap-8 text-right w-48">
                      <span className="text-zinc-400">—</span>
                      <span>{fmtD(glPosting.net_salaries)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-rose-500">
                    <span>Cr: KRA PAYE Payable (11500)</span>
                    <span className="grid grid-cols-2 gap-8 text-right w-48">
                      <span className="text-zinc-400">—</span>
                      <span>{fmtD(totals.paye)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-zinc-500">
                    <span>Cr: NSSF Payable (18150)</span>
                    <span className="grid grid-cols-2 gap-8 text-right w-48">
                      <span className="text-zinc-400">—</span>
                      <span>{fmtD(totals.nssf)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-zinc-500">
                    <span>Cr: SHIF Payable (18150)</span>
                    <span className="grid grid-cols-2 gap-8 text-right w-48">
                      <span className="text-zinc-400">—</span>
                      <span>{fmtD(totals.shif)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-zinc-500">
                    <span>Cr: AHL Payable (18150)</span>
                    <span className="grid grid-cols-2 gap-8 text-right w-48">
                      <span className="text-zinc-400">—</span>
                      <span>{fmtD(totals.ahl)}</span>
                    </span>
                  </div>
                </div>

                {/* Totals row */}
                <div className="border-t-2 dark:border-zinc-700 pt-2 mt-2 flex justify-between font-bold">
                  <span>Total Gross Payroll</span>
                  <span className="grid grid-cols-2 gap-8 text-right w-48">
                    <span>{fmtD(glPosting.total_gross_payroll)}</span>
                    <span>{fmtD(glPosting.total_gross_payroll)}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={handleExportGL}
                className={`w-full mt-2 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-mono text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 ${buttonRadius}`}
              >
                <Download className="h-3.5 w-3.5" /><span>Download AX GL CSV</span>
              </button>
            </div>

            {/* Cost Centre breakdown */}
            <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
              <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
                <DollarSign className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Cost Centre Distribution</h3>
              </div>

              <div className="space-y-3">
                {ccBreakdown.map(cc => (
                  <div key={cc.code} className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 ${accentBadge} mr-2`}>{cc.code}</span>
                        <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">{cc.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400">{cc.headcount} staff</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">Gross</p>
                        <p>{fmt(cc.gross)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">PAYE</p>
                        <p className="text-rose-500">{fmt(cc.paye)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">Net</p>
                        <p className="text-emerald-600">{fmt(cc.net)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">Pension ER</p>
                        <p className="text-zinc-500">{fmt(cc.pension_er)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">NSSF</p>
                        <p>{fmt(cc.nssf)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-400">AHL</p>
                        <p>{fmt(cc.ahl)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: PAYE Calculator ──────────────────────────────────────────────── */}
      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between border-b dark:border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Standalone PAYE Calculator</h3>
              </div>
              <button
                onClick={() => setCalcInputs({ basic:0, bonus:0, fbt:0, transport:0, arrears:0, ot:0, voluntary_pension:0, advances:0, helb:0, company_loan:0, bank_loan:0, sacco:0 })}
                className="text-zinc-400 hover:text-zinc-600 flex items-center gap-0.5 text-[9px] font-mono"
              >
                <RotateCcw className="h-3 w-3" />Reset
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-mono uppercase text-zinc-400">Earnings (KES/month)</p>
              {[
                { label: "Basic Salary", key: "basic" },
                { label: "Bonus / Commission", key: "bonus" },
                { label: "Fringe Benefit (FBT)", key: "fbt" },
                { label: "Transport Allowance", key: "transport" },
                { label: "Arrears", key: "arrears" },
                { label: "OT / Other Earnings", key: "ot" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-[10px] font-mono text-zinc-500 w-40 shrink-0">{label}</label>
                  <input
                    type="number"
                    value={(calcInputs as Record<string, number>)[key] || ""}
                    onChange={e => setCalcInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 rounded"
                  />
                </div>
              ))}
              <p className="text-[9px] font-mono uppercase text-zinc-400 pt-2">Deductions (Post-Tax)</p>
              {[
                { label: "Voluntary Pension", key: "voluntary_pension" },
                { label: "Advances", key: "advances" },
                { label: "HELB", key: "helb" },
                { label: "Company Loan", key: "company_loan" },
                { label: "Bank Loan", key: "bank_loan" },
                { label: "SACCO", key: "sacco" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-[10px] font-mono text-zinc-500 w-40 shrink-0">{label}</label>
                  <input
                    type="number"
                    value={(calcInputs as Record<string, number>)[key] || ""}
                    onChange={e => setCalcInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b dark:border-zinc-900 pb-2">Computed Result</h3>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between border-b dark:border-zinc-900 pb-2 font-bold">
                <span>Gross Salary</span><span>{fmt(calcResult.gross_salary)}</span>
              </div>
              {[
                { label: "NSSF Tier I", val: calcResult.nssf_t1, color: "text-rose-400" },
                { label: "NSSF Tier II", val: calcResult.nssf_t2, color: "text-rose-400" },
                { label: "SHIF (2.75%)", val: calcResult.shif, color: "text-rose-400" },
                { label: "AHL (1.5%)", val: calcResult.ahl, color: "text-rose-400" },
                { label: "Pension EE (5%)", val: calcResult.defined_pension_ee, color: "text-rose-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className={`flex justify-between ${color}`}>
                  <span>Less: {label}</span><span>–{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between text-zinc-500">
                <span>Taxable Pay</span><span>{fmt(calcResult.taxable_pay)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Gross PAYE (slabs)</span><span>{fmt(calcResult.gross_paye)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Less: Personal Relief</span><span>–{fmt(calcResult.personal_relief)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Less: AHL Relief</span><span>–{fmt(calcResult.ahl_relief)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-600 border-t dark:border-zinc-800 pt-1.5">
                <span>NET PAYE</span><span>{fmt(calcResult.net_paye)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Pension ER (10%)</span><span>{fmt(calcResult.defined_pension_er)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-600 border-t-2 dark:border-zinc-700 pt-2 text-base">
                <span>NET SALARY</span><span>KES {fmt(calcResult.net_salary)}</span>
              </div>
            </div>

            {/* PAYE slab visual */}
            <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 p-3 space-y-1.5 mt-2">
              <p className="text-[9px] uppercase font-mono text-zinc-400 mb-2">Effective PAYE Slab Breakdown</p>
              {BANDS.map((band, i) => {
                const taxable = calcResult.taxable_pay
                const slabMax = [24000, 32333, 500000, 800000][i]
                const slabMin = [0, 24001, 32334, 500001, 800001][i]
                const inBand = Math.max(0, Math.min(taxable, slabMax ?? taxable) - (slabMin - 1))
                const pct = taxable > 0 ? (inBand / taxable) * 100 : 0
                return (
                  <div key={band.rate} className="space-y-0.5">
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-zinc-500">{band.range}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{band.rate}</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-zinc-700 dark:bg-zinc-300 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
