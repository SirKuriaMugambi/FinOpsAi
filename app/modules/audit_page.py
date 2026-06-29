"""Audit Trail Page — full non-deletable log of all financial actions."""
import streamlit as st
import pandas as pd
from utils.audit_trail import get_audit_trail, init_audit_trail


def render_audit_page():
    st.title("🔍 Audit Trail")
    st.caption("Complete, non-deletable log of all financial actions — with timestamp, user ID, document reference and change details. Fully compliant for KRA audits and internal controls.")
    st.divider()

    init_audit_trail()
    trail = get_audit_trail()

    if not trail:
        st.info("No actions logged yet. Start processing invoices, running reconciliations, or completing month-end tasks to build the audit trail.")
        return

    col1, col2, col3 = st.columns(3)
    col1.metric("Total Actions Logged", len(trail))
    col2.metric("Users Active", len(set(e["user"] for e in trail)))
    col3.metric("Action Types", len(set(e["action"] for e in trail)))

    st.divider()

    # Filter
    action_types = ["All"] + list(set(e["action"] for e in trail))
    selected_action = st.selectbox("Filter by Action Type", action_types)

    filtered = trail if selected_action == "All" else [e for e in trail if e["action"] == selected_action]

    df = pd.DataFrame(filtered)
    st.dataframe(df, use_container_width=True)

    st.download_button("⬇️ Export Audit Trail", df.to_csv(index=False).encode(),
                      "Audit_Trail.csv", "text/csv")

    st.caption("⚠️ The audit trail is append-only and cannot be modified or deleted. Every financial action is permanently recorded.")
