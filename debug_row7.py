from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables, calculate_totals_from_tables
import pandas as pd

# Load raw Excel
file_path = "Demo_Client_Sales_Data.xlsx"

# Read the Excel file
df = pd.read_excel(file_path, sheet_name=None)
sheet_name = list(df.keys())[0]
df_sheet = df[sheet_name]

# Use the header mapper to normalize columns
mapper = get_mapper()
df_normalized, mapping = normalize_dataframe_simple(df_sheet)

# Convert normalized DataFrame to dict records - this is the clean_data
clean_data = df_normalized.to_dict('records')

print("=" * 80)
print("FINAL VALIDATION TEST")
print("=" * 80)

gstr1_tables, validation_report = generate_gstr1_tables(
    clean_data,
    company_gstin="27AAAAA1234A1ZA",
    include_hsn=True,
    include_docs=False
)

print(f"\nSummary CGST: {gstr1_tables['summary'].get('total_cgst', 0)}")
print(f"Table Sum CGST: {calculate_totals_from_tables(gstr1_tables)['cgst']}")

print(f"\nValidation Status: {validation_report.final_status}")
if validation_report.errors:
    print(f"Errors: {validation_report.errors}")
if validation_report.warnings:
    print(f"Warnings: {validation_report.warnings}")

print("\n" + "=" * 80)
print("TEST RESULT: " + ("✅ PASS" if validation_report.is_valid() else "❌ FAIL"))
print("=" * 80)
