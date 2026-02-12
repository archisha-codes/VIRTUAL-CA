import pandas as pd
import sys
from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables

# Load and process data
df = pd.read_excel('Demo_Client_Sales_Data.xlsx', sheet_name=None)
sheet_name = list(df.keys())[0]
df_sheet = df[sheet_name]

mapper = get_mapper()
df_normalized, mapping = normalize_dataframe_simple(df_sheet)
clean_data = df_normalized.to_dict('records')

print(f'Loaded {len(clean_data)} invoices')
print(f'Columns: {df_normalized.columns.tolist()}')

# Generate tables
gstr1_tables, report = generate_gstr1_tables(
    clean_data,
    company_gstin='27AAAAA1234A1ZA',
    include_hsn=True,
    include_docs=False
)

# Debug: Print table counts
print(f'B2B={len(gstr1_tables.get("b2b", []))}')
print(f'B2CL={len(gstr1_tables.get("b2cl", []))}')
print(f'B2CS={len(gstr1_tables.get("b2cs", []))}')
print(f'EXP={len(gstr1_tables.get("exp", []))}')
print(f'CDNR={len(gstr1_tables.get("cdnr", []))}')
print(f'HSN={len(gstr1_tables.get("hsn", []))}')

# Show B2B details
for i, b2b in enumerate(gstr1_tables.get('b2b', [])):
    print(f'B2B Entity {i+1}: CTIN={b2b.get("ctin")}, Invoices={len(b2b.get("invoices", []))}')
    for inv in b2b.get('invoices', [])[:2]:
        print(f'  Invoice: {inv.get("inum")}, Items={len(inv.get("items", []))}')
