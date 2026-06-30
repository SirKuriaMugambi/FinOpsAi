"""Management Dashboard — aggregates data from all modules."""
import streamlit as st
import plotly.graph_objects as go
from utils.currency import format_currency
from datetime import date


def render_dashboard():
    st.title("⚙️ FinOps AI")
    st.caption("Chrysal International Africa — Finance Operating System")
    st.divider()

    # Pre-load sample data so dashboard never shows empty on first visit
    if not st.session_state.get("processed_invoices"):
        st.session_state.processed_invoices = [
            {"vendor_name": "Bayer East Africa Ltd", "invoice_number": "BAY-2026-055",
             "cu_invoice_number": "KRA-CU-20260601-055",
             "total_kes": 522000, "wht_kes": 9000, "net_payable_kes": 513000,
             "posting_ready": True, "wht_rate_pct": "2%", "doc_type": "Invoice",
             "ledger_account": "5000", "department": "OPS", "cost_centre": "511",
             "approver": "Harrison"},
            {"vendor_name": "DHL Express Kenya", "invoice_number": "DHL-8821",
             "cu_invoice_number": "KRA-CU-20260601-056",
             "total_kes": 98600, "wht_kes": 1700, "net_payable_kes": 96900,
             "posting_ready": True, "wht_rate_pct": "2%", "doc_type": "Invoice",
             "ledger_account": "5300", "department": "OPS", "cost_centre": "511",
             "approver": "Harrison"},
            {"vendor_name": "Deloitte East Africa", "invoice_number": "DEL-2026-04",
             "cu_invoice_number": "KRA-CU-20260601-057",
             "total_kes": 371200, "wht_kes": 16000, "net_payable_kes": 355200,
             "posting_ready": False, "wht_rate_pct": "5%", "doc_type": "Invoice",
             "ledger_account": "6500", "department": "TC", "cost_centre": "206",
             "approver": "Charles"},
        ]
    if not st.session_state.get("wht_payments"):
        st.session_state.wht_payments = [
            {"vendor_name": "Bayer East Africa Ltd", "wht_type": "Supplier (2%)",
             "amount": 450000, "vat_amount": 72000, "currency": "KES", "cu_invoice_number": "KRA-CU-20260601-055",
             "is_service": False, "payment_ref": "BAY-2026-055", "payment_date": "20/06/2026",
             "invoice_date": "01/06/2026", "vendor_pin": "", "kra_rate_used": ""},
            {"vendor_name": "DHL Express Kenya", "wht_type": "Supplier (2%)",
             "amount": 85000, "vat_amount": 13600, "currency": "KES", "cu_invoice_number": "KRA-CU-20260601-056",
             "is_service": False, "payment_ref": "DHL-8821", "payment_date": "20/06/2026",
             "invoice_date": "01/06/2026", "vendor_pin": "", "kra_rate_used": ""},
            {"vendor_name": "Deloitte East Africa", "wht_type": "Consultant (5%)",
             "amount": 320000, "vat_amount": 51200, "currency": "KES", "cu_invoice_number": "KRA-CU-20260601-057",
             "is_service": True, "payment_ref": "DEL-2026-04", "payment_date": "20/06/2026",
             "invoice_date": "01/06/2026", "vendor_pin": "", "kra_rate_used": ""},
        ]

    # Key metrics from session state
    processed = st.session_state.get("processed_invoices", [])
    wht_payments = st.session_state.get("wht_payments", [])
    recon = st.session_state.get("recon_result")
    ar = st.session_state.get("ar_result")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Invoices Processed", len(processed),
                help="Total AP invoices processed this session")
    col2.metric("WHT Entries", len(wht_payments),
                help="Vendor payments flagged for WHT calculation")
    col3.metric("Reconciled Items",
                recon["summary"]["total_matched"] if recon else 0,
                help="AP payments matched to invoices")
    col4.metric("AR Receipts Matched",
                ar["summary"]["total_matched"] if ar else 0,
                help="Customer receipts matched to invoices")

    st.divider()

    col_a, col_b = st.columns(2)

    with col_a:
        st.subheader("📄 Invoice Processing Summary")
        if processed:
            ready = sum(1 for i in processed if i.get("posting_ready"))
            flagged = len(processed) - ready
            fig = go.Figure(go.Pie(
                labels=["Ready to Post", "Flagged for Review"],
                values=[ready, flagged],
                marker_colors=["#16a34a", "#f59e0b"],
                hole=0.4,
            ))
            fig.update_layout(height=250, margin=dict(t=20, b=20))
            st.plotly_chart(fig, use_container_width=True)
            total_kes = sum(i.get("total_kes", 0) for i in processed)
            total_wht = sum(i.get("wht_kes", 0) for i in processed)
            st.metric("Total Invoice Value (KES)", format_currency(total_kes))
            st.metric("Total WHT Withheld (KES)", format_currency(total_wht))
        else:
            st.info("No invoices processed yet. Use the Invoice Processor module.")

    with col_b:
        st.subheader("🧾 WHT Filing Status")
        today = date.today()
        from data.tax_config import WHT_FILING_DAY
        if today.day <= WHT_FILING_DAY:
            deadline = date(today.year, today.month, WHT_FILING_DAY)
        else:
            if today.month == 12:
                deadline = date(today.year + 1, 1, WHT_FILING_DAY)
            else:
                deadline = date(today.year, today.month + 1, WHT_FILING_DAY)
        days_left = (deadline - today).days

        if days_left <= 3:
            st.error(f"🚨 KRA WHT filing due in **{days_left} day(s)** — {deadline.strftime('%d %B %Y')}")
        elif days_left <= 7:
            st.warning(f"⚠️ KRA WHT filing due in **{days_left} days** — {deadline.strftime('%d %B %Y')}")
        else:
            st.success(f"✅ Next KRA WHT deadline: **{deadline.strftime('%d %B %Y')}** ({days_left} days away)")

        if wht_payments:
            from utils.wht_calculator import calculate_wht_for_payments
            wht_result = calculate_wht_for_payments(wht_payments, st.session_state.rates)
            st.metric("Total WHT Payable (KES)", format_currency(wht_result["total_wht_kes"]))
            st.metric("2% WHT (Suppliers)", format_currency(wht_result["total_wht_2pct_kes"]))
            st.metric("5% WHT (Consultants)", format_currency(wht_result["total_wht_5pct_kes"]))
        else:
            st.info("No WHT payments entered yet. Use the WHT Calculator module.")

    st.divider()

    col_c, col_d = st.columns(2)

    with col_c:
        st.subheader("🔄 AP Reconciliation")
        if recon:
            s = recon["summary"]
            fig = go.Figure(go.Bar(
                x=["Matched", "Unmatched Payments", "Outstanding Invoices"],
                y=[s["total_matched"], s["total_unmatched_payments"], s["total_outstanding_invoices"]],
                marker_color=["#16a34a", "#ef4444", "#f59e0b"]
            ))
            fig.update_layout(height=250, margin=dict(t=20, b=20))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No reconciliation run yet. Use the AP Reconciliation module.")

    with col_d:
        st.subheader("💰 AR Receipting")
        if ar:
            s = ar["summary"]
            st.metric("Total Received (KES)", format_currency(s["total_received_kes"]))
            st.metric("WHT to Claim from KRA (KES)", format_currency(s["total_wht_to_claim_kes"]))
            if s["pending_kra_certificates"] > 0:
                st.warning(f"⚠️ {s['pending_kra_certificates']} KRA WHT certificate(s) still pending")
            st.metric("Unmatched Receipts", s["unmatched_receipts"])
        else:
            st.info("No AR receipts processed yet. Use the AR Receipting module.")
