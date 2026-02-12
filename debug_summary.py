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

# Show sample data with tax values
print("=" * 80)
print("SAMPLE DATA WITH TAX VALUES")
print("=" * 80)
for i, row in enumerate(clean_data[:15]):
    print(f"\nRow {i+1}:")
    print(f"  Invoice: {row.get('invoice_number', 'N/A')}")
    print(f"  GSTIN: {row.get('gstin', 'N/A')}")
    print(f"  Taxable: {row.get('taxable_value', 0)}")
    print(f"  IGST: {row.get('igst', 0)}")
    print(f"  CGST: {row.get('cgst', 0)}")
    print(f"  SGST: {row.get('sgst', 0)}")

print("\n" + "=" * 80)
print("SUMMING DIRECTLY FROM CLEAN_DATA")
print("=" * 80)
total_taxable = sum(row.get('taxable_value', 0) for row in clean_data)
total_igst = sum(row.get('igst', 0) for row in clean_data)
total_cgst = sum(row.get('cgst', 0) for row in clean_data)
total_sgst = sum(row.get('sgst', 0) for row in clean_data)

print(f"Direct Sum - Taxable: {total_taxable:.2f}")
print(f"Direct Sum - IGST: {total_igst:.2f}")
print(f"Direct Sum - CGST: {total_cgst:.2f}")
print(f"Direct Sum - SGST: {total_sgst:.2f}")

# Generate GSTR-1 tables
gstr1_tables, validation_report = generate_gstr1_tables(
    clean_data,
    company_gstin="27AAAAA1234A1ZA",
    include_hsn=True,
    include_docs=False
)

print("\n" + "=" * 80)
print("GSTR-1 SUMMARY")
print("=" * 80)
summary = gstr1_tables.get("summary", {})
print(f"Summary Taxable: {summary.get('total_taxable_value', 0):.2f}")
print(f"Summary IGST: {summary.get('total_igst', 0):.2f}")
print(f"Summary CGST: {summary.get('total_cgst', 0):.2f}")
print(f"Summary SGST: {summary.get('total_sgst', 0):.2f}")

print("\n" + "=" * 80)
print("CALCULATED FROM TABLES")
print("=" * 80)
calculated = calculate_totals_from_tables(gstr1_tables)
print(f"Table Taxable: {calculated['taxable_value']:.2f}")
print(f"Table IGST: {calculated['igst']:.2f}")
print(f"Table CGST: {calculated['cgst']:.2f}")
print(f"Table SGST: {calculated['sgst']:.2f}")

print("\n" + "=" * 80)
print("B2B TABLE DETAILS")
print("=" * 80)
for customer in gstr1_tables.get("b2b", []):
    print(f"\nCustomer: {customer.get('ctin', 'N/A')}")
    for invoice in customer.get("invoices", []):
        print(f"  Invoice: {invoice.get('inum', 'N/A')}")
        for item in invoice.get("itms", []):
            print(f"    Item - txval: {item.get('txval', 0):.2f}, igst: {item.get('iamt', 0):.2f}, cgst: {item.get('camt', 0):.2f}, sgst: {item.get('samt', 0):.2f}")

print("\n" + "=" * 80)
print("B2CS TABLE DETAILS")
print("=" * 80)
for entry in gstr1_tables.get("b2cs", []):
    print(f"  Entry - pos: {entry.get('pos', 'N/A')}, rate: {entry.get('rt', 0):.2f}, txval: {entry.get('txval', 0):.2f}, igst: {entry.get('iamt', 0):.2f}")

print("\n" + "=" * 80)
print("CDNR TABLE DETAILS")
print("=" * 80)
for customer in gstr1_tables.get("cdnr", []):
    print(f"\nCustomer: {customer.get('ctin', 'N/A')}")
    for note in customer.get("notes", []):
        print(f"  Note: {note.get('nt_num', 'N/A')}")
        for item in note.get("itms", []):
            print(f"    Item - txval: {item.get('txval', 0):.2f}, igst: {item.get('iamt', 0):.2f}, cgst: {item.get('camt', 0):.2f}, sgst: {item.get('samt', 0):.2f}")

print("\n" + "=" * 80)
print("VALIDATION RESULT")
print("=" * 80)
if validation_report.errors:
    print("ERRORS:")
    for error in validation_report.errors:
        print(f"  - {error}")
else:
    print("No errors found!")
