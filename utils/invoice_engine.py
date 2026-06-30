"""
Invoice Processing Engine
Handles extraction, tax treatment determination, and posting summary
generation for AP invoices. Reuses extraction patterns from FinSight AI
but extended for invoice-specific fields (vendor, invoice number, line items).
"""

import re
import pandas as pd
from typing import Optional
import pdfplumber
import openpyxl

from data.tax_config import (
    get_vendor_by_name, get_vat_rate, get_wht_rate,
    VAT_TREATMENTS, WHT_TYPES, DEFAULT_VENDORS
)
from utils.currency import convert_to_kes, format_currency


def parse_number(value) -> Optional[float]:
    """Parse a financial number handling commas, parentheses, currency symbols."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    negative = s.startswith("(") and s.endswith(")")
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s == "-":
        return None
    try:
        val = float(s)
        return -abs(val) if negative else val
    except ValueError:
        return None


def extract_invoice_from_pdf(filepath: str) -> dict:
    """Extract invoice fields from a PDF invoice."""
    fields = {
        "vendor_name": None,
        "invoice_number": None,
        "invoice_date": None,
        "due_date": None,
        "subtotal": None,
        "vat_amount": None,
        "total": None,
        "currency": "KES",
        "line_items": [],
        "raw_text": "",
    }

    with pdfplumber.open(filepath) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"

            # Extract tables for line items
            for table in page.extract_tables():
                for row in table:
                    if row and len(row) >= 2:
                        fields["line_items"].append(row)

        fields["raw_text"] = full_text

        # Invoice number patterns
        inv_match = re.search(
            r'(?:invoice\s*(?:no|number|#)[:\s]*)([\w\-\/]+)',
            full_text, re.IGNORECASE
        )
        if inv_match:
            fields["invoice_number"] = inv_match.group(1).strip()

        # Date patterns
        date_match = re.search(
            r'(?:invoice\s*date|date)[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})',
            full_text, re.IGNORECASE
        )
        if date_match:
            fields["invoice_date"] = date_match.group(1).strip()

        # Currency detection
        if re.search(r'\bEUR\b|€', full_text):
            fields["currency"] = "EUR"
        elif re.search(r'\bUSD\b|\$', full_text):
            fields["currency"] = "USD"
        elif re.search(r'\bGBP\b|£', full_text):
            fields["currency"] = "GBP"

        # Total amount patterns
        total_match = re.search(
            r'(?:total|amount\s*due|grand\s*total)[:\s]*([\d,]+\.?\d*)',
            full_text, re.IGNORECASE
        )
        if total_match:
            fields["total"] = parse_number(total_match.group(1))

        # VAT amount — multiple patterns, avoiding VAT registration numbers
        vat_amount_found = None
        # Pattern 1: VAT(16%) or VAT (16%) followed by amount
        vat_match = re.search(
            r'vat\s*\(?\s*1[0-9]\s*%?\s*\)?[:\s]+([\d,]+\.?\d*)',
            full_text, re.IGNORECASE
        )
        if vat_match:
            val = parse_number(vat_match.group(1))
            if val and val < 10000000:
                vat_amount_found = val

        # Pattern 2: "VAT:" or "Tax:" followed by number on same line
        if not vat_amount_found:
            for line in full_text.split('\n'):
                if re.search(r'\bvat\b|\btax\b', line, re.IGNORECASE):
                    nums = re.findall(r'[\d,]+\.?\d*', line)
                    for n in nums:
                        val = parse_number(n)
                        if val and 100 < val < 10000000:
                            vat_amount_found = val
                            break
                if vat_amount_found:
                    break

        if vat_amount_found:
            fields["vat_amount"] = vat_amount_found

        # CU Invoice Number — matches "CU Invoice No.:" format
        cu_match = re.search(
            r'(?:cu\s*invoice\s*no\.?|cu\s*no\.?|control\s*unit\s*no\.?)[:\s]+([\w\-]+)',
            full_text, re.IGNORECASE
        )
        if cu_match:
            fields["cu_invoice_number"] = cu_match.group(1).strip()

        # Subtotal
        sub_match = re.search(
            r'(?:subtotal|sub-total|net\s*amount)[:\s]*([\d,]+\.?\d*)',
            full_text, re.IGNORECASE
        )
        if sub_match:
            fields["subtotal"] = parse_number(sub_match.group(1))

    return fields


def extract_invoice_from_excel(filepath: str) -> dict:
    """Extract invoice fields from an Excel file."""
    fields = {
        "vendor_name": None,
        "invoice_number": None,
        "invoice_date": None,
        "due_date": None,
        "subtotal": None,
        "vat_amount": None,
        "total": None,
        "currency": "KES",
        "line_items": [],
        "raw_text": "",
    }

    try:
        df = pd.read_excel(filepath, header=None)
        text_blob = df.to_string()
        fields["raw_text"] = text_blob

        for _, row in df.iterrows():
            row_vals = [str(v).strip() for v in row.tolist() if str(v).strip() != "nan"]
            if len(row_vals) >= 2:
                label = row_vals[0].lower()
                value = row_vals[1]
                if "invoice" in label and "no" in label:
                    fields["invoice_number"] = value
                elif "date" in label:
                    fields["invoice_date"] = value
                elif "total" in label and "vat" not in label:
                    fields["total"] = parse_number(value)
                elif "vat" in label or "tax" in label:
                    fields["vat_amount"] = parse_number(value)
                elif "subtotal" in label or "net" in label:
                    fields["subtotal"] = parse_number(value)
                elif "currency" in label:
                    fields["currency"] = value.upper()[:3]

        fields["line_items"] = df.values.tolist()
    except Exception as e:
        fields["error"] = str(e)

    return fields


def process_invoice(
    extracted: dict,
    vendor: dict,
    rates: dict,
    is_service: bool = False,
    kra_rate_override: float = None,
) -> dict:
    """
    Apply tax logic to an extracted invoice given a matched vendor.
    Chrysal is an appointed KRA WVAT Agent, so both WHT (income tax, on base
    amount) and WVAT (2% of gross/VAT-inclusive amount) are calculated.

    kra_rate_override: KRA's official exchange rate for the invoice date
    (KES per foreign currency unit). If provided, this rate is used for
    WHT/WVAT calculation instead of the live market rate. For KES invoices,
    this is ignored. This reflects real KRA compliance requirements —
    WHT on foreign currency invoices must use KRA's rate for the invoice date.

    Returns a complete posting summary ready for AX input.
    """
    currency = extracted.get("currency", "KES")
    subtotal = extracted.get("subtotal") or 0.0
    total = extracted.get("total") or subtotal
    cu_invoice_number = extracted.get("cu_invoice_number", "")

    # If subtotal missing, back-calculate from total and VAT
    vat_amount_original = extracted.get("vat_amount") or 0.0
    if not subtotal and total:
        subtotal = total - vat_amount_original

    # VAT calculation
    vat_treatment = vendor.get("vat_treatment", "Standard (16%)")
    vat_rate = get_vat_rate(vat_treatment)
    calculated_vat = subtotal * vat_rate
    invoice_total = subtotal + calculated_vat

    # WHT (income tax) calculation — on subtotal/base, not including VAT
    wht_type = vendor.get("wht_type", "General Goods/Contractual (2%)")
    wht_rate = get_wht_rate(wht_type)
    wht_amount = subtotal * wht_rate

    # WVAT calculation — 2% of the gross (VAT-inclusive) amount, Chrysal's WVAT Agent obligation
    wvat_rate = 0.02 if wht_rate > 0 else 0.0
    wvat_amount = invoice_total * wvat_rate

    total_withheld = wht_amount + wvat_amount
    net_payable = invoice_total - total_withheld

    # KES conversions — general display uses live market rate
    subtotal_kes = convert_to_kes(subtotal, currency, rates)
    vat_kes = convert_to_kes(calculated_vat, currency, rates)
    total_kes = convert_to_kes(invoice_total, currency, rates)

    # WHT/WVAT KES conversion — MUST use KRA's official rate for the invoice date
    # for foreign currency invoices (not the live market rate)
    if currency != "KES" and kra_rate_override and kra_rate_override > 0:
        # Use KRA's official rate for WHT/WVAT calculation
        wht_kes = wht_amount * kra_rate_override
        wvat_kes = wvat_amount * kra_rate_override
        net_payable_kes = invoice_total * kra_rate_override - wht_kes - wvat_kes
        kra_rate_used = kra_rate_override
        kra_rate_source = f"KRA official rate ({kra_rate_override:.4f})"
    else:
        # Fall back to live rate — flagged so user knows to verify
        wht_kes = convert_to_kes(wht_amount, currency, rates)
        wvat_kes = convert_to_kes(wvat_amount, currency, rates)
        net_payable_kes = convert_to_kes(net_payable, currency, rates)
        kra_rate_used = rates.get(currency, 1.0)
        kra_rate_source = "⚠️ Market rate used — enter KRA official rate for compliance"

    # Tax treatment flag
    flag = None
    if vat_amount_original and abs(calculated_vat - vat_amount_original) > 1:
        flag = (
            f"⚠️ VAT mismatch: Invoice shows "
            f"{format_currency(vat_amount_original, currency)} but "
            f"{vat_treatment} rate gives {format_currency(calculated_vat, currency)}. "
            f"Verify before posting."
        )

    # KRA rate warning for foreign currency if no override provided
    kra_rate_warning = None
    if currency != "KES" and not kra_rate_override:
        kra_rate_warning = (
            f"⚠️ KRA rate not entered for this {currency} invoice. "
            f"WHT/WVAT calculated using market rate (KES {kra_rate_used:,.4f} per {currency}). "
            f"For compliance, enter KRA's official rate for {extracted.get('invoice_date', 'the invoice date')}."
        )

    return {
        "vendor_name": vendor.get("name", "Unknown"),
        "vendor_id": vendor.get("vendor_id", ""),
        "cu_invoice_number": cu_invoice_number,
        "invoice_number": extracted.get("invoice_number", "N/A"),
        "invoice_date": extracted.get("invoice_date", "N/A"),
        "currency": currency,
        "subtotal": subtotal,
        "vat_treatment": vat_treatment,
        "vat_rate_pct": f"{vat_rate*100:.0f}%",
        "vat_amount": calculated_vat,
        "invoice_total": invoice_total,
        "wht_type": wht_type,
        "wht_rate_pct": f"{wht_rate*100:.0f}%",
        "wht_amount": wht_amount,
        "wvat_rate_pct": f"{wvat_rate*100:.0f}%",
        "wvat_amount": wvat_amount,
        "total_withheld": total_withheld,
        "net_payable": net_payable,
        "subtotal_kes": subtotal_kes,
        "vat_kes": vat_kes,
        "total_kes": total_kes,
        "wht_kes": wht_kes,
        "wvat_kes": wvat_kes,
        "net_payable_kes": net_payable_kes,
        "kra_rate_used": kra_rate_used,
        "kra_rate_source": kra_rate_source,
        "kra_rate_warning": kra_rate_warning,
        "tax_flag": flag,
        "posting_ready": flag is None,
        "ax_tax_code": vat_treatment.split("(")[0].strip().upper(),
    }
