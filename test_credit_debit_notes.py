"""
Test script for Credit/Debit Note logic in GSTR-1 processing.
"""
import json
from india_compliance.gst_india.gstr1_data import (
    generate_gstr1_tables,
    get_signed_values,
    get_invoice_category,
)
from india_compliance.gst_india.utils.gstr_1 import (
    GSTR1_Category,
    GSTR1_SubCategory,
)


def test_credit_note_classification():
    """Test that credit notes are classified as CDNR/CDNUR."""
    print("=== Test Credit Note Classification ===")
    
    # Test CDNR (registered)
    cn_row = {
        "gstin": "07SMUWG6036O1ZR",
        "invoice_type": "credit note",
        "invoice_value": -10000,
        "taxable_value": 10000,
        "igst": 1800,
        "rate": 18,
    }
    
    category, subcategory = get_invoice_category(cn_row, "07")
    print(f"CDN (registered): {category}, {subcategory}")
    assert category == GSTR1_Category.CDNR.value, f"Expected {GSTR1_Category.CDNR.value}, got {category}"
    
    # Test CDNUR (unregistered)
    cnur_row = {
        "gstin": "",
        "invoice_type": "credit note",
        "invoice_value": -5000,
        "taxable_value": 5000,
        "igst": 900,
        "rate": 18,
    }
    
    category, subcategory = get_invoice_category(cnur_row, "07")
    print(f"CDN (unregistered): {category}, {subcategory}")
    assert category == GSTR1_Category.CDNUR.value, f"Expected {GSTR1_Category.CDNUR.value}, got {category}"
    
    print("[PASS] Classification tests passed\n")


def test_debit_note_classification():
    """Test that debit notes are classified as CDNR/CDNUR."""
    print("=== Test Debit Note Classification ===")
    
    # Test CDNR (registered)
    dn_row = {
        "gstin": "07SMUWG6036O1ZR",
        "is_debit_note": True,
        "invoice_value": 15000,
        "taxable_value": 15000,
        "cgst": 1350,
        "sgst": 1350,
        "rate": 18,
    }
    
    category, subcategory = get_invoice_category(dn_row, "07")
    print(f"CDN (registered): {category}, {subcategory}")
    assert category == GSTR1_Category.CDNR.value, f"Expected {GSTR1_Category.CDNR.value}, got {category}"
    
    # Test CDNUR (unregistered)
    dnur_row = {
        "gstin": "",
        "is_debit_note": True,
        "invoice_value": 8000,
        "taxable_value": 8000,
        "igst": 1440,
        "rate": 18,
    }
    
    category, subcategory = get_invoice_category(dnur_row, "07")
    print(f"CDN (unregistered): {category}, {subcategory}")
    assert category == GSTR1_Category.CDNUR.value, f"Expected {GSTR1_Category.CDNUR.value}, got {category}"
    
    print("[PASS] Classification tests passed\n")


def test_signed_values():
    """Test that signed values are calculated correctly."""
    print("=== Test Signed Values ===")
    
    # Credit note should have negative values
    cn_row = {
        "invoice_type": "credit note",
        "taxable_value": 10000,
        "igst": 1800,
        "cgst": 0,
        "sgst": 0,
        "cess": 0,
    }
    
    signed = get_signed_values(cn_row)
    print(f"Credit note signed values: {signed}")
    assert signed["taxable_value"] == -10000, f"Expected -10000, got {signed['taxable_value']}"
    assert signed["igst"] == -1800, f"Expected -1800, got {signed['igst']}"
    
    # Debit note should have positive values
    dn_row = {
        "is_debit_note": True,
        "taxable_value": 15000,
        "igst": 0,
        "cgst": 1350,
        "sgst": 1350,
        "cess": 100,
    }
    
    signed = get_signed_values(dn_row)
    print(f"Debit note signed values: {signed}")
    assert signed["taxable_value"] == 15000, f"Expected 15000, got {signed['taxable_value']}"
    assert signed["cgst"] == 1350, f"Expected 1350, got {signed['cgst']}"
    assert signed["sgst"] == 1350, f"Expected 1350, got {signed['sgst']}"
    
    # Regular invoice should have positive values
    inv_row = {
        "taxable_value": 20000,
        "igst": 3600,
        "cgst": 0,
        "sgst": 0,
        "cess": 0,
    }
    
    signed = get_signed_values(inv_row)
    print(f"Regular invoice signed values: {signed}")
    assert signed["taxable_value"] == 20000, f"Expected 20000, got {signed['taxable_value']}"
    assert signed["igst"] == 3600, f"Expected 3600, got {signed['igst']}"
    
    print("[PASS] Signed values tests passed\n")


def test_complete_gstr1_with_notes():
    """Test complete GSTR-1 generation with credit/debit notes."""
    print("=== Test Complete GSTR-1 with Credit/Debit Notes ===")
    
    test_data = [
        # Regular B2B invoice
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "INV-001",
            "invoice_type": "Regular",
            "invoice_value": 100000,
            "taxable_value": 100000,
            "cgst": 9000,
            "sgst": 9000,
            "rate": 18,
            "place_of_supply": "07-Delhi",
        },
        # Credit Note (CDNR)
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "CN-001",
            "invoice_type": "credit note",
            "invoice_value": -10000,
            "taxable_value": 10000,
            "cgst": 900,
            "sgst": 900,
            "rate": 18,
            "place_of_supply": "07-Delhi",
            "note_number": "CN-001",
            "note_date": "2026-02-10",
            "original_invoice_number": "INV-001",
        },
        # Debit Note (CDNR)
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "DN-001",
            "is_debit_note": True,
            "invoice_value": 5000,
            "taxable_value": 5000,
            "cgst": 450,
            "sgst": 450,
            "rate": 18,
            "place_of_supply": "07-Delhi",
            "note_number": "DN-001",
            "note_date": "2026-02-10",
        },
        # Credit Note (CDNUR)
        {
            "gstin": "",
            "invoice_number": "CN-002",
            "invoice_type": "credit note",
            "invoice_value": -5000,
            "taxable_value": 5000,
            "igst": 900,
            "rate": 18,
            "place_of_supply": "27-Maharashtra",
            "note_number": "CN-002",
            "note_date": "2026-02-10",
        },
        # Debit Note (CDNUR)
        {
            "gstin": "",
            "invoice_number": "DN-002",
            "is_debit_note": True,
            "invoice_value": 3000,
            "taxable_value": 3000,
            "igst": 540,
            "rate": 18,
            "place_of_supply": "27-Maharashtra",
            "note_number": "DN-002",
            "note_date": "2026-02-10",
        },
    ]
    
    result = generate_gstr1_tables(test_data, company_gstin="07AAAAA1234A1Z5")
    
    print(f"Summary: {json.dumps(result['summary'], indent=2)}")
    print(f"CDNR entries: {len(result['cdnr'])}")
    print(f"CDNUR entries: {len(result['cdnur'])}")
    
    # Verify totals
    summary = result['summary']
    print(f"\nTotal taxable value: {summary['total_taxable_value']}")
    print(f"  Expected: {100000 - 10000 + 5000 - 5000 + 3000} (100000 - CN001 + DN001 - CN002 + DN002)")
    
    # Credit notes reduce totals, debit notes increase
    expected_taxable = 100000 - 10000 + 5000 - 5000 + 3000  # = 93000
    assert abs(summary['total_taxable_value'] - expected_taxable) < 0.01, \
        f"Expected {expected_taxable}, got {summary['total_taxable_value']}"
    
    # Check note counts
    assert summary['cdnr_credit_notes'] == 1, f"Expected 1 CDNR credit note, got {summary['cdnr_credit_notes']}"
    assert summary['cdnr_debit_notes'] == 1, f"Expected 1 CDNR debit note, got {summary['cdnr_debit_notes']}"
    assert summary['cdnur_credit_notes'] == 1, f"Expected 1 CDNUR credit note, got {summary['cdnur_credit_notes']}"
    assert summary['cdnur_debit_notes'] == 1, f"Expected 1 CDNUR debit note, got {summary['cdnur_debit_notes']}"
    
    # Check CDNR data
    if result['cdnr']:
        print(f"\nSample CDNR entry: {json.dumps(result['cdnr'][0], indent=2)}")
    
    # Check CDNUR data
    if result['cdnur']:
        print(f"\nSample CDNUR entry: {json.dumps(result['cdnur'][0], indent=2)}")
    
    print("[PASS] Complete GSTR-1 tests passed\n")


def test_impact_on_summary():
    """Test that credit/debit notes properly impact the summary totals."""
    print("=== Test Impact on Summary Totals ===")
    
    # Scenario: Regular invoices totaling 100000, Credit note for 20000
    test_data = [
        # Regular invoices
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "INV-001",
            "invoice_value": 50000,
            "taxable_value": 50000,
            "cgst": 4500,
            "sgst": 4500,
            "rate": 18,
            "place_of_supply": "07-Delhi",
        },
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "INV-002",
            "invoice_value": 50000,
            "taxable_value": 50000,
            "cgst": 4500,
            "sgst": 4500,
            "rate": 18,
            "place_of_supply": "07-Delhi",
        },
        # Credit note reducing liability
        {
            "gstin": "07SMUWG6036O1ZR",
            "invoice_number": "CN-001",
            "invoice_type": "credit note",
            "invoice_value": -20000,
            "taxable_value": 20000,
            "cgst": 1800,
            "sgst": 1800,
            "rate": 18,
            "place_of_supply": "07-Delhi",
        },
    ]
    
    result = generate_gstr1_tables(test_data, company_gstin="07AAAAA1234A1Z5")
    
    summary = result['summary']
    print(f"Total taxable: {summary['total_taxable_value']}")
    print(f"Total CGST: {summary['total_cgst']}")
    print(f"Total SGST: {summary['total_sgst']}")
    
    # Expected: 100000 - 20000 = 80000
    expected_taxable = 80000
    expected_cgst = 7200  # 9000 + 9000 - 1800
    expected_sgst = 7200
    
    assert abs(summary['total_taxable_value'] - expected_taxable) < 0.01, \
        f"Expected taxable {expected_taxable}, got {summary['total_taxable_value']}"
    assert abs(summary['total_cgst'] - expected_cgst) < 0.01, \
        f"Expected CGST {expected_cgst}, got {summary['total_cgst']}"
    assert abs(summary['total_sgst'] - expected_sgst) < 0.01, \
        f"Expected SGST {expected_sgst}, got {summary['total_sgst']}"
    
    print("[PASS] Summary impact tests passed\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Credit/Debit Note Logic Tests")
    print("=" * 60 + "\n")
    
    test_credit_note_classification()
    test_debit_note_classification()
    test_signed_values()
    test_complete_gstr1_with_notes()
    test_impact_on_summary()
    
    print("=" * 60)
    print("All Credit/Debit Note tests passed!")
    print("=" * 60)
