"""
GSTR-8 Data Aggregation Module

This module provides functions to generate GSTR-8 (Tax Collected at Source Return).

GSTR-8 is filed by e-commerce operators who collect TCS from suppliers.
TCS is collected @ 0.5% or 1% on supplies made through e-commerce platform.

Key features:
- TCS collections from e-commerce operators
- TCS liability calculation
- TCS credits for collectors (suppliers)
- TCS rates: 0.5%, 1%
- E-commerce operator details

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from india_compliance.gst_india.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# TCS rates as per GST Act
TCS_RATES = {
    "0.5": 0.5,   # 0.5% TCS (intra-state)
    "1": 1.0,     # 1% TCS (inter-state)
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
    """Format date as DD/MM/YYYY string for GSTR-8."""
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


def get_tcs_rate(tcs_rate: str) -> float:
    """Get TCS rate as float."""
    return TCS_RATES.get(str(tcs_rate), 0.5)


def calculate_tcs(
    taxable_value: float,
    tcs_rate: str = "0.5",
    is_inter_state: bool = False
) -> Dict[str, float]:
    """
    Calculate TCS amount.
    
    Args:
        taxable_value: Taxable value on which TCS is collected
        tcs_rate: TCS rate (0.5 or 1)
        is_inter_state: Whether the supply is inter-state
    
    Returns:
        Dictionary with TCS calculation
    """
    # TCS rate is 0.5% for intra-state and 1% for inter-state
    if is_inter_state:
        rate = TCS_RATES["1"]
    else:
        rate = TCS_RATES.get(str(tcs_rate), TCS_RATES["0.5"])
    
    tcs_amount = flt(taxable_value * rate / 100)
    
    return {
        "taxable_value": taxable_value,
        "tcs_rate": rate,
        "tcs_amount": tcs_amount,
    }


def process_tcs_collection(invoice: Dict[str, Any], ecom_operator_gstin: str) -> Dict[str, Any]:
    """
    Process a TCS collection entry.
    
    Args:
        invoice: Invoice data with TCS details
        ecom_operator_gstin: E-commerce operator's GSTIN
    
    Returns:
        Formatted TCS collection entry
    """
    taxable_value = flt(invoice.get("taxable_value", 0))
    
    # Determine if inter-state
    supplier_gstin = invoice.get("supplier_gstin", "")
    pos = invoice.get("place_of_supply", "")
    supplier_state = extract_state_code(supplier_gstin)
    pos_state = extract_state_code(str(pos))
    is_inter_state = supplier_state and pos_state and supplier_state != pos_state
    
    tcs_calc = calculate_tcs(taxable_value, "0.5", is_inter_state)
    
    return {
        "invoice_number": invoice.get("invoice_number", ""),
        "invoice_date": format_date_for_gstr(invoice.get("invoice_date")),
        "supplier_gstin": supplier_gstin,
        "supplier_name": invoice.get("supplier_name", ""),
        "ecom_operator_gstin": ecom_operator_gstin,
        "ecom_operator_name": invoice.get("ecom_operator_name", ""),
        "place_of_supply": pos_state,
        "is_inter_state": is_inter_state,
        "taxable_value": taxable_value,
        "tcs_rate": tcs_calc["tcs_rate"],
        "tcs_amount": tcs_calc["tcs_amount"],
    }


def aggregate_tcs_by_supplier(
    collections: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Aggregate TCS collections by supplier.
    
    Args:
        collections: List of TCS collection entries
    
    Returns:
        Dictionary keyed by supplier GSTIN
    """
    supplier_summary: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "supplier_gstin": "",
        "supplier_name": "",
        "invoice_count": 0,
        "intra_state_count": 0,
        "inter_state_count": 0,
        "intra_state_taxable": 0.0,
        "inter_state_taxable": 0.0,
        "total_taxable_value": 0.0,
        "total_tcs_amount": 0.0,
        "collections": [],
    })
    
    for collection in collections:
        supplier_gstin = collection.get("supplier_gstin", "")
        if not supplier_gstin:
            continue
        
        if supplier_gstin not in supplier_summary:
            supplier_summary[supplier_gstin] = {
                "supplier_gstin": supplier_gstin,
                "supplier_name": collection.get("supplier_name", ""),
                "invoice_count": 0,
                "intra_state_count": 0,
                "inter_state_count": 0,
                "intra_state_taxable": 0.0,
                "inter_state_taxable": 0.0,
                "total_taxable_value": 0.0,
                "total_tcs_amount": 0.0,
                "collections": [],
            }
        
        summary = supplier_summary[supplier_gstin]
        is_inter_state = collection.get("is_inter_state", False)
        
        summary["invoice_count"] += 1
        summary["total_taxable_value"] += collection.get("taxable_value", 0)
        summary["total_tcs_amount"] += collection.get("tcs_amount", 0)
        
        if is_inter_state:
            summary["inter_state_count"] += 1
            summary["inter_state_taxable"] += collection.get("taxable_value", 0)
        else:
            summary["intra_state_count"] += 1
            summary["intra_state_taxable"] += collection.get("taxable_value", 0)
        
        summary["collections"].append(collection)
    
    return supplier_summary


def generate_gstr8_tables(
    tcs_invoices: List[Dict[str, Any]],
    ecom_operator_gstin: str = "",
    ecom_operator_name: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate GSTR-8 tables from TCS collection data.
    
    Args:
        tcs_invoices: List of invoices with TCS collections
        ecom_operator_gstin: E-commerce operator's GSTIN
        ecom_operator_name: E-commerce operator's name
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-8 tables dictionary
    """
    logger.info(f"Generating GSTR-8 tables from {len(tcs_invoices)} TCS collections")
    
    # Process all TCS collections
    collections = []
    total_taxable = 0.0
    total_tcs = 0.0
    
    tcs_by_rate = {
        "0.5": {"count": 0, "taxable": 0.0, "tcs": 0.0},
        "1": {"count": 0, "taxable": 0.0, "tcs": 0.0},
    }
    
    for invoice in tcs_invoices:
        if not invoice.get("supplier_gstin"):
            continue
        
        collection = process_tcs_collection(invoice, ecom_operator_gstin)
        collections.append(collection)
        
        total_taxable += collection["taxable_value"]
        total_tcs += collection["tcs_amount"]
        
        # Aggregate by TCS rate
        rate_key = str(collection["tcs_rate"])
        if rate_key in tcs_by_rate:
            tcs_by_rate[rate_key]["count"] += 1
            tcs_by_rate[rate_key]["taxable"] += collection["taxable_value"]
            tcs_by_rate[rate_key]["tcs"] += collection["tcs_amount"]
    
    # Aggregate by supplier
    supplier_summary = aggregate_tcs_by_supplier(collections)
    
    result = {
        "gstin": ecom_operator_gstin,
        "ecom_operator_name": ecom_operator_name,
        "ret_period": return_period,
        
        # Section 1: TCS collections
        "collections": collections,
        
        # Section 2: Supplier-wise summary
        "supplier_summary": list(supplier_summary.values()),
        
        # Section 3: TCS by rate
        "tcs_by_rate": tcs_by_rate,
        
        # Summary
        "summary": {
            "total_collections": len(collections),
            "total_suppliers": len(supplier_summary),
            "total_taxable_value": round(total_taxable, 2),
            "total_tcs_amount": round(total_tcs, 2),
            "tcs_rate_0_5": {
                "count": tcs_by_rate["0.5"]["count"],
                "taxable": round(tcs_by_rate["0.5"]["taxable"], 2),
                "tcs": round(tcs_by_rate["0.5"]["tcs"], 2),
            },
            "tcs_rate_1": {
                "count": tcs_by_rate["1"]["count"],
                "taxable": round(tcs_by_rate["1"]["taxable"], 2),
                "tcs": round(tcs_by_rate["1"]["tcs"], 2),
            },
            "generated_at": datetime.now().isoformat(),
        },
    }
    
    logger.info(
        f"GSTR-8 generated: {len(collections)} collections, "
        f"Taxable: {total_taxable}, TCS: {total_tcs}"
    )
    
    return result


def generate_gstr8_json(
    tcs_invoices: List[Dict[str, Any]],
    ecom_operator_gstin: str = "",
    ecom_operator_name: str = "",
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-8 JSON payload for government filing.
    
    Args:
        tcs_invoices: List of TCS collection entries
        ecom_operator_gstin: E-commerce operator's GSTIN
        ecom_operator_name: E-commerce operator's name
        return_period: Return period (MMYYYY)
    
    Returns:
        GSTR-8 JSON payload
    """
    gstr8_tables = generate_gstr8_tables(
        tcs_invoices,
        ecom_operator_gstin,
        ecom_operator_name,
        return_period
    )
    
    # Build GSTN-compliant JSON
    gstr8_json = {
        "gstin": ecom_operator_gstin,
        "ret_period": return_period,
        "ecom_operator_name": ecom_operator_name,
        
        # TCS by supplier
        "b2b": [
            {
                "ctin": supplier["supplier_gstin"],
                "supplier_name": supplier["supplier_name"],
                "doc_list": [
                    {
                        "doc_num": c["invoice_number"],
                        "doc_dt": c["invoice_date"],
                        "rt": c["tcs_rate"],
                        "txval": c["taxable_value"],
                        "tcs": c["tcs_amount"],
                    }
                    for c in supplier["collections"]
                ],
                "total": {
                    "txval": supplier["total_taxable_value"],
                    "tcs": supplier["total_tcs_amount"],
                },
            }
            for supplier in gstr8_tables["supplier_summary"]
        ],
        
        # Summary
        "summary": gstr8_tables["summary"],
        
        # Filing info
        "status": "Generated",
        "generated_at": datetime.now().isoformat(),
    }
    
    return gstr8_json


def validate_gstr8(gstr8_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate GSTR-8 data for completeness and correctness.
    
    Args:
        gstr8_data: GSTR-8 data dictionary
    
    Returns:
        Validation result dictionary
    """
    errors = []
    warnings = []
    
    # Check required fields
    if not gstr8_data.get("gstin"):
        errors.append("GSTIN is required")
    
    if not gstr8_data.get("ret_period"):
        errors.append("Return period is required")
    
    # Validate collections
    collections = gstr8_data.get("collections", [])
    if not collections:
        warnings.append("No TCS collections found")
    
    # Check TCS rate values
    valid_rates = ["0.5", "1"]
    for collection in collections:
        rate = str(collection.get("tcs_rate", 0))
        if rate not in valid_rates:
            errors.append(f"Invalid TCS rate: {rate}")
    
    # Check for negative values
    summary = gstr8_data.get("summary", {})
    total_taxable = summary.get("total_taxable_value", 0)
    total_tcs = summary.get("total_tcs_amount", 0)
    
    if total_taxable < 0:
        errors.append("Total taxable value cannot be negative")
    
    if total_tcs < 0:
        errors.append("Total TCS amount cannot be negative")
    
    # Verify TCS calculation (should not exceed 1%)
    if total_tcs > total_taxable * 0.01:
        warnings.append(
            f"TCS amount ({total_tcs}) seems high for taxable value ({total_taxable})"
        )
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
