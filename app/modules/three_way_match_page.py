"""
3-Way Matching Engine (AP Side)
Matches Purchase Orders → Goods Receipt Notes (GRN) → Vendor Invoices
Flags discrepancies before invoice is approved for payment.
Based on Chrysal's real procurement workflow where Harrison raises POs,
goods are received and booked, then finance matches against vendor invoice.
"""

import streamlit as st
import pandas as pd
from utils.currency import format_currency
from utils.audit_trail import log_action, AuditAction


SAMPLE_POS = [
    {"po_number": "PO-2026-041", "vendor": "Bayer East Africa Ltd", "description": "Agricultural chemicals", "po_amount": 450000, "currency": "KES", "raised_by": "Harrison", "date": "25/05/2026", "status": "Open"},
    {"po_number": "PO-2026-042", "vendor": "DHL Express Kenya", "description": "Freight services June", "po_amount": 85000, "currency": "KES", "raised_by": "Harrison", "date": "28/05/2026", "status": "Open"},
    {"po_number": "PO-2026-043", "vendor": "Chrysal International BV", "description": "Product supply — June batch", "po_amount": 45000, "currency": "EUR", "raised_by": "Harrison", "date": "01/06/2026", "status": "Open"},
]

SAMPLE_GRNS = [
    {"grn_number": "GRN-2026-041", "po_number": "PO-2026-041", "vendor": "Bayer East Africa Ltd", "goods_received": "Agricultural chemicals", "grn_amount": 450000, "currency": "KES", "received_by": "Harrison", "date": "02/06/2026"},
    {"grn_number": "GRN-2026-042", "po_number": "PO-2026-042", "vendor": "DHL Express Kenya", "goods_received": "Freight services", "grn_amount": 85000, "currency": "KES", "received_by": "Harrison", "date": "05/06/2026"},
    {"grn_number": "GRN-2026-043", "po_number": "PO-2026-043", "vendor": "Chrysal International BV", "goods_received": "Product supply batch", "grn_amount": 44800, "currency": "EUR", "received_by": "Harrison", "date": "06/06/2026"},
]

SAMPLE_INVOICES = [
    {"invoice_number": "BAY-2026-055", "po_number": "PO-2026-041", "vendor": "Bayer East Africa Ltd", "invoice_amount": 450000, "currency": "KES", "invoice_date": "03/06/2026"},
    {"invoice_number": "DHL-8821", "po_number": "PO-2026-042", "vendor": "DHL Express Kenya", "invoice_amount": 87500, "currency": "KES", "invoice_date": "06/06/2026"},
    {"invoice_number": "IC-2026-001", "po_number": "PO-2026-043", "vendor": "Chrysal International BV", "invoice_amount": 45000, "currency": "EUR", "invoice_date": "07/06/2026"},
]

TOLERANCE = 0.01  # 1% tolerance for minor variances


def run_three_way_match(pos, grns, invoices):
    results = []
    for inv in invoices:
        po = next((p for p in pos if p["po_number"] == inv.get("po_number")), None)
        grn = next((g for g in grns if g["po_number"] == inv.get("po_number")), None)

        po_amount = po["po_amount"] if po else None
        grn_amount = grn["grn_amount"] if grn else None
        inv_amount = inv["invoice_amount"]

        # Check matches
        po_match = po_amount is not None and abs(po_amount - inv_amount) / max(po_amount, 1) <= TOLERANCE
        grn_match = grn_amount is not None and abs(grn_amount - inv_amount) / max(grn_amount, 1) <= TOLERANCE

        if po and grn and po_match and grn_match:
            status = "✅ 3-Way Match — Approve for Payment"
            flag = None
        elif po and po_match and not grn:
            status = "🟡 GRN Missing — Cannot approve until goods confirmed received"
            flag = "GRN not found for this PO"
        elif po and grn and po_match and not grn_match:
            status = "🔴 GRN vs Invoice Mismatch — Quantity discrepancy"
            flag = f"GRN: {grn_amount:,.0f} vs Invoice: {inv_amount:,.0f} {inv['currency']}"
        elif po and grn and not po_match:
            status = "🔴 PO vs Invoice Mismatch — Price discrepancy"
            flag = f"PO: {po_amount:,.0f} vs Invoice: {inv_amount:,.0f} {inv['currency']}"
        elif not po:
            status = "🔴 No PO Found — Unauthorized purchase"
            flag = "Invoice received without a Purchase Order"
        else:
            status = "⚠️ Review Required"
            flag = "Manual review needed"

        results.append({
            "Invoice No.": inv["invoice_number"],
            "PO No.": inv.get("po_number", "N/A"),
            "GRN No.": grn["grn_number"] if grn else "Missing",
            "Vendor": inv["vendor"],
            "PO Amount": f"{po_amount:,.0f} {po['currency']}" if po else "N/A",
            "GRN Amount": f"{grn_amount:,.0f} {grn['currency']}" if grn else "N/A",
            "Invoice Amount": f"{inv_amount:,.0f} {inv['currency']}",
            "Match Status": status,
            "Flag": flag or "",
        })
    return results


def render_three_way_matching_page():
    st.title("🔗 3-Way Matching")
    st.caption("Match Purchase Orders → Goods Receipt Notes → Vendor Invoices before approving payment. Flags unauthorized purchases, quantity discrepancies and price variances.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")

    st.info("**How it works:** Harrison raises a PO → goods received and GRN booked → vendor sends invoice → Finance matches all three before approving payment. All three must agree within 1% tolerance.")

    tab1, tab2, tab3 = st.tabs(["📋 Purchase Orders", "📦 Goods Receipts (GRN)", "🔗 Run 3-Way Match"])

    with tab1:
        st.subheader("Open Purchase Orders")
        use_sample_po = st.checkbox("Use sample PO data", value=True, key="po_sample")
        if use_sample_po:
            pos = SAMPLE_POS.copy()
        else:
            po_file = st.file_uploader("Upload POs", type=["xlsx","csv"], key="po_upload")
            pos = []
            if po_file:
                df = pd.read_excel(po_file) if po_file.name.endswith(("xlsx","xls")) else pd.read_csv(po_file)
                pos = df.to_dict("records")

        st.dataframe(pd.DataFrame(pos), use_container_width=True)

        st.subheader("Add New PO")
        c1, c2, c3, c4 = st.columns(4)
        new_po = c1.text_input("PO Number", key="new_po_no")
        new_vendor = c2.text_input("Vendor", key="new_po_vendor")
        new_desc = c3.text_input("Description", key="new_po_desc")
        new_amt = c4.number_input("Amount", min_value=0.0, step=1000.0, key="new_po_amt")
        if st.button("➕ Add PO", disabled=not new_po):
            pos.append({"po_number": new_po, "vendor": new_vendor, "description": new_desc,
                       "po_amount": new_amt, "currency": "KES", "raised_by": current_user,
                       "date": "today", "status": "Open"})
            st.success(f"PO {new_po} added")

    with tab2:
        st.subheader("Goods Receipt Notes (GRN)")
        use_sample_grn = st.checkbox("Use sample GRN data", value=True, key="grn_sample")
        if use_sample_grn:
            grns = SAMPLE_GRNS.copy()
        else:
            grn_file = st.file_uploader("Upload GRNs", type=["xlsx","csv"], key="grn_upload")
            grns = []
            if grn_file:
                df = pd.read_excel(grn_file) if grn_file.name.endswith(("xlsx","xls")) else pd.read_csv(grn_file)
                grns = df.to_dict("records")

        st.dataframe(pd.DataFrame(grns), use_container_width=True)

    with tab3:
        st.subheader("Run 3-Way Match")
        use_sample_inv = st.checkbox("Use sample invoice data", value=True, key="inv_sample")
        if use_sample_inv:
            invoices = SAMPLE_INVOICES.copy()
        else:
            inv_file = st.file_uploader("Upload invoices for matching", type=["xlsx","csv"], key="inv_upload")
            invoices = []
            if inv_file:
                df = pd.read_excel(inv_file) if inv_file.name.endswith(("xlsx","xls")) else pd.read_csv(inv_file)
                invoices = df.to_dict("records")

        use_sample_pos2 = st.session_state.get("po_sample", True)
        use_sample_grns2 = st.session_state.get("grn_sample", True)
        pos2 = SAMPLE_POS if use_sample_pos2 else []
        grns2 = SAMPLE_GRNS if use_sample_grns2 else []

        if st.button("🔗 Run 3-Way Match", type="primary", use_container_width=True):
            results = run_three_way_match(pos2, grns2, invoices)
            st.session_state["match_results"] = results
            log_action(current_user, "3-WAY MATCH RUN", "Batch",
                      f"3-way match run on {len(invoices)} invoices")

        if st.session_state.get("match_results"):
            results = st.session_state["match_results"]
            approved = [r for r in results if "✅" in r["Match Status"]]
            flagged = [r for r in results if "✅" not in r["Match Status"]]

            col1, col2, col3 = st.columns(3)
            col1.metric("Total Invoices", len(results))
            col2.metric("✅ Approved for Payment", len(approved))
            col3.metric("🔴 Flagged — Review Required", len(flagged))

            st.divider()
            st.subheader("Match Results")
            for r in results:
                if "✅" in r["Match Status"]:
                    st.success(f"**{r['Invoice No.']}** — {r['Vendor']} | {r['Match Status']}")
                elif "🟡" in r["Match Status"]:
                    st.warning(f"**{r['Invoice No.']}** — {r['Vendor']} | {r['Match Status']} | {r['Flag']}")
                else:
                    st.error(f"**{r['Invoice No.']}** — {r['Vendor']} | {r['Match Status']} | {r['Flag']}")

            st.divider()
            st.dataframe(pd.DataFrame(results), use_container_width=True)
            st.download_button("⬇️ Export Match Results",
                              pd.DataFrame(results).to_csv(index=False).encode(),
                              "3Way_Match_Results.csv", "text/csv")
