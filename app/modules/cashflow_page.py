"""
Cash Flow Forecaster
Projects 30/60/90 day cash position from AP/AR data.
Multi-currency aware. CEO and Finance Manager level visibility.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime, timedelta
from utils.currency import format_currency, convert_to_kes, now_nairobi


SAMPLE_AR = [
    {"customer": "Rose Farm BV", "invoice_no": "INV-2026-041", "amount": 58000, "currency": "EUR", "due_date": (now_nairobi() + timedelta(days=7)).strftime("%d/%m/%Y"), "probability": 0.95},
    {"customer": "Florimex GmbH", "invoice_no": "INV-2026-042", "amount": 34800, "currency": "EUR", "due_date": (now_nairobi() + timedelta(days=15)).strftime("%d/%m/%Y"), "probability": 0.90},
    {"customer": "Naivas Ltd", "invoice_no": "INV-2026-043", "amount": 245000, "currency": "KES", "due_date": (now_nairobi() + timedelta(days=30)).strftime("%d/%m/%Y"), "probability": 0.85},
    {"customer": "Rose Farm BV", "invoice_no": "INV-2026-044", "amount": 62000, "currency": "EUR", "due_date": (now_nairobi() + timedelta(days=45)).strftime("%d/%m/%Y"), "probability": 0.80},
]

SAMPLE_AP = [
    {"vendor": "Bayer East Africa", "invoice_no": "BAY-055", "amount": 450000, "currency": "KES", "due_date": (now_nairobi() + timedelta(days=5)).strftime("%d/%m/%Y")},
    {"vendor": "DHL Express", "invoice_no": "DHL-221", "amount": 85000, "currency": "KES", "due_date": (now_nairobi() + timedelta(days=10)).strftime("%d/%m/%Y")},
    {"vendor": "Chrysal BV", "invoice_no": "IC-2026-06", "amount": 28000, "currency": "EUR", "due_date": (now_nairobi() + timedelta(days=20)).strftime("%d/%m/%Y")},
    {"vendor": "Kenya Power", "invoice_no": "KP-884", "amount": 62000, "currency": "KES", "due_date": (now_nairobi() + timedelta(days=25)).strftime("%d/%m/%Y")},
]


def render_cashflow_page():
    st.title("💵 Cash Flow Forecaster")
    st.caption("30/60/90 day cash position projection from AP/AR data. Multi-currency. CEO and Finance Manager level visibility.")
    st.divider()

    rates = st.session_state.rates
    opening_balance = st.number_input("Opening Cash Balance (KES)", value=2500000.0, step=100000.0,
                                       help="Current cash balance across all bank accounts in KES equivalent")
    wht_due = st.number_input("WHT Due to KRA this month (KES)", value=25000.0, step=1000.0)

    st.divider()

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Expected Receipts (AR)")
        use_sample_ar = st.checkbox("Use sample AR data", value=True)
        ar_data = SAMPLE_AR if use_sample_ar else []
        if not use_sample_ar:
            ar_file = st.file_uploader("Upload expected receipts", type=["xlsx","csv"])
            if ar_file:
                df = pd.read_excel(ar_file) if ar_file.name.endswith(("xlsx","xls")) else pd.read_csv(ar_file)
                ar_data = df.to_dict("records")
        if ar_data:
            st.dataframe(pd.DataFrame(ar_data), use_container_width=True)

    with col2:
        st.subheader("Expected Payments (AP)")
        use_sample_ap = st.checkbox("Use sample AP data", value=True)
        ap_data = SAMPLE_AP if use_sample_ap else []
        if not use_sample_ap:
            ap_file = st.file_uploader("Upload expected payments", type=["xlsx","csv"])
            if ap_file:
                df = pd.read_excel(ap_file) if ap_file.name.endswith(("xlsx","xls")) else pd.read_csv(ap_file)
                ap_data = df.to_dict("records")
        if ap_data:
            st.dataframe(pd.DataFrame(ap_data), use_container_width=True)

    st.divider()
    if st.button("🔮 Generate Cash Flow Forecast", type="primary", use_container_width=True):
        today = now_nairobi()
        periods = [
            ("30 Days", today + timedelta(days=30)),
            ("60 Days", today + timedelta(days=60)),
            ("90 Days", today + timedelta(days=90)),
        ]

        def parse_date(d):
            try:
                return datetime.strptime(d, "%d/%m/%Y")
            except:
                return today + timedelta(days=30)

        results = []
        cumulative = opening_balance

        for label, end_date in periods:
            # Receipts within period
            receipts = sum(
                convert_to_kes(r["amount"], r["currency"], rates) * r.get("probability", 1.0)
                for r in ar_data
                if parse_date(r["due_date"]) <= end_date
            )
            # Payments within period
            payments = sum(
                convert_to_kes(p["amount"], p["currency"], rates)
                for p in ap_data
                if parse_date(p["due_date"]) <= end_date
            )
            # Add WHT obligation
            payments += wht_due if label == "30 Days" else 0

            net = receipts - payments
            cumulative = opening_balance + net
            results.append({
                "Period": label,
                "Expected Receipts (KES)": receipts,
                "Expected Payments (KES)": payments,
                "Net Cash Flow (KES)": net,
                "Closing Balance (KES)": cumulative,
                "Position": "✅ Positive" if cumulative > 0 else "🔴 Negative"
            })

        # Metrics — compact formatting to avoid truncation
        def compact(amount):
            if abs(amount) >= 1_000_000:
                return f"KES {amount/1_000_000:,.2f}M"
            elif abs(amount) >= 1_000:
                return f"KES {amount/1_000:,.1f}K"
            return f"KES {amount:,.0f}"

        col_a, col_b, col_c, col_d = st.columns(4)
        col_a.metric("Opening Balance", compact(opening_balance))
        col_b.metric("30-Day Position", compact(results[0]["Closing Balance (KES)"]))
        col_c.metric("60-Day Position", compact(results[1]["Closing Balance (KES)"]))
        col_d.metric("90-Day Position", compact(results[2]["Closing Balance (KES)"]))

        # Chart
        fig = go.Figure()
        fig.add_trace(go.Bar(name="Expected Receipts", x=[r["Period"] for r in results],
                            y=[r["Expected Receipts (KES)"] for r in results], marker_color="#16a34a"))
        fig.add_trace(go.Bar(name="Expected Payments", x=[r["Period"] for r in results],
                            y=[r["Expected Payments (KES)"] for r in results], marker_color="#ef4444"))
        fig.add_trace(go.Scatter(name="Closing Balance", x=[r["Period"] for r in results],
                                y=[r["Closing Balance (KES)"] for r in results],
                                mode="lines+markers", line=dict(color="#2563eb", width=3)))
        fig.update_layout(title="Cash Flow Projection — Next 90 Days", barmode="group", height=400)
        st.plotly_chart(fig, use_container_width=True)

        st.dataframe(pd.DataFrame(results), use_container_width=True)

        # CEO summary
        final_balance = results[2]["Closing Balance (KES)"]
        st.subheader("📋 Executive Summary")
        if final_balance > 0:
            st.success(f"✅ Cash position remains positive over the next 90 days. Projected closing balance: KES {final_balance:,.0f}. No immediate liquidity concerns.")
        else:
            st.error(f"🔴 Cash position turns negative within 90 days. Projected deficit: KES {abs(final_balance):,.0f}. Recommend reviewing payment terms or accelerating collections.")
