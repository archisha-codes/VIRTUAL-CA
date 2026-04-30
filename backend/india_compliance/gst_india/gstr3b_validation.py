"""
GSTR-3B Validation Module (Layer 1 + Layer 3)

3-Layer validation model per the GSTR-3B Validation & Logic Document:

  Layer 1 – UI Validation   : field type, mandatory fields, section enable/disable
  Layer 2 – Business Logic  : calculations, cross-table dependencies
  Layer 3 – GST Law Engine  : ITC utilization rules, negative liability, filing gate

Error Severity:
  error   → hard error (blocks filing and step progression)
  warning → soft warning (shown to user, does not block)
  info    → informational alert (data-source notes, edit flags)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

import logging
logger = logging.getLogger(__name__)


# ===========================================================================
# Config & Enums
# ===========================================================================

class ValidationLevel(str, Enum):
    STRICT = "strict"
    NORMAL = "normal"
    LENIENT = "lenient"


@dataclass
class ValidationConfig:
    level: ValidationLevel = ValidationLevel.NORMAL
    itc_tolerance: float = 1.0           # ±₹1 tolerance for ITC comparison
    tax_rate_tolerance: float = 0.01     # ±0.01% tolerance
    variance_threshold: float = 20.0     # 20% swing vs previous period triggers warning
    enable_rcm_check: bool = True
    enable_3b_vs_gstr1_check: bool = True
    enable_2b_vs_itc_check: bool = True
    enable_variance_check: bool = True


# ===========================================================================
# Validation Issue & Result
# ===========================================================================

@dataclass
class ValidationIssue:
    code: str
    message: str
    severity: str     # "error" | "warning" | "info"
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
            "value": self.value,
            "expected": self.expected,
        }


@dataclass
class ValidationResult:
    is_valid: bool = True
    can_proceed: bool = True    # can advance to next step
    can_file: bool = True       # can file with GSTN

    errors: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)
    info: List[ValidationIssue] = field(default_factory=list)

    def add_issue(self, issue: ValidationIssue) -> None:
        if issue.severity == "error":
            self.is_valid = False
            self.can_proceed = False
            self.can_file = False
            self.errors.append(issue)
        elif issue.severity == "warning":
            self.warnings.append(issue)
            # Specific warnings that block filing (not just proceed)
            if issue.code in (
                "NIL_RETURN_NON_ZERO",
                "ITC_UTILIZED_EXCEEDS_AVAILABLE",
                "NEGATIVE_FINAL_TAX_PAYABLE",
            ):
                self.can_file = False
        else:
            self.info.append(issue)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "can_proceed": self.can_proceed,
            "can_file": self.can_file,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "info_count": len(self.info),
            "errors": [i.to_dict() for i in self.errors],
            "warnings": [i.to_dict() for i in self.warnings],
            "info": [i.to_dict() for i in self.info],
        }


# ===========================================================================
# Helpers
# ===========================================================================

def _d(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _abs_diff(a: Any, b: Any) -> Decimal:
    return abs(_d(a) - _d(b))


# ===========================================================================
# Section 3.1 – Outward Supplies
# ===========================================================================

class _Section31Validator:
    """Validates Table 3.1 outward supplies."""

    VALID_HEADS = ("igst", "cgst", "sgst", "cess", "taxable_value")

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        section_31 = data.get("3_1", {})

        self._validate_subsection(section_31.get("a_outward_taxable", section_31.get("3_1_a", {})), "3_1_a", result)
        self._validate_subsection(section_31.get("b_zero_rated",     section_31.get("3_1_b", {})), "3_1_b", result)
        self._validate_subsection(section_31.get("d_rcm_outward",    section_31.get("3_1_d", {})), "3_1_d", result)

    def _validate_subsection(
        self, comp: Dict[str, Any], section: str, result: ValidationResult
    ) -> None:
        taxable = _d(comp.get("taxable_value", 0))
        igst = _d(comp.get("igst", 0))
        cgst = _d(comp.get("cgst", 0))
        sgst = _d(comp.get("sgst", 0))
        cess = _d(comp.get("cess", 0))

        # Negative taxable value — allowed but triggers warning (Section 4.4)
        if taxable < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_TAXABLE_VALUE",
                message=f"Negative taxable value in {section} — possibly due to credit notes or adjustments.",
                severity="warning",
                section=section,
                field="taxable_value",
                value=float(taxable),
            ))

        # Negative tax amounts — hard error
        for head, val in (("igst", igst), ("cgst", cgst), ("sgst", sgst), ("cess", cess)):
            if val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_TAX_AMOUNT",
                    message=f"Negative {head.upper()} in {section}. Tax amounts must be ≥ 0.",
                    severity="error",
                    section=section,
                    field=head,
                    value=float(val),
                ))

        # Tax with zero taxable value
        if taxable == 0 and (igst + cgst + sgst + cess) > 0:
            result.add_issue(ValidationIssue(
                code="ZERO_TAXABLE_WITH_TAX",
                message=f"Tax amount present but taxable value is zero in {section}.",
                severity="warning",
                section=section,
            ))


# ===========================================================================
# Section 3.2 – Inter-State Supplies
# ===========================================================================

class _Section32Validator:
    """Table 3.2 sum ≤ interstate portion of Table 3.1."""

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        section_31 = data.get("3_1", {})
        section_32 = data.get("3_2", {})

        # Total 3.2 taxable
        total_32 = _d(section_32.get("total_taxable_value", 0))
        total_32_igst = _d(section_32.get("total_igst", 0))

        # Total 3.1 outward taxable value (includes zero-rated)
        a_val = _d(section_31.get("a_outward_taxable", {}).get("taxable_value",
                    data.get("3_1_a", {}).get("taxable_value", 0)))
        b_val = _d(section_31.get("b_zero_rated", {}).get("taxable_value",
                    data.get("3_1_b", {}).get("taxable_value", 0)))
        total_31 = a_val + b_val

        if total_31 > 0 and total_32 > total_31:
            result.add_issue(ValidationIssue(
                code="TABLE_32_EXCEEDS_31",
                message=(
                    f"Table 3.2 inter-state taxable value ₹{float(total_32):,.2f} "
                    f"exceeds Table 3.1 total ₹{float(total_31):,.2f}."
                ),
                severity="warning",
                section="3_2",
                value=float(total_32),
                expected=f"≤ {float(total_31):,.2f}",
            ))

        # Must not have 3.2 without 3.1
        if total_32 > 0 and total_31 == 0:
            result.add_issue(ValidationIssue(
                code="TABLE_32_WITHOUT_OUTWARD",
                message="Table 3.2 has values but Table 3.1 shows no outward supplies.",
                severity="warning",
                section="3_2",
            ))


# ===========================================================================
# Section 4 – ITC
# ===========================================================================

class _Section4Validator:
    """Validates all subsections of Table 4 ITC."""

    def validate(
        self,
        data: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        section_4 = data.get("4", {})
        itc_4a = section_4.get("4a", data.get("eligibleItc", {}).get("itcAvailable", {}))
        itc_4b = section_4.get("4b", data.get("eligibleItc", {}).get("itcReversed", {}))
        itc_4c = section_4.get("4c", data.get("eligibleItc", {}).get("netItc", {}))
        itc_4d = section_4.get("4d", data.get("eligibleItc", {}).get("ineligibleItc", {}))

        self._validate_4a(itc_4a, result)
        self._validate_4b(itc_4b, result)
        self._validate_4c(itc_4a, itc_4b, itc_4c, result, config)
        self._validate_4d(itc_4d, result)
        self._validate_rcm_match(data, result, config)

    def _validate_4a(self, itc_4a: Dict[str, Any], result: ValidationResult) -> None:
        for head in ("igst", "cgst", "sgst", "cess"):
            val = _d(itc_4a.get(head, 0))
            if val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_ITC_AVAILABLE",
                    message=f"4(A) ITC Available {head.upper()} must be ≥ 0.",
                    severity="error",
                    section="4a",
                    field=head,
                    value=float(val),
                ))

    def _validate_4b(self, itc_4b: Dict[str, Any], result: ValidationResult) -> None:
        for head in ("igst", "cgst", "sgst", "cess"):
            val = _d(itc_4b.get(head, 0))
            if val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_ITC_REVERSAL",
                    message=f"4(B) ITC Reversal {head.upper()} must be ≥ 0.",
                    severity="error",
                    section="4b",
                    field=head,
                    value=float(val),
                ))

    def _validate_4c(
        self,
        itc_4a: Dict[str, Any],
        itc_4b: Dict[str, Any],
        itc_4c: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        """4(C) must equal 4(A) − 4(B) per tax head, within tolerance."""
        tolerance = Decimal(str(config.itc_tolerance))

        for head in ("igst", "cgst", "sgst", "cess"):
            expected = _d(itc_4a.get(head, 0)) - _d(itc_4b.get(head, 0))
            actual = _d(itc_4c.get(head, 0))

            if _abs_diff(expected, actual) > tolerance:
                result.add_issue(ValidationIssue(
                    code="NET_ITC_MISMATCH",
                    message=(
                        f"4(C) Net ITC {head.upper()}: expected ₹{float(expected):,.2f} "
                        f"(4A − 4B) but got ₹{float(actual):,.2f}."
                    ),
                    severity="error",
                    section="4c",
                    field=head,
                    value=float(actual),
                    expected=float(expected),
                ))
            
            if actual < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_NET_ITC",
                    message=f"4(C) Net ITC {head.upper()} is negative. This will be automatically added to Tax Payable.",
                    severity="info",
                    section="4c",
                    field=head,
                    value=float(actual),
                ))

    def _validate_4d(self, itc_4d: Dict[str, Any], result: ValidationResult) -> None:
        # 4D is reporting only, can take positive or negative values
        # No calculation impact, so no strict validation rule applied here
        pass

    def _validate_rcm_match(
        self,
        data: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        """Soft warning: 3.1(d) RCM liability should match 4A(3) RCM ITC."""
        if not config.enable_rcm_check:
            return

        section_31 = data.get("3_1", {})
        rcm_31d = section_31.get("d_rcm_outward", data.get("3_1_d", {}))
        rcm_31d_tax = sum(
            _d(rcm_31d.get(h, 0)) for h in ("igst", "cgst", "sgst")
        )

        section_4 = data.get("4", {})
        itc_4a = section_4.get("4a", {})
        rcm_itc = itc_4a.get("4a3_inward_rcm", {})
        rcm_itc_tax = sum(_d(rcm_itc.get(h, 0)) for h in ("igst", "cgst", "sgst"))

        tolerance = Decimal(str(config.itc_tolerance))
        if rcm_31d_tax > 0 and _abs_diff(rcm_31d_tax, rcm_itc_tax) > tolerance:
            result.add_issue(ValidationIssue(
                code="RCM_MISMATCH",
                message=(
                    f"Table 3.1(d) RCM liability ₹{float(rcm_31d_tax):,.2f} "
                    f"does not match Table 4A(3) RCM ITC claim ₹{float(rcm_itc_tax):,.2f}."
                ),
                severity="warning",
                section="4a3",
                value=float(rcm_itc_tax),
                expected=float(rcm_31d_tax),
            ))


# ===========================================================================
# Section 5 – Exempt / Nil / Non-GST Inward
# ===========================================================================

class _Section5Validator:
    """Table 5 - Exempt / Nil / Non-GST Inward."""

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        section_5 = data.get("5", data.get("exempt_nil_inward", {}))
        if not section_5:
            return

        # Must be split into Inter-state and Intra-state
        for supply_type in ("inter_state", "intra_state"):
            supplies = section_5.get(supply_type, {})
            # Only non-taxable supplies allowed: composition, exempt, nil, non_gst
            for category in ("composition", "exempt", "nil", "non_gst"):
                val = _d(supplies.get(category, 0))
                if val < 0:
                    result.add_issue(ValidationIssue(
                        code="NEGATIVE_EXEMPT_INWARD",
                        message=f"Table 5 inward supply value for {supply_type} {category} must be ≥ 0.",
                        severity="error",
                        section="5",
                        field=f"{supply_type}_{category}",
                        value=float(val),
                    ))


# ===========================================================================
# Section 5.1 / 9 – Interest & Late Fee
# ===========================================================================

class _InterestLateFeeValidator:
    """Table 5.1 / 9 - Interest & Late Fee."""

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        interest = data.get("interest", data.get("5_1", {}).get("interest", {}))
        late_fee = data.get("late_fee", data.get("5_1", {}).get("late_fee", {}))

        for head in ("igst", "cgst", "sgst", "cess"):
            int_val = _d(interest.get(head, 0))
            if int_val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_INTEREST",
                    message=f"Interest for {head.upper()} must be ≥ 0.",
                    severity="error",
                    section="interest",
                    field=head,
                    value=float(int_val),
                ))

            lf_val = _d(late_fee.get(head, 0))
            if lf_val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_LATE_FEE",
                    message=f"Late fee for {head.upper()} must be ≥ 0.",
                    severity="error",
                    section="late_fee",
                    field=head,
                    value=float(lf_val),
                ))


# ===========================================================================
# Tax Liability & ITC Utilization Validator
# ===========================================================================

class _TaxLiabilityValidator:
    """Validates Table 6 tax payable and ITC utilization rules."""

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        total_liability = data.get("total_liability", {})
        total_itc = data.get("total_itc", data.get("eligibleItc", {}).get("netItc", {}))
        cash_liability = data.get("cash_liability", {})

        # 1. Total liability components must sum correctly
        igst = _d(total_liability.get("igst", 0))
        cgst = _d(total_liability.get("cgst", 0))
        sgst = _d(total_liability.get("sgst", 0))
        cess = _d(total_liability.get("cess", 0))
        total = _d(total_liability.get("total", 0))

        if total < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_OUTPUT_TAX",
                message="Output Tax (Total Liability) is negative. Final Payable will be 0.",
                severity="warning",
                section="total_liability",
                value=float(total),
            ))

        computed_total = igst + cgst + sgst + cess
        if abs(computed_total - total) > Decimal("0.02"):
            result.add_issue(ValidationIssue(
                code="LIABILITY_SUM_MISMATCH",
                message=(
                    f"Total liability ₹{float(total):,.2f} does not match sum of components "
                    f"IGST+CGST+SGST+Cess = ₹{float(computed_total):,.2f}."
                ),
                severity="error",
                section="total_liability",
                value=float(total),
                expected=float(computed_total),
            ))

        # 2. ITC utilized must not exceed ITC available — per tax type
        itc_utilized = data.get("itc_utilized", {})
        for head in ("igst", "cgst", "sgst", "cess"):
            avl = _d(total_itc.get(head, 0))
            used = _d(itc_utilized.get(head, 0))
            if used > avl + Decimal("0.02"):
                result.add_issue(ValidationIssue(
                    code="ITC_UTILIZED_EXCEEDS_AVAILABLE",
                    message=(
                        f"{head.upper()} ITC utilized ₹{float(used):,.2f} > "
                        f"available ₹{float(avl):,.2f}."
                    ),
                    severity="error",
                    section="itc_utilization",
                    field=head,
                    value=float(used),
                    expected=f"≤ {float(avl):,.2f}",
                ))

        # 3. Cash liability must not be negative
        for head in ("igst", "cgst", "sgst", "cess"):
            val = _d(cash_liability.get(head, 0))
            if val < 0:
                result.add_issue(ValidationIssue(
                    code="NEGATIVE_CASH_LIABILITY",
                    message=f"Cash liability for {head.upper()} is negative (₹{float(val):,.2f}). Must be ≥ 0.",
                    severity="error",
                    section="cash_liability",
                    field=head,
                    value=float(val),
                ))

        # 4. Final tax payable must be ≥ 0 (hard error)
        total_payable = _d(data.get("total_payable", 0))
        if total_payable < 0:
            result.add_issue(ValidationIssue(
                code="NEGATIVE_FINAL_TAX_PAYABLE",
                message=(
                    f"Final tax payable ₹{float(total_payable):,.2f} is negative. "
                    "This blocks filing. Check ITC utilization."
                ),
                severity="error",
                section="total_payable",
                value=float(total_payable),
            ))

        # 5. CGST → SGST cross-utilization is forbidden
        util_details = data.get("utilization_details", {})
        cross_util = util_details.get("cross_utilization", [])
        for item in cross_util:
            if item.get("from") == "CGST" and item.get("to") == "SGST":
                result.add_issue(ValidationIssue(
                    code="INVALID_CROSS_UTILIZATION",
                    message="CGST ITC cannot be used to offset SGST liability.",
                    severity="error",
                    section="itc_utilization",
                ))
            if item.get("from") == "SGST" and item.get("to") == "CGST":
                result.add_issue(ValidationIssue(
                    code="INVALID_CROSS_UTILIZATION",
                    message="SGST ITC cannot be used to offset CGST liability.",
                    severity="error",
                    section="itc_utilization",
                ))


# ===========================================================================
# Nil Return Validator
# ===========================================================================

class _NilReturnValidator:
    """If nil return is flagged, ALL table values must be zero."""

    CHECKED_SECTIONS = [
        ("3_1_a", ("taxable_value", "igst", "cgst", "sgst", "cess")),
        ("3_1_b", ("taxable_value", "igst")),
        ("3_1_c", ("taxable_value",)),
        ("3_1_d", ("taxable_value", "igst", "cgst", "sgst")),
        ("4a",    ("igst", "cgst", "sgst", "cess")),
        ("4b",    ("igst", "cgst", "sgst", "cess")),
    ]

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        if not data.get("nil_return", False):
            return

        for section_key, fields in self.CHECKED_SECTIONS:
            section_data = data.get(section_key, data.get("3_1", {}).get(section_key, {}))
            for fld in fields:
                val = _d(section_data.get(fld, 0))
                if val != 0:
                    result.add_issue(ValidationIssue(
                        code="NIL_RETURN_NON_ZERO",
                        message=(
                            f"This is marked as a NIL return but {section_key}.{fld} = "
                            f"₹{float(val):,.2f} (must be 0)."
                        ),
                        severity="error",
                        section=section_key,
                        field=fld,
                        value=float(val),
                        expected=0.0,
                    ))

        # Check Table 5
        section_5 = data.get("5", data.get("exempt_nil_inward", {}))
        for supply_type in ("inter_state", "intra_state"):
            supplies = section_5.get(supply_type, {})
            for category in ("composition", "exempt", "nil", "non_gst"):
                val = _d(supplies.get(category, 0))
                if val != 0:
                    result.add_issue(ValidationIssue(
                        code="NIL_RETURN_NON_ZERO",
                        message=f"This is marked as a NIL return but Table 5 {supply_type} {category} = ₹{float(val):,.2f} (must be 0).",
                        severity="error",
                        section="5",
                        field=f"{supply_type}_{category}",
                        value=float(val),
                        expected=0.0,
                    ))

        # Check Interest & Late Fee
        interest = data.get("interest", data.get("5_1", {}).get("interest", {}))
        late_fee = data.get("late_fee", data.get("5_1", {}).get("late_fee", {}))
        for head in ("igst", "cgst", "sgst", "cess"):
            int_val = _d(interest.get(head, 0))
            if int_val != 0:
                result.add_issue(ValidationIssue(
                    code="NIL_RETURN_NON_ZERO",
                    message=f"This is marked as a NIL return but Interest for {head.upper()} = ₹{float(int_val):,.2f} (must be 0).",
                    severity="error",
                    section="interest",
                    field=head,
                    value=float(int_val),
                    expected=0.0,
                ))
            lf_val = _d(late_fee.get(head, 0))
            if lf_val != 0:
                result.add_issue(ValidationIssue(
                    code="NIL_RETURN_NON_ZERO",
                    message=f"This is marked as a NIL return but Late Fee for {head.upper()} = ₹{float(lf_val):,.2f} (must be 0).",
                    severity="error",
                    section="late_fee",
                    field=head,
                    value=float(lf_val),
                    expected=0.0,
                ))


# ===========================================================================
# GSTR-1 vs 3B Mismatch Validator
# ===========================================================================

class _Gstr1Vs3bValidator:
    """Soft warning when 3B figures differ from GSTR-1 auto-populated values."""

    def validate(
        self,
        data: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        if not config.enable_3b_vs_gstr1_check:
            return

        gstr1_ref = data.get("gstr1_reference", {})
        if not gstr1_ref:
            return

        section_31a_3b = data.get("3_1_a", data.get("3_1", {}).get("a_outward_taxable", {}))
        section_31a_g1 = gstr1_ref.get("3_1_a", {})

        for head in ("taxable_value", "igst", "cgst", "sgst"):
            val_3b = _d(section_31a_3b.get(head, 0))
            val_g1 = _d(section_31a_g1.get(head, 0))
            if val_g1 > 0 and _abs_diff(val_3b, val_g1) > Decimal("1"):
                result.add_issue(ValidationIssue(
                    code="GSTR1_3B_MISMATCH",
                    message=(
                        f"Table 3.1(a) {head}: GSTR-3B value ₹{float(val_3b):,.2f} "
                        f"differs from GSTR-1 ₹{float(val_g1):,.2f}."
                    ),
                    severity="warning",
                    section="3_1_a",
                    field=head,
                    value=float(val_3b),
                    expected=float(val_g1),
                ))


# ===========================================================================
# 2B vs ITC Mismatch Validator
# ===========================================================================

class _Gstr2bVsItcValidator:
    """Soft warning when ITC claimed differs from GSTR-2B data."""

    def validate(
        self,
        data: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        if not config.enable_2b_vs_itc_check:
            return

        gstr2b_ref = data.get("gstr2b_reference", {})
        if not gstr2b_ref:
            return

        section_4a = data.get("4", {}).get("4a", data.get("eligibleItc", {}).get("itcAvailable", {}))

        tolerance = Decimal(str(config.itc_tolerance))
        for head in ("igst", "cgst", "sgst", "cess"):
            val_claimed = _d(section_4a.get(head, 0))
            val_2b = _d(gstr2b_ref.get(head, 0))
            if val_2b > 0 and _abs_diff(val_claimed, val_2b) > tolerance:
                result.add_issue(ValidationIssue(
                    code="ITC_2B_MISMATCH",
                    message=(
                        f"ITC claimed {head.upper()} ₹{float(val_claimed):,.2f} "
                        f"differs from GSTR-2B ₹{float(val_2b):,.2f}."
                    ),
                    severity="warning",
                    section="4a",
                    field=head,
                    value=float(val_claimed),
                    expected=float(val_2b),
                ))


# ===========================================================================
# Period Variance Validator
# ===========================================================================

class _VarianceValidator:
    """Warn on >20% swing in liability vs previous period."""

    def validate(
        self,
        data: Dict[str, Any],
        result: ValidationResult,
        config: ValidationConfig,
    ) -> None:
        if not config.enable_variance_check:
            return

        prev = data.get("previous_period_liability", {})
        if not prev:
            return

        current_total = _d(data.get("total_liability", {}).get("total", 0))
        prev_total = _d(prev.get("total", 0))

        if prev_total > 0 and current_total > 0:
            variance_pct = abs(current_total - prev_total) / prev_total * 100
            if variance_pct > Decimal(str(config.variance_threshold)):
                result.add_issue(ValidationIssue(
                    code="HIGH_VARIANCE_VS_PREVIOUS",
                    message=(
                        f"Tax liability has changed by {float(variance_pct):.1f}% "
                        f"vs previous period (threshold: {config.variance_threshold}%). "
                        "Please review before filing."
                    ),
                    severity="warning",
                    section="total_liability",
                    value=float(current_total),
                    expected=f"≈ {float(prev_total):,.2f} (prev period)",
                ))


# ===========================================================================
# Auto-Edit Tracker
# ===========================================================================

class _EditFlagValidator:
    """Informational: flag fields that were auto-populated but later manually edited."""

    def validate(self, data: Dict[str, Any], result: ValidationResult) -> None:
        overrides = data.get("override_flags", {})
        if not overrides:
            return

        for section, fields in overrides.items():
            for fld, was_overridden in fields.items():
                if was_overridden:
                    result.add_issue(ValidationIssue(
                        code="MANUAL_OVERRIDE",
                        message=(
                            f"{section}.{fld} was auto-populated but has been manually edited. "
                            "Verify the value matches your books."
                        ),
                        severity="info",
                        section=section,
                        field=fld,
                    ))


# ===========================================================================
# Section Enable/Disable State Deriver
# ===========================================================================

def derive_section_state(data: Dict[str, Any]) -> Dict[str, bool]:
    """
    Determine which GSTR-3B sections should be enabled based on data.

    Rules (Section 3.3 of the document):
      - No outward supply → Table 3 disabled
      - No ITC            → Table 4 disabled
      - Nil return        → All tables disabled
    """
    nil_return = data.get("nil_return", False)

    if nil_return:
        return {
            "table_3_enabled": False,
            "table_4_enabled": False,
            "table_5_enabled": False,
            "table_6_enabled": False,
            "nil_return": True,
        }

    # Check for any outward supply
    outward_sections = ["3_1_a", "3_1_b", "3_1_c", "3_1_d", "3_1_e"]
    has_outward = any(
        any(
            _d(data.get(s, {}).get(fld, 0)) != 0
            for fld in ("taxable_value", "igst", "cgst", "sgst")
        )
        for s in outward_sections
    )

    # Check for any ITC
    itc_sections = ["4a", "4b"]
    has_itc = any(
        any(
            _d(data.get("4", {}).get(s, {}).get(fld, 0)) != 0
            for fld in ("igst", "cgst", "sgst", "cess")
        )
        for s in itc_sections
    )

    return {
        "table_3_enabled": has_outward,
        "table_4_enabled": has_itc,
        "table_5_enabled": True,   # Always available for exempt/nil inward
        "table_6_enabled": True,   # Payment table always enabled
        "nil_return": False,
    }


# ===========================================================================
# Filing Eligibility Gate
# ===========================================================================

def validate_filing_eligibility(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Gate the "File 3B" button.

    Hard errors that block filing (Section 11.1):
      1. Negative final tax payable
      2. ITC utilized > ITC available
      3. Nil return with non-zero values

    Returns:
        {can_file: bool, blocking_reasons: [str]}
    """
    result = validate_gstr3b(data)
    blocking = [
        f"{e.code}: {e.message}"
        for e in result.errors
        if e.code in (
            "NEGATIVE_FINAL_TAX_PAYABLE",
            "ITC_UTILIZED_EXCEEDS_AVAILABLE",
            "NIL_RETURN_NON_ZERO",
            "NEGATIVE_CASH_LIABILITY",
            "INVALID_CROSS_UTILIZATION",
        )
    ]

    # Also block on warnings that are legally significant
    blocking += [
        f"{w.code}: {w.message}"
        for w in result.warnings
        if w.code == "NIL_RETURN_NON_ZERO"
    ]

    return {
        "can_file": len(blocking) == 0 and result.can_file,
        "blocking_reasons": blocking,
        "validation_summary": result.to_dict(),
    }


# ===========================================================================
# Main GSTR-3B Validator
# ===========================================================================

class GSTR3BValidator:
    """
    Full 3-layer GSTR-3B validator.

    Usage:
        validator = GSTR3BValidator()
        result = validator.validate(gstr3b_data)
    """

    def __init__(self, config: Optional[ValidationConfig] = None):
        self.config = config or ValidationConfig()

        # Sub-validators
        self._nil = _NilReturnValidator()
        self._s31 = _Section31Validator()
        self._s32 = _Section32Validator()
        self._s4 = _Section4Validator()
        self._s5 = _Section5Validator()
        self._interest_late_fee = _InterestLateFeeValidator()
        self._liability = _TaxLiabilityValidator()
        self._g1_vs_3b = _Gstr1Vs3bValidator()
        self._2b_vs_itc = _Gstr2bVsItcValidator()
        self._variance = _VarianceValidator()
        self._edits = _EditFlagValidator()

    def validate(self, gstr3b_data: Dict[str, Any]) -> ValidationResult:
        result = ValidationResult()

        # Layer 1: Mandatory fields
        self._validate_mandatory(gstr3b_data, result)

        # Nil return gate — if nil return has errors, remaining checks on values
        # are less meaningful but we still run them for completeness
        self._nil.validate(gstr3b_data, result)

        # Layer 2: Per-section business logic
        self._s31.validate(gstr3b_data, result)
        self._s32.validate(gstr3b_data, result)
        self._s4.validate(gstr3b_data, result, self.config)
        self._s5.validate(gstr3b_data, result)
        self._interest_late_fee.validate(gstr3b_data, result)

        # Layer 3: Tax liability & ITC utilization rules
        self._liability.validate(gstr3b_data, result)

        # Soft warnings: reconciliation mismatches & variance
        self._g1_vs_3b.validate(gstr3b_data, result, self.config)
        self._2b_vs_itc.validate(gstr3b_data, result, self.config)
        self._variance.validate(gstr3b_data, result, self.config)

        # Info: edit/override flags
        self._edits.validate(gstr3b_data, result)

        logger.info(
            "GSTR-3B validation complete: "
            f"errors={len(result.errors)}, warnings={len(result.warnings)}, "
            f"info={len(result.info)}, can_file={result.can_file}"
        )
        return result

    def _validate_mandatory(self, data: Dict[str, Any], result: ValidationResult) -> None:
        """Layer 1: Mandatory input validation (Section 3.1 of document)."""
        if not data.get("gstin", "").strip():
            result.add_issue(ValidationIssue(
                code="MANDATORY_GSTIN",
                message="GSTIN is required.",
                severity="error",
                section="header",
                field="gstin",
            ))

        if not data.get("ret_period", data.get("return_period", "")).strip():
            result.add_issue(ValidationIssue(
                code="MANDATORY_RETURN_PERIOD",
                message="Return period is required (format: MMYYYY).",
                severity="error",
                section="header",
                field="ret_period",
            ))


# ===========================================================================
# Convenience Functions
# ===========================================================================

def validate_gstr3b(
    gstr3b_data: Dict[str, Any],
    config: Optional[ValidationConfig] = None,
) -> ValidationResult:
    """Validate GSTR-3B data and return a ValidationResult."""
    return GSTR3BValidator(config).validate(gstr3b_data)


def validate_with_tolerance(
    gstr3b_data: Dict[str, Any],
    tolerance: float = 1.0,
) -> ValidationResult:
    """Validate with custom ITC tolerance."""
    return GSTR3BValidator(ValidationConfig(itc_tolerance=tolerance)).validate(gstr3b_data)
