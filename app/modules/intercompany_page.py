"""
Intercompany Transactions Tracker
Tracks and reconciles transactions between Chrysal International Africa
and Chrysal International BV (parent company, Netherlands).
Handles EUR invoices, intercompany confirmations, and month-end balance matching.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from utils.currency import format_currency, convert_to_kes, now_nairobi
from utils.audit_trail import log_action, AuditAction


SAMPLE_IC_PAYABLES = [
    {"ref": "IC-2026-001", "description": "Product supply — Chrysal BV", "amount": 45000, "currency": "EUR", "date": "05/06/2026", "status": "Pending confirmation", "type": "Payable"},
    {"ref": "IC-2026-002", "description": "Management fee — Chrysal BV", "amount": 8500, "currency": "EUR", "date": "01/06/2026", "status": "Confirmed", "type": "Payable"},
    {"ref": "IC-2026-003", "description": "Technical support charges", "amount": 3200, "currency": "EUR", "date": "10/06/2026", "status": "Pending confirmation", "type": "Payable"},
]

SAMPLE_IC_RECEIVABLES = [
    {"ref": "IC-2026-R001", "description": "Local sales commission — Chrysal BV", "amount": 12000, "currency": "EUR", "date": "01/06/2026", "status": "Confirmed", "type": "Receivable"},
    {"ref": "IC-2026-R002", "description": "Recharge — market development", "amount": 5500, "currency": "EUR", "date": "15/06/2026", "status": "Pending confirmation", "type": "Receivable"},
]


def render_intercompany_page():
    st.title("🌍 Intercompany Transactions Tracker")
    st.caption("Track, reconcile and confirm intercompany balances between Chrysal International Africa and Chrysal International BV (Netherlands). Required for month-end closure.")
    st.divider()

    rates = st.session_state.rates
    current_user = st.session_state.get("current_user", "Finance Team")
    period = st.selectbox("Period", ["June 2026", "May 2026", "April 2026"])

    # Initialize IC state
    ic_key = f"ic_{period.replace(' ','_')}"
    if ic_key not in st.session_state:
        st.session_state[ic_key] = {
            "payables": SAMPLE_IC_PAYABLES.copy(),
            "receivables": SAMPLE_IC_RECEIVABLES.copy(),
            "confirmed": False,
            "confirmed_by": "",
            "confirmed_at": "",
        }

    ic = st.session_state[ic_key]

    # Summary metrics
    total_payables_eur = sum(t["amount"] for t in ic["payables"])
    total_receivables_eur = sum(t["amount"] for t in ic["receivables"])
    net_eur = total_receivables_eur - total_payables_eur
    total_payables_kes = sum(convert_to_kes(t["amount"], t["currency"], rates) for t in ic["payables"])
    total_receivables_kes = sum(convert_to_kes(t["amount"], t["currency"], rates) for t in ic["receivables"])

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("IC Payables (EUR)", f"€{total_payables_eur:,.0f}")
    col2.metric("IC Receivables (EUR)", f"€{total_receivables_eur:,.0f}")
    col3.metric("Net Position (EUR)", f"€{abs(net_eur):,.0f}", delta=f"{'Net Payable' if net_eur < 0 else 'Net Receivable'}")
    col4.metric("Confirmation Status", "✅ Confirmed" if ic["confirmed"] else "⏳ Pending")

    st.divider()

    tab1, tab2, tab3 = st.tabs(["📤 IC Payables", "📥 IC Receivables", "✅ Confirm Balances"])

    with tab1:
        st.subheader(f"Intercompany Payables — {period}")
        st.caption("Amounts owed TO Chrysal International BV")

        for i, txn in enumerate(ic["payables"]):
            col_a, col_b, col_c, col_d = st.columns([2, 1, 1, 1])
            col_a.write(f"**{txn['ref']}** — {txn['description']}")
            col_b.write(f"€{txn['amount']:,.0f}")
            col_c.write(txn['date'])
            status_color = "🟢" if txn["status"] == "Confirmed" else "🟡"
            col_d.write(f"{status_color} {txn['status']}")

        st.divider()
        st.subheader("Add New IC Payable")
        c1, c2, c3 = st.columns(3)
        new_ref = c1.text_input("Reference", key="ic_pay_ref")
        new_desc = c2.text_input("Description", key="ic_pay_desc")
        new_amt = c3.number_input("Amount (EUR)", min_value=0.0, step=100.0, key="ic_pay_amt")
        if st.button("➕ Add IC Payable", disabled=not new_ref):
            ic["payables"].append({
                "ref": new_ref, "description": new_desc,
                "amount": new_amt, "currency": "EUR",
                "date": now_nairobi().strftime("%d/%m/%Y"),
                "status": "Pending confirmation", "type": "Payable"
            })
            st.rerun()

    with tab2:
        st.subheader(f"Intercompany Receivables — {period}")
        st.caption("Amounts owed BY Chrysal International BV to Chrysal Africa")

        for txn in ic["receivables"]:
            col_a, col_b, col_c, col_d = st.columns([2, 1, 1, 1])
            col_a.write(f"**{txn['ref']}** — {txn['description']}")
            col_b.write(f"€{txn['amount']:,.0f}")
            col_c.write(txn['date'])
            status_color = "🟢" if txn["status"] == "Confirmed" else "🟡"
            col_d.write(f"{status_color} {txn['status']}")

        st.divider()
        st.subheader("Add New IC Receivable")
        c1, c2, c3 = st.columns(3)
        new_ref_r = c1.text_input("Reference", key="ic_rec_ref")
        new_desc_r = c2.text_input("Description", key="ic_rec_desc")
        new_amt_r = c3.number_input("Amount (EUR)", min_value=0.0, step=100.0, key="ic_rec_amt")
        if st.button("➕ Add IC Receivable", disabled=not new_ref_r):
            ic["receivables"].append({
                "ref": new_ref_r, "description": new_desc_r,
                "amount": new_amt_r, "currency": "EUR",
                "date": now_nairobi().strftime("%d/%m/%Y"),
                "status": "Pending confirmation", "type": "Receivable"
            })
            st.rerun()

    with tab3:
        st.subheader("Month-End Intercompany Balance Confirmation")
        st.caption("Mercy and Tony confirm balances with parent company before Charles closes the month.")

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Our Records (Chrysal Africa)**")
            st.metric("Total IC Payables", f"€{total_payables_eur:,.2f} (KES {total_payables_kes:,.0f})")
            st.metric("Total IC Receivables", f"€{total_receivables_eur:,.2f} (KES {total_receivables_kes:,.0f})")
            st.metric("Net IC Position", f"€{abs(net_eur):,.2f} {'Payable' if net_eur < 0 else 'Receivable'}")

        with col2:
            st.markdown("**Parent Company Confirmation (Chrysal BV)**")
            parent_payables = st.number_input("Parent records: IC Payables from Africa (EUR)", min_value=0.0, value=float(total_payables_eur), step=100.0)
            parent_receivables = st.number_input("Parent records: IC Receivables to Africa (EUR)", min_value=0.0, value=float(total_receivables_eur), step=100.0)

            diff_pay = abs(total_payables_eur - parent_payables)
            diff_rec = abs(total_receivables_eur - parent_receivables)

            if diff_pay < 1 and diff_rec < 1:
                st.success("✅ Balances agree — ready for confirmation")
                if st.button("✅ Confirm Intercompany Balances", type="primary"):
                    ic["confirmed"] = True
                    ic["confirmed_by"] = current_user
                    ic["confirmed_at"] = now_nairobi().strftime("%Y-%m-%d %H:%M")
                    log_action(current_user, AuditAction.INTERCOMPANY_CONFIRMED, period,
                              f"IC balances confirmed — Payables €{total_payables_eur:,.0f} / Receivables €{total_receivables_eur:,.0f}")
                    st.rerun()
            else:
                if diff_pay >= 1:
                    st.error(f"⚠️ Payables discrepancy: €{diff_pay:,.2f} — investigate before confirming")
                if diff_rec >= 1:
                    st.error(f"⚠️ Receivables discrepancy: €{diff_rec:,.2f} — investigate before confirming")

        if ic["confirmed"]:
            st.success(f"✅ Intercompany balances confirmed by {ic['confirmed_by']} at {ic['confirmed_at']}")
            st.info("Month-end checklist item 'Intercompany balance confirmation' can now be ticked as complete.")

        # Export — separated by entity (Chrysal Africa's books vs Chrysal BV's confirmation)
        st.divider()
        st.subheader("📥 Export Intercompany Reconciliation")

        import io
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            # Chrysal Africa's own records
            africa_payables_df = pd.DataFrame(ic["payables"])
            africa_receivables_df = pd.DataFrame(ic["receivables"])
            if not africa_payables_df.empty:
                africa_payables_df.to_excel(writer, sheet_name="Chrysal Africa - Payables", index=False)
            if not africa_receivables_df.empty:
                africa_receivables_df.to_excel(writer, sheet_name="Chrysal Africa - Receivables", index=False)

            # Summary comparing both entities' figures
            summary_df = pd.DataFrame({
                "Entity": ["Chrysal Africa (Our Records)", "Chrysal Africa (Our Records)",
                           "Chrysal BV (Parent Confirmation)", "Chrysal BV (Parent Confirmation)"],
                "Item": ["Total IC Payables (EUR)", "Total IC Receivables (EUR)",
                        "Total IC Payables (EUR)", "Total IC Receivables (EUR)"],
                "Amount (EUR)": [
                    total_payables_eur, total_receivables_eur,
                    parent_payables if 'parent_payables' in dir() else "Not yet confirmed",
                    parent_receivables if 'parent_receivables' in dir() else "Not yet confirmed",
                ]
            })
            summary_df.to_excel(writer, sheet_name="Entity Comparison Summary", index=False)

        st.download_button(
            "⬇️ Download IC Reconciliation (Chrysal Africa vs Chrysal BV)",
            output.getvalue(),
            f"Intercompany_Reconciliation_{period.replace(' ','_')}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        st.caption("Excel file contains separate sheets for Chrysal Africa's payables, receivables, and a side-by-side comparison against Chrysal BV's confirmed figures.")
