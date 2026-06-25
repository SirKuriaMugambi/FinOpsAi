"""
Kenya Tax Configuration & Vendor Master
Based on KRA tax rates and real AP/AR workflows in Kenyan private companies.

VAT rates (Kenya):
- Standard rated: 16%
- Zero rated: 0% (exports, certain goods)
- Exempt: no VAT charged, no input credit
- Special rate: 5% (certain petroleum products, LPG)

WHT rates (Kenya - on payments to vendors):
- Suppliers (goods): 2%
- Consultants/professional services: 5%
- Some vendors have both (mixed supply of goods + services)
- Threshold: WHT only applies to registered vendors above KES 24,000/year

WHT on VAT (from customers):
- Customers withhold 2% of the 16% VAT charged on invoices
- Filed by customer directly to KRA by 20th of following month
- Chrysal receipts the net VAT and tracks the withheld portion via KRA portal

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
    "Exempt": None,        # None = no VAT applicable
    "Special Rate (5%)": 0.05,
}

# --- WHT Rate Options ---
WHT_TYPES = {
    "Supplier (2%)": 0.02,
    "Consultant (5%)": 0.05,
    "Both (2% goods / 5% services)": "both",
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
        "wht_type": "Supplier (2%)",
        "currency": "KES",
        "notes": "Chemical/agricultural supplies",
    },
    {
        "vendor_id": "V002",
        "name": "DHL Express Kenya",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Supplier (2%)",
        "currency": "KES",
        "notes": "Courier and logistics",
    },
    {
        "vendor_id": "V003",
        "name": "Deloitte East Africa",
        "type": "Consultant",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Consultant (5%)",
        "currency": "KES",
        "notes": "Audit and advisory services",
    },
    {
        "vendor_id": "V004",
        "name": "Kenya Power & Lighting",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Supplier (2%)",
        "currency": "KES",
        "notes": "Electricity utility",
    },
    {
        "vendor_id": "V005",
        "name": "Safaricom PLC",
        "type": "Supplier",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Supplier (2%)",
        "currency": "KES",
        "notes": "Telecoms and data services",
    },
    {
        "vendor_id": "V006",
        "name": "PricewaterhouseCoopers Kenya",
        "type": "Consultant",
        "vat_treatment": "Standard (16%)",
        "wht_type": "Both (2% goods / 5% services)",
        "currency": "KES",
        "notes": "Tax advisory and audit",
    },
    {
        "vendor_id": "V007",
        "name": "Export Supplies International",
        "type": "Supplier",
        "vat_treatment": "Zero Rated (0%)",
        "wht_type": "Supplier (2%)",
        "currency": "USD",
        "notes": "International export supplies — zero rated",
    },
    {
        "vendor_id": "V008",
        "name": "Chrysal International BV",
        "type": "Supplier",
        "vat_treatment": "Zero Rated (0%)",
        "wht_type": "Exempt",
        "currency": "EUR",
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
    Return the WHT rate for a vendor.
    For 'Both' vendors, use is_service flag to determine which rate applies.
    """
    if wht_type == "Both (2% goods / 5% services)":
        return 0.05 if is_service else 0.02
    rate = WHT_TYPES.get(wht_type, 0.0)
    return rate if isinstance(rate, float) else 0.0
