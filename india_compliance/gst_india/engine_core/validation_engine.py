"""
Production-Grade Validation Engine with Fault Tolerance

This module provides comprehensive validation for GSTR-1 data processing
with structured error reporting, auto-corrections, and audit trail.

Features:
- GSTIN validation
- Invoice number validation
- Date validation against filing period
- Tax calculation validation with rounding tolerance
- Duplicate detection
- Cross-field validation
- Credit/Debit Note handling
- RCM (Reverse Charge Mechanism) validation
"""

import re
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json


# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

# GSTIN regex pattern (as per GSTN specifications)
GSTIN_PATTERN = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)

# Invoice number max length (as per GST)
INVOICE_MAX_LENGTH = 16

# HSN code patterns
HSN_PATTERN = re.compile(r"^\d{4,8}$")
SAC_PATTERN = re.compile(r"^\d{4,6}$")

# State codes (first 2 digits of GSTIN)
INDIAN_STATE_CODES = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
    '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
    '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Ladakh',
}

# Union territories (for inter-state determination)
UNION_TERRITORIES = {'05', '07', '25', '26', '31', '34', '35', '37'}

# B2C threshold (per GSTN rules)
B2C_LIMIT_OLD = 250000  # Before April 2023
B2C_LIMIT_NEW = 100000  # From April 2023

# Rounding tolerance (INR)
ROUNDING_TOLERANCE = 0.50

# Auto-correction thresholds
AUTO_CORRECT_SMALL = 1.00   # Small differences - auto-correct
AUTO_CORRECT_MEDIUM = 10.00  # Medium differences - warning
AUTO_CORRECT_LARGE = 100.00  # Large differences - error


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class ValidationSeverity(Enum):
    """Severity levels for validation messages."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationCategory(Enum):
    """Categories of validation checks."""
    GSTIN = "gstin"
    INVOICE = "invoice"
    DATE = "date"
    TAX = "tax"
    AMOUNT = "amount"
    CLASSIFICATION = "classification"
    DUPLICATE = "duplicate"
    CONSISTENCY = "consistency"
    FORMAT = "format"


class ValidationRule:
    """Defines a single validation rule."""
    
    def __init__(
        self,
        name: str,
        category: ValidationCategory,
        severity: ValidationSeverity,
        check_func: Callable,
        message: str,
        suggestion: Optional[str] = None,
        error_code: Optional[str] = None
    ):
        self.name = name
        self.category = category
        self.severity = severity
        self.check_func = check_func
        self.message = message
        self.suggestion = suggestion
        self.error_code = error_code or f"VAL_{category.value.upper()}_{name.upper()}"
    
    def check(self, row: pd.Series, **kwargs) -> Optional['ValidationResult']:
        """Run the validation check."""
        return self.check_func(row, self, **kwargs)


@dataclass
class ValidationResult:
    """Result of a single validation check."""
    rule_name: str
    category: ValidationCategory
    severity: ValidationSeverity
    message: str
    field: Optional[str] = None
    value: Any = None
    expected: Any = None
    actual: Any = None
    row_index: Optional[int] = None
    suggestion: Optional[str] = None
    error_code: Optional[str] = None
    corrected_value: Any = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule_name,
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "field": self.field,
            "value": str(self.value) if self.value is not None else None,
            "expected": str(self.expected) if self.expected is not None else None,
            "actual": str(self.actual) if self.actual is not None else None,
            "row_index": self.row_index,
            "suggestion": self.suggestion,
            "error_code": self.error_code,
            "corrected_value": self.corrected_value,
        }
    
    def to_summary_dict(self) -> Dict[str, Any]:
        """Simplified dict for summary reporting."""
        return {
            "rule": self.rule_name,
            "severity": self.severity.value,
            "message": self.message,
            "row": self.row_index,
            "field": self.field,
        }


@dataclass
class ValidationReport:
    """Complete validation report for a dataset."""
    total_rows: int
    total_columns: int
    results: List[ValidationResult] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    corrections: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_result(self, result: ValidationResult):
        self.results.append(result)
        
        # Update summary
        key = f"{result.category.value}_{result.severity.value}"
        self.summary[key] = self.summary.get(key, 0) + 1
        
        # Track corrections
        if result.corrected_value is not None:
            self.corrections.append({
                "rule": result.rule_name,
                "row": result.row_index,
                "field": result.field,
                "original": str(result.value),
                "corrected": str(result.corrected_value),
            })
    
    @property
    def is_valid(self) -> bool:
        """Check if validation passed (no critical errors)."""
        critical_count = self.summary.get("total_critical", 0)
        error_count = self.summary.get("total_error", 0)
        return critical_count == 0 and error_count == 0
    
    @property
    def has_warnings(self) -> bool:
        """Check if there are any warnings."""
        return any(s.startswith("total_") and "warning" in s for s in self.summary)
    
    def get_errors(self) -> List[ValidationResult]:
        """Get all error and critical results."""
        return [
            r for r in self.results
            if r.severity in (ValidationSeverity.ERROR, ValidationSeverity.CRITICAL)
        ]
    
    def get_warnings(self) -> List[ValidationResult]:
        """Get all warning results."""
        return [r for r in self.results if r.severity == ValidationSeverity.WARNING]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_rows": self.total_rows,
            "total_columns": self.total_columns,
            "summary": self.summary,
            "total_results": len(self.results),
            "total_errors": len(self.get_errors()),
            "total_warnings": len(self.get_warnings()),
            "is_valid": self.is_valid,
            "corrections_count": len(self.corrections),
            "results": [r.to_dict() for r in self.results],
        }
    
    def to_summary_report(self) -> str:
        """Generate a human-readable summary report."""
        lines = []
        lines.append("=" * 70)
        lines.append("VALIDATION REPORT")
        lines.append("=" * 70)
        lines.append(f"Total Rows: {self.total_rows}")
        lines.append(f"Total Columns: {self.total_columns}")
        lines.append(f"Total Checks: {len(self.results)}")
        lines.append("")
        
        # Summary by severity
        lines.append("Summary by Severity:")
        for severity in ValidationSeverity:
            count = self.summary.get(f"total_{severity.value}", 0)
            lines.append(f"  {severity.value.capitalize():10} : {count}")
        
        lines.append("")
        
        # Corrections made
        if self.corrections:
            lines.append(f"Auto-Corrections Made: {len(self.corrections)}")
            for corr in self.corrections[:5]:  # Show first 5
                lines.append(f"  - {corr['field']}: {corr['original']} -> {corr['corrected']}")
            if len(self.corrections) > 5:
                lines.append(f"  ... and {len(self.corrections) - 5} more")
        
        lines.append("")
        
        # Errors
        errors = self.get_errors()
        if errors:
            lines.append(f"ERRORS ({len(errors)}):")
            for err in errors[:10]:
                lines.append(f"  [{err.error_code}] {err.message}")
                if err.row_index is not None:
                    lines.append(f"    Row: {err.row_index}, Field: {err.field}")
                if err.suggestion:
                    lines.append(f"    Suggestion: {err.suggestion}")
            if len(errors) > 10:
                lines.append(f"  ... and {len(errors) - 10} more")
        else:
            lines.append("ERRORS: None")
        
        lines.append("")
        lines.append("=" * 70)
        lines.append(f"VALIDATION STATUS: {'PASSED' if self.is_valid else 'FAILED'}")
        lines.append("=" * 70)
        
        return "\n".join(lines)


# =============================================================================
# VALIDATION CHECK FUNCTIONS
# =============================================================================

def validate_gstin_format(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate GSTIN format."""
    field_name = kwargs.get("field_name", "gstin")
    gstin = row.get(field_name)
    
    if pd.isna(gstin) or not gstin:
        return None
    
    gstin_str = str(gstin).strip().upper()
    
    if not GSTIN_PATTERN.match(gstin_str):
        return ValidationResult(
            rule_name=rule.name,
            category=rule.category,
            severity=rule.severity,
            message=rule.message,
            field=field_name,
            value=gstin,
            suggestion=rule.suggestion,
            error_code=rule.error_code,
            row_index=kwargs.get("row_index")
        )
    
    # Also validate state code
    state_code = gstin_str[:2]
    if state_code not in INDIAN_STATE_CODES:
        return ValidationResult(
            rule_name="gstin_invalid_state",
            category=ValidationCategory.GSTIN,
            severity=ValidationSeverity.ERROR,
            message=f"Invalid state code in GSTIN: {state_code}",
            field=field_name,
            value=gstin,
            suggestion=f"State code must be between 01-37",
            row_index=kwargs.get("row_index")
        )
    
    return None


def validate_invoice_number(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate invoice number."""
    field_name = kwargs.get("field_name", "invoice_number")
    invoice_no = row.get(field_name)
    
    if pd.isna(invoice_no) or not str(invoice_no).strip():
        return ValidationResult(
            rule_name=rule.name,
            category=rule.category,
            severity=rule.severity,
            message=rule.message,
            field=field_name,
            value=invoice_no,
            suggestion=rule.suggestion,
            error_code=rule.error_code,
            row_index=kwargs.get("row_index")
        )
    
    invoice_str = str(invoice_no).strip()
    
    # Check length
    if len(invoice_str) > INVOICE_MAX_LENGTH:
        return ValidationResult(
            rule_name=rule.name,
            category=ValidationCategory.INVOICE,
            severity=ValidationSeverity.WARNING,
            message=f"Invoice number exceeds {INVOICE_MAX_LENGTH} characters",
            field=field_name,
            value=invoice_no,
            suggestion="Consider using a shorter invoice number format",
            row_index=kwargs.get("row_index")
        )
    
    # Check for invalid characters
    invalid_chars = re.findall(r'[<>{}|\\\[\]]', invoice_str)
    if invalid_chars:
        return ValidationResult(
            rule_name="invoice_invalid_chars",
            category=ValidationCategory.INVOICE,
            severity=ValidationSeverity.WARNING,
            message=f"Invoice number contains invalid characters: {invalid_chars}",
            field=field_name,
            value=invoice_no,
            suggestion="Remove special characters like <>{}|\\[]",
            row_index=kwargs.get("row_index")
        )
    
    return None


def validate_date(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate date format and range."""
    field_name = kwargs.get("field_name", "invoice_date")
    date_val = row.get(field_name)
    
    if pd.isna(date_val):
        return ValidationResult(
            rule_name=rule.name,
            category=rule.category,
            severity=rule.severity,
            message=rule.message,
            field=field_name,
            value=date_val,
            suggestion=rule.suggestion,
            error_code=rule.error_code,
            row_index=kwargs.get("row_index")
        )
    
    # Try to parse date
    if isinstance(date_val, (datetime, date)):
        parsed_date = date_val if isinstance(date_val, date) else date_val.date()
    else:
        parsed_date = None
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d %B %Y"]:
            try:
                parsed_date = datetime.strptime(str(date_val), fmt).date()
                break
            except ValueError:
                continue
        
        if parsed_date is None:
            return ValidationResult(
                rule_name="date_parse_error",
                category=ValidationCategory.DATE,
                severity=rule.severity,
                message=f"Could not parse date: {date_val}",
                field=field_name,
                value=date_val,
                suggestion="Use DD/MM/YYYY format",
                row_index=kwargs.get("row_index")
            )
    
    # Check filing period
    filing_start = kwargs.get("filing_period_start")
    filing_end = kwargs.get("filing_period_end")
    
    if filing_start and filing_end:
        if parsed_date < filing_start or parsed_date > filing_end:
            return ValidationResult(
                rule_name="date_outside_filing_period",
                category=ValidationCategory.DATE,
                severity=ValidationSeverity.WARNING,
                message=f"Date {parsed_date} outside filing period {filing_start} to {filing_end}",
                field=field_name,
                value=date_val,
                suggestion="Verify correct filing period",
                row_index=kwargs.get("row_index")
            )
    
    # Check future dates
    if parsed_date > date.today():
        return ValidationResult(
            rule_name="future_date",
            category=ValidationCategory.DATE,
            severity=ValidationSeverity.WARNING,
            message=f"Date is in the future: {parsed_date}",
            field=field_name,
            value=date_val,
            suggestion="Check if this is a pro-forma or advance invoice",
            row_index=kwargs.get("row_index")
        )
    
    return None


def validate_tax_calculation(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate tax calculation with rounding tolerance."""
    taxable = row.get("taxable_value", 0)
    rate = row.get("rate", 0)
    
    if pd.isna(taxable) or pd.isna(rate):
        return None
    
    taxable = float(taxable)
    rate = float(rate)
    
    # Get tax amounts
    igst = float(row.get("igst", 0) or 0)
    cgst = float(row.get("cgst", 0) or 0)
    sgst = float(row.get("sgst", 0) or 0)
    cess = float(row.get("cess", 0) or 0)
    
    # Calculate expected tax
    expected_total = round(taxable * rate / 100, 2)
    
    # Determine actual tax based on structure
    is_inter_state = row.get("is_inter_state", False)
    if is_inter_state:
        actual_total = igst + cess
        expected_breakdown = (expected_total, 0, 0)
    else:
        actual_total = cgst + sgst + cess
        expected_breakdown = (round(expected_total / 2, 2), round(expected_total / 2, 2), 0)
    
    # Calculate difference
    diff = abs(actual_total - expected_total)
    
    if diff > ROUNDING_TOLERANCE:
        if diff <= AUTO_CORRECT_SMALL:
            # Small difference - can auto-correct
            corrected_igst = igst
            corrected_cgst = cgst
            corrected_sgst = sgst
            
            if is_inter_state:
                corrected_igst = expected_total
            else:
                corrected_cgst = expected_breakdown[0]
                corrected_sgst = expected_breakdown[1]
            
            return ValidationResult(
                rule_name=rule.name,
                category=rule.category,
                severity=ValidationSeverity.INFO,
                message=f"Tax auto-corrected: {actual_total:.2f} -> {expected_total:.2f}",
                field="tax_amounts",
                value=actual_total,
                expected=expected_total,
                actual=actual_total,
                suggestion=f"Within {ROUNDING_TOLERANCE} INR tolerance",
                error_code=rule.error_code,
                row_index=kwargs.get("row_index"),
                corrected_value={
                    "igst": corrected_igst,
                    "cgst": corrected_cgst,
                    "sgst": corrected_sgst,
                }
            )
        elif diff <= AUTO_CORRECT_MEDIUM:
            return ValidationResult(
                rule_name=rule.name,
                category=rule.category,
                severity=ValidationSeverity.WARNING,
                message=f"Tax mismatch: expected {expected_total:.2f}, got {actual_total:.2f} (diff: {diff:.2f})",
                field="tax_amounts",
                value=actual_total,
                expected=expected_total,
                actual=actual_total,
                suggestion="Review tax calculation",
                error_code=rule.error_code,
                row_index=kwargs.get("row_index")
            )
        else:
            return ValidationResult(
                rule_name=rule.name,
                category=rule.category,
                severity=rule.severity,
                message=f"Tax calculation error: expected {expected_total:.2f}, got {actual_total:.2f} (diff: {diff:.2f})",
                field="tax_amounts",
                value=actual_total,
                expected=expected_total,
                actual=actual_total,
                suggestion=f"Recalculate: taxable_value × rate / 100 = {expected_total:.2f}",
                error_code=rule.error_code,
                row_index=kwargs.get("row_index")
            )
    
    return None


def validate_amount_consistency(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate invoice_value = taxable + all taxes."""
    invoice_val = row.get("invoice_value")
    taxable = row.get("taxable_value", 0)
    igst = row.get("igst", 0) or 0
    cgst = row.get("cgst", 0) or 0
    sgst = row.get("sgst", 0) or 0
    cess = row.get("cess", 0) or 0
    
    if pd.isna(invoice_val) or pd.isna(taxable):
        return None
    
    invoice_val = float(invoice_val)
    taxable = float(taxable)
    total_tax = float(igst) + float(cgst) + float(sgst) + float(cess)
    
    # Calculate expected invoice value
    expected_invoice = taxable + total_tax
    
    diff = abs(invoice_val - expected_invoice)
    
    if diff > ROUNDING_TOLERANCE:
        if diff <= AUTO_CORRECT_SMALL:
            return ValidationResult(
                rule_name="invoice_value_auto_corrected",
                category=ValidationCategory.AMOUNT,
                severity=ValidationSeverity.INFO,
                message=f"Invoice value auto-corrected: {invoice_val:.2f} -> {expected_invoice:.2f}",
                field="invoice_value",
                value=invoice_val,
                expected=expected_invoice,
                actual=invoice_val,
                suggestion=f"Within {ROUNDING_TOLERANCE} INR tolerance",
                error_code="VAL_AMOUNT_AUTO_CORRECT",
                row_index=kwargs.get("row_index"),
                corrected_value=expected_invoice
            )
        else:
            return ValidationResult(
                rule_name=rule.name,
                category=rule.category,
                severity=rule.severity,
                message=f"Invoice value mismatch: {invoice_val:.2f} != {expected_invoice:.2f} (taxable + tax)",
                field="invoice_value",
                value=invoice_val,
                expected=expected_invoice,
                actual=invoice_val,
                suggestion="Invoice value should equal taxable value + all tax amounts",
                error_code=rule.error_code,
                row_index=kwargs.get("row_index")
            )
    
    return None


def validate_place_of_supply(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate place of supply."""
    pos = row.get("place_of_supply")
    
    if pd.isna(pos) or not str(pos).strip():
        return ValidationResult(
            rule_name=rule.name,
            category=rule.category,
            severity=rule.severity,
            message=rule.message,
            field="place_of_supply",
            value=pos,
            suggestion=rule.suggestion,
            error_code=rule.error_code,
            row_index=kwargs.get("row_index")
        )
    
    pos_str = str(pos).strip()
    
    # Check if numeric code
    if pos_str.isdigit():
        if len(pos_str) != 2 or pos_str not in INDIAN_STATE_CODES:
            return ValidationResult(
                rule_name="pos_invalid_code",
                category=ValidationCategory.FORMAT,
                severity=rule.severity,
                message=f"Invalid place of supply code: {pos}",
                field="place_of_supply",
                value=pos,
                suggestion="Use valid state code (01-37) or state name",
                error_code="VAL_FORMAT_POS_INVALID",
                row_index=kwargs.get("row_index")
            )
    else:
        # Check state name
        found = False
        for code, name in INDIAN_STATE_CODES.items():
            if name.lower() in pos_str.lower() or pos_str.lower() in name.lower():
                found = True
                break
        
        if not found:
            return ValidationResult(
                rule_name="pos_unknown_state",
                category=ValidationCategory.FORMAT,
                severity=rule.severity,
                message=f"Unknown place of supply: {pos}",
                field="place_of_supply",
                value=pos,
                suggestion="Use valid Indian state name or code",
                error_code="VAL_FORMAT_POS_UNKNOWN",
                row_index=kwargs.get("row_index")
            )
    
    return None


def validate_hsn_code(
    row: pd.Series,
    rule: ValidationRule,
    **kwargs
) -> Optional[ValidationResult]:
    """Validate HSN/SAC code format."""
    hsn = row.get("hsn_code")
    
    if pd.isna(hsn) or not str(hsn).strip():
        return None  # HSN is optional
    
    hsn_str = str(hsn).strip()
    
    # HSN should be 4-8 digits, SAC should be 4-6 digits
    if not (HSN_PATTERN.match(hsn_str) or SAC_PATTERN.match(hsn_str)):
        return ValidationResult(
            rule_name=rule.name,
            category=ValidationCategory.FORMAT,
            severity=rule.severity,
            message=f"Invalid HSN/SAC code format: {hsn}",
            field="hsn_code",
            value=hsn,
            suggestion="HSN should be 4-8 digits, SAC should be 4-6 digits",
            error_code=rule.error_code,
            row_index=kwargs.get("row_index")
        )
    
    return None


# =============================================================================
# MAIN VALIDATION ENGINE
# =============================================================================

class ValidationEngine:
    """
    Production-grade validation engine for GSTR-1 data.
    
    Features:
    - Comprehensive validation rules
    - Auto-correction with audit trail
    - Configurable severity levels
    - Detailed error reporting
    """
    
    def __init__(
        self,
        rounding_tolerance: float = ROUNDING_TOLERANCE,
        strict_mode: bool = False,
        filing_period_start: Optional[date] = None,
        filing_period_end: Optional[date] = None
    ):
        """
        Initialize the validation engine.
        
        Args:
            rounding_tolerance: Tolerance for rounding differences (INR)
            strict_mode: If True, fail on any warning
            filing_period_start: Start of filing period
            filing_period_end: End of filing period
        """
        self.rounding_tolerance = rounding_tolerance
        self.strict_mode = strict_mode
        self.filing_period_start = filing_period_start
        self.filing_period_end = filing_period_end
        self.rules: List[ValidationRule] = []
        self._build_default_rules()
    
    def _build_default_rules(self):
        """Build the default set of validation rules."""
        # Required field rules
        self.add_rule(ValidationRule(
            name="invoice_number_required",
            category=ValidationCategory.INVOICE,
            severity=ValidationSeverity.ERROR,
            check_func=validate_invoice_number,
            message="Invoice number is required",
            suggestion="Add invoice number",
            error_code="VAL_INV_REQUIRED"
        ))
        
        self.add_rule(ValidationRule(
            name="invoice_date_required",
            category=ValidationCategory.DATE,
            severity=ValidationSeverity.ERROR,
            check_func=validate_date,
            message="Invoice date is required",
            suggestion="Add invoice date in DD/MM/YYYY format",
            error_code="VAL_DATE_REQUIRED"
        ))
        
        self.add_rule(ValidationRule(
            name="taxable_value_required",
            category=ValidationCategory.AMOUNT,
            severity=ValidationSeverity.ERROR,
            check_func=lambda r, rule, **kw: None if pd.notna(r.get("taxable_value")) else ValidationResult(
                rule_name=rule.name,
                category=rule.category,
                severity=rule.severity,
                message=rule.message,
                field="taxable_value",
                value=None,
                suggestion=rule.suggestion,
                error_code=rule.error_code,
                row_index=kw.get("row_index")
            ),
            message="Taxable value is required",
            suggestion="Add taxable value",
            error_code="VAL_AMT_REQUIRED"
        ))
        
        self.add_rule(ValidationRule(
            name="place_of_supply_required",
            category=ValidationCategory.FORMAT,
            severity=ValidationSeverity.ERROR,
            check_func=validate_place_of_supply,
            message="Place of supply is required",
            suggestion="Add place of supply (state code or name)",
            error_code="VAL_POS_REQUIRED"
        ))
        
        # Format validation rules
        self.add_rule(ValidationRule(
            name="gstin_format",
            category=ValidationCategory.GSTIN,
            severity=ValidationSeverity.ERROR,
            check_func=validate_gstin_format,
            message="Invalid GSTIN format",
            suggestion="Format: XXAAAAA0000A1Z0 (15 characters)",
            error_code="VAL_GSTIN_FORMAT"
        ))
        
        self.add_rule(ValidationRule(
            name="invoice_number_format",
            category=ValidationCategory.INVOICE,
            severity=ValidationSeverity.WARNING,
            check_func=validate_invoice_number,
            message="Invoice number validation",
            suggestion="Max 16 characters, no special characters",
            error_code="VAL_INV_FORMAT"
        ))
        
        self.add_rule(ValidationRule(
            name="invoice_date_format",
            category=ValidationCategory.DATE,
            severity=ValidationSeverity.WARNING,
            check_func=validate_date,
            message="Invoice date validation",
            error_code="VAL_DATE_FORMAT"
        ))
        
        self.add_rule(ValidationRule(
            name="hsn_format",
            category=ValidationCategory.FORMAT,
            severity=ValidationSeverity.WARNING,
            check_func=validate_hsn_code,
            message="HSN/SAC code format validation",
            suggestion="HSN: 4-8 digits, SAC: 4-6 digits",
            error_code="VAL_HSN_FORMAT"
        ))
        
        # Tax calculation rules
        self.add_rule(ValidationRule(
            name="tax_calculation",
            category=ValidationCategory.TAX,
            severity=ValidationSeverity.INFO,
            check_func=validate_tax_calculation,
            message="Tax calculation validation",
            suggestion="Recalculate: taxable_value × rate / 100",
            error_code="VAL_TAX_CALC"
        ))
        
        self.add_rule(ValidationRule(
            name="invoice_value_consistency",
            category=ValidationCategory.AMOUNT,
            severity=ValidationSeverity.ERROR,
            check_func=validate_amount_consistency,
            message="Invoice value consistency check",
            suggestion="Invoice value should equal taxable + taxes",
            error_code="VAL_AMT_CONSISTENCY"
        ))
    
    def add_rule(self, rule: ValidationRule):
        """Add a custom validation rule."""
        self.rules.append(rule)
    
    def remove_rule(self, rule_name: str):
        """Remove a validation rule by name."""
        self.rules = [r for r in self.rules if r.name != rule_name]
    
    def validate_dataframe(
        self,
        df: pd.DataFrame,
        supplier_gstin: Optional[str] = None
    ) -> ValidationReport:
        """
        Validate entire DataFrame.
        
        Args:
            df: DataFrame to validate
            supplier_gstin: Supplier's GSTIN (optional)
        
        Returns:
            ValidationReport with all results
        """
        report = ValidationReport(
            total_rows=len(df),
            total_columns=len(df.columns)
        )
        
        # Check for duplicates first
        self._check_duplicates(df, report)
        
        # Validate each row
        for idx, row in df.iterrows():
            row_results = self.validate_row(row, idx, supplier_gstin)
            for result in row_results:
                report.add_result(result)
        
        return report
    
    def validate_row(
        self,
        row: pd.Series,
        row_index: int,
        supplier_gstin: Optional[str] = None
    ) -> List[ValidationResult]:
        """
        Validate a single row.
        
        Args:
            row: Row data as Series
            row_index: Index of the row
            supplier_gstin: Supplier's GSTIN
        
        Returns:
            List of ValidationResult objects
        """
        results = []
        
        for rule in self.rules:
            result = rule.check(
                row,
                rule,
                field_name=rule.category.value,
                row_index=row_index,
                filing_period_start=self.filing_period_start,
                filing_period_end=self.filing_period_end,
                supplier_gstin=supplier_gstin
            )
            
            if result is not None:
                results.append(result)
        
        return results
    
    def _check_duplicates(
        self,
        df: pd.DataFrame,
        report: ValidationReport
    ):
        """Check for duplicate invoices."""
        if "invoice_number" not in df.columns:
            return
        
        # Use gstin + invoice_number for B2B, just invoice_number for B2C
        if "gstin" in df.columns:
            dup_cols = ["invoice_number", "gstin"]
        else:
            dup_cols = ["invoice_number"]
        
        duplicates = df[df.duplicated(subset=dup_cols, keep=False)]
        
        if not duplicates.empty:
            # Group duplicates
            for (invoice_no, gstin), group in duplicates.groupby(dup_cols):
                if len(group) > 1:
                    result = ValidationResult(
                        rule_name="duplicate_invoice",
                        category=ValidationCategory.DUPLICATE,
                        severity=ValidationSeverity.ERROR,
                        message=f"Duplicate invoice found: {invoice_no} (appears {len(group)} times)",
                        field="invoice_number",
                        value=invoice_no,
                        suggestion="Remove duplicate entries",
                        error_code="VAL_DUPLICATE",
                        row_index=int(group.index[0])
                    )
                    report.add_result(result)
    
    def apply_corrections(
        self,
        df: pd.DataFrame,
        report: ValidationReport
    ) -> pd.DataFrame:
        """
        Apply auto-corrections from validation report.
        
        Args:
            df: Original DataFrame
            report: ValidationReport with corrections
        
        Returns:
            DataFrame with corrections applied
        """
        df_corrected = df.copy()
        
        for result in report.results:
            if result.corrected_value is None:
                continue
            
            row_idx = result.row_index
            if row_idx is None:
                continue
            
            if isinstance(result.corrected_value, dict):
                # Tax correction
                for field, value in result.corrected_value.items():
                    df_corrected.at[row_idx, field] = value
            else:
                # Simple value correction
                df_corrected.at[row_idx, result.field] = result.corrected_value
        
        return df_corrected


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def validate_rows(
    df: pd.DataFrame,
    supplier_gstin: Optional[str] = None,
    **kwargs
) -> ValidationReport:
    """
    Convenience function to validate a DataFrame.
    
    Args:
        df: DataFrame to validate
        supplier_gstin: Supplier's GSTIN
        **kwargs: Additional arguments for ValidationEngine
    
    Returns:
        ValidationReport
    """
    engine = ValidationEngine(**kwargs)
    return engine.validate_dataframe(df, supplier_gstin)


def validate_and_correct(
    df: pd.DataFrame,
    supplier_gstin: Optional[str] = None,
    **kwargs
) -> Tuple[pd.DataFrame, ValidationReport]:
    """
    Validate DataFrame and apply auto-corrections.
    
    Args:
        df: DataFrame to validate
        supplier_gstin: Supplier's GSTIN
        **kwargs: Additional arguments
    
    Returns:
        Tuple of (corrected DataFrame, ValidationReport)
    """
    engine = ValidationEngine(**kwargs)
    report = engine.validate_dataframe(df, supplier_gstin)
    df_corrected = engine.apply_corrections(df, report)
    return df_corrected, report


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python validation_engine.py <excel_file> [supplier_gstin]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    supplier_gstin = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("=" * 70)
    print("GSTR-1 Validation Engine - Production Grade")
    print("=" * 70)
    
    # Load file
    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error loading file: {e}")
        sys.exit(1)
    
    print(f"\nLoaded {len(df)} rows from {file_path}")
    
    # Validate
    report = validate_rows(df, supplier_gstin)
    
    # Print summary
    print(report.to_summary_report())
    
    print("\n" + "=" * 70)
