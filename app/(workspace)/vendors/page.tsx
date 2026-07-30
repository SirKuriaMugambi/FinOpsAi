"use client"

import React, { useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { Vendor } from "@/lib/seeds"
import { Users, Plus, ShieldAlert, CheckCircle, Search, Edit3, Eye, Power } from "lucide-react"

export default function VendorMasterPage() {
  const { vendors, addVendor, updateVendor } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [searchQuery, setSearchQuery] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  const [newVendor, setNewVendor] = useState<Partial<Vendor>>({
    vendor_id: "",
    name: "",
    type: "Supplier",
    tax_id_pin: "",
    contact_person: "",
    email: "",
    phone: "",
    bank_account: "",
    vat_treatment: "Standard (16%)",
    wht_type: "2%",
    currency: "KES",
    default_ledger: "",
    default_department: "OPS",
    default_cost_centre: "511 (Production)",
    payment_terms: "Net 30",
    status: "Active",
    notes: ""
  })

  const [pinError, setPinError] = useState("")

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vendor_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.tax_id_pin.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePINChange = (pin: string) => {
    const formatted = pin.toUpperCase()
    setNewVendor(prev => ({ ...prev, tax_id_pin: formatted }))

    // Validate KRA PIN format: 11 characters, starts with P, 9 digits, ends with a letter
    const kraPinRegex = /^P\d{9}[A-Z]$/
    if (formatted && !kraPinRegex.test(formatted)) {
      setPinError("Invalid KRA PIN. Formats require 'P' + 9 digits + 'A-Z letter' (e.g. P051122334A)")
    } else {
      setPinError("")
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinError || !newVendor.name || !newVendor.tax_id_pin) return

    const vendor_id = `V0${vendors.length + 1}`
    const fullVendor: Vendor = {
      vendor_id,
      name: newVendor.name,
      type: newVendor.type as any,
      tax_id_pin: newVendor.tax_id_pin,
      contact_person: newVendor.contact_person || "",
      email: newVendor.email || "",
      phone: newVendor.phone || "",
      bank_account: newVendor.bank_account || "",
      vat_treatment: newVendor.vat_treatment as any,
      wht_type: newVendor.wht_type as any,
      currency: newVendor.currency || "KES",
      default_ledger: newVendor.default_ledger || (newVendor.type === "Consultant" ? "6200 (Professional)" : "5000 (COGS)"),
      default_department: newVendor.default_department || "OPS",
      default_cost_centre: newVendor.default_cost_centre || "511 (Production)",
      payment_terms: newVendor.payment_terms || "Net 30",
      status: "Active",
      notes: newVendor.notes || ""
    }

    addVendor(fullVendor)

    // Reset Form
    setNewVendor({
      vendor_id: "",
      name: "",
      type: "Supplier",
      tax_id_pin: "",
      contact_person: "",
      email: "",
      phone: "",
      bank_account: "",
      vat_treatment: "Standard (16%)",
      wht_type: "2%",
      currency: "KES",
      default_ledger: "",
      default_department: "OPS",
      default_cost_centre: "511 (Production)",
      payment_terms: "Net 30",
      status: "Active",
      notes: ""
    })
    setShowAddForm(false)
  }

  const toggleStatus = (vendor: Vendor) => {
    const nextStatus = vendor.status === "Active" ? "Inactive" : "Active"
    updateVendor({ ...vendor, status: nextStatus })
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Vendor Master Database</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Configure supplier tax behaviors, default expense distributions, and payment schedules.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{showAddForm ? "View Vendors" : "Register Vendor"}</span>
        </button>
      </div>

      {showAddForm ? (
        <form onSubmit={handleSubmit} className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 max-w-2xl mx-auto ${cardRadius}`}>
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Supplier Registration Form</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Vendor Name</label>
              <input
                type="text"
                value={newVendor.name}
                onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Vendor Type</label>
              <select
                value={newVendor.type}
                onChange={(e) => setNewVendor(prev => ({ ...prev, type: e.target.value as any }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="Supplier">Supplier (Agrochemicals/Materials)</option>
                <option value="Consultant">Consultant (Professional/Fees)</option>
                <option value="Logistics">Logistics (Freight/Delivery)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">KRA Tax PIN</label>
              <input
                type="text"
                value={newVendor.tax_id_pin}
                onChange={(e) => handlePINChange(e.target.value)}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border ${pinError ? "border-rose-400 focus:ring-rose-500" : "border-zinc-200 dark:border-zinc-800 focus:ring-zinc-400"} px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 ${buttonRadius}`}
                placeholder="e.g. P051122334A"
                maxLength={11}
                required
              />
              {pinError && <span className="text-[9px] font-mono text-rose-500 leading-tight block">{pinError}</span>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Billing Currency</label>
              <select
                value={newVendor.currency}
                onChange={(e) => setNewVendor(prev => ({ ...prev, currency: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">VAT Treatment behavior</label>
              <select
                value={newVendor.vat_treatment}
                onChange={(e) => setNewVendor(prev => ({ ...prev, vat_treatment: e.target.value as any }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="Standard (16%)">Standard (16%)</option>
                <option value="Zero Rated (0%)">Zero Rated (0%)</option>
                <option value="Exempt">Exempt</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Withholding Tax base</label>
              <select
                value={newVendor.wht_type}
                onChange={(e) => setNewVendor(prev => ({ ...prev, wht_type: e.target.value as any }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="2%">2% WHT (Goods & Contracting)</option>
                <option value="5%">5% WHT (Consulting/Advisory)</option>
                <option value="Exempt">Exempt / No withholdings</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Default Department</label>
              <select
                value={newVendor.default_department}
                onChange={(e) => setNewVendor(prev => ({ ...prev, default_department: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="OPS">OPS (Production)</option>
                <option value="FIN">FIN (Finance)</option>
                <option value="CS">CS (Customer Service)</option>
                <option value="TC">TC (Technical Consults)</option>
                <option value="ADM">ADM (General Administration)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Payment Terms</label>
              <select
                value={newVendor.payment_terms}
                onChange={(e) => setNewVendor(prev => ({ ...prev, payment_terms: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              >
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
                <option value="Net 60">Net 60 Days</option>
                <option value="Due on Receipt">Due on Receipt</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block">Bank Account Remittance Info</label>
              <input
                type="text"
                value={newVendor.bank_account}
                onChange={(e) => setNewVendor(prev => ({ ...prev, bank_account: e.target.value }))}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                placeholder="e.g. Stanbic Bank A/C 9900881122"
              />
            </div>
          </div>

          <div className="pt-2 border-t dark:border-zinc-900 flex justify-end">
            <button
              type="submit"
              disabled={!!pinError || !newVendor.name || !newVendor.tax_id_pin}
              className={`px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider ${
                !pinError && newVendor.name && newVendor.tax_id_pin ? accentBg : "bg-zinc-100 text-zinc-400 cursor-not-allowed border dark:bg-zinc-900 dark:border-zinc-800"
              } ${buttonRadius}`}
            >
              Post Registered Vendor
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="max-w-md flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5">
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by vendor name, PIN, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-[11px] focus:outline-none w-full"
            />
          </div>

          {/* Vendors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVendors.map((v) => (
              <div
                key={v.vendor_id}
                className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-44 ${cardRadius}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-zinc-400 font-bold uppercase">{v.vendor_id}</span>
                    <span className={`px-1 py-0.2 text-[8px] font-mono uppercase border ${
                      v.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400"
                    }`}>
                      {v.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{v.name}</h3>
                    <p className="font-mono text-[9px] text-zinc-400 mt-0.5">PIN: {v.tax_id_pin} — {v.type}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-100 dark:border-zinc-900/60 font-mono">
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase block">TERMS</span>
                      <span className="truncate block font-semibold text-zinc-700 dark:text-zinc-300">{v.payment_terms}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase block">WHT TREAT</span>
                      <span className="truncate block font-semibold text-zinc-700 dark:text-zinc-300">{v.wht_type} WHT</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-1 border-t border-zinc-100 dark:border-zinc-900/40">
                  <button
                    onClick={() => toggleStatus(v)}
                    title={v.status === "Active" ? "Deactivate Supplier" : "Activate Supplier"}
                    className={`p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
                  >
                    <Power className={`h-3.5 w-3.5 ${v.status === "Active" ? "text-emerald-600" : "text-rose-600"}`} />
                  </button>
                  <button
                    onClick={() => {
                      alert(`Vendor profile editing under development. Full JSON record: \n\n${JSON.stringify(v, null, 2)}`)
                    }}
                    className={`p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
                  >
                    <Edit3 className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-750" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
