"""
Kenya Tax Configuration & Vendor Master
Based on KRA tax rates and real AP/AR workflows in Kenyan private companies.

VAT rates (Kenya):
- Standard rated: 16%
- Zero rated: 0% (exports, certain goods)
- Exempt: no VAT charged, no input credit

WHT rates (Kenya — on payments to vendors, AP side):
- General goods/contractual work: 2% of the base amount (before VAT)
- Professional/consultancy services: 5% of the base amount (before VAT)
- WHT is calculated on the base/subtotal only — VAT is excluded from the WHT base
- Net payment to vendor = Base + VAT − WHT

WHT on VAT (from customers, on Chrysal's AR/sales side):
- Customers withhold 2% of the taxable value (net amount before VAT) on invoices
- Filed by customer directly to KRA by 20th of following month
- Chrysal receipts the net amount and tracks the withheld portion via KRA portal
- This is a customer-side obligation, separate from Chrysal's own AP-side WHT above.

IMPORTANT — KRA Exchange Rate for Foreign Currency WHT:
- When remitting WHT on foreign currency invoices (USD, EUR, GBP),
  the KES equivalent MUST be calculated using KRA's official exchange rate
  for the specific date the invoice was issued — NOT today's market rate.
- KRA publishes daily exchange rates on their portal (kra.go.ke).
- Using the wrong rate (e.g. a bank rate or today's market rate) will produce
  a different KES figure than what KRA has on record, causing audit discrepancies.
- In this app: when processing a foreign currency invoice, the user must manually
  enter the KRA rate for the invoice date. This rate is stored per invoice and
  used exclusively for WHT calculation. The live market rate is used only for
  general display and management dashboard purposes.

CU Invoice Number (Control Unit / ETR serial number):
- Every KRA-registered invoice is assigned a CU invoice number via the
  Electronic Tax Register (ETR) or TIMS system.
- This is the primary reference used when remitting WHT to KRA — not your
  internal invoice number, not the vendor's reference, but the KRA CU number.
- Customers also use your CU invoice number when filing their 2% VAT WHT.
- CU number is mandatory in all WHT filing outputs (CSV, Excel, remittance advice).
"""

# --- VAT Treatment Options ---
VAT_TREATMENTS = {
    "Standard (16%)": 0.16,
    "Zero Rated (0%)": 0.00,
    "Exempt": None,
}

# --- WHT Rate Options ---
WHT_TYPES = {
    "General Goods/Contractual (2%)": 0.02,
    "Professional/Consultancy (5%)": 0.05,
    "Exempt": 0.00,
}

# --- KRA Filing Deadlines ---
WHT_FILING_DAY = 20  # 20th of every month

# --- Supported Currencies ---
SUPPORTED_CURRENCIES = ["KES", "USD", "EUR", "GBP"]

# --- Default Vendor Master ---
# In the real app, users can add/edit vendors dynamically via the UI.
# This is the seeded starting dataset based on typical Chrysal-style vendor profiles.
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
        "notes": "Chemical/agricultural supplies",
    },
    {
        "vendor_id": "V002",
        "name": "DHL Express Kenya",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "General Goods/Contractual (2%)",
        "currency": "KES",
        "default_ledger": "5300",
        "default_dept": "OPS",
        "default_cc": "511",
        "notes": "Courier and logistics",
    },
    {
        "vendor_id": "V003",
        "name": "Deloitte East Africa",
        "type": "Consultant",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Professional/Consultancy (5%)",
        "currency": "KES",
        "default_ledger": "6500",
        "default_dept": "TC",
        "default_cc": "206",
        "notes": "Audit and advisory services",
    },
    {
        "vendor_id": "V004",
        "name": "Kenya Power & Lighting",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "General Goods/Contractual (2%)",
        "currency": "KES",
        "default_ledger": "6200",
        "default_dept": "ADM",
        "default_cc": "121",
        "notes": "Electricity utility",
    },
    {
        "vendor_id": "V005",
        "name": "Safaricom PLC",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "General Goods/Contractual (2%)",
        "currency": "KES",
        "default_ledger": "6300",
        "default_dept": "ADM",
        "default_cc": "121",
        "notes": "Telecoms and data services",
    },
    {
        "vendor_id": "V006",
        "name": "PricewaterhouseCoopers Kenya",
        "type": "Consultant",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Professional/Consultancy (5%)",
        "currency": "KES",
        "default_ledger": "6400",
        "default_dept": "ADM",
        "default_cc": "121",
        "notes": "Tax advisory and audit",
    },
    {
        "vendor_id": "V007",
        "name": "Export Supplies International",
        "type": "Supplier",
        "vat_treatment": "Zero Rated (0%)",
        "wht_type": "General Goods/Contractual (2%)",
        "currency": "USD",
        "default_ledger": "5100",
        "default_dept": "OPS",
        "default_cc": "511",
        "notes": "International export supplies — zero rated",
    },
    {
        "vendor_id": "V008",
        "name": "Chrysal International BV",
        "type": "Supplier",
        "vat_treatment": "Zero Rated (0%)",
        "wht_type": "Exempt",
        "currency": "EUR",
        "default_ledger": "2010",
        "default_dept": "FIN",
        "default_cc": "121",
        "notes": "Parent company — intercompany transactions",
    },
]


def get_vendor_by_name(name: str, vendors: list) -> dict:
    """Fuzzy match a vendor name from extracted invoice text to vendor master."""
    name_lower = name.lower().strip()
    for v in vendors:
        if v["name"].lower() in name_lower or name_lower in v["name"].lower():
            return v
    return None


def get_vat_rate(vat_treatment: str) -> float:
    """Return the VAT rate for a given treatment. Returns 0 for exempt."""
    rate = VAT_TREATMENTS.get(vat_treatment)
    return rate if rate is not None else 0.0


def get_wht_rate(wht_type: str, is_service: bool = False) -> float:
    """Return the Withholding Tax (WHT) rate for a vendor type — 2% general goods/contractual, 5% professional/consultancy."""
    rate = WHT_TYPES.get(wht_type, 0.0)
    return rate if isinstance(rate, float) else 0.0
