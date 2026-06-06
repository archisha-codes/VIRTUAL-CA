"""
Unit tests for GSTR-1 validation module.
"""

import pytest
from india_compliance.gst_india.utils.gstr1.gstr1_validations import (
    validate_gstr1_row,
    validate_gstr1_data,
    validate_gstin,
    validate_gst_rate,
    validate_invoice_date,
    validate_place_of_supply,
    validate_taxable_value,
    validate_invoice_value,
    GSTR1ValidationError,
)


class TestValidateGSTIN:
    """Tests for GSTIN validation."""

    def test_valid_gstin(self):
        """Test valid GSTIN format."""
        gstin = "07AAAAA1234A1ZA"
        error = validate_gstin(gstin, "gstin")
        assert error is None

    def test_invalid_gstin_length(self):
        """Test GSTIN with invalid length."""
        gstin = "07AAAAA1234A1Z"
        error = validate_gstin(gstin, "gstin")
        assert error is not None
        assert "must be 15 characters" in error.error

    def test_invalid_gstin_format(self):
        """Test GSTIN with invalid format."""
        gstin = "07AAAA1234A1ZA"  # Missing one character in PAN
        error = validate_gstin(gstin, "gstin")
        assert error is not None
        assert "does not match expected pattern" in error.error

    def test_invalid_state_code(self):
        """Test GSTIN with invalid state code."""
        gstin = "99AAAAA1234A1ZA"  # Invalid state code 99
        error = validate_gstin(gstin, "gstin")
        assert error is not None
        assert "invalid state code" in error.error

    def test_empty_gstin(self):
        """Test empty GSTIN."""
        error = validate_gstin("", "gstin")
        assert error is not None
        assert "is required" in error.error

    def test_none_gstin(self):
        """Test None GSTIN."""
        error = validate_gstin(None, "gstin")
        assert error is not None
        assert "is required" in error.error


class TestValidateGSTRate:
    """Tests for GST rate validation."""

    def test_valid_gst_rates(self):
        """Test valid GST rates."""
        for rate in [0, 5, 12, 18, 28]:
            error = validate_gst_rate(rate, "gst_rate")
            assert error is None, f"Rate {rate} should be valid"

    def test_invalid_gst_rate(self):
        """Test invalid GST rate."""
        error = validate_gst_rate(15, "gst_rate")
        assert error is not None
        assert "must be one of" in error.error

    def test_negative_gst_rate(self):
        """Test negative GST rate."""
        error = validate_gst_rate(-5, "gst_rate")
        assert error is not None

    def test_none_gst_rate(self):
        """Test None GST rate."""
        error = validate_gst_rate(None, "gst_rate")
        assert error is not None
        assert "is required" in error.error

    def test_string_gst_rate(self):
        """Test string GST rate."""
        error = validate_gst_rate("abc", "gst_rate")
        assert error is not None


class TestValidateInvoiceDate:
    """Tests for invoice date validation."""

    def test_valid_date_format(self):
        """Test valid date format."""
        error = validate_invoice_date("15/03/2024", "03/2024", "invoice_date")
        assert error is None

    def test_valid_date_with_dashes(self):
        """Test valid date format with dashes."""
        error = validate_invoice_date("15-03-2024", "03/2024", "invoice_date")
        assert error is None

    def test_future_date(self):
        """Test future date."""
        error = validate_invoice_date("31/12/2099", "03/2024", "invoice_date")
        assert error is not None
        assert "Future date not allowed" in error.error

    def test_invalid_date_format(self):
        """Test invalid date format."""
        error = validate_invoice_date("2024-03-15", "03/2024", "invoice_date")
        assert error is not None
        assert "Invalid date format" in error.error

    def test_empty_date(self):
        """Test empty date."""
        error = validate_invoice_date("", "03/2024", "invoice_date")
        assert error is not None
        assert "is required" in error.error


class TestValidatePlaceOfSupply:
    """Tests for place of supply validation."""

    def test_valid_place_of_supply(self):
        """Test valid place of supply."""
        error = validate_place_of_supply("07-Delhi", "07AAAAA1234A1ZA", "place_of_supply")
        assert error is None

    def test_valid_state_code_only(self):
        """Test valid state code only."""
        error = validate_place_of_supply("07", "", "place_of_supply")
        assert error is None

    def test_invalid_state_code(self):
        """Test invalid state code."""
        error = validate_place_of_supply("99-Delhi", "", "place_of_supply")
        assert error is not None
        assert "invalid state code" in error.error

    def test_empty_place_of_supply(self):
        """Test empty place of supply."""
        error = validate_place_of_supply("", "", "place_of_supply")
        assert error is not None
        assert "is required" in error.error


class TestValidateTaxableValue:
    """Tests for taxable value and tax amount validation."""

    def test_matching_tax_amount(self):
        """Test matching tax amount."""
        error = validate_taxable_value(1000, 180, 18, "taxable_value")
        assert error is None

    def test_mismatched_tax_amount(self):
        """Test mismatched tax amount."""
        error = validate_taxable_value(1000, 200, 18, "taxable_value")
        assert error is not None
        assert "Tax amount mismatch" in error.error

    def test_zero_rate(self):
        """Test zero GST rate."""
        error = validate_taxable_value(1000, 0, 0, "taxable_value")
        assert error is None


class TestValidateGSTR1Row:
    """Tests for main validate_gstr1_row function."""

    def test_b2b_valid_row(self):
        """Test valid B2B row."""
        row = {
            "gstin": "07AAAAA1234A1ZA",
            "invoice_no": "INV-001",
            "invoice_date": "15/03/2024",
            "place_of_supply": "07-Delhi",
            "taxable_value": 100000,
            "igst_amount": 0,
            "cgst_amount": 9000,
            "sgst_amount": 9000,
            "cess_amount": 0,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 1, "b2b")
        assert len(errors) == 0

    def test_b2b_invalid_gstin(self):
        """Test B2B row with invalid GSTIN."""
        row = {
            "gstin": "invalid",
            "invoice_no": "INV-001",
            "invoice_date": "15/03/2024",
            "place_of_supply": "07-Delhi",
            "taxable_value": 100000,
            "igst_amount": 0,
            "cgst_amount": 9000,
            "sgst_amount": 9000,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 5, "b2b")
        assert len(errors) > 0
        assert any(e["field"] == "recipient_gstin" for e in errors)

    def test_b2b_missing_invoice_no(self):
        """Test B2B row with missing invoice number."""
        row = {
            "gstin": "07AAAAA1234A1ZA",
            "invoice_date": "15/03/2024",
            "place_of_supply": "07-Delhi",
            "taxable_value": 100000,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 7, "b2b")
        assert any(e["field"] == "invoice_no" for e in errors)

    def test_b2cl_valid_row(self):
        """Test valid B2CL row."""
        row = {
            "invoice_no": "INV-002",
            "invoice_date": "15/03/2024",
            "place_of_supply": "27-Maharashtra",
            "taxable_value": 300000,
            "igst_amount": 54000,
            "cess_amount": 0,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 2, "b2cl")
        assert len(errors) == 0

    def test_b2cl_with_gstin_error(self):
        """Test B2CL row with GSTIN (should error)."""
        row = {
            "gstin": "07AAAAA1234A1ZA",  # Should not have GSTIN
            "invoice_no": "INV-002",
            "invoice_date": "15/03/2024",
            "place_of_supply": "27-Maharashtra",
            "taxable_value": 300000,
            "igst_amount": 54000,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 3, "b2cl")
        assert any("should not have" in e["error"].lower() for e in errors)

    def test_b2cs_valid_row(self):
        """Test valid B2CS row."""
        row = {
            "invoice_no": "INV-003",
            "invoice_date": "15/03/2024",
            "place_of_supply": "07-Delhi",
            "taxable_value": 50000,
            "cgst_amount": 4500,
            "sgst_amount": 4500,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 4, "b2cs")
        assert len(errors) == 0

    def test_export_valid_row(self):
        """Test valid Export row."""
        row = {
            "invoice_no": "EXP-001",
            "invoice_date": "15/03/2024",
            "place_of_supply": "96-Other Countries",
            "taxable_value": 150000,
            "igst_amount": 27000,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 5, "export")
        assert len(errors) == 0

    def test_export_invalid_place_of_supply(self):
        """Test Export row with invalid place of supply."""
        row = {
            "invoice_no": "EXP-001",
            "invoice_date": "15/03/2024",
            "place_of_supply": "07-Delhi",  # Must be 96
            "taxable_value": 150000,
            "igst_amount": 27000,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 6, "export")
        assert any("96-Other Countries" in e["error"] for e in errors)

    def test_cdnr_valid_row(self):
        """Test valid CDNR row."""
        row = {
            "gstin": "07AAAAA1234A1ZA",
            "invoice_no": "CN-001",
            "note_type": "Credit Note",
            "note_date": "15/03/2024",
            "place_of_supply": "07-Delhi",
            "taxable_value": 10000,
            "cgst_amount": 900,
            "sgst_amount": 900,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 7, "cdnr")
        assert len(errors) == 0

    def test_cdnur_valid_row(self):
        """Test valid CDNUR row."""
        row = {
            "invoice_no": "CN-002",
            "note_type": "Credit Note",
            "note_date": "15/03/2024",
            "place_of_supply": "27-Maharashtra",
            "taxable_value": 5000,
            "igst_amount": 900,
            "gst_rate": 18,
            "return_period": "03/2024"
        }
        errors = validate_gstr1_row(row, 8, "cdnur")
        assert len(errors) == 0

    def test_unknown_section(self):
        """Test unknown section type."""
        row = {"invoice_no": "INV-001"}
        errors = validate_gstr1_row(row, 1, "unknown_section")
        assert len(errors) == 1
        assert "Unknown section type" in errors[0]["error"]


class TestValidateGSTR1Data:
    """Tests for validating multiple rows."""

    def test_multiple_rows_with_errors(self):
        """Test multiple rows with various errors."""
        data = [
            {
                "gstin": "07AAAAA1234A1ZA",
                "invoice_no": "INV-001",
                "invoice_date": "15/03/2024",
                "place_of_supply": "07-Delhi",
                "taxable_value": 100000,
                "igst_amount": 0,
                "cgst_amount": 9000,
                "sgst_amount": 9000,
                "gst_rate": 18,
                "return_period": "03/2024"
            },
            {
                "gstin": "invalid_gstin",  # Invalid
                "invoice_no": "INV-002",
                "invoice_date": "15/03/2024",
                "place_of_supply": "27-Maharashtra",
                "taxable_value": 200000,
                "igst_amount": 36000,
                "gst_rate": 18,
                "return_period": "03/2024"
            },
            {
                "gstin": "08AAAAA5678A1ZB",
                "invoice_no": "",  # Missing invoice number
                "invoice_date": "15/03/2024",
                "place_of_supply": "08-Rajasthan",
                "taxable_value": 50000,
                "igst_amount": 9000,
                "gst_rate": 18,
                "return_period": "03/2024"
            }
        ]
        errors = validate_gstr1_data(data, "b2b")
        
        # Should have errors for row 2 (invalid GSTIN) and row 3 (missing invoice)
        assert len(errors) >= 2
        
        # Check error structure
        for error in errors:
            assert "row" in error
            assert "field" in error
            assert "error" in error

    def test_empty_data(self):
        """Test empty data list."""
        errors = validate_gstr1_data([], "b2b")
        assert len(errors) == 0


class TestErrorFormat:
    """Tests for error format consistency."""

    def test_error_has_required_fields(self):
        """Test that errors have required fields."""
        row = {"gstin": "invalid"}
        errors = validate_gstr1_row(row, 7, "b2b")
        
        for error in errors:
            assert "row" in error
            assert "field" in error
            assert "error" in error
            assert isinstance(error["row"], int)

    def test_error_row_number(self):
        """Test that error contains correct row number."""
        row = {"gstin": "invalid"}
        errors = validate_gstr1_row(row, 10, "b2b")
        
        for error in errors:
            assert error["row"] == 10
