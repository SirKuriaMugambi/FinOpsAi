"""
Chrysal International Africa - Chart of Accounts & Cost Centre Configuration
Based on real cost centre codes and department structure from Chrysal Africa.
Ledger account ranges follow standard accounting conventions.
Users can add/edit accounts via the UI — this is the seeded starting dataset.
"""

# --- Cost Centres (confirmed from Chrysal Africa) ---
COST_CENTRES = {
    "121": "Finance",
    "208": "Customer Service",
    "206": "Technical Consultants (TC)",
    "511": "Production",
    "000": "General / Unallocated",
}

# --- Departments ---
DEPARTMENTS = {
    "FIN": "Finance & Accounting",
    "OPS": "Operations & Production",
    "CS":  "Customer Service",
    "TC":  "Technical Consultants",
    "ADM": "Administration",
    "MGT": "Management",
}

# --- Chart of Accounts (standard structure for a trading/manufacturing company) ---
CHART_OF_ACCOUNTS = {
    # ASSETS
    "1000": {"name": "Cash and Cash Equivalents", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1010": {"name": "Petty Cash", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1100": {"name": "Accounts Receivable - Trade", "type": "Asset", "dept": "CS", "cc": "208"},
    "1110": {"name": "Accounts Receivable - Intercompany (Chrysal BV)", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1200": {"name": "Inventory - Raw Materials", "type": "Asset", "dept": "OPS", "cc": "511"},
    "1210": {"name": "Inventory - Finished Goods", "type": "Asset", "dept": "OPS", "cc": "511"},
    "1300": {"name": "VAT Recoverable", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1310": {"name": "WHT Recoverable (Customer WVAT)", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1400": {"name": "Prepayments and Deposits", "type": "Asset", "dept": "FIN", "cc": "121"},
    "1500": {"name": "Property, Plant & Equipment", "type": "Asset", "dept": "ADM", "cc": "000"},
    "1510": {"name": "Accumulated Depreciation", "type": "Asset", "dept": "ADM", "cc": "000"},

    # LIABILITIES
    "2000": {"name": "Accounts Payable - Trade", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2010": {"name": "Accounts Payable - Intercompany (Chrysal BV)", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2100": {"name": "VAT Payable", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2110": {"name": "WHT Payable - Suppliers (2%)", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2120": {"name": "WHT Payable - Consultants (5%)", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2200": {"name": "Accrued Liabilities", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2300": {"name": "Payroll Payable", "type": "Liability", "dept": "FIN", "cc": "121"},
    "2400": {"name": "Loans Payable", "type": "Liability", "dept": "FIN", "cc": "121"},

    # EQUITY
    "3000": {"name": "Share Capital", "type": "Equity", "dept": "MGT", "cc": "000"},
    "3100": {"name": "Retained Earnings", "type": "Equity", "dept": "MGT", "cc": "000"},
    "3200": {"name": "Current Year Profit/Loss", "type": "Equity", "dept": "MGT", "cc": "000"},

    # REVENUE
    "4000": {"name": "Sales Revenue - Local (KES)", "type": "Revenue", "dept": "CS", "cc": "208"},
    "4010": {"name": "Sales Revenue - Export (EUR/USD)", "type": "Revenue", "dept": "CS", "cc": "208"},
    "4100": {"name": "Technical Consultancy Revenue", "type": "Revenue", "dept": "TC", "cc": "206"},
    "4200": {"name": "Intercompany Revenue (Chrysal BV)", "type": "Revenue", "dept": "FIN", "cc": "121"},

    # COST OF SALES
    "5000": {"name": "Cost of Goods Sold", "type": "Expense", "dept": "OPS", "cc": "511"},
    "5100": {"name": "Raw Materials Consumed", "type": "Expense", "dept": "OPS", "cc": "511"},
    "5200": {"name": "Direct Labour", "type": "Expense", "dept": "OPS", "cc": "511"},
    "5300": {"name": "Freight Inward / Import Costs", "type": "Expense", "dept": "OPS", "cc": "511"},
    "5400": {"name": "Production Consumables", "type": "Expense", "dept": "OPS", "cc": "511"},

    # OPERATING EXPENSES
    "6000": {"name": "Staff Salaries & Wages", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6010": {"name": "NSSF & NHIF Contributions", "type": "Expense", "dept": "FIN", "cc": "121"},
    "6100": {"name": "Rent & Occupancy", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6200": {"name": "Utilities (Electricity, Water)", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6300": {"name": "Telecommunications & Internet", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6400": {"name": "Professional Fees (Legal/Audit)", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6500": {"name": "Technical Consultancy Fees", "type": "Expense", "dept": "TC", "cc": "206"},
    "6600": {"name": "Marketing & Advertising", "type": "Expense", "dept": "CS", "cc": "208"},
    "6700": {"name": "Travel & Entertainment", "type": "Expense", "dept": "ADM", "cc": "121"},
    "6800": {"name": "Repairs & Maintenance", "type": "Expense", "dept": "OPS", "cc": "511"},
    "6900": {"name": "Depreciation Expense", "type": "Expense", "dept": "ADM", "cc": "000"},
    "7000": {"name": "Bank Charges & Forex Losses", "type": "Expense", "dept": "FIN", "cc": "121"},
    "7100": {"name": "Intercompany Charges (Chrysal BV)", "type": "Expense", "dept": "FIN", "cc": "121"},
    "7200": {"name": "Miscellaneous Expenses", "type": "Expense", "dept": "ADM", "cc": "000"},
}

# --- Approval Chain (Chrysal Africa real workflow) ---
APPROVAL_CHAIN = {
    "Production/Freight-in": {
        "approver": "Harrison",
        "role": "Production Manager",
        "cc": "511",
        "description": "All production invoices, POs, freight-in, and import costs"
    },
    "Production Consumables": {
        "approver": "Harrison",
        "role": "Production Manager",
        "cc": "511",
        "description": "Production consumables and materials"
    },
    "Administrative": {
        "approver": "Antony",
        "role": "Finance Manager",
        "cc": "121",
        "description": "Administrative and general office expenses"
    },
    "High Value / Unclear": {
        "approver": "Charles",
        "role": "Business Controller",
        "cc": "000",
        "description": "High-value invoices, unclear allocations, recons and remittances"
    },
}

# --- Invoice Split Allocation Rules ---
# Some invoices require % allocation across multiple ledgers/depts/CCs
SPLIT_RULES = {
    "Utilities": [
        {"ledger": "6200", "dept": "ADM", "cc": "121", "pct": 0.40, "description": "Finance/Admin portion"},
        {"ledger": "6200", "dept": "OPS", "cc": "511", "pct": 0.40, "description": "Production portion"},
        {"ledger": "6200", "dept": "CS",  "cc": "208", "pct": 0.20, "description": "Customer Service portion"},
    ],
    "Telecommunications": [
        {"ledger": "6300", "dept": "ADM", "cc": "121", "pct": 0.50, "description": "Admin portion"},
        {"ledger": "6300", "dept": "CS",  "cc": "208", "pct": 0.30, "description": "Customer Service portion"},
        {"ledger": "6300", "dept": "TC",  "cc": "206", "pct": 0.20, "description": "TC portion"},
    ],
    "Rent": [
        {"ledger": "6100", "dept": "ADM", "cc": "121", "pct": 0.35, "description": "Admin/Finance"},
        {"ledger": "6100", "dept": "OPS", "cc": "511", "pct": 0.50, "description": "Production floor"},
        {"ledger": "6100", "dept": "CS",  "cc": "208", "pct": 0.15, "description": "Customer Service"},
    ],
}


def get_account(code: str) -> dict:
    return CHART_OF_ACCOUNTS.get(code)


def get_accounts_by_type(account_type: str) -> dict:
    return {k: v for k, v in CHART_OF_ACCOUNTS.items() if v["type"] == account_type}


def get_approver(invoice_type: str) -> dict:
    return APPROVAL_CHAIN.get(invoice_type, APPROVAL_CHAIN["Administrative"])


def get_split_rule(expense_type: str) -> list:
    return SPLIT_RULES.get(expense_type, [])


def list_accounts_for_select() -> list:
    return [f"{code} — {v['name']}" for code, v in CHART_OF_ACCOUNTS.items()]


def get_cc_name(cc_code: str) -> str:
    return COST_CENTRES.get(cc_code, "Unknown")
