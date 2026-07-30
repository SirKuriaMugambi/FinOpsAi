"use client"

import React, { useState, useMemo } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { Percent, CheckSquare, Download, AlertTriangle, CheckCircle, FileText, Globe } from "lucide-react"

export default function WHTCalculatorPage() {
  const { whtPayments, fileWhtPayments, invoices } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [kraRef, setKraRef] = useState("")
  const [showFilingPanel, setShowFilingPanel] = useState(false)

  // Recalculate dynamic pending entries (include computed WHT from pending/approved invoices too if they represent payments)
  const pendingInvoicesWht = useMemo(() => {
    return invoices
      .filter(inv => inv.wht_type && inv.wht_type !== "Exempt" && !whtPayments.some(wp => wp.cu_invoice_number === inv.cu_invoice_number))
      .map(inv => {
        const rateVal = inv.wht_type === "2%" ? 0.02 : 0.05
        const exchange = inv.kra_rate || 1.0
        const subtotalKES = inv.subtotal * (inv.currency === "KES" ? 1 : exchange)
        const whtKES = subtotalKES * rateVal

        return {
          id: `WHT-COMP-${inv.id}`,
          vendor_name: inv.vendor_name,
          vendor_pin: "P0511" + Math.floor(100000 + Math.random() * 900000) + "A",
          cu_invoice_number: inv.cu_invoice_number,
          invoice_date: inv.invoice_date,
          payment_date: inv.due_date,
          gross_amount: subtotalKES,
          wht_rate: rateVal,
          wht_amount: whtKES,
          payment_ref: "EFT-PEND-" + inv.id.slice(-3),
          status: "Calculated" as const
        }
      })
  }, [invoices, whtPayments])

  const allWhtPayments = useMemo(() => {
    return [...whtPayments, ...pendingInvoicesWht]
  }, [whtPayments, pendingInvoicesWht])

  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === allWhtPayments.filter(p => p.status === "Calculated").length) {
      setSelectedIds([])
    } else {
      setSelectedIds(allWhtPayments.filter(p => p.status === "Calculated").map(p => p.id))
    }
  }

  const triggerFiling = (e: React.FormEvent) => {
    e.preventDefault()
    if (!kraRef.trim() || selectedIds.length === 0) return

    fileWhtPayments(selectedIds, kraRef)
    alert(`Successfully remitted ${selectedIds.length} withholding tax lines to KRA iTax! Certificate Ref: ${kraRef}`)
    setSelectedIds([])
    setKraRef("")
    setShowFilingPanel(false)
  }

  const exportiTaxCSV = () => {
    const calculatedOnly = allWhtPayments.filter(p => selectedIds.includes(p.id))
    if (calculatedOnly.length === 0) return alert("Select at least one entry to export!")

    // Format iTax Header Columns: SupplierPIN,SupplierName,TIMSInvoiceNum,InvoiceDate,PaymentDate,GrossTaxableAmount,WHTTaxRate,WHTTaxAmount
    let csvContent = "SupplierPIN,SupplierName,TIMSInvoiceNum,InvoiceDate,PaymentDate,GrossTaxableAmount,WHTTaxRate,WHTTaxAmount\n"
    calculatedOnly.forEach(p => {
      csvContent += `${p.vendor_pin},"${p.vendor_name}",${p.cu_invoice_number},${p.invoice_date},${p.payment_date},${p.gross_amount},${p.wht_rate * 100}%,${p.wht_amount}\n`
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `KRA_iTax_WHT_Filing_${new Date().toISOString().substring(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Withholding Tax (Zamikaji) Manager</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Calculate, compile, and execute bulk iTax bulk upload CSV filing files for KRA compliance.</p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={exportiTaxCSV}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 ${buttonRadius}`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export iTax CSV ({selectedIds.length})</span>
            </button>
            <button
              onClick={() => setShowFilingPanel(true)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${accentBg} ${buttonRadius}`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>File Selected</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bulk select check log (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}>
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Unsubmitted Withholding Liabilities</h3>
              </div>
              <button
                onClick={handleSelectAll}
                className="text-[10px] font-mono hover:underline text-zinc-500"
              >
                {selectedIds.length === allWhtPayments.filter(p => p.status === "Calculated").length ? "Deselect All" : "Select All Pending"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === allWhtPayments.filter(p => p.status === "Calculated").length}
                        onChange={handleSelectAll}
                        className="rounded-none border-zinc-300"
                      />
                    </th>
                    <th className="py-2">Supplier PIN</th>
                    <th className="py-2">Vendor Name</th>
                    <th className="py-2 text-right">Taxable Subtotal (KES)</th>
                    <th className="py-2 text-center">WHT Rate</th>
                    <th className="py-2 text-right">WHT Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
                  {allWhtPayments.map((p) => {
                    const isFiled = p.status === "Filed"
                    return (
                      <tr key={p.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 ${isFiled ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/20" : ""}`}>
                        <td className="py-3 text-center">
                          {!isFiled ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => handleSelectToggle(p.id)}
                              className="rounded-none border-zinc-300"
                            />
                          ) : (
                            <span className="text-[8px] font-mono uppercase bg-emerald-50 text-emerald-700 px-1 border border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400">Filed</span>
                          )}
                        </td>
                        <td className="py-3 font-mono">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{p.vendor_pin}</p>
                          <span className="text-[9px] text-zinc-400 font-mono uppercase">Inv: {p.cu_invoice_number}</span>
                        </td>
                        <td className="py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {p.vendor_name}
                          {isFiled && p.kra_reference && (
                            <span className="text-[9px] font-mono text-zinc-400 block">KRA Ref: {p.kra_reference}</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono">
                          {p.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center font-mono font-semibold">{p.wht_rate * 100}%</td>
                        <td className="py-3 text-right font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                          {p.wht_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Info & Filing Panel (1 col) */}
        <div className="space-y-6">
          {/* File Remittance Overlay Panel */}
          {showFilingPanel && (
            <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-emerald-50/5 dark:bg-emerald-950/5 space-y-4 shadow-lg ${cardRadius}`}>
              <div className="flex justify-between items-center pb-2 border-b dark:border-zinc-900">
                <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">KRA iTax Remittance Filing</span>
                <button onClick={() => setShowFilingPanel(false)} className="text-zinc-400 hover:text-zinc-600">×</button>
              </div>
              <form onSubmit={triggerFiling} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block">KRA Payment Slip Acknowledgment Ref</label>
                  <input
                    type="text"
                    value={kraRef}
                    onChange={(e) => setKraRef(e.target.value)}
                    placeholder="e.g. KRA-WHT-2026-098877"
                    className={`w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${buttonRadius}`}
                    required
                  />
                </div>
                <div className="text-[11px] font-mono space-y-1 bg-white dark:bg-zinc-950 p-3 border dark:border-zinc-900">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Bulk count:</span>
                    <span className="font-bold">{selectedIds.length} entries</span>
                  </div>
                  <div className="flex justify-between text-zinc-800 dark:text-zinc-200 border-t dark:border-zinc-900 pt-1.5 mt-1">
                    <span>Remitted KRA Total:</span>
                    <span className="font-bold">
                      KES {allWhtPayments.filter(p => selectedIds.includes(p.id)).reduce((sum, p) => sum + p.wht_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full py-2 font-mono text-[10px] uppercase font-bold tracking-wider text-center ${accentBg} ${buttonRadius}`}
                >
                  Commit Filing & Log Audit
                </button>
              </form>
            </div>
          )}

          {/* KRA Law Callout */}
          <div className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-3.5 ${cardRadius}`}>
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">KRA Tax Law Compliance</h3>

            <div className="space-y-3 font-sans text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              <div className="flex gap-2">
                <Globe className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
                <p>
                  <strong>Calculation Base:</strong> Withholding taxes under the iTax rules are applied strictly to the <strong>net subtotal amount only</strong>, completely excluding VAT (Value Added Tax).
                </p>
              </div>
              <div className="flex gap-2">
                <FileText className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
                <p>
                  <strong>Remittance Deadline:</strong> Withholding taxes must be submitted to the iTax portal by the <strong>20th of the following month</strong>. Late filings attract a 5% penalty and compounding monthly interest.
                </p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p>
                  <strong>Exchange Rates:</strong> Foreign invoices must utilize the official daily KRA-published exchange rate on the date of transaction entry, which may differ from the market-interfaced floating bank rates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
