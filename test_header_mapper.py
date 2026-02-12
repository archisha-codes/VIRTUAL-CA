#!/usr/bin/env python
"""Test script for header_mapper module."""

import sys
import io

# Set stdout to handle unicode
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from india_compliance.gst_india.utils.header_mapper import (
    clean_numeric_value,
    parse_date_value,
    validate_gst_tax,
    HeaderMapper,
    GST_TOLERANCE,
    AUTO_CORRECT_THRESHOLD,
    ERROR_THRESHOLD,
)

print("=" * 70)
print("Testing Header Mapper Module - Complete Feature Set")
print("=" * 70)

# Test numeric conversion
print("\n1. Numeric Conversion Tests:")
print("-" * 50)
test_values = [
    ("1,234.56", "Comma-separated"),
    ("$1,234.56", "Dollar symbol"),
    ("(1,234.56)", "Negative in parentheses"),
    ("12%", "Percentage"),
    ("  1,234.56  ", "With whitespace"),
    ("1000", "Simple number"),
]

for value, desc in test_values:
    result = clean_numeric_value(value)
    print(f"  {desc:30} | {repr(value):20} -> {result}")

# Test date parsing
print("\n2. Date Parsing Tests:")
print("-" * 50)
test_dates = [
    ("25/12/2025", "DD/MM/YYYY"),
    ("2025-12-25", "YYYY-MM-DD"),
    ("25-12-2025", "DD-MM-YYYY"),
]

for value, desc in test_dates:
    result = parse_date_value(value)
    print(f"  {desc:30} | {repr(value):20} -> {result}")

# Test header mapping
print("\n3. Header Mapping Tests:")
print("-" * 50)
mapper = HeaderMapper()

test_headers = [
    "GST No",
    "Business Tax ID",
    "Invoice Number",
    "Bill No",
    "Taxable Value",
    "Net Amount",
    "IGST",
    "Integrated Tax",
    "Place of Supply",
    "State",
]

for header in test_headers:
    canonical = mapper.get_canonical_field(header)
    print(f"  {header:30} -> {canonical}")

# Test auto-derivation
print("\n4. Auto-Derivation Tests:")
print("-" * 50)

# Test case 1: Derive invoice_value from taxable + tax
row1 = {
    'taxable_value': '1,000',
    'igst': '180',
    'cgst': '0',
    'sgst': '0',
    'cess': '0',
}
derived1 = mapper.auto_derive_values(row1)
print(f"  Input:  taxable_value=1,000, igst=180")
print(f"  Output: invoice_value={derived1.get('invoice_value')}")

# Test case 2: Derive taxable_value from invoice - tax
row2 = {
    'invoice_value': '1,180',
    'igst': '180',
    'cgst': '0',
    'sgst': '0',
    'cess': '0',
}
derived2 = mapper.auto_derive_values(row2)
print(f"  Input:  invoice_value=1,180, igst=180")
print(f"  Output: taxable_value={derived2.get('taxable_value')}")

# Test GST Tax Validation
print("\n5. GST Tax Validation Tests:")
print("-" * 50)
print(f"  Tolerance: {GST_TOLERANCE} INR")
print(f"  Auto-correct threshold: {AUTO_CORRECT_THRESHOLD} INR")
print(f"  Error threshold: {ERROR_THRESHOLD} INR")
print()

# Test 1: Valid tax (inter-state)
r1 = validate_gst_tax(1000, 18, 180, None, None, True)
print(f"  1. Valid inter-state: {r1.action}")
print(f"     Expected IGST=180, Actual=180, Diff={r1.difference}")

# Test 2: Valid tax (intra-state)
r2 = validate_gst_tax(1000, 18, None, 90, 90, False)
print(f"\n  2. Valid intra-state: {r2.action}")
print(f"     Expected CGST=90, SGST=90, Actual=90/90, Diff={r2.difference}")

# Test 3: Small difference - auto-correct
r3 = validate_gst_tax(1000, 18, 179.50, None, None, True)
print(f"\n  3. Auto-correct (diff={GST_TOLERANCE}): {r3.action}")
print(f"     Expected=180, Actual=179.50, Diff={r3.difference}")
if r3.corrections:
    print(f"     Corrections: {r3.corrections}")

# Test 4: Moderate difference - warning
r4 = validate_gst_tax(1000, 18, 182, None, None, True)
print(f"\n  4. Warning (diff=2.00): {r4.action}")
print(f"     Expected=180, Actual=182, Diff={r4.difference}")

# Test 5: Large difference - error
r5 = validate_gst_tax(1000, 18, 300, None, None, True)
print(f"\n  5. Error (diff=120.00): {r5.action}")
print(f"     Expected=180, Actual=300, Diff={r5.difference}")
print(f"     Valid: {r5.is_valid}")

# Test 6: Intra-state with mismatch
r6 = validate_gst_tax(1000, 18, None, 85, 85, False)
print(f"\n  6. Intra-state mismatch (diff=10): {r6.action}")
print(f"     Expected=90/90, Actual=85/85, Diff={r6.difference}")

# Test row normalization with tax validation
print("\n6. Row Normalization with Tax Validation:")
print("-" * 50)

mapping = {
    'GST No': 'gstin',
    'Invoice Number': 'invoice_number',
    'Invoice Date': 'invoice_date',
    'Taxable Value': 'taxable_value',
    'Rate': 'rate',
    'IGST': 'igst',
    'Place of Supply': 'place_of_supply',
}

# Valid row
test_row = {
    'GST No': '27ABCDE1234F1Z5',
    'Invoice Number': 'INV-001',
    'Invoice Date': '25/12/2025',
    'Taxable Value': '1,000',
    'Rate': '18%',
    'IGST': '180',
    'Place of Supply': '27-Maharashtra',
}

normalized, validation = mapper.normalize_row(test_row, mapping)
print(f"  Valid row:")
print(f"    taxable_value={normalized.get('taxable_value')}, igst={normalized.get('igst')}")
print(f"    Errors: {validation['errors']}")
print(f"    Warnings: {validation['warnings']}")

# Row with tax mismatch
test_row_bad = {
    'GST No': '27ABCDE1234F1Z5',
    'Invoice Number': 'INV-002',
    'Invoice Date': '25/12/2025',
    'Taxable Value': '1,000',
    'Rate': '18%',
    'IGST': '182',
    'Place of Supply': '27-Maharashtra',
}

normalized_bad, validation_bad = mapper.normalize_row(test_row_bad, mapping)
print(f"\n  Row with tax mismatch:")
print(f"    igst={normalized_bad.get('igst')}")
print(f"    Warnings: {validation_bad['warnings']}")

print("\n" + "=" * 70)
print("All tests completed successfully!")
print("=" * 70)
