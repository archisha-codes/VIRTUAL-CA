"""
Tax Rate Calculation Validator Module

Validates tax breakups based on tax rates:
- For IGST (inter-state): IGST should equal rate% of taxable value
- For CGST+SGST (intra-state): CGST = SGST = rate/2 % of taxable value
- Enforces rounding to 2 decimal places
- Flags and logs inconsistencies
"""

from typing import Tuple, Dict, Any, List
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

# Tolerance for floating point comparison (in rupees)
TAX_TOLERANCE = 0.05


def round2(value: float) -> float:
    """Round to 2 decimal places using banker's rounding."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_expected_tax(taxable_value: float, rate: float) -> float:
    """Calculate expected tax amount from taxable value and rate."""
    return round2(taxable_value * rate / 100)


def validate_tax_breakup_enhanced(
    taxable_value: float,
    rate: float,
    igst: float = 0,
    cgst: float = 0,
    sgst: float = 0,
    pos: str = "",
    is_inter_state: bool = None,
) -> Tuple[bool, str, Dict[str, float]]:
    """
    Validate tax breakup based on rate and inter/intra-state classification.
    
    For 18% rate:
    - Inter-state (IGST): IGST should be 18% of taxable, CGST+SGST = 0
    - Intra-state: CGST = 9%, SGST = 9% (total = 18%)
    
    Args:
        taxable_value: Taxable amount
        rate: Tax rate percentage (e.g., 18 for 18%)
        igst: IGST amount
        cgst: CGST amount
        sgst: SGST amount
        pos: Place of Supply (used to determine inter/intra state)
        is_inter_state: Override for inter-state classification
        
    Returns:
        Tuple of (is_valid, error_message, corrected_values)
        corrected_values contains rounded and corrected tax amounts
    """
    if taxable_value is None or rate is None:
        return (True, "", {"igst": 0, "cgst": 0, "sgst": 0})
    
    # Round inputs
    taxable_value = round2(taxable_value)
    rate = round2(rate)
    igst = round2(igst) if igst else 0
    cgst = round2(cgst) if cgst else 0
    sgst = round2(sgst) if sgst else 0
    
    # Calculate expected taxes
    expected_total = calculate_expected_tax(taxable_value, rate)
    expected_half = calculate_expected_tax(taxable_value, rate / 2)
    
    # Determine if inter-state
    if is_inter_state is None:
        if pos:
            # Extract state code from POS
            pos_code = str(pos)[:2] if len(str(pos)) >= 2 else ""
            # For exports (96) or if IGST is provided, treat as inter-state
            is_inter_state = igst > 0 or pos_code in ["96", "97"]
        else:
            # Default to inter-state if IGST is provided
            is_inter_state = igst > 0
    
    errors = []
    corrections = {}
    
    if is_inter_state:
        # Inter-state: Should have IGST, CGST+SGST should be 0
        if cgst > 0 or sgst > 0:
            if igst > 0:
                errors.append(
                    f"For inter-state: CGST ({cgst:.2f}) and SGST ({sgst:.2f}) should be 0 when IGST is applicable"
                )
            # Auto-correct: zero out CGST/SGST if IGST is present
            corrections["cgst"] = 0
            corrections["sgst"] = 0
            cgst = 0
            sgst = 0
        
        # Validate IGST
        if igst > 0:
            diff = abs(igst - expected_total)
            if diff > TAX_TOLERANCE:
                errors.append(
                    f"IGST mismatch: Expected {expected_total:.2f}, Got {igst:.2f} (diff: {diff:.2f})"
                )
                # Auto-correct IGST
                corrections["igst"] = expected_total
                igst = expected_total
    else:
        # Intra-state: Should have CGST + SGST = expected_total, IGST should be 0
        if igst > 0:
            errors.append(
                f"For intra-state: IGST ({igst:.2f}) should be 0 (use CGST+SGST)"
            )
            corrections["igst"] = 0
            igst = 0
        
        # Validate CGST
        cgst_diff = abs(cgst - expected_half)
        if cgst > 0 and cgst_diff > TAX_TOLERANCE:
            errors.append(
                f"CGST mismatch: Expected {expected_half:.2f}, Got {cgst:.2f}"
            )
            corrections["cgst"] = expected_half
            cgst = expected_half
        
        # Validate SGST
        sgst_diff = abs(sgst - expected_half)
        if sgst > 0 and sgst_diff > TAX_TOLERANCE:
            errors.append(
                f"SGST mismatch: Expected {expected_half:.2f}, Got {sgst:.2f}"
            )
            corrections["sgst"] = expected_half
            sgst = expected_half
        
        # Validate total CGST+SGST
        actual_total = cgst + sgst
        total_diff = abs(actual_total - expected_total)
        if actual_total > 0 and total_diff > TAX_TOLERANCE:
            errors.append(
                f"CGST+SGST mismatch: Expected {expected_total:.2f}, Got {actual_total:.2f} "
                f"(CGST: {cgst:.2f}, SGST: {sgst:.2f})"
            )
    
    # Build result
    is_valid = len(errors) == 0
    error_msg = "; ".join(errors) if errors else ""
    
    result = {
        "igst": round2(igst),
        "cgst": round2(cgst),
        "sgst": round2(sgst),
        "expected_total": expected_total,
        "expected_half": expected_half,
    }
    result.update(corrections)
    
    return (is_valid, error_msg, result)


def validate_row_tax_breakup(row: Dict[str, Any], row_number: int = 0) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validate tax breakup for a single row.
    
    Args:
        row: Row data dictionary
        row_number: Row number for error reporting
        
    Returns:
        Tuple of (is_valid, warnings, corrected_row)
    """
    warnings = []
    corrected_row = row.copy()
    
    # Extract values
    taxable_value = row.get("taxable_value")
    rate = row.get("rate")
    igst = row.get("igst", 0)
    cgst = row.get("cgst", 0)
    sgst = row.get("sgst", 0)
    pos = row.get("place_of_supply", "")
    
    # Skip if essential values missing
    if taxable_value is None or rate is None:
        return (True, warnings, corrected_row)
    
    # Determine inter-state from POS
    pos_code = str(pos)[:2] if pos else ""
    is_inter_state = pos_code in ["96", "97"] or pos_code not in [
        "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
        "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
        "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
        "31", "32", "33", "34", "35", "36", "37", "38", "97"
    ]
    
    # Validate
    is_valid, error_msg, result = validate_tax_breakup_enhanced(
        taxable_value=taxable_value,
        rate=rate,
        igst=igst,
        cgst=cgst,
        sgst=sgst,
        pos=pos,
        is_inter_state=is_inter_state,
    )
    
    if error_msg:
        warnings.append(f"Tax breakup: {error_msg}")
        if row_number > 0:
            logger.warning(f"Row {row_number}: {error_msg}")
    
    # Apply corrections
    if "igst" in result:
        corrected_row["igst"] = result["igst"]
    if "cgst" in result:
        corrected_row["cgst"] = result["cgst"]
    if "sgst" in result:
        corrected_row["sgst"] = result["sgst"]
    
    return (is_valid, warnings, corrected_row)


def validate_tax_breakup_sums(clean_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate tax breakup sums across all rows and generate a summary report.
    
    Args:
        clean_data: List of validated row data
        
    Returns:
        Summary report with validation results
    """
    total_taxable = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    total_cess = 0
    validated_rows = []
    warnings = []
    
    for idx, row in enumerate(clean_data, 1):
        taxable = float(row.get("taxable_value", 0) or 0)
        rate = float(row.get("rate", 0) or 0)
        igst = float(row.get("igst", 0) or 0)
        cgst = float(row.get("cgst", 0) or 0)
        sgst = float(row.get("sgst", 0) or 0)
        cess = float(row.get("cess", 0) or 0)
        pos = row.get("place_of_supply", "")
        
        total_taxable += taxable
        total_igst += igst
        total_cgst += cgst
        total_sgst += sgst
        total_cess += cess
        
        # Validate individual row
        is_valid, row_warnings, corrected_row = validate_row_tax_breakup(row, idx)
        validated_rows.append(corrected_row)
        
        if row_warnings:
            warnings.extend([f"Row {idx}: {w}" for w in row_warnings])
    
    # Calculate expected totals based on rates
    expected_igst = sum(
        round2(row.get("taxable_value", 0) * row.get("rate", 0) / 100)
        for row in clean_data
        if row.get("igst", 0) > 0
    )
    
    expected_cgst_sgst = sum(
        round2(row.get("taxable_value", 0) * row.get("rate", 0) / 200)
        for row in clean_data
        if row.get("cgst", 0) > 0 or row.get("sgst", 0) > 0
    )
    
    # Check for discrepancies
    igst_diff = abs(total_igst - expected_igst)
    cgst_sgst_diff = abs(total_cgst + total_sgst - expected_cgst_sgst * 2)
    
    summary = {
        "total_rows": len(clean_data),
        "totals": {
            "taxable_value": round2(total_taxable),
            "igst": round2(total_igst),
            "cgst": round2(total_cgst),
            "sgst": round2(total_sgst),
            "cess": round2(total_cess),
        },
        "expected_totals": {
            "igst": round2(expected_igst),
            "cgst_sgst": round2(expected_cgst_sgst * 2),
        },
        "discrepancies": {
            "igst_diff": round2(igst_diff),
            "cgst_sgst_diff": round2(cgst_sgst_diff),
        },
        "is_balanced": igst_diff <= TAX_TOLERANCE and cgst_sgst_diff <= TAX_TOLERANCE,
        "warnings": warnings[:10],  # Limit to first 10
        "validated_rows": validated_rows,
    }
    
    if warnings:
        logger.warning(f"Tax validation: {len(warnings)} warnings found")
        for w in warnings[:5]:
            logger.warning(f"  {w}")
    
    return summary


# Test function
def test_tax_breakup_validation():
    """Test tax breakup validation with sample data."""
    import unittest
    
    class TestTaxBreakup(unittest.TestCase):
        
        def test_inter_state_18_percent(self):
            """Test inter-state transaction with 18% rate."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=18,
                igst=1800,
                cgst=0,
                sgst=0,
                is_inter_state=True,
            )
            self.assertTrue(is_valid)
            self.assertEqual(result["igst"], 1800)
            self.assertEqual(result["cgst"], 0)
            self.assertEqual(result["sgst"], 0)
        
        def test_inter_state_wrong_igst(self):
            """Test inter-state with incorrect IGST amount."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=18,
                igst=1700,  # Wrong - should be 1800
                cgst=0,
                sgst=0,
                is_inter_state=True,
            )
            self.assertFalse(is_valid)
            self.assertIn("IGST mismatch", error)
            self.assertEqual(result["igst"], 1800)  # Should be corrected
        
        def test_intra_state_18_percent(self):
            """Test intra-state transaction with 18% rate."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=18,
                igst=0,
                cgst=900,
                sgst=900,
                is_inter_state=False,
            )
            self.assertTrue(is_valid)
            self.assertEqual(result["igst"], 0)
            self.assertEqual(result["cgst"], 900)
            self.assertEqual(result["sgst"], 900)
        
        def test_intra_state_wrong_cgst_sgst(self):
            """Test intra-state with incorrect CGST+SGST."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=18,
                igst=0,
                cgst=800,  # Wrong - should be 900
                sgst=900,
                is_inter_state=False,
            )
            self.assertFalse(is_valid)
            self.assertIn("CGST mismatch", error)
            self.assertEqual(result["cgst"], 900)  # Should be corrected
        
        def test_rounding_to_2_decimals(self):
            """Test that values are rounded to 2 decimal places."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=18,
                igst=1800.001,
                cgst=900.005,
                sgst=900.005,
                is_inter_state=True,
            )
            self.assertEqual(result["igst"], 1800.00)
            self.assertEqual(result["cgst"], 900.01)
            self.assertEqual(result["sgst"], 900.01)
        
        def test_export_zero_rate(self):
            """Test export with 0% rate."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=50000,
                rate=0,
                igst=0,
                cgst=0,
                sgst=0,
                is_inter_state=True,
            )
            self.assertTrue(is_valid)
            self.assertEqual(result["igst"], 0)
            self.assertEqual(result["cgst"], 0)
            self.assertEqual(result["sgst"], 0)
        
        def test_5_percent_rate(self):
            """Test 5% rate (CGST=2.5%, SGST=2.5%)."""
            is_valid, error, result = validate_tax_breakup_enhanced(
                taxable_value=10000,
                rate=5,
                igst=0,
                cgst=250,
                sgst=250,
                is_inter_state=False,
            )
            self.assertTrue(is_valid)
            self.assertEqual(result["igst"], 0)
            self.assertEqual(result["cgst"], 250)
            self.assertEqual(result["sgst"], 250)
    
    # Run tests
    unittest.main(exit=False)
    
    return True


if __name__ == "__main__":
    test_tax_breakup_validation()
