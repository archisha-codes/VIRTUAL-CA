"""Test script for GSTR-1 Excel processor."""

from india_compliance.gst_india.utils.gstr_1.processor import process_gstr1_excel
import json
from datetime import datetime

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime objects."""
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        return super().default(obj)

def convert_dates_to_strings(obj):
    """Recursively convert datetime objects to strings."""
    if isinstance(obj, dict):
        return {k: convert_dates_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates_to_strings(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.strftime("%Y-%m-%d %H:%M:%S")
    return obj

# Read test file
with open('test_gstr1_data.xlsx', 'rb') as f:
    content = f.read()

print(f'File size: {len(content)} bytes')

try:
    result = process_gstr1_excel(content, '07BZAAH6384P1ZH')
    print('=== Classification Results ===')
    print(f'B2B: {len(result["b2b"])} invoices')
    print(f'B2CL: {len(result["b2cl"])} invoices')
    print(f'B2CS: {len(result["b2cs"])} invoices')
    print(f'EXP: {len(result["export"])} invoices')
    print(f'Total: {result["summary"]["total_invoices"]} invoices')
    print()
    print('=== Summary ===')
    print(json.dumps(result['summary'], indent=2))
    print()
    
    # Convert datetime objects for JSON serialization
    result_clean = convert_dates_to_strings(result)
    
    print('=== Sample B2B Invoice ===')
    if result_clean['b2b']:
        print(json.dumps(result_clean['b2b'][0], indent=2))
    print()
    print('=== Sample B2CL Invoice ===')
    if result_clean['b2cl']:
        print(json.dumps(result_clean['b2cl'][0], indent=2))
    print()
    print('=== Sample B2CS Invoice ===')
    if result_clean['b2cs']:
        print(json.dumps(result_clean['b2cs'][0], indent=2))
    print()
    print('=== Sample EXP Invoice ===')
    if result_clean['export']:
        print(json.dumps(result_clean['export'][0], indent=2))
    print()
    print('=== Validation Summary ===')
    print(f'Total Errors: {result["validation_summary"]["total_errors"]}')
    print(f'Total Warnings: {result["validation_summary"]["total_warnings"]}')
    
    if result["validation_summary"]["errors"]:
        print('\n=== Errors ===')
        for err in result["validation_summary"]["errors"][:5]:
            print(json.dumps(err, indent=2))
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
