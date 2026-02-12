import pandas as pd
from india_compliance.gst_india.utils.header_mapper import get_mapper, normalize_dataframe_simple
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables

df = pd.read_excel('Demo_Client_Sales_Data.xlsx', sheet_name=None)
sheet_name = list(df.keys())[0]
df_sheet = df[sheet_name]

mapper = get_mapper()
df_normalized, mapping = normalize_dataframe_simple(df_sheet)
clean_data = df_normalized.to_dict('records')

gstr1_tables, report = generate_gstr1_tables(
    clean_data,
    company_gstin='27AAAAA1234A1ZA',
    include_hsn=True,
    include_docs=False
)

# Check B2B structure
b2b = gstr1_tables.get('b2b', [])
if b2b:
    first_entity = b2b[0]
    print('First B2B entity keys:', list(first_entity.keys()))
    if first_entity.get('invoices'):
        first_inv = first_entity['invoices'][0]
        print('First invoice keys:', list(first_inv.keys()))
        print('Has "items"?', 'items' in first_inv)
        print('Has "itms"?', 'itms' in first_inv)
        if 'items' in first_inv:
            print('Items length:', len(first_inv['items']))
        elif 'itms' in first_inv:
            print('Itms length:', len(first_inv['itms']))
            if first_inv['itms']:
                print('First itms item keys:', list(first_inv['itms'][0].keys()))
                print('Has itm_det?', 'itm_det' in first_inv['itms'][0])
