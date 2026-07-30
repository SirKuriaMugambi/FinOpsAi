"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { validateInvoice, calculateWHT, ValidationResult } from "@/lib/api-logic"
import { Invoice } from "@/lib/seeds"
import {
  Upload,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Trash2,
  Cpu,
  RefreshCw,
  Plus
} from "lucide-react"

export default function InvoicePage() {
  const { invoices, addInvoice, deleteInvoice, vendors } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge, accentBorder } = useTheme()

  const [dragActive, setDragActive] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState("")

  // Form States
  const [formData, setFormData] = useState<Partial<Invoice>>({
    vendor_name: "",
    vendor_id: "",
    invoice_number: "",
    cu_invoice_number: "",
    invoice_date: new Date().toISOString().substring(0, 10),
    due_date: "",
    subtotal: 0,
    vat_treatment: "Standard (16%)",
    vat_amount: 0,
    total: 0,
    currency: "KES",
    wht_type: "2%",
    wht_amount: 0,
    cost_centre: "",
    gl_account: "",
    department: "",
    approved_by: "Harrison",
    kra_rate: undefined
  })

  const [deleteReason, setDeleteReason] = useState("")
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null)

  // Presets for OCR simulation
  const PRESET_OCR_DOCUMENTS = [
    {
      id: "bayer_agro",
      name: "Bayer East Africa Agrochemicals Invoice (KES)",
      data: {
        vendor_name: "Bayer East Africa",
        vendor_id: "V001",
        invoice_number: "BY-112255",
        cu_invoice_number: "CU-BY-112255",
        invoice_date: "2026-07-02",
        due_date: "2026-08-01",
        subtotal: 800000,
        vat_treatment: "Standard (16%)",
        vat_amount: 128000,
        total: 928000,
        currency: "KES",
        wht_type: "2%",
        wht_amount: 16000, // 2% on 800,000 subtotal
        cost_centre: "511 (Production)",
        gl_account: "5000 (COGS - Raw Materials)",
        department: "OPS",
        approved_by: "Harrison",
      }
    },
    {
      id: "dhl_import",
      name: "DHL Air Freight Express (USD)",
      data: {
        vendor_name: "DHL Express Kenya",
        vendor_id: "V002",
        invoice_number: "DHL-900880",
        cu_invoice_number: "CU-DH-900880",
        invoice_date: "2026-07-01",
        due_date: "2026-07-16",
        subtotal: 5000, // USD
        vat_treatment: "Standard (16%)",
        vat_amount: 800,
        total: 5800,
        currency: "USD",
        wht_type: "2%",
        wht_amount: 100, // 2% of 5,000
        cost_centre: "511 (Production)",
        gl_account: "5100 (Freight-in & Import Logistics)",
        department: "OPS",
        approved_by: "Harrison",
        kra_rate: 129.50
      }
    },
    {
      id: "deloitte_audit",
      name: "Deloitte Advisory Services Invoice (KES)",
      data: {
        vendor_name: "Deloitte Kenya",
        vendor_id: "V003",
        invoice_number: "DL-667788",
        cu_invoice_number: "CU-DL-667788",
        invoice_date: "2026-06-30",
        due_date: "2026-07-30",
        subtotal: 1500000,
        vat_treatment: "Standard (16%)",
        vat_amount: 240000,
        total: 1740000,
        currency: "KES",
        wht_type: "5%",
        wht_amount: 75000, // 5% on 1.5M subtotal
        cost_centre: "121 (Finance)",
        gl_account: "6200 (Professional & Consultancy)",
        department: "FIN",
        approved_by: "Tony",
      }
    },
    {
      id: "syngenta_seeds",
      name: "Syngenta Flower Seeds Invoice (Exempt KES)",
      data: {
        vendor_name: "Syngenta Flowers East Africa",
        vendor_id: "V004",
        invoice_number: "SYN-220044",
        cu_invoice_number: "CU-SY-220044",
        invoice_date: "2026-07-02",
        due_date: "2026-08-16",
        subtotal: 1850000,
        vat_treatment: "Zero Rated (0%)",
        vat_amount: 0,
        total: 1850000,
        currency: "KES",
        wht_type: "Exempt",
        wht_amount: 0,
        cost_centre: "511 (Production)",
        gl_account: "5000 (COGS - Raw Materials)",
        department: "OPS",
        approved_by: "Harrison",
      }
    }
  ]

  // Simulate OCR Fill
  const handlePresetSelect = (id: string) => {
    setSelectedPreset(id)
    const preset = PRESET_OCR_DOCUMENTS.find(p => p.id === id)
    if (preset) {
      setFormData(preset.data)
    }
  }

  // Handle Form changes
  const handleChange = (field: keyof Invoice, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto-recalculate VAT if standard 16% and subtotal changes
      if (field === "subtotal" || field === "vat_treatment") {
        const sub = field === "subtotal" ? Number(value) : (prev.subtotal || 0)
        const treat = field === "vat_treatment" ? value : (prev.vat_treatment || "Standard (16%)")

        let vat = 0
        if (treat === "Standard (16%)") {
          vat = Math.round(sub * 0.16 * 100) / 100
        }
        updated.vat_amount = vat
        updated.total = sub + vat
      }

      // Auto calculate WHT
      if (field === "subtotal" || field === "wht_type") {
        const sub = field === "subtotal" ? Number(value) : (prev.subtotal || 0)
        const whtType = field === "wht_type" ? value : (prev.wht_type || "2%")

        const { whtAmount } = calculateWHT(sub, whtType)
        updated.wht_amount = Math.round(whtAmount * 100) / 100
      }

      // Auto-assign cost centre defaults if vendor is selected
      if (field === "vendor_name") {
        const selectedVendor = vendors.find(v => v.name === value)
        if (selectedVendor) {
          updated.vendor_id = selectedVendor.vendor_id
          updated.vat_treatment = selectedVendor.vat_treatment
          updated.wht_type = selectedVendor.wht_type
          updated.currency = selectedVendor.currency
          updated.gl_account = selectedVendor.default_ledger
          updated.department = selectedVendor.default_department
          updated.cost_centre = selectedVendor.default_cost_centre

          // Trigger defaults recalculations
          const sub = prev.subtotal || 0
          let vat = 0
          if (selectedVendor.vat_treatment === "Standard (16%)") {
            vat = sub * 0.16
          }
          updated.vat_amount = vat
          updated.total = sub + vat

          const { whtAmount } = calculateWHT(sub, selectedVendor.wht_type)
          updated.wht_amount = whtAmount

          // Set default approver
          if (selectedVendor.default_department === "OPS") {
            updated.approved_by = "Harrison"
          } else if (selectedVendor.default_department === "FIN") {
            updated.approved_by = "Tony"
          } else {
            updated.approved_by = "Charles"
          }
        }
      }

      return updated
    })
  }

  // Real-time validations
  const validation: ValidationResult = useMemo(() => {
    return validateInvoice(formData, invoices)
  }, [formData, invoices])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Simulate reading a random file and loading the first preset
      handlePresetSelect("bayer_agro")
    }
  }

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validation.isValid) return

    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      vendor_name: formData.vendor_name || "",
      vendor_id: formData.vendor_id || "",
      invoice_number: formData.invoice_number || "",
      cu_invoice_number: formData.cu_invoice_number || "",
      invoice_date: formData.invoice_date || "",
      due_date: formData.due_date || "",
      subtotal: Number(formData.subtotal) || 0,
      vat_treatment: formData.vat_treatment || "Standard (16%)",
      vat_amount: Number(formData.vat_amount) || 0,
      total: Number(formData.total) || 0,
      currency: formData.currency || "KES",
      wht_type: formData.wht_type || "Exempt",
      wht_amount: Number(formData.wht_amount) || 0,
      cost_centre: formData.cost_centre || "",
      gl_account: formData.gl_account || "",
      department: formData.department || "",
      approved_by: formData.approved_by || "",
      approval_date: new Date().toISOString().substring(0, 10),
      status: "Approved", // Pre-approve for streamlining simulations
      kra_rate: formData.kra_rate ? Number(formData.kra_rate) : undefined
    }

    addInvoice(newInvoice)

    // Reset Form
    setFormData({
      vendor_name: "",
      vendor_id: "",
      invoice_number: "",
      cu_invoice_number: "",
      invoice_date: new Date().toISOString().substring(0, 10),
      due_date: "",
      subtotal: 0,
      vat_treatment: "Standard (16%)",
      vat_amount: 0,
      total: 0,
      currency: "KES",
      wht_type: "2%",
      wht_amount: 0,
      cost_centre: "",
      gl_account: "",
      department: "",
      approved_by: "Harrison",
      kra_rate: undefined
    })
    setSelectedPreset("")
  }

  const handleDeleteTrigger = (id: string) => {
    setActiveDeleteId(id)
    setDeleteReason("")
  }

  const confirmDelete = () => {
    if (activeDeleteId && deleteReason.trim()) {
      deleteInvoice(activeDeleteId, deleteReason)
      setActiveDeleteId(null)
      setDeleteReason("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-900 gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Invoice OCR & KRA Verification</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Extract, review VAT treatments, verify WHT bases, and route to approvers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OCR Portal & Form Editor (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* File Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border border-dashed p-6 text-center transition-all ${
              dragActive ? `${accentBorder} bg-zinc-50 dark:bg-zinc-900/50` : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
            } ${cardRadius}`}
          >
            <Upload className="h-6 w-6 mx-auto text-zinc-400 mb-2.5" />
            <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 block">Drag & Drop Invoice File</span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 mb-3 uppercase font-mono">Supports PDF, JPG, XLSX (Max 15MB)</span>

            <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
              <span className="h-px bg-zinc-150 dark:bg-zinc-900 flex-1" />
              <span className="text-[9px] font-mono text-zinc-400 uppercase">OR SIMULATE OCR VIA PRESET</span>
              <span className="h-px bg-zinc-150 dark:bg-zinc-900 flex-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 max-w-lg mx-auto">
              {PRESET_OCR_DOCUMENTS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`px-2 py-1.5 text-left border text-[10px] font-mono tracking-tight flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                    selectedPreset === preset.id ? `${accentBadge} font-bold` : "border-zinc-250 dark:border-zinc-850"
                  } ${buttonRadius}`}
                >
                  <Cpu className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Editor */}
          <form onSubmit={handlePost} className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Manual Override & Posting Controls</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vendor Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Vendor Name</label>
                <select
                  value={formData.vendor_name}
                  onChange={(e) => handleChange("vendor_name", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.vendor_id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Invoice / Reference #</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => handleChange("invoice_number", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  placeholder="e.g. BY-55229"
                  required
                />
              </div>

              {/* CU Invoice Number (ETR) */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">CU Reference Number (KRA TIMS)</label>
                <input
                  type="text"
                  value={formData.cu_invoice_number}
                  onChange={(e) => handleChange("cu_invoice_number", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  placeholder="e.g. CU-BY-112255"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Invoice Date</label>
                <input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleChange("invoice_date", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                />
              </div>

              {/* Currency Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Billing Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                >
                  <option value="KES">KES (Kenya Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                </select>
              </div>

              {/* Manual KRA rate */}
              {formData.currency !== "KES" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-rose-500 uppercase block">KRA Exchange Rate (REQUIRED)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.kra_rate || ""}
                    onChange={(e) => handleChange("kra_rate", e.target.value ? Number(e.target.value) : undefined)}
                    className={`w-full bg-rose-50/20 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${buttonRadius}`}
                    placeholder="e.g. 129.50"
                    required
                  />
                </div>
              )}

              {/* Subtotal */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Subtotal (Exclude VAT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.subtotal || ""}
                  onChange={(e) => handleChange("subtotal", Number(e.target.value))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                />
              </div>

              {/* VAT Treatment */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">VAT Treatment</label>
                <select
                  value={formData.vat_treatment}
                  onChange={(e) => handleChange("vat_treatment", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                >
                  <option value="Standard (16%)">Standard (16%)</option>
                  <option value="Zero Rated (0%)">Zero Rated (0%)</option>
                  <option value="Exempt">Exempt</option>
                </select>
              </div>

              {/* VAT Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">VAT Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat_amount || 0}
                  onChange={(e) => handleChange("vat_amount", Number(e.target.value))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                />
              </div>

              {/* Total */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Gross Total (With VAT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total || 0}
                  onChange={(e) => handleChange("total", Number(e.target.value))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                />
              </div>

              {/* WHT Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Withholding Tax (WHT)</label>
                <select
                  value={formData.wht_type}
                  onChange={(e) => handleChange("wht_type", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                >
                  <option value="2%">2% WHT (General Supplies)</option>
                  <option value="5%">5% WHT (Consulting Services)</option>
                  <option value="Exempt">Exempt / No WHT</option>
                </select>
              </div>

              {/* WHT Amount */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block">Calculated WHT</label>
                  <span className="text-[8px] font-mono text-zinc-400" title="WHT base excludes VAT. (Subtotal * WHT%)">Excludes VAT</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.wht_amount || 0}
                  disabled
                  className={`w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono cursor-not-allowed ${buttonRadius}`}
                />
              </div>

              {/* Cost Centre */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Cost Centre Allocation</label>
                <select
                  value={formData.cost_centre}
                  onChange={(e) => handleChange("cost_centre", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                >
                  <option value="">Select Cost Centre</option>
                  <option value="511 (Production)">511 (Production / OPS)</option>
                  <option value="121 (Finance)">121 (Finance / FIN)</option>
                  <option value="208 (Customer Service)">208 (Customer Service / CS)</option>
                  <option value="206 (Technical Consultants)">206 (Technical Consultants / TC)</option>
                  <option value="000 (General)">000 (General / ADM)</option>
                </select>
              </div>

              {/* Approver routing */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">Approver Route</label>
                <select
                  value={formData.approved_by}
                  onChange={(e) => handleChange("approved_by", e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent ${buttonRadius}`}
                  required
                >
                  <option value="Harrison">Harrison (Production Mgr)</option>
                  <option value="Tony">Tony (Finance Mgr)</option>
                  <option value="Mercy">Mercy (Senior Accountant)</option>
                  <option value="Charles">Charles (Business Controller)</option>
                </select>
              </div>
            </div>

            {/* Posting Button */}
            <div className="pt-2 border-t border-zinc-150 dark:border-zinc-900 flex justify-end">
              <button
                type="submit"
                disabled={!validation.isValid}
                className={`px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${
                  validation.isValid ? accentBg : "bg-zinc-100 text-zinc-400 cursor-not-allowed border dark:bg-zinc-900 dark:border-zinc-800"
                } ${buttonRadius}`}
              >
                <FileCheck className="h-4 w-4" />
                <span>Verify & Post Invoice</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Sidebar Checklist (1 col) */}
        <div className="space-y-6">
          {/* Validation Warnings / Alerts Panel */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3.5 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">VAT & WHT Validation Flags</h3>

            {validation.flags.length === 0 ? (
              <div className="py-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>All KRA tax rules satisfied! No errors flagged.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {validation.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 border text-[11px] flex gap-2 ${
                      flag.type === "error"
                        ? "bg-rose-50/40 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-950"
                        : "bg-amber-50/40 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-950"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold uppercase tracking-wide text-[9px] font-mono">
                        {flag.type === "error" ? "RULE_VIOLATION_BLOCKED" : "COMPLIANCE_WARN_VERIFY"}
                      </span>
                      <p className="leading-tight">{flag.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Ledger List */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">Posted Ledger Invoices</h3>

            {invoices.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 font-mono text-[10px]">No invoices found in ledger.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                {invoices.map((inv) => (
                  <div key={inv.id} className="text-[11px] space-y-1 p-2.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-900">
                    <div className="flex items-center justify-between font-mono text-[9px] text-zinc-400">
                      <span>{inv.id}</span>
                      <span>{inv.invoice_date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{inv.vendor_name}</span>
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50 font-mono">
                        {inv.currency} {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="font-mono">Ref: {inv.invoice_number}</span>
                      <span className="font-mono">WHT: {inv.wht_type}</span>
                    </div>

                    {/* Delete panel */}
                    {activeDeleteId === inv.id ? (
                      <div className="pt-2 border-t border-zinc-150 dark:border-zinc-850 mt-1 space-y-1.5">
                        <input
                          type="text"
                          placeholder="Provide deletion audit reason..."
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          className={`w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 text-[10px] font-mono focus:outline-none ${buttonRadius}`}
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setActiveDeleteId(null)}
                            className="px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 text-[9px] font-mono uppercase"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={confirmDelete}
                            disabled={!deleteReason.trim()}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 text-[9px] font-mono uppercase"
                          >
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1.5 border-t border-zinc-150 dark:border-zinc-850/60 mt-1 flex justify-between items-center">
                        <span className={`px-1 py-0.2 text-[8px] font-mono uppercase ${
                          inv.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-950" : "bg-amber-50 text-amber-700 border border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-950"
                        }`}>
                          {inv.status}
                        </span>
                        <button
                          onClick={() => handleDeleteTrigger(inv.id)}
                          className="text-zinc-400 hover:text-rose-500 p-0.5 transition-colors"
                          title="Delete invoice (audited)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
