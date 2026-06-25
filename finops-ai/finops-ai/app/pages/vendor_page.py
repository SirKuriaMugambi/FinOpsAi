"""Vendor Master Page — manage vendor tax profiles."""
import streamlit as st
import pandas as pd
from data.tax_config import VAT_TREATMENTS, WHT_TYPES, DEFAULT_VENDORS, SUPPORTED_CURRENCIES


def render_vendor_page():
    st.title("⚙️ Vendor Master")
    st.caption("Manage vendor profiles — name, type, VAT treatment, and WHT rate. This data drives all tax calculations in the Invoice Processor and WHT Calculator.")
    st.divider()

    vendors = st.session_state.get("vendors", DEFAULT_VENDORS.copy())

    # Display current vendors
    st.subheader(f"Current Vendors ({len(vendors)})")
    df = pd.DataFrame(vendors)
    display_cols = ["vendor_id","name","type","vat_treatment","wht_type","currency"]
    st.dataframe(df[display_cols], use_container_width=True)

    st.divider()
    st.subheader("Add New Vendor")

    col1, col2, col3 = st.columns(3)
    with col1:
        new_name = st.text_input("Vendor Name")
        new_type = st.selectbox("Vendor Type", ["Supplier", "Consultant", "Mixed"])
    with col2:
        new_vat = st.selectbox("VAT Treatment", list(VAT_TREATMENTS.keys()))
        new_wht = st.selectbox("WHT Type", list(WHT_TYPES.keys()))
    with col3:
        new_currency = st.selectbox("Default Currency", SUPPORTED_CURRENCIES)
        new_notes = st.text_input("Notes (optional)")

    if st.button("➕ Add Vendor", disabled=not new_name):
        new_id = f"V{len(vendors)+1:03d}"
        vendors.append({
            "vendor_id": new_id,
            "name": new_name,
            "type": new_type,
            "vat_treatment": new_vat,
            "wht_type": new_wht,
            "currency": new_currency,
            "notes": new_notes,
        })
        st.session_state.vendors = vendors
        st.success(f"Added {new_name} ({new_id})")
        st.rerun()

    if st.button("🔄 Reset to Default Vendors"):
        st.session_state.vendors = DEFAULT_VENDORS.copy()
        st.success("Reset to default vendor list")
        st.rerun()
