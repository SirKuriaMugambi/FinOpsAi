"""
Kenya Tax Configuration & Vendor Master
Based on KRA tax rates and real AP/AR workflows in Kenyan private companies.

VAT rates (Kenya):
- Standard rated: 16%
- Zero rated: 0% (exports, certain goods)
- Exempt: no VAT charged, no input credit

CHRYSAL IS AN APPOINTED KRA WITHHOLDING VAT (WVAT) AGENT.
This means TWO separate withholding obligations apply on every applicable
vendor payment, calculated independently and remitted separately:

1. WITHHOLDING VAT (WVAT) — 2% of the VAT-INCLUSIVE amount (Gross Invoice)
   e.g. Base 4,000 + VAT 640 = Gross 4,640 → WVAT = 4,640 × 2% = 92.80

2. WITHHOLDING INCOME TAX (WHT) — on the BASE amount (before VAT), rate depends on type:
   - General goods / contractual work: 3% of base
   - Professional / consultancy services: 5% of base
   e.g. Base 4,000 → WHT = 4,000 × 3% = 120 (general) or 4,000 × 5% = 200 (professional)

TOTAL WITHHELD = WVAT + WHT (both deducted from the gross payment to the vendor)
e.g. General goods: 92.80 + 120 = 212.80 total withheld
e.g. Professional services: 92.80 + 200 = 292.80 total withheld

Net payment to vendor = Gross Invoice − WVAT − WHT

WHT on VAT (from customers, on Chrysal's AR/sales side):
- Customers withhold 2% of the taxable value (net amount before VAT) on invoices
- Filed by customer directly to KRA by 20th of following month
- Chrysal receipts the net amount and tracks the withheld portion via KRA portal
- NOTE: this customer-side mechanism is the standard 2% WHT-on-VAT rule, distinct
  from Chrysal's own WVAT Agent obligation on the AP/payments side above.

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
    "General Goods/Contractual (3%)": 0.03,
    "Professional/Consultancy (5%)": 0.05,
    "Exempt": 0.00,
}

# Chrysal is an appointed KRA Withholding VAT (WVAT) Agent
WVAT_AGENT_RATE = 0.02  # 2% of the VAT-inclusive (gross) amount, withheld separately from WHT

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
        "wht_type": "General Goods/Contractual (3%)",
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
        "wht_type": "General Goods/Contractual (3%)",
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
        "wht_type": "General Goods/Contractual (3%)",
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
        "wht_type": "General Goods/Contractual (3%)",
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
        "wht_type": "General Goods/Contractual (3%)",
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
    """
    Return the standard Withholding Income Tax rate for a vendor type.
    Note: this is separate from the WVAT_AGENT_RATE (2% on gross),
    which Chrysal applies on top of this as an appointed WVAT Agent.
    """
    rate = WHT_TYPES.get(wht_type, 0.0)
    return rate if isinstance(rate, float) else 0.0
