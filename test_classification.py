#!/usr/bin/env python
"""Test script for transaction classification."""

import sys
import io

# Set stdout to handle unicode
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from india_compliance.gst_india.utils.header_mapper import (
    classify_transaction,
    is_export,
    is_credit_note,
    is_debit_note,
    is_rcm,
    TransactionClassification,
    B2CL_THRESHOLD,
)

print("=" * 70)
print("Transaction Classification Tests")
print("=" * 70)
print(f"B2CL Threshold: {B2CL_THRESHOLD:,.2f} INR")
print()

# Test 1: B2B (GSTIN present)
print("1. B2B Classification:")
print("-" * 50)
b2b = classify_transaction('27ABCDE1234F1Z5', 50000, None, None, None, False)
print(f"   GSTIN: 27ABCDE1234F1Z5, Value: 50,000")
print(f"   Result: {b2b.transaction_type}")
print(f"   is_credit_note: {b2b.is_credit_note}")
print(f"   is_debit_note: {b2b.is_debit_note}")
print(f"   is_rcm: {b2b.is_rcm}")
print(f"   is_export: {b2b.is_export}")
print()

# Test 2: B2CL (no GSTIN, high value, inter-state)
print("2. B2CL Classification:")
print("-" * 50)
b2cl = classify_transaction('', 300000, None, None, None, True)
print(f"   GSTIN: (empty), Value: 300,000, Inter-state: True")
print(f"   Result: {b2cl.transaction_type}")
print(f"   raw_flags: {b2cl.raw_flags}")
print()

# Test 3: B2CS (no GSTIN, low value)
print("3. B2CS Classification:")
print("-" * 50)
b2cs = classify_transaction('', 50000, None, None, None, True)
print(f"   GSTIN: (empty), Value: 50,000")
print(f"   Result: {b2cs.transaction_type}")
print()

# Test 4: Export
print("4. Export Classification:")
print("-" * 50)
exp = classify_transaction('', 100000, 'Export', None, None, True)
print(f"   GSTIN: (empty), Value: 100,000, Supply Type: Export")
print(f"   Result: {exp.transaction_type}")
print(f"   is_export: {exp.is_export}")
print()

# Test 5: B2B Credit Note
print("5. B2B Credit Note Classification:")
print("-" * 50)
cr = classify_transaction('27ABCDE1234F1Z5', 50000, None, 'Credit Note', None, False)
print(f"   GSTIN: 27ABCDE1234F1Z5, Value: 50,000, Doc Type: Credit Note")
print(f"   Result: {cr.transaction_type}")
print(f"   is_credit_note: {cr.is_credit_note}")
print()

# Test 6: B2B Debit Note
print("6. B2B Debit Note Classification:")
print("-" * 50)
dr = classify_transaction('27ABCDE1234F1Z5', 50000, None, 'Debit Note', None, False)
print(f"   GSTIN: 27ABCDE1234F1Z5, Value: 50,000, Doc Type: Debit Note")
print(f"   Result: {dr.transaction_type}")
print(f"   is_debit_note: {dr.is_debit_note}")
print()

# Test 7: B2B RCM
print("7. B2B RCM Classification:")
print("-" * 50)
rcm = classify_transaction('27ABCDE1234F1Z5', 50000, None, None, 'Y', False)
print(f"   GSTIN: 27ABCDE1234F1Z5, Value: 50,000, Reverse Charge: Y")
print(f"   Result: {rcm.transaction_type}")
print(f"   is_rcm: {rcm.is_rcm}")
print()

# Test 8: B2CL with Credit Note
print("8. B2CL Credit Note Classification:")
print("-" * 50)
b2cl_cr = classify_transaction('', 300000, None, 'Credit Note', None, True)
print(f"   GSTIN: (empty), Value: 300,000, Doc Type: Credit Note")
print(f"   Result: {b2cl_cr.transaction_type}")
print()

# Test 9: Export with RCM
print("9. Export with RCM Classification:")
print("-" * 50)
exp_rcm = classify_transaction('', 100000, 'Export', None, 'Yes', True)
print(f"   GSTIN: (empty), Value: 100,000, Supply: Export, RCM: Yes")
print(f"   Result: {exp_rcm.transaction_type}")
print()

# Test 10: Check individual detection functions
print("10. Individual Detection Functions:")
print("-" * 50)
print(f"   is_export('Export'): {is_export('Export')}")
print(f"   is_export('Export With Payment'): {is_export('Export With Payment')}")
print(f"   is_export('SEZ'): {is_export('SEZ')}")
print(f"   is_credit_note('Credit Note'): {is_credit_note('Credit Note')}")
print(f"   is_credit_note('CN'): {is_credit_note('CN')}")
print(f"   is_debit_note('Debit Note'): {is_debit_note('Debit Note')}")
print(f"   is_debit_note('DN'): {is_debit_note('DN')}")
print(f"   is_rcm('Y'): {is_rcm('Y')}")
print(f"   is_rcm('Yes'): {is_rcm('Yes')}")
print(f"   is_rcm('1'): {is_rcm('1')}")
print(f"   is_rcm('True'): {is_rcm('True')}")
print()

print("=" * 70)
print("All classification tests completed!")
print("=" * 70)
