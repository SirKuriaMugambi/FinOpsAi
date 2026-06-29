"""
Month-End Close Checklist
Based on Chrysal International Africa's real month-end workflow.
Color-coded tasks with user confirmation, timestamps, and audit trail.
Tracks: WHT filing, WVAT receipting, intercompany confirmation,
accruals, payroll, recon sign-off, and management reporting.
"""

import streamlit as st
import pandas as pd
from datetime import datetime
from utils.audit_trail import log_action, AuditAction


# Chrysal's real month-end checklist based on actual team workflow
MONTH_END_TASKS = [
    # AP Tasks
    {
        "id": "ap_01", "category": "Accounts Payable",
        "task": "All vendor invoices for the month posted and approved in AX",
        "owner": "Finance Team", "reviewer": "Mercy",
        "description": "Confirm all AP invoices are posted, approved and matched to POs where applicable"
    },
    {
        "id": "ap_02", "category": "Accounts Payable",
        "task": "Vendor WHT calculated and filed on KRA iTax portal (2% & 5%)",
        "owner": "Finance Team", "reviewer": "Tony",
        "description": "File WHT by 20th of the month — 2% via CSV upload, 5% via Excel import. CU numbers must be included."
    },
    {
        "id": "ap_03", "category": "Accounts Payable",
        "task": "Remittance advice prepared and approved by Charles",
        "owner": "Mercy", "reviewer": "Charles",
        "description": "All vendor remittances reviewed and signed off by Business Controller before payment"
    },
    {
        "id": "ap_04", "category": "Accounts Payable",
        "task": "Payments processed in bank by Tony",
        "owner": "Tony", "reviewer": "Charles",
        "description": "All approved remittances processed in the bank system"
    },
    # AR Tasks
    {
        "id": "ar_01", "category": "Accounts Receivable",
        "task": "All customer invoices for the month posted and matched in AX",
        "owner": "Finance Team", "reviewer": "Mercy",
        "description": "Confirm all AR invoices are raised, posted and receipted against payments received"
    },
    {
        "id": "ar_02", "category": "Accounts Receivable",
        "task": "Customer WVAT (2% of 16% VAT) receipted and posted from KRA portal",
        "owner": "Finance Team", "reviewer": "Tony",
        "description": "Download customer WHT certificates from KRA portal, post to AX and match to specific invoices"
    },
    {
        "id": "ar_03", "category": "Accounts Receivable",
        "task": "Outstanding AR reconciliation completed and aged debtors report prepared",
        "owner": "Mercy", "reviewer": "Tony",
        "description": "All customer balances reconciled, aged debtors list updated"
    },
    # Intercompany
    {
        "id": "ic_01", "category": "Intercompany",
        "task": "Intercompany balances confirmed with Chrysal International BV (parent company)",
        "owner": "Mercy & Tony", "reviewer": "Charles",
        "description": "Confirm and agree intercompany account balances with parent company CFO/Accounts team before closing"
    },
    {
        "id": "ic_02", "category": "Intercompany",
        "task": "Intercompany invoices/charges posted and reconciled in AX",
        "owner": "Finance Team", "reviewer": "Mercy",
        "description": "All intercompany transactions posted with correct ledger/CC allocations"
    },
    # Accruals
    {
        "id": "acc_01", "category": "Accruals",
        "task": "Accruals journal prepared by Mercy and approved by Tony",
        "owner": "Mercy", "reviewer": "Tony",
        "description": "All month-end accruals identified, calculated and posted to AX (rent, utilities, salaries etc.)"
    },
    {
        "id": "acc_02", "category": "Accruals",
        "task": "Accruals report submitted to Charles for month-end closure",
        "owner": "Tony", "reviewer": "Charles",
        "description": "Final accruals report reviewed by Business Controller before accounts are closed"
    },
    # Payroll
    {
        "id": "pay_01", "category": "Payroll",
        "task": "Payroll processed and PAYE/NSSF/NHIF/NITA computed",
        "owner": "Tony", "reviewer": "Charles",
        "description": "Monthly payroll run completed with all statutory deductions calculated correctly"
    },
    {
        "id": "pay_02", "category": "Payroll",
        "task": "Payroll statutory deductions filed with KRA (PAYE) and relevant bodies",
        "owner": "Finance Team", "reviewer": "Tony",
        "description": "PAYE filed via iTax, NSSF and NHIF contributions submitted"
    },
    # Reconciliations
    {
        "id": "rec_01", "category": "Reconciliations",
        "task": "Bank reconciliation completed for all bank accounts",
        "owner": "Finance Team", "reviewer": "Mercy",
        "description": "All bank accounts reconciled against bank statements — no unreconciled items above threshold"
    },
    {
        "id": "rec_02", "category": "Reconciliations",
        "task": "AP and AR sub-ledger reconciled to general ledger",
        "owner": "Mercy", "reviewer": "Tony",
        "description": "Confirm AP/AR sub-ledger balances match general ledger control accounts"
    },
    {
        "id": "rec_03", "category": "Reconciliations",
        "task": "All reconciliations approved and signed off by Charles",
        "owner": "Charles", "reviewer": "Charles",
        "description": "Business Controller final sign-off on all reconciliations before month closure"
    },
    # Month Closure
    {
        "id": "cls_01", "category": "Month Closure",
        "task": "Month closed in AX by Charles (Business Controller)",
        "owner": "Charles", "reviewer": "Charles",
        "description": "Accounting period closed in Microsoft Dynamics AX — no further postings allowed"
    },
    {
        "id": "cls_02", "category": "Month Closure",
        "task": "Management accounts prepared and reviewed by Tony",
        "owner": "Tony", "reviewer": "Charles",
        "description": "P&L, Balance Sheet and cash flow statement prepared for management review"
    },
    {
        "id": "cls_03", "category": "Month Closure",
        "task": "Management report submitted to Niels (MD Kenya)",
        "owner": "Charles", "reviewer": "Niels",
        "description": "Monthly management pack submitted to Managing Director Kenya"
    },
    {
        "id": "cls_04", "category": "Month Closure",
        "task": "Financial results reported to CFO and CEO at Chrysal International BV (parent)",
        "owner": "Charles", "reviewer": "Parent CFO",
        "description": "Monthly results submitted to parent company — Chrysal International BV Netherlands"
    },
]


def render_monthend_page():
    st.title("✅ Month-End Close Checklist")
    st.caption("Chrysal International Africa's real month-end workflow — track task completion with timestamps, owner confirmation, and audit trail.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")
    period = st.selectbox("Closing Period", [
        "June 2026", "May 2026", "April 2026", "March 2026",
        "February 2026", "January 2026"
    ])

    # Init checklist state
    checklist_key = f"checklist_{period.replace(' ','_')}"
    if checklist_key not in st.session_state:
        st.session_state[checklist_key] = {task["id"]: {"done": False, "timestamp": "", "confirmed_by": ""} for task in MONTH_END_TASKS}

    checklist = st.session_state[checklist_key]

    # Progress bar
    total = len(MONTH_END_TASKS)
    done = sum(1 for v in checklist.values() if v["done"])
    pct = done / total
    st.metric("Progress", f"{done}/{total} tasks complete ({pct*100:.0f}%)")
    st.progress(pct)

    if pct == 1.0:
        st.success("🎉 All month-end tasks complete! Ready for Charles to close the period in AX.")
    elif pct >= 0.8:
        st.warning(f"⚠️ {total-done} task(s) remaining before month-end closure.")
    else:
        st.info(f"📋 {done} of {total} tasks completed. {total-done} remaining.")

    st.divider()

    # Group by category
    categories = list(dict.fromkeys(t["category"] for t in MONTH_END_TASKS))
    for category in categories:
        category_tasks = [t for t in MONTH_END_TASKS if t["category"] == category]
        cat_done = sum(1 for t in category_tasks if checklist[t["id"]]["done"])
        cat_color = "🟢" if cat_done == len(category_tasks) else ("🟡" if cat_done > 0 else "🔴")

        with st.expander(f"{cat_color} {category} ({cat_done}/{len(category_tasks)} complete)", expanded=(cat_done < len(category_tasks))):
            for task in category_tasks:
                tid = task["id"]
                state = checklist[tid]
                col1, col2, col3 = st.columns([0.5, 3, 1.5])

                with col1:
                    checked = st.checkbox("", value=state["done"], key=f"chk_{tid}_{period}")
                    if checked != state["done"]:
                        state["done"] = checked
                        if checked:
                            state["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M")
                            state["confirmed_by"] = current_user
                            log_action(current_user, AuditAction.MONTH_END_TASK, period,
                                      f"Task completed: {task['task']}")
                        else:
                            state["timestamp"] = ""
                            state["confirmed_by"] = ""
                        st.session_state[checklist_key][tid] = state
                        st.rerun()

                with col2:
                    if state["done"]:
                        st.markdown(f"~~{task['task']}~~ ✅")
                        st.caption(f"Confirmed by {state['confirmed_by']} at {state['timestamp']}")
                    else:
                        st.markdown(f"**{task['task']}**")
                        st.caption(f"Owner: {task['owner']} | Reviewer: {task['reviewer']} | {task['description']}")

                with col3:
                    if state["done"]:
                        st.markdown("🟢 **Done**")
                    else:
                        st.markdown("🔴 **Pending**")

    st.divider()

    # Export checklist status
    if st.button("📄 Export Checklist Status"):
        rows = []
        for task in MONTH_END_TASKS:
            state = checklist[task["id"]]
            rows.append({
                "Category": task["category"],
                "Task": task["task"],
                "Owner": task["owner"],
                "Reviewer": task["reviewer"],
                "Status": "Complete" if state["done"] else "Pending",
                "Confirmed By": state["confirmed_by"],
                "Timestamp": state["timestamp"],
            })
        df = pd.DataFrame(rows)
        st.download_button("⬇️ Download Checklist",
                          df.to_csv(index=False).encode(),
                          f"MonthEnd_Checklist_{period.replace(' ','_')}.csv",
                          "text/csv")

    # Reset
    if st.button("🔄 Reset Checklist for New Period"):
        st.session_state[checklist_key] = {task["id"]: {"done": False, "timestamp": "", "confirmed_by": ""} for task in MONTH_END_TASKS}
        st.rerun()
