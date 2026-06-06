"""
GSTR-4 Data Aggregation Module

This module provides functions to generate GSTR-4 (Composition Dealer Return) data.

GSTR-4 is filed by composition dealers who have opted for the Composition Scheme under GST.
Composition dealers pay tax at a fixed rate on their turnover and are not allowed to claim ITC.

Composition Rates:
- 0.5% for manufacturers (other than notified)
- 1% for registered person supplying goods through e-commerce operators
- 2.5% for other suppliers (intra-state)
- 3% for inter-state supplies

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP

from india_compliance.gst_india.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Composition tax rates as per CGST Act
COMPOSITION_RATES = {
    "manufacturer": 0.5,      # 0.5% for manufacturers
    "ecommerce_goods": 1.0,    # 1% for e-commerce goods suppliers
    "restaurant": 2.5,         # 2.5% for restaurants (intra-state)
    "intra_state": 2.5,       # 2.5% for intra-state (other than restaurant)
    "inter_state": 3.0,        # 3% for inter-state supplies
}

# Composition scheme types
COMPOSITION_SCHEME_TYPES = [
    "regular",
    "casual",
    "nrth",  # Non-Resident Taxable Person
]


def to_decimal(value: Any) -> Decimal:
    """Convert any value to Decimal for precise calculations."""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    return Decimal(str(value))


def round_decimal(value: Decimal, precision: int = 2) -> Decimal:
    """Round Decimal to specified precision."""
    if value is None:
        return Decimal('0')
    quantize_str = '0.' + '0' * precision
    return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)


def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    dec = to_decimal(value)
    return float(round_decimal(dec, precision))


def extract_state_code(pos: Any) -> str:
    """Extract 2-digit state code from Place of Supply."""
    if not pos:
        return ""
    pos_str = str(pos).strip()
    if len(pos_str) == 2 and pos_str.isdigit():
        return pos_str
    if "-" in pos_str:
        code = pos_str.split("-")[0].strip()
        if len(code) == 2 and code.isdigit():
            return code
    import re
    match = re.match(r"^(\d{2})", pos_str)
    if match:
        return match.group(1)
    return ""


def get_composition_rate(supply_type: str, is_inter_state: bool = False) -> float:
    """
    Get composition tax rate based on supply type.
    
    Args:
        supply_type: Type of supply (manufacturer, restaurant, ecommerce_goods, other)
        is_inter_state: Whether the supply is inter-state
    
    Returns:
        Composition tax rate percentage
    """
    if is_inter_state:
        return COMPOSITION_RATES["inter_state"]
    
    return COMPOSITION_RATES.get(supply_type, COMPOSITION_RATES["intra_state"])


def calculate_composition_tax(
    taxable_value: float,
    composition_type: str = "intra_state",
    is_inter_state: bool = False
) -> Dict[str, float]:
    """
    Calculate composition tax for a given taxable value.
    
    Args:
        taxable_value: Taxable value of supply
        composition_type: Type of composition dealer
        is_inter_state: Whether supply is inter-state
    
    Returns:
        Dictionary with tax breakdown
    """
    rate = get_composition_rate(composition_type, is_inter_state)
    tax_amount = flt(taxable_value * rate / 100)
    
    # For inter-state, only IGST applies
    # For intra-state, CGST + SGST (half each)
    if is_inter_state:
        return {
            "taxable_value": taxable_value,
            "igst": tax_amount,
            "cgst": 0.0,
            "sgst": 0.0,
            "rate": rate,
            "total_tax": tax_amount,
        }
    else:
        cgst = tax_amount / 2
        sgst = tax_amount / 2
        return {
            "taxable_value": taxable_value,
            "igst": 0.0,
            "cgst": cgst,
            "sgst": sgst,
            "rate": rate,
            "total_tax": tax_amount,
        }


def format_invoice_for_gstr4(row: Dict[str, Any], company_gstin: str = "") -> Dict[str, Any]:
    """
    Format a sales invoice for GSTR-4.
    
    Composition dealers report:
    - B2B (supplies to registered persons)
    - B2C (supplies to unregistered persons)
    - Exports (if applicable)
    - Inward supplies from registered persons (for RCM)
    """
    invoice_number = row.get("invoice_number", "")
    invoice_date = row.get("invoice_date", "")
    invoice_value = flt(row.get("invoice_value", 0))
    taxable_value = flt(row.get("taxable_value", 0))
    rate = flt(row.get("rate", 0))
    
    # Determine if inter-state
    pos = row.get("place_of_supply", "")
    company_state = company_gstin[:2] if company_gstin else ""
    pos_state = extract_state_code(pos)
    is_inter_state = company_state and pos_state and company_state != pos_state
    
    # Get GSTIN
    customer_gstin = row.get("gstin", "")
    
    # Calculate composition tax
    tax_breakdown = calculate_composition_tax(
        taxable_value,
        "intra_state" if not is_inter_state else "inter_state",
        is_inter_state
    )
    
    return {
        "invoice_number": invoice_number,
        "invoice_date": format_date_for_gstr(invoice_date),
        "invoice_value": invoice_value,
        "customer_gstin": customer_gstin,
        "customer_name": row.get("customer_name", ""),
        "place_of_supply": pos_state,
        "is_inter_state": is_inter_state,
        "taxable_value": taxable_value,
        "rate": rate,
        "igst": tax_breakdown["igst"],
        "cgst": tax_breakdown["cgst"],
        "sgst": tax_breakdown["sgst"],
        "composition_tax": tax_breakdown["total_tax"],
    }


def format_date_for_gstr(date_val: Any) -> str:
    """Format date as DD/MM/YYYY string for GSTR-4."""
    if not date_val:
        return ""
    if isinstance(date_val, datetime):
        return date_val.strftime("%d/%m/%Y")
    elif isinstance(date_val, str):
        try:
            parsed = datetime.fromisoformat(date_val.replace("/", "-").replace(" ", ""))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return date_val
    return ""


def aggregate_inward_supplies(invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate inward supplies for GSTR-4.
    
    Inward supplies include:
    - Supplies from registered persons (with GSTIN)
    - Imports
    - RCM supplies
    """
    total_taxable = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    invoice_count = 0
    
    registered_supplies = {}
    unregistered_supplies = []
    rcm_supplies = []
    
    for invoice in invoices:
        invoice_count += 1
        taxable = flt(invoice.get("taxable_value", 0))
        igst = flt(invoice.get("igst", 0))
        cgst = flt(invoice.get("cgst", 0))
        sgst = flt(invoice.get("sgst", 0))
        cess = flt(invoice.get("cess", 0))
        
        total_taxable += taxable
        total_igst += igst
        total_cgst += cgst
        total_sgst += sgst
        total_cess += cess
        
        # Check if RCM applies
        if invoice.get("reverse_charge") in ("Y", "YES", "True", True):
            rcm_supplies.append(invoice)
        elif invoice.get("gstin"):
            # Registered supplier
            gstin = invoice.get("gstin", "")
            if gstin not in registered_supplies:
                registered_supplies[gstin] = {
                    "gstin": gstin,
                    "customer_name": invoice.get("customer_name", ""),
                    "invoices": [],
                }
            registered_supplies[gstin]["invoices"].append(invoice)
        else:
            unregistered_supplies.append(invoice)
    
    return {
        "total_inward_taxable": total_taxable,
        "total_igst": total_igst,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_cess": total_cess,
        "invoice_count": invoice_count,
        "registered_supplies": list(registered_supplies.values()),
        "unregistered_supplies": unregistered_supplies,
        "rcm_supplies": rcm_supplies,
    }


def calculate_exempt_supplies(invoices: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate exempt/nil-rated/non-GST supplies for GSTR-4.
    """
    nil_rated = 0.0
    exempted = 0.0
    non_gst = 0.0
    zero_rated = 0.0
    
    for invoice in invoices:
        rate = flt(invoice.get("rate", 0))
        taxable = flt(invoice.get("taxable_value", 0))
        
        if rate == 0:
            gst_treatment = invoice.get("gst_treatment", "").lower()
            if "nil" in gst_treatment:
                nil_rated += taxable
            elif "exempt" in gst_treatment:
                exempted += taxable
            elif "non" in gst_treatment:
                non_gst += taxable
            else:
                # Default to nil-rated for 0% rate
                nil_rated += taxable
        elif rate == 0 and taxable > 0:
            zero_rated += taxable
    
    return {
        "nil_rated": nil_rated,
        "exempted": exempted,
        "non_gst": non_gst,
        "zero_rated": zero_rated,
        "total_exempt": nil_rated + exempted + non_gst + zero_rated,
    }


def generate_gstr4_tables(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    composition_type: str = "regular",
) -> Dict[str, Any]:
    """
    Generate GSTR-4 tables from clean sales data.
    
    Args:
        clean_data: List of validated invoice dictionaries
        company_gstin: Company GSTIN
        composition_type: Type of composition scheme (regular, casual, nrth)
    
    Returns:
        GSTR-4 tables dictionary
    """
    logger.info(f"Generating GSTR-4 tables from {len(clean_data)} records")
    
    b2b_invoices = []
    b2c_invoices = []
    export_invoices = []
    exempt_supplies = []
    
    total_taxable = 0.0
    total_composition_tax = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    
    # Process each invoice
    for row in clean_data:
        customer_gstin = row.get("gstin", "")
        pos = row.get("place_of_supply", "")
        
        # Determine state codes
        company_state = company_gstin[:2] if company_gstin else ""
        pos_state = extract_state_code(pos)
        is_inter_state = company_state and pos_state and company_state != pos_state
        
        taxable = flt(row.get("taxable_value", 0))
        rate = flt(row.get("rate", 0))
        
        if taxable == 0:
            continue
        
        # Calculate composition tax
        tax_breakdown = calculate_composition_tax(
            taxable,
            "intra_state" if not is_inter_state else "inter_state",
            is_inter_state
        )
        
        total_taxable += taxable
        total_composition_tax += tax_breakdown["total_tax"]
        
        if is_inter_state:
            total_igst += tax_breakdown["igst"]
        else:
            total_cgst += tax_breakdown["cgst"]
            total_sgst += tax_breakdown["sgst"]
        
        # Classify based on customer type
        if row.get("gstin"):
            # B2B - registered recipient
            b2b_invoices.append({
                "invoice_number": row.get("invoice_number", ""),
                "invoice_date": format_date_for_gstr(row.get("invoice_date")),
                "customer_gstin": customer_gstin,
                "customer_name": row.get("customer_name", ""),
                "place_of_supply": pos_state,
                "taxable_value": taxable,
                "rate": rate,
                "igst": tax_breakdown["igst"],
                "cgst": tax_breakdown["cgst"],
                "sgst": tax_breakdown["sgst"],
                "composition_tax": tax_breakdown["total_tax"],
            })
        elif pos_state == "96" or "export" in str(row.get("gst_category", "")).lower():
            # Exports
            export_invoices.append({
                "invoice_number": row.get("invoice_number", ""),
                "invoice_date": format_date_for_gstr(row.get("invoice_date")),
                "export_type": row.get("export_type", "WOPAY"),
                "shipping_bill_number": row.get("shipping_bill_number", ""),
                "shipping_bill_date": format_date_for_gstr(row.get("shipping_bill_date")),
                "port_code": row.get("port_code", ""),
                "taxable_value": taxable,
                "rate": rate,
                "igst": tax_breakdown["igst"],
                "composition_tax": tax_breakdown["total_tax"],
            })
        else:
            # B2C - unregistered recipient
            b2c_invoices.append({
                "invoice_number": row.get("invoice_number", ""),
                "invoice_date": format_date_for_gstr(row.get("invoice_date")),
                "customer_name": row.get("customer_name", ""),
                "place_of_supply": pos_state,
                "taxable_value": taxable,
                "rate": rate,
                "igst": tax_breakdown["igst"],
                "cgst": tax_breakdown["cgst"],
                "sgst": tax_breakdown["sgst"],
                "composition_tax": tax_breakdown["total_tax"],
            })
    
    # Calculate exempt supplies
    exempt = calculate_exempt_supplies(clean_data)
    
    # Calculate consolidated summary by rate
    rate_summary = {}
    for row in clean_data:
        rate = flt(row.get("rate", 0))
        if rate not in rate_summary:
            rate_summary[rate] = {
                "rate": rate,
                "taxable_value": 0.0,
                "tax": 0.0,
            }
        taxable = flt(row.get("taxable_value", 0))
        tax = taxable * rate / 100
        rate_summary[rate]["taxable_value"] += taxable
        rate_summary[rate]["tax"] += tax
    
    result = {
        "gstin": company_gstin,
        "composition_type": composition_type,
        
        # Outward supplies
        "b2b": b2b_invoices,
        "b2c": b2c_invoices,
        "exports": export_invoices,
        
        # Inward supplies (for information only)
        "inward_supplies": {
            "registered": [],
            "unregistered": [],
            "imports": [],
        },
        
        # Exempt supplies
        "exempt_supplies": {
            "nil_rated": exempt["nil_rated"],
            "exempted": exempt["exempted"],
            "non_gst": exempt["non_gst"],
            "total_exempt": exempt["total_exempt"],
        },
        
        # Consolidated by rate
        "consolidated_by_rate": list(rate_summary.values()),
        
        # Summary
        "summary": {
            "total_invoices": len(b2b_invoices) + len(b2c_invoices) + len(export_invoices),
            "b2b_count": len(b2b_invoices),
            "b2c_count": len(b2c_invoices),
            "export_count": len(export_invoices),
            "total_taxable_value": round(total_taxable, 2),
            "total_composition_tax": round(total_composition_tax, 2),
            "igst": round(total_igst, 2),
            "cgst": round(total_cgst, 2),
            "sgst": round(total_sgst, 2),
            "generated_at": datetime.now().isoformat(),
        },
    }
    
    logger.info(
        f"GSTR-4 generated: {result['summary']['total_invoices']} invoices, "
        f"Taxable: {total_taxable}, Tax: {total_composition_tax}"
    )
    
    return result


def generate_gstr4_json(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    return_period: str = "",
    composition_type: str = "regular",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-4 JSON payload for government filing.
    
    Args:
        clean_data: List of validated invoice dictionaries
        company_gstin: Company GSTIN
        return_period: Return period (MMYYYY)
        composition_type: Type of composition scheme
    
    Returns:
        GSTR-4 JSON payload
    """
    gstr4_tables = generate_gstr4_tables(clean_data, company_gstin, composition_type)
    
    gstr4_json = {
        "gstin": company_gstin,
        "ret_period": return_period,
        "comp_trn": composition_type,  # Composition taxpayer type
        "chksum": "",
        
        # Section 1: Outward Supplies
        "b2b": gstr4_tables["b2b"],
        "b2cs": gstr4_tables["b2c"],  # B2C is similar to B2CS
        "exp": gstr4_tables["exports"],
        
        # Section 2: Inward Supplies
        "isd": [],  # ISD credits (if applicable)
        
        # Section 3: Exempt/Nil-rated/Non-GST
        "nil_exemp": {
            "inv": [],
            "expt_amt": gstr4_tables["exempt_supplies"]["exempted"],
            "nil_amt": gstr4_tables["exempt_supplies"]["nil_rated"],
            "ngsup_amt": gstr4_tables["exempt_supplies"]["non_gst"],
        },
        
        # Section 4: Consolidated by rate
        "consolidated": gstr4_tables["consolidated_by_rate"],
        
        # Summary
        "summary": gstr4_tables["summary"],
        
        # Filing info
        "status": "Generated",
        "generated_at": datetime.now().isoformat(),
    }
    
    return gstr4_json


def validate_gstr4(gstr4_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate GSTR-4 data for completeness and correctness.
    
    Args:
        gstr4_data: GSTR-4 data dictionary
    
    Returns:
        Validation result dictionary
    """
    errors = []
    warnings = []
    
    # Check required fields
    if not gstr4_data.get("gstin"):
        errors.append("GSTIN is required")
    
    if not gstr4_data.get("ret_period"):
        errors.append("Return period is required")
    
    # Check summary totals
    summary = gstr4_data.get("summary", {})
    total_taxable = summary.get("total_taxable_value", 0)
    total_tax = summary.get("total_composition_tax", 0)
    
    # Validate tax calculation (rough check)
    if total_taxable > 0 and total_tax == 0:
        warnings.append("Tax amount is zero - verify composition rate")
    
    # Check for negative values
    if total_taxable < 0:
        errors.append("Taxable value cannot be negative")
    
    if total_tax < 0:
        errors.append("Tax amount cannot be negative")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
