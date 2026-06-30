"""
Budget vs Actual Tracker
Upload budget by ledger/department/cost centre (Chrysal's structure).
Enter or upload actuals. App calculates variances, flags overspends,
and generates a one-page management report for Charles/Niels.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import io
from utils.currency import format_currency, now_nairobi
from utils.audit_trail import log_action, AuditAction
from data.chart_of_accounts import CHART_OF_ACCOUNTS, COST_CENTRES, DEPARTMENTS


SAMPLE_BUDGET = pd.DataFrame([
    {"Ledger": "5000", "Account": "Cost of Goods Sold", "Department": "OPS", "CC": "511", "Budget (KES)": 2500000},
    {"Ledger": "5300", "Account": "Freight Inward", "Department": "OPS", "CC": "511", "Budget (KES)": 450000},
    {"Ledger": "5400", "Account": "Production Consumables", "Department": "OPS", "CC": "511", "Budget (KES)": 380000},
    {"Ledger": "6000", "Account": "Staff Salaries", "Department": "ADM", "CC": "121", "Budget (KES)": 1200000},
    {"Ledger": "6100", "Account": "Rent & Occupancy", "Department": "ADM", "CC": "121", "Budget (KES)": 320000},
    {"Ledger": "6200", "Account": "Utilities", "Department": "ADM", "CC": "121", "Budget (KES)": 95000},
    {"Ledger": "6300", "Account": "Telecoms & Internet", "Department": "ADM", "CC": "121", "Budget (KES)": 45000},
    {"Ledger": "6500", "Account": "Technical Consultancy Fees", "Department": "TC", "CC": "206", "Budget (KES)": 280000},
    {"Ledger": "6700", "Account": "Travel & Entertainment", "Department": "ADM", "CC": "121", "Budget (KES)": 75000},
    {"Ledger": "7000", "Account": "Bank Charges & Forex", "Department": "FIN", "CC": "121", "Budget (KES)": 55000},
])

SAMPLE_ACTUALS = pd.DataFrame([
    {"Ledger": "5000", "Actual (KES)": 2680000},
    {"Ledger": "5300", "Actual (KES)": 512000},
    {"Ledger": "5400", "Actual (KES)": 395000},
    {"Ledger": "6000", "Actual (KES)": 1200000},
    {"Ledger": "6100", "Actual (KES)": 320000},
    {"Ledger": "6200", "Actual (KES)": 118000},
    {"Ledger": "6300", "Actual (KES)": 42000},
    {"Ledger": "6500", "Actual (KES)": 340000},
    {"Ledger": "6700", "Actual (KES)": 98000},
    {"Ledger": "7000", "Actual (KES)": 61000},
])


def render_budget_page():
    st.title("📊 Budget vs Actual Tracker")
    st.caption("Upload your budget and actuals by ledger, department and cost centre — matching Chrysal's Chart of Accounts structure. Auto-generates management variance report.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")
    period = st.selectbox("Reporting Period", [
        "January 2026", "February 2026", "March 2026", "April 2026",
        "May 2026", "June 2026", "July 2026", "August 2026",
        "September 2026", "October 2026", "November 2026", "December 2026"
    ], index=5)

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Budget")
        use_sample_budget = st.checkbox("Use sample budget data", value=True)
        if use_sample_budget:
            budget_df = SAMPLE_BUDGET.copy()
            st.dataframe(budget_df, use_container_width=True)
        else:
            budget_file = st.file_uploader("Upload budget (Excel/CSV)", type=["xlsx","xls","csv"], key="budget_upload")
            if budget_file:
                budget_df = pd.read_excel(budget_file) if budget_file.name.endswith(("xlsx","xls")) else pd.read_csv(budget_file)
                st.dataframe(budget_df, use_container_width=True)
            else:
                budget_df = None
                st.info("Upload Excel/CSV with columns: Ledger, Account, Department, CC, Budget (KES)")

    with col2:
        st.subheader("Actuals")
        use_sample_actuals = st.checkbox("Use sample actuals data", value=True)
        if use_sample_actuals:
            actuals_df = SAMPLE_ACTUALS.copy()
            st.dataframe(actuals_df, use_container_width=True)
        else:
            actuals_file = st.file_uploader("Upload actuals (Excel/CSV)", type=["xlsx","xls","csv"], key="actuals_upload")
            if actuals_file:
                actuals_df = pd.read_excel(actuals_file) if actuals_file.name.endswith(("xlsx","xls")) else pd.read_csv(actuals_file)
                st.dataframe(actuals_df, use_container_width=True)
            else:
                actuals_df = None
                st.info("Upload Excel/CSV with columns: Ledger, Actual (KES)")

    st.divider()
    if st.button("📊 Generate Variance Report", type="primary", use_container_width=True):
        if budget_df is not None and actuals_df is not None:
            merged = budget_df.merge(actuals_df, on="Ledger", how="left")
            merged["Actual (KES)"] = merged["Actual (KES)"].fillna(0)
            merged["Variance (KES)"] = merged["Budget (KES)"] - merged["Actual (KES)"]
            merged["Variance %"] = ((merged["Actual (KES)"] - merged["Budget (KES)"]) / merged["Budget (KES)"] * 100).round(1)
            merged["Status"] = merged.apply(
                lambda r: "🔴 Overspend" if r["Actual (KES)"] > r["Budget (KES)"] * 1.05
                else ("🟡 Near Limit" if r["Actual (KES)"] > r["Budget (KES)"] * 0.90
                else "🟢 On Track"), axis=1
            )

            st.session_state.budget_result = {"merged": merged, "period": period}
            log_action(current_user, AuditAction.BUDGET_UPLOADED, period, "Budget vs Actual report generated")

            # Summary metrics
            total_budget = merged["Budget (KES)"].sum()
            total_actual = merged["Actual (KES)"].sum()
            total_variance = total_budget - total_actual
            overspend_count = len(merged[merged["Status"] == "🔴 Overspend"])

            col_a, col_b, col_c, col_d = st.columns(4)
            col_a.metric("Total Budget", format_currency(total_budget))
            col_b.metric("Total Actual", format_currency(total_actual))
            col_c.metric("Net Variance", format_currency(abs(total_variance)),
                        delta=f"{'Under' if total_variance > 0 else 'Over'} budget")
            col_d.metric("🔴 Overspend Lines", overspend_count)

            st.divider()

            # Variance table with color
            st.subheader(f"Variance Analysis — {period}")
            display = merged[["Ledger","Account","Department","CC","Budget (KES)","Actual (KES)","Variance (KES)","Variance %","Status"]].copy()
            st.dataframe(display.style.apply(
                lambda row: ["background-color: #fee2e2" if row["Status"] == "🔴 Overspend"
                            else ("background-color: #fef9c3" if row["Status"] == "🟡 Near Limit"
                            else "background-color: #dcfce7") for _ in row], axis=1
            ), use_container_width=True)

            # Chart
            fig = go.Figure()
            fig.add_trace(go.Bar(name="Budget", x=merged["Account"], y=merged["Budget (KES)"], marker_color="#2563eb"))
            fig.add_trace(go.Bar(name="Actual", x=merged["Account"], y=merged["Actual (KES)"], marker_color="#ef4444"))
            fig.update_layout(title=f"Budget vs Actual — {period}", barmode="group", height=400,
                            xaxis_tickangle=-45)
            st.plotly_chart(fig, use_container_width=True)

            # Department summary
            st.subheader("By Department")
            dept_summary = merged.groupby("Department").agg(
                Budget=("Budget (KES)", "sum"),
                Actual=("Actual (KES)", "sum")
            ).reset_index()
            dept_summary["Variance"] = dept_summary["Budget"] - dept_summary["Actual"]
            dept_summary["Variance %"] = ((dept_summary["Actual"] - dept_summary["Budget"]) / dept_summary["Budget"] * 100).round(1)
            st.dataframe(dept_summary, use_container_width=True)

            # Management report export
            st.subheader("📄 Management Report")
            overspends = merged[merged["Status"] == "🔴 Overspend"]
            report_text = f"""CHRYSAL INTERNATIONAL AFRICA
BUDGET vs ACTUAL MANAGEMENT REPORT — {period}
Generated: {now_nairobi().strftime('%d %B %Y %H:%M')} (Nairobi time)

EXECUTIVE SUMMARY
Total Budget:     KES {total_budget:>15,.2f}
Total Actual:     KES {total_actual:>15,.2f}
Net Variance:     KES {total_variance:>15,.2f} ({'Favourable' if total_variance > 0 else 'Adverse'})
Overall Position: {'✅ Within Budget' if total_variance >= 0 else '⚠️ Over Budget'}

OVERSPEND ITEMS ({len(overspends)} line(s) require attention):
"""
            for _, row in overspends.iterrows():
                report_text += f"\n  • {row['Account']} (CC {row['CC']}): Budget KES {row['Budget (KES)']:,.0f} | Actual KES {row['Actual (KES)']:,.0f} | Overspend KES {abs(row['Variance (KES)']):,.0f} ({abs(row['Variance %']):.1f}%)"

            report_text += f"\n\nPrepared by: {current_user}\nFor review by: Tony (Finance Manager) → Charles (Business Controller) → Niels (MD)"
            st.text_area("Management Report (copy to share with team)", report_text, height=300)
            st.download_button("⬇️ Download Report", report_text.encode(),
                              f"Budget_vs_Actual_{period.replace(' ','_')}.txt", "text/plain")

            from app.modules.document_store_page import save_document
            save_document("Management Report", f"Budget vs Actual — {period}",
                         report_text, period=period)
        else:
            st.error("Please provide both budget and actuals data.")
