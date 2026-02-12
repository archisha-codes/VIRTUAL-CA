"""
Test script for Summary Validation with Fail-Safe Error System.
"""
import json
from india_compliance.gst_india.gstr1_data import (
    generate_gstr1_tables,
    generate_gstr1_json,
    validate_summary_totals,
    calculate_totals_from_tables,
)


def test_summary_validation_success():
    """Test that validation passes when totals match."""
    print("=== Test Summary Validation (Success) ===")
    
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
    ]
    
    result, report = generate_gstr1_tables(test_data, company_gstin="07AAAAA1234A1Z5")
    
    print(f"Final Status: {report.final_status}")
    print(f"Errors: {report.errors}")
    print(f"Warnings: {report.warnings}")
    print(f"Auto Corrections: {report.auto_corrections}")
    
    assert report.is_valid(), f"Validation should pass: {report.errors}"
    assert report.final_status == "success"
    assert len(report.errors) == 0
    
    print("[PASS] Summary validation (success) tests passed\n")


def test_summary_validation_failure():
    """Test that validation fails gracefully with structured report."""
    print("=== Test Summary Validation (Failure) ===")
    
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
    
    report = validate_summary_totals(result)
    
    print(f"Final Status: {report.final_status}")
    print(f"Errors: {report.errors}")
    
    assert not report.is_valid(), "Validation should fail"
    assert report.final_status == "failed"
    assert len(report.errors) > 0
    assert "Taxable Value" in report.errors[0]
    
    print("[PASS] Summary validation (failure) tests passed\n")


def test_generate_gstr1_json_with_validation():
    """Test generate_gstr1_json returns validation report."""
    print("=== Test Generate GSTR-1 JSON with Validation ===")
    
    test_data = [
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
    ]
    
    gstr1_json, report = generate_gstr1_json(
        test_data,
        company_gstin="07AAAAA1234A1Z5",
        return_period="122025",
        gstin="07AAAAA1234A1Z5",
        username="Test User"
    )
    
    print(f"Final Status: {report.final_status}")
    print(f"GSTIN: {gstr1_json['gstin']}")
    print(f"Return Period: {gstr1_json['ret_period']}")
    
    assert report.is_valid()
    assert gstr1_json['gstin'] == "07AAAAA1234A1Z5"
    assert gstr1_json['ret_period'] == "122025"
    
    print("[PASS] Generate GSTR-1 JSON tests passed\n")


def test_validation_report_structure():
    """Test that ValidationReport has correct structure."""
    print("=== Test ValidationReport Structure ===")
    
    from india_compliance.gst_india.gstr1_data import ValidationReport
    
    report = ValidationReport()
    report.add_error("Test error 1")
    report.add_error("Test error 2")
    report.add_warning("Test warning 1")
    report.add_auto_correction("Corrected field X from Y to Z")
    
    report_dict = report.to_dict()
    
    print(f"Report Dict: {json.dumps(report_dict, indent=2)}")
    
    assert "errors" in report_dict
    assert "warnings" in report_dict
    assert "auto_corrections" in report_dict
    assert "final_status" in report_dict
    assert len(report_dict["errors"]) == 2
    assert len(report_dict["warnings"]) == 1
    assert len(report_dict["auto_corrections"]) == 1
    assert report_dict["final_status"] == "failed"
    
    print("[PASS] ValidationReport structure tests passed\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Fail-Safe Error System Tests")
    print("=" * 60 + "\n")
    
    test_summary_validation_success()
    test_summary_validation_failure()
    test_generate_gstr1_json_with_validation()
    test_validation_report_structure()
    
    print("=" * 60)
    print("All Fail-Safe Error System tests passed!")
    print("=" * 60)
