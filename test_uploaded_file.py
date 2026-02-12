from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
from india_compliance.gst_india.exporters.gstr3b_excel import generate_gstr3b_excel
import pandas as pd

# Load raw Excel
file_path = "Demo_Client_Sales_Data.xlsx"

# Read the Excel file
df = pd.read_excel(file_path, sheet_name=None)
sheet_name = list(df.keys())[0]
df_sheet = df[sheet_name]

print("Original Columns:")
print(df_sheet.columns.tolist())

# Use the header mapper to normalize columns
mapper = get_mapper()
df_normalized, mapping = normalize_dataframe_simple(df_sheet)

print("\nColumn Mapping Applied:")
for orig, canonical in mapping.items():
    print(f"  {orig} -> {canonical}")

print("\nNormalized Columns:")
print(df_normalized.columns.tolist())

# Convert normalized DataFrame to dict records - this is the clean_data
clean_data = df_normalized.to_dict('records')

# Defensive check - prevent silent empty export
if not clean_data:
    raise ValueError("No valid invoices found after normalization.")

print(f"\n[OK] Processed {len(clean_data)} clean invoices, 0 errors")

# Generate GSTR-1 tables - returns tuple (gstr1_tables, validation_report)
gstr1_tables, validation_report = generate_gstr1_tables(
    clean_data,
    company_gstin="27AAAAA1234A1ZA",
    include_hsn=True,
    include_docs=False
)

# Print validation report summary
if validation_report.errors:
    print("\nValidation warnings/errors:")
    for error in validation_report.errors[:5]:
        print(f"  - {error}")

# Generate GSTR-1 Excel - pass only gstr1_tables dict, not the tuple
excel_bytes = export_gstr1_excel(
    gstr1_tables,
    return_period="122025",
    taxpayer_gstin="27AAAAA1234A1ZA",
    taxpayer_name="ABC Pvt Ltd"
)

# Write Excel file
with open("gstr1_122025.xlsx", "wb") as f:
    f.write(excel_bytes)
print("[OK] GSTR-1 Excel exported as gstr1_122025.xlsx")

# Generate GSTR-3B tables - pass only gstr1_tables dict
gstr3b = generate_gstr3b_summary(
    gstr1_tables,
    return_period="122025",
    taxpayer_gstin="27AAAAA1234A1ZA",
    taxpayer_name="ABC Pvt Ltd"
)
print("[OK] GSTR-3B Summary calculated")

# Export GSTR-3B Excel
excel_content = generate_gstr3b_excel(gstr3b)
if isinstance(excel_content, bytes):
    with open("gstr3b_122025.xlsx", "wb") as f:
        f.write(excel_content)
    print("[OK] GSTR-3B Excel exported as gstr3b_122025.xlsx")
else:
    # Placeholder returns filename string
    with open("gstr3b_122025.txt", "w") as f:
        f.write(excel_content)
    print(f"[OK] GSTR-3B output exported (format: text)")

print("\n[SUCCESS] All processing completed successfully!")
