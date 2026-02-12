"""
Test script for Summary Validation Logic.
"""
import json
from india_compliance.gst_india.gstr1_data import (
    generate_gstr1_tables,
    validate_summary_totals,
    calculate_totals_from_tables,
)


def test_summary_validation():
    """Test that summary totals match table sums."""
    print("=== Test Summary Validation ===")
    
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
        # Credit Note (CDNR) - should reduce totals
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
        },
        # B2CL invoice
        {
            "gstin": "",
            "invoice_number": "B2CL-001",
            "invoice_type": "Regular",
            "invoice_value": 300000,
            "taxable_value": 300000,
            "igst": 54000,
            "rate": 18,
            "place_of_supply": "27-Maharashtra",
        },
        # B2CS entry
        {
            "gstin": "",
            "invoice_number": "B2CS-001",
            "invoice_type": "Regular",
            "invoice_value": 50000,
            "taxable_value": 50000,
            "igst": 9000,
            "rate": 18,
            "place_of_supply": "27-Maharashtra",
        },
        # EXP invoice
        {
            "gstin": "",
            "invoice_number": "EXP-001",
            "invoice_type": "Export",
            "invoice_value": 250000,
            "taxable_value": 250000,
            "igst": 45000,
            "rate": 18,
            "place_of_supply": "96-Other Countries",
            "is_export": True,
        },
        # CDNUR credit note
        {
            "gstin": "",
            "invoice_number": "CN-002",
            "invoice_type": "credit note",
            "invoice_value": -5000,
            "taxable_value": 5000,
            "igst": 900,
            "rate": 18,
            "place_of_supply": "27-Maharashtra",
        },
    ]
    
    result = generate_gstr1_tables(test_data, company_gstin="07AAAAA1234A1Z5")
    
    # Calculate totals from tables
    calculated = calculate_totals_from_tables(result)
    print(f"Calculated from tables: {json.dumps(calculated, indent=2)}")
    
    # Get summary
    summary = result['summary']
    print(f"Summary: {json.dumps(summary, indent=2)}")
    
    # Validate
    is_valid, message = validate_summary_totals(result)
    
    print(f"Validation result: {is_valid}")
    print(f"Message: {message}")
    
    assert is_valid, f"Validation failed: {message}"
    
    # Verify the values match
    assert abs(summary['total_taxable_value'] - calculated['taxable_value']) < 0.01
    assert abs(summary['total_igst'] - calculated['igst']) < 0.01
    assert abs(summary['total_cgst'] - calculated['cgst']) < 0.01
    assert abs(summary['total_sgst'] - calculated['sgst']) < 0.01
    assert abs(summary['total_cess'] - calculated['cess']) < 0.01
    
    print("[PASS] Summary validation tests passed\n")


def test_validation_with_mismatch():
    """Test that validation fails when there's a mismatch."""
    print("=== Test Validation with Mismatch ===")
    
    # Create a result with intentionally mismatched totals
    result = {
        "b2b": [],
        "b2cl": [{"txval": 100000, "iamt": 18000, "csamt": 0}],
        "b2cs": [{"txval": 50000, "iamt": 9000, "csamt": 0}],
        "exp": [],
        "cdnr": [],
        "cdnur": [],
        "summary": {
            "total_taxable_value": 200000,  # Intentionally wrong (should be 150000)
            "total_igst": 27000,  # Intentionally wrong (should be 27000)
            "total_cgst": 0,
            "total_sgst": 0,
            "total_cess": 0,
        }
    }
    
    is_valid, message = validate_summary_totals(result)
    
    print(f"Validation result: {is_valid}")
    print(f"Message: {message}")
    
    assert not is_valid, "Validation should fail when there's a mismatch"
    assert "Taxable Value" in message, "Message should mention Taxable Value discrepancy"
    
    print("[PASS] Mismatch detection test passed\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Summary Validation Tests")
    print("=" * 60 + "\n")
    
    test_summary_validation()
    test_validation_with_mismatch()
    
    print("=" * 60)
    print("All Summary Validation tests passed!")
    print("=" * 60)
