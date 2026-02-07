"""
GSTR-3B Data Aggregation Module

This module provides functions to convert GSTR-1 formatted tables into 
GSTR-3B monthly return summary format.

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime

from india_compliance.gst_india.utils.logger import get_logger
from india_compliance.gst_india.utils.gstr_1 import getdate, extract_state_code

# Initialize logger
logger = get_logger(__name__)


def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    return round(float(value), precision)


def extract_tax_amount(entry: Dict[str, Any], tax_type: str = "igst") -> float:
    """Extract tax amount from GSTR-1 entry, handling nested items."""
    # Check if it's a direct entry with tax fields
    if tax_type in entry:
        return flt(entry.get(tax_type, 0))
    
    # Check if it has nested items (B2B format)
    items = entry.get("items", entry.get("itms", []))
    if items:
        total = 0.0
        for item in items:
            if tax_type in item:
                total += flt(item.get(tax_type, 0))
            elif f"{tax_type}_amount" in item:
                total += flt(item.get(f"{tax_type}_amount", 0))
        return total
    
    return 0.0


def extract_taxable_value(entry: Dict[str, Any]) -> float:
    """Extract taxable value from GSTR-1 entry."""
    # Check direct field
    if "taxable_value" in entry:
        return flt(entry.get("taxable_value", 0))
    if "txval" in entry:
        return flt(entry.get("txval", 0))
    
    # Check nested items
    items = entry.get("items", entry.get("itms", []))
    if items:
        total = 0.0
        for item in items:
            if "taxable_value" in item:
                total += flt(item.get("taxable_value", 0))
            elif "txval" in item:
                total += flt(item.get("txval", 0))
        return total
    
    return 0.0


def extract_rate(entry: Dict[str, Any]) -> float:
    """Extract tax rate from GSTR-1 entry."""
    if "rate" in entry:
        return flt(entry.get("rate", 0))
    if "rt" in entry:
        return flt(entry.get("rt", 0))
    
    # Check nested items
    items = entry.get("items", entry.get("itms", []))
    if items and len(items) > 0:
        first_item = items[0]
        if "rate" in first_item:
            return flt(first_item.get("rate", 0))
        if "rt" in first_item:
            return flt(first_item.get("rt", 0))
    
    return 0.0


def get_supply_type(entry: Dict[str, Any]) -> str:
    """Determine supply type (Inter-State or Intra-State) from entry."""
    pos = entry.get("pos", entry.get("place_of_supply", ""))
    state_code = extract_state_code(pos)
    
    # Check for IGST - indicates inter-state
    igst = extract_tax_amount(entry, "igst")
    if igst > 0:
        return "Inter-State"
    
    # Check for CGST+SGST - indicates intra-state
    cgst = extract_tax_amount(entry, "cgst")
    sgst = extract_tax_amount(entry, "sgst")
    if cgst > 0 or sgst > 0:
        return "Intra-State"
    
    # Default based on POS
    if state_code and state_code != "96":
        return "Inter-State" if state_code else "Intra-State"
    
    return "Intra-State"


def calculate_total_tax(entry: Dict[str, Any]) -> float:
    """Calculate total tax from entry."""
    igst = extract_tax_amount(entry, "igst")
    cgst = extract_tax_amount(entry, "cgst")
    sgst = extract_tax_amount(entry, "sgst")
    cess = extract_tax_amount(entry, "cess")
    
    return flt(igst + cgst + sgst + cess)


def sum_table_values(
    table: List[Dict[str, Any]],
    value_field: str = "taxable_value",
    igst_field: str = "igst",
    cgst_field: str = "cgst",
    sgst_field: str = "sgst",
    cess_field: str = "cess"
) -> Dict[str, float]:
    """
    Sum all values from a GSTR-1 table.
    
    Args:
        table: List of invoice/entry dictionaries
        value_field: Field name for taxable value
        igst_field: Field name for IGST
        cgst_field: Field name for CGST
        sgst_field: Field name for SGST
        cess_field: Field name for CESS
    
    Returns:
        Dictionary with totals
    """
    total_txval = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    count = 0
    
    for entry in table:
        count += 1
        total_txval += extract_taxable_value(entry)
        total_igst += extract_tax_amount(entry, igst_field)
        total_cgst += extract_tax_amount(entry, cgst_field)
        total_sgst += extract_tax_amount(entry, sgst_field)
        total_cess += extract_tax_amount(entry, cess_field)
    
    return {
        "count": count,
        "taxable_value": round(total_txval, 2),
        "igst": round(total_igst, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "cess": round(total_cess, 2),
        "total_tax": round(total_igst + total_cgst + total_sgst + total_cess, 2),
    }


def sum_b2b_invoices(gstr1_tables: Dict[str, Any]) -> Dict[str, float]:
    """Sum all B2B invoices from GSTR-1 tables."""
    total_txval = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    invoice_count = 0
    
    for gstin_entry in gstr1_tables.get("b2b", []):
        invoices = gstin_entry.get("invoices", gstin_entry.get("itms", []))
        for invoice in invoices:
            invoice_count += 1
            total_txval += extract_taxable_value(invoice)
            total_igst += extract_tax_amount(invoice, "igst")
            total_cgst += extract_tax_amount(invoice, "cgst")
            total_sgst += extract_tax_amount(invoice, "sgst")
            total_cess += extract_tax_amount(invoice, "cess")
    
    return {
        "count": invoice_count,
        "taxable_value": round(total_txval, 2),
        "igst": round(total_igst, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "cess": round(total_cess, 2),
        "total_tax": round(total_igst + total_cgst + total_sgst + total_cess, 2),
    }


def calculate_interstate_summary(gstr1_tables: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    """
    Calculate inter-state supplies summary grouped by state (for 3.2).
    
    Returns:
        Dictionary with state code as key and tax values as value
    """
    state_summary: Dict[str, Dict[str, float]] = defaultdict(lambda: {
        "taxable_value": 0.0,
        "igst": 0.0,
        "cess": 0.0,
    })
    
    # Process B2CL (already inter-state by definition)
    for invoice in gstr1_tables.get("b2cl", []):
        pos = invoice.get("pos", "")
        state_code = extract_state_code(pos)
        if not state_code:
            continue
        
        state_summary[state_code]["taxable_value"] += extract_taxable_value(invoice)
        state_summary[state_code]["igst"] += extract_tax_amount(invoice, "igst")
        state_summary[state_code]["cess"] += extract_tax_amount(invoice, "cess")
    
    # Process B2CS (need to check if inter-state)
    for invoice in gstr1_tables.get("b2cs", []):
        supply_type = get_supply_type(invoice)
        if supply_type != "Inter-State":
            continue
        
        pos = invoice.get("pos", invoice.get("place_of_supply", ""))
        state_code = extract_state_code(pos)
        if not state_code:
            continue
        
        state_summary[state_code]["taxable_value"] += extract_taxable_value(invoice)
        state_summary[state_code]["igst"] += extract_tax_amount(invoice, "igst")
        state_summary[state_code]["cess"] += extract_tax_amount(invoice, "cess")
    
    # Process exports (special category)
    for invoice in gstr1_tables.get("exp", []):
        state_code = "96"  # Other Countries
        state_summary[state_code]["taxable_value"] += extract_taxable_value(invoice)
        state_summary[state_code]["igst"] += extract_tax_amount(invoice, "igst")
        state_summary[state_code]["cess"] += extract_tax_amount(invoice, "cess")
    
    # Convert to regular dict with rounded values
    result = {}
    for state, values in state_summary.items():
        result[state] = {
            "taxable_value": round(values["taxable_value"], 2),
            "igst": round(values["igst"], 2),
            "cess": round(values["cess"], 2),
        }
    
    return result


def calculate_nil_exempt_supplies(gstr1_tables: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate nil-rated, exempted, and non-GST supplies.
    
    These are invoices with 0% rate or no tax.
    """
    nil_rated = 0.0
    exempted = 0.0
    non_gst = 0.0
    zero_rated = 0.0
    
    # Process B2B invoices
    for gstin_entry in gstr1_tables.get("b2b", []):
        invoices = gstin_entry.get("invoices", [])
        for invoice in invoices:
            rate = extract_rate(invoice)
            txval = extract_taxable_value(invoice)
            total_tax = calculate_total_tax(invoice)
            
            if rate == 0:
                if total_tax == 0:
                    # Could be nil-rated, exempted, or non-GST
                    # Default to nil-rated for now
                    nil_rated += txval
                else:
                    # Zero-rated with tax (exports with refund)
                    zero_rated += txval
    
    # Process other tables
    for table_name in ["b2cl", "b2cs", "exp"]:
        for invoice in gstr1_tables.get(table_name, []):
            rate = extract_rate(invoice)
            txval = extract_taxable_value(invoice)
            total_tax = calculate_total_tax(invoice)
            
            if rate == 0:
                if total_tax == 0:
                    nil_rated += txval
                else:
                    zero_rated += txval
    
    return {
        "nil_rated": round(nil_rated, 2),
        "exempted": round(exempted, 2),
        "non_gst": round(non_gst, 2),
        "zero_rated": round(zero_rated, 2),
    }


def generate_gstr3b_summary(
    gstr1_tables: Dict[str, Any],
    return_period: str = "",
    taxpayer_gstin: str = "",
    taxpayer_name: str = "",
) -> Dict[str, Any]:
    """
    Convert GSTR-1 tables into GSTR-3B monthly summary format.
    
    Args:
        gstr1_tables: Dictionary with b2b, b2cl, b2cs, exp, cdnr, cdnur tables
        return_period: Return period in MMYYYY format
        taxpayer_gstin: Taxpayer's GSTIN
        taxpayer_name: Taxpayer's name
    
    Returns:
        GSTR-3B summary dictionary with all required fields
    """
    logger.info("Generating GSTR-3B summary from GSTR-1 tables")
    
    # Calculate 3.1(a) - Outward taxable supplies (B2B + B2CL + B2CS)
    b2b_total = sum_b2b_invoices(gstr1_tables)
    b2cl_total = sum_table_values(gstr1_tables.get("b2cl", []))
    b2cs_total = sum_table_values(gstr1_tables.get("b2cs", []))
    
    taxable_supplies = {
        "taxable_value": round(
            b2b_total["taxable_value"] + 
            b2cl_total["taxable_value"] + 
            b2cs_total["taxable_value"], 
            2
        ),
        "igst": round(
            b2b_total["igst"] + 
            b2cl_total["igst"] + 
            b2cs_total["igst"], 
            2
        ),
        "cgst": round(
            b2b_total["cgst"] + 
            b2cl_total["cgst"] + 
            b2cs_total["cgst"], 
            2
        ),
        "sgst": round(
            b2b_total["sgst"] + 
            b2cl_total["sgst"] + 
            b2cs_total["sgst"], 
            2
        ),
        "cess": round(
            b2b_total["cess"] + 
            b2cl_total["cess"] + 
            b2cs_total["cess"], 
            2
        ),
    }
    
    # Calculate 3.1(b) - Zero-rated exports
    exp_total = sum_table_values(gstr1_tables.get("exp", []))
    
    # Calculate 3.1(c) - Nil-rated, exempted, non-GST supplies
    nil_exempt = calculate_nil_exempt_supplies(gstr1_tables)
    
    # Calculate 3.1(d) - Inward supplies (RCM) - placeholder
    rcm_inward = {
        "taxable_value": 0.0,
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    # Calculate 3.1(e) - Non-GST outward supplies
    non_gst_outward = {
        "taxable_value": 0.0,
        "tax": 0.0,
    }
    
    # Calculate 3.2 - Inter-state supplies to unregistered persons
    # B2CL + B2CS (inter-state) grouped by state
    interstate_summary = calculate_interstate_summary(gstr1_tables)
    
    # Calculate 4 - Tax on inward supplies (RCM)
    # Same as 3.1(d) for now
    rcm_tax = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    # Calculate 5 - ITC claimed
    itc_claimed = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    # Calculate 6 - ITC reversed
    itc_reversed = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    # Calculate 7 - Net ITC available
    net_itc = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    # Calculate 8 - Tax liability (outward + RCM)
    tax_liability = {
        "igst": round(taxable_supplies["igst"] + exp_total["igst"] + rcm_inward["igst"], 2),
        "cgst": round(taxable_supplies["cgst"] + rcm_inward["cgst"], 2),
        "sgst": round(taxable_supplies["sgst"] + rcm_inward["sgst"], 2),
        "cess": round(taxable_supplies["cess"] + exp_total["cess"] + rcm_inward["cess"], 2),
    }
    
    # Calculate 9 - Interest and late fee
    interest_late_fee = {
        "interest": {
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
        "late_fee": {
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    }
    
    # Calculate 10 - Payable
    tax_payable = {
        "igst": round(tax_liability["igst"] - net_itc["igst"], 2),
        "cgst": round(tax_liability["cgst"] - net_itc["cgst"], 2),
        "sgst": round(tax_liability["sgst"] - net_itc["sgst"], 2),
        "cess": round(tax_liability["cess"] - net_itc["cess"], 2),
    }
    
    # Build complete GSTR-3B summary
    gstr3b_summary = {
        "gstin": taxpayer_gstin,
        "ret_period": return_period,
        "taxpayer_name": taxpayer_name,
        
        # Section 3.1 - Details of Outward Supplies
        "3_1_a": {
            "description": "Outward taxable supplies (other than zero rated, nil rated and exempted)",
            **taxable_supplies,
        },
        "3_1_b": {
            "description": "Zero rated supplies (exports) and Deemed Exports",
            **exp_total,
        },
        "3_1_c": {
            "description": "Nil rated, exempted and non-GST supplies",
            "taxable_value": nil_exempt["nil_rated"] + nil_exempt["exempted"] + nil_exempt["non_gst"],
            "nil_rated": nil_exempt["nil_rated"],
            "exempted": nil_exempt["exempted"],
            "non_gst": nil_exempt["non_gst"],
        },
        "3_1_d": {
            "description": "Inward supplies (liable to reverse charge)",
            **rcm_inward,
        },
        "3_1_e": {
            "description": "Non-GST outward supplies",
            **non_gst_outward,
        },
        
        # Section 3.2 - Inter-state supplies to unregistered persons
        "3_2": {
            "description": "Supplies made to Unregistered Persons (B2C)",
            "summary": interstate_summary,
            "total_taxable_value": round(
                sum(v["taxable_value"] for v in interstate_summary.values()), 2
            ),
            "total_igst": round(
                sum(v["igst"] for v in interstate_summary.values()), 2
            ),
        },
        
        # Section 4 - Tax on inward supplies (RCM)
        "4": {
            "description": "Tax liability (Reverse Charge) on inward supplies",
            **rcm_tax,
        },
        
        # Section 5 - ITC claimed
        "5": {
            "description": "Input Tax Credit claimed",
            **itc_claimed,
        },
        
        # Section 6 - ITC reversed
        "6": {
            "description": " ITC Reversed",
            **itc_reversed,
        },
        
        # Section 7 - Net ITC available
        "7": {
            "description": "Net ITC Available",
            **net_itc,
        },
        
        # Section 8 - Tax liability payable
        "8": {
            "description": "Tax Payable on Outward Supplies (including RCM)",
            **tax_liability,
        },
        
        # Section 9 - Interest and late fee
        "9": interest_late_fee,
        
        # Section 10 - Tax payable after ITC
        "10": {
            "description": "Payable Amount after ITC",
            **tax_payable,
        },
        
        # Summary totals
        "total_liability": {
            "igst": round(tax_liability["igst"], 2),
            "cgst": round(tax_liability["cgst"], 2),
            "sgst": round(tax_liability["sgst"], 2),
            "cess": round(tax_liability["cess"], 2),
            "total": round(
                tax_liability["igst"] + 
                tax_liability["cgst"] + 
                tax_liability["sgst"] + 
                tax_liability["cess"], 
                2
            ),
        },
        "total_itc": {
            "igst": round(net_itc["igst"], 2),
            "cgst": round(net_itc["cgst"], 2),
            "sgst": round(net_itc["sgst"], 2),
            "cess": round(net_itc["cess"], 2),
            "total": round(
                net_itc["igst"] + 
                net_itc["cgst"] + 
                net_itc["sgst"] + 
                net_itc["cess"], 
                2
            ),
        },
        "total_payable": {
            "igst": round(tax_payable["igst"], 2),
            "cgst": round(tax_payable["cgst"], 2),
            "sgst": round(tax_payable["sgst"], 2),
            "cess": round(tax_payable["cess"], 2),
            "total": round(
                tax_payable["igst"] + 
                tax_payable["cgst"] + 
                tax_payable["sgst"] + 
                tax_payable["cess"], 
                2
            ),
        },
        
        # Invoice counts
        "invoice_counts": {
            "b2b": b2b_total["count"],
            "b2cl": b2cl_total["count"],
            "b2cs": b2cs_total["count"],
            "exp": exp_total["count"],
            "cdnr": sum(
                len(entry.get("notes", [])) 
                for entry in gstr1_tables.get("cdnr", [])
            ),
            "cdnur": len(gstr1_tables.get("cdnur", [])),
        },
    }
    
    logger.info(
        f"GSTR-3B summary generated: "
        f"Total liability: {gstr3b_summary['total_liability']['total']}, "
        f"Total ITC: {gstr3b_summary['total_itc']['total']}"
    )
    
    return gstr3b_summary


def generate_gstr3b_json(
    gstr1_tables: Dict[str, Any],
    return_period: str = "",
    taxpayer_gstin: str = "",
    taxpayer_name: str = "",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-3B JSON payload for government filing.
    
    This is an alias for generate_gstr3b_summary with additional metadata.
    """
    summary = generate_gstr3b_summary(
        gstr1_tables,
        return_period,
        taxpayer_gstin,
        taxpayer_name,
    )
    
    # Add filing metadata
    gstr3b_json = {
        "gstin": taxpayer_gstin,
        "ret_period": return_period,
        "gst_user_name": taxpayer_name,
        "gstr1_summary": summary,
    }
    
    return gstr3b_json
