# GST India - Validation Safeguards Engine
# Implements comprehensive validation rules for GSTR-1/GSTR-3B data quality

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from enum import Enum
import re

# Import amendment window validator from the GSTR-1 validation module
try:
    from india_compliance.gst_india.utils.gstr1.gstr1_validations import validate_amendment_window
    _AMENDMENT_WINDOW_AVAILABLE = True
except ImportError:
    _AMENDMENT_WINDOW_AVAILABLE = False
    validate_amendment_window = None  # type: ignore


class ValidationSeverity(str, Enum):
    """Severity levels for validation issues"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationCategory(str, Enum):
    """Categories of validation rules"""
    TAX_CALCULATION = "tax_calculation"
    INVOICE_DUPLICATION = "invoice_duplication"
    GSTIN_VALIDATION = "gstin_validation"
    CREDIT_NOTE = "credit_note"
    AMENDMENT = "amendment"
    ROUNDING = "rounding"
    DATA_QUALITY = "data_quality"


# Tolerance for rounding (±0.05)
ROUNDING_TOLERANCE = 0.05


@dataclass
class ValidationIssue:
    """Individual validation issue"""
    category: ValidationCategory
    severity: ValidationSeverity
    message: str
    field: str
    row: Optional[int] = None
    invoice_number: Optional[str] = None
    value: Any = None
    expected_value: Any = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "field": self.field,
            "row": self.row,
            "invoice_number": self.invoice_number,
            "value": str(self.value) if self.value else None,
            "expected_value": str(self.expected_value) if self.expected_value else None,
        }


@dataclass
class ValidationReport:
    """Structured validation report"""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    total_records: int = 0
    valid_records: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == ValidationSeverity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == ValidationSeverity.WARNING)
    
    @property
    def info_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == ValidationSeverity.INFO)
    
    @property
    def is_valid(self) -> bool:
        return self.error_count == 0
    
    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "summary": {
                "total_records": self.total_records,
                "valid_records": self.valid_records,
                "error_count": self.error_count,
                "warning_count": self.warning_count,
                "info_count": self.info_count,
                "is_valid": self.is_valid,
            },
            "issues": [i.to_dict() for i in self.issues],
            "by_category": {
                cat.value: sum(1 for i in self.issues if i.category == cat)
                for cat in ValidationCategory
            },
        }


class ValidationSafeguards:
    """
    Comprehensive validation safeguards for GST data.
    
    Implements:
    - Negative tax handling
    - Credit note reversal impact
    - Amendment logic
    - Invoice duplication prevention
    - GSTIN validation checksum
    - Invoice number uniqueness per FY
    - Rounding tolerance (±0.05)
    """
    
    def __init__(self, tolerance: float = ROUNDING_TOLERANCE):
        self.tolerance = tolerance
        self.report = ValidationReport()
    
    # ============ GSTIN Validation ============
    
    def validate_gstin(self, gstin: str) -> bool:
        """
        Validate GSTIN using checksum algorithm.
        
        GSTIN format: 15 characters
        - State code: 2 digits
        - PAN: 10 characters
        - Entity number: 1 character
        - Z: Constant
        - Checksum: 1 character
        
        Returns True if valid, False otherwise.
        """
        if not gstin or len(gstin) != 15:
            return False
        
        # Check format
        pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if not re.match(pattern, gstin):
            return False
        
        # Checksum validation
        # Characters for checksum: All alphanumerics except '0'
        chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        
        # Last character is checksum
        checksum_char = gstin[-1]
        
        # Calculate checksum
        product = 0
        for i, char in enumerate(gstin[:14]):
            if char not in chars:
                return False
            product += chars.index(char) * (i + 1)
        
        remainder = product % 36
        expected_checksum = chars[remainder]
        
        return checksum_char == expected_checksum
    
    def check_gstin(self, gstin: str, row: Optional[int] = None) -> List[ValidationIssue]:
        """Check GSTIN and add issues to report"""
        issues = []
        
        if not gstin:
            issues.append(ValidationIssue(
                category=ValidationCategory.GSTIN_VALIDATION,
                severity=ValidationSeverity.ERROR,
                message="GSTIN is required",
                field="gstin",
                row=row,
                value=gstin
            ))
            return issues
        
        if not self.validate_gstin(gstin):
            issues.append(ValidationIssue(
                category=ValidationCategory.GSTIN_VALIDATION,
                severity=ValidationSeverity.ERROR,
                message=f"Invalid GSTIN format or checksum: {gstin}",
                field="gstin",
                row=row,
                value=gstin
            ))
        
        return issues
    
    # ============ Invoice Duplication ============
    
    def check_duplication(
        self, 
        invoices: List[Dict[str, Any]], 
        fiscal_year: Optional[str] = None
    ) -> List[ValidationIssue]:
        """
        Check for duplicate invoice numbers within the same fiscal year.
        
        An invoice is considered duplicate if:
        - Same invoice number AND
        - Same supplier GSTIN AND
        - Same fiscal year
        """
        issues = []
        seen = {}  # {(gstin, invoice_number, fy): row}
        
        for idx, invoice in enumerate(invoices):
            gstin = invoice.get("gstin", "")
            invoice_number = invoice.get("invoice_number", "")
            
            # Extract fiscal year from invoice date if not provided
            fy = fiscal_year
            if not fy and invoice.get("invoice_date"):
                try:
                    date_str = str(invoice.get("invoice_date"))
                    year = int(date_str[:4]) if len(date_str) >= 4 else 0
                    month = int(date_str[5:7]) if len(date_str) >= 7 else 0
                    fy = f"{year}-{year+1}" if month >= 4 else f"{year-1}-{year}"
                except:
                    fy = "unknown"
            
            key = (gstin, invoice_number, fy)
            
            if key in seen:
                issues.append(ValidationIssue(
                    category=ValidationCategory.INVOICE_DUPLICATION,
                    severity=ValidationSeverity.ERROR,
                    message=f"Duplicate invoice: {invoice_number} from {gstin} in FY {fy}",
                    field="invoice_number",
                    row=idx,
                    invoice_number=invoice_number,
                    value=invoice_number,
                    expected_value=f"Unique invoice number per FY"
                ))
            else:
                seen[key] = idx
        
        return issues
    
    # ============ Negative Tax Handling ============
    
    def check_negative_tax(self, invoice: Dict[str, Any], row: int) -> List[ValidationIssue]:
        """
        Check for negative tax values.
        
        Negative tax is valid for:
        - Credit notes (CN)
        - Debit notes (DN)
        - Amendments
        
        But NOT for regular invoices.
        """
        issues = []
        
        is_credit_note = invoice.get("is_credit_note", False)
        is_debit_note = invoice.get("is_debit_note", False)
        is_amendment = invoice.get("is_amendment", False)
        
        # Check each tax component
        tax_fields = ["igst", "cgst", "sgst", "cess", "taxable_value"]
        
        for tax_field in tax_fields:
            value = invoice.get(tax_field, 0)
            
            if value is None:
                continue
                
            try:
                tax_value = float(value)
            except (ValueError, TypeError):
                continue
            
            if tax_value < 0:
                # Negative values allowed for CN/DN/Amendment
                if not (is_credit_note or is_debit_note or is_amendment):
                    issues.append(ValidationIssue(
                        category=ValidationCategory.TAX_CALCULATION,
                        severity=ValidationSeverity.ERROR,
                        message=f"Negative {tax_field} not allowed for regular invoices",
                        field=tax_field,
                        row=row,
                        invoice_number=invoice.get("invoice_number"),
                        value=tax_value,
                        expected_value=">= 0"
                    ))
        
        return issues
    
    # ============ Credit Note Reversal Impact ============
    
    def check_credit_note_impact(
        self, 
        invoices: List[Dict[str, Any]]
    ) -> List[ValidationIssue]:
        """
        Check credit note impact on tax liability.
        
        Rules:
        - Credit notes reduce tax liability
        - Cannot exceed original invoice tax amount
        - Must reference original invoice
        """
        issues = []
        
        for idx, invoice in enumerate(invoices):
            if not invoice.get("is_credit_note"):
                continue
            
            # Check for original invoice reference
            if not invoice.get("reference_invoice_number"):
                issues.append(ValidationIssue(
                    category=ValidationCategory.CREDIT_NOTE,
                    severity=ValidationSeverity.WARNING,
                    message="Credit note without reference to original invoice",
                    field="reference_invoice_number",
                    row=idx,
                    invoice_number=invoice.get("invoice_number")
                ))
            
            # Check tax amount doesn't exceed original
            original_tax = invoice.get("original_invoice_tax", 0)
            credit_tax = float(invoice.get("igst", 0)) + float(invoice.get("cgst", 0)) + float(invoice.get("sgst", 0))
            
            if credit_tax > original_tax:
                issues.append(ValidationIssue(
                    category=ValidationCategory.CREDIT_NOTE,
                    severity=ValidationSeverity.ERROR,
                    message="Credit note tax exceeds original invoice tax",
                    field="tax_amount",
                    row=idx,
                    invoice_number=invoice.get("invoice_number"),
                    value=credit_tax,
                    expected_value=f"<= {original_tax}"
                ))
        
        return issues
    
    # ============ Amendment Logic ============

    def check_amendment_validity(
        self,
        invoices: List[Dict[str, Any]],
        original_invoices: List[Dict[str, Any]] = None
    ) -> List[ValidationIssue]:
        """
        Validate amendment invoices.

        Rules:
        - Amendment must reference original invoice
        - Amendment date must be after original invoice date
        - Gap 7: Can only amend within 36 months (3 years) of original invoice
        """
        issues = []

        for idx, invoice in enumerate(invoices):
            if not invoice.get("is_amendment"):
                continue

            # Check reference to original
            ref_inv = invoice.get("reference_invoice_number")
            if not ref_inv:
                issues.append(ValidationIssue(
                    category=ValidationCategory.AMENDMENT,
                    severity=ValidationSeverity.ERROR,
                    message="Amendment must reference original invoice",
                    field="reference_invoice_number",
                    row=idx,
                    invoice_number=invoice.get("invoice_number")
                ))

            # Check date sequence
            inv_date_raw = invoice.get("invoice_date")
            orig_date_raw = invoice.get("original_invoice_date")

            try:
                inv_date = datetime.fromisoformat(str(inv_date_raw))
                if orig_date_raw:
                    orig_date = datetime.fromisoformat(str(orig_date_raw))
                    if inv_date <= orig_date:
                        issues.append(ValidationIssue(
                            category=ValidationCategory.AMENDMENT,
                            severity=ValidationSeverity.WARNING,
                            message="Amendment date should be after original invoice date",
                            field="invoice_date",
                            row=idx,
                            invoice_number=invoice.get("invoice_number")
                        ))
            except Exception:
                pass

            # Gap 7: 3-year amendment window enforcement
            if _AMENDMENT_WINDOW_AVAILABLE and validate_amendment_window and orig_date_raw:
                window_issue = validate_amendment_window(
                    amendment_date=inv_date_raw,
                    original_invoice_date=orig_date_raw,
                    field_name="invoice_date",
                )
                if window_issue:
                    msg = window_issue.error
                    severity = (
                        ValidationSeverity.ERROR
                        if msg.startswith("[ERROR]")
                        else ValidationSeverity.WARNING
                    )
                    issues.append(ValidationIssue(
                        category=ValidationCategory.AMENDMENT,
                        severity=severity,
                        message=msg,
                        field="invoice_date",
                        row=idx,
                        invoice_number=invoice.get("invoice_number"),
                        value=inv_date_raw,
                    ))

        return issues
    
    # ============ Rounding Tolerance ============
    
    def check_rounding(
        self, 
        invoice: Dict[str, Any], 
        row: int
    ) -> List[ValidationIssue]:
        """
        Check tax calculations within rounding tolerance.
        
        Tolerance: ±0.05
        """
        issues = []
        
        # Get values
        taxable_value = float(invoice.get("taxable_value", 0) or 0)
        rate = float(invoice.get("rate", 0) or 0)
        igst = float(invoice.get("igst", 0) or 0)
        cgst = float(invoice.get("cgst", 0) or 0)
        sgst = float(invoice.get("sgst", 0) or 0)
        
        # Calculate expected tax
        expected_total = taxable_value * rate / 100
        
        # Determine if inter-state (IGST) or intra-state (CGST+SGST)
        if igst > 0:
            # Inter-state
            expected_igst = expected_total
            calculated = igst
        else:
            # Intra-state - split equally
            expected_igst = 0
            expected_cgst = expected_total / 2
            expected_sgst = expected_total / 2
            calculated = cgst + sgst
        
        # Check tolerance
        difference = abs(calculated - expected_total)
        
        if difference > self.tolerance:
            issues.append(ValidationIssue(
                category=ValidationCategory.ROUNDING,
                severity=ValidationSeverity.WARNING,
                message=f"Tax calculation outside tolerance: diff=₹{difference:.2f}",
                field="tax_amount",
                row=row,
                invoice_number=invoice.get("invoice_number"),
                value=calculated,
                expected_value=f"within ±{self.tolerance} of {expected_total:.2f}"
            ))
        
        return issues
    
    # ============ Data Quality Checks ============
    
    def check_data_quality(
        self, 
        invoice: Dict[str, Any], 
        row: int
    ) -> List[ValidationIssue]:
        """General data quality checks"""
        issues = []
        
        # Required fields
        required_fields = ["invoice_number", "invoice_date", "taxable_value"]
        
        for field in required_fields:
            value = invoice.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                issues.append(ValidationIssue(
                    category=ValidationCategory.DATA_QUALITY,
                    severity=ValidationSeverity.ERROR,
                    message=f"Required field missing: {field}",
                    field=field,
                    row=row,
                    invoice_number=invoice.get("invoice_number")
                ))
        
        # Rate validation
        rate = invoice.get("rate", 0)
        if rate:
            try:
                rate_val = float(rate)
                if rate_val < 0 or rate_val > 28:
                    issues.append(ValidationIssue(
                        category=ValidationCategory.DATA_QUALITY,
                        severity=ValidationSeverity.WARNING,
                        message=f"Rate outside normal range: {rate_val}%",
                        field="rate",
                        row=row,
                        invoice_number=invoice.get("invoice_number"),
                        value=rate_val
                    ))
            except:
                pass
        
        return issues
    
    # ============ Main Validation Runner ============
    
    def validate_invoices(
        self, 
        invoices: List[Dict[str, Any]], 
        fiscal_year: Optional[str] = None,
        check_duplication: bool = True,
        check_gstin: bool = True,
        check_rounding: bool = True,
        check_credit_notes: bool = True,
        check_amendments: bool = True,
        check_quality: bool = True
    ) -> ValidationReport:
        """
        Run all validation checks on invoices.
        
        Args:
            invoices: List of invoice records
            fiscal_year: Fiscal year (e.g., "2025-26")
            check_duplication: Check for duplicate invoices
            check_gstin: Validate GSTIN format
            check_rounding: Check tax calculations within tolerance
            check_credit_notes: Check credit note validity
            check_amendments: Check amendment logic
            check_quality: Check data quality
            
        Returns:
            ValidationReport with all issues
        """
        self.report = ValidationReport()
        self.report.total_records = len(invoices)
        
        # Check duplication first (needs all records)
        if check_duplication:
            self.report.issues.extend(self.check_duplication(invoices, fiscal_year))
        
        # Process each invoice
        for idx, invoice in enumerate(invoices):
            # GSTIN validation
            if check_gstin and invoice.get("gstin"):
                self.report.issues.extend(
                    self.check_gstin(invoice.get("gstin"), idx)
                )
            
            # Negative tax
            self.report.issues.extend(
                self.check_negative_tax(invoice, idx)
            )
            
            # Rounding
            if check_rounding:
                self.report.issues.extend(
                    self.check_rounding(invoice, idx)
                )
            
            # Credit notes
            if check_credit_notes and invoice.get("is_credit_note"):
                self.report.issues.extend(
                    self.check_credit_note_impact([invoice])
                )
            
            # Amendments
            if check_amendments and invoice.get("is_amendment"):
                self.report.issues.extend(
                    self.check_amendment_validity([invoice])
                )
            
            # Data quality
            if check_quality:
                self.report.issues.extend(
                    self.check_data_quality(invoice, idx)
                )
        
        # Calculate valid records
        error_rows = set(i.row for i in self.report.issues if i.severity == ValidationSeverity.ERROR)
        self.report.valid_records = self.report.total_records - len(error_rows)
        
        return self.report


def validate_gst_data(
    invoices: List[Dict[str, Any]],
    fiscal_year: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function to run full validation.
    
    Returns structured validation report.
    """
    validator = ValidationSafeguards()
    report = validator.validate_invoices(invoices, fiscal_year, **kwargs)
    return report.to_dict()


# ============ Invoice Number Uniqueness Per FY ============

class InvoiceTracker:
    """
    Tracks invoice numbers per fiscal year to prevent duplicates.
    
    Usage:
        tracker = InvoiceTracker()
        tracker.add_invoice(gstin, invoice_number, fiscal_year, row)
        is_unique = tracker.is_unique(gstin, invoice_number, fiscal_year)
    """
    
    def __init__(self):
        self.invoices: Dict[Tuple[str, str, str], int] = {}  # (gstin, inv_no, fy) -> row
    
    def add_invoice(
        self, 
        gstin: str, 
        invoice_number: str, 
        fiscal_year: str, 
        row: int
    ):
        """Add invoice to tracker"""
        key = (gstin, invoice_number, fiscal_year)
        if key in self.invoices:
            return False  # Already exists
        self.invoices[key] = row
        return True
    
    def is_unique(
        self, 
        gstin: str, 
        invoice_number: str, 
        fiscal_year: str
    ) -> bool:
        """Check if invoice is unique"""
        key = (gstin, invoice_number, fiscal_year)
        return key not in self.invoices
    
    def get_duplicate_row(
        self, 
        gstin: str, 
        invoice_number: str, 
        fiscal_year: str
    ) -> Optional[int]:
        """Get row number of duplicate if exists"""
        key = (gstin, invoice_number, fiscal_year)
        return self.invoices.get(key)
    
    def clear(self):
        """Clear all tracked invoices"""
        self.invoices.clear()
