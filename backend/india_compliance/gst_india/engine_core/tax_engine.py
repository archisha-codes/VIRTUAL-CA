# tax_engine.py
# Enhanced with Decimal precision for accurate tax calculations and resilient data mapping

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Tuple, Union
import numpy as np
import pandas as pd

def money(value: Union[float, int, str, None]) -> float:
    """
    Convert value to Decimal and quantize to 2 decimal places using ROUND_HALF_UP.
    This ensures consistent rounding for tax calculations.
    
    Args:
        value: Numeric value to convert
        
    Returns:
        Float rounded to 2 decimal places
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return 0.0
    try:
        # Strip commas to prevent Decimal conversion failures on formatted numbers
        val_str = str(value).replace(',', '').strip()
        if val_str.lower() in ('nan', '', 'none'):
            return 0.0
        return float(Decimal(val_str).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except (TypeError, ValueError):
        return 0.0


def _get_alias_value(row: Dict[str, Any], aliases: list, default: Any = 0) -> Any:
    """
    Helper to extract a value from a row using multiple potential key aliases.
    Handles exact matches first, then falls back to case-insensitive and space-insensitive matching.
    """
    # 1. Exact match
    for alias in aliases:
        if alias in row:
            return row[alias]
    
    # 2. Fallback to case-insensitive match
    row_keys = row.index if hasattr(row, 'index') else row.keys()
    lower_aliases = [str(a).lower().strip() for a in aliases]
    
    for key in row_keys:
        if str(key).lower().strip() in lower_aliases:
            return row[key]
            
    return default


def compute_tax(row: Dict[str, Any]) -> Tuple[float, float, float]:
    """
    Compute tax amounts using Decimal for precision.
    
    Args:
        row: Dictionary with taxable_value, gst_rate, supplier_state_code, place_of_supply
        
    Returns:
        Tuple of (cgst, sgst, igst)
    """
    # Broad alias check for robustness against multiple payload formats
    tax_aliases = ["taxable_value", "Taxable_Value", "Taxable Value", "txval"]
    rate_aliases = ["rate", "gst_rate", "GST_Rate", "Rate", "rt"]
    
    taxable_value = money(_get_alias_value(row, tax_aliases, 0))
    
    rate_val = _get_alias_value(row, rate_aliases, 0)
    rate_val = 0 if pd.isna(rate_val) else rate_val
    try:
        rate = Decimal(str(rate_val).replace(',', '').strip())
    except (TypeError, ValueError, Exception):
        rate = Decimal("0")
    
    supplier_state = str(_get_alias_value(row, ["supplier_state_code", "supplier_state"], ""))
    pos = str(_get_alias_value(row, ["place_of_supply", "pos", "Place Of Supply"], ""))
    
    # Calculate total tax using Decimal
    tax_amount = Decimal(str(taxable_value)) * rate / Decimal("100")
    tax_amount = tax_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # Check states to determine Inter vs Intra 
    if supplier_state and pos and supplier_state != pos:
        # Inter-state: IGST
        igst = float(tax_amount)
        cgst = 0.00
        sgst = 0.00
    else:
        # Intra-state: split equally
        cgst = tax_amount / Decimal("2")
        sgst = tax_amount / Decimal("2")
        cgst = float(cgst.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        sgst = float(sgst.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        igst = 0.00
    
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
    Apply tax calculations to a DataFrame while aggressively preserving imported values.
    """
    import pandas as pd
    
    results = df.apply(lambda row: compute_tax(row), axis=1, result_type="expand")
    
    # Expanded alias lists for the columns to catch UI states, standard schemas, and Excel mappings
    igst_aliases = ["igst", "igst_amount", "integrated tax", "integrated tax amount", "integrated_tax", "iamt"]
    cgst_aliases = ["cgst", "cgst_amount", "central tax", "central tax amount", "central_tax", "camt"]
    sgst_aliases = ["sgst", "sgst_amount", "state tax", "state tax amount", "state_tax", "state/ut tax", "samt"]
    cess_aliases = ["cess", "cess_amount", "cess amount", "csamt"]

    def find_col(df_instance, aliases, default):
        for col in df_instance.columns:
            if str(col).lower().strip() in aliases:
                return col
        return default

    igst_col = find_col(df, igst_aliases, "igst")
    cgst_col = find_col(df, cgst_aliases, "cgst")
    sgst_col = find_col(df, sgst_aliases, "sgst")
    
    for col in [igst_col, cgst_col, sgst_col]:
        if col not in df.columns:
            df[col] = 0.0

    def resolve_tax(existing, computed):
        """Preserve actual data if supplied, only use fallback compute if missing."""
        try:
            # Handle string-formatted numbers securely before float conversion
            if isinstance(existing, str):
                existing = existing.replace(',', '').strip()
            val = float(existing)
            if not pd.isna(val) and val > 0:
                return val
        except (ValueError, TypeError):
            pass
        return float(computed)

    # Use original tax if present, otherwise inject computation
    df[cgst_col] = df.apply(lambda r: resolve_tax(r.get(cgst_col, 0), results[0][r.name]), axis=1)
    df[sgst_col] = df.apply(lambda r: resolve_tax(r.get(sgst_col, 0), results[1][r.name]), axis=1)
    df[igst_col] = df.apply(lambda r: resolve_tax(r.get(igst_col, 0), results[2][r.name]), axis=1)
    
    # Reinforce variables for downstream GSTR-1 aggregation
    if igst_col != "igst": df["igst"] = df[igst_col]
    if cgst_col != "cgst": df["cgst"] = df[cgst_col]
    if sgst_col != "sgst": df["sgst"] = df[sgst_col]
    
    cess_col = find_col(df, cess_aliases, "cess")
    tax_aliases = ["taxable_value", "Taxable_Value", "Taxable Value", "txval"]
    
    # Calculate invoice_value safely 
    df["invoice_value"] = df.apply(
        lambda row: money(
            _get_alias_value(row, tax_aliases, 0) + 
            row.get(cgst_col, row.get("cgst", 0)) + 
            row.get(sgst_col, row.get("sgst", 0)) + 
            row.get(igst_col, row.get("igst", 0)) + 
            money(row.get(cess_col, 0))
        ),
        axis=1
    )
    
    # Ensure standard 'val' key exists for final GSTN JSON payload generation
    if "val" not in df.columns:
        df["val"] = df["invoice_value"]
        
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