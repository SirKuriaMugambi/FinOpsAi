import io, sys, traceback

output_lines = []

try:
    import msoffcrypto, openpyxl

    excel_path = r'C:\Users\user\Documents\Coding\FinancialOperations\chrysal-finops-ai\reference-data\CA- AI Payroll automation project.xlsx'
    password = '8489'

    output_lines.append("Starting script...")

    decrypted_stream = io.BytesIO()
    with open(excel_path, 'rb') as f:
        office_file = msoffcrypto.OfficeFile(f)
        office_file.load_key(password=password)
        office_file.decrypt(decrypted_stream)
    decrypted_stream.seek(0)

    output_lines.append("Decrypted successfully, loading workbook...")

    wb = openpyxl.load_workbook(decrypted_stream, data_only=True)

    output_lines.append(f"Sheet names: {wb.sheetnames}")

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        output_lines.append("=" * 100)
        output_lines.append(f"SHEET: {sheet_name}")
        output_lines.append(f"Max rows: {ws.max_row}, Max cols: {ws.max_column}")
        output_lines.append("=" * 100)
        for r in range(1, ws.max_row + 1):
            row = [(c, ws.cell(r, c).value) for c in range(1, ws.max_column + 1) if ws.cell(r, c).value is not None]
            if row:
                output_lines.append(f"R{r:3d}: {row[:30]}")
        output_lines.append("\n\n")

except Exception as e:
    output_lines.append("ERROR OCCURRED:")
    output_lines.append(traceback.format_exc())

with open("full_dump.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(output_lines))

print("Done. Check full_dump.txt")
