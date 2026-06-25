"""
WHT Calculator & KRA Filing Preparation
Calculates Withholding Tax obligations on vendor payments and
generates KRA-ready outputs:
- CSV file for 2% WHT (bulk upload to KRA iTax portal)
- Excel summary for 5% WHT (manual import)
- Monthly filing summary with deadline tracking
"""

import pandas as pd
from datetime import datetime, date
from typing import Optional
from data.tax_config import get_wht_rate, WHT_FILING_DAY
from utils.currency import convert_to_kes, format_currency
import io


def calculate_wht_for_payments(payments: list, rates: dict) -> dict:
    """
    Calculate WHT on a list of approved vendor payments.
    Each payment dict should have:
    - vendor_name, vendor_id, wht_type, amount, currency, is_service (bool), payment_ref
    """
    results_2pct = []   # Supplier WHT (2%) → CSV upload
    results_5pct = []   # Consultant WHT (5%) → Excel import
    exempt = []

    total_wht_2pct_kes = 0
    total_wht_5pct_kes = 0

    for payment in payments:
        wht_type = payment.get("wht_type", "Exempt")
        is_service = payment.get("is_service", False)
        amount = float(payment.get("amount", 0))
        currency = payment.get("currency", "KES")
        amount_kes = convert_to_kes(amount, currency, rates)

        wht_rate = get_wht_rate(wht_type, is_service=is_service)
        wht_kes = amount_kes * wht_rate
        net_kes = amount_kes - wht_kes

        entry = {
            "Vendor Name": payment.get("vendor_name", ""),
            "Vendor PIN": payment.get("vendor_pin", ""),
            "CU Invoice Number": payment.get("cu_invoice_number", ""),
            "Payment Ref": payment.get("payment_ref", ""),
            "Payment Date": payment.get("payment_date", ""),
            "Invoice Date": payment.get("invoice_date", ""),
            "Gross Amount (KES)": round(amount_kes, 2),
            "WHT Rate": f"{wht_rate*100:.0f}%",
            "WHT Amount (KES)": round(wht_kes, 2),
            "Net Paid (KES)": round(net_kes, 2),
            "Currency": currency,
            "Original Amount": round(amount, 2),
            "KRA Rate Used": payment.get("kra_rate_used", "Market rate"),
        }

        if wht_rate == 0.02:
            results_2pct.append(entry)
            total_wht_2pct_kes += wht_kes
        elif wht_rate == 0.05:
            results_5pct.append(entry)
            total_wht_5pct_kes += wht_kes
        else:
            exempt.append(entry)

    # Deadline calculation
    today = date.today()
    if today.day <= WHT_FILING_DAY:
        deadline = date(today.year, today.month, WHT_FILING_DAY)
    else:
        if today.month == 12:
            deadline = date(today.year + 1, 1, WHT_FILING_DAY)
        else:
            deadline = date(today.year, today.month + 1, WHT_FILING_DAY)

    days_to_deadline = (deadline - today).days
    deadline_flag = None
    if days_to_deadline <= 3:
        deadline_flag = f"🚨 URGENT: KRA WHT filing due in {days_to_deadline} day(s) — {deadline.strftime('%d %B %Y')}"
    elif days_to_deadline <= 7:
        deadline_flag = f"⚠️ KRA WHT filing due in {days_to_deadline} days — {deadline.strftime('%d %B %Y')}"

    return {
        "2pct_entries": results_2pct,
        "5pct_entries": results_5pct,
        "exempt_entries": exempt,
        "total_wht_2pct_kes": round(total_wht_2pct_kes, 2),
        "total_wht_5pct_kes": round(total_wht_5pct_kes, 2),
        "total_wht_kes": round(total_wht_2pct_kes + total_wht_5pct_kes, 2),
        "deadline": deadline.strftime("%d %B %Y"),
        "days_to_deadline": days_to_deadline,
        "deadline_flag": deadline_flag,
    }


def generate_kra_csv(entries_2pct: list) -> bytes:
    """Generate KRA iTax-compatible CSV for 2% WHT bulk upload."""
    if not entries_2pct:
        return b""
    kra_cols = {
        "Vendor PIN": "PIN of Withholdee",
        "Vendor Name": "Name of Withholdee",
        "CU Invoice Number": "CU Invoice Number",
        "Invoice Date": "Invoice Date",
        "Payment Date": "Date of Payment",
        "Gross Amount (KES)": "Gross Amount",
        "WHT Amount (KES)": "Tax Withheld",
        "Payment Ref": "Payment Reference",
    }
    df = pd.DataFrame(entries_2pct)
    kra_df = pd.DataFrame()
    for our_col, kra_col in kra_cols.items():
        if our_col in df.columns:
            kra_df[kra_col] = df[our_col]
    kra_df["WHT Rate"] = "2%"
    kra_df["Nature of Payment"] = "Payments to Resident Vendors"
    return kra_df.to_csv(index=False).encode("utf-8")


def generate_wht_excel(result: dict) -> bytes:
    """Generate Excel workbook with 2% and 5% WHT on separate sheets."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        if result["2pct_entries"]:
            pd.DataFrame(result["2pct_entries"]).to_excel(
                writer, sheet_name="2% WHT - Suppliers", index=False
            )
        if result["5pct_entries"]:
            pd.DataFrame(result["5pct_entries"]).to_excel(
                writer, sheet_name="5% WHT - Consultants", index=False
            )
        summary_data = {
            "Item": [
                "Total 2% WHT (KES)", "Total 5% WHT (KES)",
                "Total WHT Payable (KES)", "KRA Filing Deadline", "Days Remaining"
            ],
            "Value": [
                result["total_wht_2pct_kes"], result["total_wht_5pct_kes"],
                result["total_wht_kes"], result["deadline"], result["days_to_deadline"]
            ]
        }
        pd.DataFrame(summary_data).to_excel(
            writer, sheet_name="Filing Summary", index=False
        )
    return output.getvalue()
