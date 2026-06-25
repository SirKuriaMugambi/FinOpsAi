"""Invoice Processor Page — AP invoice upload, tax treatment, posting summary."""
import streamlit as st
import pandas as pd
import tempfile, os
from utils.invoice_engine import (
    extract_invoice_from_pdf, extract_invoice_from_excel, process_invoice
)
from utils.currency import format_currency
from data.tax_config import VAT_TREATMENTS, WHT_TYPES, DEFAULT_VENDORS


def render_invoice_page():
    st.title("📄 Invoice Processor")
    st.caption("Upload or manually enter AP invoices. The app confirms tax treatment, flags mismatches, and generates a posting-ready summary for Microsoft Dynamics AX.")
    st.divider()

    vendors = st.session_state.get("vendors", DEFAULT_VENDORS)
    rates = st.session_state.rates
    vendor_names = [v["name"] for v in vendors]

    tab1, tab2 = st.tabs(["📁 Upload Invoice", "✍️ Manual Entry"])

    with tab1:
        uploaded = st.file_uploader("Upload invoice (PDF or Excel)", type=["pdf", "xlsx", "xls"])
        if uploaded:
            ext = uploaded.name.split(".")[-1].lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                tmp.write(uploaded.getbuffer())
                tmp_path = tmp.name
            with st.spinner("Extracting invoice data..."):
                if ext == "pdf":
                    extracted = extract_invoice_from_pdf(tmp_path)
                else:
                    extracted = extract_invoice_from_excel(tmp_path)
                os.unlink(tmp_path)

            st.success(f"Extracted {sum(1 for v in extracted.values() if v)} fields")
            col1, col2 = st.columns(2)
            with col1:
                inv_no = st.text_input("Invoice Number", value=extracted.get("invoice_number") or "")
                inv_date = st.text_input("Invoice Date", value=extracted.get("invoice_date") or "")
                currency = st.selectbox("Currency", ["KES", "USD", "EUR", "GBP"],
                                        index=["KES","USD","EUR","GBP"].index(extracted.get("currency","KES")))
            with col2:
                subtotal = st.number_input("Subtotal (before VAT)",
                                           value=float(extracted.get("subtotal") or 0), step=100.0)
                vat_shown = st.number_input("VAT on Invoice",
                                            value=float(extracted.get("vat_amount") or 0), step=100.0)
                total = st.number_input("Invoice Total",
                                        value=float(extracted.get("total") or 0), step=100.0)

            # CU Invoice Number — mandatory for KRA compliance
            cu_number = st.text_input(
                "CU Invoice Number (KRA ETR/TIMS serial number)",
                help="The KRA Control Unit number printed on the invoice — used as the primary reference when remitting WHT to KRA."
            )

            # KRA exchange rate — only shown for foreign currency invoices
            kra_rate = None
            if currency != "KES":
                st.info(f"💱 This is a **{currency}** invoice. For WHT compliance, enter KRA's official exchange rate for the invoice date (not today's market rate).")
                kra_rate = st.number_input(
                    f"KRA Official Rate for {inv_date or 'invoice date'} (KES per 1 {currency})",
                    min_value=0.0, step=0.01,
                    help="Look up KRA's official exchange rate for the invoice date at kra.go.ke. This rate must be used for WHT calculation on foreign currency invoices."
                )
                if kra_rate == 0:
                    st.warning("⚠️ Enter the KRA official rate above. If left at 0, the live market rate will be used — this may not match KRA's records.")
                    kra_rate = None

            extracted["cu_invoice_number"] = cu_number
            _process_with_vendor(vendors, vendor_names, rates, inv_no, inv_date,
                                  currency, subtotal, vat_shown, total, extracted,
                                  kra_rate=kra_rate)

    with tab2:
        st.caption("Enter invoice details manually")
        col1, col2 = st.columns(2)
        with col1:
            inv_no = st.text_input("Invoice Number", key="m_inv_no")
            inv_date = st.text_input("Invoice Date (DD/MM/YYYY)", key="m_date")
            currency = st.selectbox("Currency", ["KES", "USD", "EUR", "GBP"], key="m_curr")
        with col2:
            subtotal = st.number_input("Subtotal (before VAT)", step=100.0, key="m_sub")
            vat_shown = st.number_input("VAT shown on invoice", step=100.0, key="m_vat")
            total = st.number_input("Invoice Total", step=100.0, key="m_total")

        cu_number_m = st.text_input(
            "CU Invoice Number (KRA ETR/TIMS serial number)", key="m_cu",
            help="The KRA Control Unit number printed on the invoice."
        )

        kra_rate_m = None
        if currency != "KES":
            st.info(f"💱 This is a **{currency}** invoice. Enter KRA's official rate for the invoice date.")
            kra_rate_m = st.number_input(
                f"KRA Official Rate for {inv_date or 'invoice date'} (KES per 1 {currency})",
                min_value=0.0, step=0.01, key="m_kra_rate",
                help="KRA's official exchange rate for the invoice date — required for WHT compliance on foreign currency invoices."
            )
            if kra_rate_m == 0:
                kra_rate_m = None

        extracted_manual = {
            "invoice_number": inv_no, "invoice_date": inv_date,
            "subtotal": subtotal, "vat_amount": vat_shown,
            "total": total, "currency": currency,
            "cu_invoice_number": cu_number_m,
        }
        _process_with_vendor(vendors, vendor_names, rates, inv_no, inv_date,
                              currency, subtotal, vat_shown, total, extracted_manual,
                              kra_rate=kra_rate_m, key_prefix="manual_")

    # Show processed invoices
    if st.session_state.processed_invoices:
        st.divider()
        st.subheader(f"Processed Invoices This Session ({len(st.session_state.processed_invoices)})")
        rows = []
        for inv in st.session_state.processed_invoices:
            rows.append({
                "Vendor": inv["vendor_name"],
                "Invoice No": inv["invoice_number"],
                "Currency": inv["currency"],
                "Subtotal": format_currency(inv["subtotal"], inv["currency"]),
                "VAT": inv["vat_rate_pct"],
                "VAT Amount": format_currency(inv["vat_amount"], inv["currency"]),
                "WHT": inv["wht_rate_pct"],
                "Net Payable": format_currency(inv["net_payable"], inv["currency"]),
                "Net Payable (KES)": format_currency(inv["net_payable_kes"]),
                "Status": "✅ Ready" if inv["posting_ready"] else "⚠️ Review",
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True)

        if st.button("Clear processed invoices"):
            st.session_state.processed_invoices = []
            st.rerun()


def _process_with_vendor(vendors, vendor_names, rates, inv_no, inv_date,
                          currency, subtotal, vat_shown, total, extracted,
                          kra_rate=None, key_prefix=""):
    st.divider()
    col1, col2, col3 = st.columns(3)
    with col1:
        vendor_choice = st.selectbox("Select Vendor", vendor_names + ["+ New vendor (use Vendor Master)"],
                                     key=f"{key_prefix}vendor")
    with col2:
        is_service = st.checkbox("Is this a service invoice?", key=f"{key_prefix}svc",
                                 help="Affects WHT rate for 'Both' vendors (goods=2%, services=5%)")
    with col3:
        override_vat = st.selectbox("Override VAT treatment (optional)",
                                    ["-- Use vendor default --"] + list(VAT_TREATMENTS.keys()),
                                    key=f"{key_prefix}vat_override")

    if st.button("🔍 Process Invoice", key=f"{key_prefix}process",
                 disabled=(not subtotal and not total)):
        vendor = next((v for v in vendors if v["name"] == vendor_choice), None)
        if vendor is None:
            st.error("Please select a valid vendor from the list, or add them in Vendor Master first.")
            return

        if override_vat != "-- Use vendor default --":
            vendor = {**vendor, "vat_treatment": override_vat}

        extracted["subtotal"] = subtotal
        extracted["vat_amount"] = vat_shown
        extracted["total"] = total
        extracted["currency"] = currency
        extracted["invoice_number"] = inv_no
        extracted["invoice_date"] = inv_date

        result = process_invoice(extracted, vendor, rates,
                                  is_service=is_service,
                                  kra_rate_override=kra_rate)

        # Show flags
        if result["tax_flag"]:
            st.warning(result["tax_flag"])
        else:
            st.success("✅ Tax treatment confirmed — invoice is posting-ready")

        if result.get("kra_rate_warning"):
            st.warning(result["kra_rate_warning"])
        elif currency != "KES":
            st.success(f"✅ KRA rate applied: {result['kra_rate_source']}")

        # CU number confirmation
        cu = result.get("cu_invoice_number", "")
        if cu:
            st.info(f"📋 CU Invoice Number: **{cu}** — this will be used as the KRA reference in all WHT filings.")
        else:
            st.warning("⚠️ No CU invoice number entered. This is required for KRA WHT remittance. Add it before filing.")

        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Subtotal", format_currency(result["subtotal"], result["currency"]))
        col_a.metric("Subtotal (KES)", format_currency(result["subtotal_kes"]))
        col_b.metric(f"VAT ({result['vat_rate_pct']})", format_currency(result["vat_amount"], result["currency"]))
        col_b.metric("VAT (KES)", format_currency(result["vat_kes"]))
        col_c.metric(f"WHT ({result['wht_rate_pct']})", format_currency(result["wht_amount"], result["currency"]))
        col_c.metric("Net Payable (KES)", format_currency(result["net_payable_kes"]))

        if currency != "KES":
            st.caption(f"KES conversions: WHT uses **{result['kra_rate_source']}** | Display uses live/cached market rate")

        st.info(f"**AX Tax Code:** {result['ax_tax_code']} | **WHT Type:** {result['wht_type']}")

        if st.button("✅ Add to session", key=f"{key_prefix}add"):
            st.session_state.processed_invoices.append(result)
            st.session_state.wht_payments.append({
                "vendor_name": result["vendor_name"],
                "vendor_id": result["vendor_id"],
                "vendor_pin": "",
                "cu_invoice_number": result.get("cu_invoice_number", ""),
                "wht_type": result["wht_type"],
                "amount": result["net_payable"],
                "currency": result["currency"],
                "is_service": is_service,
                "payment_ref": result["invoice_number"],
                "invoice_date": result["invoice_date"],
                "payment_date": result["invoice_date"],
                "kra_rate_used": result.get("kra_rate_used", ""),
            })
            st.success("Added to session!")
