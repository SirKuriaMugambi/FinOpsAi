"""
Payroll Summary Module
Monthly payroll processing summary for Chrysal International Africa.
Calculates PAYE, NSSF, NHIF, NITA deductions and net pay.
Generates payroll journal for posting to AX and statutory filing summary.
"""

import streamlit as st
import pandas as pd
import io
from utils.currency import format_currency
from utils.audit_trail import log_action, AuditAction


# Kenya statutory rates (2026)
PAYE_BANDS = [
    (24000, 0.10),
    (8333, 0.25),
    (467667, 0.30),
    (float('inf'), 0.35),
]
NSSF_EMPLOYEE = 2160      # Tier I + II employee contribution (approx)
NSSF_EMPLOYER = 2160      # Employer match
NHIF_RATES = {
    range(0, 5999): 150, range(6000, 7999): 300, range(8000, 11999): 400,
    range(12000, 14999): 500, range(15000, 19999): 600, range(20000, 24999): 750,
    range(25000, 29999): 850, range(30000, 34999): 900, range(35000, 39999): 950,
    range(40000, 44999): 1000, range(45000, 49999): 1100, range(50000, 59999): 1200,
    range(60000, 69999): 1300, range(70000, 79999): 1400, range(80000, 89999): 1500,
    range(90000, 99999): 1600, range(100000, 10000000): 1700,
}
NITA_RATE = 50  # Fixed monthly


def calculate_paye(gross: float, personal_relief: float = 2400) -> float:
    tax = 0
    remaining = gross
    for band, rate in PAYE_BANDS:
        if remaining <= 0:
            break
        taxable = min(remaining, band)
        tax += taxable * rate
        remaining -= taxable
    return max(0, tax - personal_relief)


def get_nhif(gross: float) -> float:
    for r, amount in NHIF_RATES.items():
        if int(gross) in r:
            return amount
    return 1700


SAMPLE_EMPLOYEES = [
    {"id": "EMP001", "name": "Mercy W.", "department": "Finance", "cc": "121", "gross": 85000},
    {"id": "EMP002", "name": "Harrison K.", "department": "Production", "cc": "511", "gross": 72000},
    {"id": "EMP003", "name": "Finance Staff 1", "department": "Finance", "cc": "121", "gross": 55000},
    {"id": "EMP004", "name": "CS Officer", "department": "Customer Service", "cc": "208", "gross": 48000},
    {"id": "EMP005", "name": "TC Coordinator", "department": "Technical", "cc": "206", "gross": 65000},
]


def render_payroll_page():
    st.title("👥 Payroll Summary")
    st.caption("Monthly payroll processing — calculates PAYE, NSSF, NHIF, NITA and net pay. Generates AX posting journal and KRA statutory filing summary.")
    st.divider()

    current_user = st.session_state.get("current_user", "Finance Team")
    period = st.selectbox("Payroll Period", ["June 2026", "May 2026", "April 2026"])

    tab1, tab2 = st.tabs(["👥 Employee Payroll", "📋 Statutory Summary"])

    with tab1:
        st.subheader("Employee Payroll Computation")
        use_sample = st.checkbox("Use sample employee data", value=True)

        if use_sample:
            employees = SAMPLE_EMPLOYEES.copy()
        else:
            st.info("Upload employee list with columns: id, name, department, cc, gross")
            pay_file = st.file_uploader("Upload payroll data", type=["xlsx","csv"])
            employees = []
            if pay_file:
                df = pd.read_excel(pay_file) if pay_file.name.endswith(("xlsx","xls")) else pd.read_csv(pay_file)
                employees = df.to_dict("records")

        if employees:
            rows = []
            for emp in employees:
                gross = float(emp["gross"])
                paye = round(calculate_paye(gross), 2)
                nssf_emp = NSSF_EMPLOYEE
                nhif = get_nhif(gross)
                nita = NITA_RATE
                total_deductions = paye + nssf_emp + nhif + nita
                net_pay = gross - total_deductions
                nssf_employer = NSSF_EMPLOYER

                rows.append({
                    "ID": emp["id"],
                    "Name": emp["name"],
                    "Department": emp["department"],
                    "CC": emp["cc"],
                    "Gross (KES)": gross,
                    "PAYE (KES)": paye,
                    "NSSF Employee": nssf_emp,
                    "NHIF": nhif,
                    "NITA": nita,
                    "Total Deductions": total_deductions,
                    "Net Pay (KES)": net_pay,
                    "NSSF Employer": nssf_employer,
                })

            df_payroll = pd.DataFrame(rows)
            st.dataframe(df_payroll, use_container_width=True)

            # Totals
            st.divider()
            col1, col2, col3, col4, col5 = st.columns(5)
            col1.metric("Total Gross", format_currency(df_payroll["Gross (KES)"].sum()))
            col2.metric("Total PAYE", format_currency(df_payroll["PAYE (KES)"].sum()))
            col3.metric("Total NSSF (Employee)", format_currency(df_payroll["NSSF Employee"].sum()))
            col4.metric("Total Net Pay", format_currency(df_payroll["Net Pay (KES)"].sum()))
            col5.metric("NSSF Employer Cost", format_currency(df_payroll["NSSF Employer"].sum()))

            # AX Journal
            st.subheader("📋 AX Payroll Posting Journal")
            journal_rows = []
            for _, row in df_payroll.iterrows():
                journal_rows.append({"Ledger": "6000", "CC": row["CC"], "Description": f"Gross Salary — {row['Name']}", "Debit": row["Gross (KES)"], "Credit": 0})
                journal_rows.append({"Ledger": "2300", "CC": row["CC"], "Description": f"Net Pay Payable — {row['Name']}", "Debit": 0, "Credit": row["Net Pay (KES)"]})
                journal_rows.append({"Ledger": "2100", "CC": "121", "Description": f"PAYE Payable — {row['Name']}", "Debit": 0, "Credit": row["PAYE (KES)"]})

            journal_df = pd.DataFrame(journal_rows)
            st.dataframe(journal_df, use_container_width=True)

            output = io.BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df_payroll.to_excel(writer, sheet_name="Payroll", index=False)
                journal_df.to_excel(writer, sheet_name="AX Journal", index=False)
            st.download_button("⬇️ Download Payroll Excel",
                              output.getvalue(),
                              f"Payroll_{period.replace(' ','_')}.xlsx",
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

            log_action(current_user, "PAYROLL PROCESSED", period,
                      f"Payroll computed for {len(rows)} employees — Total gross KES {df_payroll['Gross (KES)'].sum():,.0f}")

    with tab2:
        st.subheader("Statutory Filing Summary")
        if 'df_payroll' in dir():
            col1, col2 = st.columns(2)
            with col1:
                st.markdown("**KRA — PAYE (iTax)**")
                st.metric("Total PAYE Due", format_currency(df_payroll["PAYE (KES)"].sum()))
                st.caption("File via KRA iTax by 9th of following month")
                st.markdown("**NITA**")
                st.metric("Total NITA Due", format_currency(df_payroll["NITA"].sum()))
                st.caption("File via NITA portal monthly")
            with col2:
                st.markdown("**NSSF**")
                st.metric("Employee Contributions", format_currency(df_payroll["NSSF Employee"].sum()))
                st.metric("Employer Contributions", format_currency(df_payroll["NSSF Employer"].sum()))
                st.metric("Total NSSF", format_currency(df_payroll["NSSF Employee"].sum() + df_payroll["NSSF Employer"].sum()))
                st.caption("File via NSSF portal by 9th of following month")
                st.markdown("**NHIF**")
                st.metric("Total NHIF", format_currency(df_payroll["NHIF"].sum()))
                st.caption("File via NHIF portal by 9th of following month")
        else:
            st.info("Run payroll computation in the Employee Payroll tab first.")
