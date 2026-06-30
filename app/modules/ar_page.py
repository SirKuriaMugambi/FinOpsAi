"""AR Receipting & Customer WHT Page."""
import streamlit as st
import pandas as pd
from utils.ar_engine import calculate_invoice_vat_breakdown, match_receipts_to_invoices
from utils.currency import format_currency


SAMPLE_AR_INVOICES = [
    {"customer": "Rose Farm BV", "invoice_no": "INV-2026-041", "net_amount": 58000, "currency": "EUR"},
    {"customer": "Florimex GmbH", "invoice_no": "INV-2026-042", "net_amount": 34800, "currency": "EUR"},
    {"customer": "Naivas Ltd", "invoice_no": "INV-2026-043", "net_amount": 245000, "currency": "KES"},
]

SAMPLE_AR_RECEIPTS = [
    {"customer": "Rose Farm BV", "receipt_ref": "REC-001", "date": "05/06/2026",
     "amount_received": 66120, "currency": "EUR", "kra_certificate": "KRA-CERT-001"},
    {"customer": "Naivas Ltd", "receipt_ref": "REC-002", "date": "06/06/2026",
     "amount_received": 279300, "currency": "KES", "kra_certificate": "Pending"},
]


def render_ar_page():
    st.title("💰 AR Receipting & Customer WHT")
    st.caption("Receipt customer payments, track the 2% WHT customers withhold on the taxable value, and match KRA certificates to invoices. Supports multi-currency invoicing (EUR/USD/KES).")
    st.divider()

    rates = st.session_state.rates
    tab1, tab2, tab3 = st.tabs(["🧮 Invoice VAT Calculator", "🔄 Match Receipts", "📋 KRA Certificate Tracker"])

    with tab1:
        st.subheader("Calculate VAT & Customer WHT for a Customer Invoice")
        st.caption("Enter the net invoice amount (before VAT). The app shows what the customer should pay and what they'll withhold.")
        col1, col2 = st.columns(2)
        with col1:
            net_amount = st.number_input("Net Invoice Amount (before VAT)", min_value=0.0, step=1000.0)
            currency = st.selectbox("Invoice Currency", ["EUR", "USD", "KES", "GBP"])
        with col2:
            if net_amount > 0:
                breakdown = calculate_invoice_vat_breakdown(net_amount, currency, rates)
                st.metric("Net Amount", format_currency(breakdown["net_amount"], currency))
                st.metric("+ 16% VAT", format_currency(breakdown["vat_amount"], currency))
                st.metric("= Gross Invoice", format_currency(breakdown["gross_amount"], currency))
                st.divider()
                st.metric("Customer withholds (2% of taxable value)", format_currency(breakdown["customer_wht_on_vat"], currency))
                st.metric("✅ Expected Receipt from Customer", format_currency(breakdown["expected_receipt"], currency))
                st.metric("Expected Receipt (KES)", format_currency(breakdown["expected_receipt_kes"]))

    with tab2:
        st.subheader("Match Customer Receipts to Invoices")
        col1, col2 = st.columns(2)
        with col1:
            st.caption("Outstanding AR Invoices")
            use_sample = st.checkbox("Use sample AR data", value=True)
            if use_sample:
                invoices = SAMPLE_AR_INVOICES
                receipts = SAMPLE_AR_RECEIPTS
                st.dataframe(pd.DataFrame(invoices), use_container_width=True)
            else:
                inv_file = st.file_uploader("Upload AR invoices", type=["xlsx","csv"], key="ar_inv")
                invoices = None
                if inv_file:
                    df = pd.read_excel(inv_file) if inv_file.name.endswith(("xlsx","xls")) else pd.read_csv(inv_file)
                    invoices = df.to_dict("records")
                    st.dataframe(df, use_container_width=True)
        with col2:
            st.caption("Payments Received")
            if use_sample:
                st.dataframe(pd.DataFrame(receipts), use_container_width=True)
            else:
                rec_file = st.file_uploader("Upload receipts", type=["xlsx","csv"], key="ar_rec")
                receipts = None
                if rec_file:
                    df = pd.read_excel(rec_file) if rec_file.name.endswith(("xlsx","xls")) else pd.read_csv(rec_file)
                    receipts = df.to_dict("records")
                    st.dataframe(df, use_container_width=True)

        if st.button("🔄 Match Receipts to Invoices", type="primary"):
            if invoices and receipts:
                result = match_receipts_to_invoices(invoices, receipts, rates)
                st.session_state.ar_result = result
                s = result["summary"]
                col_a, col_b, col_c = st.columns(3)
                col_a.metric("✅ Matched", s["total_matched"])
                col_b.metric("Total Received (KES)", format_currency(s["total_received_kes"]))
                col_c.metric("WHT to Claim from KRA (KES)", format_currency(s["total_wht_to_claim_kes"]))

                if result["matched"]:
                    st.dataframe(pd.DataFrame(result["matched"]), use_container_width=True)
                if result["unmatched_receipts"]:
                    st.warning("Unmatched receipts:")
                    st.dataframe(pd.DataFrame(result["unmatched_receipts"]), use_container_width=True)

    with tab3:
        st.subheader("KRA WHT Certificate Tracker")
        st.caption("Track which customer WHT certificates have been received from KRA portal vs still pending.")
        ar_result = st.session_state.get("ar_result")
        if ar_result:
            matched = ar_result["matched"]
            pending = [m for m in matched if m["kra_certificate"] == "Pending"]
            received = [m for m in matched if m["kra_certificate"] != "Pending"]
            col1, col2 = st.columns(2)
            col1.metric("Certificates Received", len(received))
            col2.metric("Certificates Pending", len(pending))
            if pending:
                st.warning(f"⚠️ {len(pending)} certificate(s) still pending from KRA portal:")
                st.dataframe(pd.DataFrame(pending)[["customer","invoice_no","wht_to_claim_kes","kra_certificate"]], use_container_width=True)
            if received:
                st.success("Received certificates:")
                st.dataframe(pd.DataFrame(received)[["customer","invoice_no","wht_to_claim_kes","kra_certificate"]], use_container_width=True)
        else:
            st.info("Run the receipt matching first to see certificate tracking.")
