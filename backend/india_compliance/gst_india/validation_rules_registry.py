"""
GST India Validation Rules Registry
====================================

This module provides a comprehensive registry of 200+ validation rules
for GST compliance across multiple categories and return types.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Callable, Any, Set
import re


# =============================================================================
# ENUMS
# =============================================================================

class ValidationSeverity(str, Enum):
    """Severity levels for validation rules."""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    CRITICAL = "critical"


class ValidationCategory(str, Enum):
    """Main categories of validation rules."""
    GSTIN = "gstin"
    INVOICE = "invoice"
    TAX = "tax"
    HSN = "hsn"
    RETURN_PERIOD = "return_period"
    GSTR1 = "gstr1"
    GSTR3B = "gstr3b"
    CROSS_RETURN = "cross_return"
    CLASSIFICATION = "classification"
    FORMAT = "format"
    AMOUNT = "amount"
    DATE = "date"
    DUPLICATE = "duplicate"
    CONSISTENCY = "consistency"


class GSTRReturnType(str, Enum):
    """GSTR Return Types."""
    GSTR1 = "GSTR-1"
    GSTR2A = "GSTR-2A"
    GSTR2B = "GSTR-2B"
    GSTR3B = "GSTR-3B"
    GSTR4 = "GSTR-4"
    GSTR5 = "GSTR-5"
    GSTR6 = "GSTR-6"
    GSTR7 = "GSTR-7"
    GSTR8 = "GSTR-8"
    GSTR9 = "GSTR-9"


# =============================================================================
# CONSTANTS
# =============================================================================

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
UIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$")

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

UNION_TERRITORIES = {'04', '05', '07', '25', '26', '31', '34', '35', '37'}
ALLOWED_GST_RATES = {0, 0.1, 0.25, 3, 5, 12, 18, 28}
B2C_LIMIT_OLD = 250000
B2C_LIMIT_NEW = 100000
E_INVOICE_THRESHOLD = 50000
ROUNDING_TOLERANCE = 0.50


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class ValidationRuleDefinition:
    """Defines a validation rule with full metadata."""
    id: str
    name: str
    description: str
    category: ValidationCategory
    subcategory: str
    severity: ValidationSeverity
    applicable_returns: Set[GSTRReturnType]
    error_code: str
    message_template: str
    suggestion_template: str
    check_func: Optional[Callable] = None
    auto_fix_func: Optional[Callable] = None
    dependencies: List[str] = field(default_factory=list)
    enabled: bool = True
    is_extensible: bool = True


@dataclass
class ValidationRuleRegistry:
    """Registry for all validation rules."""
    rules: Dict[str, ValidationRuleDefinition] = field(default_factory=dict)
    categories: Set[ValidationCategory] = field(default_factory=set)
    
    def register(self, rule: ValidationRuleDefinition):
        """Register a validation rule."""
        self.rules[rule.id] = rule
        self.categories.add(rule.category)
    
    def get_rule(self, rule_id: str) -> Optional[ValidationRuleDefinition]:
        """Get a rule by ID."""
        return self.rules.get(rule_id)
    
    def get_rules_by_category(self, category: ValidationCategory) -> List[ValidationRuleDefinition]:
        """Get all rules in a category."""
        return [r for r in self.rules.values() if r.category == category]
    
    def get_rules_by_return(self, return_type: GSTRReturnType) -> List[ValidationRuleDefinition]:
        """Get all rules applicable to a return type."""
        return [r for r in self.rules.values() if return_type in r.applicable_returns]
    
    def get_rules_by_severity(self, severity: ValidationSeverity) -> List[ValidationRuleDefinition]:
        """Get all rules with a specific severity."""
        return [r for r in self.rules.values() if r.severity == severity]
    
    def get_enabled_rules(self) -> List[ValidationRuleDefinition]:
        """Get all enabled rules."""
        return [r for r in self.rules.values() if r.enabled]
    
    def disable_rule(self, rule_id: str):
        """Disable a rule."""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False
    
    def enable_rule(self, rule_id: str):
        """Enable a rule."""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True
    
    @property
    def total_rules(self) -> int:
        return len(self.rules)
    
    @property
    def enabled_rules_count(self) -> int:
        return len(self.get_enabled_rules())


def create_validation_registry() -> ValidationRuleRegistry:
    """Create and populate the validation rule registry with 200+ rules."""
    registry = ValidationRuleRegistry()
    
    # GSTIN Rules (20 rules)
    _register_gstin_rules(registry)
    
    # Invoice Rules (40 rules)
    _register_invoice_rules(registry)
    
    # Tax Rules (50 rules)
    _register_tax_rules(registry)
    
    # HSN Rules (30 rules)
    _register_hsn_rules(registry)
    
    # Return Period Rules (15 rules)
    _register_return_period_rules(registry)
    
    # GSTR-1 Rules (25 rules)
    _register_gstr1_rules(registry)
    
    # GSTR-3B Rules (25 rules)
    _register_gstr3b_rules(registry)
    
    return registry


def _register_gstin_rules(registry: ValidationRuleRegistry):
    """Register GSTIN validation rules."""
    rules = [
        ValidationRuleDefinition(
            id="GSTIN_001", name="GSTIN Format Validation",
            description="Validates 15-character GSTIN format",
            category=ValidationCategory.GSTIN, subcategory="format",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="GSTIN_001", message_template="Invalid GSTIN format: {value}",
            suggestion_template="GSTIN should be 15 characters: 2 digit state code + 5 char PAN + 4 digit entity + 1 check digit"
        ),
        ValidationRuleDefinition(
            id="GSTIN_002", name="GSTIN Checksum Validation",
            description="Validates the check digit using GSTN algorithm",
            category=ValidationCategory.GSTIN, subcategory="checksum",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="GSTIN_002", message_template="GSTIN checksum validation failed: {value}",
            suggestion_template="Verify the GSTIN check digit"
        ),
        ValidationRuleDefinition(
            id="GSTIN_003", name="State Code Validity",
            description="Validates that state code is between 01-37 or special codes 97/99",
            category=ValidationCategory.GSTIN, subcategory="state_code",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="GSTIN_003", message_template="Invalid state code in GSTIN: {value}",
            suggestion_template="State code must be 01-37, 97 (UN/Body Corporate), or 99 (Other)"
        ),
        ValidationRuleDefinition(
            id="GSTIN_004", name="Entity Number Validity",
            description="Validates entity number (digits 12-15) is valid",
            category=ValidationCategory.GSTIN, subcategory="entity_number",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="GSTIN_004", message_template="Invalid entity number in GSTIN: {value}",
            suggestion_template="Entity number should be 4 digits"
        ),
        ValidationRuleDefinition(
            id="GSTIN_005", name="Test GSTIN Detection",
            description="Detects test/dummy GSTINs that should not be used for filing",
            category=ValidationCategory.GSTIN, subcategory="test_detection",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="GSTIN_005", message_template="Test GSTIN detected: {value}",
            suggestion_template="Replace with valid GSTIN for actual filing"
        ),
        ValidationRuleDefinition(
            id="GSTIN_006", name="UIN Validation",
            description="Validates Unique Identity Number format for special entities",
            category=ValidationCategory.GSTIN, subcategory="uin",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="GSTIN_006", message_template="Invalid UIN format: {value}",
            suggestion_template="UIN should be in format: 2-digit code + 4-char entity + 5-digit + check digit"
        ),
        ValidationRuleDefinition(
            id="GSTIN_007", name="GSTIN vs UIN Discrimination",
            description="Ensures correct entity type is selected for GSTIN/UIN",
            category=ValidationCategory.GSTIN, subcategory="entity_type",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="GSTIN_007", message_template="Entity type mismatch: {value}",
            suggestion_template="Verify if entity is regular GSTIN or UIN holder"
        ),
        ValidationRuleDefinition(
            id="GSTIN_008", name="PAN Linkage Validation",
            description="Validates PAN is embedded correctly in GSTIN",
            category=ValidationCategory.GSTIN, subcategory="pan_linkage",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B},
            error_code="GSTIN_008", message_template="PAN not found in GSTIN: {value}",
            suggestion_template="GSTIN should contain valid PAN at positions 3-12"
        ),
        ValidationRuleDefinition(
            id="GSTIN_009", name="GSTIN Status Validation",
            description="Validates GSTIN is active (not cancelled/suspended)",
            category=ValidationCategory.GSTIN, subcategory="status",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B},
            error_code="GSTIN_009", message_template="GSTIN may be cancelled/suspended: {value}",
            suggestion_template="Verify GSTIN status on GST portal"
        ),
        ValidationRuleDefinition(
            id="GSTIN_010", name="Same State GSTIN Validation",
            description="Validates inter-state vs intra-state determination",
            category=ValidationCategory.GSTIN, subcategory="state_match",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B},
            error_code="GSTIN_010", message_template="State code mismatch between supplier and place of supply",
            suggestion_template="For intra-state supply, supplier state should match place of supply"
        ),
        ValidationRuleDefinition(
            id="GSTIN_011", name="Composition Dealer Detection",
            description="Detects composition dealer GSTIN",
            category=ValidationCategory.GSTIN, subcategory="composition",
            severity=ValidationSeverity.INFO,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="GSTIN_011", message_template="Composition dealer GSTIN detected: {value}",
            suggestion_template="Composition dealers cannot claim ITC"
        ),
        ValidationRuleDefinition(
            id="GSTIN_012", name="SEZ Unit Detection",
            description="Validates SEZ unit GSTIN format",
            category=ValidationCategory.GSTIN, subcategory="sez",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="GSTIN_012", message_template="SEZ unit validation failed: {value}",
            suggestion_template="SEZ units should have proper authorization"
        ),
        ValidationRuleDefinition(
            id="GSTIN_013", name="ISD GSTIN Validation",
            description="Validates Input Service Distributor GSTIN",
            category=ValidationCategory.GSTIN, subcategory="isd",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR6},
            error_code="GSTIN_013", message_template="ISD GSTIN validation failed: {value}",
            suggestion_template="ISD registration should be separate"
        ),
        ValidationRuleDefinition(
            id="GSTIN_014", name="E-Commerce Operator GSTIN",
            description="Validates e-commerce operator GSTIN",
            category=ValidationCategory.GSTIN, subcategory="ecommerce",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B},
            error_code="GSTIN_014", message_template="E-commerce operator validation failed: {value}",
            suggestion_template="E-commerce operators need separate registration"
        ),
        ValidationRuleDefinition(
            id="GSTIN_015", name="TDS Deductor GSTIN",
            description="Validates TDS deductor GSTIN for GSTR-7",
            category=ValidationCategory.GSTIN, subcategory="tds",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR7},
            error_code="GSTIN_015", message_template="TDS deductor GSTIN validation failed: {value}",
            suggestion_template="TDS deductor should have valid GSTIN"
        ),
        ValidationRuleDefinition(
            id="GSTIN_016", name="TCS Collector GSTIN",
            description="Validates TCS collector GSTIN for GSTR-8",
            category=ValidationCategory.GSTIN, subcategory="tcs",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR8},
            error_code="GSTIN_016", message_template="TCS collector GSTIN validation failed: {value}",
            suggestion_template="TCS collector should have valid GSTIN"
        ),
        ValidationRuleDefinition(
            id="GSTIN_017", name="Non-Resident Taxpayer GSTIN",
            description="Validates non-resident taxpayer GSTIN format",
            category=ValidationCategory.GSTIN, subcategory="non_resident",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR5},
            error_code="GSTIN_017", message_template="Non-resident taxpayer validation failed: {value}",
            suggestion_template="Non-resident taxpayers have specific GSTIN format"
        ),
        ValidationRuleDefinition(
            id="GSTIN_018", name="OIDAR Service Provider GSTIN",
            description="Validates OIDAR service provider GSTIN",
            category=ValidationCategory.GSTIN, subcategory="oidar",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR5},
            error_code="GSTIN_018", message_template="OIDAR provider validation failed: {value}",
            suggestion_template="OIDAR service providers need specific registration"
        ),
        ValidationRuleDefinition(
            id="GSTIN_019", name="Unique Entity Reference Validation",
            description="Validates UER for government entities",
            category=ValidationCategory.GSTIN, subcategory="uer",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="GSTIN_019", message_template="Unique Entity Reference validation failed: {value}",
            suggestion_template="Government entities may have UER instead of PAN"
        ),
        ValidationRuleDefinition(
            id="GSTIN_020", name="Casual Taxable Person GSTIN",
            description="Validates casual taxable person GSTIN",
            category=ValidationCategory.GSTIN, subcategory="casual",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR4},
            error_code="GSTIN_020", message_template="Casual taxable person validation failed: {value}",
            suggestion_template="Casual taxable persons have temporary registration"
        ),
    ]
    
    for rule in rules:
        registry.register(rule)


def _register_invoice_rules(registry: ValidationRuleRegistry):
    """Register Invoice validation rules (40 rules)."""
    rules = [
        ValidationRuleDefinition(
            id="INV_001", name="Invoice Number Required",
            description="Validates invoice number is present",
            category=ValidationCategory.INVOICE, subcategory="required",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_001", message_template="Invoice number is required",
            suggestion_template="Provide invoice number"
        ),
        ValidationRuleDefinition(
            id="INV_002", name="Invoice Number Format",
            description="Validates invoice number format (max 16 chars, no special chars)",
            category=ValidationCategory.INVOICE, subcategory="format",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_002", message_template="Invalid invoice number format: {value}",
            suggestion_template="Invoice number should be max 16 characters without special characters"
        ),
        ValidationRuleDefinition(
            id="INV_003", name="Invoice Date Required",
            description="Validates invoice date is present",
            category=ValidationCategory.INVOICE, subcategory="required",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_003", message_template="Invoice date is required",
            suggestion_template="Provide invoice date in DD/MM/YYYY format"
        ),
        ValidationRuleDefinition(
            id="INV_004", name="Invoice Date Format",
            description="Validates invoice date is in correct format",
            category=ValidationCategory.INVOICE, subcategory="format",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_004", message_template="Invalid invoice date format: {value}",
            suggestion_template="Use DD/MM/YYYY format"
        ),
        ValidationRuleDefinition(
            id="INV_005", name="Invoice Date Not Future",
            description="Validates invoice date is not in the future",
            category=ValidationCategory.INVOICE, subcategory="date_range",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_005", message_template="Invoice date is in the future: {value}",
            suggestion_template="Invoice date cannot be future dated"
        ),
        ValidationRuleDefinition(
            id="INV_006", name="Invoice Within Return Period",
            description="Validates invoice date falls within the return period",
            category=ValidationCategory.INVOICE, subcategory="date_range",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="INV_006", message_template="Invoice date {value} is outside return period",
            suggestion_template="Invoice date should fall within the filing period"
        ),
        ValidationRuleDefinition(
            id="INV_007", name="Invoice Duplicate Detection",
            description="Checks for duplicate invoice numbers",
            category=ValidationCategory.DUPLICATE, subcategory="duplicate",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="INV_007", message_template="Duplicate invoice detected: {value}",
            suggestion_template="Remove duplicate invoice entries"
        ),
        ValidationRuleDefinition(
            id="INV_008", name="Invoice Value Limit E-invoice",
            description="Validates B2B invoices above ₹50,000 need e-invoice",
            category=ValidationCategory.INVOICE, subcategory="e_invoice",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_008", message_template="E-invoice required for invoice value above ₹50,000: {value}",
            suggestion_template="Generate e-invoice for B2B invoices above ₹50,000"
        ),
        ValidationRuleDefinition(
            id="INV_009", name="Bill-to-Ship-to Validation",
            description="Validates bill-to and ship-to details for B2B",
            category=ValidationCategory.INVOICE, subcategory="address",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_009", message_template="Bill-to/Ship-to validation failed",
            suggestion_template="Provide complete billing and shipping address"
        ),
        ValidationRuleDefinition(
            id="INV_010", name="Place of Supply Required",
            description="Validates place of supply is present",
            category=ValidationCategory.INVOICE, subcategory="required",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_010", message_template="Place of supply is required",
            suggestion_template="Provide place of supply (state code or name)"
        ),
        ValidationRuleDefinition(
            id="INV_011", name="Place of Supply Validity",
            description="Validates place of supply is a valid Indian state",
            category=ValidationCategory.INVOICE, subcategory="validity",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_011", message_template="Invalid place of supply: {value}",
            suggestion_template="Use valid Indian state code (01-37)"
        ),
        ValidationRuleDefinition(
            id="INV_012", name="Invoice Type Classification",
            description="Validates correct invoice type selection",
            category=ValidationCategory.CLASSIFICATION, subcategory="invoice_type",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_012", message_template="Invalid invoice type: {value}",
            suggestion_template="Select correct invoice type (B2B, B2CL, B2CS, Export, etc.)"
        ),
        ValidationRuleDefinition(
            id="INV_013", name="Document Type Validation",
            description="Validates document type for credit/debit notes",
            category=ValidationCategory.CLASSIFICATION, subcategory="document_type",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_013", message_template="Invalid document type: {value}",
            suggestion_template="Select correct document type (Invoice, Credit Note, Debit Note)"
        ),
        ValidationRuleDefinition(
            id="INV_014", name="Serial Number Continuity",
            description="Validates serial numbers are sequential",
            category=ValidationCategory.INVOICE, subcategory="serial_number",
            severity=ValidationSeverity.INFO,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_014", message_template="Serial number gap detected",
            suggestion_template="Ensure serial numbers are continuous or documented"
        ),
        ValidationRuleDefinition(
            id="INV_015", name="Invoice Value Required",
            description="Validates invoice value is present and positive",
            category=ValidationCategory.AMOUNT, subcategory="required",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_015", message_template="Invoice value is required and must be positive",
            suggestion_template="Provide invoice value greater than zero"
        ),
        ValidationRuleDefinition(
            id="INV_016", name="Taxable Value Required",
            description="Validates taxable value is present",
            category=ValidationCategory.AMOUNT, subcategory="required",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="INV_016", message_template="Taxable value is required",
            suggestion_template="Provide taxable value"
        ),
        ValidationRuleDefinition(
            id="INV_017", name="Invoice Value Consistency",
            description="Validates invoice_value = taxable_value + all taxes",
            category=ValidationCategory.CONSISTENCY, subcategory="amount",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="INV_017", message_template="Invoice value mismatch: expected {expected}, got {actual}",
            suggestion_template="Invoice value should equal taxable value + all tax amounts"
        ),
        ValidationRuleDefinition(
            id="INV_018", name="Reverse Charge Indicator",
            description="Validates reverse charge applicability",
            category=ValidationCategory.TAX, subcategory="rcm",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="INV_018", message_template="Reverse charge validation: {value}",
            suggestion_template="Mark reverse charge as Y/N appropriately"
        ),
        ValidationRuleDefinition(
            id="INV_019", name="Export Invoice Validation",
            description="Validates export invoice has shipping bill/boE",
            category=ValidationCategory.INVOICE, subcategory="export",
            severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_019", message_template="Export invoice validation: {value}",
            suggestion_template="Provide shipping bill number and date for exports"
        ),
        ValidationRuleDefinition(
            id="INV_020", name="Deemed Export Validation",
            description="Validates deemed export invoices",
            category=ValidationCategory.INVOICE, subcategory="deemed_export",
            severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1},
            error_code="INV_020", message_template="Deemed export validation failed: {value}",
            suggestion_template="Deemed exports need supplier and recipient GSTIN"
        ),
    ]
    
    # Add more invoice rules (21-40)
    more_invoice_rules = [
        ValidationRuleDefinition(id="INV_021", name="SEZ Invoice Validation", description="Validates SEZ invoices have proper approval",
            category=ValidationCategory.INVOICE, subcategory="sez", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_021",
            message_template="SEZ invoice validation failed: {value}", suggestion_template="SEZ invoices need proper authorization"),
        ValidationRuleDefinition(id="INV_022", name="B2CL High Value Limit", description="Validates B2CL threshold (₹2.5 lakhs for inter-state)",
            category=ValidationCategory.INVOICE, subcategory="threshold", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_022",
            message_template="B2CL threshold validation: {value}", suggestion_template="B2CL applies to inter-state sales above ₹2.5 lakhs without GSTIN"),
        ValidationRuleDefinition(id="INV_023", name="B2CS Small Value Limit", description="Validates B2CS threshold (₹1 lakh for intra-state)",
            category=ValidationCategory.INVOICE, subcategory="threshold", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_023",
            message_template="B2CS threshold validation: {value}", suggestion_template="B2CS applies to sales without GSTIN below threshold"),
        ValidationRuleDefinition(id="INV_024", name="Credit Note Reference Validation", description="Validates credit note has original invoice reference",
            category=ValidationCategory.INVOICE, subcategory="credit_note", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_024",
            message_template="Credit note should reference original invoice: {value}", suggestion_template="Provide original invoice number and date for credit notes"),
        ValidationRuleDefinition(id="INV_025", name="Debit Note Reference Validation", description="Validates debit note has original invoice reference",
            category=ValidationCategory.INVOICE, subcategory="debit_note", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_025",
            message_template="Debit note should reference original invoice: {value}", suggestion_template="Provide original invoice number and date for debit notes"),
        ValidationRuleDefinition(id="INV_026", name="Amendment Invoice Reference", description="Validates amended invoice references original",
            category=ValidationCategory.INVOICE, subcategory="amendment", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_026",
            message_template="Amendment should reference original invoice: {value}", suggestion_template="Provide original invoice number for amendments"),
        ValidationRuleDefinition(id="INV_027", name="Tax Invoice vs Bill of Supply", description="Validates correct document type for exempt supplies",
            category=ValidationCategory.CLASSIFICATION, subcategory="document_type", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_027",
            message_template="Bill of Supply required for exempt supplies: {value}", suggestion_template="Use Bill of Supply for exempt/nil-rated supplies"),
        ValidationRuleDefinition(id="INV_028", name="Recipient Name Required", description="Validates recipient/customer name for B2B",
            category=ValidationCategory.INVOICE, subcategory="required", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_028",
            message_template="Recipient name is required for B2B invoices", suggestion_template="Provide recipient/customer name"),
        ValidationRuleDefinition(id="INV_029", name="Recipient Address Validation", description="Validates recipient address for B2B invoices",
            category=ValidationCategory.INVOICE, subcategory="address", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_029",
            message_template="Recipient address validation: {value}", suggestion_template="Provide complete recipient address"),
        ValidationRuleDefinition(id="INV_030", name="E-waybill Validation", description="Validates e-waybill number for eligible invoices",
            category=ValidationCategory.INVOICE, subcategory="ewaybill", severity=ValidationSeverity.INFO,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_030",
            message_template="E-waybill validation: {value}", suggestion_template="Generate e-waybill for intra-state above ₹50,000 or inter-state"),
        ValidationRuleDefinition(id="INV_031", name="Tax Deduction at Source", description="Validates TDS deduction for eligible invoices",
            category=ValidationCategory.INVOICE, subcategory="tds", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B}, error_code="INV_031",
            message_template="TDS validation: {value}", suggestion_template="Check TDS applicability for specified recipients"),
        ValidationRuleDefinition(id="INV_032", name="TCS Collection", description="Validates TCS collection for e-commerce operators",
            category=ValidationCategory.INVOICE, subcategory="tcs", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_032",
            message_template="TCS validation: {value}", suggestion_template="E-commerce operators must collect TCS on supplies"),
        ValidationRuleDefinition(id="INV_033", name="GST Payment Mode", description="Validates GST payment mode selection",
            category=ValidationCategory.TAX, subcategory="payment", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="INV_033",
            message_template="GST payment mode validation: {value}", suggestion_template="Select correct payment mode (Cash/Credit)"),
        ValidationRuleDefinition(id="INV_034", name="Port Code Validation", description="Validates port code for export invoices",
            category=ValidationCategory.INVOICE, subcategory="export", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_034",
            message_template="Invalid port code: {value}", suggestion_template="Use valid port code from customs list"),
        ValidationRuleDefinition(id="INV_035", name="Country Code Validation", description="Validates country code for export invoices",
            category=ValidationCategory.INVOICE, subcategory="export", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_035",
            message_template="Invalid country code: {value}", suggestion_template="Use ISO country code (IN for India, others as per ISO 3166-1)"),
        ValidationRuleDefinition(id="INV_036", name="Shipping Bill Date", description="Validates shipping bill date is after invoice date",
            category=ValidationCategory.INVOICE, subcategory="export", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_036",
            message_template="Shipping bill date should be after invoice date: {value}", suggestion_template="Verify shipping bill date"),
        ValidationRuleDefinition(id="INV_037", name="Original Invoice for Credit/Debit Note", description="Validates original invoice date for credit/debit notes",
            category=ValidationCategory.INVOICE, subcategory="credit_debit_note", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_037",
            message_template="Original invoice date validation: {value}", suggestion_template="Credit/debit note should be within 1 year of original invoice"),
        ValidationRuleDefinition(id="INV_038", name="Advance Receipt Validation", description="Validates advance receipt for GST payment",
            category=ValidationCategory.INVOICE, subcategory="advance", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="INV_038",
            message_template="Advance receipt validation: {value}", suggestion_template="GST should be paid on advance receipts"),
        ValidationRuleDefinition(id="INV_039", name="Nil Rated Supplies Classification", description="Validates nil rated supplies are correctly classified",
            category=ValidationCategory.CLASSIFICATION, subcategory="nil_rated", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="INV_039",
            message_template="Nil rated supply validation: {value}", suggestion_template="Nil rated supplies should have 0% tax rate"),
        ValidationRuleDefinition(id="INV_040", name="Exempt Supplies Classification", description="Validates exempt supplies are correctly classified",
            category=ValidationCategory.CLASSIFICATION, subcategory="exempt", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="INV_040",
            message_template="Exempt supply validation: {value}", suggestion_template="Exempt supplies should not be mixed with taxable supplies"),
    ]
    
    rules.extend(more_invoice_rules)
    
    for rule in rules:
        registry.register(rule)


def _register_tax_rules(registry: ValidationRuleRegistry):
    """Register Tax Calculation validation rules (50 rules)."""
    rules = [
        ValidationRuleDefinition(id="TAX_001", name="CGST Rate Validation", description="Validates CGST rate is from allowed list",
            category=ValidationCategory.TAX, subcategory="cgst_rate", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_001", message_template="Invalid CGST rate: {value}",
            suggestion_template="Use standard CGST rates: 0%, 0.25%, 3%, 5%, 12%, 18%, 28%"),
        ValidationRuleDefinition(id="TAX_002", name="SGST Rate Validation", description="Validates SGST rate matches CGST rate for intra-state",
            category=ValidationCategory.TAX, subcategory="sgst_rate", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_002", message_template="SGST rate should match CGST rate for intra-state: {value}",
            suggestion_template="For intra-state, SGST = CGST"),
        ValidationRuleDefinition(id="TAX_003", name="IGST Rate Validation", description="Validates IGST rate for inter-state transactions",
            category=ValidationCategory.TAX, subcategory="igst_rate", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_003", message_template="IGST rate validation: {value}",
            suggestion_template="For inter-state, use IGST instead of CGST+SGST"),
        ValidationRuleDefinition(id="TAX_004", name="CGST+SGST vs IGST Mutual Exclusivity", description="Validates IGST and CGST/SGST are not both applied",
            category=ValidationCategory.TAX, subcategory="mutual_exclusive", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_004", message_template="Cannot apply both IGST and CGST/SGST: {value}",
            suggestion_template="Use IGST for inter-state, CGST+SGST for intra-state"),
        ValidationRuleDefinition(id="TAX_005", name="CGST Amount Calculation", description="Validates CGST amount = taxable_value × rate / 2",
            category=ValidationCategory.TAX, subcategory="cgst_calc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="TAX_005", message_template="CGST calculation error: expected {expected}, got {actual}",
            suggestion_template="CGST = (taxable_value × rate) / 2"),
        ValidationRuleDefinition(id="TAX_006", name="SGST Amount Calculation", description="Validates SGST amount = taxable_value × rate / 2",
            category=ValidationCategory.TAX, subcategory="sgst_calc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="TAX_006", message_template="SGST calculation error: expected {expected}, got {actual}",
            suggestion_template="SGST = (taxable_value × rate) / 2"),
        ValidationRuleDefinition(id="TAX_007", name="IGST Amount Calculation", description="Validates IGST amount = taxable_value × rate",
            category=ValidationCategory.TAX, subcategory="igst_calc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="TAX_007", message_template="IGST calculation error: expected {expected}, got {actual}",
            suggestion_template="IGST = taxable_value × rate"),
        ValidationRuleDefinition(id="TAX_008", name="Cess Rate Validation", description="Validates cess rate for specific goods/services",
            category=ValidationCategory.TAX, subcategory="cess_rate", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_008", message_template="Invalid cess rate: {value}",
            suggestion_template="Check applicable cess rate for goods"),
        ValidationRuleDefinition(id="TAX_009", name="Cess Amount Calculation", description="Validates cess amount calculation",
            category=ValidationCategory.TAX, subcategory="cess_calc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="TAX_009", message_template="Cess calculation error: expected {expected}, got {actual}",
            suggestion_template="Cess = taxable_value × cess_rate (if applicable)"),
        ValidationRuleDefinition(id="TAX_010", name="RCM Applicability", description="Validates reverse charge mechanism applicability",
            category=ValidationCategory.TAX, subcategory="rcm", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_010", message_template="Reverse charge validation: {value}",
            suggestion_template="Check RCM applicability for specific goods/services"),
        ValidationRuleDefinition(id="TAX_011", name="RCM Tax Calculation", description="Validates tax calculation under RCM",
            category=ValidationCategory.TAX, subcategory="rcm_calc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_011", message_template="RCM tax calculation error: {value}",
            suggestion_template="Under RCM, recipient pays tax"),
        ValidationRuleDefinition(id="TAX_012", name="Exempt Supply Validation", description="Validates exempt supplies have zero tax",
            category=ValidationCategory.TAX, subcategory="exempt", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B},
            error_code="TAX_012", message_template="Exempt supply should have zero tax: {value}",
            suggestion_template="Exempt supplies cannot have tax amount"),
        ValidationRuleDefinition(id="TAX_013", name="Nil Rated Supply Validation", description="Validates nil rated supplies",
            category=ValidationCategory.TAX, subcategory="nil_rated", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B},
            error_code="TAX_013", message_template="Nil rated supply validation: {value}",
            suggestion_template="Nil rated supplies have 0% rate"),
        ValidationRuleDefinition(id="TAX_014", name="Zero Rated Supply Validation", description="Validates zero rated exports/SEZ",
            category=ValidationCategory.TAX, subcategory="zero_rated", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B},
            error_code="TAX_014", message_template="Zero rated supply validation: {value}",
            suggestion_template="Exports/SEZ are zero rated but need documentation"),
        ValidationRuleDefinition(id="TAX_015", name="Integrated Tax Validation", description="Validates integrated tax calculation for inter-state",
            category=ValidationCategory.TAX, subcategory="integrated_tax", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B},
            error_code="TAX_015", message_template="Integrated tax validation: {value}",
            suggestion_template="Check integrated tax computation"),
    ]
    
    # Add more tax rules (16-50)
    more_tax_rules = [
        ValidationRuleDefinition(id="TAX_016", name="State Tax Validation", description="Validates state tax (SGST/UTGST) calculation",
            category=ValidationCategory.TAX, subcategory="state_tax", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_016",
            message_template="State tax validation: {value}", suggestion_template="Check SGST/UTGST computation"),
        ValidationRuleDefinition(id="TAX_017", name="Central Tax Validation", description="Validates central tax (CGST) calculation",
            category=ValidationCategory.TAX, subcategory="central_tax", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_017",
            message_template="Central tax validation: {value}", suggestion_template="Check CGST computation"),
        ValidationRuleDefinition(id="TAX_018", name="Tax Rounding Validation", description="Validates tax amounts are rounded to 2 decimal places",
            category=ValidationCategory.TAX, subcategory="rounding", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="TAX_018", message_template="Tax should be rounded to 2 decimal places: {value}",
            suggestion_template="Round tax amounts to nearest paise"),
        ValidationRuleDefinition(id="TAX_019", name="ITC Eligibility Validation", description="Validates ITC eligibility criteria",
            category=ValidationCategory.TAX, subcategory="itc", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, error_code="TAX_019",
            message_template="ITC eligibility validation failed: {value}", suggestion_template="Check ITC eligibility conditions"),
        ValidationRuleDefinition(id="TAX_020", name="ITC Reversal Validation", description="Validates ITC reversal for specific cases",
            category=ValidationCategory.TAX, subcategory="itc_reversal", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_020",
            message_template="ITC reversal validation failed: {value}", suggestion_template="Reverse ITC for non-eligible supplies"),
        ValidationRuleDefinition(id="TAX_021", name="Interest Calculation Validation", description="Validates interest on late payment",
            category=ValidationCategory.TAX, subcategory="interest", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_021",
            message_template="Interest calculation: {value}", suggestion_template="Calculate interest @ 18% for delayed tax payment"),
        ValidationRuleDefinition(id="TAX_022", name="Late Fee Calculation Validation", description="Validates late fee for delayed filing",
            category=ValidationCategory.TAX, subcategory="late_fee", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_022",
            message_template="Late fee calculation: {value}", suggestion_template="Calculate late fee as per GSTN rules"),
        ValidationRuleDefinition(id="TAX_023", name="Cash Credit Validation", description="Validates cash ledger credit utilization",
            category=ValidationCategory.TAX, subcategory="cash_credit", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_023",
            message_template="Cash credit validation: {value}", suggestion_template="Check cash credit balance"),
        ValidationRuleDefinition(id="TAX_024", name="Electronic Credit Ledger Validation", description="Validates electronic credit ledger utilization",
            category=ValidationCategory.TAX, subcategory="e_credit", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_024",
            message_template="E-credit ledger validation: {value}", suggestion_template="Check credit ledger balance"),
        ValidationRuleDefinition(id="TAX_025", name="Electronic Cash Ledger Validation", description="Validates electronic cash ledger utilization",
            category=ValidationCategory.TAX, subcategory="e_cash", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_025",
            message_template="E-cash ledger validation: {value}", suggestion_template="Check cash ledger balance"),
        ValidationRuleDefinition(id="TAX_026", name="Tax Demand Validation", description="Validates tax demand computation",
            category=ValidationCategory.TAX, subcategory="demand", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="TAX_026",
            message_template="Tax demand validation: {value}", suggestion_template="Verify tax demand calculation"),
        ValidationRuleDefinition(id="TAX_027", name="Tax Refund Validation", description="Validates refund claim computation",
            category=ValidationCategory.TAX, subcategory="refund", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B, GSTRReturnType.GSTR1}, error_code="TAX_027",
            message_template="Refund validation: {value}", suggestion_template="Verify refund eligibility and computation"),
        ValidationRuleDefinition(id="TAX_028", name="Advance Tax Validation", description="Validates advance tax received/payment",
            category=ValidationCategory.TAX, subcategory="advance", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="TAX_028",
            message_template="Advance tax validation: {value}", suggestion_template="Check advance tax accounting"),
        ValidationRuleDefinition(id="TAX_029", name="Composition Tax Validation", description="Validates composition scheme tax rates",
            category=ValidationCategory.TAX, subcategory="composition", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR4}, error_code="TAX_029",
            message_template="Composition tax validation: {value}", suggestion_template="Composition rates: 0.5% (mfg), 2.5% (services), 1% (others)"),
        ValidationRuleDefinition(id="TAX_030", name="TDS Tax Validation", description="Validates TDS deduction and deposit",
            category=ValidationCategory.TAX, subcategory="tds", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR7}, error_code="TAX_030",
            message_template="TDS validation: {value}", suggestion_template="TDS @ 2% on specified payments"),
        ValidationRuleDefinition(id="TAX_031", name="TCS Tax Validation", description="Validates TCS collection and deposit",
            category=ValidationCategory.TAX, subcategory="tcs", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR8}, error_code="TAX_031",
            message_template="TCS validation: {value}", suggestion_template="TCS @ 1% on e-commerce sales"),
        ValidationRuleDefinition(id="TAX_032", name="Input Tax Reconciliation", description="Reconciles input tax across returns",
            category=ValidationCategory.TAX, subcategory="reconciliation", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, error_code="TAX_032",
            message_template="Input tax reconciliation: {value}", suggestion_template="Match input tax from GSTR-2B with GSTR-3B"),
        ValidationRuleDefinition(id="TAX_033", name="Output Tax Reconciliation", description="Reconciles output tax across returns",
            category=ValidationCategory.TAX, subcategory="reconciliation", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="TAX_033",
            message_template="Output tax reconciliation: {value}", suggestion_template="Match output tax from GSTR-1 with GSTR-3B"),
        ValidationRuleDefinition(id="TAX_034", name="Tax Rate Change Validation", description="Validates tax rate changes are reflected",
            category=ValidationCategory.TAX, subcategory="rate_change", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="TAX_034",
            message_template="Tax rate change validation: {value}", suggestion_template="Apply correct tax rate as per notification date"),
        ValidationRuleDefinition(id="TAX_035", name="Supply Type Tax Validation", description="Validates tax based on supply type",
            category=ValidationCategory.TAX, subcategory="supply_type", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B}, error_code="TAX_035",
            message_template="Supply type tax validation: {value}", suggestion_template="Different supplies have different tax treatments"),
    ]
    
    rules.extend(more_tax_rules)
    
    # Add remaining tax rules (36-50)
    for i, rule_def in enumerate([
        ("TAX_036", "Place of Supply Tax Impact", "Validates tax based on place of supply", "pos_tax", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, "Inter-state POS triggers IGST"),
        ("TAX_037", "Branch Transfer Validation", "Validates branch transfer tax treatment", "branch_transfer", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "Branch transfers are treated as supply"),
        ("TAX_038", "Stock Transfer Validation", "Validates stock transfer tax treatment", "stock_transfer", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "Stock transfers between states are taxable"),
        ("TAX_039", "Job Work Validation", "Validates job work tax treatment", "job_work", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B}, "Check job work provisions and ITC"),
        ("TAX_040", "Royalty/License Fee Validation", "Validates royalty/license fee tax treatment", "royalty", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, "Royalty fees attract GST under RCM"),
        ("TAX_041", "Director Services Validation", "Validates director services tax treatment", "director", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, "Director services attract GST under RCM"),
        ("TAX_042", "Government Discount Validation", "Validates government discount tax treatment", "discount", {GSTRReturnType.GSTR1}, "Check discount provisions for government"),
        ("TAX_043", "Trade Discount Validation", "Validates trade discount tax treatment", "discount", {GSTRReturnType.GSTR1}, "Trade discount allowed if not linked to invoice"),
        ("TAX_044", "Secondary Adjustments", "Validates secondary adjustment requirements", "adjustment", {GSTRReturnType.GSTR3B}, "Make secondary adjustments for excess ITC"),
        ("TAX_045", "Transition Credit Validation", "Validates transition credit under GST", "transition", {GSTRReturnType.GSTR3B}, "Verify transition credit eligibility"),
        ("TAX_046", "ISD Credit Validation", "Validates ISD credit distribution", "isd", {GSTRReturnType.GSTR6}, "Verify ISD credit distribution rules"),
        ("TAX_047", "Distribution of Credit", "Validates credit distribution by ISD", "distribution", {GSTRReturnType.GSTR6}, "Credit distribution should be as per rules"),
        ("TAX_048", "TDS Credit Validation", "Validates TDS credit in GSTR-2A/2B", "tds_credit", {GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B}, "TDS credit appears in GSTR-2A/2B"),
        ("TAX_049", "TCS Credit Validation", "Validates TCS credit in GSTR-2A/2B", "tcs_credit", {GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B}, "TCS credit appears in GSTR-2A/2B"),
        ("TAX_050", "Electronic Liability Register", "Validates electronic liability register entries", "elr", {GSTRReturnType.GSTR3B}, "Check electronic liability register"),
    ]):
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.TAX, subcategory=rule_def[3], severity=ValidationSeverity.ERROR,
            applicable_returns=rule_def[4], error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[5]
        ))
    
    for rule in rules:
        registry.register(rule)


def _register_hsn_rules(registry: ValidationRuleRegistry):
    """Register HSN Code validation rules (30 rules)."""
    rules = [
        ValidationRuleDefinition(id="HSN_001", name="HSN Code Format", description="Validates HSN code is 4, 6, or 8 digits",
            category=ValidationCategory.HSN, subcategory="format", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B},
            error_code="HSN_001", message_template="Invalid HSN code format: {value}",
            suggestion_template="HSN code should be 4, 6, or 8 digits"),
        ValidationRuleDefinition(id="HSN_002", name="HSN Chapter Validity", description="Validates HSN chapter exists (01-99)",
            category=ValidationCategory.HSN, subcategory="chapter", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="HSN_002", message_template="Invalid HSN chapter: {value}",
            suggestion_template="HSN chapters range from 01 to 99"),
        ValidationRuleDefinition(id="HSN_003", name="HSN Heading Validity", description="Validates HSN heading is valid for chapter",
            category=ValidationCategory.HSN, subcategory="heading", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="HSN_003", message_template="Invalid HSN heading: {value}",
            suggestion_template="Check valid heading for the chapter"),
        ValidationRuleDefinition(id="HSN_004", name="SAC Code Validation", description="Validates SAC code for services (99xx.xx format)",
            category=ValidationCategory.HSN, subcategory="sac", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="HSN_004", message_template="Invalid SAC code: {value}",
            suggestion_template="SAC codes start with 99 and are 4-6 digits"),
        ValidationRuleDefinition(id="HSN_005", name="HSN-Tax Rate Mapping", description="Validates HSN code has correct tax rate",
            category=ValidationCategory.HSN, subcategory="rate_mapping", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B},
            error_code="HSN_005", message_template="HSN-tax rate mismatch: {value}",
            suggestion_template="Check recommended tax rate for HSN code"),
        ValidationRuleDefinition(id="HSN_006", name="Chapter 99 Services Validation", description="Validates services use SAC codes (Chapter 99)",
            category=ValidationCategory.HSN, subcategory="chapter_99", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="HSN_006",
            message_template="Services should use SAC (Chapter 99): {value}", suggestion_template="Use SAC codes starting with 99 for services"),
        ValidationRuleDefinition(id="HSN_007", name="Goods vs Services Discrimination", description="Validates correct HSN/SAC usage for goods/services",
            category=ValidationCategory.HSN, subcategory="goods_services", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B}, error_code="HSN_007",
            message_template="HSN/SAC type mismatch: {value}", suggestion_template="Use HSN for goods, SAC for services"),
        ValidationRuleDefinition(id="HSN_008", name="Chemical Name Validation", description="Validates chemical products have CAS numbers",
            category=ValidationCategory.HSN, subcategory="chemical", severity=ValidationSeverity.INFO,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="HSN_008",
            message_template="Chemical CAS validation: {value}", suggestion_template="Chemicals may require CAS number documentation"),
        ValidationRuleDefinition(id="HSN_009", name="Tobacco Products Validation", description="Validates tobacco products have additional reporting",
            category=ValidationCategory.HSN, subcategory="tobacco", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="HSN_009",
            message_template="Tobacco product validation: {value}", suggestion_template="Tobacco products have special tax treatment"),
        ValidationRuleDefinition(id="HSN_010", name="Precious Metals Validation", description="Validates precious metals HSN codes",
            category=ValidationCategory.HSN, subcategory="precious_metals", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="HSN_010",
            message_template="Precious metals validation: {value}", suggestion_template="Gold, silver have specific HSN codes (7101, 7102, 7103)"),
    ]
    
    # Add more HSN rules (11-30)
    hsn_more = [
        ("HSN_011", "Textiles HSN Validation", "Textile HSN codes (Chapter 50-63)", "textiles", {GSTRReturnType.GSTR1}, "Textiles have specific HSN codes"),
        ("HSN_012", "Food Products Validation", "Food products HSN (Chapter 1-24)", "food", {GSTRReturnType.GSTR1}, "Food products have specific HSN codes"),
        ("HSN_013", "Electronics HSN Validation", "Electronics HSN (Chapter 84-85)", "electronics", {GSTRReturnType.GSTR1}, "Electronics have specific HSN codes"),
        ("HSN_014", "Automobile HSN Validation", "Automobile HSN (Chapter 86-87)", "automobile", {GSTRReturnType.GSTR1}, "Vehicles have specific HSN codes"),
        ("HSN_015", "Medicine/Pharma HSN Validation", "Pharmaceutical HSN (Chapter 28-30)", "pharma", {GSTRReturnType.GSTR1}, "Medicines have specific HSN codes"),
        ("HSN_016", "Construction Materials HSN", "Construction materials HSN", "construction", {GSTRReturnType.GSTR1}, "Cement, steel have specific HSN codes"),
        ("HSN_017", "Textile Identification (2-digit)", "2-digit HSN for textiles", "textile_2digit", {GSTRReturnType.GSTR1}, "Textile chapters: 50-63"),
        ("HSN_018", "HSN Description Required", "HSN description is provided", "description", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2B}, "Provide HSN code description"),
        ("HSN_019", "HSN Quantity Validation", "Quantity unit matches HSN", "quantity", {GSTRReturnType.GSTR1}, "Use standard unit of measure for HSN"),
        ("HSN_020", "HSN UQC Validation", "Unit of Quantity Code", "uqc", {GSTRReturnType.GSTR1}, "Use valid UQC from GSTN list"),
        ("HSN_021", "Motor Vehicle HSN", "Motor vehicle HSN codes (8702-8703)", "motor_vehicle", {GSTRReturnType.GSTR1}, "Motor vehicles have specific HSN codes (8702, 8703)"),
        ("HSN_022", "Cement HSN Validation", "Cement HSN codes", "cement", {GSTRReturnType.GSTR1}, "Cement HSN: 2523 (Portland cement)"),
        ("HSN_023", "Steel HSN Validation", "Steel HSN codes", "steel", {GSTRReturnType.GSTR1}, "Steel HSN: Chapter 72-73"),
        ("HSN_024", "Mobile Phones HSN", "Mobile phone HSN code", "mobile", {GSTRReturnType.GSTR1}, "Mobile phones HSN: 8517 12"),
        ("HSN_025", "Footwear HSN Validation", "Footwear HSN codes", "footwear", {GSTRReturnType.GSTR1}, "Footwear HSN: Chapter 64"),
        ("HSN_026", "Readymade Garments HSN", "Readymade garments HSN", "garments", {GSTRReturnType.GSTR1}, "Garments HSN: Chapter 62"),
        ("HSN_027", "Furniture HSN Validation", "Furniture HSN codes", "furniture", {GSTRReturnType.GSTR1}, "Furniture HSN: Chapter 94"),
        ("HSN_028", "Petroleum Products HSN", "Petroleum product HSN codes", "petroleum", {GSTRReturnType.GSTR1}, "Petroleum HSN: Chapter 27 (with exemptions)"),
        ("HSN_029", "E-Waste HSN Validation", "E-waste HSN codes", "e_waste", {GSTRReturnType.GSTR1}, "E-waste HSN: Chapter 85, 84 with environmental surcharge"),
        ("HSN_030", "Solar Panels HSN", "Solar panel HSN codes", "solar", {GSTRReturnType.GSTR1}, "Solar panels HSN: 8541 40"),
    ]
    
    for rule_def in hsn_more:
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.HSN, subcategory=rule_def[3], severity=ValidationSeverity.WARNING,
            applicable_returns=rule_def[4], error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[5]
        ))
    
    for rule in rules:
        registry.register(rule)


def _register_return_period_rules(registry: ValidationRuleRegistry):
    """Register Return Period validation rules (15 rules)."""
    rules = [
        ValidationRuleDefinition(id="RET_001", name="Period Format Validation", description="Validates return period format (MM-YYYY or MMYYYY)",
            category=ValidationCategory.RETURN_PERIOD, subcategory="format", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B, GSTRReturnType.GSTR4, GSTRReturnType.GSTR9},
            error_code="RET_001", message_template="Invalid return period format: {value}",
            suggestion_template="Use format MM-YYYY or MMYYYY (e.g., 01-2025)"),
        ValidationRuleDefinition(id="RET_002", name="Filing Due Date", description="Validates filing is within due date",
            category=ValidationCategory.RETURN_PERIOD, subcategory="due_date", severity=ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="RET_002",
            message_template="Return filing due date: {value}", suggestion_template="GSTR-1 due: 10th, GSTR-3B due: 20th/22nd of next month"),
        ValidationRuleDefinition(id="RET_003", name="Late Filing Detection", description="Detects late filing and calculates penalty",
            category=ValidationCategory.RETURN_PERIOD, subcategory="late_filing", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, error_code="RET_003",
            message_template="Late filing detected: {value}", suggestion_template="Late filing fee applicable: ₹50/day (CGST+SGST)"),
        ValidationRuleDefinition(id="RET_004", name="Amendment Period Validation", description="Validates amendments are within allowed period",
            category=ValidationCategory.RETURN_PERIOD, subcategory="amendment", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="RET_004",
            message_template="Amendment period validation: {value}", suggestion_template="Amendments allowed within 10th of next month"),
        ValidationRuleDefinition(id="RET_005", name="Annual Return Period Validation", description="Validates annual return period (April-March)",
            category=ValidationCategory.RETURN_PERIOD, subcategory="annual", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR9}, error_code="RET_005",
            message_template="Annual return period validation: {value}", suggestion_template="Annual return covers April to March"),
    ]
    
    ret_more = [
        ("RET_006", "Quarterly Return Period Validation", "Quarterly return periods for composition", "quarterly", {GSTRReturnType.GSTR4}, "GSTR-4 is quarterly"),
        ("RET_007", "Financial Year Validation", "Period falls within valid financial year", "fy", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B, GSTRReturnType.GSTR9}, "Period should be within current/previous FY"),
        ("RET_008", "Month Validity", "Month is between 01-12", "month", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B, GSTRReturnType.GSTR4}, "Month should be 01-12"),
        ("RET_009", "Year Validity", "Year is within acceptable range", "year", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR2A, GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B, GSTRReturnType.GSTR4, GSTRReturnType.GSTR9}, "Year should be between 2017 and current year"),
        ("RET_010", "First Return Period", "First return period after registration", "first_return", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "First return starts from month of registration"),
        ("RET_011", "Cancellation Period", "Returns after registration cancellation", "cancellation", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "Returns required up to cancellation date"),
        ("RET_012", "Opt-In Period Validation", "Scheme opt-in periods", "opt_in", {GSTRReturnType.GSTR4}, "Composition scheme opt-in valid from FY start"),
        ("RET_013", "Transition Period Validation", "Transition period from pre-GST", "transition", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "GST transition rules apply for July 2017"),
        ("RET_014", "Tax Period Consistency", "Consistent tax period across sections", "consistency", {GSTRReturnType.GSTR1, GSTRReturnType.GSTR3B}, "All sections should have same return period"),
        ("RET_015", "ITC Availment Period", "ITC is claimed within allowable period", "itc_period", {GSTRReturnType.GSTR2B, GSTRReturnType.GSTR3B}, "ITC to be availed within 180 days of invoice"),
    ]
    
    for rule_def in ret_more:
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.RETURN_PERIOD, subcategory=rule_def[3], severity=ValidationSeverity.ERROR if "Consistency" not in rule_def[1] else ValidationSeverity.ERROR,
            applicable_returns=rule_def[4], error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[5]
        ))
    
    for rule in rules:
        registry.register(rule)


def _register_gstr1_rules(registry: ValidationRuleRegistry):
    """Register GSTR-1 specific validation rules (25 rules)."""
    rules = [
        ValidationRuleDefinition(id="G1_001", name="B2B Invoice Validation", description="Validates B2B invoice has recipient GSTIN",
            category=ValidationCategory.GSTR1, subcategory="b2b", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_001",
            message_template="B2B invoice requires recipient GSTIN: {value}", suggestion_template="Provide valid recipient GSTIN for B2B"),
        ValidationRuleDefinition(id="G1_002", name="B2CL High Value Validation", description="Validates B2CL threshold and recipient details",
            category=ValidationCategory.GSTR1, subcategory="b2cl", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_002",
            message_template="B2CL validation: {value}", suggestion_template="B2CL requires invoice value >₹2.5L and state code"),
        ValidationRuleDefinition(id="G1_003", name="B2CS Small Invoice Validation", description="Validates B2CS invoices without recipient GSTIN",
            category=ValidationCategory.GSTR1, subcategory="b2cs", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_003",
            message_template="B2CS validation: {value}", suggestion_template="B2CS for intra-state <₹1L without GSTIN"),
        ValidationRuleDefinition(id="G1_004", name="Export Invoice Validation", description="Validates export invoices with shipping bill",
            category=ValidationCategory.GSTR1, subcategory="export", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_004",
            message_template="Export validation: {value}", suggestion_template="Export requires shipping bill/boE details"),
        ValidationRuleDefinition(id="G1_005", name="Deemed Export Validation", description="Validates deemed export invoices",
            category=ValidationCategory.GSTR1, subcategory="deemed_export", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_005",
            message_template="Deemed export validation: {value}", suggestion_template="Deemed exports need both supplier and recipient GSTIN"),
        ValidationRuleDefinition(id="G1_006", name="SEZ Invoice Validation", description="Validates SEZ invoices with approval number",
            category=ValidationCategory.GSTR1, subcategory="sez", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_006",
            message_template="SEZ validation: {value}", suggestion_template="SEZ supplies need proper authorization"),
        ValidationRuleDefinition(id="G1_007", name="CDNR Validation", description="Validates Credit/Debit Note for Registered Person",
            category=ValidationCategory.GSTR1, subcategory="cdnr", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_007",
            message_template="CDNR validation: {value}", suggestion_template="CDNR requires recipient GSTIN and original invoice"),
        ValidationRuleDefinition(id="G1_008", name="CDNUR Validation", description="Validates Credit/Debit Note for Unregistered Person",
            category=ValidationCategory.GSTR1, subcategory="cdnur", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_008",
            message_template="CDNUR validation: {value}", suggestion_template="CDNUR requires recipient name and address"),
        ValidationRuleDefinition(id="G1_009", name="Nil Rated Supplies Validation", description="Validates nil rated supplies reported correctly",
            category=ValidationCategory.GSTR1, subcategory="nil_rated", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_009",
            message_template="Nil rated supplies validation: {value}", suggestion_template="Nil rated should have 0% tax rate"),
        ValidationRuleDefinition(id="G1_010", name="Exempted Supplies Validation", description="Validates exempted supplies reported correctly",
            category=ValidationCategory.GSTR1, subcategory="exempted", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR1}, error_code="G1_010",
            message_template="Exempted supplies validation: {value}", suggestion_template="Exempted supplies should be separately reported"),
    ]
    
    g1_more = [
        ("G1_011", "Outward Supplies Validation", "Total outward supplies matches summary", "outward", "Sum of all sections should match summary"),
        ("G1_012", "Inter-State Supplies Validation", "Inter-state supplies trigger IGST", "inter_state", "Inter-state supplies need IGST"),
        ("G1_013", "Intra-State Supplies Validation", "Intra-state supplies use CGST+SGST", "intra_state", "Intra-state supplies need CGST+SGST"),
        ("G1_014", "Taxable Supply Validation", "Taxable supply totals", "taxable", "Taxable supplies should match taxable value"),
        ("G1_015", "Advance Received Validation", "Advance received from customers", "advance", "Record advance received and adjust against supply"),
        ("G1_016", "Adjustment of Advance Validation", "Adjustment of advance against supply", "advance_adjustment", "Advance adjusted against invoice"),
        ("G1_017", "HSN Summary Validation", "HSN summary matches line items", "hsn_summary", "HSN summary should match invoice line items"),
        ("G1_018", "Document Issue Summary", "Document issue summary", "doc_summary", "Document count should match invoice count"),
        ("G1_019", "Zero Rated Supply Validation", "Zero rated exports/SEZ with LUT", "zero_rated", "Zero rated needs LUT/Bond or payment of IGST"),
        ("G1_020", "GST Portal Invoice Count", "Invoice count matches GST portal", "portal_count", "Verify with GST portal counts"),
        ("G1_021", "Amendment Validation", "Amendments to previous period", "amendment", "Amendments should reference original period"),
        ("G1_022", "E-Commerce Supply Validation", "Supplies through e-commerce", "ecommerce", "E-commerce supplies need operator details"),
        ("G1_023", "TDS Deduction Validation", "TDS deducted by recipient", "tds", "TDS @ 2% deducted by government/PSU recipients"),
        ("G1_024", "TCS Collection Validation", "TCS collected by e-commerce", "tcs", "TCS @ 1% collected by e-commerce operators"),
        ("G1_025", "Invoice Value Sum Validation", "Sum of invoice values matches total", "sum_validation", "Sum of individual invoices should match section total"),
    ]
    
    for rule_def in g1_more:
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.GSTR1, subcategory=rule_def[3], severity=ValidationSeverity.ERROR if rule_def[0] not in ["G1_015", "G1_018", "G1_020", "G1_021"] else ValidationSeverity.WARNING,
            applicable_returns={GSTRReturnType.GSTR1}, error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[4]
        ))
    
    for rule in rules:
        registry.register(rule)


def _register_gstr3b_rules(registry: ValidationRuleRegistry):
    """Register GSTR-3B specific validation rules (25 rules)."""
    rules = [
        ValidationRuleDefinition(id="G3_001", name="Outward Tax Liability Validation", description="Validates outward tax liability matches GSTR-1",
            category=ValidationCategory.GSTR3B, subcategory="outward_liability", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="G3_001",
            message_template="Outward tax liability: {value}", suggestion_template="Tax liability should match GSTR-1"),
        ValidationRuleDefinition(id="G3_002", name="Inward Supplies Validation", description="Validates inward supplies from GSTR-2A/2B",
            category=ValidationCategory.GSTR3B, subcategory="inward_supplies", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="G3_002",
            message_template="Inward supplies validation: {value}", suggestion_template="Inward supplies should match GSTR-2A/2B"),
        ValidationRuleDefinition(id="G3_003", name="ITC Eligibility Validation", description="Validates ITC claimed is eligible",
            category=ValidationCategory.GSTR3B, subcategory="itc_eligibility", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="G3_003",
            message_template="ITC eligibility: {value}", suggestion_template="Check ITC eligibility rules"),
        ValidationRuleDefinition(id="G3_004", name="ITC Reversal Validation", description="Validates ITC reversal for non-eligible items",
            category=ValidationCategory.GSTR3B, subcategory="itc_reversal", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="G3_004",
            message_template="ITC reversal: {value}", suggestion_template="Reverse ITC for blocked inputs"),
        ValidationRuleDefinition(id="G3_005", name="Late Fee Calculation Validation", description="Validates late fee calculation",
            category=ValidationCategory.GSTR3B, subcategory="late_fee", severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code="G3_005",
            message_template="Late fee calculation: {value}", suggestion_template="Late fee = ₹50/day × number of days late"),
    ]
    
    g3_more = [
        ("G3_006", "Cash Credit Validation", "Cash credit utilization", "cash_credit", "Check cash credit balance"),
        ("G3_007", "Electronic Credit Ledger Validation", "Electronic credit ledger utilization", "e_credit", "Check credit ledger balance"),
        ("G3_008", "Electronic Cash Ledger Validation", "Electronic cash ledger utilization", "e_cash", "Check cash ledger balance"),
        ("G3_009", "Tax Payment Validation", "Tax payment through cash/credit", "tax_payment", "Verify tax payment details"),
        ("G3_010", "Interest Liability Validation", "Interest on late tax payment", "interest_liability", "Calculate interest @ 18% p.a."),
        ("G3_011", "Fee Liability Validation", "Late filing fee liability", "fee_liability", "Calculate late fee as per rules"),
        ("G3_012", "Total Tax Liability Validation", "Total tax liability computation", "total_liability", "Sum of all tax liabilities"),
        ("G3_013", "ITC Available Validation", "Total ITC available", "itc_available", "Sum of eligible ITC"),
        ("G3_014", "ITC Utilized Validation", "ITC utilized for tax payment", "itc_utilized", "ITC used to pay tax liability"),
        ("G3_015", "Cash Utilized Validation", "Cash utilized for tax payment", "cash_utilized", "Cash used to pay tax"),
    ]
    
    for rule_def in g3_more:
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.GSTR3B, subcategory=rule_def[3], severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[4]
        ))
    
    g3_remaining = [
        ("G3_016", "Tax Period Match Validation", "Tax period matches across sections", "period_match", "All sections should have same period"),
        ("G3_017", "GSTR-1 vs GSTR-3B Match", "Outward tax matches GSTR-1", "gstr1_match", "Match output tax with GSTR-1"),
        ("G3_018", "GSTR-2B vs GSTR-3B Match", "ITC matches GSTR-2B", "gstr2b_match", "Match ITC with GSTR-2B"),
        ("G3_019", "Reverse Charge Validation", "Reverse charge liability", "rc_liability", "Check RCM supplies"),
        ("G3_020", "Section 9(5) Validation", "Section 9(5) specific supplies", "section_9_5", "Check specific e-commerce supplies"),
        ("G3_021", "Composition Tax Payment", "Composition tax payment", "composition", "Composition tax calculation"),
        ("G3_022", "Exempt Supply Validation", "Exempt supply reporting", "exempt_supply", "Exempt supplies should be reported"),
        ("G3_023", "Nil Rated Supply Validation", "Nil rated supply reporting", "nil_rated_supply", "Nil rated supplies should be reported"),
        ("G3_024", "Export Without Payment Validation", "Export without IGST payment", "export_without_payment", "Exports under LUT/Bond"),
        ("G3_025", "Summary Totals Validation", "Summary totals match details", "summary_totals", "Summary should equal sum of details"),
    ]
    
    for rule_def in g3_remaining:
        rules.append(ValidationRuleDefinition(
            id=rule_def[0], name=rule_def[1], description=rule_def[2],
            category=ValidationCategory.GSTR3B, subcategory=rule_def[3], severity=ValidationSeverity.ERROR,
            applicable_returns={GSTRReturnType.GSTR3B}, error_code=rule_def[0],
            message_template=f"{rule_def[1]}: {{value}}", suggestion_template=rule_def[4]
        ))
    
    for rule in rules:
        registry.register(rule)


# Create singleton instance
validation_registry = create_validation_registry()
