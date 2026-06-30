"""WHT & WVAT Calculator Page — KRA Withholding Tax + Withholding VAT calculation and filing prep.
Chrysal is an appointed KRA Withholding VAT (WVAT) Agent, so both WHT and WVAT are calculated
together on every applicable payment."""
import streamlit as st
import pandas as pd
from datetime import datetime
import pytz
from utils.wht_calculator import calculate_wht_for_payments, generate_kra_csv, generate_wvat_csv, generate_wht_excel
from utils.currency import format_currency
from data.tax_config import WHT_TYPES, DEFAULT_VENDORS

KENYA_TZ = pytz.timezone("Africa/Nairobi")


def render_wht_page():
    st.title("🧾 WHT & WVAT Calculator — KRA Filing Prep")
    st.caption("Chrysal is an appointed KRA Withholding VAT (WVAT) Agent. Both Withholding Income Tax (2%/5%) and Withholding VAT (2% of gross) are calculated and filed separately — by the 20th of every month.")
    nairobi_now = datetime.now(KENYA_TZ).strftime("%A, %d %B %Y — %H:%M:%S %Z")
    st.caption(f"🕒 Current time (Africa/Nairobi): **{nairobi_now}**")
    st.divider()

    rates = st.session_state.rates
    vendors = st.session_state.get("vendors", DEFAULT_VENDORS)

    # Pre-populated from invoice processor
    wht_payments = st.session_state.get("wht_payments", [])

    tab1, tab2 = st.tabs(["➕ Add Payment", "📊 Calculate & Export"])

    with tab1:
        st.caption("Add vendor payments approved for remittance this month")
        col1, col2, col3 = st.columns(3)

        vendor_names = [v["name"] for v in vendors]
        with col1:
            vendor_choice = st.selectbox("Vendor", vendor_names, key="wht_vendor")
            vendor = next((v for v in vendors if v["name"] == vendor_choice), vendors[0])
            st.info(f"Default WHT type: **{vendor['wht_type']}**")
            cu_invoice_number = st.text_input("CU Invoice Number (KRA)", key="wht_cu_number",
                                              help="KRA ETR/TIMS serial number — mandatory for both WHT and WVAT filing")
        with col2:
            amount = st.number_input("Base Amount (before VAT)", min_value=0.0, step=1000.0, key="wht_amount",
                                     help="WHT is calculated on this base figure")
            vat_amount = st.number_input("VAT on Invoice (16%)", min_value=0.0, step=100.0, key="wht_vat_amount",
                                         help="WVAT (2%) is calculated on Base + VAT combined")
            currency = st.selectbox("Currency", ["KES","USD","EUR","GBP"], key="wht_curr")
        with col3:
            wht_override = st.selectbox("WHT Type", list(WHT_TYPES.keys()),
                                        index=list(WHT_TYPES.keys()).index(vendor["wht_type"])
                                        if vendor["wht_type"] in WHT_TYPES else 0,
                                        key="wht_type_sel")
            vendor_pin = st.text_input("Vendor KRA PIN (optional)", key="wht_pin")
            payment_ref = st.text_input("Payment Reference", key="wht_ref")
            payment_date = st.text_input("Payment Date (DD/MM/YYYY)", key="wht_date",
                                         value=datetime.now(KENYA_TZ).strftime("%d/%m/%Y"))

        if st.button("➕ Add Payment", disabled=amount == 0):
            st.session_state.wht_payments.append({
                "vendor_name": vendor_choice,
                "vendor_id": vendor.get("vendor_id",""),
                "vendor_pin": vendor_pin,
                "cu_invoice_number": cu_invoice_number,
                "wht_type": wht_override,
                "amount": amount,
                "vat_amount": vat_amount,
                "currency": currency,
                "payment_ref": payment_ref,
                "payment_date": payment_date,
                "invoice_date": payment_date,
            })
            st.success(f"Added {vendor_choice} — {format_currency(amount, currency)}")
            st.rerun()

        if wht_payments:
            st.divider()
            st.caption(f"{len(wht_payments)} payment(s) in session (including any from Invoice Processor)")
            rows = [{"Vendor": p["vendor_name"], "Amount": format_currency(p["amount"], p["currency"]),
                     "CU No.": p.get("cu_invoice_number", ""),
                     "WHT Type": p["wht_type"], "Ref": p["payment_ref"]} for p in wht_payments]
            st.dataframe(pd.DataFrame(rows), use_container_width=True)
            if st.button("🗑️ Clear all payments"):
                st.session_state.wht_payments = []
                st.rerun()

    with tab2:
        if not wht_payments:
            st.info("Add payments in the 'Add Payment' tab first (or process invoices in the Invoice Processor).")
            return

        result = calculate_wht_for_payments(wht_payments, rates)

        if result["deadline_flag"]:
            st.error(result["deadline_flag"]) if "URGENT" in result["deadline_flag"] else st.warning(result["deadline_flag"])
        else:
            st.success(f"✅ Next KRA filing deadline: **{result['deadline']}** ({result['days_to_deadline']} days away)")

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total Withheld (KES)", format_currency(result["total_withheld_kes"]))
        col2.metric("2% WHT — General Goods (KES)", format_currency(result["total_wht_2pct_kes"]))
        col3.metric("5% WHT — Professional (KES)", format_currency(result["total_wht_5pct_kes"]))
        col4.metric("2% WVAT — All Payments (KES)", format_currency(result["total_wvat_kes"]))

        st.divider()

        if result["2pct_entries"]:
            st.subheader("2% WHT — General Goods/Contractual (CSV Upload to KRA)")
            st.dataframe(pd.DataFrame(result["2pct_entries"]), use_container_width=True)
            csv_bytes = generate_kra_csv(result["2pct_entries"])
            st.download_button("⬇️ Download KRA CSV (2% WHT)", csv_bytes,
                               file_name="KRA_WHT_2pct.csv", mime="text/csv")

        if result["5pct_entries"]:
            st.subheader("5% WHT — Professional/Consultancy (Excel Import to KRA)")
            st.dataframe(pd.DataFrame(result["5pct_entries"]), use_container_width=True)

        all_entries = result["2pct_entries"] + result["5pct_entries"]
        if all_entries:
            st.subheader("2% WVAT — All Withheld Payments (Separate KRA Filing)")
            st.caption("Chrysal's WVAT Agent obligation applies to every payment above, calculated on the VAT-inclusive amount and filed separately from WHT.")
            st.dataframe(pd.DataFrame(all_entries)[["Vendor Name", "CU Invoice Number", "Gross Invoice (KES)", "WVAT Amount (KES)"]], use_container_width=True)
            wvat_csv = generate_wvat_csv(all_entries)
            st.download_button("⬇️ Download KRA WVAT CSV (2%)", wvat_csv,
                               file_name="KRA_WVAT_2pct.csv", mime="text/csv")

        excel_bytes = generate_wht_excel(result)
        st.download_button("⬇️ Download Full WHT + WVAT Excel Workbook", excel_bytes,
                           file_name="KRA_WHT_WVAT_Filing.xlsx",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
