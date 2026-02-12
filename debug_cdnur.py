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

# Check CDNUR structure
cdnur = gstr1_tables.get('cdnur', [])
print('CDNUR entries:', len(cdnur))
if cdnur:
    first = cdnur[0]
    print('CDNUR entry keys:', list(first.keys()))
    print('Has ntty?', 'ntty' in first)
    print('Has nt_ty?', 'nt_ty' in first)

# Check CDNR structure
cdnr = gstr1_tables.get('cdnr', [])
print()
print('CDNR entities:', len(cdnr))
if cdnr:
    first_entity = cdnr[0]
    print('CDNR entity keys:', list(first_entity.keys()))
    if first_entity.get('notes'):
        first_note = first_entity['notes'][0]
        print('Note keys:', list(first_note.keys()))
        print('Has ntty?', 'ntty' in first_note)
        print('Has nt_ty?', 'nt_ty' in first_note)
        if first_note.get('itms'):
            print('Itms found')
        if first_note.get('items'):
            print('Items found')
