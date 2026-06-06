"""
GSTR-6 Data Aggregation Module

This module provides functions to generate GSTR-6 (Input Service Distributor Return).

GSTR-6 is filed by Input Service Distributors (ISD) who receive input services from 
a vendor and distribute the Input Tax Credit (ITC) to their branch offices.

Key features:
- ISD registration details
- ISD invoices received from input service providers
- Distribution of ITC to branches
- Monthly distribution summary

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP

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
    """Format date as DD/MM/YYYY string for GSTR-6."""
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


def extract_state_code(gstin: str) -> str:
    """Extract 2-digit state code from GSTIN."""
    if gstin and len(gstin) >= 2:
        return gstin[:2]
    return ""


def calculate_itc_distribution(
    total_igst: float,
    total_cgst: float,
    total_sgst: float,
    total_cess: float,
    branch_gstins: List[str]
) -> List[Dict[str, Any]]:
    """
    Calculate ITC distribution among branches.
    
    Args:
        total_igst: Total IGST credit to distribute
        total_cgst: Total CGST credit to distribute
        total_sgst: Total SGST credit to distribute
        total_cess: Total CESS credit to distribute
        branch_gstins: List of branch GSTINs
    
    Returns:
        List of distribution entries per branch
    """
    if not branch_gstins:
        return []
    
    num_branches = len(branch_gstins)
    distributions = []
    
    for branch_gstin in branch_gstins:
        distributions.append({
            "branch_gstin": branch_gstin,
            "branch_state": extract_state_code(branch_gstin),
            "igst_credit": round(total_igst / num_branches, 2),
            "cgst_credit": round(total_cgst / num_branches, 2),
            "sgst_credit": round(total_sgst / num_branches, 2),
            "cess_credit": round(total_cess / num_branches, 2),
            "total_credit": round(
                (total_igst + total_cgst + total_sgst + total_cess) / num_branches, 
                2
            ),
        })
    
    return distributions


def process_isd_invoice(invoice: Dict[str, Any], isd_gstin: str) -> Dict[str, Any]:
    """
    Process an ISD invoice from input service provider.
    
    Args:
        invoice: Invoice data from service provider
        isd_gstin: ISD's GSTIN
    
    Returns:
        Formatted ISD invoice entry
    """
    return {
        "invoice_number": invoice.get("invoice_number", ""),
        "invoice_date": format_date_for_gstr(invoice.get("invoice_date")),
        "vendor_gstin": invoice.get("vendor_gstin", ""),
        "vendor_name": invoice.get("vendor_name", ""),
        "isd_gstin": isd_gstin,
        "taxable_value": flt(invoice.get("taxable_value", 0)),
        "igst": flt(invoice.get("igst", 0)),
        "cgst": flt(invoice.get("cgst", 0)),
        "sgst": flt(invoice.get("sgst", 0)),
        "cess": flt(invoice.get("cess", 0)),
        "total_tax": flt(
            invoice.get("igst", 0) + 
            invoice.get("cgst", 0) + 
            invoice.get("sgst", 0) + 
            invoice.get("cess", 0)
        ),
    }


def generate_gstr6_tables(
    isd_invoices: List[Dict[str, Any]],
    branch_details: List[Dict[str, Any]],
    isd_gstin: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate GSTR-6 tables from ISD invoices.
    
    Args:
        isd_invoices: List of invoices received by ISD from service providers
        branch_details: List of branch offices to distribute ITC
        isd_gstin: ISD's GSTIN
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-6 tables dictionary
    """
    logger.info(f"Generating GSTR-6 tables from {len(isd_invoices)} ISD invoices")
    
    # Process all ISD invoices
    isd_entries = []
    total_taxable = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    
    vendor_summary: Dict[str, Dict[str, Any]] = {}
    
    for invoice in isd_invoices:
        # Skip if no vendor GSTIN
        if not invoice.get("vendor_gstin"):
            continue
        
        entry = process_isd_invoice(invoice, isd_gstin)
        isd_entries.append(entry)
        
        # Accumulate totals
        total_taxable += entry["taxable_value"]
        total_igst += entry["igst"]
        total_cgst += entry["cgst"]
        total_sgst += entry["sgst"]
        total_cess += entry["cess"]
        
        # Vendor-wise summary
        vendor_gstin = invoice.get("vendor_gstin", "")
        if vendor_gstin not in vendor_summary:
            vendor_summary[vendor_gstin] = {
                "vendor_gstin": vendor_gstin,
                "vendor_name": invoice.get("vendor_name", ""),
                "invoice_count": 0,
                "taxable_value": 0.0,
                "igst": 0.0,
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": 0.0,
            }
        
        vendor_summary[vendor_gstin]["invoice_count"] += 1
        vendor_summary[vendor_gstin]["taxable_value"] += entry["taxable_value"]
        vendor_summary[vendor_gstin]["igst"] += entry["igst"]
        vendor_summary[vendor_gstin]["cgst"] += entry["cgst"]
        vendor_summary[vendor_gstin]["sgst"] += entry["sgst"]
        vendor_summary[vendor_gstin]["cess"] += entry["cess"]
    
    # Get branch GSTINs
    branch_gstins = [b.get("gstin", "") for b in branch_details if b.get("gstin")]
    
    # Calculate ITC distribution to branches
    distributions = calculate_itc_distribution(
        total_igst,
        total_cgst,
        total_sgst,
        total_cess,
        branch_gstins
    )
    
    # Match branches with distributions
    branch_distributions = []
    for branch in branch_details:
        branch_gstin = branch.get("gstin", "")
        dist = next((d for d in distributions if d["branch_gstin"] == branch_gstin), None)
        
        if dist:
            branch_distributions.append({
                "branch_gstin": branch_gstin,
                "branch_name": branch.get("name", ""),
                "branch_state": dist["branch_state"],
                "igst_credit": dist["igst_credit"],
                "cgst_credit": dist["cgst_credit"],
                "sgst_credit": dist["sgst_credit"],
                "cess_credit": dist["cess_credit"],
                "total_credit": dist["total_credit"],
            })
        else:
            branch_distributions.append({
                "branch_gstin": branch_gstin,
                "branch_name": branch.get("name", ""),
                "branch_state": extract_state_code(branch_gstin),
                "igst_credit": 0.0,
                "cgst_credit": 0.0,
                "sgst_credit": 0.0,
                "cess_credit": 0.0,
                "total_credit": 0.0,
            })
    
    result = {
        "gstin": isd_gstin,
        "ret_period": return_period,
        
        # Section 1: ISD Invoices
        "isd": isd_entries,
        
        # Section 2: Vendor-wise summary
        "vendor_summary": list(vendor_summary.values()),
        
        # Section 3: Distribution to branches
        "distribution": branch_distributions,
        
        # Summary
        "summary": {
            "total_invoices": len(isd_entries),
            "total_vendors": len(vendor_summary),
            "total_branches": len(branch_distributions),
            "total_taxable_value": round(total_taxable, 2),
            "total_igst": round(total_igst, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_cess": round(total_cess, 2),
            "total_credit_distributed": round(
                total_igst + total_cgst + total_sgst + total_cess, 2
            ),
            "generated_at": datetime.now().isoformat(),
        },
    }
    
    logger.info(
        f"GSTR-6 generated: {len(isd_entries)} invoices, "
        f"{len(branch_distributions)} branches, "
        f"Total credit: {total_igst + total_cgst + total_sgst + total_cess}"
    )
    
    return result


def generate_gstr6_json(
    isd_invoices: List[Dict[str, Any]],
    branch_details: List[Dict[str, Any]],
    isd_gstin: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-6 JSON payload for government filing.
    
    Args:
        isd_invoices: List of ISD invoices from service providers
        branch_details: List of branch offices
        isd_gstin: ISD's GSTIN
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-6 JSON payload
    """
    gstr6_tables = generate_gstr6_tables(
        isd_invoices, 
        branch_details, 
        isd_gstin, 
        return_period
    )
    
    gstr6_json = {
        "gstin": isd_gstin,
        "ret_period": return_period,
        "isd": [
            {
                "ctin": entry["vendor_gstin"],
                "doc_list": [
                    {
                        "doc_num": entry["invoice_number"],
                        "doc_dt": entry["invoice_date"],
                        "iv_id": entry["invoice_number"],
                        "iv_dt": entry["invoice_date"],
                        "val": entry["taxable_value"],
                        "updby": "S",  # S = ISD
                        "rt": 0,  # Rate would be calculated from items
                        "txval": entry["taxable_value"],
                        "iamt": entry["igst"],
                        "camt": entry["cgst"],
                        "samt": entry["sgst"],
                        "csamt": entry["cess"],
                    }
                ],
            }
            for entry in gstr6_tables["isd"]
        ],
        
        # Distribution summary
        "dist": gstr6_tables["distribution"],
        
        # Summary
        "summary": gstr6_tables["summary"],
        
        # Filing info
        "status": "Generated",
        "generated_at": datetime.now().isoformat(),
    }
    
    return gstr6_json


def validate_gstr6(gstr6_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate GSTR-6 data for completeness and correctness.
    
    Args:
        gstr6_data: GSTR-6 data dictionary
    
    Returns:
        Validation result dictionary
    """
    errors = []
    warnings = []
    
    # Check required fields
    if not gstr6_data.get("gstin"):
        errors.append("GSTIN is required")
    
    if not gstr6_data.get("ret_period"):
        errors.append("Return period is required")
    
    # Validate ISD invoices
    isd = gstr6_data.get("isd", [])
    if not isd:
        warnings.append("No ISD invoices found")
    
    # Check distribution totals match input credits
    summary = gstr6_data.get("summary", {})
    distribution = gstr6_data.get("dist", [])
    
    if distribution:
        dist_total_credit = sum(d.get("total_credit", 0) for d in distribution)
        input_credit = (
            summary.get("total_igst", 0) + 
            summary.get("total_cgst", 0) + 
            summary.get("total_sgst", 0) + 
            summary.get("total_cess", 0)
        )
        
        # Allow small tolerance for rounding
        if abs(dist_total_credit - input_credit) > 1:
            warnings.append(
                f"Distribution total ({dist_total_credit}) differs from "
                f"input credit ({input_credit})"
            )
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
