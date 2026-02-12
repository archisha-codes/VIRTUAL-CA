#!/usr/bin/env python
import sys
sys.stderr.write('Starting debug test...\n')
sys.stderr.flush()

from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import get_invoice_category, generate_gstr1_tables
import pandas as pd

test_data = [
    {'Tax ID': '27ABCDE1234F1Z5', 'Ref No': 'INV-001', 'Date': '01/12/2025', 'Customer Name': 'ABC Corp', 'Business No': '27XYZCorp1234A1Z9', 'POS': '27-Maharashtra', 'Total Value': 59000, 'Taxable Val': 50000, 'Rate %': 18, 'JOI': 9000, 'CGST': 0, 'SGST': 0, 'Cess': 0, 'HSN Code': '85171300', 'Qty': 100, 'UOM': 'NOS', 'Supply Type': 'Inter-State', 'Reverse Charge': 'N', 'Doc Type': 'Invoice'},
    {'Tax ID': '', 'Ref No': 'CN-001', 'Date': '05/12/2025', 'Customer Name': 'Credit Note Customer', 'Business No': '29PQRST5678F2Z4', 'POS': '29-Karnataka', 'Total Value': -11800, 'Taxable Val': -10000, 'Rate %': 18, 'JOI': -1800, 'CGST': 0, 'SGST': 0, 'Cess': 0, 'HSN Code': '85171400', 'Qty': -10, 'UOM': 'NOS', 'Supply Type': 'Inter-State', 'Reverse Charge': 'N', 'Doc Type': 'Credit Note'},
]

mapper = get_mapper()
df, _ = normalize_dataframe_simple(pd.DataFrame(test_data))

sys.stderr.write("\n=== Row 1 (Invoice) ===\n")
row1 = df.iloc[0].to_dict()
for k, v in row1.items():
    sys.stderr.write(f"  {k}: {v}\n")
sys.stderr.flush()

sys.stderr.write("\n=== Row 2 (Credit Note) ===\n")
row2 = df.iloc[1].to_dict()
for k, v in row2.items():
    sys.stderr.write(f"  {k}: {v}\n")
sys.stderr.flush()

sys.stderr.write("\n=== Testing get_invoice_category for Row 2 ===\n")
cat, sub = get_invoice_category(row2)
sys.stderr.write(f"  Category: {cat}\n")
sys.stderr.write(f"  Sub: {sub}\n")
sys.stderr.flush()

sys.stderr.write("\n=== Generating GSTR-1 tables ===\n")
gstr1_tables = generate_gstr1_tables(df.to_dict('records'), company_gstin="27AAAAA1234A1ZA")
sys.stderr.write(f"  B2B entries: {len(gstr1_tables.get('b2b', []))}\n")
sys.stderr.write(f"  CDNR entries: {len(gstr1_tables.get('cdnr', []))}\n")
sys.stderr.write(f"  CDNR data: {gstr1_tables.get('cdnr', [])}\n")
sys.stderr.flush()

print('DONE')
