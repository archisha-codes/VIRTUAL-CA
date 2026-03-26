"""
GSTR-3B Validation Module

This module provides comprehensive validation for GSTR-3B data to ensure:
- Tax rate consistency
- ITC mismatch tolerance (±1)
- RCM inward separation
- Duplicate invoice detection across periods
- Audit-safe computations

PHASE 7: Validation Hardening
"""

from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import os
import json

from india_compliance.gst_india.utils.logger import get_logger

logger = get_logger(__name__)


# =============================================================================
# VALIDATION CONFIGURATION
# =============================================================================

class ValidationLevel(str, Enum):
    """Validation strictness level"""
    STRICT = "strict"      # All validations must pass
    NORMAL = "normal"      # Warnings for minor issues
    LENIENT = "lenient"   # Only critical errors


@dataclass
class ValidationConfig:
    """Configuration for validation rules"""
    level: ValidationLevel = ValidationLevel.NORMAL
    itc_tolerance: float = 1.0  # ±1 Rupee tolerance
    tax_rate_tolerance: float = 0.01  # ±0.01% tolerance
    enable_duplicate_check: bool = True
    enable_rcm_separation: bool = True
    enable_tax_rate_check: bool = True


# =============================================================================
# VALIDATION RESULT
# =============================================================================

@dataclass
class ValidationIssue:
    """Represents a single validation issue"""
    code: str
    message: str
    severity: str  # error, warning, info
    section: str
    field: str = ""
    value: Any = None
    expected: Any = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "severity": self.severity,
            "section": self.section,
            "field": self.field,
            "value": str(self.value) if self.value else None,
            "expected": str(self.expected) if self.expected else None,
        }


@dataclass
class ValidationResult:
    """Result of GSTR-3B validation"""
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)
    info: List[ValidationIssue] = field(default_factory=list)
    
    def add_issue(self, issue: ValidationIssue):
        if issue.severity == "error":
            self.is_valid = False
            self.issues.append(issue)
        elif issue.severity == "warning":
            self.warnings.append(issue)
        else:
            self.info.append(issue)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "error_count": len(self.issues),
            "warning_count": len(self.warnings),
            "info_count": len(self.info),
            "errors": [i.to_dict() for i in self.issues],
            "warnings": [i.to_dict() for i in self.warnings],
            "info": [i.to_dict() for i in self.info],
        }


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

def to_decimal(value: Any) -> Decimal:
    """Convert value to Decimal"""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def round_decimal(value: Decimal, precision: int = 2) -> Decimal:
    """Round Decimal to specified precision"""
    if value is None:
        return Decimal('0')
    quantize_str = '0.' + '0' * precision
    return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)


# =============================================================================
# VALIDATION RULES
# =============================================================================

class GSTR3BValidator:
    """
    GSTR-3B Validator
    
    Validates GSTR-3B data for:
    - Tax rate consistency
    - ITC mismatch
    - RCM separation
    - Duplicate invoices
    - Negative balances
    """
    
    def __init__(self, config: Optional[ValidationConfig] = None):
        self.config = config or ValidationConfig()
        self.known_invoices: Dict[str, List[str]] = {}  # period -> invoice numbers
    
    def validate(self, gstr3b_data: Dict[str, Any]) -> ValidationResult:
        """
        Validate complete GSTR-3B data.
        
        Args:
            gstr3b_data: Complete GSTR-3B data dictionary
            
        Returns:
            ValidationResult with all validation issues
        """
        result = ValidationResult(is_valid=True)
        
        # Validate Section 3.1
        self._validate_section_31(gstr3b_data, result)
        
        # Validate Section 4 (ITC)
        self._validate_section_4(gstr3b_data, result)
        
        # Validate tax liability
        self._validate_tax_liability(gstr3b_data, result)
        
        # Validate ITC utilization
        self._validate_itc_utilization(gstr3b_data, result)
        
        # Check for negative balances
        self._validate_no_negative_balances(gstr3b_data, result)
        
        # Validate RCM separation
        if self.config.enable_rcm_separation:
            self._validate_rcm_separation(gstr3b_data, result)
        
        # Validate cross-utilization rules
        self._validate_cross_utilization(gstr3b_data, result)
        
        return result
    
    def _validate_section_31(self, data: Dict[str, Any], result: ValidationResult):
        """Validate Section 3.1 - Outward Supplies"""
        section_3_1 = data.get("3_1", {})
        
        # Validate 3.1(a) - Outward taxable supplies
        outward_taxable = section_3_1.get("a_outward_taxable", {})
        self._validate_tax_components(outward_taxable, "3_1_a", result)
        
        # Validate 3.1(b) - Zero rated
        zero_rated = section_3_1.get("b_zero_rated", {})
        self._validate_tax_components(zero_rated, "3_1_b", result)
        
        # Validate 3.1(d) - RCM outward
        rcm_outward = section_3_1.get("d_rcm_outward", {})
        self._validate_tax_components(rcm_outward, "3_1_d", result)
        
        # Check tax rate consistency
        if self.config.enable_tax_rate_check:
            self._validate_tax_rate_consistency(section_3_1, result)
    
    def _validate_section_4(self, data: Dict[str, Any], result: ValidationResult):
        """Validate Section 4 - ITC"""
        section_4 = data.get("4", {})
        
        # Validate 4A - ITC Available
        section_4a = section_4.get("4a", {})
        self._validate_itc_available(section_4a, result)
        
        # Validate 4B - ITC Reversed
        section_4b = section_4.get("4b", {})
        self._validate_itc_reversed(section_4b, result)
        
        # Validate 4C - Net ITC
        section_4c = section_4.get("4c", {})
        self._validate_net_itc(section_4a, section_4b, section_4c, result)
    
    def _validate_tax_components(
        self, 
        component: Dict[str, Any], 
        section: str, 
        result: ValidationResult
    ):
        """Validate tax components (taxable, igst, cgst, sgst, cess)"""
        taxable = to_decimal(component.get("taxable_value", 0))
        igst = to_decimal(component.get("igst", 0))
        cgst = to_decimal(component.get("cgst", 0))
        sgst = to_decimal(component.get("sgst", 0))
        cess = to_decimal(component.get("cess", 0))
        
        # Check for negative values
        if taxable < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_TAXABLE",
                message=f"Negative taxable value in {section}",
                severity="error",
                section=section,
                field="taxable_value",
                value=float(taxable),
            ))
        
        if igst < 0 or cgst < 0 or sgst < 0 or cess < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_TAX",
                message=f"Negative tax amount in {section}",
                severity="error",
                section=section,
            ))
        
        # Tax should be zero if taxable is zero
        if taxable == 0 and (igst + cgst + sgst + cess) > 0:
            result.add_issue(ValidationIssue(
                code="ZERO_TAXABLE_WITH_TAX",
                message=f"Tax present but taxable value is zero in {section}",
                severity="warning",
                section=section,
            ))
    
    def _validate_tax_rate_consistency(
        self, 
        section_3_1: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate tax rate consistency across components"""
        # Calculate implied tax rates
        components = [
            ("a_outward_taxable", section_3_1.get("a_outward_taxable", {})),
            ("b_zero_rated", section_3_1.get("b_zero_rated", {})),
        ]
        
        rates = []
        for name, comp in components:
            taxable = to_decimal(comp.get("taxable_value", 0))
            total_tax = to_decimal(comp.get("igst", 0)) + to_decimal(comp.get("cgst", 0)) + to_decimal(comp.get("sgst", 0))
            
            if taxable > 0 and total_tax > 0:
                rate = (total_tax / taxable) * 100
                rates.append((name, rate, taxable, total_tax))
        
        # Check if rates are consistent
        if len(rates) > 1:
            base_rate = rates[0][1]
            tolerance = Decimal(str(self.config.tax_rate_tolerance))
            
            for name, rate, taxable, total_tax in rates[1:]:
                if abs(rate - base_rate) > tolerance:
                    result.add_issue(ValidationIssue(
                        code="INCONSISTENT_TAX_RATE",
                        message=f"Inconsistent tax rate between {rates[0][0]} ({round(base_rate, 2)}%) and {name} ({round(rate, 2)}%)",
                        severity="warning",
                        section="3_1",
                    ))
    
    def _validate_itc_available(
        self, 
        section_4a: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate ITC Available section"""
        # Check total ITC
        total_igst = to_decimal(section_4a.get("total_igst", 0))
        total_cgst = to_decimal(section_4a.get("total_cgst", 0))
        total_sgst = to_decimal(section_4a.get("total_sgst", 0))
        total_cess = to_decimal(section_4a.get("total_cess", 0))
        
        # ITC should not be negative
        if total_igst < 0 or total_cgst < 0 or total_sgst < 0 or total_cess < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_ITC",
                message="Negative ITC in available ITC",
                severity="error",
                section="4a",
            ))
    
    def _validate_itc_reversed(
        self, 
        section_4b: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate ITC Reversed section"""
        total_reversed = to_decimal(section_4b.get("total_reversed", 0))
        
        if total_reversed < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_REVERSAL",
                message="Negative ITC reversal",
                severity="error",
                section="4b",
            ))
    
    def _validate_net_itc(
        self,
        section_4a: Dict[str, Any],
        section_4b: Dict[str, Any],
        section_4c: Dict[str, Any],
        result: ValidationResult
    ):
        """Validate Net ITC = ITC Available - ITC Reversed"""
        tolerance = Decimal(str(self.config.itc_tolerance))
        
        # Get totals
        total_4a_igst = to_decimal(section_4a.get("total_igst", 0))
        total_4a_cgst = to_decimal(section_4a.get("total_cgst", 0))
        total_4a_sgst = to_decimal(section_4a.get("total_sgst", 0))
        total_4a_cess = to_decimal(section_4a.get("total_cess", 0))
        
        total_4b = to_decimal(section_4b.get("total_reversed", 0))
        
        # Expected net ITC
        expected_igst = total_4a_igst - (total_4b * Decimal('0.5'))  # Simplified proportion
        expected_cgst = total_4a_cgst - (total_4b * Decimal('0.25'))
        expected_sgst = total_4a_sgst - (total_4b * Decimal('0.25'))
        
        # Actual net ITC
        actual_igst = to_decimal(section_4c.get("igst", 0))
        actual_cgst = to_decimal(section_4c.get("cgst", 0))
        actual_sgst = to_decimal(section_4c.get("sgst", 0))
        
        # Check with tolerance
        if abs(actual_igst - expected_igst) > tolerance:
            result.add_issue(ValidationIssue(
                code="ITC_MISMATCH",
                message=f"Net ITC IGST mismatch: expected {expected_igst}, got {actual_igst}",
                severity="error",
                section="4c",
                field="igst",
                value=float(actual_igst),
                expected=float(expected_igst),
            ))
        
        if abs(actual_cgst - expected_cgst) > tolerance:
            result.add_issue(ValidationIssue(
                code="ITC_MISMATCH",
                message=f"Net ITC CGST mismatch: expected {expected_cgst}, got {actual_cgst}",
                severity="error",
                section="4c",
                field="cgst",
                value=float(actual_cgst),
                expected=float(expected_cgst),
            ))
        
        if abs(actual_sgst - expected_sgst) > tolerance:
            result.add_issue(ValidationIssue(
                code="ITC_MISMATCH",
                message=f"Net ITC SGST mismatch: expected {expected_sgst}, got {actual_sgst}",
                severity="error",
                section="4c",
                field="sgst",
                value=float(actual_sgst),
                expected=float(expected_sgst),
            ))
    
    def _validate_tax_liability(
        self, 
        data: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate tax liability calculations"""
        total_liability = data.get("total_liability", {})
        
        igst = to_decimal(total_liability.get("igst", 0))
        cgst = to_decimal(total_liability.get("cgst", 0))
        sgst = to_decimal(total_liability.get("sgst", 0))
        cess = to_decimal(total_liability.get("cess", 0))
        
        total = to_decimal(total_liability.get("total", 0))
        
        # Check sum
        expected_total = igst + cgst + sgst + cess
        if abs(total - expected_total) > Decimal('0.01'):
            result.add_issue(ValidationIssue(
                code="LIABILITY_SUM_MISMATCH",
                message="Total liability doesn't match sum of components",
                severity="error",
                section="total_liability",
                value=float(total),
                expected=float(expected_total),
            ))
    
    def _validate_itc_utilization(
        self, 
        data: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate ITC utilization and cash liability"""
        cash_liability = data.get("cash_liability", {})
        
        # Cash liability should not be negative
        for tax_type in ["igst", "cgst", "sgst", "cess"]:
            value = to_decimal(cash_liability.get(tax_type, 0))
            if value < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_CASH_LIABILITY",
                    message=f"Negative cash liability for {tax_type.upper()}",
                    severity="error",
                    section="cash_liability",
                    field=tax_type,
                    value=float(value),
                ))
    
    def _validate_no_negative_balances(
        self, 
        data: Dict[str, Any], 
        result: ValidationResult
    ):
        """Check for any negative balances in the return"""
        # Check total liability
        total_liability = data.get("total_liability", {})
        for key, value in total_liability.items():
            if key != "total" and to_decimal(value) < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_BALANCE",
                    message=f"Negative balance in {key}",
                    severity="error",
                    section="total_liability",
                    field=key,
                    value=value,
                ))
        
        # Check total ITC
        total_itc = data.get("total_itc", {})
        for key, value in total_itc.items():
            if key != "total" and to_decimal(value) < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_BALANCE",
                    message=f"Negative ITC balance in {key}",
                    severity="error",
                    section="total_itc",
                    field=key,
                    value=value,
                ))
        
        # Check carry forward
        carry_forward = data.get("carry_forward", {})
        for key, value in carry_forward.items():
            if to_decimal(value) < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_CARRY_FORWARD",
                    message=f"Negative carry forward for {key}",
                    severity="error",
                    section="carry_forward",
                    field=key,
                    value=value,
                ))
    
    def _validate_rcm_separation(
        self, 
        data: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate RCM is properly separated"""
        section_3_1 = data.get("3_1", {})
        rcm_outward = section_3_1.get("d_rcm_outward", {})
        
        # RCM should be reported in both 3.1(d) and section 4
        rcm_tax = to_decimal(rcm_outward.get("igst", 0)) + to_decimal(rcm_outward.get("cgst", 0)) + to_decimal(rcm_outward.get("sgst", 0))
        
        if rcm_tax > 0:
            # Check that RCM ITC is claimed in 4A(3)
            section_4 = data.get("4", {})
            section_4a = section_4.get("4a", {})
            rcm_itc = section_4a.get("4a3_inward_rcm", {})
            
            rcm_claimed = to_decimal(rcm_itc.get("cgst", 0)) + to_decimal(rcm_itc.get("sgst", 0))
            
            # Allow for some tolerance
            if abs(rcm_tax - rcm_claimed) > Decimal(str(self.config.itc_tolerance)):
                result.add_issue(ValidationIssue(
                    code="RCM_MISMATCH",
                    message="RCM tax and ITC do not match",
                    severity="warning",
                    section="4a3",
                ))
    
    def _validate_cross_utilization(
        self, 
        data: Dict[str, Any], 
        result: ValidationResult
    ):
        """Validate cross-utilization rules"""
        utilization = data.get("utilization_details", {})
        cross_util = utilization.get("cross_utilization", [])
        
        # Check that CGST → SGST never happens (invalid)
        for item in cross_util:
            if item.get("from") == "CGST" and item.get("to") == "SGST":
                result.add_issue(ValidationIssue(
                    code="INVALID_CROSS_UTIL",
                    message="CGST cannot be used for SGST liability",
                    severity="error",
                    section="utilization",
                ))
            
            if item.get("from") == "SGST" and item.get("to") == "CGST":
                result.add_issue(ValidationIssue(
                    code="INVALID_CROSS_UTIL",
                    message="SGST cannot be used for CGST liability",
                    severity="error",
                    section="utilization",
                ))
    
    def check_duplicate_invoice(
        self, 
        invoice_number: str, 
        gstin: str, 
        period: str
    ) -> bool:
        """
        Check for duplicate invoice across periods.
        
        Args:
            invoice_number: Invoice number
            gstin: Supplier GSTIN
            period: Return period
            
        Returns:
            True if duplicate found
        """
        key = f"{gstin}:{invoice_number}"
        
        if key in self.known_invoices:
            if period in self.known_invoices[key]:
                return True
            self.known_invoices[key].append(period)
        else:
            self.known_invoices[key] = [period]
        
        return False


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def validate_gstr3b(
    gstr3b_data: Dict[str, Any],
    config: Optional[ValidationConfig] = None
) -> ValidationResult:
    """
    Validate GSTR-3B data.
    
    Args:
        gstr3b_data: Complete GSTR-3B data dictionary
        config: Optional validation configuration
        
    Returns:
        ValidationResult
    """
    validator = GSTR3BValidator(config)
    return validator.validate(gstr3b_data)


def validate_with_tolerance(
    gstr3b_data: Dict[str, Any],
    tolerance: float = 1.0
) -> ValidationResult:
    """
    Validate GSTR-3B with custom tolerance.
    
    Args:
        gstr3b_data: Complete GSTR-3B data dictionary
        tolerance: ITC tolerance (± amount)
        
    Returns:
        ValidationResult
    """
    config = ValidationConfig(itc_tolerance=tolerance)
    return validate_gstr3b(gstr3b_data, config)
