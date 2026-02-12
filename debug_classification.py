from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables, get_invoice_category, is_inter_state, get_signed_values
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

# Show classification for each row
print("=" * 80)
print("CLASSIFICATION DEBUG")
print("=" * 80)

for i, row in enumerate(clean_data):
    gstin = row.get('gstin', '') or ''
    pos = row.get('place_of_supply', '')
    invoice_value = row.get('invoice_value', 0)
    taxable_value = row.get('taxable_value', 0)
    igst = row.get('igst', 0)
    cgst = row.get('cgst', 0)
    sgst = row.get('sgst', 0)
    invoice_number = row.get('invoice_number', '')
    invoice_type = row.get('invoice_type', '').lower()
    document_type = row.get('document_type', '').lower()
    doc_type_combined = invoice_type + " " + document_type

    is_return = row.get("is_return", False)
    is_debit_note = row.get("is_debit_note", False)

    is_credit_note = is_return or "credit" in doc_type_combined or invoice_type in ["cn", "cr"]
    is_debit_note_type = is_debit_note or "debit" in doc_type_combined or invoice_type in ["dn", "dr"]

    # Check if it's an export
    pos_lower = str(pos).lower()
    is_export = ("96" in pos_lower or "other countries" in pos_lower or
                 "overseas" in pos_lower or row.get("is_export", False))

    # Check inter-state
    inter_state = is_inter_state("27AAAAA1234A1ZA", pos, igst, cgst, sgst)

    # Get category
    category, sub_category = get_invoice_category(row, "27AAAAA1234A1ZA")

    print(f"\nRow {i+1}:")
    print(f"  Invoice: {invoice_number}")
    print(f"  GSTIN: {gstin if gstin else 'None'}")
    print(f"  POS: {pos}")
    print(f"  Value: {invoice_value}")
    print(f"  Taxable: {taxable_value}")
    print(f"  IGST: {igst}, CGST: {cgst}, SGST: {sgst}")
    print(f"  invoice_type: {invoice_type}, document_type: {document_type}")
    print(f"  is_credit_note: {is_credit_note}, is_debit_note: {is_debit_note_type}")
    print(f"  is_export: {is_export}")
    print(f"  inter_state: {inter_state}")
    print(f"  => Category: {category}")
    print(f"  => Sub-Category: {sub_category}")

print("\n" + "=" * 80)
print("GENERATING GSTR-1 TABLES")
print("=" * 80)

gstr1_tables, validation_report = generate_gstr1_tables(
    clean_data,
    company_gstin="27AAAAA1234A1ZA",
    include_hsn=True,
    include_docs=False
)

print("\n" + "=" * 80)
print("B2CL TABLE")
print("=" * 80)
for invoice in gstr1_tables.get("b2cl", []):
    print(f"  Invoice: {invoice.get('inum', 'N/A')}")
    print(f"    POS: {invoice.get('pos', 'N/A')}")
    print(f"    txval: {invoice.get('txval', 0):.2f}")
    print(f"    igst: {invoice.get('iamt', 0):.2f}")
    print(f"    csamt: {invoice.get('csamt', 0):.2f}")

print(f"\nB2CL count: {len(gstr1_tables.get('b2cl', []))}")
