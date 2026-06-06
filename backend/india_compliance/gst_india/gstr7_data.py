"""
GSTR-7 Data Aggregation Module

This module provides functions to generate GSTR-7 (Tax Deducted at Source Return).

GSTR-7 is filed by deductor (person responsible for deducting TDS under GST).
TDS is deducted @ 1%, 2%, 5% or 10% on payments made to suppliers.

Key features:
- TDS declarations
- TDS liability calculation
- TDS credits received by deductees
- TDS deduction details (supplier-wise, invoice-wise)
- TDS rates: 1%, 2%, 5%, 10%

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from india_compliance.gst_india.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# TDS rates as per GST Act
TDS_RATES = {
    "1": 1.0,    # 1% TDS
    "2": 2.0,    # 2% TDS
    "5": 5.0,    # 5% TDS
    "10": 10.0,  # 10% TDS
}


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
    """Format date as DD/MM/YYYY string for GSTR-7."""
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


def get_tds_rate(tds_rate: str) -> float:
    """Get TDS rate as float."""
    return TDS_RATES.get(str(tds_rate), 0.0)


def calculate_tds(
    taxable_value: float,
    tds_rate: str = "1"
) -> Dict[str, float]:
    """
    Calculate TDS amount.
    
    Args:
        taxable_value: Taxable value on which TDS is deducted
        tds_rate: TDS rate (1, 2, 5, or 10)
    
    Returns:
        Dictionary with TDS calculation
    """
    rate = get_tds_rate(tds_rate)
    tds_amount = flt(taxable_value * rate / 100)
    
    return {
        "taxable_value": taxable_value,
        "tds_rate": rate,
        "tds_amount": tds_amount,
    }


def process_tds_deduction(invoice: Dict[str, Any], deductor_gstin: str) -> Dict[str, Any]:
    """
    Process a TDS deduction entry.
    
    Args:
        invoice: Invoice data with TDS details
        deductor_gstin: Deductor's GSTIN
    
    Returns:
        Formatted TDS deduction entry
    """
    taxable_value = flt(invoice.get("taxable_value", 0))
    tds_rate = str(invoice.get("tds_rate", "1"))
    
    tds_calc = calculate_tds(taxable_value, tds_rate)
    
    return {
        "invoice_number": invoice.get("invoice_number", ""),
        "invoice_date": format_date_for_gstr(invoice.get("invoice_date")),
        "supplier_gstin": invoice.get("supplier_gstin", ""),
        "supplier_name": invoice.get("supplier_name", ""),
        "deductor_gstin": deductor_gstin,
        "deductee_gstin": invoice.get("supplier_gstin", ""),  # Supplier is the deductee
        "taxable_value": taxable_value,
        "tds_rate": tds_calc["tds_rate"],
        "tds_amount": tds_calc["tds_amount"],
        "pos": invoice.get("place_of_supply", ""),
    }


def aggregate_tds_by_supplier(
    deductions: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Aggregate TDS deductions by supplier (deductee).
    
    Args:
        deductions: List of TDS deduction entries
    
    Returns:
        Dictionary keyed by supplier GSTIN
    """
    supplier_summary: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "supplier_gstin": "",
        "supplier_name": "",
        "invoice_count": 0,
        "total_taxable_value": 0.0,
        "total_tds_amount": 0.0,
        "deductions": [],
    })
    
    for deduction in deductions:
        supplier_gstin = deduction.get("supplier_gstin", "")
        if not supplier_gstin:
            continue
        
        if supplier_gstin not in supplier_summary:
            supplier_summary[supplier_gstin] = {
                "supplier_gstin": supplier_gstin,
                "supplier_name": deduction.get("supplier_name", ""),
                "invoice_count": 0,
                "total_taxable_value": 0.0,
                "total_tds_amount": 0.0,
                "deductions": [],
            }
        
        supplier_summary[supplier_gstin]["invoice_count"] += 1
        supplier_summary[supplier_gstin]["total_taxable_value"] += deduction.get("taxable_value", 0)
        supplier_summary[supplier_gstin]["total_tds_amount"] += deduction.get("tds_amount", 0)
        supplier_summary[supplier_gstin]["deductions"].append(deduction)
    
    return supplier_summary


def generate_gstr7_tables(
    tds_invoices: List[Dict[str, Any]],
    deductor_gstin: str = "",
    deductor_name: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate GSTR-7 tables from TDS deduction data.
    
    Args:
        tds_invoices: List of invoices with TDS deductions
        deductor_gstin: Deductor's GSTIN
        deductor_name: Deductor's name
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-7 tables dictionary
    """
    logger.info(f"Generating GSTR-7 tables from {len(tds_invoices)} TDS deductions")
    
    # Process all TDS deductions
    deductions = []
    total_taxable = 0.0
    total_tds = 0.0
    
    tds_by_rate = {
        "1": {"count": 0, "taxable": 0.0, "tds": 0.0},
        "2": {"count": 0, "taxable": 0.0, "tds": 0.0},
        "5": {"count": 0, "taxable": 0.0, "tds": 0.0},
        "10": {"count": 0, "taxable": 0.0, "tds": 0.0},
    }
    
    for invoice in tds_invoices:
        if not invoice.get("supplier_gstin"):
            continue
        
        deduction = process_tds_deduction(invoice, deductor_gstin)
        deductions.append(deduction)
        
        total_taxable += deduction["taxable_value"]
        total_tds += deduction["tds_amount"]
        
        # Aggregate by TDS rate
        rate_key = str(int(deduction["tds_rate"]))
        if rate_key in tds_by_rate:
            tds_by_rate[rate_key]["count"] += 1
            tds_by_rate[rate_key]["taxable"] += deduction["taxable_value"]
            tds_by_rate[rate_key]["tds"] += deduction["tds_amount"]
    
    # Aggregate by supplier
    supplier_summary = aggregate_tds_by_supplier(deductions)
    
    result = {
        "gstin": deductor_gstin,
        "deductor_name": deductor_name,
        "ret_period": return_period,
        
        # Section 1: TDS deductions
        "deductions": deductions,
        
        # Section 2: Supplier-wise summary
        "supplier_summary": list(supplier_summary.values()),
        
        # Section 3: TDS by rate
        "tds_by_rate": tds_by_rate,
        
        # Summary
        "summary": {
            "total_deductions": len(deductions),
            "total_suppliers": len(supplier_summary),
            "total_taxable_value": round(total_taxable, 2),
            "total_tds_amount": round(total_tds, 2),
            "tds_rate_1": {
                "count": tds_by_rate["1"]["count"],
                "taxable": round(tds_by_rate["1"]["taxable"], 2),
                "tds": round(tds_by_rate["1"]["tds"], 2),
            },
            "tds_rate_2": {
                "count": tds_by_rate["2"]["count"],
                "taxable": round(tds_by_rate["2"]["taxable"], 2),
                "tds": round(tds_by_rate["2"]["tds"], 2),
            },
            "tds_rate_5": {
                "count": tds_by_rate["5"]["count"],
                "taxable": round(tds_by_rate["5"]["taxable"], 2),
                "tds": round(tds_by_rate["5"]["tds"], 2),
            },
            "tds_rate_10": {
                "count": tds_by_rate["10"]["count"],
                "taxable": round(tds_by_rate["10"]["taxable"], 2),
                "tds": round(tds_by_rate["10"]["tds"], 2),
            },
            "generated_at": datetime.now().isoformat(),
        },
    }
    
    logger.info(
        f"GSTR-7 generated: {len(deductions)} deductions, "
        f"Taxable: {total_taxable}, TDS: {total_tds}"
    )
    
    return result


def generate_gstr7_json(
    tds_invoices: List[Dict[str, Any]],
    deductor_gstin: str = "",
    deductor_name: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-7 JSON payload for government filing.
    
    Args:
        tds_invoices: List of TDS deduction entries
        deductor_gstin: Deductor's GSTIN
        deductor_name: Deductor's name
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-7 JSON payload
    """
    gstr7_tables = generate_gstr7_tables(
        tds_invoices,
        deductor_gstin,
        deductor_name,
        return_period
    )
    
    # Build GSTN-compliant JSON
    gstr7_json = {
        "gstin": deductor_gstin,
        "ret_period": return_period,
        "deductor_name": deductor_name,
        
        # TDS by supplier
        "b2b": [
            {
                "ctin": supplier["supplier_gstin"],
                "supplier_name": supplier["supplier_name"],
                "doc_list": [
                    {
                        "doc_num": d["invoice_number"],
                        "doc_dt": d["invoice_date"],
                        " TDS_exempted": "N",
                        "rt": d["tds_rate"],
                        "txval": d["taxable_value"],
                        "tds": d["tds_amount"],
                    }
                    for d in supplier["deductions"]
                ],
                "total": {
                    "txval": supplier["total_taxable_value"],
                    "tds": supplier["total_tds_amount"],
                },
            }
            for supplier in gstr7_tables["supplier_summary"]
        ],
        
        # Summary
        "summary": gstr7_tables["summary"],
        
        # Filing info
        "status": "Generated",
        "generated_at": datetime.now().isoformat(),
    }
    
    return gstr7_json


def validate_gstr7(gstr7_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate GSTR-7 data for completeness and correctness.
    
    Args:
        gstr7_data: GSTR-7 data dictionary
    
    Returns:
        Validation result dictionary
    """
    errors = []
    warnings = []
    
    # Check required fields
    if not gstr7_data.get("gstin"):
        errors.append("GSTIN is required")
    
    if not gstr7_data.get("ret_period"):
        errors.append("Return period is required")
    
    # Validate deductions
    deductions = gstr7_data.get("deductions", [])
    if not deductions:
        warnings.append("No TDS deductions found")
    
    # Check TDS rate values
    valid_rates = ["1", "2", "5", "10"]
    for deduction in deductions:
        rate = str(int(deduction.get("tds_rate", 0)))
        if rate not in valid_rates:
            errors.append(f"Invalid TDS rate: {rate}")
    
    # Check for negative values
    summary = gstr7_data.get("summary", {})
    total_taxable = summary.get("total_taxable_value", 0)
    total_tds = summary.get("total_tds_amount", 0)
    
    if total_taxable < 0:
        errors.append("Total taxable value cannot be negative")
    
    if total_tds < 0:
        errors.append("Total TDS amount cannot be negative")
    
    # Verify TDS calculation
    expected_tds = total_taxable * 0.01  # Approximate, actual rates vary
    if total_tds > total_taxable:
        errors.append("TDS amount cannot exceed taxable value")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
