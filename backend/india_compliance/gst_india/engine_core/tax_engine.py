# tax_engine.py
# Enhanced with Decimal precision for accurate tax calculations

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Tuple, Union


def money(value: Union[float, int, str, None]) -> float:
    """
    Convert value to Decimal and quantize to 2 decimal places using ROUND_HALF_UP.
    This ensures consistent rounding for tax calculations.
    
    Args:
        value: Numeric value to convert
        
    Returns:
        Float rounded to 2 decimal places
    """
    if value is None:
        return 0.0
    try:
        return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except (TypeError, ValueError):
        return 0.0


def compute_tax(row: Dict[str, Any]) -> Tuple[float, float, float]:
    """
    Compute tax amounts using Decimal for precision.
    
    Args:
        row: Dictionary with taxable_value, gst_rate, supplier_state_code, place_of_supply
        
    Returns:
        Tuple of (cgst, sgst, igst)
    """
    # Use money() for precision
    taxable_value = money(row.get("taxable_value", 0))
    rate = Decimal(str(row.get("gst_rate", 0)))
    supplier_state = str(row.get("supplier_state_code", ""))
    pos = str(row.get("place_of_supply", ""))
    
    # Calculate total tax using Decimal
    tax_amount = Decimal(str(taxable_value)) * rate / Decimal("100")
    tax_amount = tax_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    if supplier_state == pos:
        # Intra-state: split equally
        cgst = tax_amount / Decimal("2")
        sgst = tax_amount / Decimal("2")
        cgst = float(cgst.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        sgst = float(sgst.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        igst = 0.00
    else:
        # Inter-state: IGST
        igst = float(tax_amount)
        cgst = 0.00
        sgst = 0.00
    
    return cgst, sgst, igst


def compute_tax_with_breakdown(
    taxable_value: float, 
    rate: float, 
    is_inter_state: bool
) -> Dict[str, float]:
    """
    Compute tax breakdown with proper rounding.
    
    Args:
        taxable_value: Taxable amount
        rate: GST rate percentage
        is_inter_state: True for inter-state, False for intra-state
        
    Returns:
        Dictionary with taxable_value, cgst, sgst, igst, cess, invoice_value
    """
    # Use Decimal for precision
    taxable = Decimal(str(taxable_value))
    rate_decimal = Decimal(str(rate))
    
    # Calculate total tax
    total_tax = taxable * rate_decimal / Decimal("100")
    total_tax = total_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    if is_inter_state:
        # Inter-state: IGST
        igst = float(total_tax)
        cgst = 0.0
        sgst = 0.0
    else:
        # Intra-state: split equally
        half_tax = total_tax / Decimal("2")
        cgst = float(half_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        sgst = float(half_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        igst = 0.0
    
    cess = 0.0  # CESS is typically calculated separately
    
    invoice_value = float(taxable + total_tax)
    invoice_value = float(Decimal(str(invoice_value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    
    return {
        "taxable_value": float(taxable),
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "cess": cess,
        "invoice_value": invoice_value,
    }


def apply_tax(df) -> 'pd.DataFrame':
    """
    Apply tax calculations to a DataFrame.
    
    Note: This function is kept for backwards compatibility.
    For better precision, use compute_tax() directly.
    """
    import pandas as pd
    
    results = df.apply(lambda row: compute_tax(row), axis=1, result_type="expand")
    df["cgst"] = results[0]
    df["sgst"] = results[1]
    df["igst"] = results[2]
    
    # Calculate invoice_value using money() for precision
    df["invoice_value"] = df.apply(
        lambda row: money(row.get("taxable_value", 0) + row.get("cgst", 0) + row.get("sgst", 0) + row.get("igst", 0)),
        axis=1
    )
    
    return df


def calculate_tax_from_inclusive(invoice_value: float, rate: float) -> Tuple[float, float]:
    """
    Calculate taxable value and tax from tax-inclusive invoice value.
    
    Args:
        invoice_value: Total invoice value (tax inclusive)
        rate: GST rate percentage
        
    Returns:
        Tuple of (taxable_value, tax_amount)
    """
    if rate <= 0 or invoice_value <= 0:
        return 0.0, 0.0
    
    inv_decimal = Decimal(str(invoice_value))
    rate_decimal = Decimal(str(rate))
    
    divisor = Decimal("1") + rate_decimal / Decimal("100")
    taxable = inv_decimal / divisor
    tax = inv_decimal - taxable
    
    return money(taxable), money(tax)


# Legacy function for backwards compatibility
def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision (legacy function)."""
    return money(value) if precision == 2 else round(float(value), precision)
