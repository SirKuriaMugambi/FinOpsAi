"""Chart of Accounts page — view and manage Chrysal's COA."""
import streamlit as st
import pandas as pd
from data.chart_of_accounts import CHART_OF_ACCOUNTS, COST_CENTRES, DEPARTMENTS, APPROVAL_CHAIN


def render_coa_page():
    st.title("🏦 Chart of Accounts")
    st.caption("Chrysal International Africa — Chart of Accounts, Cost Centres, and Approval Chain. This drives all ledger mapping in the Invoice Processor.")
    st.divider()

    tab1, tab2, tab3 = st.tabs(["📋 Chart of Accounts", "🏢 Cost Centres & Departments", "✅ Approval Chain"])

    with tab1:
        account_type = st.selectbox("Filter by type", ["All", "Asset", "Liability", "Equity", "Revenue", "Expense"])
        rows = []
        for code, acc in CHART_OF_ACCOUNTS.items():
            if account_type == "All" or acc["type"] == account_type:
                rows.append({
                    "Code": code,
                    "Account Name": acc["name"],
                    "Type": acc["type"],
                    "Default Dept": acc["dept"],
                    "Default CC": f"{acc['cc']} — {COST_CENTRES.get(acc['cc'],'')}",
                })
        st.dataframe(pd.DataFrame(rows), use_container_width=True)

    with tab2:
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Cost Centres")
            cc_rows = [{"Code": k, "Cost Centre": v} for k, v in COST_CENTRES.items()]
            st.dataframe(pd.DataFrame(cc_rows), use_container_width=True)
        with col2:
            st.subheader("Departments")
            dept_rows = [{"Code": k, "Department": v} for k, v in DEPARTMENTS.items()]
            st.dataframe(pd.DataFrame(dept_rows), use_container_width=True)

    with tab3:
        st.subheader("Invoice Approval Chain")
        for inv_type, info in APPROVAL_CHAIN.items():
            with st.expander(f"**{inv_type}** → {info['approver']} ({info['role']})"):
                st.write(f"**Approver:** {info['approver']}")
                st.write(f"**Role:** {info['role']}")
                st.write(f"**Cost Centre:** {info['cc']}")
                st.write(f"**Covers:** {info['description']}")
