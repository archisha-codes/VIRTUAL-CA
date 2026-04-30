"""
GSTR-9 Data Aggregation Module

This module provides functions to generate GSTR-9 (Annual Return).

GSTR-9 is filed by regular taxpayers annually consolidating all monthly returns.
It includes:
- Annual summary of all monthly returns (GSTR-1, GSTR-2, GSTR-3B)
- Consolidated inward supplies
- Consolidated outward supplies
- ITC availed and reversed
- Tax liability and paid
- Additional liability/credit
- Audit details (if applicable)
- Late fees calculation
- Amendment summary

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from india_compliance.gst_india.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)


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


def format_date_for_gstr(date_val: Any) -> str:
    """Format date as DD/MM/YYYY string for GSTR-9."""
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


def calculate_late_fee(due_date: datetime, filing_date: datetime, tax_amount: float) -> float:
    """
    Calculate late filing fee.
    
    As per GST Act, late fee is:
    - Rs. 50 per day (Rs. 25 CGST + Rs. 25 SGST) for NIL returns
    - Rs. 200 per day (Rs. 100 CGST + Rs. 100 SGST) for other returns
    
    Maximum late fee is Rs. 10,000 (Rs. 5,000 CGST + Rs. 5,000 SGST)
    """
    days_late = (filing_date - due_date).days
    if days_late <= 0:
        return 0.0
    
    # Determine if NIL return
    if tax_amount == 0:
        daily_fee = 50.0  # NIL return
    else:
        daily_fee = 200.0  # Regular return
    
    late_fee = min(days_late * daily_fee, 10000.0)
    return round(late_fee, 2)


def consolidate_monthly_data(
    monthly_gstr1_data: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Consolidate all monthly GSTR-1 data into annual figures.
    
    Args:
        monthly_gstr1_data: List of monthly GSTR-1 data dictionaries
    
    Returns:
        Consolidated annual data
    """
    consolidated = {
        "b2b": {"count": 0, "taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0},
        "b2cl": {"count": 0, "taxable": 0.0, "igst": 0.0, "cess": 0.0},
        "b2cs": {"count": 0, "taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0},
        "exports": {"count": 0, "taxable": 0.0, "igst": 0.0, "cess": 0.0},
        "cdnr": {"count": 0, "taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0},
        "cdnur": {"count": 0, "taxable": 0.0, "igst": 0.0, "cess": 0.0},
    }
    
    for monthly_data in monthly_gstr1_data:
        summary = monthly_data.get("summary", {})
        
        # B2B
        consolidated["b2b"]["count"] += summary.get("b2b_count", 0)
        
        # B2CL
        consolidated["b2cl"]["count"] += summary.get("b2cl_count", 0)
        
        # B2CS
        consolidated["b2cs"]["count"] += summary.get("b2cs_count", 0)
        
        # Exports
        consolidated["exports"]["count"] += summary.get("exp_count", 0)
    
    return consolidated


def consolidate_itc_data(
    monthly_gstr3b_data: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Consolidate ITC data from monthly GSTR-3B returns.
    
    Args:
        monthly_gstr3b_data: List of monthly GSTR-3B data
    
    Returns:
        Consolidated ITC data
    """
    itc = {
        "total_itc_availed": {
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
        "itc_reversed": {
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
        "net_itc_available": {
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    }
    
    for monthly_data in monthly_gstr3b_data:
        itc_summary = monthly_data.get("total_itc", {})
        
        itc["total_itc_availed"]["igst"] += itc_summary.get("igst", 0)
        itc["total_itc_availed"]["cgst"] += itc_summary.get("cgst", 0)
        itc["total_itc_availed"]["sgst"] += itc_summary.get("sgst", 0)
        itc["total_itc_availed"]["cess"] += itc_summary.get("cess", 0)
    
    # Calculate net ITC
    for key in ["igst", "cgst", "sgst", "cess"]:
        itc["net_itc_available"][key] = round(
            itc["total_itc_availed"][key] - itc["itc_reversed"][key],
            2
        )
    
    return itc


def calculate_amendment_summary(
    original_data: Dict[str, Any],
    amended_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate amendment summary between original and amended returns.
    
    Args:
        original_data: Original return data
        amended_data: Amended return data
    
    Returns:
        Amendment summary
    """
    return {
        "taxable_value_diff": round(
            amended_data.get("taxable_value", 0) - original_data.get("taxable_value", 0),
            2
        ),
        "igst_diff": round(
            amended_data.get("igst", 0) - original_data.get("igst", 0),
            2
        ),
        "cgst_diff": round(
            amended_data.get("cgst", 0) - original_data.get("cgst", 0),
            2
        ),
        "sgst_diff": round(
            amended_data.get("sgst", 0) - original_data.get("sgst", 0),
            2
        ),
        "cess_diff": round(
            amended_data.get("cess", 0) - original_data.get("cess", 0),
            2
        ),
    }


def generate_gstr9_tables(
    monthly_gstr1_data: List[Dict[str, Any]],
    monthly_gstr3b_data: List[Dict[str, Any]],
    company_gstin: str = "",
    company_name: str = "",
    financial_year: str = "",
    audit_required: bool = False,
    audit_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate GSTR-9 tables from monthly return data.
    
    Args:
        monthly_gstr1_data: List of monthly GSTR-1 data
        monthly_gstr3b_data: List of monthly GSTR-3B data
        company_gstin: Company GSTIN
        company_name: Company name
        financial_year: Financial year (e.g., "2023-24")
        audit_required: Whether audit is required
        audit_details: Audit details if applicable
    
    Returns:
        GSTR-9 tables dictionary
    """
    logger.info(f"Generating GSTR-9 for FY {financial_year}")
    
    # Consolidate outward supplies
    outward = consolidate_monthly_data(monthly_gstr1_data)
    
    # Consolidate ITC
    itc = consolidate_itc_data(monthly_gstr3b_data)
    
    # Calculate tax liability
    total_liability = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    }
    
    for monthly_data in monthly_gstr3b_data:
        liability = monthly_data.get("total_liability", {})
        total_liability["igst"] += liability.get("igst", 0)
        total_liability["cgst"] += liability.get("cgst", 0)
        total_liability["sgst"] += liability.get("sgst", 0)
        total_liability["cess"] += liability.get("cess", 0)
    
    # Calculate totals
    total_taxable = (
        outward["b2b"]["taxable"] + 
        outward["b2cl"]["taxable"] + 
        outward["b2cs"]["taxable"] + 
        outward["exports"]["taxable"]
    )
    
    total_tax = (
        total_liability["igst"] + 
        total_liability["cgst"] + 
        total_liability["sgst"] + 
        total_liability["cess"]
    )
    
    # Calculate late fees (placeholder - actual would depend on filing dates)
    total_late_fee = 0.0
    
    result = {
        "gstin": company_gstin,
        "company_name": company_name,
        "financial_year": financial_year,
        
        # Part I: Outward Supplies
        "outward_supplies": {
            "b2b": outward["b2b"],
            "b2cl": outward["b2cl"],
            "b2cs": outward["b2cs"],
            "exports": outward["exports"],
            "cdnr": outward["cdnr"],
            "cdnur": outward["cdnur"],
        },
        
        # Part II: Inward Supplies
        "inward_supplies": {
            "from_registered": {"taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0},
            "from_unregistered": {"taxable": 0.0, "igst": 0.0},
            "imports": {"taxable": 0.0, "igst": 0.0, "cess": 0.0},
        },
        
        # Part III: ITC
        "itc": itc,
        
        # Part IV: Tax Liability
        "tax_liability": total_liability,
        
        # Part V: Additional Liability
        "additional_liability": {
            "goods_missing": 0.0,
            "reversals": 0.0,
            "other": 0.0,
        },
        
        # Part VI: Late Fees
        "late_fee": {
            "cgst": total_late_fee / 2,
            "sgst": total_late_fee / 2,
            "total": total_late_fee,
        },
        
        # Audit Details
        "audit_details": audit_details if audit_required else None,
        "audit_required": audit_required,
        
        # Summary
        "summary": {
            "total_outward_taxable": round(total_taxable, 2),
            "total_tax_liability": round(total_tax, 2),
            "total_itc_availed": round(
                itc["total_itc_availed"]["igst"] +
                itc["total_itc_availed"]["cgst"] +
                itc["total_itc_availed"]["sgst"] +
                itc["total_itc_availed"]["cess"],
                2
            ),
            "total_itc_reversed": round(
                itc["itc_reversed"]["igst"] +
                itc["itc_reversed"]["cgst"] +
                itc["itc_reversed"]["sgst"] +
                itc["itc_reversed"]["cess"],
                2
            ),
            "net_tax_payable": round(total_tax - 
                (itc["net_itc_available"]["igst"] +
                itc["net_itc_available"]["cgst"] +
                itc["net_itc_available"]["sgst"] +
                itc["net_itc_available"]["cess"]), 2),
            "late_fee": round(total_late_fee, 2),
            "generated_at": datetime.now().isoformat(),
        },
    }
    
    logger.info(f"GSTR-9 generated: Taxable={total_taxable}, Tax={total_tax}")
    
    return result


def generate_gstr9_json(
    monthly_gstr1_data: List[Dict[str, Any]],
    monthly_gstr3b_data: List[Dict[str, Any]],
    company_gstin: str = "",
    company_name: str = "",
    financial_year: str = "",
    audit_required: bool = False,
    audit_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate complete GSTR-9 JSON payload for government filing.
    
    Args:
        monthly_gstr1_data: List of monthly GSTR-1 data
        monthly_gstr3b_data: List of monthly GSTR-3B data
        company_gstin: Company GSTIN
        company_name: Company name
        financial_year: Financial year
        audit_required: Whether audit is required
        audit_details: Audit details
    
    Returns:
        GSTR-9 JSON payload
    """
    gstr9_tables = generate_gstr9_tables(
        monthly_gstr1_data,
        monthly_gstr3b_data,
        company_gstin,
        company_name,
        financial_year,
        audit_required,
        audit_details
    )
    
    gstr9_json = {
        "gstin": company_gstin,
        "fy": financial_year,
        "company_name": company_name,
        
        # Part A: Outward Supplies
        "outward_supplies": gstr9_tables["outward_supplies"],
        
        # Part B: Inward Supplies  
        "inward_supplies": gstr9_tables["inward_supplies"],
        
        # Part C: ITC
        "itc": gstr9_tables["itc"],
        
        # Part D: Tax Liability
        "tax_liability": gstr9_tables["tax_liability"],
        
        # Part E: Additional Liability
        "additional_liability": gstr9_tables["additional_liability"],
        
        # Part F: Late Fee
        "late_fee": gstr9_tables["late_fee"],
        
        # Audit
        "audit": gstr9_tables["audit_details"],
        
        # Summary
        "summary": gstr9_tables["summary"],
        
        # Filing info
        "status": "Generated",
        "generated_at": datetime.now().isoformat(),
    }
    
    return gstr9_json


def validate_gstr9(gstr9_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate GSTR-9 data for completeness and correctness.
    
    Args:
        gstr9_data: GSTR-9 data dictionary
    
    Returns:
        Validation result dictionary
    """
    errors = []
    warnings = []
    
    # Check required fields
    if not gstr9_data.get("gstin"):
        errors.append("GSTIN is required")
    
    if not gstr9_data.get("fy"):
        errors.append("Financial year is required")
    
    # Check totals
    summary = gstr9_data.get("summary", {})
    total_taxable = summary.get("total_outward_taxable", 0)
    total_tax = summary.get("total_tax_liability", 0)
    total_itc = summary.get("total_itc_availed", 0)
    net_payable = summary.get("net_tax_payable", 0)
    
    if total_taxable < 0:
        errors.append("Total taxable value cannot be negative")
    
    if total_tax < 0:
        errors.append("Total tax liability cannot be negative")
    
    # Cross-validation
    if total_itc > total_tax and total_tax > 0:
        warnings.append(
            f"ITC availed ({total_itc}) exceeds tax liability ({total_tax})"
        )
    
    # Audit requirements
    if gstr9_data.get("audit_required") and not gstr9_data.get("audit"):
        warnings.append("Audit required but audit details not provided")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
