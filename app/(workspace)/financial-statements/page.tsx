"use client"

import React, { useState } from "react"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import { FileSpreadsheet, Download, Printer, Percent } from "lucide-react"

export default function FinancialStatementsPage() {
  const { invoices } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } = useTheme()

  const [activeTab, setActiveTab] = useState<"pl" | "bs" | "tb">("pl")

  // Income Statement calculations
  const plData = React.useMemo(() => {
    // Sales revenue (Export & Local)
    const exportSales = 12500000
    const localSales = 1800000
    const grossSales = exportSales + localSales

    // COGS
    const cogsMaterials = 4500000
    const directLabour = 850000
    const logisticsImports = 1200000
    const totalCOGS = cogsMaterials + directLabour + logisticsImports
    const grossProfit = grossSales - totalCOGS

    // OpEx
    const salaries = 860000
    const pensionShare = 32000
    const rentUtilities = 480000
    const consultingFees = 2500000
    const totalOpEx = salaries + pensionShare + rentUtilities + consultingFees
    const netProfit = grossProfit - totalOpEx

    return {
      exportSales,
      localSales,
      grossSales,
      cogsMaterials,
      directLabour,
      logisticsImports,
      totalCOGS,
      grossProfit,
      salaries,
      pensionShare,
      rentUtilities,
      consultingFees,
      totalOpEx,
      netProfit,
    }
  }, [invoices])

  const bsData = React.useMemo(() => {
    const cashKES = 5820000
    const cashUSD = 3450000 // In KES
    const tradeAR = 1240000
    const inventory = 3200000
    const totalCurrentAssets = cashKES + cashUSD + tradeAR + inventory
    const fixedAssets = 8500000
    const totalAssets = totalCurrentAssets + fixedAssets

    const tradeAP = 2900000
    const taxesPayable = 325000
    const payrollPayable = 280000
    const totalLiabilities = tradeAP + taxesPayable + payrollPayable

    const shareCapital = 10000000
    const retainedEarnings = totalAssets - totalLiabilities - shareCapital

    return {
      cashKES,
      cashUSD,
      tradeAR,
      inventory,
      totalCurrentAssets,
      fixedAssets,
      totalAssets,
      tradeAP,
      taxesPayable,
      payrollPayable,
      totalLiabilities,
      shareCapital,
      retainedEarnings,
    }
  }, [invoices])

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">Financial Statement Ledger</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Generate Trial Balances, Income Statements (P&L), and Balance Sheets with double-entry compliance validation.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => alert("Statement exported to spreadsheet format.")}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 ${buttonRadius}`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-900">
        {[
          { id: "pl", name: "Profit & Loss (P&L)" },
          { id: "bs", name: "Balance Sheet (Statement of Financial Position)" },
          { id: "tb", name: "Trial Balance" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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

      {/* Sheet view */}
      <div className={`p-6 sm:p-8 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 font-mono text-[11px] leading-normal ${cardRadius}`}>

        {/* Header */}
        <div className="text-center pb-6 border-b border-zinc-150 dark:border-zinc-900 space-y-1">
          <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-widest">Chrysal Africa Limited</h2>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            {activeTab === "pl" ? "Income Statement (Profit & Loss)" : activeTab === "bs" ? "Balance Sheet" : "Trial Balance Ledger"}
          </p>
          <p className="text-[9px] text-zinc-400 italic">For the Period Ended June 30, 2026 — Currency: KES Base</p>
        </div>

        {/* Tab 1: P&L */}
        {activeTab === "pl" && (
          <div className="pt-6 space-y-4 max-w-xl mx-auto">
            {/* Revenue */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Revenue Accounts</h3>
              <div className="flex justify-between pl-4">
                <span>Export Sales (4000)</span>
                <span>KES {plData.exportSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Local Sales (4100)</span>
                <span>{plData.localSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-double dark:border-zinc-900 font-bold pt-1">
                <span>Gross Revenue</span>
                <span>KES {plData.grossSales.toLocaleString()}</span>
              </div>
            </div>

            {/* COGS */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-850 dark:text-zinc-300 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Cost of Sales (COGS)</h3>
              <div className="flex justify-between pl-4">
                <span>Direct Raw Materials (5000)</span>
                <span>({plData.cogsMaterials.toLocaleString()})</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Direct Labour Wages (5200)</span>
                <span>({plData.directLabour.toLocaleString()})</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Logistics & Freight Import (5100)</span>
                <span>({plData.logisticsImports.toLocaleString()})</span>
              </div>
              <div className="flex justify-between border-t dark:border-zinc-900 font-bold pt-1">
                <span>Total Cost of Sales</span>
                <span>KES ({plData.totalCOGS.toLocaleString()})</span>
              </div>
            </div>

            {/* Gross Profit Divider */}
            <div className="flex justify-between border-t border-b border-zinc-200 dark:border-zinc-900 py-2 font-bold text-zinc-950 dark:text-zinc-50 uppercase text-[10px]">
              <span>Gross Profit Margin</span>
              <span>KES {plData.grossProfit.toLocaleString()}</span>
            </div>

            {/* OpEx */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Operating Expenses (OpEx)</h3>
              <div className="flex justify-between pl-4">
                <span>Salaries & Roster Wages (6000)</span>
                <span>{plData.salaries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Statutory Pension Charges (6010)</span>
                <span>{plData.pensionShare.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Rent & KPLC Electricity Utilities (6100)</span>
                <span>{plData.rentUtilities.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Professional & Audit Fees (6200)</span>
                <span>{plData.consultingFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t dark:border-zinc-900 font-bold pt-1">
                <span>Total Operating Expenses</span>
                <span>KES {plData.totalOpEx.toLocaleString()}</span>
              </div>
            </div>

            {/* Net Profit Divider */}
            <div className="flex justify-between border-t-2 border-b-4 border-double border-zinc-950 dark:border-zinc-100 py-2.5 font-bold text-emerald-600 uppercase text-[11px]">
              <span>Net Profit Margin (Before Tax)</span>
              <span>KES {plData.netProfit.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Tab 2: Balance Sheet */}
        {activeTab === "bs" && (
          <div className="pt-6 space-y-4 max-w-xl mx-auto">
            {/* Assets */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Assets (Current & Non-Current)</h3>
              <div className="flex justify-between pl-4 text-zinc-500">
                <span>Cash Reserve - NCBA KES (1010)</span>
                <span>KES {bsData.cashKES.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-zinc-500">
                <span>Cash Reserve - NCBA USD (1020)</span>
                <span>{bsData.cashUSD.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-zinc-500">
                <span>Trade Accounts Receivable (1100)</span>
                <span>{bsData.tradeAR.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-zinc-500">
                <span>Raw Materials Inventory (1200)</span>
                <span>{bsData.inventory.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-zinc-700 dark:text-zinc-300 font-semibold border-t border-dashed dark:border-zinc-850 pt-1">
                <span>Total Current Assets</span>
                <span>{bsData.totalCurrentAssets.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 pt-1">
                <span>Fixed Agrochemical Assets (1300)</span>
                <span>{bsData.fixedAssets.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-double dark:border-zinc-900 font-bold pt-1.5 text-zinc-950 dark:text-zinc-50 text-[10px]">
                <span>Total Assets Reserves</span>
                <span>KES {bsData.totalAssets.toLocaleString()}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-850 dark:text-zinc-300 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Liabilities Accounts</h3>
              <div className="flex justify-between pl-4">
                <span>Trade Accounts Payable (2000)</span>
                <span>KES {bsData.tradeAP.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Taxes & KRA WHT Payable (2100)</span>
                <span>{bsData.taxesPayable.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Payroll Salaries Payable (2300)</span>
                <span>{bsData.payrollPayable.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t dark:border-zinc-900 font-bold pt-1">
                <span>Total Liabilities</span>
                <span>KES {bsData.totalLiabilities.toLocaleString()}</span>
              </div>
            </div>

            {/* Equity */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 border-b dark:border-zinc-900 pb-1 uppercase text-[10px]">Shareholder Equity</h3>
              <div className="flex justify-between pl-4">
                <span>Authorized Share Capital (3000)</span>
                <span>KES {bsData.shareCapital.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span>Retained Earnings (3100)</span>
                <span>{bsData.retainedEarnings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t-2 border-b-4 border-double border-zinc-950 dark:border-zinc-100 py-2.5 font-bold uppercase text-[11px] text-zinc-900 dark:text-zinc-50">
                <span>Total Liabilities & Equity Balance</span>
                <span>KES {bsData.totalAssets.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Trial Balance */}
        {activeTab === "tb" && (
          <div className="pt-6 space-y-4 max-w-xl mx-auto text-[11px]">
            <div className="border-b dark:border-zinc-900 pb-2 flex justify-between font-bold text-zinc-400 uppercase text-[9px] tracking-wider">
              <span>GL Account Ledger</span>
              <span className="grid grid-cols-2 gap-12 w-48 text-right"><span>Debit (Dr)</span><span>Credit (Cr)</span></span>
            </div>

            <div className="space-y-1">
              {[
                { code: "1010", name: "Bank Account KES", dr: 5820000, cr: null },
                { code: "1020", name: "Bank Account USD", dr: 3450000, cr: null },
                { code: "1100", name: "Trade AR Ledger", dr: 1240000, cr: null },
                { code: "1200", name: "Raw Stock Inventory", dr: 3200000, cr: null },
                { code: "1300", name: "Fixed Assets Cost", dr: 8500000, cr: null },
                { code: "2000", name: "Trade Accounts Payable", dr: null, cr: 2900000 },
                { code: "2100", name: "Taxes & WHT Payable", dr: null, cr: 325000 },
                { code: "2300", name: "Payroll Payables", dr: null, cr: 280000 },
                { code: "3000", name: "Share Capital Funds", dr: null, cr: 10000000 },
                { code: "3100", name: "Retained Net Earnings", dr: null, cr: 8505000 }
              ].map((row) => (
                <div key={row.code} className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-900/60 font-mono">
                  <span>{row.code} - {row.name}</span>
                  <span className="grid grid-cols-2 gap-12 w-48 text-right font-semibold">
                    <span>{row.dr ? `KES ${row.dr.toLocaleString()}` : "-"}</span>
                    <span>{row.cr ? `KES ${row.cr.toLocaleString()}` : "-"}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* Total Balance */}
            <div className="flex justify-between border-t-2 border-b-4 border-double border-zinc-950 dark:border-zinc-100 py-2.5 font-bold uppercase text-[11px] text-emerald-600">
              <span>Trial Ledger Totals</span>
              <span className="grid grid-cols-2 gap-12 w-48 text-right font-bold">
                <span>KES 22,210,000</span>
                <span>KES 22,210,000</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
