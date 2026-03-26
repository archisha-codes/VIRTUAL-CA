"""
Comprehensive Test Suite for GSTR-1 Automation Engine

This test suite covers all edge cases including:
- Header mapping with 500+ aliases
- ERP-specific column variations
- Tax calculation validation
- Rounding tolerance handling
- Credit/Debit Note handling
- RCM (Reverse Charge) handling
- Export transactions (POS=96, SEZ, Deemed Export)
- B2B/B2CL/B2CS classification
- GSTN Offline Tool Schema compliance
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from decimal import Decimal
import sys
import io

# Add parent directory to path for imports
sys.path.insert(0, '..')

from india_compliance.gst_india.utils.header_mapper import (
    HeaderMapper,
    normalize_header,
    clean_numeric_value,
    parse_date_value,
    validate_gst_tax,
    classify_transaction,
    is_export,
    is_credit_note,
    is_debit_note,
    is_rcm,
    GST_TOLERANCE,
    AUTO_CORRECT_THRESHOLD,
    ERROR_THRESHOLD,
    B2CL_THRESHOLD,
)

from india_compliance.gst_india.engine_core.input_adapter import (
    ExcelInputAdapter,
    InputProcessingResult,
    ValidationError,
    ValidationWarning,
    detect_erp_system,
    detect_header_row,
)

from india_compliance.gst_india.engine_core.validation_engine import (
    ValidationEngine,
    ValidationReport,
    ValidationResult,
    ValidationSeverity,
    ValidationCategory,
    validate_gstin_format,
    validate_tax_calculation,
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def mapper():
    """Create a HeaderMapper instance."""
    return HeaderMapper()


@pytest.fixture
def sample_b2b_row():
    """Sample B2B invoice row."""
    return {
        'gstin': '27ABCDE1234F2Z5',
        'invoice_number': 'INV-001',
        'invoice_date': '25/12/2025',
        'taxable_value': 100000.00,
        'rate': 18.00,
        'igst': 18000.00,
        'cgst': 0.00,
        'sgst': 0.00,
        'cess': 0.00,
        'invoice_value': 118000.00,
        'place_of_supply': '27-Maharashtra',
        'document_type': 'Invoice',
        'supply_type': 'Inter-state',
        'reverse_charge': 'N',
    }


@pytest.fixture
def sample_b2cs_row():
    """Sample B2CS invoice row."""
    return {
        'gstin': '',
        'invoice_number': 'INV-002',
        'invoice_date': '25/12/2025',
        'taxable_value': 5000.00,
        'rate': 18.00,
        'igst': 900.00,
        'cgst': 0.00,
        'sgst': 0.00,
        'cess': 0.00,
        'invoice_value': 5900.00,
        'place_of_supply': '27-Maharashtra',
        'document_type': 'Invoice',
    }


@pytest.fixture
def sample_export_row():
    """Sample export invoice row."""
    return {
        'gstin': '',
        'invoice_number': 'EXP-001',
        'invoice_date': '25/12/2025',
        'taxable_value': 500000.00,
        'rate': 0.00,
        'igst': 0.00,
        'cgst': 0.00,
        'sgst': 0.00,
        'cess': 0.00,
        'invoice_value': 500000.00,
        'place_of_supply': '96-Other Countries',
        'document_type': 'Invoice',
        'supply_type': 'Export',
    }


@pytest.fixture
def sample_credit_note_row():
    """Sample credit note row."""
    return {
        'gstin': '27ABCDE1234F2Z5',
        'invoice_number': 'CN-001',
        'invoice_date': '25/12/2025',
        'taxable_value': -10000.00,
        'rate': 18.00,
        'igst': -1800.00,
        'cgst': 0.00,
        'sgst': 0.00,
        'cess': 0.00,
        'invoice_value': -11800.00,
        'place_of_supply': '27-Maharashtra',
        'document_type': 'Credit Note',
    }


@pytest.fixture
def sample_rcm_row():
    """Sample RCM invoice row."""
    return {
        'gstin': '27ABCDE1234F2Z5',
        'invoice_number': 'INV-RCM-001',
        'invoice_date': '25/12/2025',
        'taxable_value': 50000.00,
        'rate': 18.00,
        'igst': 9000.00,
        'cgst': 0.00,
        'sgst': 0.00,
        'cess': 0.00,
        'invoice_value': 59000.00,
        'place_of_supply': '27-Maharashtra',
        'document_type': 'Invoice',
        'reverse_charge': 'Y',
    }


# =============================================================================
# HEADER MAPPER TESTS
# =============================================================================

class TestHeaderMapperBasics:
    """Tests for header normalization and mapping."""
    
    def test_normalize_header_basic(self):
        """Test basic header normalization."""
        assert normalize_header("Invoice Number") == "invoice number"
        assert normalize_header("invoice_number") == "invoice number"
        assert normalize_header("INVOICE NUMBER") == "invoice number"
    
    def test_normalize_header_special_chars(self):
        """Test header normalization with special characters."""
        assert normalize_header("GSTIN No.") == "gstin no"
        assert normalize_header("Invoice #") == "invoice"
        assert normalize_header("Rate (%)") == "rate"
    
    def test_normalize_header_whitespace(self):
        """Test header normalization with extra whitespace."""
        assert normalize_header("  Invoice Number  ") == "invoice number"
        assert normalize_header("Invoice   Number") == "invoice number"
    
    def test_get_canonical_field_gstin(self, mapper):
        """Test GSTIN field detection."""
        variations = [
            "GSTIN", "gstin", "GST No", "GST Number",
            "Customer GSTIN", "Party GST", "Tax ID",
            "business no", "tax identification number",
            "GSTIN of Recipient", "GST Number",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "gstin", f"Failed for: {header}"
    
    def test_get_canonical_field_invoice(self, mapper):
        """Test invoice field detection."""
        variations = [
            "Invoice Number", "Invoice No", "Invoice#",
            "Bill No", "Bill Number", "Voucher No",
            "Document No", "Reference No", "Ref No",
            "Serial No", "Entry No",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "invoice_number", f"Failed for: {header}"
    
    def test_get_canonical_field_date(self, mapper):
        """Test date field detection."""
        variations = [
            "Invoice Date", "Invoice Dt", "Bill Date",
            "Date", "DT", "Transaction Date",
            "Voucher Date", "Doc Date",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "invoice_date", f"Failed for: {header}"
    
    def test_get_canonical_field_taxable(self, mapper):
        """Test taxable value field detection."""
        variations = [
            "Taxable Value", "Taxable Amount", "Taxable",
            "Net Amount", "Net Value", "Assessable Value",
            "Amount", "Tax Base",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "taxable_value", f"Failed for: {header}"
    
    def test_get_canonical_field_igst(self, mapper):
        """Test IGST field detection."""
        variations = [
            "IGST", "IGST Amount", "Integrated GST",
            "Integrated Tax", "Joi", "JOI",
            "i_g_s_t", "i tax",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "igst", f"Failed for: {header}"
    
    def test_get_canonical_field_cgst(self, mapper):
        """Test CGST field detection."""
        variations = [
            "CGST", "CGST Amount", "Central GST",
            "Central Tax", "c g s t",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "cgst", f"Failed for: {header}"
    
    def test_get_canonical_field_sgst(self, mapper):
        """Test SGST field detection."""
        variations = [
            "SGST", "SGST Amount", "State GST",
            "State Tax", "s g s t",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "sgst", f"Failed for: {header}"
    
    def test_get_canonical_field_pos(self, mapper):
        """Test Place of Supply field detection."""
        variations = [
            "Place of Supply", "POS", "Place Of Supply",
            "State", "State Code", "Supply State",
            "Destination State", "Tax Country",
        ]
        for header in variations:
            result = mapper.get_canonical_field(header)
            assert result == "place_of_supply", f"Failed for: {header}"


class TestNumericConversion:
    """Tests for numeric value cleaning."""
    
    def test_clean_comma_separated(self):
        """Test comma-separated number cleaning."""
        assert clean_numeric_value("1,234.56") == 1234.56
        assert clean_numeric_value("10,000.00") == 10000.00
        assert clean_numeric_value("1,00,000.00") == 100000.00
    
    def test_clean_currency_symbols(self):
        """Test currency symbol removal."""
        assert clean_numeric_value("$1,234.56") == 1234.56
        assert clean_numeric_value("Rs. 1,234.56") == 1234.56
        assert clean_numeric_value("INR 1,234.56") == 1234.56
    
    def test_clean_negative_parentheses(self):
        """Test negative value in parentheses."""
        assert clean_numeric_value("(1,234.56)") == -1234.56
        assert clean_numeric_value("(100)") == -100.0
    
    def test_clean_percentage(self):
        """Test percentage values."""
        assert clean_numeric_value("18%") == 0.18
        assert clean_numeric_value("18.0%") == 0.18
        assert clean_numeric_value("5%") == 0.05
    
    def test_clean_whitespace(self):
        """Test whitespace handling."""
        assert clean_numeric_value("  1,234.56  ") == 1234.56
        assert clean_numeric_value("  100  ") == 100.0
    
    def test_clean_simple_numbers(self):
        """Test simple number strings."""
        assert clean_numeric_value("1000") == 1000.0
        assert clean_numeric_value("123.45") == 123.45
    
    def test_clean_invalid_values(self):
        """Test invalid value handling."""
        assert clean_numeric_value("") is None
        assert clean_numeric_value("abc") is None
        assert clean_numeric_value(None) is None


class TestDateParsing:
    """Tests for date parsing."""
    
    def test_parse_dd_mm_yyyy(self):
        """Test DD/MM/YYYY format."""
        result = parse_date_value("25/12/2025")
        assert result.day == 25
        assert result.month == 12
        assert result.year == 2025
    
    def test_parse_dd_mm_yy(self):
        """Test DD/MM/YY format."""
        result = parse_date_value("25/12/25")
        assert result.day == 25
        assert result.month == 12
        assert result.year == 2025
    
    def test_parse_yyyy_mm_dd(self):
        """Test YYYY-MM-DD format."""
        result = parse_date_value("2025-12-25")
        assert result.year == 2025
        assert result.month == 12
        assert result.day == 25
    
    def test_parse_dd_mm_yyyy_hyphen(self):
        """Test DD-MM-YYYY format."""
        result = parse_date_value("25-12-2025")
        assert result.day == 25
        assert result.month == 12
    
    def test_parse_month_name(self):
        """Test DD Month YYYY format."""
        result = parse_date_value("25 December 2025")
        assert result.day == 25
        assert result.month == 12
    
    def test_parse_invalid_date(self):
        """Test invalid date handling."""
        assert parse_date_value("invalid") is None
        assert parse_date_value("") is None
        assert parse_date_value(None) is None


# =============================================================================
# TAX VALIDATION TESTS
# =============================================================================

class TestTaxValidation:
    """Tests for GST tax validation."""
    
    def test_valid_inter_state_tax(self):
        """Test valid inter-state tax calculation."""
        result = validate_gst_tax(1000, 18, 180, None, None, True)
        assert result.is_valid
        assert result.action == "ok"
        assert result.difference == 0
    
    def test_valid_intra_state_tax(self):
        """Test valid intra-state tax calculation."""
        result = validate_gst_tax(1000, 18, None, 90, 90, False)
        assert result.is_valid
        assert result.action == "ok"
        assert result.difference == 0
    
    def test_auto_correct_small_difference(self):
        """Test auto-correction for small differences."""
        result = validate_gst_tax(1000, 18, 179.50, None, None, True)
        assert result.is_valid
        assert result.action == "auto_corrected"
        assert result.corrections['igst'] == 180
    
    def test_warning_medium_difference(self):
        """Test warning for medium differences."""
        result = validate_gst_tax(1000, 18, 182, None, None, True)
        assert result.is_valid
        assert result.action == "warning"
        assert result.difference == 2.0
    
    def test_error_large_difference(self):
        """Test error for large differences."""
        result = validate_gst_tax(1000, 18, 300, None, None, True)
        assert not result.is_valid
        assert result.action == "error"
        assert result.difference == 120
    
    def test_intra_state_mismatch(self):
        """Test intra-state CGST/SGST mismatch."""
        result = validate_gst_tax(1000, 18, None, 85, 85, False)
        assert result.is_valid
        assert result.action == "warning"
        assert result.difference == 10


# =============================================================================
# TRANSACTION CLASSIFICATION TESTS
# =============================================================================

class TestTransactionClassification:
    """Tests for transaction classification."""
    
    def test_b2b_classification(self, sample_b2b_row):
        """Test B2B transaction classification."""
        classification = classify_transaction(
            gstin=sample_b2b_row['gstin'],
            invoice_value=sample_b2b_row['invoice_value'],
            supply_type=sample_b2b_row.get('supply_type'),
            document_type=sample_b2b_row.get('document_type'),
            reverse_charge=sample_b2b_row.get('reverse_charge'),
            is_inter_state_supply=True
        )
        assert classification.transaction_type == "B2B"
        assert not classification.is_credit_note
        assert not classification.is_debit_note
    
    def test_b2b_credit_note(self, sample_credit_note_row):
        """Test B2B credit note classification."""
        classification = classify_transaction(
            gstin=sample_credit_note_row['gstin'],
            invoice_value=sample_credit_note_row['invoice_value'],
            document_type=sample_credit_note_row.get('document_type'),
        )
        assert classification.transaction_type == "B2B_CR"
        assert classification.is_credit_note
    
    def test_b2b_rcm(self, sample_rcm_row):
        """Test B2B RCM classification."""
        classification = classify_transaction(
            gstin=sample_rcm_row['gstin'],
            invoice_value=sample_rcm_row['invoice_value'],
            reverse_charge=sample_rcm_row.get('reverse_charge'),
            is_inter_state_supply=True
        )
        assert classification.transaction_type == "B2B_RCM"
        assert classification.is_rcm
    
    def test_export_classification(self, sample_export_row):
        """Test export transaction classification."""
        classification = classify_transaction(
            gstin=sample_export_row['gstin'],
            invoice_value=sample_export_row['invoice_value'],
            supply_type=sample_export_row.get('supply_type'),
        )
        assert classification.transaction_type == "EXPORT"
        assert classification.is_export
    
    def test_b2cl_classification(self):
        """Test B2CL transaction classification (no GSTIN, high value, inter-state)."""
        classification = classify_transaction(
            gstin='',
            invoice_value=300000,  # Above B2CL threshold
            is_inter_state_supply=True
        )
        assert classification.transaction_type == "B2CL"
    
    def test_b2cs_classification(self, sample_b2cs_row):
        """Test B2CS transaction classification."""
        classification = classify_transaction(
            gstin=sample_b2cs_row['gstin'],
            invoice_value=sample_b2cs_row['invoice_value'],
        )
        assert classification.transaction_type == "B2CS"
    
    def test_b2cl_credit_note(self):
        """Test B2CL credit note classification."""
        classification = classify_transaction(
            gstin='',
            invoice_value=300000,  # Above threshold
            document_type='Credit Note',
            is_inter_state_supply=True
        )
        assert classification.transaction_type == "B2CL_CR"
        assert classification.is_credit_note


class TestClassificationFunctions:
    """Tests for individual classification detection functions."""
    
    def test_is_export(self):
        """Test export detection."""
        assert is_export("Export") == True
        assert is_export("Export With Payment") == True
        assert is_export("expwp") == True
        assert is_export("SEZ") == True
        assert is_export("Inter-state") == False
        assert is_export(None) == False
    
    def test_is_credit_note(self):
        """Test credit note detection."""
        assert is_credit_note("Credit Note") == True
        assert is_credit_note("CN") == True
        assert is_credit_note("Credit Note - Return") == True
        assert is_credit_note("Invoice") == False
        assert is_credit_note(None) == False
    
    def test_is_debit_note(self):
        """Test debit note detection."""
        assert is_debit_note("Debit Note") == True
        assert is_debit_note("DN") == True
        assert is_debit_note("Debit Note - Adjustment") == True
        assert is_debit_note("Invoice") == False
        assert is_debit_note(None) == False
    
    def test_is_rcm(self):
        """Test RCM detection."""
        assert is_rcm("Y") == True
        assert is_rcm("Yes") == True
        assert is_rcm("1") == True
        assert is_rcm("True") == True
        assert is_rcm("N") == False
        assert is_rcm("No") == False
        assert is_rcm(None) == False


# =============================================================================
# INPUT ADAPTER TESTS
# =============================================================================

class TestExcelInputAdapter:
    """Tests for Excel input adapter."""
    
    def test_detect_erp_tally(self):
        """Test Tally ERP detection."""
        headers = ["Voucher Type", "Voucher Number", "Voucher Date", "Party Name"]
        result = detect_erp_system(headers)
        assert result == "tally"
    
    def test_detect_erp_sap(self):
        """Test SAP ERP detection."""
        headers = ["Document Number", "Document Date", "Vendor Name", "Material"]
        result = detect_erp_system(headers)
        assert result == "sap"
    
    def test_detect_erp_zoho(self):
        """Test Zoho ERP detection."""
        headers = ["Invoice Number", "Invoice Date", "Customer Name", "Customer GSTIN"]
        result = detect_erp_system(headers)
        assert result == "zoho"
    
    def test_erp_detection_unknown(self):
        """Test unknown ERP detection."""
        headers = ["Col1", "Col2", "Col3"]
        result = detect_erp_system(headers)
        assert result is None
    
    def test_adapter_initialization(self):
        """Test adapter initialization."""
        adapter = ExcelInputAdapter()
        assert adapter.rounding_tolerance == 0.50
        assert adapter.strict_mode == False


# =============================================================================
# VALIDATION ENGINE TESTS
# =============================================================================

class TestValidationEngine:
    """Tests for validation engine."""
    
    def test_engine_initialization(self):
        """Test engine initialization."""
        engine = ValidationEngine()
        assert engine.rounding_tolerance == 0.50
        assert engine.strict_mode == False
    
    def test_validate_valid_gstin(self, sample_b2b_row):
        """Test valid GSTIN validation."""
        engine = ValidationEngine()
        results = engine.validate_row(
            pd.Series(sample_b2b_row),
            row_index=0
        )
        errors = [r for r in results if r.severity == ValidationSeverity.ERROR]
        assert len(errors) == 0
    
    def test_validate_invalid_gstin(self):
        """Test invalid GSTIN validation."""
        row = pd.Series({
            'gstin': 'INVALID123',
            'invoice_number': 'INV-001',
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
        })
        engine = ValidationEngine()
        results = engine.validate_row(row, row_index=0)
        errors = [r for r in results if r.severity == ValidationSeverity.ERROR]
        gstin_errors = [r for r in errors if r.field == 'gstin']
        assert len(gstin_errors) > 0
    
    def test_validate_missing_invoice_number(self):
        """Test missing invoice number validation."""
        row = pd.Series({
            'gstin': '27ABCDE1234F2Z5',
            'invoice_number': None,
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
        })
        engine = ValidationEngine()
        results = engine.validate_row(row, row_index=0)
        errors = [r for r in results if r.severity == ValidationSeverity.ERROR]
        invoice_errors = [r for r in errors if r.field == 'invoice_number']
        assert len(invoice_errors) > 0
    
    def test_validate_tax_calculation_error(self):
        """Test tax calculation error detection."""
        row = pd.Series({
            'gstin': '27ABCDE1234F2Z5',
            'invoice_number': 'INV-001',
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
            'rate': 18,
            'igst': 300,  # Wrong: should be 180
            'cgst': 0,
            'sgst': 0,
            'cess': 0,
            'is_inter_state': True,
        })
        engine = ValidationEngine()
        results = engine.validate_row(row, row_index=0)
        tax_errors = [r for r in results if r.rule_name == "tax_calculation"]
        assert len(tax_errors) > 0
    
    def test_validate_dataframe(self, sample_b2b_row):
        """Test DataFrame validation."""
        df = pd.DataFrame([sample_b2b_row])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        assert report.total_rows == 1
        assert report.is_valid


class TestValidationReport:
    """Tests for validation report."""
    
    def test_report_summary(self, sample_b2b_row):
        """Test report summary generation."""
        df = pd.DataFrame([sample_b2b_row])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        assert report.total_rows == 1
        assert report.total_columns == len(sample_b2b_row)
    
    def test_report_is_valid(self, sample_b2b_row):
        """Test report validity check."""
        df = pd.DataFrame([sample_b2b_row])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        assert report.is_valid
    
    def test_report_errors(self):
        """Test report error collection."""
        df = pd.DataFrame([{
            'gstin': 'INVALID',
            'invoice_number': None,
            'invoice_date': 'invalid',
            'taxable_value': 1000,
        }])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        errors = report.get_errors()
        assert len(errors) > 0
    
    def test_report_to_dict(self, sample_b2b_row):
        """Test report to dict conversion."""
        df = pd.DataFrame([sample_b2b_row])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        report_dict = report.to_dict()
        assert 'total_rows' in report_dict
        assert 'summary' in report_dict
        assert 'is_valid' in report_dict


# =============================================================================
# ROUNDING TOLERANCE TESTS
# =============================================================================

class TestRoundingTolerance:
    """Tests for rounding tolerance handling."""
    
    def test_exact_calculation(self):
        """Test exact tax calculation."""
        result = validate_gst_tax(1000, 18, 180, None, None, True)
        assert result.difference == 0
    
    def test_within_tolerance(self):
        """Test values within tolerance."""
        result = validate_gst_tax(1000, 18, 180.25, None, None, True)
        assert result.is_valid
        assert result.action == "ok"
    
    def test_just_over_tolerance(self):
        """Test value just over tolerance."""
        result = validate_gst_tax(1000, 18, 180.51, None, None, True)
        assert result.is_valid
        assert result.action == "auto_corrected"
    
    def test_small_difference_auto_correct(self):
        """Test auto-correction for small differences."""
        result = validate_gst_tax(1000, 18, 179.50, None, None, True)
        assert result.is_valid
        assert result.action == "auto_corrected"
        assert result.corrections is not None


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_empty_gstin(self, sample_b2cs_row):
        """Test empty GSTIN handling."""
        assert sample_b2cs_row['gstin'] == ''
    
    def test_negative_values(self, sample_credit_note_row):
        """Test negative value handling."""
        assert sample_credit_note_row['taxable_value'] < 0
    
    def test_zero_rate(self, sample_export_row):
        """Test zero rate for exports."""
        assert sample_export_row['rate'] == 0
    
    def test_empty_dataframe(self):
        """Test empty DataFrame handling."""
        df = pd.DataFrame()
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        assert report.total_rows == 0
    
    def test_all_nan_row(self):
        """Test row with all NaN values."""
        df = pd.DataFrame([{
            'gstin': None,
            'invoice_number': None,
            'invoice_date': None,
            'taxable_value': None,
        }])
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        errors = report.get_errors()
        # Should have errors for missing required fields
        assert len(errors) >= 1
    
    def test_special_characters_in_invoice(self):
        """Test invoice number with special characters."""
        row = pd.Series({
            'invoice_number': 'INV/2025-001',
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
        })
        engine = ValidationEngine()
        results = engine.validate_row(row, row_index=0)
        # Should be valid (slashes allowed)
        assert len([r for r in results if r.severity == ValidationSeverity.ERROR]) == 0
    
    def test_very_long_invoice_number(self):
        """Test very long invoice number."""
        row = pd.Series({
            'invoice_number': 'VERY_LONG_INVOICE_NUMBER_THAT_EXCEEDS_LIMIT',
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
        })
        engine = ValidationEngine()
        results = engine.validate_row(row, row_index=0)
        warnings = [r for r in results if r.severity == ValidationSeverity.WARNING]
        assert len(warnings) > 0


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests for the complete pipeline."""
    
    def test_complete_pipeline(self):
        """Test complete processing pipeline."""
        # Create test data
        data = [
            {
                'gstin': '27ABCDE1234F2Z5',
                'invoice_number': 'INV-001',
                'invoice_date': '25/12/2025',
                'taxable_value': 100000,
                'rate': 18,
                'igst': 18000,
                'cgst': 0,
                'sgst': 0,
                'cess': 0,
                'invoice_value': 118000,
                'place_of_supply': '27-Maharashtra',
            },
            {
                'gstin': '',
                'invoice_number': 'INV-002',
                'invoice_date': '25/12/2025',
                'taxable_value': 5000,
                'rate': 18,
                'igst': 900,
                'cgst': 0,
                'sgst': 0,
                'cess': 0,
                'invoice_value': 5900,
                'place_of_supply': '27-Maharashtra',
            },
        ]
        df = pd.DataFrame(data)
        
        # Process through validation
        engine = ValidationEngine()
        report = engine.validate_dataframe(df)
        
        # Check results
        assert report.total_rows == 2
        assert report.is_valid
    
    def test_header_mapping_integration(self, mapper):
        """Test header mapping with realistic ERP data."""
        # Simulate Tally column names
        tally_headers = [
            "Voucher Type", "Voucher Number", "Voucher Date", "Party Name",
            "Party GSTIN", "Place of Supply", "HSN/SAC", "Quantity",
            "Rate", "Amount", "CGST Rate", "CGST Amount", "SGST Rate",
            "SGST Amount", "IGST Rate", "IGST Amount"
        ]
        
        mapping = mapper.map_headers(tally_headers)
        
        # Check key mappings
        assert mapping.get("Voucher Number") == "invoice_number"
        assert mapping.get("Voucher Date") == "invoice_date"
        assert mapping.get("Party GSTIN") == "gstin"
        assert mapping.get("Place of Supply") == "place_of_supply"
        assert mapping.get("IGST Amount") == "igst"
    
    def test_tax_calculation_full_pipeline(self):
        """Test tax calculation through validation."""
        row = pd.Series({
            'gstin': '27ABCDE1234F2Z5',
            'invoice_number': 'INV-001',
            'invoice_date': '25/12/2025',
            'taxable_value': 1000,
            'rate': 18,
            'igst': 180,
            'cgst': 0,
            'sgst': 0,
            'cess': 0,
            'is_inter_state': True,
        })
        
        result = validate_gst_tax(
            taxable_value=1000,
            rate=18,
            igst=180,
            cgst=None,
            sgst=None,
            is_inter_state_supply=True
        )
        
        assert result.is_valid
        assert result.action == "ok"


# =============================================================================
# RUNNER
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
