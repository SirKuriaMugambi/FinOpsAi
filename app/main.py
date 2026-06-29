"""
FinOps AI — Chrysal International Africa Finance Operating System
Comprehensive finance automation platform covering the full monthly
finance cycle from daily invoice processing to CEO-level reporting.
"""

import streamlit as st
import sys, os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.currency import get_rates, format_currency
from utils.audit_trail import init_audit_trail, log_action, AuditAction
from data.tax_config import DEFAULT_VENDORS
from data.chart_of_accounts import COST_CENTRES

st.set_page_config(
    page_title="FinOps AI — Chrysal Finance OS",
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
if "current_user" not in st.session_state:
    st.session_state.current_user = "Finance Team"

init_audit_trail()

# ---------- Sidebar ----------
with st.sidebar:
    st.title("⚙️ FinOps AI")
    st.caption("Chrysal International Africa\nFinance Operating System")
    st.divider()

    # User selector
    user = st.selectbox("Logged in as:", [
        "Finance Team", "Mercy (Senior Accountant)",
        "Tony (Finance Manager)", "Harrison (Production)",
        "Charles (Business Controller)", "Niels (MD)"
    ])
    st.session_state.current_user = user
    st.divider()

    module = st.radio("Navigate", [
        "🏠 Dashboard",
        "📄 Invoice Processor",
        "🔗 3-Way Matching",
        "🔄 AP Reconciliation",
        "🏦 Bank Reconciliation",
        "🧾 WHT Calculator",
        "💰 AR Receipting",
        "🌍 Intercompany",
        "👥 Payroll",
        "📊 Budget vs Actual",
        "📑 Financial Statements",
        "✅ Month-End Checklist",
        "💵 Cash Flow Forecaster",
        "🔍 Audit Trail",
        "⚙️ Vendor Master",
        "📋 Chart of Accounts",
    ])

    st.divider()
    rates_status = "🟢 Live" if st.session_state.rates_live else "🔵 Cached"
    st.caption(f"FX Rates: {rates_status}")
    st.caption(f"1 USD = KES {st.session_state.rates['USD']:,.2f}")
    st.caption(f"1 EUR = KES {st.session_state.rates['EUR']:,.2f}")
    if st.button("🔄 Refresh rates"):
        st.session_state.rates, st.session_state.rates_live = get_rates()
        st.rerun()

# ---------- Module Router ----------
if "Dashboard" in module:
    from app.modules.dashboard import render_dashboard
    render_dashboard()
elif "Invoice" in module:
    from app.modules.enhanced_invoice_page import render_enhanced_invoice_page
    render_enhanced_invoice_page()
elif "3-Way" in module:
    from app.modules.three_way_match_page import render_three_way_matching_page
    render_three_way_matching_page()
elif "AP Reconciliation" in module:
    from app.modules.recon_page import render_recon_page
    render_recon_page()
elif "Bank Reconciliation" in module:
    from app.modules.bank_recon_page import render_bank_recon_page
    render_bank_recon_page()
elif "WHT" in module:
    from app.modules.wht_page import render_wht_page
    render_wht_page()
elif "AR Receipting" in module:
    from app.modules.ar_page import render_ar_page
    render_ar_page()
elif "Intercompany" in module:
    from app.modules.intercompany_page import render_intercompany_page
    render_intercompany_page()
elif "Payroll" in module:
    from app.modules.payroll_page import render_payroll_page
    render_payroll_page()
elif "Budget" in module:
    from app.modules.budget_page import render_budget_page
    render_budget_page()
elif "Financial Statements" in module:
    from app.modules.financial_statements_page import render_financial_statements_page
    render_financial_statements_page()
elif "Month-End" in module:
    from app.modules.monthend_page import render_monthend_page
    render_monthend_page()
elif "Cash Flow" in module:
    from app.modules.cashflow_page import render_cashflow_page
    render_cashflow_page()
elif "Audit" in module:
    from app.modules.audit_page import render_audit_page
    render_audit_page()
elif "Vendor Master" in module:
    from app.modules.vendor_page import render_vendor_page
    render_vendor_page()
elif "Chart of Accounts" in module:
    from app.modules.coa_page import render_coa_page
    render_coa_page()
