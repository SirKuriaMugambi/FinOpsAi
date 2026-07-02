# FinOps AI

**Finance operations automation platform for private companies — built on real AP/AR workflows.**

Upload invoices, process tax calculations, reconcile payments, and generate KRA-ready filing outputs — all in one place. Built specifically around the finance workflows of private companies operating in Kenya, including multi-currency invoicing (EUR/USD/KES), KRA VAT/WHT compliance, and Microsoft Dynamics AX integration patterns.

---

## The problem this solves

In a typical private company finance department, the following happen manually every month:

- AP invoices arrive by email or physical copy → printed, scanned, posted into AX one by one
- Tax treatment (zero rated / exempt / 16% VAT) has to be confirmed per vendor per invoice — easy to confuse under pressure
- For foreign currency invoices (EUR/USD), WHT must be calculated using **KRA's official exchange rate for the invoice date** — not the current market rate
- Every invoice posted for WHT needs its **CU invoice number** (KRA ETR/TIMS serial) as the filing reference
- Payments are matched to invoices manually in Excel, then remittance advice is typed up per vendor
- WHT is filed with KRA by the 20th of every month — 2% suppliers via CSV upload, 5% consultants via Excel import
- Customer payments arrive in EUR/USD/KES, customers withhold 2% of the 16% VAT and remit it directly to KRA — you receipt the net and track the certificates

Every one of those steps is manual, error-prone, and time-consuming. FinOps AI automates the calculation, validation, and document generation layers — so the finance team focuses on judgment, not arithmetic.

---

## What it does
## Modules

FinOps AI replaces 16 manual, error-prone steps in Chrysal International Africa's monthly finance cycle with automated, KRA-compliant workflows.

**1. Invoice Processor**
- Problem: Invoices arrive in inconsistent formats and get keyed in manually, causing delays and data entry errors.
- Fix: Automatically extracts and processes invoice data on intake, ready for downstream matching and approval.

**2. 3-Way Matching**
- Problem: Manually cross-checking purchase orders, invoices, and delivery notes is slow and misses discrepancies.
- Fix: Automatically matches PO, invoice, and delivery note line items, flagging mismatches before payment.

**3. AP Reconciliation**
- Problem: Accounts payable balances drift from vendor statements without anyone catching it until month-end.
- Fix: Reconciles AP ledger against vendor records continuously, surfacing discrepancies early.

**4. Bank Reconciliation**
- Problem: Matching bank statement lines to the general ledger by hand is tedious and error-prone.
- Fix: Automates line-item matching between bank statements and the ledger, highlighting unmatched entries.

**5. WHT Calculator**
- Problem: Withholding tax rates differ by transaction type (2% general goods, 5% professional/consultancy), and manual calculation risks KRA non-compliance.
- Fix: Automatically applies the correct WHT rate per transaction and generates KRA-compliant filing output.

**6. AR Receipting**
- Problem: Matching customer receipts to invoices — and correctly applying WVAT (2% of taxable value) — is a manual, error-prone process.
- Fix: Automates receipt-to-invoice matching with built-in WVAT calculation.

**7. Intercompany**
- Problem: Intercompany transactions get recorded inconsistently across entities, complicating consolidation.
- Fix: Tracks and reconciles intercompany transactions in one place.

**8. Payroll**
- Problem: Payroll processing involves multiple manual calculations and compliance checks each month.
- Fix: Automates payroll computation and processing end-to-end.

**9. Budget vs Actual**
- Problem: Spotting budget overruns requires manually pulling and comparing numbers across spreadsheets.
- Fix: Automatically compares actuals to budget by cost centre and flags variances.

**10. Financial Statements**
- Problem: Compiling financial statements manually each period is time-consuming and error-prone.
- Fix: Auto-generates financial statements directly from ledger data.

**11. Month-End Checklist**
- Problem: Month-end close tasks get missed or done out of order without a single source of truth.
- Fix: Tracks every month-end close task and its status in one checklist.

**12. Cash Flow Forecaster**
- Problem: Without a forward view of cash position, the business risks liquidity surprises.
- Fix: Projects future cash flow based on current AP/AR and payment patterns.

**13. Audit Trail**
- Problem: Tracing who changed what, and when, is difficult without a centralized log.
- Fix: Logs every action across the system for full auditability.

**14. Document Store**
- Problem: Finance documents scatter across emails, drives, and desktops, making retrieval slow.
- Fix: Centralizes all finance documents in one searchable repository.

**15. Vendor Master**
- Problem: Inconsistent or outdated vendor data leads to payment errors and duplicate records.
- Fix: Maintains a single, clean source of vendor data across the system.

**16. Chart of Accounts**
- Problem: Inconsistent account coding across teams causes reporting and reconciliation errors.
- Fix: Centralizes and standardizes the chart of accounts used across all modules.

All modules are built on real Chrysal cost centres, approval chains, and vendor master data, with KRA tax compliance logic (WHT and WVAT) validated throughout.






---

## Built on real workflows

This wasn't built from a textbook. The workflows, tax logic, and edge cases (KRA's daily exchange rates for foreign currency WHT, CU invoice numbers as primary KRA filing references, the 2%-via-CSV vs 5%-via-Excel filing split) reflect real AP/AR operations at a private company in Kenya.

Built by Caleb Mugambi (BSc Finance, Multimedia University of Kenya) drawing on internship experience in the AP/AR function at Chrysal International Africa — handling vendor invoices, account reconciliations, VAT/WHT compliance with KRA, and day-to-day work in Microsoft Dynamics AX.

---

## Tech stack

- **Frontend:** Streamlit
- **Data processing:** pandas, pdfplumber, openpyxl
- **Visualization:** Plotly
- **Currency:** live exchange rates via exchangerate-api.com (fallback to cached rates)
- **Export:** ReportLab (PDF), openpyxl (Excel), built-in CSV
- **Language:** Python 3.10+

---

## Project structure

```
finops-ai/
├── app/
│   ├── main.py                  # Entry point, sidebar navigation
│   └── pages/
│       ├── dashboard.py          # Management dashboard
│       ├── invoice_page.py       # Invoice processor
│       ├── recon_page.py         # AP reconciliation
│       ├── wht_page.py           # WHT calculator & KRA filing
│       ├── ar_page.py            # AR receipting & customer WHT
│       └── vendor_page.py        # Vendor master management
├── utils/
│   ├── invoice_engine.py         # Invoice processing & tax logic
│   ├── reconciliation_engine.py  # Payment-invoice matching
│   ├── wht_calculator.py         # WHT calculation & KRA export
│   ├── ar_engine.py              # AR receipting & customer WHT
│   └── currency.py               # Live/cached exchange rates
├── data/
│   ├── tax_config.py             # KRA tax rates, vendor master
└── requirements.txt
```

---

## Running locally

```bash
git clone https://github.com/SirKuriaMugambi/finops-ai.git
cd finops-ai
pip install -r requirements.txt
streamlit run app/main.py
```

---

## Related projects

- [Credit Analysis Automator](https://github.com/SirKuriaMugambi/Credit-analysis-automator) — corporate credit scoring with 19-ratio engine, Altman Z-Score, and ML scorecard
- [FinSight AI](https://github.com/SirKuriaMugambi/Finsight-ai) — AI-powered financial analysis and advisory platform
