import { Vendor, Invoice, WhtPayment, GLAccount, Employee, ChecklistItem, AuditLog, BudgetItem, Document } from "./seeds"

// --- Currency Conversion Engine ---
export const MOCK_EXCHANGE_RATES: Record<string, number> = {
  USD: 129.50,
  EUR: 140.20,
  GBP: 165.10,
  KES: 1.00,
}

export function convertToKES(amount: number, currency: string, manualKraRate?: number): { amountKES: number; rateUsed: number } {
  if (currency === "KES") {
    return { amountKES: amount, rateUsed: 1.0 }
  }
  const rate = manualKraRate || MOCK_EXCHANGE_RATES[currency] || 1.0
  return { amountKES: amount * rate, rateUsed: rate }
}

// --- Invoice Validation & Flagging System ---
export interface ValidationResult {
  isValid: boolean
  flags: { type: "error" | "warning"; message: string }[]
}

export function validateInvoice(invoice: Partial<Invoice>, existingInvoices: Invoice[] = []): ValidationResult {
  const flags: { type: "error" | "warning"; message: string }[] = []

  // Check required fields
  if (!invoice.vendor_name) flags.push({ type: "error", message: "Vendor name is required" })
  if (!invoice.invoice_number) flags.push({ type: "error", message: "Invoice number is required" })
  if (!invoice.total || invoice.total <= 0) flags.push({ type: "error", message: "Invoice total must be greater than 0" })

  // Duplicate invoice check
  if (invoice.invoice_number && invoice.vendor_id) {
    const isDuplicate = existingInvoices.some(
      (inv) => inv.invoice_number.toLowerCase() === invoice.invoice_number?.toLowerCase() && inv.vendor_id === invoice.vendor_id && inv.id !== invoice.id
    )
    if (isDuplicate) {
      flags.push({ type: "error", message: `Duplicate invoice number "${invoice.invoice_number}" for this vendor.` })
    }
  }

  // KRA Pin check
  if (invoice.vendor_id) {
    // Assuming we have vendor PIN from master.
  }

  // VAT Treatment Verification
  const subtotal = invoice.subtotal || 0
  const vatAmount = invoice.vat_amount || 0
  const expectedTotal = subtotal + vatAmount

  if (Math.abs(expectedTotal - (invoice.total || 0)) > 0.5) {
    flags.push({ type: "error", message: `Total (${invoice.total}) does not match Subtotal + VAT (${expectedTotal}).` })
  }

  if (invoice.vat_treatment === "Standard (16%)") {
    const calculatedVat = subtotal * 0.16
    if (Math.abs(calculatedVat - vatAmount) > 0.5) {
      flags.push({ type: "warning", message: `VAT amount (${vatAmount}) differs from expected 16% VAT (${calculatedVat.toFixed(2)}).` })
    }
  } else if (invoice.vat_treatment === "Zero Rated (0%)" || invoice.vat_treatment === "Exempt") {
    if (vatAmount > 0) {
      flags.push({ type: "error", message: `VAT amount must be 0 for ${invoice.vat_treatment} invoices.` })
    }
  }

  // WHT base logic verification (Applied to Subtotal ONLY)
  if (invoice.wht_type && invoice.wht_type !== "Exempt") {
    const rate = invoice.wht_type === "2%" ? 0.02 : 0.05
    const expectedWht = subtotal * rate
    if (invoice.wht_amount && Math.abs(expectedWht - invoice.wht_amount) > 0.5) {
      flags.push({ type: "warning", message: `Withholding Tax (${invoice.wht_amount}) differs from calculated rate of ${invoice.wht_type} on Subtotal (${expectedWht.toFixed(2)}).` })
    }
  }

  // KRA exchange rate verification for Foreign Currencies
  if (invoice.currency && invoice.currency !== "KES") {
    if (!invoice.kra_rate) {
      flags.push({ type: "error", message: "Foreign currency invoice requires manual KRA Exchange Rate." })
    } else if (invoice.kra_rate < 50 || invoice.kra_rate > 250) {
      flags.push({ type: "warning", message: `KRA rate of ${invoice.kra_rate} seems unusual for currency ${invoice.currency}.` })
    }
  }

  return {
    isValid: flags.filter(f => f.type === "error").length === 0,
    flags
  }
}

// --- WHT Calculator Engine (Zamikaji) ---
export function calculateWHT(subtotal: number, whtType: string): { whtAmount: number; rate: number } {
  if (whtType === "2%") {
    return { whtAmount: subtotal * 0.02, rate: 0.02 }
  } else if (whtType === "5%") {
    return { whtAmount: subtotal * 0.05, rate: 0.05 }
  }
  return { whtAmount: 0, rate: 0.0 }
}

// --- AP Reconciliation Engine ---
export interface APReconItem {
  paymentId: string
  vendorName: string
  paymentAmountKES: number
  paymentDate: string
  reference: string
  status: "Matched" | "Unmatched" | "Multi-Invoice Match"
  confidence: "High Confidence ✅" | "Medium Confidence 🟡" | "Requires Investigation ❌"
  matchedInvoiceIds: string[]
  reason?: string
}

export function runAPReconciliation(
  payments: { id: string; vendor_id: string; vendor_name: string; amount: number; currency: string; date: string; ref: string }[],
  outstandingInvoices: Invoice[]
): APReconItem[] {
  const reconList: APReconItem[] = []

  payments.forEach((pay) => {
    const payKES = pay.currency === "KES" ? pay.amount : pay.amount * MOCK_EXCHANGE_RATES[pay.currency]
    const vendorInvoices = outstandingInvoices.filter(
      (inv) => inv.vendor_id === pay.vendor_id && inv.status === "Approved"
    )

    // 1. Check exact match
    const exactMatch = vendorInvoices.find((inv) => {
      const invKES = inv.currency === "KES" ? inv.total : inv.total * (inv.kra_rate || MOCK_EXCHANGE_RATES[inv.currency])
      // Account for 2% WHT withheld by Chrysal (Net to vendor = Gross - WHT)
      const isWhtApplied = inv.wht_type && inv.wht_type !== "Exempt"
      const whtKES = isWhtApplied ? (inv.subtotal * (inv.wht_type === "2%" ? 0.02 : 0.05)) * (inv.currency === "KES" ? 1 : (inv.kra_rate || MOCK_EXCHANGE_RATES[inv.currency])) : 0
      const netExpectedKES = invKES - whtKES

      return Math.abs(netExpectedKES - payKES) <= 0.50
    })

    if (exactMatch) {
      reconList.push({
        paymentId: pay.id,
        vendorName: pay.vendor_name,
        paymentAmountKES: payKES,
        paymentDate: pay.date,
        reference: pay.ref,
        status: "Matched",
        confidence: "High Confidence ✅",
        matchedInvoiceIds: [exactMatch.id]
      })
      return
    }

    // 2. Check multi-invoice match (combinations of 2 invoices)
    let foundMulti = false
    for (let i = 0; i < vendorInvoices.length; i++) {
      for (let j = i + 1; j < vendorInvoices.length; j++) {
        const invA = vendorInvoices[i]
        const invB = vendorInvoices[j]

        const getNetKES = (inv: Invoice) => {
          const invKES = inv.currency === "KES" ? inv.total : inv.total * (inv.kra_rate || MOCK_EXCHANGE_RATES[inv.currency])
          const isWhtApplied = inv.wht_type && inv.wht_type !== "Exempt"
          const whtKES = isWhtApplied ? (inv.subtotal * (inv.wht_type === "2%" ? 0.02 : 0.05)) * (inv.currency === "KES" ? 1 : (inv.kra_rate || MOCK_EXCHANGE_RATES[inv.currency])) : 0
          return invKES - whtKES
        }

        if (Math.abs(getNetKES(invA) + getNetKES(invB) - payKES) <= 0.50) {
          reconList.push({
            paymentId: pay.id,
            vendorName: pay.vendor_name,
            paymentAmountKES: payKES,
            paymentDate: pay.date,
            reference: pay.ref,
            status: "Multi-Invoice Match",
            confidence: "Medium Confidence 🟡",
            matchedInvoiceIds: [invA.id, invB.id]
          })
          foundMulti = true
          break
        }
      }
      if (foundMulti) break
    }

    if (!foundMulti) {
      reconList.push({
        paymentId: pay.id,
        vendorName: pay.vendor_name,
        paymentAmountKES: payKES,
        paymentDate: pay.date,
        reference: pay.ref,
        status: "Unmatched",
        confidence: "Requires Investigation ❌",
        matchedInvoiceIds: [],
        reason: "Payment amount does not align with any approved invoice net totals."
      })
    }
  })

  return reconList
}

// --- AR Receipting Formula Engine ---
export interface ARReconItem {
  invoiceId: string
  customerName: string
  grossAmountKES: number
  expectedReceiptKES: number
  receivedAmountKES: number
  whtWithheldKES: number
  status: "Fully Paid" | "Underpaid (WHT Discrepancy)" | "Partially Paid" | "Outstanding"
  certificateStatus: "Pending" | "Received" | "Discrepancy"
}

export function runARReceipting(
  arInvoices: { id: string; customer: string; net_amount: number; vat: number; received: number; certificate: "Pending" | "Received" }[],
  receivedPayments: { invoice_id: string; amount: number }[]
): ARReconItem[] {
  return arInvoices.map((inv) => {
    const gross = inv.net_amount + inv.vat
    const wht2Percent = inv.net_amount * 0.02 // 2% of Net Taxable Value withheld by Customer
    const expected = gross - wht2Percent

    const payment = receivedPayments.find((p) => p.invoice_id === inv.id)
    const received = payment ? payment.amount : inv.received

    let status: ARReconItem["status"] = "Outstanding"
    let certStatus: ARReconItem["certificateStatus"] = inv.certificate === "Received" ? "Received" : "Pending"

    if (received === 0) {
      status = "Outstanding"
    } else if (Math.abs(received - expected) <= 0.5) {
      status = "Fully Paid"
    } else if (Math.abs(received - gross) <= 0.5) {
      status = "Underpaid (WHT Discrepancy)"
      certStatus = "Discrepancy"
    } else {
      status = "Partially Paid"
    }

    return {
      invoiceId: inv.id,
      customerName: inv.customer,
      grossAmountKES: gross,
      expectedReceiptKES: expected,
      receivedAmountKES: received,
      whtWithheldKES: wht2Percent,
      status,
      certificateStatus: certStatus
    }
  })
}

// --- Bank Reconciliation Matching Engine ---
export interface BankReconMatch {
  bankLineId: string
  ledgerLineId: string | null
  date: string
  description: string
  amount: number
  type: "Deposit" | "Withdrawal"
  matchStatus: "Auto-Matched" | "Unmatched" | "Manual Match"
  reason?: string
}

export function runBankReconciliation(
  bankLines: { id: string; date: string; desc: string; amount: number; type: "CR" | "DR" }[],
  ledgerLines: { id: string; date: string; desc: string; amount: number; type: "Dr" | "Cr" }[]
): BankReconMatch[] {
  return bankLines.map((bLine) => {
    const bAmt = bLine.amount
    const isDeposit = bLine.type === "CR"

    // Search for matching ledger item
    const match = ledgerLines.find((lLine) => {
      const lAmt = lLine.amount
      const lIsDeposit = lLine.type === "Dr" // General ledger debit is bank receipt/deposit

      // Allow +/- 3 days date window and exact amount
      const bDate = new Date(bLine.date)
      const lDate = new Date(lLine.date)
      const diffTime = Math.abs(bDate.getTime() - lDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      return lAmt === bAmt && lIsDeposit === isDeposit && diffDays <= 3
    })

    return {
      bankLineId: bLine.id,
      ledgerLineId: match ? match.id : null,
      date: bLine.date,
      description: bLine.desc,
      amount: bLine.amount,
      type: isDeposit ? "Deposit" : "Withdrawal",
      matchStatus: match ? "Auto-Matched" : "Unmatched",
      reason: match ? undefined : (isDeposit ? "No corresponding General Ledger receipt found." : "No corresponding GL payment voucher found.")
    }
  })
}
