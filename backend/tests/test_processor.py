"""
Unit tests for GSTR-1 processor validation logic.
"""

import pytest
import pandas as pd
from india_compliance.gst_india.utils.gstr_1.processor import (
    GSTR1Validator,
    GSTR1ExcelProcessor,
    process_gstr1_excel,
    GSTIN_PATTERN,
    VALID_STATE_CODES,
    VALID_TAX_RATES,
)


class TestGSTINValidation:
    """Tests for GSTIN validation."""

    def test_valid_gstin(self):
        """Test valid GSTIN formats."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("07BZAAH6384P1ZH", 1) is True
        assert validator.validate_gstin("27AAECM3564C1Z3", 2) is True
        assert validator.validate_gstin("09AAECS1234A1ZS", 3) is True

    def test_invalid_gstin_too_short(self):
        """Test GSTIN that is too short."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("07BZAAH63", 1) is False

    def test_invalid_gstin_too_long(self):
        """Test GSTIN that is too long."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("07BZAAH6384P1ZH123", 1) is False

    def test_invalid_gstin_wrong_format(self):
        """Test GSTIN with wrong format."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("123456789012345", 1) is False
        assert validator.validate_gstin("ABCDEFGHIJKLMNO", 1) is False

    def test_invalid_state_code(self):
        """Test GSTIN with invalid state code."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("99BZAAH6384P1ZH", 1) is False

    def test_empty_gstin(self):
        """Test empty GSTIN."""
        validator = GSTR1Validator()
        assert validator.validate_gstin("", 1) is False
        assert validator.validate_gstin(None, 1) is False

    def test_gstin_pattern_regex(self):
        """Test GSTIN regex pattern."""
        assert GSTIN_PATTERN.match("07BZAAH6384P1ZH") is not None
        assert GSTIN_PATTERN.match("27AAECM3564C1Z3") is not None
        assert GSTIN_PATTERN.match("07BZAAH6384P1ZH") is not None
        assert GSTIN_PATTERN.match("07BZAAH6384P1ZH") is not None


class TestDateValidation:
    """Tests for date validation."""

    def test_valid_date_format_dd_mm_yyyy(self):
        """Test valid date in DD/MM/YYYY format."""
        validator = GSTR1Validator()
        result = validator.validate_date("15/01/2024", 1)
        assert result is not None
        assert result.day == 15
        assert result.month == 1
        assert result.year == 2024

    def test_valid_date_format_yyyy_mm_dd(self):
        """Test valid date in YYYY-MM-DD format."""
        validator = GSTR1Validator()
        result = validator.validate_date("2024-01-15", 1)
        assert result is not None

    def test_valid_date_format_dd_mm_yyyy_with_dashes(self):
        """Test valid date in DD-MM-YYYY format."""
        validator = GSTR1Validator()
        result = validator.validate_date("15-01-2024", 1)
        assert result is not None

    def test_invalid_date_format(self):
        """Test invalid date format."""
        validator = GSTR1Validator()
        result = validator.validate_date("32/01/2024", 1)  # Invalid day
        assert result is None

    def test_invalid_date_string(self):
        """Test invalid date string."""
        validator = GSTR1Validator()
        result = validator.validate_date("not-a-date", 1)
        assert result is None

    def test_empty_date(self):
        """Test empty date."""
        validator = GSTR1Validator()
        result = validator.validate_date("", 1)
        assert result is None
        result = validator.validate_date(None, 1)
        assert result is None

    def test_future_date(self):
        """Test future date validation."""
        validator = GSTR1Validator()
        # This should log a warning but still return the date
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y")
        result = validator.validate_date(future_date, 1)
        assert result is None  # Future dates are rejected


class TestPlaceOfSupplyValidation:
    """Tests for place of supply validation."""

    def test_valid_pos_with_state_name(self):
        """Test valid place of supply with state name."""
        validator = GSTR1Validator()
        assert validator.validate_place_of_supply("07-Delhi", 1) == "07-Delhi"
        assert validator.validate_place_of_supply("27-Maharashtra", 2) == "27-Maharashtra"

    def test_valid_pos_numeric(self):
        """Test valid place of supply as numeric code."""
        validator = GSTR1Validator()
        assert validator.validate_place_of_supply("07", 1) == "07"
        assert validator.validate_place_of_supply("27", 2) == "27"

    def test_valid_pos_96_for_exports(self):
        """Test valid place of supply 96 for exports."""
        validator = GSTR1Validator()
        assert validator.validate_place_of_supply("96-Other Countries", 1) == "96-Other Countries"

    def test_invalid_pos(self):
        """Test invalid place of supply."""
        validator = GSTR1Validator()
        assert validator.validate_place_of_supply("99-Invalid", 1) is None
        assert validator.validate_place_of_supply("00-State", 2) is None

    def test_empty_pos(self):
        """Test empty place of supply."""
        validator = GSTR1Validator()
        assert validator.validate_place_of_supply("", 1) is None
        assert validator.validate_place_of_supply(None, 1) is None


class TestTaxRateValidation:
    """Tests for tax rate validation."""

    def test_valid_standard_rates(self):
        """Test valid standard GST rates."""
        validator = GSTR1Validator()
        for rate in [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28]:
            result = validator.validate_tax_rate(rate, 1)
            assert result is not None

    def test_valid_custom_rates(self):
        """Test valid custom GST rates."""
        validator = GSTR1Validator()
        result = validator.validate_tax_rate(6, 1)
        assert result == 6.0
        result = validator.validate_tax_rate(9, 1)
        assert result == 9.0

    def test_negative_rate(self):
        """Test negative tax rate."""
        validator = GSTR1Validator()
        result = validator.validate_tax_rate(-5, 1)
        assert result is None

    def test_rate_over_100(self):
        """Test tax rate over 100%."""
        validator = GSTR1Validator()
        result = validator.validate_tax_rate(150, 1)
        assert result is None

    def test_invalid_rate_format(self):
        """Test invalid tax rate format."""
        validator = GSTR1Validator()
        result = validator.validate_tax_rate("invalid", 1)
        assert result is None

    def test_empty_rate(self):
        """Test empty tax rate."""
        validator = GSTR1Validator()
        result = validator.validate_tax_rate("", 1)
        assert result is None
        result = validator.validate_tax_rate(None, 1)
        assert result is None


class TestInvoiceValueValidation:
    """Tests for invoice value validation."""

    def test_valid_positive_value(self):
        """Test valid positive invoice value."""
        validator = GSTR1Validator()
        assert validator.validate_invoice_value(100000, 1) == 100000.0
        assert validator.validate_invoice_value(0.01, 2) == 0.01

    def test_zero_value(self):
        """Test zero invoice value."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_value(0, 1)
        assert result is None

    def test_negative_value(self):
        """Test negative invoice value."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_value(-1000, 1)
        assert result is None

    def test_invalid_value_format(self):
        """Test invalid invoice value format."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_value("invalid", 1)
        assert result is None

    def test_empty_value(self):
        """Test empty invoice value."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_value("", 1)
        assert result is None
        result = validator.validate_invoice_value(None, 1)
        assert result is None


class TestTaxAmountValidation:
    """Tests for tax amount validation."""

    def test_valid_interstate_igst(self):
        """Test valid IGST amount for inter-state supply."""
        validator = GSTR1Validator(company_gstin="07AAAAA1234A1ZA")
        # taxable_value=100000, rate=18%, inter-state to Maharashtra (27)
        is_valid = validator.validate_tax_amounts(
            taxable_value=100000,
            tax_rate=18,
            igst_amount=18000,
            cgst_amount=0,
            sgst_amount=0,
            cess_amount=0,
            row=1,
            place_of_supply="27-Maharashtra",
        )
        assert is_valid is True

    def test_invalid_interstate_igst(self):
        """Test invalid IGST amount for inter-state supply."""
        validator = GSTR1Validator(company_gstin="07AAAAA1234A1ZA")
        is_valid = validator.validate_tax_amounts(
            taxable_value=100000,
            tax_rate=18,
            igst_amount=10000,  # Wrong amount
            cgst_amount=0,
            sgst_amount=0,
            cess_amount=0,
            row=1,
            place_of_supply="27-Maharashtra",
        )
        assert is_valid is False
        assert len(validator.errors) > 0

    def test_valid_intra_state_cgst_sgst(self):
        """Test valid CGST+SGST for intra-state supply."""
        validator = GSTR1Validator(company_gstin="07AAAAA1234A1ZA")
        is_valid = validator.validate_tax_amounts(
            taxable_value=100000,
            tax_rate=18,
            igst_amount=0,
            cgst_amount=9000,
            sgst_amount=9000,
            cess_amount=0,
            row=1,
            place_of_supply="07-Delhi",  # Same state
        )
        assert is_valid is True

    def test_invalid_intra_state_with_igst(self):
        """Test invalid intra-state supply with IGST."""
        validator = GSTR1Validator(company_gstin="07AAAAA1234A1ZA")
        is_valid = validator.validate_tax_amounts(
            taxable_value=100000,
            tax_rate=18,
            igst_amount=18000,  # Should be 0 for intra-state
            cgst_amount=9000,
            sgst_amount=9000,
            cess_amount=0,
            row=1,
            place_of_supply="07-Delhi",
        )
        assert is_valid is False
        assert len(validator.errors) > 0

    def test_zero_taxable_value(self):
        """Test with zero taxable value (skip validation)."""
        validator = GSTR1Validator()
        is_valid = validator.validate_tax_amounts(
            taxable_value=0,
            tax_rate=18,
            igst_amount=0,
            cgst_amount=0,
            sgst_amount=0,
            cess_amount=0,
            row=1,
            place_of_supply="07-Delhi",
        )
        assert is_valid is True  # Skip for zero value


class TestInvoiceNumberValidation:
    """Tests for invoice number validation."""

    def test_valid_invoice_number(self):
        """Test valid invoice number."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_number("INV001", 1)
        assert result == "INV001"

    def test_valid_invoice_number_with_special_chars(self):
        """Test valid invoice number with special characters."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_number("INV-2024/001", 1)
        assert result == "INV-2024/001"

    def test_empty_invoice_number(self):
        """Test empty invoice number."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_number("", 1)
        assert result is None

    def test_invoice_number_too_long(self):
        """Test invoice number exceeding 16 characters."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_number("A" * 20, 1)
        assert result is None

    def test_invalid_characters_in_invoice_number(self):
        """Test invoice number with invalid characters."""
        validator = GSTR1Validator()
        result = validator.validate_invoice_number("INV@2024!", 1)
        assert result is None


class TestReverseChargeValidation:
    """Tests for reverse charge flag validation."""

    def test_valid_reverse_charge_y(self):
        """Test valid reverse charge 'Y'."""
        validator = GSTR1Validator()
        result = validator.validate_reverse_charge("Y", 1)
        assert result is True

    def test_valid_reverse_charge_n(self):
        """Test valid reverse charge 'N'."""
        validator = GSTR1Validator()
        result = validator.validate_reverse_charge("N", 1)
        assert result is False

    def test_invalid_reverse_charge(self):
        """Test invalid reverse charge value."""
        validator = GSTR1Validator()
        result = validator.validate_reverse_charge("Yes", 1)
        assert result is False

    def test_empty_reverse_charge(self):
        """Test empty reverse charge."""
        validator = GSTR1Validator()
        result = validator.validate_reverse_charge("", 1)
        assert result is False


class TestGSTR1ExcelProcessor:
    """Tests for GSTR-1 Excel processor."""

    def test_process_b2b_sheet(self, valid_b2b_excel):
        """Test processing valid B2B sheet."""
        processor = GSTR1ExcelProcessor()
        df = pd.read_excel(valid_b2b_excel, sheet_name="B2B")
        result = processor.process_b2b_sheet(df)
        
        assert len(result) == 2
        assert result[0]["invoice_no"] == "INV001"
        assert result[0]["items"][0]["taxable_value"] == 100000

    def test_process_empty_b2b_sheet(self, empty_excel):
        """Test processing empty B2B sheet."""
        processor = GSTR1ExcelProcessor()
        df = pd.read_excel(empty_excel, sheet_name="B2B")
        result = processor.process_b2b_sheet(df)
        
        assert len(result) == 0

    def test_classify_b2b_invoice(self):
        """Test B2B invoice classification."""
        processor = GSTR1ExcelProcessor()
        row = pd.Series({
            "GSTIN/UIN of Recipient": "07BZAAH6384P1ZH",
            "Place Of Supply": "27-Maharashtra",
            "Invoice Value": 100000,
        })
        
        result = processor.classify_invoice(row, company_gstin="07AAAAA1234A1ZA")
        assert result["category"] == "b2b"

    def test_classify_b2cl_invoice(self):
        """Test B2CL invoice classification."""
        processor = GSTR1ExcelProcessor()
        row = pd.Series({
            "GSTIN/UIN of Recipient": "NA",
            "Place Of Supply": "27-Maharashtra",
            "Invoice Value": 300000,  # > 2.5 lakh
        })
        
        result = processor.classify_invoice(row, company_gstin="07AAAAA1234A1ZA")
        assert result["category"] == "b2cl"

    def test_classify_b2cs_invoice(self):
        """Test B2CS invoice classification."""
        processor = GSTR1ExcelProcessor()
        row = pd.Series({
            "GSTIN/UIN of Recipient": "NA",
            "Place Of Supply": "27-Maharashtra",
            "Invoice Value": 5000,  # < 2.5 lakh
        })
        
        result = processor.classify_invoice(row, company_gstin="07AAAAA1234A1ZA")
        assert result["category"] == "b2cs"

    def test_classify_export_invoice(self):
        """Test export invoice classification."""
        processor = GSTR1ExcelProcessor()
        row = pd.Series({
            "GSTIN/UIN of Recipient": "",
            "Place Of Supply": "96-Other Countries",
            "Invoice Value": 100000,
        })
        
        result = processor.classify_invoice(row, company_gstin="07AAAAA1234A1ZA")
        assert result["category"] == "exp"


class TestProcessGSTR1Excel:
    """Tests for main process_gstr1_excel function."""

    def test_process_valid_excel(self, valid_full_excel):
        """Test processing valid Excel file."""
        content = valid_full_excel.getvalue()
        result = process_gstr1_excel(content)
        
        assert result["b2b_count"] == 2
        assert result["b2cl_count"] == 2
        assert result["b2cs_count"] == 2
        assert result["export_count"] == 2
        assert result["validation_summary"]["total_errors"] == 0

    def test_process_invalid_gstin_excel(self, invalid_gstin_excel):
        """Test processing Excel with invalid GSTINs."""
        content = invalid_gstin_excel.getvalue()
        result = process_gstr1_excel(content)
        
        assert result["validation_summary"]["total_errors"] > 0

    def test_process_missing_mandatory_excel(self, missing_mandatory_excel):
        """Test processing Excel with missing mandatory fields."""
        content = missing_mandatory_excel.getvalue()
        result = process_gstr1_excel(content)
        
        assert result["validation_summary"]["total_errors"] > 0

    def test_process_empty_excel(self, empty_excel):
        """Test processing empty Excel file."""
        content = empty_excel.getvalue()
        result = process_gstr1_excel(content)
        
        assert result["b2b_count"] == 0
        assert result["validation_summary"]["total_errors"] == 0


class TestValidationSummary:
    """Tests for validation summary."""

    def test_get_validation_summary_no_errors(self):
        """Test validation summary with no errors."""
        validator = GSTR1Validator()
        summary = validator.get_validation_summary()
        
        assert summary["total_errors"] == 0
        assert summary["total_warnings"] == 0
        assert summary["is_valid"] is True

    def test_get_validation_summary_with_errors(self):
        """Test validation summary with errors."""
        validator = GSTR1Validator()
        validator.validate_gstin("INVALID", 1)
        validator.validate_gstin("", 2)
        
        summary = validator.get_validation_summary()
        
        assert summary["total_errors"] == 2
        assert summary["is_valid"] is False
        assert len(summary["errors"]) == 2
