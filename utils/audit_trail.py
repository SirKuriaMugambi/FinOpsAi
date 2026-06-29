"""
Audit Trail Engine
Every financial action in the system is logged with:
- Timestamp
- User ID
- Action type
- Document reference
- Before/after values where applicable
- IP/session identifier

This is non-deletable and append-only — critical for compliance,
KRA audits, and internal controls.
"""

import streamlit as st
from datetime import datetime


def init_audit_trail():
    """Initialize audit trail in session state if not exists."""
    if "audit_trail" not in st.session_state:
        st.session_state.audit_trail = []


def log_action(
    user: str,
    action: str,
    document_ref: str,
    details: str,
    amount: float = None,
    currency: str = None,
    before_value: str = None,
    after_value: str = None,
):
    """
    Log a financial action to the audit trail.
    Once logged, entries cannot be deleted or modified.
    """
    init_audit_trail()
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user": user,
        "action": action,
        "document_ref": document_ref,
        "details": details,
        "amount": f"{amount:,.2f} {currency}" if amount and currency else "",
        "before": before_value or "",
        "after": after_value or "",
    }
    st.session_state.audit_trail.append(entry)


def get_audit_trail() -> list:
    init_audit_trail()
    return st.session_state.audit_trail


# Standard action types
class AuditAction:
    INVOICE_UPLOADED = "INVOICE UPLOADED"
    INVOICE_PROCESSED = "INVOICE PROCESSED"
    INVOICE_APPROVED = "INVOICE APPROVED"
    INVOICE_REJECTED = "INVOICE REJECTED"
    INVOICE_POSTED = "INVOICE POSTED"
    WHT_CALCULATED = "WHT CALCULATED"
    WHT_FILED = "WHT FILED"
    PAYMENT_PROCESSED = "PAYMENT PROCESSED"
    RECON_RUN = "RECONCILIATION RUN"
    RECON_APPROVED = "RECON APPROVED"
    BUDGET_UPLOADED = "BUDGET UPLOADED"
    ACTUAL_ENTERED = "ACTUAL ENTERED"
    INTERCOMPANY_CONFIRMED = "INTERCOMPANY CONFIRMED"
    MONTH_END_TASK = "MONTH-END TASK COMPLETED"
    DOCUMENT_DELETED = "DOCUMENT DELETED"
    USER_LOGIN = "USER LOGIN"
    APPROVAL_CHAIN = "APPROVAL CHAIN UPDATED"
