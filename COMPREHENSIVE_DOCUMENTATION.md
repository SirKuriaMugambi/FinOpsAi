# FinOpsAi - Comprehensive Application Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Architecture](#core-architecture)
5. [Module Descriptions](#module-descriptions)
6. [Data Models & Structures](#data-models--structures)
7. [Business Logic & Workflows](#business-logic--workflows)
8. [Key Features & Compliance](#key-features--compliance)
9. [How Everything Works End-to-End](#how-everything-works-end-to-end)
10. [Configuration & Settings](#configuration--settings)
11. [Utility Functions](#utility-functions)
12. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

### What is FinOpsAi?

FinOpsAi is a **comprehensive finance operations automation platform** designed specifically for private companies operating in Kenya. It automates the complete monthly finance cycle, from daily invoice processing to month-end close and CEO-level reporting.

### Target Organization

- **Primary User**: Chrysal International Africa (a private manufacturing/trading company)
- **Geography**: Kenya (KES-based, with multi-currency support)
- **Regulatory Compliance**: KRA (Kenya Revenue Authority) tax compliance, WHT (Withholding Tax), VAT, and intercompany transaction tracking
- **Integration**: Built with patterns compatible with Microsoft Dynamics AX

### Core Problem Solved

Traditional finance teams manually execute 16 time-consuming, error-prone steps every month:
- Invoice entry and tax treatment verification
- WHT calculation using KRA exchange rates
- Payment matching against invoices
- VAT and WHT filing with KRA
- Bank statement reconciliation
- Financial statement preparation
- Month-end checklist tracking

**FinOpsAi Solution**: Automates the calculation, validation, and document generation layers while preserving human judgment for exceptions and approvals.

---

## Technology Stack

### Backend & Framework
- **Python 3.x** - Core application language
- **Streamlit 1.50.0+** - Web UI framework (lightweight, rapid development for data apps)
- **Pandas 2.0.0+** - Data manipulation and DataFrames
- **NumPy 1.26.0+** - Numerical computing

### Document Processing
- **pdfplumber 0.11.0+** - PDF text and table extraction (invoices)
- **openpyxl 3.1.0+** - Excel file reading/writing
- **reportlab 4.0.0+** - PDF generation (reports, remittance advice)

### API & External Services
- **Anthropic 0.100.0+** - Claude AI for advanced document understanding (optional)
- **requests 2.31.0+** - HTTP client for external APIs (exchange rates)

### Data & Timezone Handling
- **pytz 2024.1+** - Timezone management (Africa/Nairobi for consistent timestamps)
- **python-dotenv 1.0.0+** - Environment variable management

### Visualization
- **Plotly 5.20.0+** - Interactive charts and dashboards

---

## Project Structure

```
FinOpsAi/
├── README.md                          # High-level project overview
├── requirements.txt                   # Python dependencies
├── COMPREHENSIVE_DOCUMENTATION.md     # This file
│
├── app/                               # Streamlit application
│   ├── __init__.py
│   ├── main.py                        # Entry point, navigation router, session state
│   │
│   └── modules/                       # 17 feature modules (UI layer)
│       ├── __init__.py
│       ├── dashboard.py               # KPI overview, financial snapshots
│       ├── enhanced_invoice_page.py   # Invoice upload, processing, approval
│       ├── three_way_match_page.py    # PO ↔ Invoice ↔ Delivery Note matching
│       ├── recon_page.py              # AP reconciliation (vendor statement matching)
│       ├── bank_recon_page.py         # Bank statement reconciliation
│       ├── wht_page.py                # WHT calculator & KRA filing preparation
│       ├── ar_page.py                 # AR receipting, customer WHT tracking
│       ├── intercompany_page.py       # Intercompany transaction tracking
│       ├── payroll_page.py            # Payroll processing automation
│       ├── budget_page.py             # Budget vs actual variance analysis
│       ├── financial_statements_page.py # Trial balance, P&L, balance sheet
│       ├── monthend_page.py           # Month-end close checklist & workflow
│       ├── cashflow_page.py           # Cash flow forecasting
│       ├── audit_page.py              # Audit trail viewing & export
│       ├── document_store_page.py     # Centralized document repository
│       ├── vendor_page.py             # Vendor master data management
│       └── coa_page.py                # Chart of accounts & cost centre setup
│
├── data/                              # Static data & configuration
│   ├── __init__.py
│   ├── tax_config.py                  # KRA tax rules, vendor master, WHT/VAT rates
│   └── chart_of_accounts.py           # Chart of accounts, cost centres, approval chains
│
└── utils/                             # Shared business logic & engines
    ├── __init__.py
    ├── wht_calculator.py              # KRA-compliant WHT calculation & filing
    ├── currency.py                    # Exchange rate fetching, currency conversion
    ├── invoice_engine.py              # PDF/Excel invoice extraction & processing
    ├── reconciliation_engine.py       # AP payment-to-invoice matching
    ├── ar_engine.py                   # AR receipting & customer WHT logic
    └── audit_trail.py                 # Immutable audit logging for compliance

```

---

## Core Architecture

### Application Architecture Pattern

**Multi-tier Streamlit Architecture**:
1. **Presentation Layer** (`app/modules/`) - Streamlit UI components for each feature
2. **Business Logic Layer** (`utils/`) - Reusable calculation engines and processors
3. **Data Layer** (`data/`) - Static configuration, master data, tax rules
4. **Session State** - Streamlit session management for user context and data persistence within browser session

### Key Design Principles

1. **Separation of Concerns**
   - Business logic lives in `utils/` (no Streamlit imports)
   - UI logic lives in `app/modules/` (imports utils)
   - Configuration data lives in `data/`

2. **Single Source of Truth**
   - Master data (vendors, chart of accounts, tax rules) defined once in `data/`
   - Referenced by all modules via imports

3. **Immutable Audit Trail**
   - Every financial action logged to session state (non-deletable, append-only)
   - Enables KRA compliance and forensic analysis

4. **Multi-Currency Support**
   - All calculations can handle KES, USD, EUR, GBP
   - Exchange rates cached with fallback to prevent crashes

5. **KRA Tax Compliance Built-In**
   - WHT calculations use KRA-approved rates
   - CU invoice numbers tracked for filing
   - Filing deadlines calculated in Nairobi timezone

---

## Module Descriptions

### 1. Dashboard (`dashboard.py`)

**Purpose**: High-level financial overview and KPI metrics

**Sample Data Pre-loading**:
The dashboard automatically pre-loads sample data on first visit so users see realistic metrics immediately (prevents "empty" dashboard on first load):
- 3 sample processed invoices (Bayer, DHL, Deloitte) with realistic amounts
- 3 sample WHT payment entries with 2% and 5% rates
- Dashboard never shows empty state

**Displays**:
- **Metrics**: Total invoices processed, WHT entries flagged, reconciled items, AR receipts matched
- **Invoice Summary Pie Chart**: "Ready to Post" vs "Flagged for Review"
- **Total Values**:
  - Total invoice value (KES)
  - Total WHT withheld (KES)
- **WHT Filing Status**:
  - Days until KRA deadline (20th of month)
  - Status flags (🚨 URGENT if < 3 days, ⚠️ if < 7 days)
  - Displays filing deadline date in Nairobi timezone
- **AP Summary** (if available):
  - Outstanding AP by vendor
  - Days overdue metrics
- **AR Summary** (if available):
  - Outstanding AR by customer
  - Days outstanding metrics
  - WHT certificates pending/received

**Data Flow**: 
Reads from `st.session_state`:
- `processed_invoices` → Invoice metrics
- `wht_payments` → WHT summary
- `recon_result` → AP matching metrics
- `ar_result` → AR matching metrics

---

### 2. Enhanced Invoice Page (`enhanced_invoice_page.py`)

**Purpose**: Upload, extract, validate, and approve vendor invoices for AP processing

**Workflow**:
1. **Upload**: User uploads invoice (PDF or Excel)
2. **Extract**: System extracts key fields automatically:
   - Vendor name
   - Invoice number
   - Invoice date
   - Subtotal, VAT amount, total
   - Currency
   - CU invoice number (KRA reference)
   - Line items (if available)

3. **Validate**: System matches vendor to master data and prefills:
   - VAT treatment (Standard 16% / Zero Rated / Exempt)
   - WHT type (2% General / 5% Consultancy / Exempt)
   - Default cost centre, department, GL account

4. **Manual Override**: User can correct any auto-detected fields
   - Especially important for foreign currency invoices where KRA exchange rate must be manually verified

5. **Approval**: User assigns to appropriate approver based on cost centre and amount
   - Production invoices → Harrison
   - Finance/consultancy → Tony or Mercy
   - Large amounts → Charles (Business Controller)

6. **Post**: Upon approval, invoice is added to `st.session_state.processed_invoices` and logged to audit trail

**Key Data Fields**:
```python
invoice = {
    "vendor_name": str,
    "vendor_id": str,
    "invoice_number": str,
    "invoice_date": date,
    "due_date": date,
    "subtotal": float,           # Before VAT
    "vat_treatment": str,        # Standard/Zero/Exempt
    "vat_amount": float,
    "total": float,              # After VAT
    "currency": str,             # KES/USD/EUR/GBP
    "cu_invoice_number": str,    # KRA reference
    "wht_type": str,             # 2%/5%/Exempt
    "line_items": list,          # PO matching
    "cost_centre": str,
    "gl_account": str,
    "department": str,
    "approved_by": str,
    "approval_date": date,
    "status": str,               # Draft/Pending/Approved/Posted
}
```

---

### 3. 3-Way Matching (`three_way_match_page.py`)

**Purpose**: Automatically verify purchase orders, invoices, and delivery notes match before payment

**Matching Logic**:
- **PO Match**: Invoice vendor and line items match purchase order
- **Quantity Match**: Delivered quantity matches both PO and invoice quantity
- **Price Match**: Unit prices and totals match (within tolerance)
- **Delivery Note Match**: Invoice references correct delivery note, dates are consistent

**Discrepancies Flagged**:
- ❌ Quantity variance > tolerance
- ❌ Price variance > tolerance
- ❌ Missing delivery note
- ❌ Invoice amount exceeds PO commitment
- ⚠️ Partial shipment (needs approval)

**Output**: Cleared for payment or flagged for investigation

---

### 4. AP Reconciliation (`recon_page.py`)

**Purpose**: Continuously match payments made against outstanding vendor invoices

**Matching Algorithm**:
1. **Exact Match** (High Confidence ✅)
   - Single invoice matches payment amount exactly (within KES 0.50 tolerance)
   - Confidence: ✅ Exact match

2. **Multi-Invoice Match** (Medium Confidence 🟡)
   - Multiple invoices from same vendor sum to payment amount
   - Confidence: 🟡 Multi-invoice match — verify

3. **No Match** (Requires Investigation ❌)
   - Payment amount doesn't match any vendor invoice
   - Flagged for Finance team to investigate

**Key Calculations**:
- All amounts converted to KES using live exchange rates
- Tolerance: KES 0.50 (handles rounding differences)
- Unmatched items reported with reason codes

**Output**:
- Reconciliation report (matched, unmatched payments, outstanding invoices)
- Remittance advice (vendor name, payment dates, amounts)
- Discrepancy report for investigation

---

### 5. Bank Reconciliation (`bank_recon_page.py`)

**Purpose**: Match bank statement lines to general ledger entries

**Process**:
1. Upload bank statement (CSV or Excel)
2. Upload general ledger extract (from AX)
3. System auto-matches:
   - Deposits to AR receipts (by date, amount)
   - Cheques to AP payments (by cheque number, amount)
   - Transfers to intercompany entries

4. Highlights unmatched items:
   - Bank deposits with no GL entry (unrecorded receipts)
   - GL payments with no bank record (pending cheques)
   - Bank charges not recorded in GL

**Output**: Bank reconciliation statement and variance report

---

### 6. WHT Calculator (`wht_page.py`)

**Purpose**: Calculate and file Withholding Tax (Zamikaji) with KRA

### Critical KRA Compliance Logic

**WHT on Vendor Payments (AP Side)**:
- **2% WHT**: Applied to general goods/contractual services (default)
- **5% WHT**: Applied to professional/consultancy services
- **Calculation Base**: Subtotal ONLY (before VAT) — VAT is excluded from WHT base
- **Payment Formula**: Gross Invoice = Subtotal + VAT; Net to Vendor = Gross − WHT
- **KRA Exchange Rate**: For foreign currency invoices, WHT in KES must use KRA's official daily rate (not market rate or bank rate)
  - User manually enters KRA rate for invoice date
  - Rate stored with invoice for audit trail
  - Different from live market rate shown on dashboard

**WHT on Customer Receipts (AR Side)**:
- **2% of Taxable Value**: Customers withhold 2% on the net invoice amount (before VAT)
- **Customer Files with KRA**: Customer remits withheld amount directly to KRA
- **Chrysal Receipts Net**: Chrysal receives payment minus customer's 2% withholding
- **KRA Certificate**: Customer provides certificate; Chrysal claims recovery via input tax

**Filing Requirements**:
- **Deadline**: 20th of every month
- **2% Suppliers**: CSV upload to KRA iTax portal (bulk upload)
- **5% Consultants**: Excel import or manual filing
- **Required Fields per Entry**:
  - Vendor PIN
  - Vendor name
  - CU Invoice Number (from ETR/TIMS)
  - Invoice date
  - Payment date
  - Gross amount
  - WHT amount
  - Payment reference

**Process Flow**:
1. Select approved payments from month
2. System calculates WHT per vendor per invoice
3. Generates KRA-format CSV file (2%) and Excel summary (5%)
4. User reviews totals and deadline
5. File downloaded and uploaded to KRA portal or Excel sheet provided to KRA filing agent
6. System records filing in audit trail with timestamp

---

### 7. AR Receipting (`ar_page.py`)

**Purpose**: Track customer payments received and reconcile against AR invoices

**Customer Payment Formula** (Per KRA Withholding VAT Rules):
```
Invoice Details:
- Net Amount: XYZ
- VAT (16%): XYZ × 16%
- Gross Invoice: XYZ + VAT
- Customer WHT (2% of net): XYZ × 2%
- Expected Receipt: Gross − WHT = (XYZ + VAT) − (XYZ × 2%)

What Happens:
1. Customer calculates 2% of net amount (XYZ × 2%)
2. Customer remits that 2% directly to KRA (on Chrysal's behalf)
3. Customer pays Chrysal: Gross amount − 2% WHT
4. Chrysal receipts the net payment
5. Chrysal claims the withheld 2% via KRA portal (track as receivable)
```

**Matching Logic**:
1. Calculate expected receipt per invoice (Gross − 2% WHT)
2. Match received payment to expected receipt amount
3. If matched, record KRA certificate status (Pending/Received/Discrepancy)
4. Track WHT to claim (will be recovered as input tax when certificates arrive)

**Output**:
- AR reconciliation (matched receipts, outstanding invoices)
- Customer certificate tracking (for KRA claims)
- WHT recovery summary

---

### 8. Intercompany (`intercompany_page.py`)

**Purpose**: Track and reconcile transactions between related entities

**Related Entity**: Chrysal BV (Netherlands parent company)

**Types of Transactions**:
- Sales to Chrysal BV (export revenue in EUR/USD)
- Purchases from Chrysal BV (imports of raw materials)
- Management fees or allocation of head office costs
- Loans or advances between entities

**Reconciliation Process**:
1. Chrysal Africa records intercompany invoice to Chrysal BV
2. Chrysal BV records matching payable in their system
3. Amounts reconciled (typically USD or EUR)
4. Transfer pricing policy documented
5. Month-end reconciliation confirms balances match

**GL Accounts Used**:
- 1110: Accounts Receivable - Intercompany (Chrysal BV) [Asset]
- 2010: Accounts Payable - Intercompany (Chrysal BV) [Liability]
- 4200: Intercompany Revenue (Chrysal BV) [Revenue]
- 7100: Intercompany Charges (Chrysal BV) [Expense]

---

### 9. Payroll (`payroll_page.py`)

**Purpose**: Automate monthly payroll processing and compliance

**Process**:
1. Import employee master (names, grades, rates, deductions)
2. Input attendance/hours for month
3. System calculates:
   - Gross salary
   - NSSF contribution (5% employee, 5% employer)
   - NHIF contribution (standard rate)
   - PAYE tax (per KRA tables)
   - Personal relief
   - Deductions (loans, advances)
   - Net pay

4. Generate payroll summary:
   - Individual payslips
   - Payroll register
   - NSSF/NHIF remittance advice
   - PAYE tax remittance to KRA

5. Post to GL:
   - Dr: 6000 (Salaries & Wages)
   - Dr: 6010 (NSSF/NHIF Contributions)
   - Cr: 2300 (Payroll Payable)
   - Cr: 2100 (Taxes Payable)

**Audit Trail**: Every payroll run logged with operator, date, adjustments

---

### 10. Budget vs Actual (`budget_page.py`)

**Purpose**: Track spending against approved budget and flag variances

**Process**:
1. Upload approved budget (by cost centre, GL account, month)
2. System pulls actual spend from processed invoices
3. Calculate variance:
   - Favorable (actual < budget): ✅
   - Unfavorable (actual > budget): ⚠️
   - By percentage and absolute amount

4. Drill-down capability:
   - By cost centre (511 = Production, 208 = Customer Service, etc.)
   - By GL account (5000 = COGS, 6100 = Rent, etc.)
   - By time period

5. Highlight items exceeding tolerance (typically 5-10% variance)

**Uses**: Monthly forecasting, cost control, manager accountability

---

### 11. Financial Statements (`financial_statements_page.py`)

**Purpose**: Auto-generate formal financial statements from ledger data

**Outputs**:
1. **Trial Balance**: All GL accounts with debit/credit balances
2. **Income Statement** (P&L):
   - Revenue section (4000-4200)
   - Cost of Sales (5000-5400)
   - Operating Expenses (6000-7200)
   - Profit/(Loss) before tax

3. **Balance Sheet**:
   - Assets (1000-1500): Cash, AR, Inventory, Fixed Assets
   - Liabilities (2000-2400): AP, Taxes Payable, Loans Payable
   - Equity (3000-3200): Share Capital, Retained Earnings

4. **Cash Flow Statement** (optional): Operating, investing, financing cash flows

**Features**:
- Comparative (month-to-date vs prior year)
- Formatted with proper indentation and subtotals
- KES-based with optional USD equivalent

---

### 12. Month-End Checklist (`monthend_page.py`)

**Purpose**: Standardize and track month-end close activities

**Pre-built Checklist**:
- [ ] All invoices received and entered
- [ ] 3-way matching complete (PO ↔ Invoice ↔ Delivery)
- [ ] AP reconciled to vendor statements
- [ ] Bank reconciliation completed
- [ ] WHT calculated and filed with KRA (by 20th)
- [ ] AR receipts matched to invoices
- [ ] Customer WHT certificates tracked
- [ ] Payroll processed and posted
- [ ] Budget vs actual reviewed
- [ ] Intercompany balances reconciled
- [ ] Month-end adjustments entered (accruals, provisioning)
- [ ] Trial balance pulled
- [ ] Financial statements reviewed
- [ ] Month-end report sent to management
- [ ] Audit trail exported and archived

**Task Management**:
- Assign task to user
- Mark as In Progress / Complete / On Hold
- Track completion date and approver
- Auto-calculate close status (% complete)

**Notifications**: Highlights incomplete items nearing deadline

---

### 13. Cash Flow Forecaster (`cashflow_page.py`)

**Purpose**: Project future cash position based on AP/AR and payment patterns

**Inputs**:
- Outstanding AP (from reconciliation)
- Outstanding AR (from receipting)
- Scheduled payments (payroll, fixed costs)
- Expected receipts (customer seasonality)

**Process**:
1. Analyze historical payment patterns (days-to-pay by vendor)
2. Analyze historical collection patterns (days-to-receipt by customer)
3. Project forward 90 days:
   - Week 1: Expected receipts − expected payments
   - Week 2-4: Rolling forecast with seasonality
   - Month 2-3: Longer-range forecast

4. Highlight cash shortfall periods (negative forecast)
5. Recommend financing needs or payment timing adjustments

**Output**: Cash flow waterfall chart showing beginning cash + receipts − payments = ending cash

---

### 14. Audit Trail (`audit_page.py`)

**Purpose**: Provide complete, immutable record of all financial actions for compliance

**Logged Actions**:
```
INVOICE UPLOADED       - user, file, date
INVOICE PROCESSED      - user, vendor, amount, date
INVOICE APPROVED       - approver, vendor, amount, date
INVOICE REJECTED       - approver, reason, date
INVOICE POSTED         - user, GL accounts affected, date
WHT CALCULATED         - user, total WHT, filing deadline, date
WHT FILED              - user, KRA reference, amount, date
PAYMENT PROCESSED      - user, vendor, amount, cheque/reference, date
RECONCILIATION RUN     - user, matched count, unmatched count, date
RECON APPROVED         - approver, date
BUDGET UPLOADED        - user, period, total budget, date
ACTUAL ENTERED         - user, cost centre, amount, date
INTERCOMPANY CONFIRMED - user, counterparty, amount, date
MONTH_END TASK         - user, task description, status change, date
DOCUMENT DELETED       - user, document ID, reason (if provided), date
USER LOGIN             - user, timestamp, timezone
APPROVAL CHAIN UPDATED - admin, change description, date
```

**Access Control**:
- All users can view their own actions
- Managers can view team actions
- Audit can export full trail
- No deletion or modification possible (append-only)

**Export**: Download full audit trail as CSV or Excel with filters (date range, user, action type, document)

---

### 15. Document Store (`document_store_page.py`)

**Purpose**: Centralized repository for all finance documents with full-text search

**Documents Stored**:
- Original invoices (PDF)
- Delivery notes
- Purchase orders
- Bank statements
- Payroll records
- KRA filing confirmations
- Customer WHT certificates
- Approval emails
- Month-end reports

**Features**:
- Upload documents with tags (invoice, PO, bank statement, etc.)
- Associate documents with GL transactions
- Full-text search (find invoice by vendor name or invoice number)
- Retention policy (auto-archive after 7 years per tax law)
- Access logs (who viewed which documents)

**Benefits**: Easy retrieval during audits, no more document hunting across emails and drives

---

### 16. Vendor Master (`vendor_page.py`)

**Purpose**: Centralized management of vendor master data

**Vendor Fields**:
```python
vendor = {
    "vendor_id": str,           # V001, V002, etc.
    "name": str,
    "type": str,                # Supplier / Consultant / Logistics
    "tax_id_pin": str,          # KRA PIN (for WHT filing)
    "contact_person": str,
    "email": str,
    "phone": str,
    "bank_account": str,        # For remittance
    "vat_treatment": str,       # Standard 16% / Zero Rated / Exempt
    "wht_type": str,            # 2% / 5% / Exempt
    "currency": str,            # Default currency (KES/USD/EUR)
    "default_ledger": str,      # Default GL account (e.g., 5000 for COGS)
    "default_department": str,  # OPS / FIN / TC / CS / ADM
    "default_cost_centre": str, # 511 / 121 / 208 / 206
    "payment_terms": str,       # Net 30, Net 60, etc.
    "discount_terms": str,      # 2/10 Net 30, etc.
    "status": str,              # Active / Inactive / On Hold
    "notes": str,
}
```

**Operations**:
- Add new vendor (prefill with defaults, validate PIN)
- Edit vendor (update payment terms, WH treatment, contact)
- Deactivate vendor (can't be used for new invoices)
- Merge duplicate vendors (consolidate transactions)
- View vendor transaction history

**Seeded Data**: Default vendors included (Bayer East Africa, DHL Express, Deloitte, etc.) based on Chrysal's real vendor base

---

### 17. Chart of Accounts (`coa_page.py`)

**Purpose**: Manage chart of accounts, cost centres, and approval chains

**Accounts Structure** (standard trading/manufacturing company):
- **1000-1500**: Assets (Cash, AR, Inventory, Fixed Assets)
- **2000-2400**: Liabilities (AP, Taxes Payable, Loans)
- **3000-3200**: Equity (Share Capital, Retained Earnings)
- **4000-4200**: Revenue (Sales, Consultancy, Intercompany)
- **5000-5400**: Cost of Sales (COGS, Materials, Labour, Freight)
- **6000-7200**: Operating Expenses (Salaries, Rent, Utilities, Consultancy, Travel, etc.)

**Cost Centres** (real Chrysal structure):
- **121**: Finance (FIN department)
- **208**: Customer Service (CS department)
- **206**: Technical Consultants (TC department)
- **511**: Production (OPS department)
- **000**: General/Unallocated (ADM department)

**Approval Chain** (by transaction type and amount):
```
Production/Freight-in → Harrison (Production Manager)
Production Consumables → Harrison (Production Manager)
Consultancy/Professional → Tony (Finance Manager)
Customer Service → Mercy (Senior Accountant)
Finance/Accounting → Charles (Business Controller)
Large transactions > 500K KES → Charles (Business Controller) + Niels (MD)
```

**Operations**:
- Add GL account (number, name, type, department, cost centre)
- Edit account properties
- Add cost centre
- Update approval chain (assign approvers by cost centre and amount)

---

## Data Models & Structures

### Session State Variables

Stored in `st.session_state` and maintained for duration of browser session:

```python
st.session_state = {
    # User context
    "current_user": str,                      # "Mercy", "Tony", "Harrison", etc.

    # Master data
    "vendors": list[dict],                    # Vendor master
    "rates": dict,                            # {"USD": 129.50, "EUR": 140.20, ...}
    "rates_live": bool,                       # True if from live API, False if cached

    # Processed transactions
    "processed_invoices": list[dict],         # Invoices uploaded and extracted
    "wht_payments": list[dict],               # Payments processed for WHT filing
    "recon_result": dict,                     # Result of last AP reconciliation
    "ar_result": dict,                        # Result of last AR matching

    # Audit trail
    "audit_trail": list[dict],                # Immutable log of all actions
}
```

### Invoice Data Structure

```python
invoice = {
    "id": str,                                # UUID or sequence
    "vendor_name": str,
    "vendor_id": str,
    "invoice_number": str,                    # Vendor's invoice #
    "cu_invoice_number": str,                 # KRA CU # (ETR/TIMS)
    "invoice_date": date,
    "due_date": date,
    "subtotal": float,                        # Before VAT
    "vat_treatment": str,                     # "Standard (16%)" / "Zero Rated (0%)" / "Exempt"
    "vat_amount": float,
    "total": float,                           # After VAT
    "currency": str,                          # KES / USD / EUR / GBP
    "kra_exchange_rate": float,               # KRA rate for the invoice date (if foreign currency)
    "line_items": list[dict],                 # [{"description": "...", "qty": 10, "unit_price": 100, ...}]
    "cost_centre": str,                       # 511, 208, 206, 121
    "department": str,                        # OPS, CS, TC, FIN
    "gl_account": str,                        # 5000, 6500, etc.
    "wht_type": str,                          # "General Goods/Contractual (2%)" / "Professional/Consultancy (5%)" / "Exempt"
    "status": str,                            # Draft / Pending Approval / Approved / Posted / Rejected
    "approved_by": str,                       # Name of approver
    "approval_date": datetime,
    "posted_date": datetime,
    "notes": str,
}
```

### Payment & WHT Data Structure

```python
payment = {
    "vendor_name": str,
    "vendor_id": str,
    "vendor_pin": str,                        # KRA tax ID
    "invoice_ref": str,
    "cu_invoice_number": str,                 # KRA reference for filing
    "amount": float,                          # Base/subtotal (before VAT)
    "vat_amount": float,
    "currency": str,
    "kra_rate_used": float,                   # KRA exchange rate for foreign currency
    "wht_type": str,                          # 2% / 5%
    "wht_rate": float,
    "wht_amount": float,                      # Withheld amount in KES
    "net_payment": float,                     # Amount paid to vendor (Gross - WHT)
    "payment_date": date,
    "payment_ref": str,                       # Cheque # or bank transfer reference
    "kra_filed": bool,
    "kra_filing_date": datetime,
}
```

---

## Business Logic & Workflows

### Workflow 1: Invoice Processing (End-to-End)

**Trigger**: Invoice received by email or printed

**Steps**:
1. **Upload**: User selects PDF or Excel file
2. **Extract**: `invoice_engine.extract_invoice_from_pdf()` or `extract_invoice_from_excel()` runs
   - Uses regex patterns to find invoice #, date, vendor name, amounts
   - Extracts tables for line items
   - Detects currency (USD, EUR, GBP, KES)
   - Looks for CU invoice number

3. **Match Vendor**: System looks up vendor in `DEFAULT_VENDORS`
   - If found: auto-prefill VAT treatment, WHT type, GL account, cost centre
   - If not found: user manually selects vendor or creates new one

4. **Validate**:
   - Invoice total = subtotal + VAT
   - Currency consistent with vendor's default
   - For foreign currency: user enters KRA exchange rate for invoice date

5. **3-Way Match** (if PO exists):
   - User uploads PO and delivery note
   - System compares quantities, unit prices, totals
   - Flags discrepancies (quantity, price, missing delivery note)

6. **Approval**:
   - System routes to appropriate approver based on GL account / cost centre / amount
   - Approver reviews extracted fields, 3-way match results
   - Approver clicks "Approve" or "Reject"
   - If approved, audit log entry created
   - If rejected, user revises and resubmits

7. **Posted**: Approved invoice added to ledger (conceptually, in `st.session_state.processed_invoices`)
   - Ready for AP reconciliation
   - Ready for WHT calculation (if applicable)

---

### Workflow 2: Payment & WHT Filing (End-to-End)

**Trigger**: Month-end, need to remit WHT to KRA by 20th

**Steps**:
1. **Select Approved Payments**: Finance manager filters processed invoices by:
   - Invoice date in month X
   - Status = Approved
   - Currency (KES / USD / EUR)

2. **Calculate WHT**: `wht_calculator.calculate_wht_for_payments()` processes each payment:
   - For each payment:
     - Get WHT rate (2% or 5%) from vendor master
     - Calculate: WHT = (Subtotal × WHT Rate)
     - Convert to KES using:
       - Live market rate if KES
       - User-entered KRA rate if foreign currency (THIS IS CRITICAL)
     - Separate into 2% bucket (general goods) and 5% bucket (professional services)

3. **Generate Files**:
   - **2% CSV**: Uses `wht_calculator.generate_kra_csv()` 
     - Format: Vendor PIN, Name, CU Invoice #, Invoice Date, Payment Date, Gross Amount, WHT Amount, Payment Ref
     - Ready for KRA iTax portal bulk upload
   
   - **5% Excel**: Uses pandas ExcelWriter
     - Sheet 1: 2% WHT entries (if any)
     - Sheet 2: 5% WHT entries
     - Sheet 3: Summary (totals, deadline, generated timestamp)

4. **Review**: User reviews totals
   - Shows deadline calculation (KRA deadline: 20th of month, calculated in Nairobi timezone)
   - Shows days remaining
   - If < 3 days: 🚨 URGENT flag
   - If < 7 days: ⚠️ warning flag

5. **Download & File**: User downloads CSV or Excel
   - Uploads CSV to KRA iTax portal (for 2% bulk)
   - Provides Excel to KRA filing agent or uploads manually (for 5%)
   - Takes screenshot of KRA receipt

6. **Log Filing**: User records filing confirmation
   - System logs: `log_action(user, "WHT FILED", invoice_ref, details, amount, "KES", ...)`
   - Audit trail shows: date, time (Nairobi), user, WHT amount, KRA reference

---

### Workflow 3: AP Reconciliation (End-to-End)

**Trigger**: Month-end, need to reconcile AP balance to vendor statements

**Steps**:
1. **Collect Data**:
   - Pull outstanding invoices from `st.session_state.processed_invoices` (status = Approved or Posted)
   - User uploads bank export showing payments made (date, vendor, amount, currency)

2. **Load & Normalize**:
   - `reconciliation_engine.load_invoices_from_df()` parses invoice DataFrame
   - `reconciliation_engine.load_payments_from_df()` parses payment DataFrame

3. **Convert to KES**:
   - All foreign currency amounts converted to KES using live rates
   - Tolerance: 0.50 KES (rounding differences)

4. **Match**:
   - For each payment, find matching invoice(s):
     - **Exact Match**: Payment amount = Single invoice amount → ✅ Matched
     - **Multi-Invoice Match**: Payment amount = Sum of 2+ invoices → 🟡 Multi-invoice (verify)
     - **No Match**: No invoice found → ❌ Unmatched

5. **Generate Report**:
   ```
   Matched Payments: 15 payments, 2,500,000 KES
   - Vendor A: 500,000 KES (Invoice #INV-001) ✅ Exact match
   - Vendor B: 750,000 KES (Invoices #INV-002 + #INV-003) 🟡 Multi-invoice

   Unmatched Payments: 2 payments, 150,000 KES
   - Vendor C: 100,000 KES (No matching invoice) ❌
   - Vendor D: 50,000 KES (No matching invoice) ❌

   Outstanding Invoices (unpaid): 5 invoices, 300,000 KES
   - Vendor E: 200,000 KES (Invoice #INV-005, due 2026-07-10)
   - Vendor A: 100,000 KES (Invoice #INV-006, due 2026-07-15)
   ```

6. **Investigate Discrepancies**: Finance team follows up on unmatched items
   - Contact vendor to confirm payment sent
   - Check if vendor payment went to wrong vendor account
   - Check if payment not yet received by vendor

7. **Approve Recon**: Once reconciled, manager clicks "Approve Reconciliation"
   - Audit log: `log_action("Mercy", "RECON APPROVED", ..., ...)`
   - AP balance now reconciled for period

---

### Workflow 4: AR Receipting & Customer WHT Tracking

**Trigger**: Customer payment received, need to match to AR invoice and track WHT

**Customer Payment Formula** (Critical KRA Logic):
```
1. Chrysal invoices customer:
   - Net Amount: 100,000 KES
   - VAT (16%): 16,000 KES
   - Gross Invoice: 116,000 KES

2. Customer withholds 2% of NET (taxable value):
   - WHT = 100,000 × 2% = 2,000 KES
   - Customer remits 2,000 KES directly to KRA

3. Customer pays Chrysal:
   - Payment = Gross − WHT = 116,000 − 2,000 = 114,000 KES

4. Chrysal books receipt:
   - Dr: Cash 114,000
   - Cr: AR 116,000
   - Dr: WHT Recoverable 2,000 (to claim when certificate received)

5. When customer provides KRA certificate:
   - Chrysal claims 2,000 KES via input tax recovery
```

**Steps**:
1. **Enter Receipt**: User enters customer payment details
   - Customer name
   - Receipt reference
   - Amount received (KES)
   - Date received

2. **Calculate Expected**:
   - Pull outstanding AR invoices for customer
   - For each invoice: Calculate Expected = (Net + VAT) − (Net × 2%)
   - Example: (100,000 + 16,000) − (100,000 × 2%) = 114,000 KES

3. **Match**:
   - Compare received amount to expected amount
   - If match (within tolerance): ✅ Matched
   - If no match: ❌ Unmatched (investigate)

4. **Track WHT Certificate**:
   - For matched receipt: Ask "Have you received KRA certificate from customer?"
   - Status options: Pending / Received / Discrepancy
   - When certificate received: user uploads document, system records date and certificate #

5. **Generate Report**:
   ```
   AR Receipting Summary:
   - Total matched receipts: 5 receipts, 1,200,000 KES
   - Total WHT to claim: 120,000 KES
   - Pending KRA certificates: 3 (waiting for customers to file)
   - Received KRA certificates: 2 (ready for input tax claim)
   ```

---

## Key Features & Compliance

### Invoice Validation & Flagging System

One of the critical undocumented features is the automatic validation and warning system built into invoice processing:

**Tax Validation Warnings**:

1. **VAT Amount Mismatch** ⚠️
   - System calculates VAT based on vendor's VAT treatment
   - If calculated VAT differs from invoice VAT by > 1 KES: flags warning
   - User cannot post until issue resolved
   - Example: "VAT mismatch: Invoice shows 16,000 KES but 16% rate gives 15,920 KES. Verify before posting."

2. **Foreign Currency KRA Rate Missing** ⚠️
   - For USD/EUR/GBP invoices: if no KRA official rate entered, flags warning
   - System calculates WHT using market rate BUT notes this is non-compliant
   - User must manually enter KRA's official exchange rate for invoice date
   - Example: "⚠️ KRA rate not entered for this USD invoice. WHT calculated using market rate (KES 129.50 per USD). For compliance, enter KRA's official rate for 2026-06-15."

3. **Posting Ready Flag**:
   - `posting_ready: true` → All validations passed, safe to post
   - `posting_ready: false` → Tax warnings flagged, user must resolve before posting

**Implementation**: All validation happens in `process_invoice()` function, which returns:
```python
return {
    ...
    "tax_flag": str or None,        # Warning message if issue detected
    "kra_rate_warning": str or None, # Warning if no KRA rate for FX invoice
    "posting_ready": bool,           # False if any warnings
}
```

Users see these warnings in the UI and cannot post flagged invoices until warnings are addressed.

### 1. KRA Tax Compliance

**VAT Management**:
- Standard Rated (16%): Most supplies
- Zero Rated (0%): Exports, specific goods
- Exempt: Services, specific items (no VAT, no input credit)

**WHT Management**:
- 2% on general goods/contractual services (vendors)
- 5% on professional/consultancy services (consultants)
- Customer 2% WHT on 16% VAT (AR side, customer remits directly to KRA)

**CU Invoice Number**:
- Mandatory for KRA filing
- Unique identifier issued by ETR (Electronic Tax Register) or TIMS (Tax Invoice Management System)
- All WHT entries must reference CU number
- Enables KRA to cross-reference filing with their records

**Exchange Rate for Foreign Currency WHT**:
- CRITICAL: Cannot use live market rate or bank rate
- Must use KRA's official daily rate published on kra.go.ke
- User manually enters KRA rate for invoice date
- Rate stored per invoice for audit trail
- Ensures WHT remittance amount matches KRA's records

**Filing Deadlines**:
- 20th of every month (Nairobi timezone)
- Calculated in application using `Africa/Nairobi` timezone
- System flags when < 7 days remaining
- Emergency flag when < 3 days remaining

---

### 2. Multi-Currency Support

**Supported Currencies**: KES, USD, EUR, GBP

**Exchange Rates**:
- Live rates fetched from exchangerate-api.com (no API key needed)
- Falls back to cached rates if API unavailable (prevents crash)
- Updated on demand (user can click "Refresh rates")

**Conversion Logic**:
- All calculations done in KES for consistency
- Formula: `amount_kes = amount × rate_to_kes`
- Rates sourced from: `utils.currency.get_rates()` → returns `(rates_dict, is_live: bool)`

**Display Format** (compact):
- 1,234,567 KES → "KES 1.23M"
- 50,000 KES → "KES 50.0K"
- 1,000 KES → "KES 1,000.00"

---

### 3. Immutable Audit Trail

**Principles**:
- Every financial action logged to `st.session_state.audit_trail`
- Entries are append-only (cannot be deleted or modified)
- Timestamp in Africa/Nairobi timezone
- User, action type, document reference, before/after values all recorded

**Standard Action Types** (from `audit_trail.AuditAction`):
```
INVOICE_UPLOADED
INVOICE_PROCESSED
INVOICE_APPROVED
INVOICE_REJECTED
INVOICE_POSTED
WHT_CALCULATED
WHT_FILED
PAYMENT_PROCESSED
RECON_RUN
RECON_APPROVED
BUDGET_UPLOADED
ACTUAL_ENTERED
INTERCOMPANY_CONFIRMED
MONTH_END_TASK
DOCUMENT_DELETED
USER_LOGIN
APPROVAL_CHAIN_UPDATED
```

**Sample Entry**:
```json
{
  "timestamp": "2026-07-02 14:32:45",
  "user": "Mercy (Senior Accountant)",
  "action": "INVOICE_APPROVED",
  "document_ref": "INV-2026-07-001",
  "details": "Bayer East Africa Ltd - Production supplies",
  "amount": "50,000.00 KES",
  "before": "Status: Pending Approval",
  "after": "Status: Approved by Mercy"
}
```

---

### 4. Role-Based Access & Approval Chain

**User Roles** (from sidebar selector):
- Finance Team (general)
- Mercy (Senior Accountant)
- Tony (Finance Manager)
- Harrison (Production Manager)
- Charles (Business Controller)
- Niels (MD)

**Approval Chain** (defined in `chart_of_accounts.py`):
```python
APPROVAL_CHAIN = {
    "Production/Freight-in": {
        "approver": "Harrison",
        "role": "Production Manager",
        "cc": "511",
    },
    "Consultancy/Professional": {
        "approver": "Tony",
        "role": "Finance Manager",
        "cc": "206",
    },
    ...
}
```

**Logic**:
- Invoice route to approver based on cost centre + GL account + amount
- Large invoices (> 500K KES) escalate to Charles + Niels

---

### 5. Real Chrysal Business Rules

**Organization Structure**:
- Chrysal International Africa (Kenya entity)
- Related: Chrysal BV (Netherlands parent)

**Cost Centres**:
- 511 (Production/Operations) → Harrison approves
- 208 (Customer Service) → Mercy approves
- 206 (Technical Consultants) → Tony approves
- 121 (Finance) → Charles approves
- 000 (General/Unallocated) → Charles approves

**Vendor Base** (real vendors):
- Bayer East Africa Ltd (chemical/agricultural supplier, 2% WHT)
- DHL Express Kenya (logistics, 2% WHT)
- Deloitte East Africa (professional services, 5% WHT)
- (and others pre-seeded)

**Intercompany Partner**: Chrysal BV (EUR/USD transactions, transfer pricing)

**Currencies**:
- Local (KES): Domestic suppliers
- Export (EUR/USD): Intercompany, customer invoicing

---

## How Everything Works End-to-End

### Complete Monthly Finance Cycle

**Week 1: Invoice Processing & 3-Way Matching**

1. **Monday**:
   - Bayer Africa sends invoice (PDF) for chemicals: 50,000 KES
   - DHL sends invoice (PDF) for logistics: 10,000 KES
   - Deloitte sends email with consultancy invoice: 100,000 KES

2. **Tuesday - Invoice Upload & Extraction**:
   - Finance team uploads invoices one by one
   - System extracts:
     - Bayer: INV-2026-0047, 50,000 KES, 16% VAT = 8,000 KES, total 58,000 KES
     - DHL: INV-2026-0156, 10,000 KES, 16% VAT = 1,600 KES, total 11,600 KES
     - Deloitte: INV-2026-0389, 100,000 KES, 16% VAT = 16,000 KES, total 116,000 KES
   - System assigns Bayer → 2% WHT, DHL → 2% WHT, Deloitte → 5% WHT

3. **Wednesday - 3-Way Matching**:
   - For Bayer chemical invoice:
     - Upload corresponding PO (matched by description & amount)
     - Upload delivery note (qty 100 units @ 500 KES/unit = 50,000)
     - System confirms: ✅ PO qty = Delivery qty = Invoice qty
   - For DHL: No PO (standing logistics contract), delivery note not required
   - For Deloitte: No PO (consulting project), delivery note not required

4. **Thursday - Approval**:
   - Bayer invoice (GL 5000 COGS, CC 511) → routed to Harrison (Production Manager)
   - DHL invoice (GL 5300 Freight, CC 511) → routed to Harrison
   - Deloitte invoice (GL 6500 Consultancy Fees, CC 206) → routed to Tony (Finance Manager)
   - Harrison & Tony review and approve
   - Audit trail logs: `INVOICE_APPROVED` entries for all three

5. **Friday**:
   - All three invoices posted to ledger (added to `processed_invoices`)
   - Ready for downstream processing

---

**Week 2: AP Reconciliation & Matching**

1. **Monday**:
   - Bank statement arrives (via online banking)
   - Shows payments made in prior week:
     - Cheque #2045 to Bayer: 57,000 KES (Gross 58,000 − 1,000 discount? Or 58,000 minus something?)
     - Bank transfer to DHL: 11,600 KES (exact match)
     - Bank transfer to Deloitte: 114,000 KES (this is Gross 116,000 − Customer WHT 2,000? NO — Deloitte is AP vendor, no customer WHT)

2. **Reconciliation**:
   - Upload bank statement export (CSV)
   - System loads outstanding invoices (Bayer 58,000, DHL 11,600, Deloitte 116,000)
   - System loads payments (Cheque 2045 = 57,000, DHL = 11,600, Deloitte = 114,000)
   - **Matching Results**:
     - DHL: 11,600 KES ✅ Exact match (payment = invoice)
     - Deloitte: 114,000 KES ❌ Unmatched (invoice 116,000, payment 114,000, difference 2,000) → Investigate: Was Deloitte given a discount? Was 2,000 held back?
     - Bayer: Cheque 2045 = 57,000 KES but invoice = 58,000 KES → ❌ Unmatched (difference 1,000)

3. **Investigation**:
   - Finance team contacts Bayer: "We paid 57,000 but invoice is 58,000. Where's the 1,000?"
   - Response: "There was a 1,000 credit note for damaged goods (INV-2026-0047-CR)"
   - Action: Upload credit note, add as negative invoice, rerun matching
   - Result: 57,000 KES = (58,000 − 1,000) ✅ Now matched

   - Finance team contacts Deloitte: "We paid 114,000 but invoice is 116,000. Where's the 2,000?"
   - Response: "That's a 2% professional fee discount applied automatically"
   - Action: Upload amended invoice showing 114,000 KES, rerun matching
   - Result: 114,000 KES ✅ Matched

4. **AP Recon Complete**: All payments matched to invoices, reconciliation approved

---

**Week 3: WHT Calculation & Filing**

1. **Calculate WHT**:
   - Run WHT calculator for all approved AP invoices in Month 1:
     - Bayer: 57,000 (after credit) × 2% = 1,140 KES → 2% bucket
     - DHL: 11,600 × 2% = 232 KES → 2% bucket
     - Deloitte: 116,000 × 5% = 5,800 KES → 5% bucket (note: 5%, not 2%)

   - **Important**: These are amounts WITHHELD from vendor. Actual payments:
     - Bayer: 57,000 paid, but company should have paid 57,000 + VAT 9,120 − WHT 1,140 = 65,000? No wait, let me re-read the logic...

   - **Correct Logic**:
     - Invoice to Bayer: Subtotal 50,000, VAT 8,000, Gross 58,000
     - Company pays Bayer: 58,000 − WHT(50,000×2%) = 58,000 − 1,000 = 57,000 ✅
     - WHT amount (1,000 KES) remitted to KRA

2. **Generate KRA CSV** (for 2% WHT):
   ```csv
   PIN of Withholdee,Name of Withholdee,CU Invoice Number,Invoice Date,Date of Payment,Gross Amount,Tax Withheld,Payment Reference
   P001234567A,Bayer East Africa Ltd,0123456789,2026-07-01,2026-07-01,50000.00,1000.00,CHQ2045
   P001234568B,DHL Express Kenya,0123456790,2026-07-02,2026-07-02,10000.00,232.00,BANK123
   ```

3. **Generate 5% Excel**:
   ```
   Sheet "5% WHT - Professional":
   - Deloitte East Africa, INV-2026-0389, 2026-07-03, 100,000 KES (subtotal), 5,800 KES WHT
   
   Sheet "Summary":
   - Total 2% WHT: 1,232 KES
   - Total 5% WHT: 5,800 KES
   - Total WHT Payable: 7,032 KES
   - KRA Filing Deadline: 20 July 2026
   - Days Remaining: 14 days
   ```

4. **User Actions**:
   - Reviews totals: "OK, total WHT = 7,032 KES to remit to KRA"
   - Downloads CSV and Excel files
   - Logs into KRA iTax portal
   - Uploads CSV for 2% WHT bulk processing (1,232 KES)
   - Manually enters or uploads 5% WHT data (5,800 KES)
   - KRA returns confirmation receipt with filing reference
   - User uploads screenshot to Document Store
   - System logs: `log_action("Mercy", "WHT_FILED", "WHT-JUL-2026", "KRA filing complete", 7032, "KES", ..., "KRA Ref: ABC123456")`

---

**Week 4: AR Receipting & Customer WHT**

1. **Customer Invoice Issued** (Example):
   - Customer: ABC Manufacturing Ltd
   - Invoice: INV-CHR-2026-0567
   - Net (Taxable Value): 200,000 KES
   - VAT (16%): 32,000 KES
   - Gross Invoice: 232,000 KES
   - Customer withholds 2% of net: 200,000 × 2% = 4,000 KES (remitted by customer to KRA)
   - Expected payment from customer: 232,000 − 4,000 = 228,000 KES

2. **Customer Payment Received**:
   - ABC Manufacturing sends bank transfer: 228,000 KES on 2026-07-05
   - User enters receipt:
     - Customer: ABC Manufacturing
     - Receipt ref: BANK123456
     - Amount: 228,000 KES
     - Date: 2026-07-05

3. **System Matching**:
   - Pulls outstanding AR invoice: INV-CHR-2026-0567, gross 232,000 KES
   - Calculates expected receipt: 232,000 − 4,000 = 228,000 KES
   - Compares received (228,000) to expected (228,000): ✅ Exact match
   - Records matched receipt with WHT status: "Pending KRA Certificate"

4. **KRA Certificate Tracking**:
   - ABC Manufacturing files their 2% VAT WHT with KRA (customer obligation)
   - ABC Manufacturing downloads certificate from KRA portal
   - ABC sends certificate to Chrysal
   - Chrysal uploads certificate to Document Store and links to receipt
   - System updates status: "KRA Certificate Received" (with date)
   - When processing claims: Chrysal claims 4,000 KES input tax recovery

---

**Month-End Week: Consolidation & Reporting**

1. **Month-End Checklist**:
   - [ ] All invoices received and entered ✅
   - [ ] 3-way matching complete ✅
   - [ ] AP reconciliation completed ✅
   - [ ] WHT calculated and filed with KRA ✅ (by 20th)
   - [ ] AR receipts matched to invoices ✅
   - [ ] Customer WHT certificates tracked (3 pending, 2 received)
   - [ ] Payroll processed ✅
   - [ ] Budget vs actual reviewed ✅
   - [ ] Intercompany balances confirmed (pending from Chrysal BV)
   - [ ] Month-end adjustments entered (accruals, provisioning) ✅
   - [ ] Trial balance pulled ✅
   - [ ] Financial statements reviewed ✅
   - [ ] Month-end report sent to Niels (MD) ✅

2. **Financial Statements Generated**:
   - Trial Balance: All GL accounts listed with balances
   - Income Statement (P&L):
     - Revenue: 2,500,000 KES (sales to customers)
     - Cost of Goods Sold: 1,200,000 KES (invoices from Bayer, DHL, etc.)
     - Gross Profit: 1,300,000 KES (53% margin)
     - Operating Expenses: 400,000 KES (salaries, rent, utilities, consultancy)
     - Operating Profit: 900,000 KES
     - WHT (non-deductible): 7,000 KES
     - Profit Before Tax: 893,000 KES
   - Balance Sheet:
     - Assets: 5,000,000 KES (cash, AR, inventory, fixed assets)
     - Liabilities: 2,000,000 KES (AP, loans)
     - Equity: 3,000,000 KES

3. **Audit Trail Export**:
   - Finance manager exports full audit trail (July 2026)
   - 150+ entries showing every action:
     - Invoice uploads, extractions, approvals
     - 3-way matches performed
     - Reconciliations completed
     - WHT filed
     - AR receipts processed
     - Payroll run
   - Exported to CSV for compliance filing

4. **Month-End Report to MD**:
   - Executive summary: "AP processed on time, AR collected on time, WHT filed on time, no exceptions"
   - Key metrics: Revenue 2.5M, Expenses 1.6M, Net Profit 0.9M
   - AR aging: $50K outstanding (2 invoices, both due in next 5 days)
   - AP aging: $0 outstanding (all paid)
   - Cash position: KES 1.5M available

---

## External APIs & Integrations

### Exchange Rate API (exchangerate-api.com)

**Purpose**: Fetch live KES exchange rates for USD, EUR, GBP

**Endpoint**: `https://api.exchangerate-api.com/v4/latest/KES`

**Features**:
- No API key required (free tier)
- 5-second timeout (prevents app hanging on network issues)
- Returns rates for 150+ currencies
- Conversion: Converts "rates from KES" to "rates to KES" (reciprocal)

**Fallback Strategy**:
- If live API fails: Uses cached rates (hardcoded mid-2026 estimates)
- App never crashes due to network error
- Returns `(rates, is_live: bool)` tuple so users know if rates are live or cached

**Used By**:
- All currency conversion functions
- Dashboard rate display (shows "🟢 Live" or "🔵 Cached" status)
- Sidebar "Refresh rates" button

**Example Response**:
```json
{
  "rates": {
    "USD": 0.0077,
    "EUR": 0.0071,
    "GBP": 0.0061,
    ...
  }
}
```
(System converts these to KES equivalents: 1 USD = 1/0.0077 = 129.87 KES)

### Document Processing APIs

**PDF Extraction**: pdfplumber library
- Handles text extraction from PDFs
- Supports table extraction for line items
- Used for: Invoice processing

**Excel Extraction**: openpyxl library
- Reads Excel workbooks
- Converts sheets to DataFrames
- Used for: Invoice processing, bank statements, budgets

### Potential Future Integrations

While not currently implemented, the architecture supports:
- **Microsoft Dynamics AX API**: For posting approved invoices directly to GL
- **KRA e-Filing API**: For automated WHT submission (currently manual)
- **Bank API**: For automated bank statement retrieval
- **Customer portal**: For AR invoice submission and payment tracking
- **Email service**: For approval notifications

---

## Configuration & Settings

### Tax Configuration (`data/tax_config.py`)

```python
# VAT Treatments
VAT_TREATMENTS = {
    "Standard (16%)": 0.16,
    "Zero Rated (0%)": 0.00,
    "Exempt": None,
}

# WHT Rates
WHT_TYPES = {
    "General Goods/Contractual (2%)": 0.02,
    "Professional/Consultancy (5%)": 0.05,
    "Exempt": 0.00,
}

# Filing deadline
WHT_FILING_DAY = 20  # 20th of every month

# Supported currencies
SUPPORTED_CURRENCIES = ["KES", "USD", "EUR", "GBP"]

# Default vendor master (sample data)
DEFAULT_VENDORS = [
    {
        "vendor_id": "V001",
        "name": "Bayer East Africa Ltd",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "General Goods/Contractual (2%)",
        "currency": "KES",
        "default_ledger": "5000",
        "default_dept": "OPS",
        "default_cc": "511",
    },
    # ... more vendors
]
```

### Chart of Accounts (`data/chart_of_accounts.py`)

```python
COST_CENTRES = {
    "121": "Finance",
    "208": "Customer Service",
    "206": "Technical Consultants (TC)",
    "511": "Production",
    "000": "General / Unallocated",
}

DEPARTMENTS = {
    "FIN": "Finance & Accounting",
    "OPS": "Operations & Production",
    "CS": "Customer Service",
    "TC": "Technical Consultants",
    "ADM": "Administration",
    "MGT": "Management",
}

CHART_OF_ACCOUNTS = {
    "1000": {"name": "Cash and Cash Equivalents", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1100": {"name": "Accounts Receivable - Trade", "type": "Asset", "dept": "CS", "cc": "208"},
    "5000": {"name": "Cost of Goods Sold", "type": "Expense", "dept": "OPS", "cc": "511"},
    "6000": {"name": "Staff Salaries & Wages", "type": "Expense", "dept": "ADM", "cc": "121"},
    # ... 40+ accounts
}

APPROVAL_CHAIN = {
    "Production/Freight-in": {
        "approver": "Harrison",
        "role": "Production Manager",
        "cc": "511",
    },
    # ... more chains
}
```

---

## Utility Functions

### Currency Module (`utils/currency.py`)

**Key Functions**:

```python
def get_rates() -> tuple:
    """
    Returns (rates_dict, is_live: bool).
    Tries live rates from exchangerate-api.com, falls back to cached.
    API: https://api.exchangerate-api.com/v4/latest/KES (no API key required)
    Timeout: 5 seconds
    Fallback rates (cached): USD 129.50, EUR 140.20, GBP 164.80 (mid-2026 estimates)
    """
    # If live fetch succeeds: returns ({"USD": 129.50, "EUR": 140.20, ...}, True)
    # If live fetch fails: returns (FALLBACK_RATES_TO_KES, False)

def convert_to_kes(amount: float, currency: str, rates: Optional[dict] = None) -> float:
    """
    Convert any supported currency to KES.
    If rates not provided, fetches automatically.
    Handles KES (returns amount unchanged).
    """
    # Implementation: amount * rate[currency]

def format_currency(amount: float, currency: str, compact: bool = True) -> str:
    """
    Format currency for display.
    Compact mode (default): Uses M/K suffixes to avoid Streamlit metric truncation
    Examples:
    - 1,234,567 KES with compact=True → "KES 1.23M"
    - 50,000 KES with compact=True → "KES 50.0K"  
    - 1,000 KES with compact=False → "KES 1,000.00"
    - 1,500.50 USD → "$ 1,500.50"
    """

def now_nairobi() -> datetime:
    """Return current datetime in Africa/Nairobi timezone."""
    # Used app-wide for consistent timestamps in all audit logs and calculations

def fetch_live_rates() -> Optional[dict]:
    """
    Fetch live KES exchange rates from exchangerate-api.com.
    Returns {currency: rate_to_KES} or None if fails.
    """
```

### Invoice Engine (`utils/invoice_engine.py`)

**Key Functions**:

```python
def parse_number(value) -> Optional[float]:
    """
    Parse financial number, handling commas, parentheses, currency symbols.
    Examples:
    - "1,234.56" → 1234.56
    - "(5000)" → -5000 (parentheses indicate negative)
    - "$1,000.00" → 1000.00
    - None or invalid → None
    """

def extract_invoice_from_pdf(filepath: str) -> dict:
    """
    Extract invoice fields from PDF using pdfplumber.
    Uses regex patterns to find:
    - Invoice number patterns: "Invoice No:", "Invoice #", "Inv #"
    - Date patterns: Various date formats (DD/MM/YYYY, DD-MM-YY, etc.)
    - Currency: Detects EUR/USD/GBP/KES via currency symbols or codes
    - Amounts: Finds "Total:", "Amount Due:", "Grand Total:", etc.
    - VAT: Searches for "VAT (16%)" or "Tax:" patterns
    - CU Invoice Number: Looks for "CU Invoice No." or "Control Unit No."
    - Tables: Extracts line items from PDF tables for 3-way matching
    
    Returns: {
        "vendor_name": str,
        "invoice_number": str,
        "invoice_date": str,
        "due_date": str,
        "subtotal": float,
        "vat_amount": float,
        "total": float,
        "currency": str,
        "cu_invoice_number": str,
        "line_items": list[list],
        "raw_text": str,
    }
    """

def extract_invoice_from_excel(filepath: str) -> dict:
    """
    Extract invoice fields from Excel using openpyxl.
    Reads spreadsheet, converts to text, applies same regex patterns as PDF.
    Returns: Same structure as PDF extraction
    """

def process_invoice(
    extracted: dict,
    vendor: dict,
    rates: dict,
    is_service: bool = False,
    kra_rate_override: float = None,
) -> dict:
    """
    Apply tax logic to an extracted invoice given a matched vendor.
    CRITICAL FEATURES:
    
    1. **VAT Calculation**:
       - Gets VAT treatment from vendor master (Standard 16% / Zero Rated 0% / Exempt)
       - Calculates VAT on subtotal
       - If extracted VAT mismatches calculated VAT by >1: flags warning ⚠️
    
    2. **WHT Calculation** (Withholding Tax):
       - Gets WHT type from vendor (2% General Goods / 5% Professional / Exempt)
       - Calculates WHT on SUBTOTAL ONLY (before VAT) — VAT is excluded from WHT base
       - Formula: WHT = Subtotal × Rate (not Gross × Rate)
       - Payment formula: Net = Gross Invoice − WHT
    
    3. **KRA Exchange Rate Handling** (CRITICAL FOR FOREIGN CURRENCY):
       - For KES invoices: Uses market rate for display only
       - For foreign currency (USD/EUR/GBP):
         - If kra_rate_override provided: Uses KRA's official rate (per KRA regulation)
         - If not provided: Uses live market rate BUT flags warning ⚠️
       - IMPORTANT: WHT remittance to KRA must use KRA's official rate for invoice date,
         not bank rate or market rate. If wrong rate used, KES amount won't match KRA records.
       - Example: Invoice dated 2026-06-15, amount USD 1,000
         - Market rate (today): 1 USD = 130 KES → WHT = 1,000 × 2% × 130 = 2,600 KES
         - KRA official rate (for 2026-06-15): 1 USD = 128 KES → WHT = 1,000 × 2% × 128 = 2,560 KES
         - KRA records show 2,560 KES; if you file 2,600 KES, it won't reconcile
    
    4. **Tax Flag & Warnings**:
       - `tax_flag`: If VAT mismatch detected, warns before posting
       - `kra_rate_warning`: If foreign currency but no KRA rate provided
       - `posting_ready`: Boolean — False if any warnings, True if clear to post
    
    Returns: {
        "vendor_name": str,
        "vendor_id": str,
        "cu_invoice_number": str,
        "invoice_number": str,
        "invoice_date": str,
        "currency": str,
        "subtotal": float,
        "vat_treatment": str,
        "vat_rate_pct": str,        # "16%", "0%", etc.
        "vat_amount": float,
        "invoice_total": float,
        "wht_type": str,
        "wht_rate_pct": str,        # "2%", "5%", etc.
        "wht_amount": float,
        "net_payable": float,       # Gross − WHT
        "subtotal_kes": float,      # In KES for accounting
        "vat_kes": float,
        "total_kes": float,
        "wht_kes": float,           # In KES using KRA rate (if provided) or market rate
        "net_payable_kes": float,
        "kra_rate_used": float,     # The rate actually used for WHT calculation
        "kra_rate_source": str,     # "KRA official rate (128.5000)" or "⚠️ Market rate used..."
        "kra_rate_warning": str,    # Warning if no KRA rate provided for foreign currency
        "tax_flag": str,            # Any tax-related warnings
        "posting_ready": bool,      # Safe to post if True
    }
    """
```

### WHT Calculator (`utils/wht_calculator.py`)

**Key Functions**:

```python
def calculate_wht_for_payments(payments: list, rates: dict) -> dict:
    """
    Calculate WHT on payments.
    Returns: {
        "2pct_entries": [...],
        "5pct_entries": [...],
        "total_wht_2pct_kes": float,
        "total_wht_5pct_kes": float,
        "deadline": str,
        "days_to_deadline": int,
        "deadline_flag": str (if urgent),
    }
    """

def generate_kra_csv(entries_2pct: list) -> bytes:
    """Generate KRA iTax-compatible CSV for 2% WHT bulk upload."""
    # Returns: CSV bytes (downloadable)

def generate_wht_excel(result: dict) -> bytes:
    """Generate Excel workbook with 2% and 5% sheets + summary."""
    # Returns: XLSX bytes (downloadable)
```

### Tax Configuration Helpers (`data/tax_config.py`)

**Helper Functions** (used throughout application):

```python
def get_vendor_by_name(name: str, vendors: list) -> dict:
    """
    Fuzzy match extracted vendor name to vendor master.
    Uses substring matching (case-insensitive).
    Example:
    - Extracted: "BAYER CHEMICALS LTD"
    - Master: "Bayer East Africa Ltd"
    - Result: Matches (substring "Bayer" found in both)
    
    Returns matched vendor dict or None if not found.
    """

def get_vat_rate(vat_treatment: str) -> float:
    """
    Return VAT rate for a given treatment.
    - "Standard (16%)" → 0.16
    - "Zero Rated (0%)" → 0.00
    - "Exempt" → 0.0 (no VAT charged, no input credit)
    """

def get_wht_rate(wht_type: str, is_service: bool = False) -> float:
    """
    Return WHT rate for vendor type.
    - "General Goods/Contractual (2%)" → 0.02
    - "Professional/Consultancy (5%)" → 0.05
    - "Exempt" → 0.0 (no WHT)
    """
```

**Seeded Vendor Master Data** (8 vendors pre-configured):

| Vendor ID | Name | Type | VAT | WHT | Currency | GL Account | Cost Centre | Notes |
|-----------|------|------|-----|-----|----------|-----------|-------------|-------|
| V001 | Bayer East Africa Ltd | Supplier | Standard 16% | 2% | KES | 5000 | 511 | Chemical/agricultural supplies |
| V002 | DHL Express Kenya | Supplier | Standard 16% | 2% | KES | 5300 | 511 | Courier and logistics |
| V003 | Deloitte East Africa | Consultant | Standard 16% | 5% | KES | 6500 | 206 | Audit and advisory services |
| V004 | Kenya Power & Lighting | Supplier | Standard 16% | 2% | KES | 6200 | 121 | Electricity utility |
| V005 | Safaricom PLC | Supplier | Standard 16% | 2% | KES | 6300 | 121 | Telecoms and data services |
| V006 | PricewaterhouseCoopers Kenya | Consultant | Standard 16% | 5% | KES | 6400 | 121 | Tax advisory and audit |
| V007 | Export Supplies International | Supplier | Zero Rated 0% | 2% | USD | 5100 | 511 | Export supplies (zero-rated) |
| V008 | Chrysal International BV | Supplier | Zero Rated 0% | Exempt | EUR | 2010 | 121 | Parent company (intercompany) |

(Users can add more vendors dynamically via Vendor Master module)

### Reconciliation Engine (`utils/reconciliation_engine.py`)

**Key Functions**:

```python
def load_invoices_from_df(df: pd.DataFrame) -> list:
    """Parse DataFrame of outstanding invoices into standard format."""

def load_payments_from_df(df: pd.DataFrame) -> list:
    """Parse DataFrame of payments made into standard format."""

def reconcile(invoices: list, payments: list, rates: dict) -> dict:
    """
    Match payments to invoices.
    Returns: {
        "matched": [...],
        "unmatched_payments": [...],
        "unmatched_invoices": [...],
        "summary": {
            "total_matched": int,
            "total_matched_kes": float,
            ...
        }
    }
    """
```

### AR Engine (`utils/ar_engine.py`)

**Key Functions**:

```python
def calculate_invoice_vat_breakdown(net_amount: float, currency: str, rates: dict) -> dict:
    """
    Calculate VAT and WHT breakdown for customer invoice.
    Returns breakdown including expected receipt after customer 2% WHT.
    """

def match_receipts_to_invoices(invoices: list, receipts: list, rates: dict, tolerance: float) -> dict:
    """
    Match customer payments to AR invoices.
    Accounts for customer 2% WHT on taxable value.
    """
```

### Audit Trail (`utils/audit_trail.py`)

**Key Functions**:

```python
def init_audit_trail():
    """Initialize audit trail in session state."""

def log_action(user, action, document_ref, details, amount=None, currency=None, before_value=None, after_value=None):
    """Log a financial action (immutable, append-only)."""

def get_audit_trail() -> list:
    """Retrieve full audit trail."""

# Action types
class AuditAction:
    INVOICE_UPLOADED = "INVOICE UPLOADED"
    INVOICE_APPROVED = "INVOICE APPROVED"
    # ... more types
```

---

## Data Flow Diagrams

### Invoice Processing Data Flow

```
┌─────────────────────┐
│   PDF/Excel File    │
│    (Invoice)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│  invoice_engine.extract()   │ ← Regex extraction, OCR patterns
│  - vendor_name              │
│  - invoice_number           │
│  - amount, VAT, total       │
│  - currency                 │
│  - CU invoice number        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Match Vendor in Master     │
│  (DEFAULT_VENDORS)          │
└──────────┬──────────────────┘
           │
           ├─ Found? ▶ Prefill: VAT treatment, WHT type, GL account, CC
           └─ Not found? ▶ User selects/creates vendor
           │
           ▼
┌─────────────────────────────┐
│  Validate & Review          │
│  - Amounts add up           │
│  - Currency consistent      │
│  - For FX: enter KRA rate   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  3-Way Match (if PO)        │
│  - Compare to PO            │
│  - Compare to Delivery Note │
│  - Flag discrepancies       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Route to Approver          │
│  Based on: CC + GL + Amount │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Approval Workflow          │
│  - Review & Approve         │
│  - Or Reject & Return       │
└──────────┬──────────────────┘
           │
           ▼ (if Approved)
┌─────────────────────────────┐
│  Post to Ledger             │
│  Add to processed_invoices  │
│  Log action to audit trail  │
└─────────────────────────────┘
```

### WHT Calculation & Filing Data Flow

```
┌──────────────────────────────┐
│  Approved AP Invoices        │
│  (from month X)              │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Calculate WHT for each invoice  │
│  - Get WHT rate (2% or 5%)       │
│  - WHT = Subtotal × Rate         │
│  - Convert to KES using:         │
│    - Live rate if KES            │
│    - User-entered KRA rate if FX │
└──────────┬───────────────────────┘
           │
           ├─ 2% WHT ──▶ Bucket 1 (General Goods)
           └─ 5% WHT ──▶ Bucket 2 (Professional)
           │
           ▼
┌──────────────────────────────────┐
│  Calculate Deadline              │
│  - 20th of current month         │
│  - Timezone: Africa/Nairobi      │
│  - Days remaining & flag status  │
└──────────┬───────────────────────┘
           │
           ├──▶ Generate KRA CSV (2% bucket)
           │   - Format: PIN, Name, CU#, Invoice Date, Payment Date, Amount, WHT, Ref
           │   - Output: CSV file (downloadable)
           │
           └──▶ Generate Excel (5% bucket)
               - Sheet 1: 5% WHT entries
               - Sheet 2: Summary (totals, deadline, timestamp)
               - Output: XLSX file (downloadable)
           │
           ▼
┌──────────────────────────────────┐
│  User Review                     │
│  - Check totals                  │
│  - Check deadline & days left    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Download & File with KRA        │
│  - Upload CSV to iTax portal     │
│  - Upload/email Excel to KRA     │
│  - Receive KRA confirmation      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Log Filing to Audit Trail       │
│  - Action: WHT_FILED             │
│  - Amount, KRA ref, timestamp    │
└──────────────────────────────────┘
```

### AP Reconciliation Data Flow

```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  Outstanding AP Invoices     │    │  Bank Payments Export        │
│  (from processed_invoices)   │    │  (CSV or Excel)              │
└──────────┬───────────────────┘    └──────────┬───────────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────────────────────────────────────┐
│  Load Invoices & Payments into DataFrames              │
│  - Parse amounts, dates, vendor names, currencies      │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  Convert all amounts to KES using live exchange rates  │
│  - Tolerance: KES 0.50 (rounding)                       │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  For each Payment, find Matching Invoice(s)            │
│  1. Exact match? ▶ ✅ Matched (high confidence)        │
│  2. Multi-invoice match? ▶ 🟡 Matched (verify)        │
│  3. No match? ▶ ❌ Unmatched (investigate)            │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  Generate Reconciliation Report                        │
│  - Matched payments (with confidence level)            │
│  - Unmatched payments (reasons)                        │
│  - Outstanding invoices (unpaid)                       │
│  - Totals & summary                                    │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  Finance Team Reviews & Investigates Discrepancies     │
│  - Contact vendors for unmatched items                  │
│  - Upload credit notes or amended invoices              │
│  - Re-run reconciliation                                │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼ (once all matched)
┌──────────────────────────────────────────────────────────┐
│  Approve Reconciliation                                │
│  - Log action to audit trail: RECON_APPROVED           │
│  - Export reconciliation report                         │
└──────────────────────────────────────────────────────────┘
```

### AR Receipting & Customer WHT Data Flow

```
┌──────────────────────────────────┐
│  Customer Invoice Issued         │
│  - Net: 100K, VAT: 16K          │
│  - Gross: 116K                   │
│  - Customer WHT (2% of net): 2K │
│  - Expected receipt: 114K        │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Customer Payment Received       │
│  - Bank transfer: 114K on date X │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Calculate Expected Receipt      │
│  ar_engine.calculate_vat()       │
│  - Gross − (Net × 2%) = 114K    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Match Payment to Invoice        │
│  - Received (114K) vs Expected (114K)
│  - Within tolerance? ✅ Match    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Record Matched Receipt          │
│  - Amount received               │
│  - WHT to claim: 2K              │
│  - KRA cert status: Pending      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Customer Files WHT with KRA     │
│  - Customer remits 2K directly   │
│  - Customer gets KRA certificate │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Chrysal Receives Certificate    │
│  - Upload to Document Store      │
│  - Link to receipt               │
│  - Update status: Cert Received  │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Claim Input Tax Recovery        │
│  - Dr: VAT Recoverable 2K        │
│  - Cr: AR 2K                     │
│  - File claim in VAT return      │
└──────────────────────────────────┘
```

---

## Advanced Topics

### Session State Management Pattern

FinOpsAi uses Streamlit's session state extensively to maintain data across browser refreshes:

```python
# In app/main.py — Initialization pattern
if "vendors" not in st.session_state:
    st.session_state.vendors = DEFAULT_VENDORS.copy()
if "rates" not in st.session_state:
    st.session_state.rates, st.session_state.rates_live = get_rates()
if "processed_invoices" not in st.session_state:
    st.session_state.processed_invoices = []
# ... more initializations
```

**Why This Matters**:
- Session state persists data during user's browser session
- User can navigate between modules without losing data
- Data cleared when browser tab closed or new session started
- Perfect for single-user finance applications

**Limitations & Trade-offs**:
- NOT suitable for multi-user collaboration (data not shared between users)
- NOT persisted to database (loss on app restart)
- For production, would integrate with database backend

**Current Use Cases**:
- Storing processed invoices (temp, until posted to AX)
- Storing WHT calculations (temp, until filed with KRA)
- Storing reconciliation results (for review/approval)
- User context and audit trail

### Regex Pattern Library (Invoice Extraction)

FinOpsAi uses comprehensive regex patterns to extract invoicing data from unstructured PDF/Excel:

**Patterns Used**:

```python
# Invoice Number: "Invoice No:", "Invoice #", "Inv #"
r'(?:invoice\s*(?:no|number|#)[:\s]*)([\w\-\/]+)'

# Invoice Date: Multiple date format support
r'(?:invoice\s*date|date)[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})'

# Currency Detection: EUR/USD/GBP/KES
r'\bEUR\b|€'  # EUR
r'\bUSD\b|\$'  # USD  
r'\bGBP\b|£'   # GBP

# VAT Amount: "VAT (16%)" or "Tax:" patterns
r'vat\s*\(?\s*1[0-9]\s*%?\s*\)?[:\s]+([\d,]+\.?\d*)'

# CU Invoice Number: "CU Invoice No." or "Control Unit No."
r'(?:cu\s*invoice\s*no\.?|cu\s*no\.?|control\s*unit\s*no\.?)[:\s]+([\w\-]+)'

# Subtotal/Net Amount: "Subtotal:", "Sub-total:", "Net Amount:"
r'(?:subtotal|sub-total|net\s*amount)[:\s]*([\d,]+\.?\d*)'

# Total: "Total:", "Amount Due:", "Grand Total:"
r'(?:total|amount\s*due|grand\s*total)[:\s]*([\d,]+\.?\d*)'
```

**Why This Matters**:
- PDFs from different vendors use different formatting
- Regex patterns make invoice extraction robust across vendors
- Handles variations: "Invoice No:" vs "Inv #:" vs "Invoice Number"
- Numbers with commas, parentheses, currency symbols handled

**Fallback Strategy**:
- If regex fails to find field, user must enter manually
- Never crashes; just marks field as None
- User still sees extracted data and can correct

### Multi-User Approval Chain Logic

The approval chain routing is location-based and amount-sensitive:

```python
APPROVAL_CHAIN = {
    "Production/Freight-in": {
        "approver": "Harrison",     # Production Manager
        "role": "Production Manager",
        "cc": "511",                # Cost Centre
        "min_amount": 0,            # No minimum
        "max_amount": 500000,       # Up to 500K
    },
    ...
}

# Routing Logic (conceptual):
def route_for_approval(invoice):
    gl_account = invoice["gl_account"]
    cost_centre = invoice["cost_centre"]
    amount = invoice["total"]
    
    # Find matching approval chain entry by cost centre + GL account
    for key, chain in APPROVAL_CHAIN.items():
        if chain["cc"] == cost_centre:
            # Check amount thresholds
            if amount <= chain.get("max_amount", float("inf")):
                return chain["approver"]
    
    # Escalate to Business Controller if no match or high amount
    return "Charles (Business Controller)"
```

**Current Approvers**:
- **Mercy** (Senior Accountant): CS / AR invoices
- **Tony** (Finance Manager): Consultancy / Finance invoices
- **Harrison** (Production Manager): Production / Freight / OPS invoices
- **Charles** (Business Controller): Large invoices, Finance policies
- **Niels** (MD): Escalated exceptional transactions

### Audit Trail Immutability Guarantee

The audit trail is designed to be forensics-proof:

**Implementation**:
```python
# In utils/audit_trail.py
def log_action(...):
    entry = {
        "timestamp": now_nairobi().strftime("%Y-%m-%d %H:%M:%S"),
        "user": user,
        "action": action,
        "document_ref": document_ref,
        "details": details,
        "amount": f"{amount:,.2f} {currency}",
        "before": before_value,
        "after": after_value,
    }
    # APPEND ONLY — no delete, no modify
    st.session_state.audit_trail.append(entry)
```

**Properties**:
- Append-only (entries never deleted or modified)
- Timestamp in Nairobi timezone (for KRA compliance)
- Captures before/after values (for reconciliation)
- Captures user, action type, document reference
- Perfect for KRA audits, internal investigations

**Limitations**:
- Currently in session state (lost on app restart)
- For production: should be persisted to append-only database (e.g., PostgreSQL, MongoDB)
- Should implement access controls (who can view what)

---

## Summary of Undocumented Features Added

1. **Invoice Validation & Flagging System** - Tax warnings, VAT mismatch detection, KRA rate verification
2. **External API Integration** - exchangerate-api.com for live rates with fallback
3. **Sample Data Pre-loading** - Dashboard shows realistic data on first visit
4. **Extended Vendor Master** - 8 pre-configured vendors documented
5. **Tax Configuration Helpers** - get_vendor_by_name(), get_vat_rate(), get_wht_rate()
6. **Session State Management Pattern** - How data persists within user session
7. **Regex Pattern Library** - Comprehensive extraction patterns for invoices
8. **Multi-User Approval Chain** - Routing logic by cost centre and amount
9. **Audit Trail Immutability** - Design and implementation details
10. **KRA Rate Override Logic** - Detailed explanation of foreign currency compliance handling

## Summary: Key Takeaways

**FinOpsAi is a comprehensive, KRA-compliant finance automation platform** that:

1. **Automates Invoice Processing** - From upload to approval in minutes
2. **Ensures 3-Way Matching** - Prevents overpayment and fraud
3. **Manages Multi-Currency Transactions** - With live rates and KRA exchange rate compliance
4. **Calculates & Files WHT** - Both vendor-side (2%/5%) and customer-side (2% on VAT)
5. **Reconciles AP & AR** - Automatically matches payments to invoices
6. **Tracks Intercompany Transactions** - Between Chrysal Africa and Chrysal BV
7. **Automates Payroll & Tax** - With NSSF, NHIF, and PAYE calculations
8. **Forecasts Cash Flow** - Projects liquidity position
9. **Maintains Immutable Audit Trail** - Every action logged for compliance
10. **Generates Financial Statements** - Trial balance, P&L, balance sheet
11. **Manages Month-End Close** - Checklist and workflow tracking
12. **Centralizes Documents** - Full-text searchable repository

**All functionality is built on real Chrysal business processes**, with KRA tax compliance embedded throughout and multi-user approval chains based on cost centres, GL accounts, and transaction amounts.

