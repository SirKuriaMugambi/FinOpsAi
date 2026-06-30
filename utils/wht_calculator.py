"""
WHT & WVAT Calculator — KRA Filing Preparation
Chrysal is an appointed KRA Withholding VAT (WVAT) Agent, so TWO separate
withholding obligations apply on every applicable vendor payment:

1. Withholding VAT (WVAT) — 2% of the VAT-inclusive (gross) amount
2. Withholding Income Tax (WHT) — 3% (general goods/contractual) or
   5% (professional/consultancy) of the base amount (before VAT)

Both are deducted from the gross invoice to arrive at the net payment to
the vendor, and are filed to KRA separately:
- WVAT → filed via the WVAT CSV/return
- WHT → filed via the standard WHT CSV (3%) or Excel import (5%)
"""

import pandas as pd
from datetime import datetime, date
import pytz
from typing import Optional
from data.tax_config import get_wht_rate, WHT_FILING_DAY, WVAT_AGENT_RATE
from utils.currency import convert_to_kes, format_currency
import io


KENYA_TZ = pytz.timezone("Africa/Nairobi")


def calculate_wht_for_payments(payments: list, rates: dict) -> dict:
    """
    Calculate WVAT + WHT on a list of approved vendor payments.
    Each payment dict should have:
    - vendor_name, vendor_id, wht_type, amount (base/subtotal), vat_amount,
      currency, payment_ref, cu_invoice_number
    """
    results_3pct = []   # General goods/contractual WHT (3%) → CSV upload
    results_5pct = []   # Professional/consultancy WHT (5%) → Excel import
    exempt = []

    total_wht_3pct_kes = 0
    total_wht_5pct_kes = 0
    total_wvat_kes = 0

    for payment in payments:
        wht_type = payment.get("wht_type", "Exempt")
        amount = float(payment.get("amount", 0))  # base/subtotal before VAT
        vat_amount = float(payment.get("vat_amount", 0))
        currency = payment.get("currency", "KES")
        amount_kes = convert_to_kes(amount, currency, rates)
        vat_kes = convert_to_kes(vat_amount, currency, rates)
        gross_kes = amount_kes + vat_kes

        wht_rate = get_wht_rate(wht_type)
        # WHT (income tax) is calculated on the base amount (before VAT)
        wht_kes = amount_kes * wht_rate
        # WVAT is calculated on the gross (VAT-inclusive) amount — Chrysal is an appointed WVAT Agent
        wvat_kes = gross_kes * WVAT_AGENT_RATE if wht_rate > 0 else 0
        total_withheld_kes = wht_kes + wvat_kes
        # Net paid to vendor = Gross Invoice − WVAT − WHT
        net_kes = gross_kes - total_withheld_kes

        entry = {
            "Vendor Name": payment.get("vendor_name", ""),
            "Vendor PIN": payment.get("vendor_pin", ""),
            "CU Invoice Number": payment.get("cu_invoice_number", ""),
            "Payment Ref": payment.get("payment_ref", ""),
            "Payment Date": payment.get("payment_date", ""),
            "Invoice Date": payment.get("invoice_date", ""),
            "Base Amount (KES)": round(amount_kes, 2),
            "VAT (KES)": round(vat_kes, 2),
            "Gross Invoice (KES)": round(gross_kes, 2),
            "WHT Rate": f"{wht_rate*100:.0f}%",
            "WHT Amount (KES)": round(wht_kes, 2),
            "WVAT Rate": "2%",
            "WVAT Amount (KES)": round(wvat_kes, 2),
            "Total Withheld (KES)": round(total_withheld_kes, 2),
            "Net Paid to Vendor (KES)": round(net_kes, 2),
            "Currency": currency,
            "Original Amount": round(amount, 2),
            "KRA Rate Used": payment.get("kra_rate_used", "Market rate"),
        }

        if wht_rate == 0.03:
            results_3pct.append(entry)
            total_wht_3pct_kes += wht_kes
            total_wvat_kes += wvat_kes
        elif wht_rate == 0.05:
            results_5pct.append(entry)
            total_wht_5pct_kes += wht_kes
            total_wvat_kes += wvat_kes
        else:
            exempt.append(entry)

    # Deadline calculation — using Kenya timezone (Africa/Nairobi)
    today = datetime.now(KENYA_TZ).date()
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
        deadline_flag = f"🚨 URGENT: KRA WHT/WVAT filing due in {days_to_deadline} day(s) — {deadline.strftime('%d %B %Y')}"
    elif days_to_deadline <= 7:
        deadline_flag = f"⚠️ KRA WHT/WVAT filing due in {days_to_deadline} days — {deadline.strftime('%d %B %Y')}"

    return {
        "3pct_entries": results_3pct,
        "5pct_entries": results_5pct,
        "exempt_entries": exempt,
        "total_wht_3pct_kes": round(total_wht_3pct_kes, 2),
        "total_wht_5pct_kes": round(total_wht_5pct_kes, 2),
        "total_wvat_kes": round(total_wvat_kes, 2),
        "total_wht_kes": round(total_wht_3pct_kes + total_wht_5pct_kes, 2),
        "total_withheld_kes": round(total_wht_3pct_kes + total_wht_5pct_kes + total_wvat_kes, 2),
        "deadline": deadline.strftime("%d %B %Y"),
        "days_to_deadline": days_to_deadline,
        "deadline_flag": deadline_flag,
        "current_time_nairobi": datetime.now(KENYA_TZ).strftime("%d %B %Y, %H:%M:%S %Z"),
    }


def generate_kra_csv(entries_3pct: list) -> bytes:
    """Generate KRA iTax-compatible CSV for 3% WHT (general goods/contractual) bulk upload."""
    if not entries_3pct:
        return b""
    kra_cols = {
        "Vendor PIN": "PIN of Withholdee",
        "Vendor Name": "Name of Withholdee",
        "CU Invoice Number": "CU Invoice Number",
        "Invoice Date": "Invoice Date",
        "Payment Date": "Date of Payment",
        "Base Amount (KES)": "Gross Amount",
        "WHT Amount (KES)": "Tax Withheld",
        "Payment Ref": "Payment Reference",
    }
    df = pd.DataFrame(entries_3pct)
    kra_df = pd.DataFrame()
    for our_col, kra_col in kra_cols.items():
        if our_col in df.columns:
            kra_df[kra_col] = df[our_col]
    kra_df["WHT Rate"] = "3%"
    kra_df["Nature of Payment"] = "General Goods/Contractual Payments"
    return kra_df.to_csv(index=False).encode("utf-8")


def generate_wvat_csv(all_entries: list) -> bytes:
    """Generate KRA WVAT CSV — filed separately from standard WHT, applies to all withheld payments."""
    if not all_entries:
        return b""
    kra_cols = {
        "Vendor PIN": "PIN of Withholdee",
        "Vendor Name": "Name of Withholdee",
        "CU Invoice Number": "CU Invoice Number",
        "Invoice Date": "Invoice Date",
        "Payment Date": "Date of Payment",
        "Gross Invoice (KES)": "VAT Inclusive Amount",
        "WVAT Amount (KES)": "VAT Withheld",
        "Payment Ref": "Payment Reference",
    }
    df = pd.DataFrame(all_entries)
    kra_df = pd.DataFrame()
    for our_col, kra_col in kra_cols.items():
        if our_col in df.columns:
            kra_df[kra_col] = df[our_col]
    kra_df["WVAT Rate"] = "2%"
    return kra_df.to_csv(index=False).encode("utf-8")


def generate_wht_excel(result: dict) -> bytes:
    """Generate Excel workbook with 3% WHT, 5% WHT, and WVAT on separate sheets."""
    output = io.BytesIO()
    all_entries = result["3pct_entries"] + result["5pct_entries"]
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        if result["3pct_entries"]:
            pd.DataFrame(result["3pct_entries"]).to_excel(
                writer, sheet_name="3% WHT - General Goods", index=False
            )
        if result["5pct_entries"]:
            pd.DataFrame(result["5pct_entries"]).to_excel(
                writer, sheet_name="5% WHT - Professional", index=False
            )
        if all_entries:
            pd.DataFrame(all_entries).to_excel(
                writer, sheet_name="2% WVAT - All Payments", index=False
            )
        summary_data = {
            "Item": [
                "Total 3% WHT (KES)", "Total 5% WHT (KES)", "Total WVAT 2% (KES)",
                "Total WHT Payable (KES)", "Total Withheld Overall (KES)",
                "KRA Filing Deadline", "Days Remaining", "Generated At (Nairobi Time)"
            ],
            "Value": [
                result["total_wht_3pct_kes"], result["total_wht_5pct_kes"], result["total_wvat_kes"],
                result["total_wht_kes"], result["total_withheld_kes"],
                result["deadline"], result["days_to_deadline"], result.get("current_time_nairobi", "")
            ]
        }
        pd.DataFrame(summary_data).to_excel(
            writer, sheet_name="Filing Summary", index=False
        )
    return output.getvalue()
