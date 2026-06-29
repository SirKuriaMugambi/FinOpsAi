"""
Enhanced Invoice Processor
- PDF/Excel upload with full field extraction
- Auto-maps to Chrysal's Chart of Accounts (ledger/dept/CC)
- WHT calculation with KRA rate for foreign currency
- Split allocation for shared invoices
- Approval chain routing (Harrison/Antony/Charles/Tony)
- Debit Note / Credit Note handling
- Audit trail logging
"""

import streamlit as st
import pandas as pd
import tempfile, os
from datetime import datetime

from utils.invoice_engine import extract_invoice_from_pdf, extract_invoice_from_excel, process_invoice
from utils.currency import format_currency
from utils.audit_trail import log_action, AuditAction
from data.tax_config import VAT_TREATMENTS, WHT_TYPES, DEFAULT_VENDORS
from data.chart_of_accounts import (
    CHART_OF_ACCOUNTS, COST_CENTRES, DEPARTMENTS, APPROVAL_CHAIN,
    SPLIT_RULES, list_accounts_for_select, get_approver, get_split_rule
)


def render_enhanced_invoice_page():
    st.title("📄 Invoice Processor")
    st.caption("Upload AP invoices — auto-extract fields, map to Chrysal's Chart of Accounts, calculate WHT, and route for approval.")
    st.divider()

    vendors = st.session_state.get("vendors", DEFAULT_VENDORS)
    rates = st.session_state.rates
    vendor_names = [v["name"] for v in vendors]
    current_user = st.session_state.get("current_user", "Finance Team")

    doc_type = st.radio("Document Type", ["📄 Vendor Invoice", "📋 Debit Note", "📋 Credit Note"], horizontal=True)

    # Demo Invoice button — one click pre-fill for demos
    if st.button("🎯 Load Demo Invoice (Bayer East Africa)", help="Pre-fills a realistic Chrysal AP invoice for demo purposes"):
        st.session_state["demo_invoice"] = {
            "invoice_number": "BAY-2026-055",
            "invoice_date": "01/06/2026",
            "currency": "KES",
            "subtotal": 450000.0,
            "vat_amount": 72000.0,
            "total": 522000.0,
            "cu_invoice_number": "KRA-CU-20260601-055",
            "vendor": "Bayer East Africa Ltd",
            "invoice_type": "Production/Freight-in",
            "ledger": "5000 — Cost of Goods Sold",
        }
        st.rerun()

    demo = st.session_state.get("demo_invoice", {})
    st.divider()

    tab1, tab2 = st.tabs(["📁 Upload PDF/Excel", "✍️ Manual Entry"])

    with tab1:
        uploaded = st.file_uploader("Upload invoice, debit note or credit note (PDF or Excel)", type=["pdf", "xlsx", "xls"])
        if uploaded:
            ext = uploaded.name.split(".")[-1].lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                tmp.write(uploaded.getbuffer())
                tmp_path = tmp.name
            with st.spinner("Reading document..."):
                extracted = extract_invoice_from_pdf(tmp_path) if ext == "pdf" else extract_invoice_from_excel(tmp_path)
                os.unlink(tmp_path)
            log_action(current_user, AuditAction.INVOICE_UPLOADED, uploaded.name, f"Document uploaded: {doc_type}")
            st.success(f"✅ Extracted {sum(1 for v in extracted.values() if v)} fields from {uploaded.name}")
            _render_invoice_form(extracted, vendors, vendor_names, rates, current_user, doc_type, key="upload")

    with tab2:
        demo = st.session_state.get("demo_invoice", {})
        _render_invoice_form(demo, vendors, vendor_names, rates, current_user, doc_type, key="manual")

    # Processed invoices table
    if st.session_state.get("processed_invoices"):
        st.divider()
        st.subheader(f"📋 Processed Documents This Session ({len(st.session_state.processed_invoices)})")
        rows = []
        for inv in st.session_state.processed_invoices:
            rows.append({
                "Type": inv.get("doc_type", "Invoice"),
                "Vendor": inv["vendor_name"],
                "Ref": inv["invoice_number"],
                "CU No.": inv.get("cu_invoice_number", ""),
                "Ledger": inv.get("ledger_account", ""),
                "Dept": inv.get("department", ""),
                "CC": inv.get("cost_centre", ""),
                "Net Payable (KES)": format_currency(inv["net_payable_kes"]),
                "WHT": inv["wht_rate_pct"],
                "Approver": inv.get("approver", ""),
                "Status": "✅ Ready" if inv["posting_ready"] else "⚠️ Review",
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True)

        col1, col2 = st.columns(2)
        with col1:
            if st.button("📥 Export AX Posting Sheet"):
                df = pd.DataFrame(rows)
                st.download_button("⬇️ Download Excel", df.to_csv(index=False).encode(),
                                   "AX_Posting_Sheet.csv", "text/csv")
        with col2:
            if st.button("🗑️ Clear session"):
                st.session_state.processed_invoices = []
                st.rerun()


def _render_invoice_form(extracted, vendors, vendor_names, rates, current_user, doc_type, key=""):
    col1, col2, col3 = st.columns(3)
    with col1:
        inv_no = st.text_input("Document Number", value=extracted.get("invoice_number") or "", key=f"{key}_inv_no")
        inv_date = st.text_input("Date (DD/MM/YYYY)", value=extracted.get("invoice_date") or "", key=f"{key}_date")
        currency = st.selectbox("Currency", ["KES", "EUR", "USD", "GBP"],
                                index=["KES","EUR","USD","GBP"].index(extracted.get("currency","KES"))
                                if extracted.get("currency") in ["KES","EUR","USD","GBP"] else 0,
                                key=f"{key}_curr")
    with col2:
        subtotal = st.number_input("Net Amount (before VAT)", value=float(extracted.get("subtotal") or 0), step=100.0, key=f"{key}_sub")
        vat_shown = st.number_input("VAT on Document", value=float(extracted.get("vat_amount") or 0), step=100.0, key=f"{key}_vat")
        total = st.number_input("Gross Total", value=float(extracted.get("total") or 0), step=100.0, key=f"{key}_total")
    with col3:
        cu_number = st.text_input("CU Invoice Number (KRA)", key=f"{key}_cu",
                                  help="KRA ETR/TIMS serial number — mandatory for WHT filing")
        vendor_choice = st.selectbox("Vendor", vendor_names, key=f"{key}_vendor")
        is_service = st.checkbox("Service invoice?", key=f"{key}_svc")

    # KRA rate for foreign currency
    kra_rate = None
    if currency != "KES":
        st.info(f"💱 Foreign currency invoice ({currency}) — enter KRA's official rate for {inv_date or 'invoice date'}")
        kra_rate_input = st.number_input(f"KRA Official Rate (KES per 1 {currency})", min_value=0.0, step=0.01, key=f"{key}_kra")
        kra_rate = kra_rate_input if kra_rate_input > 0 else None

    st.divider()
    st.subheader("📊 Ledger Mapping (Chrysal Chart of Accounts)")

    # Auto-suggest ledger based on vendor type
    vendor_obj = next((v for v in vendors if v["name"] == vendor_names[0]), None)
    default_ledger_idx = 0
    default_dept_idx = 0
    default_cc_idx = 0

    # Smart defaults based on vendor type from demo data
    vendor_ledger_map = {
        "Supplier": ("5000", "OPS", "511"),
        "Consultant": ("6500", "TC", "206"),
        "Mixed": ("6000", "ADM", "121"),
    }

    col_a, col_b, col_c = st.columns(3)
    with col_a:
        account_options = list_accounts_for_select()
        # Pre-select based on vendor
        selected_vendor_obj = next((v for v in vendors if v["name"] == vendor_choice), None)
        v_type = selected_vendor_obj.get("type", "Supplier") if selected_vendor_obj else "Supplier"
        default_ledger, default_dept, default_cc = vendor_ledger_map.get(v_type, ("5000", "OPS", "511"))

        # Also check demo invoice override
        if demo.get("ledger"):
            default_ledger = demo["ledger"].split(" — ")[0]

        default_ledger_option = next((o for o in account_options if o.startswith(default_ledger)), account_options[0])
        default_ledger_idx = account_options.index(default_ledger_option) if default_ledger_option in account_options else 0
        selected_account = st.selectbox("Ledger Account", account_options, index=default_ledger_idx, key=f"{key}_ledger")
        ledger_code = selected_account.split(" — ")[0] if selected_account else ""
        account_data = CHART_OF_ACCOUNTS.get(ledger_code, {})
    with col_b:
        dept_options = [f"{k} — {v}" for k, v in DEPARTMENTS.items()]
        smart_dept = f"{default_dept} — {DEPARTMENTS.get(default_dept, '')}"
        dept_idx = dept_options.index(smart_dept) if smart_dept in dept_options else 0
        selected_dept = st.selectbox("Department", dept_options, index=dept_idx, key=f"{key}_dept")
        dept_code = selected_dept.split(" — ")[0]
    with col_c:
        cc_options = [f"{k} — {v}" for k, v in COST_CENTRES.items()]
        smart_cc = f"{default_cc} — {COST_CENTRES.get(default_cc, '')}"
        cc_idx = cc_options.index(smart_cc) if smart_cc in cc_options else 0
        selected_cc = st.selectbox("Cost Centre", cc_options, index=cc_idx, key=f"{key}_cc")
        cc_code = selected_cc.split(" — ")[0]

    # Split allocation
    use_split = st.checkbox("This invoice requires split allocation across multiple cost centres", key=f"{key}_split")
    split_data = []
    if use_split:
        split_type = st.selectbox("Split Rule", ["Custom"] + list(SPLIT_RULES.keys()), key=f"{key}_split_type")
        if split_type != "Custom":
            rules = get_split_rule(split_type)
            st.caption("Auto-applied split rule:")
            for r in rules:
                st.write(f"• {r['pct']*100:.0f}% → Ledger {r['ledger']}, Dept {r['dept']}, CC {r['cc']} ({r['description']})")
            split_data = rules
        else:
            st.caption("Enter custom split percentages (must total 100%):")
            n_splits = st.number_input("Number of splits", min_value=2, max_value=5, value=2, key=f"{key}_nsplits")
            total_pct = 0
            for i in range(int(n_splits)):
                scol1, scol2, scol3, scol4 = st.columns(4)
                pct = scol1.number_input(f"Split {i+1} %", min_value=0.0, max_value=100.0, key=f"{key}_spct_{i}") / 100
                s_acc = scol2.selectbox(f"Ledger {i+1}", account_options, key=f"{key}_sacc_{i}")
                s_dept = scol3.selectbox(f"Dept {i+1}", list(DEPARTMENTS.keys()), key=f"{key}_sdept_{i}")
                s_cc = scol4.selectbox(f"CC {i+1}", list(COST_CENTRES.keys()), key=f"{key}_scc_{i}")
                split_data.append({"ledger": s_acc.split(" — ")[0], "dept": s_dept, "cc": s_cc, "pct": pct})
                total_pct += pct
            if abs(total_pct - 1.0) > 0.01:
                st.error(f"⚠️ Split percentages total {total_pct*100:.1f}% — must equal 100%")

    # Approval routing
    st.divider()
    st.subheader("✅ Approval Routing")
    invoice_type = st.selectbox("Invoice Category", list(APPROVAL_CHAIN.keys()), key=f"{key}_inv_type")
    approver_info = get_approver(invoice_type)
    st.info(f"**Approver:** {approver_info['approver']} ({approver_info['role']}) — {approver_info['description']}")

    if st.button("🔍 Process Document", key=f"{key}_process", disabled=(not subtotal and not total)):
        vendor = next((v for v in vendors if v["name"] == vendor_choice), vendors[0])
        extracted_data = {
            "invoice_number": inv_no, "invoice_date": inv_date,
            "subtotal": subtotal, "vat_amount": vat_shown,
            "total": total, "currency": currency,
            "cu_invoice_number": cu_number,
        }
        result = process_invoice(extracted_data, vendor, rates, is_service=is_service, kra_rate_override=kra_rate)

        # Add COA and approval data
        result["doc_type"] = doc_type
        result["ledger_account"] = ledger_code
        result["department"] = dept_code
        result["cost_centre"] = cc_code
        result["approver"] = approver_info["approver"]
        result["invoice_type"] = invoice_type
        result["split_allocation"] = split_data

        # Show result
        if result["tax_flag"]:
            st.warning(result["tax_flag"])
        else:
            st.success("✅ Document processed — posting ready")

        if result.get("kra_rate_warning"):
            st.warning(result["kra_rate_warning"])

        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Net Amount", format_currency(subtotal, currency))
        col_b.metric(f"VAT ({result['vat_rate_pct']})", format_currency(result["vat_amount"], currency))
        col_c.metric(f"WHT ({result['wht_rate_pct']})", format_currency(result["wht_amount"], currency))

        col_d, col_e, col_f = st.columns(3)
        col_d.metric("Net Payable (KES)", format_currency(result["net_payable_kes"]))
        col_e.metric("Ledger → Dept → CC", f"{ledger_code} → {dept_code} → {cc_code}")
        col_f.metric("Routes to", f"{approver_info['approver']} for approval")

        if split_data:
            st.caption("Split allocation:")
            for s in split_data:
                st.write(f"• {s['pct']*100:.0f}% → {s['ledger']} / {s['dept']} / CC {s['cc']}")

        # AX Posting summary
        with st.expander("📋 AX Posting Summary"):
            st.code(f"""
Document Type  : {doc_type}
Document No.   : {inv_no}
CU Invoice No. : {cu_number}
Date           : {inv_date}
Vendor         : {vendor_choice}
Currency       : {currency}
Net Amount     : {subtotal:,.2f} {currency}
VAT ({result['vat_rate_pct']})    : {result['vat_amount']:,.2f} {currency}
WHT ({result['wht_rate_pct']})    : {result['wht_amount']:,.2f} {currency}
Net Payable    : {result['net_payable_kes']:,.2f} KES
Ledger Account : {ledger_code} — {CHART_OF_ACCOUNTS.get(ledger_code,{}).get('name','')}
Department     : {dept_code}
Cost Centre    : {cc_code} — {COST_CENTRES.get(cc_code,'')}
AX Tax Code    : {result['ax_tax_code']}
Approver       : {approver_info['approver']} ({approver_info['role']})
            """)

        log_action(current_user, AuditAction.INVOICE_PROCESSED, inv_no,
                   f"{doc_type} processed — {vendor_choice} — {ledger_code}/{dept_code}/CC{cc_code}",
                   amount=result["net_payable_kes"], currency="KES")

        if st.button("✅ Add to session & queue for approval", key=f"{key}_add"):
            if "processed_invoices" not in st.session_state:
                st.session_state.processed_invoices = []
            st.session_state.processed_invoices.append(result)
            if "wht_payments" not in st.session_state:
                st.session_state.wht_payments = []
            st.session_state.wht_payments.append({
                "vendor_name": result["vendor_name"],
                "vendor_id": result["vendor_id"],
                "vendor_pin": "",
                "cu_invoice_number": cu_number,
                "wht_type": result["wht_type"],
                "amount": subtotal,
                "currency": currency,
                "is_service": is_service,
                "payment_ref": inv_no,
                "invoice_date": inv_date,
                "payment_date": inv_date,
                "kra_rate_used": result.get("kra_rate_used", ""),
            })
            log_action(current_user, AuditAction.INVOICE_APPROVED,
                       inv_no, f"Queued for {approver_info['approver']} approval")
            st.success(f"Added! Routed to {approver_info['approver']} for approval.")
