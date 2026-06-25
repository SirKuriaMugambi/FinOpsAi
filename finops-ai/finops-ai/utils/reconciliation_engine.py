"""
AP Reconciliation Engine
Matches vendor payments to invoices, identifies unmatched items,
and generates remittance advice documents.

Matching logic:
1. Exact amount match on same vendor → high confidence
2. Amount match within tolerance (rounding differences) → medium confidence
3. Partial match (multiple invoices summing to payment) → flagged for review
4. No match → unmatched, needs manual investigation
"""

import pandas as pd
from typing import Optional
from utils.currency import convert_to_kes, format_currency


MATCH_TOLERANCE = 0.50  # KES tolerance for rounding differences


def load_invoices_from_df(df: pd.DataFrame) -> list:
    """
    Parse a DataFrame of outstanding invoices into a standard format.
    Expected columns: Vendor, Invoice No, Date, Amount, Currency, Status
    """
    invoices = []
    for _, row in df.iterrows():
        try:
            invoices.append({
                "vendor": str(row.get("Vendor", row.get("vendor", ""))).strip(),
                "invoice_no": str(row.get("Invoice No", row.get("invoice_no", ""))).strip(),
                "date": str(row.get("Date", row.get("date", ""))).strip(),
                "amount": float(row.get("Amount", row.get("amount", 0)) or 0),
                "currency": str(row.get("Currency", row.get("currency", "KES"))).strip().upper(),
                "status": str(row.get("Status", row.get("status", "Outstanding"))).strip(),
            })
        except Exception:
            continue
    return invoices


def load_payments_from_df(df: pd.DataFrame) -> list:
    """
    Parse a DataFrame of payments made into a standard format.
    Expected columns: Vendor, Payment Ref, Date, Amount Paid, Currency
    """
    payments = []
    for _, row in df.iterrows():
        try:
            payments.append({
                "vendor": str(row.get("Vendor", row.get("vendor", ""))).strip(),
                "payment_ref": str(row.get("Payment Ref", row.get("payment_ref", ""))).strip(),
                "date": str(row.get("Date", row.get("date", ""))).strip(),
                "amount_paid": float(row.get("Amount Paid", row.get("amount_paid", 0)) or 0),
                "currency": str(row.get("Currency", row.get("currency", "KES"))).strip().upper(),
            })
        except Exception:
            continue
    return payments


def reconcile(invoices: list, payments: list, rates: dict) -> dict:
    """
    Match payments to invoices. Returns structured reconciliation result.
    """
    matched = []
    unmatched_payments = []
    unmatched_invoices = []

    invoice_pool = [dict(inv, matched=False) for inv in invoices]

    for payment in payments:
        pay_vendor = payment["vendor"].lower()
        pay_amount_kes = convert_to_kes(payment["amount_paid"], payment["currency"], rates)
        payment_matched = False

        # Try to find matching invoice(s)
        vendor_invoices = [
            inv for inv in invoice_pool
            if not inv["matched"] and pay_vendor in inv["vendor"].lower()
        ]

        # 1. Exact single invoice match
        for inv in vendor_invoices:
            inv_amount_kes = convert_to_kes(inv["amount"], inv["currency"], rates)
            if abs(inv_amount_kes - pay_amount_kes) <= MATCH_TOLERANCE:
                matched.append({
                    "vendor": payment["vendor"],
                    "payment_ref": payment["payment_ref"],
                    "payment_date": payment["date"],
                    "invoice_no": inv["invoice_no"],
                    "invoice_date": inv["date"],
                    "amount_kes": pay_amount_kes,
                    "confidence": "✅ Exact match",
                    "difference": abs(inv_amount_kes - pay_amount_kes),
                })
                inv["matched"] = True
                payment_matched = True
                break

        # 2. Partial match — multiple invoices summing to payment
        if not payment_matched:
            combo_total = 0
            combo_invoices = []
            for inv in vendor_invoices:
                inv_amount_kes = convert_to_kes(inv["amount"], inv["currency"], rates)
                combo_total += inv_amount_kes
                combo_invoices.append(inv)
                if abs(combo_total - pay_amount_kes) <= MATCH_TOLERANCE:
                    invoice_nos = ", ".join(i["invoice_no"] for i in combo_invoices)
                    matched.append({
                        "vendor": payment["vendor"],
                        "payment_ref": payment["payment_ref"],
                        "payment_date": payment["date"],
                        "invoice_no": invoice_nos,
                        "invoice_date": combo_invoices[0]["date"],
                        "amount_kes": pay_amount_kes,
                        "confidence": "🟡 Multi-invoice match — verify",
                        "difference": abs(combo_total - pay_amount_kes),
                    })
                    for i in combo_invoices:
                        i["matched"] = True
                    payment_matched = True
                    break

        if not payment_matched:
            unmatched_payments.append({
                **payment,
                "amount_kes": pay_amount_kes,
                "reason": "No matching invoice found for this vendor and amount",
            })

    unmatched_invoices = [
        inv for inv in invoice_pool if not inv["matched"]
    ]

    total_matched_kes = sum(m["amount_kes"] for m in matched)
    total_unmatched_pay_kes = sum(p["amount_kes"] for p in unmatched_payments)
    total_outstanding_kes = sum(
        convert_to_kes(inv["amount"], inv["currency"], rates)
        for inv in unmatched_invoices
    )

    return {
        "matched": matched,
        "unmatched_payments": unmatched_payments,
        "unmatched_invoices": unmatched_invoices,
        "summary": {
            "total_matched": len(matched),
            "total_unmatched_payments": len(unmatched_payments),
            "total_outstanding_invoices": len(unmatched_invoices),
            "matched_value_kes": total_matched_kes,
            "unmatched_payment_value_kes": total_unmatched_pay_kes,
            "outstanding_value_kes": total_outstanding_kes,
        }
    }


def generate_remittance_data(matched: list, vendor_name: str) -> dict:
    """Generate remittance advice data for a specific vendor."""
    vendor_matched = [m for m in matched if vendor_name.lower() in m["vendor"].lower()]
    total = sum(m["amount_kes"] for m in vendor_matched)
    return {
        "vendor": vendor_name,
        "invoices": vendor_matched,
        "total_kes": total,
        "invoice_count": len(vendor_matched),
    }
