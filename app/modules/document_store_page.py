"""
Document Storage Module
Central archive for all generated documents — invoices, receipts,
reconciliations, remittance advices, and management reports.
Organized chronologically by month for easy retrieval.
"""

import streamlit as st
import pandas as pd
from datetime import datetime
from utils.audit_trail import log_action


def init_document_store():
    if "document_store" not in st.session_state:
        st.session_state.document_store = []


def save_document(doc_type: str, title: str, content: str, period: str = None, related_ref: str = ""):
    """Save a document to the central store."""
    init_document_store()
    if period is None:
        period = datetime.now().strftime("%B %Y")
    st.session_state.document_store.append({
        "type": doc_type,
        "title": title,
        "content": content,
        "period": period,
        "related_ref": related_ref,
        "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "saved_by": st.session_state.get("current_user", "Finance Team"),
    })


def render_document_store_page():
    st.title("🗄️ Document Store")
    st.caption("Central archive for all invoices, receipts, reconciliations, remittance advices, and management reports — organized chronologically by month.")
    st.divider()

    init_document_store()
    docs = st.session_state.document_store

    if not docs:
        st.info("No documents saved yet. Documents are automatically archived here when you generate invoices, remittance advices, reconciliations, and reports across other modules.")
        return

    col1, col2, col3 = st.columns(3)
    col1.metric("Total Documents", len(docs))
    col2.metric("Document Types", len(set(d["type"] for d in docs)))
    col3.metric("Periods Covered", len(set(d["period"] for d in docs)))

    st.divider()

    # Filters
    col_a, col_b = st.columns(2)
    with col_a:
        type_filter = st.selectbox("Filter by Type", ["All"] + sorted(set(d["type"] for d in docs)))
    with col_b:
        period_filter = st.selectbox("Filter by Period", ["All"] + sorted(set(d["period"] for d in docs), reverse=True))

    filtered = docs
    if type_filter != "All":
        filtered = [d for d in filtered if d["type"] == type_filter]
    if period_filter != "All":
        filtered = [d for d in filtered if d["period"] == period_filter]

    st.divider()
    st.subheader(f"📋 Documents ({len(filtered)})")

    # Group by period
    periods = sorted(set(d["period"] for d in filtered), reverse=True)
    for period in periods:
        period_docs = [d for d in filtered if d["period"] == period]
        with st.expander(f"📅 {period} ({len(period_docs)} documents)", expanded=True):
            for doc in period_docs:
                icon_map = {
                    "Invoice": "📄", "Remittance Advice": "📋", "Reconciliation": "🔄",
                    "Management Report": "📊", "Receipt": "💰", "Financial Statement": "📑"
                }
                icon = icon_map.get(doc["type"], "📁")
                col1, col2, col3 = st.columns([3, 1, 1])
                col1.write(f"{icon} **{doc['title']}** ({doc['type']})")
                col2.caption(f"By {doc['saved_by']}")
                col3.caption(doc["saved_at"])

                with st.expander("View content", expanded=False):
                    st.text(doc["content"][:2000])
                    st.download_button(
                        "⬇️ Download",
                        doc["content"].encode(),
                        f"{doc['title'].replace(' ','_')}.txt",
                        "text/plain",
                        key=f"dl_{doc['saved_at']}_{doc['title']}"
                    )
