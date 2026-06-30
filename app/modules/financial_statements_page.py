"""
Financial Statements Generator
Upload trial balance from AX → auto-generate P&L, Balance Sheet,
and management commentary. Positions as the narrative/presentation
layer on top of AX's numbers — not replacing AX reporting.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from utils.currency import format_currency
from utils.audit_trail import log_action
from data.chart_of_accounts import CHART_OF_ACCOUNTS


SAMPLE_TRIAL_BALANCE = pd.DataFrame([
    {"Account": "1000", "Name": "Cash and Cash Equivalents", "Debit": 2850000, "Credit": 0},
    {"Account": "1100", "Name": "Accounts Receivable - Trade", "Debit": 3240000, "Credit": 0},
    {"Account": "1110", "Name": "Accounts Receivable - Intercompany", "Debit": 850000, "Credit": 0},
    {"Account": "1200", "Name": "Inventory - Raw Materials", "Debit": 1200000, "Credit": 0},
    {"Account": "1210", "Name": "Inventory - Finished Goods", "Debit": 680000, "Credit": 0},
    {"Account": "1300", "Name": "VAT Recoverable", "Debit": 245000, "Credit": 0},
    {"Account": "1400", "Name": "Prepayments and Deposits", "Debit": 120000, "Credit": 0},
    {"Account": "1500", "Name": "Property, Plant & Equipment", "Debit": 4500000, "Credit": 0},
    {"Account": "1510", "Name": "Accumulated Depreciation", "Debit": 0, "Credit": 1200000},
    {"Account": "2000", "Name": "Accounts Payable - Trade", "Debit": 0, "Credit": 1850000},
    {"Account": "2010", "Name": "Accounts Payable - Intercompany", "Debit": 0, "Credit": 620000},
    {"Account": "2100", "Name": "VAT Payable", "Debit": 0, "Credit": 180000},
    {"Account": "2110", "Name": "WHT Payable - Suppliers", "Debit": 0, "Credit": 25000},
    {"Account": "2200", "Name": "Accrued Liabilities", "Debit": 0, "Credit": 320000},
    {"Account": "2300", "Name": "Payroll Payable", "Debit": 0, "Credit": 425000},
    {"Account": "3000", "Name": "Share Capital", "Debit": 0, "Credit": 2000000},
    {"Account": "3100", "Name": "Retained Earnings", "Debit": 0, "Credit": 4850000},
    {"Account": "4000", "Name": "Sales Revenue - Local", "Debit": 0, "Credit": 3200000},
    {"Account": "4010", "Name": "Sales Revenue - Export", "Debit": 0, "Credit": 5800000},
    {"Account": "4100", "Name": "Technical Consultancy Revenue", "Debit": 0, "Credit": 850000},
    {"Account": "5000", "Name": "Cost of Goods Sold", "Debit": 2680000, "Credit": 0},
    {"Account": "5300", "Name": "Freight Inward", "Debit": 512000, "Credit": 0},
    {"Account": "5400", "Name": "Production Consumables", "Debit": 395000, "Credit": 0},
    {"Account": "6000", "Name": "Staff Salaries & Wages", "Debit": 1200000, "Credit": 0},
    {"Account": "6100", "Name": "Rent & Occupancy", "Debit": 320000, "Credit": 0},
    {"Account": "6200", "Name": "Utilities", "Debit": 118000, "Credit": 0},
    {"Account": "6300", "Name": "Telecommunications", "Debit": 42000, "Credit": 0},
    {"Account": "6500", "Name": "Technical Consultancy Fees", "Debit": 340000, "Credit": 0},
    {"Account": "6700", "Name": "Travel & Entertainment", "Debit": 98000, "Credit": 0},
    {"Account": "6900", "Name": "Depreciation Expense", "Debit": 75000, "Credit": 0},
    {"Account": "7000", "Name": "Bank Charges & Forex", "Debit": 61000, "Credit": 0},
])

ACCOUNT_TYPES = {
    "1": "Asset", "2": "Liability", "3": "Equity",
    "4": "Revenue", "5": "COGS", "6": "Opex", "7": "Opex"
}


def classify(account_code: str) -> str:
    return ACCOUNT_TYPES.get(str(account_code)[0], "Other")


def render_financial_statements_page():
    st.title("📑 Financial Statements")
    st.caption("Upload your trial balance from AX — the app auto-generates P&L, Balance Sheet and a board-ready management commentary. Designed as the narrative and presentation layer on top of AX's numbers.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")
    period = st.selectbox("Reporting Period", ["June 2026", "May 2026", "Q2 2026", "H1 2026"])
    company = "Chrysal International Africa"

    st.subheader("Trial Balance")
    use_sample = st.checkbox("Use sample trial balance (from AX export)", value=True)

    if use_sample:
        tb = SAMPLE_TRIAL_BALANCE.copy()
    else:
        tb_file = st.file_uploader(
            "Upload trial balance (Excel/CSV export from AX)",
            type=["xlsx","xls","csv"],
            help="Export from AX: General Ledger → Trial Balance report → Export to Excel"
        )
        tb = None
        if tb_file:
            try:
                if tb_file.name.endswith(("xlsx","xls")):
                    temp_df = pd.read_excel(tb_file, header=0)
                    # Check if first row looks like real headers
                    cols_lower = [str(c).lower().strip() for c in temp_df.columns]
                    if not any("account" in c for c in cols_lower):
                        tb_file.seek(0)
                        temp_df = pd.read_excel(tb_file, skiprows=2, header=0)
                    tb = temp_df
                else:
                    tb = pd.read_csv(tb_file)

                # Normalize column names — handle variations
                tb.columns = [str(c).strip() for c in tb.columns]
                rename_map = {}
                for c in tb.columns:
                    cl = c.lower().strip()
                    if cl in ("account", "account no", "account number", "account code", "ledger"):
                        rename_map[c] = "Account"
                    elif cl in ("name", "account name", "description"):
                        rename_map[c] = "Name"
                    elif cl in ("debit", "dr"):
                        rename_map[c] = "Debit"
                    elif cl in ("credit", "cr"):
                        rename_map[c] = "Credit"
                tb = tb.rename(columns=rename_map)

                # Clean numeric columns
                for col in ["Debit", "Credit"]:
                    if col in tb.columns:
                        tb[col] = pd.to_numeric(
                            tb[col].astype(str).str.replace(",", ""), errors="coerce"
                        ).fillna(0)

                missing = [c for c in ["Account", "Debit", "Credit"] if c not in tb.columns]
                if missing:
                    st.error(f"⚠️ Could not find required column(s): {', '.join(missing)}. Found columns: {list(tb.columns)}")
                    tb = None
            except Exception as e:
                st.error(f"Error reading trial balance: {e}")
                tb = None

    if tb is not None:
        st.dataframe(tb, use_container_width=True)
        st.divider()

        if st.button("📑 Generate Financial Statements", type="primary", use_container_width=True):
            tb["Type"] = tb["Account"].astype(str).apply(classify)
            tb["Net"] = tb["Debit"] - tb["Credit"]

            # P&L
            revenue = tb[tb["Type"] == "Revenue"]["Credit"].sum()
            cogs = tb[tb["Type"] == "COGS"]["Debit"].sum()
            gross_profit = revenue - cogs
            gross_margin = gross_profit / revenue * 100 if revenue else 0

            opex = tb[tb["Type"] == "Opex"]["Debit"].sum()
            ebit = gross_profit - opex
            operating_margin = ebit / revenue * 100 if revenue else 0

            finance_costs = tb[tb["Name"].str.contains("Bank Charges|Forex", case=False)]["Debit"].sum()
            pbt = ebit - finance_costs
            tax = pbt * 0.30  # Kenya corporate tax rate
            pat = pbt - tax
            net_margin = pat / revenue * 100 if revenue else 0

            # Balance Sheet
            current_assets = tb[
                (tb["Type"] == "Asset") &
                (tb["Account"].astype(str).apply(lambda x: x.startswith(("10","11","12","13","14"))))
            ]["Debit"].sum()
            fixed_assets = tb[tb["Account"].astype(str).apply(lambda x: x.startswith("15"))]["Net"].sum()
            total_assets = current_assets + abs(fixed_assets)

            current_liabilities = tb[
                (tb["Type"] == "Liability") &
                (tb["Account"].astype(str).apply(lambda x: x.startswith(("20","21","22","23"))))
            ]["Credit"].sum()
            equity = tb[tb["Type"] == "Equity"]["Credit"].sum() + pat
            total_liabilities_equity = current_liabilities + equity

            st.divider()

            tab1, tab2, tab3 = st.tabs(["📊 P&L Statement", "⚖️ Balance Sheet", "📄 Management Report"])

            with tab1:
                st.subheader(f"Income Statement — {period}")
                st.caption(f"{company}")

                pl_data = {
                    "Line Item": [
                        "Revenue", "Cost of Goods Sold", "Gross Profit", "",
                        "Operating Expenses", "EBIT (Operating Profit)", "",
                        "Finance Costs", "Profit Before Tax",
                        "Income Tax (30%)", "Profit After Tax"
                    ],
                    "KES": [
                        f"{revenue:,.0f}", f"({cogs:,.0f})", f"{gross_profit:,.0f}", "",
                        f"({opex:,.0f})", f"{ebit:,.0f}", "",
                        f"({finance_costs:,.0f})", f"{pbt:,.0f}",
                        f"({tax:,.0f})", f"{pat:,.0f}"
                    ],
                    "Margin": [
                        "100%", f"{cogs/revenue*100:.1f}%", f"{gross_margin:.1f}%", "",
                        f"{opex/revenue*100:.1f}%", f"{operating_margin:.1f}%", "",
                        "", "", "", f"{net_margin:.1f}%"
                    ]
                }
                st.dataframe(pd.DataFrame(pl_data), use_container_width=True)

                col1, col2, col3, col4 = st.columns(4)
                col1.metric("Revenue", format_currency(revenue))
                col2.metric("Gross Margin", f"{gross_margin:.1f}%")
                col3.metric("Operating Margin", f"{operating_margin:.1f}%")
                col4.metric("Net Margin", f"{net_margin:.1f}%")

                fig = go.Figure(go.Waterfall(
                    name="P&L", orientation="v",
                    measure=["absolute","relative","total","relative","total","relative","total"],
                    x=["Revenue","COGS","Gross Profit","Opex","EBIT","Tax","PAT"],
                    y=[revenue,-cogs,0,-opex,0,-tax,0],
                    connector={"line":{"color":"rgb(63,63,63)"}},
                ))
                fig.update_layout(title="P&L Waterfall", height=400)
                st.plotly_chart(fig, use_container_width=True)

            with tab2:
                st.subheader(f"Balance Sheet — {period}")
                st.caption(f"{company}")

                col1, col2 = st.columns(2)
                with col1:
                    st.markdown("**ASSETS**")
                    asset_rows = tb[tb["Type"] == "Asset"][["Name","Debit","Credit"]].copy()
                    asset_rows["Value"] = asset_rows["Debit"] - asset_rows["Credit"]
                    st.dataframe(asset_rows[["Name","Value"]], use_container_width=True)
                    st.metric("Total Assets", format_currency(total_assets))

                with col2:
                    st.markdown("**LIABILITIES & EQUITY**")
                    liab_rows = tb[tb["Type"].isin(["Liability","Equity"])][["Name","Debit","Credit"]].copy()
                    liab_rows["Value"] = liab_rows["Credit"] - liab_rows["Debit"]
                    st.dataframe(liab_rows[["Name","Value"]], use_container_width=True)
                    st.metric("Total Liabilities + Equity", format_currency(total_liabilities_equity))

                diff = total_assets - total_liabilities_equity
                if abs(diff) < 100:
                    st.success("✅ Balance sheet balances")
                else:
                    st.warning(f"⚠️ Difference of KES {diff:,.0f} — check trial balance completeness")

            with tab3:
                st.subheader(f"Management Report — {period}")
                st.caption(f"{company} | Prepared by: {current_user}")

                narrative = f"""
CHRYSAL INTERNATIONAL AFRICA
MANAGEMENT REPORT — {period}
{'='*50}

EXECUTIVE SUMMARY

{company} recorded revenue of KES {revenue:,.0f} for {period}, comprising local sales of KES {tb[tb['Account'].astype(str)=='4000']['Credit'].sum():,.0f} and export sales of KES {tb[tb['Account'].astype(str)=='4010']['Credit'].sum():,.0f}.

PROFITABILITY
Gross profit of KES {gross_profit:,.0f} represents a margin of {gross_margin:.1f}%. After operating expenses of KES {opex:,.0f}, EBIT stands at KES {ebit:,.0f} ({operating_margin:.1f}% operating margin). Net profit after tax is KES {pat:,.0f}, a net margin of {net_margin:.1f}%.

{'✅ Profitability is healthy.' if net_margin > 10 else '⚠️ Profitability is under pressure — review cost structure.' if net_margin > 0 else '🔴 Business is loss-making this period — urgent management attention required.'}

FINANCIAL POSITION
Total assets of KES {total_assets:,.0f} are financed by liabilities of KES {current_liabilities:,.0f} and equity of KES {equity:,.0f}.

KEY RATIOS
• Gross Margin: {gross_margin:.1f}%
• Operating Margin: {operating_margin:.1f}%
• Net Margin: {net_margin:.1f}%
• Current Assets: KES {current_assets:,.0f}
• Current Liabilities: KES {current_liabilities:,.0f}
• Current Ratio: {current_assets/current_liabilities:.2f}x

Prepared by: {current_user}
For review by: Tony (Finance Manager) → Charles (Business Controller) → Niels (MD Kenya) → CFO/CEO Chrysal BV
"""
                st.text_area("Management Report", narrative, height=400)
                st.download_button(
                    "⬇️ Download Management Report",
                    narrative.encode(),
                    f"Management_Report_{period.replace(' ','_')}.txt",
                    "text/plain"
                )

                log_action(current_user, "FINANCIAL STATEMENTS GENERATED", period,
                          f"P&L and Balance Sheet generated — Revenue KES {revenue:,.0f}, PAT KES {pat:,.0f}")
