"""AP Reconciliation Page — match payments to invoices, generate remittance advice."""
import streamlit as st
import pandas as pd
import io
from utils.reconciliation_engine import reconcile, generate_remittance_data
from utils.currency import format_currency, now_nairobi


SAMPLE_INVOICES = pd.DataFrame([
    {"Vendor": "Bayer East Africa Ltd", "Invoice No": "BAY-2026-001", "Date": "01/05/2026", "Amount": 450000, "Currency": "KES", "Status": "Outstanding"},
    {"Vendor": "Bayer East Africa Ltd", "Invoice No": "BAY-2026-002", "Date": "15/05/2026", "Amount": 230000, "Currency": "KES", "Status": "Outstanding"},
    {"Vendor": "DHL Express Kenya", "Invoice No": "DHL-8821", "Date": "10/05/2026", "Amount": 85000, "Currency": "KES", "Status": "Outstanding"},
    {"Vendor": "Deloitte East Africa", "Invoice No": "DEL-2026-04", "Date": "01/04/2026", "Amount": 320000, "Currency": "KES", "Status": "Outstanding"},
])

SAMPLE_PAYMENTS = pd.DataFrame([
    {"Vendor": "Bayer East Africa Ltd", "Payment Ref": "PAY-001", "Date": "20/05/2026", "Amount Paid": 450000, "Currency": "KES"},
    {"Vendor": "DHL Express Kenya", "Payment Ref": "PAY-002", "Date": "20/05/2026", "Amount Paid": 85000, "Currency": "KES"},
])


def render_recon_page():
    st.title("🔄 AP Reconciliation")
    st.caption("Upload your outstanding invoices and payment records. The app matches payments to invoices, flags unmatched items, and generates remittance advice for your vendors.")
    st.divider()

    rates = st.session_state.rates

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Outstanding Invoices")
        use_sample_inv = st.checkbox("Use sample invoice data", value=True, key="recon_sample_inv")
        if use_sample_inv:
            inv_df = SAMPLE_INVOICES.copy()
            st.dataframe(inv_df, use_container_width=True)
        else:
            inv_file = st.file_uploader("Upload invoices (Excel/CSV)", type=["xlsx","xls","csv"], key="inv_upload")
            if inv_file:
                inv_df = pd.read_excel(inv_file) if inv_file.name.endswith(("xlsx","xls")) else pd.read_csv(inv_file)
                st.dataframe(inv_df, use_container_width=True)
            else:
                inv_df = None
                st.info("Upload an Excel or CSV file with columns: Vendor, Invoice No, Date, Amount, Currency, Status")

    with col2:
        st.subheader("Payments Made")
        use_sample_pay = st.checkbox("Use sample payment data", value=True, key="recon_sample_pay")
        if use_sample_pay:
            pay_df = SAMPLE_PAYMENTS.copy()
            st.dataframe(pay_df, use_container_width=True)
        else:
            pay_file = st.file_uploader("Upload payments (Excel/CSV)", type=["xlsx","xls","csv"], key="pay_upload")
            if pay_file:
                pay_df = pd.read_excel(pay_file) if pay_file.name.endswith(("xlsx","xls")) else pd.read_csv(pay_file)
                st.dataframe(pay_df, use_container_width=True)
            else:
                pay_df = None
                st.info("Upload an Excel or CSV with columns: Vendor, Payment Ref, Date, Amount Paid, Currency")

    st.divider()
    if st.button("🔄 Run Reconciliation", type="primary", use_container_width=True):
        if inv_df is not None and pay_df is not None:
            from utils.reconciliation_engine import load_invoices_from_df, load_payments_from_df
            invoices = load_invoices_from_df(inv_df)
            payments = load_payments_from_df(pay_df)
            result = reconcile(invoices, payments, rates)
            st.session_state.recon_result = result
            st.session_state["remittance"] = None  # reset remittance on new recon
        else:
            st.error("Please provide both invoice and payment data before running reconciliation.")

    # Render results from session state — persists across button clicks
    result = st.session_state.get("recon_result")
    if result:
        s = result["summary"]
        col_a, col_b, col_c = st.columns(3)
        col_a.metric("✅ Matched", s["total_matched"],
                     f"KES {s['matched_value_kes']:,.0f}")
        col_b.metric("⚠️ Unmatched Payments", s["total_unmatched_payments"],
                     f"KES {s['unmatched_payment_value_kes']:,.0f}")
        col_c.metric("📋 Outstanding Invoices", s["total_outstanding_invoices"],
                     f"KES {s['outstanding_value_kes']:,.0f}")

        if result["matched"]:
            st.subheader("✅ Matched Items — Ready for Remittance")
            st.dataframe(pd.DataFrame(result["matched"]), use_container_width=True)

            st.subheader("📋 Generate Remittance Advice")
            st.caption("Select a vendor from the matched list to generate their remittance advice")
            vendors_matched = list(set(m["vendor"] for m in result["matched"]))
            selected_vendor = st.selectbox("Select vendor", vendors_matched)

            if st.button("📋 Generate Remittance Advice"):
                remittance = generate_remittance_data(result["matched"], selected_vendor)
                st.session_state["remittance"] = remittance

            if st.session_state.get("remittance"):
                remittance = st.session_state["remittance"]
                st.success(f"✅ Remittance Advice — {remittance['vendor']}")
                col1, col2 = st.columns(2)
                col1.metric("Invoices Being Paid", remittance["invoice_count"])
                col2.metric("Total Remitting (KES)", format_currency(remittance["total_kes"]))
                st.dataframe(pd.DataFrame(remittance["invoices"]), use_container_width=True)

                remittance_text = f"""CHRYSAL INTERNATIONAL AFRICA
REMITTANCE ADVICE
{'='*50}
Vendor: {remittance['vendor']}
Date: {now_nairobi().strftime('%d %B %Y')} (Nairobi time)
Total Amount Remitting: KES {remittance['total_kes']:,.2f}
Number of Invoices: {remittance['invoice_count']}

INVOICES BEING PAID:
"""
                for inv in remittance["invoices"]:
                    remittance_text += f"\n  Invoice: {inv.get('invoice_no','N/A')} | Amount: KES {inv.get('amount_kes',0):,.2f} | Date: {inv.get('payment_date','')}"
                remittance_text += f"\n\n{'='*50}\nPrepared by: Finance Team\nFor approval by: Charles (Business Controller)\nPayment to be processed by: Tony (Finance Manager)"

                st.download_button(
                    "⬇️ Download Remittance Advice",
                    remittance_text.encode(),
                    f"Remittance_{remittance['vendor'].replace(' ','_')}.txt",
                    "text/plain"
                )

                from app.modules.document_store_page import save_document
                if not st.session_state.get(f"remit_saved_{remittance['vendor']}"):
                    save_document("Remittance Advice", f"Remittance — {remittance['vendor']}",
                                 remittance_text, related_ref=remittance['vendor'])
                    st.session_state[f"remit_saved_{remittance['vendor']}"] = True

        if result["unmatched_payments"]:
            st.subheader("❌ Unmatched Payments")
            st.error("These payments could not be matched to any invoice — investigate before filing.")
            st.dataframe(pd.DataFrame(result["unmatched_payments"]), use_container_width=True)

        if result["unmatched_invoices"]:
            st.subheader("📋 Still Outstanding Invoices")
            st.warning("These invoices have no corresponding payment on record.")
            st.dataframe(pd.DataFrame(result["unmatched_invoices"]), use_container_width=True)
