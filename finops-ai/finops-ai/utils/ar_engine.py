"""
AR Receipting & Customer WHT Engine
Handles customer payment receipting, VAT WHT tracking,
and KRA certificate reconciliation for Accounts Receivable.

Chrysal-specific logic:
- Customers invoice in EUR/USD/KES
- 16% VAT charged on all invoices
- Customers withhold 2% of the 16% VAT → remit directly to KRA
- Chrysal receipts net amount (98% of VAT portion)
- Customer WHT certificates downloaded from KRA portal
  and matched to specific invoices
"""

import pandas as pd
from utils.currency import convert_to_kes, format_currency


VAT_RATE = 0.16
CUSTOMER_WHT_ON_VAT = 0.02  # 2% of the VAT portion


def calculate_invoice_vat_breakdown(
    net_amount: float,
    currency: str,
    rates: dict
) -> dict:
    """
    Calculate VAT and WHT breakdown for a customer invoice.
    net_amount = the invoice value before VAT
    """
    vat_amount = net_amount * VAT_RATE
    gross_amount = net_amount + vat_amount
    customer_wht_amount = vat_amount * CUSTOMER_WHT_ON_VAT
    expected_receipt = gross_amount - customer_wht_amount

    net_kes = convert_to_kes(net_amount, currency, rates)
    vat_kes = convert_to_kes(vat_amount, currency, rates)
    gross_kes = convert_to_kes(gross_amount, currency, rates)
    wht_kes = convert_to_kes(customer_wht_amount, currency, rates)
    receipt_kes = convert_to_kes(expected_receipt, currency, rates)

    return {
        "net_amount": net_amount,
        "vat_amount": vat_amount,
        "gross_amount": gross_amount,
        "customer_wht_on_vat": customer_wht_amount,
        "expected_receipt": expected_receipt,
        "currency": currency,
        "net_kes": net_kes,
        "vat_kes": vat_kes,
        "gross_kes": gross_kes,
        "wht_kes": wht_kes,
        "expected_receipt_kes": receipt_kes,
    }


def match_receipts_to_invoices(
    invoices: list,
    receipts: list,
    rates: dict,
    tolerance: float = 1.0
) -> dict:
    """
    Match customer payments received to outstanding AR invoices.
    invoices: list of dicts with customer, invoice_no, gross_amount, currency
    receipts: list of dicts with customer, receipt_ref, amount_received, currency, date
    """
    matched = []
    unmatched_receipts = []
    unmatched_invoices = []

    invoice_pool = [dict(inv, matched=False) for inv in invoices]

    for receipt in receipts:
        cust = receipt.get("customer", "").lower()
        recv_kes = convert_to_kes(
            receipt.get("amount_received", 0),
            receipt.get("currency", "KES"),
            rates
        )
        receipt_matched = False

        cust_invoices = [
            inv for inv in invoice_pool
            if not inv["matched"] and cust in inv.get("customer", "").lower()
        ]

        for inv in cust_invoices:
            # Expected receipt = gross - customer WHT (2% of VAT)
            gross = inv.get("gross_amount", 0)
            vat = gross / (1 + VAT_RATE) * VAT_RATE
            expected = gross - (vat * CUSTOMER_WHT_ON_VAT)
            expected_kes = convert_to_kes(expected, inv.get("currency", "KES"), rates)

            if abs(expected_kes - recv_kes) <= tolerance:
                wht_kes = convert_to_kes(
                    vat * CUSTOMER_WHT_ON_VAT,
                    inv.get("currency", "KES"), rates
                )
                matched.append({
                    "customer": receipt.get("customer"),
                    "invoice_no": inv.get("invoice_no"),
                    "receipt_ref": receipt.get("receipt_ref"),
                    "receipt_date": receipt.get("date"),
                    "amount_received_kes": round(recv_kes, 2),
                    "wht_to_claim_kes": round(wht_kes, 2),
                    "gross_invoice_kes": round(expected_kes + wht_kes, 2),
                    "kra_certificate": receipt.get("kra_certificate", "Pending"),
                    "status": "✅ Matched",
                })
                inv["matched"] = True
                receipt_matched = True
                break

        if not receipt_matched:
            unmatched_receipts.append({
                **receipt,
                "amount_kes": round(recv_kes, 2),
                "reason": "No matching invoice found",
            })

    unmatched_invoices = [inv for inv in invoice_pool if not inv["matched"]]

    total_received_kes = sum(m["amount_received_kes"] for m in matched)
    total_wht_to_claim_kes = sum(m["wht_to_claim_kes"] for m in matched)
    pending_certs = sum(1 for m in matched if m["kra_certificate"] == "Pending")

    return {
        "matched": matched,
        "unmatched_receipts": unmatched_receipts,
        "unmatched_invoices": unmatched_invoices,
        "summary": {
            "total_matched": len(matched),
            "total_received_kes": round(total_received_kes, 2),
            "total_wht_to_claim_kes": round(total_wht_to_claim_kes, 2),
            "pending_kra_certificates": pending_certs,
            "unmatched_receipts": len(unmatched_receipts),
            "outstanding_invoices": len(unmatched_invoices),
        }
    }
