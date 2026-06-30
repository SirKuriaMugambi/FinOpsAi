"""
Bank Reconciliation Module
Upload bank statement (CSV/Excel) + AX ledger extract → auto-match →
flag discrepancies → generate reconciliation report for Charles sign-off.
Handles multi-currency accounts (KES, EUR, USD) as Chrysal operates.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from utils.currency import format_currency, convert_to_kes
from utils.audit_trail import log_action, AuditAction


SAMPLE_BANK_STATEMENT = pd.DataFrame([
    {"Date": "02/06/2026", "Description": "Payment from Rose Farm BV", "Debit": 0, "Credit": 8142000, "Currency": "KES", "Ref": "TRF-001"},
    {"Date": "03/06/2026", "Description": "Bayer East Africa - Payment", "Debit": 513000, "Credit": 0, "Currency": "KES", "Ref": "PMT-001"},
    {"Date": "05/06/2026", "Description": "DHL Express - Payment", "Debit": 96900, "Credit": 0, "Currency": "KES", "Ref": "PMT-002"},
    {"Date": "07/06/2026", "Description": "Bank charges June", "Debit": 4500, "Credit": 0, "Currency": "KES", "Ref": "CHG-001"},
    {"Date": "10/06/2026", "Description": "Payment from Florimex GmbH", "Debit": 0, "Credit": 5138760, "Currency": "KES", "Ref": "TRF-002"},
    {"Date": "15/06/2026", "Description": "KPLC - Electricity", "Debit": 118000, "Credit": 0, "Currency": "KES", "Ref": "PMT-003"},
    {"Date": "18/06/2026", "Description": "Forex loss - EUR purchase", "Debit": 12500, "Credit": 0, "Currency": "KES", "Ref": "FX-001"},
    {"Date": "20/06/2026", "Description": "KRA WHT payment", "Debit": 25000, "Credit": 0, "Currency": "KES", "Ref": "KRA-001"},
    {"Date": "22/06/2026", "Description": "Unidentified credit", "Debit": 0, "Credit": 85000, "Currency": "KES", "Ref": "UNK-001"},
])

SAMPLE_AX_LEDGER = pd.DataFrame([
    {"Date": "02/06/2026", "Description": "AR Receipt - Rose Farm BV INV-2026-041", "Debit": 0, "Credit": 8142000, "Ref": "AR-041"},
    {"Date": "03/06/2026", "Description": "AP Payment - Bayer BAY-2026-055", "Debit": 513000, "Credit": 0, "Ref": "AP-055"},
    {"Date": "05/06/2026", "Description": "AP Payment - DHL DHL-8821", "Debit": 96900, "Credit": 0, "Ref": "AP-821"},
    {"Date": "10/06/2026", "Description": "AR Receipt - Florimex INV-2026-042", "Debit": 0, "Credit": 5138760, "Ref": "AR-042"},
    {"Date": "15/06/2026", "Description": "AP Payment - Kenya Power KP-884", "Debit": 118000, "Credit": 0, "Ref": "AP-884"},
    {"Date": "20/06/2026", "Description": "KRA WHT Filing June", "Debit": 25000, "Credit": 0, "Ref": "KRA-JUN"},
    {"Date": "25/06/2026", "Description": "Accrual - outstanding vendor", "Debit": 45000, "Credit": 0, "Ref": "ACC-001"},
])

TOLERANCE = 1.0


def match_transactions(bank_df, ax_df):
    matched = []
    unmatched_bank = []
    unmatched_ax = []

    ax_pool = ax_df.copy().reset_index(drop=True)
    ax_matched = [False] * len(ax_pool)

    for _, bank_row in bank_df.iterrows():
        bank_amount = bank_row["Credit"] if bank_row["Credit"] > 0 else bank_row["Debit"]
        bank_is_credit = bank_row["Credit"] > 0
        found = False

        for i, ax_row in ax_pool.iterrows():
            if ax_matched[i]:
                continue
            ax_amount = ax_row["Credit"] if ax_row["Credit"] > 0 else ax_row["Debit"]
            ax_is_credit = ax_row["Credit"] > 0

            if (abs(bank_amount - ax_amount) <= TOLERANCE and
                    bank_is_credit == ax_is_credit):
                matched.append({
                    "Bank Date": bank_row["Date"],
                    "Bank Description": bank_row["Description"],
                    "Bank Ref": bank_row.get("Ref", ""),
                    "AX Date": ax_row["Date"],
                    "AX Description": ax_row["Description"],
                    "AX Ref": ax_row.get("Ref", ""),
                    "Amount (KES)": bank_amount,
                    "Type": "Credit" if bank_is_credit else "Debit",
                    "Status": "✅ Matched",
                })
                ax_matched[i] = True
                found = True
                break

        if not found:
            unmatched_bank.append({
                "Date": bank_row["Date"],
                "Description": bank_row["Description"],
                "Ref": bank_row.get("Ref", ""),
                "Amount (KES)": bank_amount,
                "Type": "Credit" if bank_is_credit else "Debit",
                "Reason": "In bank statement — not found in AX",
            })

    for i, ax_row in ax_pool.iterrows():
        if not ax_matched[i]:
            ax_amount = ax_row["Credit"] if ax_row["Credit"] > 0 else ax_row["Debit"]
            unmatched_ax.append({
                "Date": ax_row["Date"],
                "Description": ax_row["Description"],
                "Ref": ax_row.get("Ref", ""),
                "Amount (KES)": ax_amount,
                "Type": "Credit" if ax_row["Credit"] > 0 else "Debit",
                "Reason": "In AX — not found in bank statement (timing difference or unposted)",
            })

    return matched, unmatched_bank, unmatched_ax


def render_bank_recon_page():
    st.title("🏦 Bank Reconciliation")
    st.caption("Upload your bank statement and AX ledger extract — the app auto-matches transactions, flags discrepancies, and generates a reconciliation report for Charles to sign off.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Bank Statement")
        st.caption("Download from your bank's online portal as CSV/Excel")
        use_sample_bank = st.checkbox("Use sample bank statement", value=True)
        if use_sample_bank:
            bank_df = SAMPLE_BANK_STATEMENT.copy()
            st.dataframe(bank_df, use_container_width=True)
        else:
            bank_file = st.file_uploader(
                "Upload bank statement (CSV/Excel)",
                type=["csv", "xlsx", "xls"],
                key="bank_upload",
                help="Expected columns: Date, Description, Ref, Debit (KES), Credit (KES), Balance (KES)"
            )
            bank_df = None
            if bank_file:
                try:
                    if bank_file.name.endswith(("xlsx","xls")):
                        # Try skiprows=2 first to skip title row
                        temp_df = pd.read_excel(bank_file, header=0)
                        # If first column looks like a title, skip it
                        if "Credit" not in temp_df.columns and "Credit (KES)" not in temp_df.columns:
                            bank_file.seek(0)
                            temp_df = pd.read_excel(bank_file, skiprows=2, header=0)
                        bank_df = temp_df
                    else:
                        bank_df = pd.read_csv(bank_file)
                    # Normalize column names
                    bank_df.columns = [str(c).strip() for c in bank_df.columns]
                    # Handle "Debit (KES)" and "Credit (KES)" vs "Debit" and "Credit"
                    if "Debit (KES)" in bank_df.columns:
                        bank_df = bank_df.rename(columns={"Debit (KES)": "Debit", "Credit (KES)": "Credit"})
                    # Fill NaN with 0 for numeric columns
                    for col in ["Debit", "Credit"]:
                        if col in bank_df.columns:
                            bank_df[col] = pd.to_numeric(
                                bank_df[col].astype(str).str.replace(",",""), errors="coerce"
                            ).fillna(0)
                    st.session_state["bank_df_stored"] = bank_df
                except Exception as e:
                    st.error(f"Error reading bank statement: {e}")
            elif st.session_state.get("bank_df_stored") is not None:
                bank_df = st.session_state["bank_df_stored"]

        if bank_df is not None:
            st.dataframe(bank_df, use_container_width=True)
            if "Credit" in bank_df.columns and "Debit" in bank_df.columns:
                st.metric("Total Credits", format_currency(bank_df["Credit"].sum()))
                st.metric("Total Debits", format_currency(bank_df["Debit"].sum()))

    with col2:
        st.subheader("AX Ledger Extract")
        st.caption("Export cash/bank account transactions from Microsoft Dynamics AX")
        use_sample_ax = st.checkbox("Use sample AX ledger", value=True)
        if use_sample_ax:
            ax_df = SAMPLE_AX_LEDGER.copy()
            st.dataframe(ax_df, use_container_width=True)
        else:
            ax_file = st.file_uploader(
                "Upload AX ledger extract (CSV/Excel)",
                type=["csv", "xlsx", "xls"],
                key="ax_upload",
                help="Expected columns: Date, Description, Ref, Debit (KES), Credit (KES)"
            )
            ax_df = None
            if ax_file:
                try:
                    if ax_file.name.endswith(("xlsx","xls")):
                        temp_df = pd.read_excel(ax_file, header=0)
                        if "Credit" not in temp_df.columns and "Credit (KES)" not in temp_df.columns:
                            ax_file.seek(0)
                            temp_df = pd.read_excel(ax_file, skiprows=2, header=0)
                        ax_df = temp_df
                    else:
                        ax_df = pd.read_csv(ax_file)
                    ax_df.columns = [str(c).strip() for c in ax_df.columns]
                    if "Debit (KES)" in ax_df.columns:
                        ax_df = ax_df.rename(columns={"Debit (KES)": "Debit", "Credit (KES)": "Credit"})
                    for col in ["Debit", "Credit"]:
                        if col in ax_df.columns:
                            ax_df[col] = pd.to_numeric(
                                ax_df[col].astype(str).str.replace(",",""), errors="coerce"
                            ).fillna(0)
                    st.session_state["ax_df_stored"] = ax_df
                except Exception as e:
                    st.error(f"Error reading AX ledger: {e}")
            elif st.session_state.get("ax_df_stored") is not None:
                ax_df = st.session_state["ax_df_stored"]

        if ax_df is not None:
            st.dataframe(ax_df, use_container_width=True)

    st.divider()

    opening_balance = st.number_input(
        "Opening Balance (KES)",
        value=2500000.0, step=100000.0,
        help="Bank account opening balance at the start of the period"
    )
    period = st.text_input("Period", value="June 2026")

    # Use whichever df is available — sample or uploaded
    active_bank_df = bank_df if bank_df is not None else (SAMPLE_BANK_STATEMENT if use_sample_bank else None)
    active_ax_df = ax_df if ax_df is not None else (SAMPLE_AX_LEDGER if use_sample_ax else None)

    if st.button("🔄 Run Bank Reconciliation", type="primary", use_container_width=True):
        if active_bank_df is not None and active_ax_df is not None:
            # Ensure numeric columns exist
            for df in [active_bank_df, active_ax_df]:
                for col in ["Debit", "Credit"]:
                    if col not in df.columns:
                        df[col] = 0
                    df[col] = pd.to_numeric(
                        df[col].astype(str).str.replace(",",""), errors="coerce"
                    ).fillna(0)

            matched, unmatched_bank, unmatched_ax = match_transactions(
                active_bank_df, active_ax_df
            )
            st.session_state["bank_recon"] = {
                "matched": matched,
                "unmatched_bank": unmatched_bank,
                "unmatched_ax": unmatched_ax,
                "period": period,
                "opening_balance": opening_balance,
                "bank_df": active_bank_df,
                "ax_df": active_ax_df,
            }
            log_action(current_user, "BANK RECON RUN", period,
                      f"Bank rec — {len(matched)} matched, {len(unmatched_bank)} unmatched bank, {len(unmatched_ax)} unmatched AX")
        else:
            st.error("Please upload or enable sample data for both Bank Statement and AX Ledger before running.")

    if st.session_state.get("bank_recon"):
        recon = st.session_state["bank_recon"]
        matched = recon["matched"]
        unmatched_bank = recon["unmatched_bank"]
        unmatched_ax = recon["unmatched_ax"]
        stored_bank_df = recon.get("bank_df") if recon.get("bank_df") is not None else SAMPLE_BANK_STATEMENT
        stored_ax_df = recon.get("ax_df") if recon.get("ax_df") is not None else SAMPLE_AX_LEDGER

        total_matched = sum(r["Amount (KES)"] for r in matched)
        total_unmatched_bank = sum(r["Amount (KES)"] for r in unmatched_bank)
        total_unmatched_ax = sum(r["Amount (KES)"] for r in unmatched_ax)

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("✅ Matched Items", len(matched),
                   f"KES {total_matched:,.0f}")
        col2.metric("⚠️ In Bank Not AX", len(unmatched_bank),
                   f"KES {total_unmatched_bank:,.0f}")
        col3.metric("⚠️ In AX Not Bank", len(unmatched_ax),
                   f"KES {total_unmatched_ax:,.0f}")
        col4.metric("Match Rate",
                   f"{len(matched)/(len(matched)+len(unmatched_bank)+len(unmatched_ax))*100:.0f}%")

        st.divider()

        if matched:
            with st.expander(f"✅ Matched Transactions ({len(matched)})", expanded=False):
                st.dataframe(pd.DataFrame(matched), use_container_width=True)

        if unmatched_bank:
            st.subheader("⚠️ In Bank Statement — Not in AX")
            st.warning("These transactions appear in the bank but are not recorded in AX. Investigate and post if valid.")
            df_ub = pd.DataFrame(unmatched_bank)
            st.dataframe(df_ub, use_container_width=True)

        if unmatched_ax:
            st.subheader("⚠️ In AX — Not in Bank Statement")
            st.info("These are posted in AX but not yet reflected in the bank statement — likely timing differences or outstanding items.")
            df_ua = pd.DataFrame(unmatched_ax)
            st.dataframe(df_ua, use_container_width=True)

        st.divider()
        st.subheader("📋 Reconciliation Statement")

        bank_closing = recon["opening_balance"] + stored_bank_df["Credit"].sum() - stored_bank_df["Debit"].sum()
        ax_closing = recon["opening_balance"] + stored_ax_df["Credit"].sum() - stored_ax_df["Debit"].sum()
        unmatched_bank_net = sum(
            r["Amount (KES)"] * (1 if r["Type"] == "Credit" else -1)
            for r in unmatched_bank
        )
        unmatched_ax_net = sum(
            r["Amount (KES)"] * (1 if r["Type"] == "Credit" else -1)
            for r in unmatched_ax
        )
        adjusted_balance = bank_closing - unmatched_bank_net

        recon_data = {
            "Item": [
                "Opening Balance",
                "Bank Statement Closing Balance",
                "Less: Items in bank not in AX",
                "Adjusted Bank Balance",
                "AX Book Balance",
                "Less: Timing differences (in AX not in bank)",
                "Adjusted Book Balance",
                "Difference (should be zero)",
            ],
            "Amount (KES)": [
                f"{opening_balance:,.2f}",
                f"{bank_closing:,.2f}",
                f"({unmatched_bank_net:,.2f})" if unmatched_bank_net > 0 else f"{unmatched_bank_net:,.2f}",
                f"{adjusted_balance:,.2f}",
                f"{ax_closing:,.2f}",
                f"({unmatched_ax_net:,.2f})" if unmatched_ax_net > 0 else f"{unmatched_ax_net:,.2f}",
                f"{ax_closing - unmatched_ax_net:,.2f}",
                f"{adjusted_balance - (ax_closing - unmatched_ax_net):,.2f}",
            ]
        }
        st.dataframe(pd.DataFrame(recon_data), use_container_width=True)

        difference = adjusted_balance - (ax_closing - unmatched_ax_net)
        if abs(difference) < 1:
            st.success("✅ Bank reconciliation balances — ready for Charles to sign off")
        else:
            st.error(f"🔴 Reconciliation difference of KES {abs(difference):,.2f} — investigate before sign-off")

        st.divider()
        st.subheader("✅ Controller Sign-Off")
        recon_confirmed = st.session_state.get("bank_recon_confirmed", False)
        if recon_confirmed:
            info = st.session_state["bank_recon_confirmation"]
            st.success(f"✅ Bank reconciliation signed off by {info['by']} at {info['at']}")
        else:
            if current_user in ["Charles (Business Controller)", "Tony (Finance Manager)"]:
                if st.button("✅ Sign Off Bank Reconciliation", type="primary"):
                    st.session_state["bank_recon_confirmed"] = True
                    st.session_state["bank_recon_confirmation"] = {
                        "by": current_user,
                        "at": datetime.now().strftime("%Y-%m-%d %H:%M")
                    }
                    log_action(current_user, "BANK RECON APPROVED", period,
                              "Bank reconciliation signed off")
                    st.rerun()
            else:
                st.info("Sign-off restricted to Tony (Finance Manager) or Charles (Business Controller)")

        all_data = pd.DataFrame(
            [{"Category": "Matched", **r} for r in matched] +
            [{"Category": "Unmatched - Bank", **r} for r in unmatched_bank] +
            [{"Category": "Unmatched - AX", **r} for r in unmatched_ax]
        )
        st.download_button(
            "⬇️ Download Full Reconciliation Report",
            all_data.to_csv(index=False).encode(),
            f"Bank_Recon_{period.replace(' ','_')}.csv",
            "text/csv"
        )
