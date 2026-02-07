from india_compliance.gst_india.utils.processor import process_gstr1_excel
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables, generate_gstr1_json
from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
from india_compliance.gst_india.exporters.gstr3b_excel import generate_gstr3b_excel
import json

# Load raw Excel
file_path = "GSTR-1_Dec-2025.xlsx"
result = process_gstr1_excel(file_path)

# Extract clean_data and errors from the result dict
clean_data = result.get("clean_data", [])
errors = result.get("errors", [])

print(f"\n[OK] Processed {len(clean_data)} clean invoices, {len(errors)} errors\n")

if errors:
    print("Validation errors found:")
    for error in errors[:5]:  # Show first 5 errors
        print(f"  Row {error.get('row', 'N/A')}: {error.get('errors', [])}")
    if len(errors) > 5:
        print(f"  ... and {len(errors) - 5} more errors")

# Generate GSTR-1 JSON (pass clean_data instead of gstr1_tables)
json_output = generate_gstr1_json(
    clean_data,
    company_gstin="27AAAAA1234A1ZA",
    return_period="122025",
    gstin="27AAAAA1234A1ZA",
    username="ABC Pvt Ltd"
)
with open("gstr1_122025.json", "w") as f:
    json.dump(json_output, f, indent=2)
print("[OK] GSTR-1 JSON exported as gstr1_122025.json")

# Generate GSTR-3B Summary
gstr3b = generate_gstr3b_summary(
    json_output,  # Pass the GSTR-1 JSON output
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
else:
    # Placeholder returns filename string
    with open("gstr3b_122025.txt", "w") as f:
        f.write(excel_content)
print(f"[OK] GSTR-3B output exported (format: {'binary' if isinstance(excel_content, bytes) else 'text'})")

print("\n[SUCCESS] All processing completed successfully!")
