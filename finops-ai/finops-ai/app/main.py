"""
FinOps AI — Finance Operations Automation Platform
Built for private company finance teams to automate AP/AR workflows,
tax calculations, reconciliation, and management reporting.
"""

import streamlit as st
import sys, os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.currency import get_rates, format_currency
from data.tax_config import DEFAULT_VENDORS, VAT_TREATMENTS, WHT_TYPES

st.set_page_config(
    page_title="FinOps AI",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ---------- Session State ----------
if "vendors" not in st.session_state:
    st.session_state.vendors = DEFAULT_VENDORS.copy()
if "rates" not in st.session_state:
    st.session_state.rates, st.session_state.rates_live = get_rates()
if "processed_invoices" not in st.session_state:
    st.session_state.processed_invoices = []
if "wht_payments" not in st.session_state:
    st.session_state.wht_payments = []
if "recon_result" not in st.session_state:
    st.session_state.recon_result = None
if "ar_result" not in st.session_state:
    st.session_state.ar_result = None

# ---------- Sidebar ----------
with st.sidebar:
    st.image("https://img.icons8.com/color/96/accounting.png", width=60)
    st.title("FinOps AI")
    st.caption("Finance Operations Automation")
    st.divider()

    module = st.radio("Navigate", [
        "🏠 Dashboard",
        "📄 Invoice Processor",
        "🔄 AP Reconciliation",
        "🧾 WHT Calculator",
        "💰 AR Receipting",
        "⚙️ Vendor Master",
    ])

    st.divider()
    rates_status = "🟢 Live rates" if st.session_state.rates_live else "🔵 Cached rates"
    st.caption(f"Exchange rates: {rates_status}")
    st.caption(f"1 USD = KES {st.session_state.rates['USD']:,.2f}")
    st.caption(f"1 EUR = KES {st.session_state.rates['EUR']:,.2f}")
    if st.button("🔄 Refresh rates"):
        st.session_state.rates, st.session_state.rates_live = get_rates()
        st.rerun()

# ---------- Module Router ----------
if "Dashboard" in module:
    from app.pages.dashboard import render_dashboard
    render_dashboard()
elif "Invoice" in module:
    from app.pages.invoice_page import render_invoice_page
    render_invoice_page()
elif "AP Reconciliation" in module:
    from app.pages.recon_page import render_recon_page
    render_recon_page()
elif "WHT" in module:
    from app.pages.wht_page import render_wht_page
    render_wht_page()
elif "AR Receipting" in module:
    from app.pages.ar_page import render_ar_page
    render_ar_page()
elif "Vendor Master" in module:
    from app.pages.vendor_page import render_vendor_page
    render_vendor_page()
