# FinOps AI

**Finance operations automation platform for private companies — built on real AP/AR workflows.**

Upload invoices, process tax calculations, reconcile payments, and generate KRA-ready filing outputs — all in one place. Built specifically around the finance workflows of private companies operating in Kenya, including multi-currency invoicing (EUR/USD/KES), KRA VAT/WHT compliance, and Microsoft Dynamics AX integration patterns.

---

## The problem this solves

In a typical private company finance department, the following happen manually every month:

- AP invoices arrive by email or physical copy → printed, scanned, posted into AX one by one
- Tax treatment (zero rated / exempt / 16% / 5% VAT) has to be confirmed per vendor per invoice — easy to confuse under pressure
- For foreign currency invoices (EUR/USD), WHT must be calculated using **KRA's official exchange rate for the invoice date** — not the current market rate
- Every invoice posted for WHT needs its **CU invoice number** (KRA ETR/TIMS serial) as the filing reference
- Payments are matched to invoices manually in Excel, then remittance advice is typed up per vendor
- WHT is filed with KRA by the 20th of every month — 2% suppliers via CSV upload, 5% consultants via Excel import
- Customer payments arrive in EUR/USD/KES, customers withhold 2% of the 16% VAT and remit it directly to KRA — you receipt the net and track the certificates

Every one of those steps is manual, error-prone, and time-consuming. FinOps AI automates the calculation, validation, and document generation layers — so the finance team focuses on judgment, not arithmetic.

---

## What it does

**📄 Invoice Processor**
Upload a PDF or Excel invoice (or enter manually) → app extracts vendor, amounts, dates → confirms VAT treatment from vendor master → calculates WHT → flags mismatches → generates a posting-ready summary for AX. For foreign currency invoices, prompts for KRA's official exchange rate for the invoice date (used exclusively for WHT — the compliance-correct approach).

**🔄 AP Reconciliation**
Upload outstanding invoices + payment records → app matches payments to invoices (exact match and multi-invoice combinations) → flags unmatched items → generates vendor remittance advice documents ready for Finance Manager approval.

**🧾 WHT Calculator & KRA Filing Prep**
Calculates 2% WHT (suppliers) and 5% WHT (consultants) on approved payments, using the correct KRA rate per invoice. Generates a KRA iTax-compatible CSV for 2% bulk upload and a formatted Excel workbook for 5% manual import. Tracks the 20th-of-month filing deadline and raises alerts as it approaches.

**💰 AR Receipting & Customer WHT**
Calculates VAT and customer WHT (2% of 16% VAT) on customer invoices. Matches receipts to outstanding AR invoices, tracks KRA WHT certificate status per invoice, and generates a daily receipting summary.

**🏠 Management Dashboard**
Aggregates all modules: invoice processing status, WHT obligations this month, reconciliation summary, outstanding AR, KRA filing deadline countdown.

**⚙️ Vendor Master**
Manage vendor profiles — name, type, VAT treatment (zero rated / exempt / 16% / 5%), WHT rate (2% / 5% / both), default currency. Drives all tax calculations throughout the app.

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
