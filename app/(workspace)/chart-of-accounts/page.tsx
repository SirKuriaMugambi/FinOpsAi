"use client"

import React, { useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { GLAccount } from "@/lib/seeds"
import { ListCollapse, Plus, Award, CreditCard } from "lucide-react"

export default function ChartOfAccountsPage() {
  const { glAccounts, addGLAccount } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText } = useTheme()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newAccount, setNewAccount] = useState<Partial<GLAccount>>({
    code: "",
    name: "",
    type: "Expense",
    department: "FIN",
    cost_centre: "121"
  })

  const [activeTab, setActiveTab] = useState<"coa" | "cc" | "approvals">("coa")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccount.code || !newAccount.name) return

    const fullAcct: GLAccount = {
      code: newAccount.code,
      name: newAccount.name,
      type: newAccount.type as GLAccount["type"],
      department: newAccount.department || "FIN",
      cost_centre: newAccount.cost_centre || "121"
    }

    addGLAccount(fullAcct)
    setNewAccount({ code: "", name: "", type: "Expense", department: "FIN", cost_centre: "121" })
    setShowAddForm(false)
    alert(`Ledger Account ${fullAcct.code} - ${fullAcct.name} added to chart database!`)
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Chart of Accounts & Governance</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Configure double-entry ledger accounts, functional cost centres, and multi-user delegation spending hierarchies.</p>
        </div>
        {activeTab === "coa" && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddForm ? "View Chart" : "Create GL Account"}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-900">
        {([
          { id: "coa", name: "Chart of Accounts (GL)" },
          { id: "cc", name: "Department Cost Centres" },
          { id: "approvals", name: "Multi-User Approval Delegation" }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setShowAddForm(false); }}
            className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? `${accentText} border-current`
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === "coa" && showAddForm ? (
        <form onSubmit={handleSubmit} className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 max-w-xl mx-auto ${cardRadius}`}>
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Register Ledger Account</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Account Code (GL Code)</label>
              <input
                type="text"
                value={newAccount.code}
                onChange={(e) => setNewAccount(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. 6110"
                maxLength={4}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Account Name</label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Utility electricity"
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Category Type</label>
              <select
                value={newAccount.type}
                onChange={(e) => setNewAccount(prev => ({ ...prev, type: e.target.value as GLAccount["type"] }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="Asset">Asset Accounts (1000-1500)</option>
                <option value="Liability">Liability Accounts (2000-2400)</option>
                <option value="Equity">Equity Capital (3000-3200)</option>
                <option value="Revenue">Sales Revenues (4000-4200)</option>
                <option value="Cost of Sales">Cost of Sales COGS (5000-5400)</option>
                <option value="Expense">Operating Expense OpEx (6000-7200)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Cost Centre mapping</label>
              <select
                value={newAccount.cost_centre}
                onChange={(e) => setNewAccount(prev => ({ ...prev, cost_centre: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="121">121 (Finance)</option>
                <option value="511">511 (Production)</option>
                <option value="208">208 (Customer service)</option>
                <option value="206">206 (Technical consults)</option>
                <option value="000">000 (General)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t dark:border-zinc-900 flex justify-end">
            <button
              type="submit"
              className={`px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider ${accentBg} ${buttonRadius}`}
            >
              Post Account
            </button>
          </div>
        </form>
      ) : activeTab === "coa" ? (
        <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
          <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
            <ListCollapse className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Chart of Accounts Catalogue</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
            {glAccounts.map((acct) => (
              <div key={acct.code} className="p-3 border dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-zinc-400 font-bold uppercase">
                  <span>{acct.code}</span>
                  <span>{acct.type}</span>
                </div>
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200">{acct.name}</h4>
                <div className="text-[9px] text-zinc-500 font-mono">
                  Dept: {acct.department} — Centre: {acct.cost_centre}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === "cc" ? (
        <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius} text-[11px]`}>
          <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
            <CreditCard className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Department Cost Centre splits</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { cc: "121", name: "Finance & Accounts", dept: "FIN", desc: "Corporate allocations, tax compliance audits, and treasury reserves." },
              { cc: "511", name: "Cut flower Production", dept: "OPS", desc: "Chemical crop protections, shipping cargo, direct farm labour wages." },
              { cc: "208", name: "Client Customer Service", dept: "CS", desc: "Revenues clearing, local freight delivery, client relationship management." },
              { cc: "206", name: "Technical Consultants", dept: "TC", desc: "Soil agronomists advisory, parent formulation research, bulk seed testing." },
              { cc: "000", name: "General Administration", dept: "ADM", desc: "Shared head office facilities expenses, MD controller delegations." }
            ].map((c) => (
              <div key={c.cc} className="p-4 border dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-2">
                <div className="flex justify-between font-mono text-[9px] font-bold">
                  <span className={accentText}>CENTRE_{c.cc}</span>
                  <span>DEPT_{c.dept}</span>
                </div>
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200">{c.name}</h4>
                <p className="text-zinc-500 leading-relaxed font-sans">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius} text-[11px]`}>
          <div className="flex items-center gap-2 border-b dark:border-zinc-900 pb-2">
            <Award className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Delegation of Authority (Spending Chain limits)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { role: "Production Manager", user: "Harrison", limit: "Dr: OPS (Freight-in / Crop supplies) up to KSh 200,000", bg: "bg-emerald-50/30 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" },
              { role: "Senior Accountant", user: "Mercy", limit: "Dr: Customer Service (208) up to KSh 100,000", bg: "bg-blue-50/30 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400" },
              { role: "Finance Manager", user: "Tony", limit: "Dr: Professional & Consulting (6200) up to KSh 500,000", bg: "bg-amber-50/30 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" },
              { role: "Business Controller", user: "Charles", limit: "ALL accounts over KSh 500,000 + MD Co-signature", bg: "bg-zinc-950/5 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100" }
            ].map((a, i) => (
              <div key={i} className={`p-4 ${a.bg} space-y-2`}>
                <div className="flex justify-between items-center font-mono text-[9px] font-bold uppercase">
                  <span>{a.role}</span>
                  <span className="border border-current px-1">{a.user}</span>
                </div>
                <h4 className="font-bold tracking-tight font-sans text-xs">Clearing Bound Limit:</h4>
                <p className="font-mono text-[10px] leading-tight font-semibold">{a.limit}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
