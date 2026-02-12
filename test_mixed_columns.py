"""
Test file with mixed column names, header in row 4, and various column name variations.
"""
from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
import pandas as pd

# Create test data with various column name variations
# Header is in row 4 (rows 1-3 are empty/blanks)
test_data = [
    # Row 1-3: Empty/blank rows (should be skipped)
    {},
    {},
    {},
    # Row 4: Headers (GSTN, JOI instead of IGST, Business No for GSTIN, Ref No for Invoice)
    {
        'Tax ID': '27ABCDE1234F1Z5',  # GSTIN = Tax ID
        'Ref No': 'INV-001',          # Invoice Number = Ref No
        'Date': '01/12/2025',         # Invoice Date = Date
        'Customer Name': 'ABC Corp',  # Customer Name
        'Business No': '27XYZCorp1234A1Z9',  # GSTIN = Business No
        'POS': '27-Maharashtra',       # Place of Supply
        'Total Value': 59000,          # Invoice Value
        'Taxable Val': 50000,          # Taxable Value
        'Rate %': 18,                  # Rate
        'JOI': 9000,                   # IGST = JOI
        'CGST': 0,                     # CGST
        'SGST': 0,                     # SGST
        'Cess': 0,                     # Cess
        'HSN Code': '85171300',        # HSN Code
        'Qty': 100,                    # Quantity
        'UOM': 'NOS',                  # UOM
        'Supply Type': 'Inter-State',  # Supply Type
        'Reverse Charge': 'N',          # Reverse Charge
        'Doc Type': 'Invoice',          # Document Type
    },
    # B2CL: No GSTIN, inter-state, value > 2.5L
    {
        'Tax ID': '',
        'Ref No': 'INV-002',
        'Date': '02/12/2025',
        'Customer Name': 'Delhi Customer',
        'Business No': '',
        'POS': '07-Delhi',  # Inter-state from Maharashtra (27)
        'Total Value': 300000,  # > 2.5L
        'Taxable Val': 254237,
        'Rate %': 18,
        'JOI': 45763,
        'CGST': 0,
        'SGST': 0,
        'Cess': 0,
        'HSN Code': '85177090',
        'Qty': 50,
        'UOM': 'NOS',
        'Supply Type': 'Inter-State',
        'Reverse Charge': 'N',
        'Doc Type': 'Invoice',
    },
    # B2CS: No GSTIN, intra-state, value < 2.5L
    {
        'Tax ID': '',
        'Ref No': 'INV-003',
        'Date': '03/12/2025',
        'Customer Name': 'Local Customer',
        'Business No': '',
        'POS': '27-Maharashtra',  # Intra-state (same as company)
        'Total Value': 5000,
        'Taxable Val': 4237,
        'Rate %': 18,
        'JOI': 0,
        'CGST': 382,
        'SGST': 382,
        'Cess': 0,
        'HSN Code': '84713010',
        'Qty': 10,
        'UOM': 'NOS',
        'Supply Type': 'Intra-State',
        'Reverse Charge': 'N',
        'Doc Type': 'Invoice',
    },
    # EXPORT: Export transaction (POS = 96)
    {
        'Tax ID': '',
        'Ref No': 'EXP-001',
        'Date': '04/12/2025',
        'Customer Name': 'Overseas Buyer',
        'Business No': '',
        'POS': '96-Overseas',  # Export
        'Total Value': 100000,
        'Taxable Val': 84746,
        'Rate %': 18,
        'JOI': 15254,
        'CGST': 0,
        'SGST': 0,
        'Cess': 0,
        'HSN Code': '30049079',
        'Qty': 1000,
        'UOM': 'NOS',
        'Supply Type': 'Export',
        'Reverse Charge': 'N',
        'Doc Type': 'Invoice',
    },
    # CDNR: Credit Note with GSTIN
    {
        'Tax ID': '29PQRST5678F2Z4',
        'Ref No': 'CN-001',
        'Date': '05/12/2025',
        'Customer Name': 'Credit Note Customer',
        'Business No': '29PQRST5678F2Z4',
        'POS': '29-Karnataka',
        'Total Value': -11800,
        'Taxable Val': -10000,
        'Rate %': 18,
        'JOI': -1800,
        'CGST': 0,
        'SGST': 0,
        'Cess': 0,
        'HSN Code': '85171400',
        'Qty': -10,
        'UOM': 'NOS',
        'Supply Type': 'Inter-State',
        'Reverse Charge': 'N',
        'Doc Type': 'Credit Note',  # Credit Note
    },
    # CDNR: Debit Note with GSTIN
    {
        'Tax ID': '18LMNOP9012G3Z7',
        'Ref No': 'DN-001',
        'Date': '06/12/2025',
        'Customer Name': 'Debit Note Customer',
        'Business No': '18LMNOP9012G3Z7',
        'POS': '18-Assam',
        'Total Value': 23600,
        'Taxable Val': 20000,
        'Rate %': 18,
        'JOI': 3600,
        'CGST': 0,
        'SGST': 0,
        'Cess': 0,
        'HSN Code': '84716020',
        'Qty': 5,
        'UOM': 'NOS',
        'Supply Type': 'Inter-State',
        'Reverse Charge': 'N',
        'Doc Type': 'Debit Note',  # Debit Note
    },
    # B2B RCM: Reverse Charge
    {
        'Tax ID': '07DEFGH3456I1Z8',
        'Ref No': 'INV-RCM-001',
        'Date': '07/12/2025',
        'Customer Name': 'RCM Customer',
        'Business No': '07DEFGH3456I1Z8',
        'POS': '07-Delhi',
        'Total Value': 11800,
        'Taxable Val': 10000,
        'Rate %': 18,
        'JOI': 1800,
        'CGST': 0,
        'SGST': 0,
        'Cess': 0,
        'HSN Code': '85171800',
        'Qty': 1,
        'UOM': 'NOS',
        'Supply Type': 'Inter-State',
        'Reverse Charge': 'Y',  # RCM
        'Doc Type': 'Invoice',
    },
]

# Create DataFrame with header in row 4 (index 3)
# First 3 rows are empty, row 4 (index 3) is header
df = pd.DataFrame(test_data[4:], index=range(4, 4 + len(test_data) - 4))

# Insert empty rows at top
df_with_header = pd.DataFrame(test_data)

print("=" * 80)
print("TESTING MIXED COLUMN NAMES AND VARIATIONS")
print("=" * 80)

print("\nOriginal Columns (with variations):")
print(df_with_header.columns.tolist())

# Use the header mapper to normalize
mapper = get_mapper()
df_normalized, mapping = normalize_dataframe_simple(df_with_header)

print("\n" + "-" * 80)
print("Column Mapping Applied:")
print("-" * 80)
for orig, canonical in mapping.items():
    print(f"  {orig:25} -> {canonical}")

print("\n" + "-" * 80)
print("Normalized Columns (with classification):")
print("-" * 80)
print(df_normalized.columns.tolist())

print("\n" + "-" * 80)
print("Transaction Classification Results:")
print("-" * 80)
for idx, row in df_normalized.iterrows():
    print(f"\nRow {idx + 1}:")
    print(f"  Transaction Type: {row.get('transaction_type', 'N/A')}")
    print(f"  GSTIN: {row.get('gstin', 'N/A')[:10] if row.get('gstin') else 'N/A'}...")
    print(f"  Invoice Value: {row.get('invoice_value', 0):,.2f}")
    print(f"  Is Credit Note: {row.get('is_credit_note', False)}")
    print(f"  Is Debit Note: {row.get('is_debit_note', False)}")
    print(f"  Is RCM: {row.get('is_rcm', False)}")
    print(f"  Is Export: {row.get('is_export', False)}")

print("\n" + "-" * 80)
print("GSTR-1 Table Generation:")
print("-" * 80)

# Generate GSTR-1 tables
# Note: generate_gstr1_tables returns (tables, validation_report) tuple
company_gstin = "27AAAAA1234A1ZA"  # Maharashtra company
gstr1_tables, validation_report = generate_gstr1_tables(
    df_normalized.to_dict('records'),
    company_gstin=company_gstin,
    include_hsn=True,
    include_docs=False,
    validate=False  # Disable validation for mixed column test
)

# Print validation report info
if validation_report.errors:
    print(f"\nValidation Warnings/Errors:")
    for error in validation_report.errors:
        print(f"  - {error}")

# Print summary
summary = gstr1_tables.get('summary', {})
print(f"\nSummary Totals:")
print(f"  Total Records: {summary.get('total_records', 0)}")
print(f"  Total Taxable Value: {summary.get('total_taxable_value', 0):,.2f}")
print(f"  Total IGST: {summary.get('total_igst', 0):,.2f}")
print(f"  Total CGST: {summary.get('total_cgst', 0):,.2f}")
print(f"  Total SGST: {summary.get('total_sgst', 0):,.2f}")
print(f"  Total CESS: {summary.get('total_cess', 0):,.2f}")

# Print B2B count
b2b_count = len(gstr1_tables.get('b2b', []))
print(f"\n  B2B Entries: {b2b_count}")

# Print B2CL count
b2cl_count = len(gstr1_tables.get('b2cl', []))
print(f"  B2CL Entries: {b2cl_count}")

# Print B2CS count
b2cs_count = len(gstr1_tables.get('b2cs', []))
print(f"  B2CS Entries: {b2cs_count}")

# Print EXP count
exp_count = len(gstr1_tables.get('exp', []))
print(f"  EXP Entries: {exp_count}")

# Print CDNR count
cdnr_count = len(gstr1_tables.get('cdnr', []))
print(f"  CDNR Entries: {cdnr_count}")

# Print HSN count
hsn_count = len(gstr1_tables.get('hsn', []))
print(f"  HSN Summary Records: {hsn_count}")

print("\n" + "-" * 80)
print("Detailed GSTR-1 Tables:")
print("-" * 80)

print("\nB2B Invoices:")
for entry in gstr1_tables.get('b2b', []):
    print(f"  CTIN: {entry.get('ctin', 'N/A')[:10]}...")
    for inv in entry.get('invoices', []):
        print(f"    Invoice: {inv.get('inum', 'N/A')} | Value: {inv.get('val', 0):,.2f}")

print("\nB2CL Invoices:")
for inv in gstr1_tables.get('b2cl', []):
    print(f"  Invoice: {inv.get('inum', 'N/A')} | POS: {inv.get('pos', 'N/A')} | Value: {inv.get('val', 0):,.2f}")

print("\nB2CS Invoices:")
for inv in gstr1_tables.get('b2cs', []):
    print(f"  POS: {inv.get('pos', 'N/A')} | Rate: {inv.get('rt', 0)}% | Taxable: {inv.get('txval', 0):,.2f}")

print("\nExport Invoices:")
for inv in gstr1_tables.get('exp', []):
    print(f"  Invoice: {inv.get('inum', 'N/A')} | Value: {inv.get('val', 0):,.2f}")

print("\nCDNR (Credit/Debit Notes - Registered):")
for entry in gstr1_tables.get('cdnr', []):
    print(f"  CTIN: {entry.get('ctin', 'N/A')[:10]}...")
    for note in entry.get('notes', []):
        print(f"    Note: {note.get('nt_num', 'N/A')} | Type: {note.get('nt_ty', 'N/A')} | Value: {note.get('val', 0):,.2f}")

print("\nHSN Summary:")
for hsn in gstr1_tables.get('hsn', []):
    print(f"  HSN: {hsn.get('hsn_sc', 'N/A')} | Qty: {hsn.get('qty', 0):,.2f} | Taxable: {hsn.get('txval', 0):,.2f}")

print("\n" + "=" * 80)
print("TEST COMPLETED SUCCESSFULLY")
print("=" * 80)
