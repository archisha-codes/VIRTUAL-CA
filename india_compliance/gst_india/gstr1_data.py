"""
GSTR-1 Data Aggregation Module

This module provides functions to convert validated sales data into GSTR-1 schema
with proper classification logic for B2B, B2CL, B2CS, Export, CDNR, HSN, and Docs tables.

Compatible with FastAPI and does not depend on frappe/ERPNext.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

from india_compliance.gst_india.utils.logger import get_logger
from india_compliance.gst_india.utils.gstr_1 import (
    GSTR1_Category,
    GSTR1_SubCategory,
    GSTR1_B2B_InvoiceType,
    GovDataField,
    get_b2c_limit,
    getdate,
)

# Initialize logger
logger = get_logger(__name__)


def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    return round(float(value), precision)


def cint(value: Any) -> int:
    """Convert value to integer."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def get_company_state_from_gstin(company_gstin: str) -> str:
    """Extract state code from GSTIN (first 2 digits)."""
    if company_gstin and len(company_gstin) >= 2:
        return company_gstin[:2]
    return ""


def extract_state_code(pos: Any) -> str:
    """Extract 2-digit state code from Place of Supply."""
    if not pos:
        return ""
    
    pos_str = str(pos).strip()
    
    # Already a 2-digit code
    if len(pos_str) == 2 and pos_str.isdigit():
        return pos_str
    
    # Extract from format like "27-Gujarat"
    if "-" in pos_str:
        code = pos_str.split("-")[0].strip()
        if len(code) == 2 and code.isdigit():
            return code
    
    # Try to find 2-digit number
    import re
    match = re.match(r"^(\d{2})", pos_str)
    if match:
        return match.group(1)
    
    return ""


def is_inter_state(company_gstin: str, pos: Any) -> bool:
    """Check if transaction is inter-state based on company GSTIN and Place of Supply."""
    company_state = get_company_state_from_gstin(company_gstin)
    pos_state = extract_state_code(pos)
    
    if not company_state or not pos_state:
        return False
    
    return company_state != pos_state


def get_invoice_category(row: Dict[str, Any], company_gstin: str = "") -> Tuple[str, Optional[str]]:
    """
    Determine GSTR-1 category and sub-category for a row.
    
    Returns:
        Tuple of (category, sub_category)
    """
    gstin = row.get("gstin", "") or ""
    pos = row.get("place_of_supply", "")
    invoice_value = flt(row.get("invoice_value", 0))
    is_return = row.get("is_return", False)
    is_debit_note = row.get("is_debit_note", False)
    gst_category = row.get("gst_category", "")
    is_reverse_charge = row.get("reverse_charge", False)
    
    # Nil-rated, exempted, non-GST check
    gst_treatment = row.get("gst_treatment", "")
    if gst_treatment in ("Nil-Rated", "Exempted", "Non-GST"):
        return (GSTR1_Category.NIL_EXEMPT.value, GSTR1_SubCategory.NIL_EXEMPT.value)
    
    # Get invoice date for B2C limit calculation
    invoice_date = row.get("invoice_date")
    
    # Check if export
    if pos == "96-Other Countries" or gst_category == "Overseas":
        if gst_category == "Deemed Export":
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
        return (GSTR1_Category.EXP.value, GSTR1_SubCategory.EXPWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.EXPWOP.value)
    
    # Check for credit/debit notes
    if is_return or is_debit_note:
        if gstin:
            # Registered recipient
            if gst_category == "Deemed Export":
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
            elif gst_category == "SEZ":
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.SEZWOP.value)
            elif is_reverse_charge:
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REVERSE_CHARGE.value)
            return (GSTR1_Category.CDNR.value, GSTR1_SubCategory.CDNR.value)
        else:
            # Unregistered recipient
            if pos == "96-Other Countries":
                return (GSTR1_Category.EXP.value, GSTR1_SubCategory.EXPWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.EXPWOP.value)
            
            # Get B2C limit - use a default date if invoice_date is None
            limit_date = invoice_date if invoice_date else datetime.now().date()
            b2c_limit = get_b2c_limit(limit_date)
            if invoice_value > b2c_limit and is_inter_state(company_gstin, pos):
                return (GSTR1_Category.B2CL.value, GSTR1_SubCategory.B2CL.value)
            
            return (GSTR1_Category.CDNUR.value, GSTR1_SubCategory.CDNUR.value)
    
    # Regular invoices
    if gstin:
        # B2B (registered)
        if gst_category == "Deemed Export":
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
        elif gst_category == "SEZ":
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.SEZWOP.value)
        elif is_reverse_charge:
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REVERSE_CHARGE.value)
        return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REGULAR.value)
    else:
        # Unregistered
        if pos == "96-Other Countries":
            return (GSTR1_Category.EXP.value, GSTR1_SubCategory.EXPWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.EXPWOP.value)
        
        # Get B2C limit - use a default date if invoice_date is None
        limit_date = invoice_date if invoice_date else datetime.now().date()
        b2c_limit = get_b2c_limit(limit_date)
        if invoice_value > b2c_limit and is_inter_state(company_gstin, pos):
            return (GSTR1_Category.B2CL.value, GSTR1_SubCategory.B2CL.value)
        
        return (GSTR1_Category.B2CS.value, GSTR1_SubCategory.B2CS.value)


def format_date_for_gstr(date_val: Any) -> str:
    """Format date as DD/MM/YYYY string for GSTR-1."""
    if not date_val:
        return ""
    
    if isinstance(date_val, datetime):
        return date_val.strftime("%d/%m/%Y")
    elif isinstance(date_val, str):
        # Try to parse and format
        try:
            parsed = datetime.fromisoformat(date_val.replace("/", "-").replace(" ", ""))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return date_val
    
    return ""


def format_invoice_for_b2b(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2B table."""
    return {
        GovDataField.CUST_GSTIN: row.get("gstin", ""),
        "customer_name": row.get("customer_name", ""),
        "invoice_number": row.get("invoice_number", ""),
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        GovDataField.DOC_VALUE: flt(row.get("invoice_value")),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        GovDataField.REVERSE_CHARGE: "Y" if row.get("reverse_charge") else "N",
        GovDataField.INVOICE_TYPE: row.get("invoice_type", "Regular"),
        GovDataField.ITEMS: [
            {
                GovDataField.TAXABLE_VALUE: flt(row.get("taxable_value")),
                GovDataField.IGST: flt(row.get("igst", 0)),
                GovDataField.CGST: flt(row.get("cgst", 0)),
                GovDataField.SGST: flt(row.get("sgst", 0)),
                GovDataField.CESS: flt(row.get("cess", 0)),
                GovDataField.TAX_RATE: flt(row.get("rate", 0)),
            }
        ],
    }


def format_invoice_for_b2cl(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2CL table."""
    return {
        "invoice_number": row.get("invoice_number", ""),
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        GovDataField.DOC_VALUE: flt(row.get("invoice_value")),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        GovDataField.TAXABLE_VALUE: flt(row.get("taxable_value")),
        GovDataField.TAX_RATE: flt(row.get("rate", 0)),
        GovDataField.IGST: flt(row.get("igst", 0)),
        GovDataField.CESS: flt(row.get("cess", 0)),
    }


def format_invoice_for_b2cs(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2CS table."""
    return {
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        GovDataField.TAXABLE_VALUE: flt(row.get("taxable_value")),
        GovDataField.TAX_RATE: flt(row.get("rate", 0)),
        GovDataField.IGST: flt(row.get("igst", 0)),
        GovDataField.CESS: flt(row.get("cess", 0)),
    }


def format_invoice_for_exp(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for Export table."""
    return {
        "invoice_number": row.get("invoice_number", ""),
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        GovDataField.DOC_VALUE: flt(row.get("invoice_value")),
        GovDataField.SHIPPING_PORT_CODE: row.get("port_code", ""),
        GovDataField.SHIPPING_BILL_NUMBER: row.get("shipping_bill_number", ""),
        GovDataField.SHIPPING_BILL_DATE: format_date_for_gstr(row.get("shipping_bill_date")),
        GovDataField.TAXABLE_VALUE: flt(row.get("taxable_value")),
        GovDataField.TAX_RATE: flt(row.get("rate", 0)),
        GovDataField.IGST: flt(row.get("igst", 0)),
        GovDataField.CESS: flt(row.get("cess", 0)),
        GovDataField.EXPORT_TYPE: "WPAY" if row.get("is_export_with_gst") else "WOPAY",
    }


def format_invoice_for_cdnr(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for CDNR table (Credit/Debit Notes - Registered)."""
    return {
        GovDataField.CUST_GSTIN: row.get("gstin", ""),
        "customer_name": row.get("customer_name", ""),
        "note_number": row.get("note_number", row.get("invoice_number", "")),
        GovDataField.NOTE_DATE: format_date_for_gstr(row.get("note_date", row.get("invoice_date"))),
        GovDataField.NOTE_TYPE: "C" if row.get("is_return") else "D",
        GovDataField.DOC_VALUE: flt(row.get("note_value", row.get("invoice_value", 0))),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        GovDataField.REVERSE_CHARGE: "Y" if row.get("reverse_charge") else "N",
        GovDataField.INVOICE_TYPE: row.get("invoice_type", "Regular"),
        GovDataField.ITEMS: [
            {
                GovDataField.TAXABLE_VALUE: flt(row.get("taxable_value")),
                GovDataField.IGST: flt(row.get("igst", 0)),
                GovDataField.CGST: flt(row.get("cgst", 0)),
                GovDataField.SGST: flt(row.get("sgst", 0)),
                GovDataField.CESS: flt(row.get("cess", 0)),
                GovDataField.TAX_RATE: flt(row.get("rate", 0)),
            }
        ],
    }


def aggregate_hsn_summary(clean_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Aggregate data by HSN code for HSN summary table.
    
    Returns list of aggregated HSN records with quantities and values.
    """
    hsn_aggregation: Dict[Tuple[str, str], Dict[str, Any]] = {}
    
    for row in clean_data:
        hsn_code = str(row.get("hsn_code", row.get("gst_hsn_code", ""))).strip()
        if not hsn_code:
            continue
        
        uom = row.get("uom", "")
        rate = flt(row.get("rate", 0))
        
        key = (hsn_code, uom)
        
        if key not in hsn_aggregation:
            hsn_aggregation[key] = {
                "hsn_code": hsn_code,
                "description": row.get("description", ""),
                "uom": uom,
                "quantity": 0.0,
                "total_value": 0.0,
                "taxable_value": 0.0,
                "igst": 0.0,
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": 0.0,
            }
        
        agg = hsn_aggregation[key]
        agg["quantity"] += flt(row.get("quantity", 0))
        agg["total_value"] += flt(row.get("total_value", row.get("invoice_value", 0)))
        agg["taxable_value"] += flt(row.get("taxable_value", 0))
        agg["igst"] += flt(row.get("igst", 0))
        agg["cgst"] += flt(row.get("cgst", 0))
        agg["sgst"] += flt(row.get("sgst", 0))
        agg["cess"] += flt(row.get("cess", 0))
    
    # Format for GSTR-1
    hsn_records = []
    for key, agg in sorted(hsn_aggregation.items()):
        hsn_records.append({
            GovDataField.HSN_CODE: agg["hsn_code"],
            "description": agg["description"],
            GovDataField.UOM: agg["uom"],
            GovDataField.QUANTITY: flt(agg["quantity"]),
            GovDataField.SUPPLY_TYPE: "Inter-State" if agg["igst"] > 0 else "Intra-State",
            GovDataField.NET_TAXABLE_VALUE: flt(agg["taxable_value"]),
            GovDataField.IGST: flt(agg["igst"]),
            GovDataField.CGST: flt(agg["cgst"]),
            GovDataField.SGST: flt(agg["sgst"]),
            GovDataField.CESS: flt(agg["cess"]),
            GovDataField.TAX_RATE: flt(row.get("rate", 0)),
        })
    
    return hsn_records


def generate_gstr1_tables(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    include_hsn: bool = True,
    include_docs: bool = False,
) -> Dict[str, Any]:
    """
    Convert validated clean_data into GSTR-1 schema tables.
    
    Args:
        clean_data: List of validated invoice records from processor.py
        company_gstin: Company's GSTIN for inter-state determination
        include_hsn: Whether to generate HSN summary
        include_docs: Whether to generate document summary
    
    Returns:
        Dictionary with GSTR-1 tables:
        - b2b: List of B2B invoices
        - b2cl: List of B2CL invoices  
        - b2cs: List of B2CS entries
        - exp: List of export invoices
        - cdnr: List of credit/debit notes (registered)
        - cdnur: List of credit/debit notes (unregistered)
        - hsn: HSN summary (if include_hsn=True)
        - docs: Document summary (if include_docs=True)
        - summary: Totals and counts
    """
    if not clean_data:
        logger.warning("No clean_data provided to generate_gstr1_tables")
        return {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "exp": [],
            "cdnr": [],
            "cdnur": [],
            "summary": {
                "total_records": 0,
                "total_taxable_value": 0,
                "total_igst": 0,
                "total_cgst": 0,
                "total_sgst": 0,
                "total_cess": 0,
            }
        }
    
    logger.info(f"Generating GSTR-1 tables from {len(clean_data)} records, company_gstin: {company_gstin}")
    
    # Initialize tables
    b2b_invoices: Dict[str, Dict[str, Any]] = {}
    b2cl_invoices: List[Dict[str, Any]] = []
    b2cs_invoices: List[Dict[str, Any]] = []
    exp_invoices: List[Dict[str, Any]] = []
    cdnr_invoices: Dict[str, Dict[str, Any]] = {}
    cdnur_invoices: List[Dict[str, Any]] = []
    
    # Track totals
    total_taxable = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    total_invoices = 0
    
    for row in clean_data:
        invoice_value = flt(row.get("invoice_value", 0))
        taxable_value = flt(row.get("taxable_value", 0))
        igst_amount = flt(row.get("igst", 0))
        cgst_amount = flt(row.get("cgst", 0))
        sgst_amount = flt(row.get("sgst", 0))
        cess_amount = flt(row.get("cess", 0))
        
        # Update totals
        total_taxable += taxable_value
        total_igst += igst_amount
        total_cgst += cgst_amount
        total_sgst += sgst_amount
        total_cess += cess_amount
        total_invoices += 1
        
        # Get category
        category, sub_category = get_invoice_category(row, company_gstin)
        
        # Group by GSTIN for B2B and CDNR (multiple invoices per GSTIN)
        gstin = row.get("gstin", "") or ""
        invoice_key = f"{gstin}_{row.get('invoice_number', '')}"
        
        if category == GSTR1_Category.B2B.value:
            if gstin not in b2b_invoices:
                b2b_invoices[gstin] = {
                    "ctin": gstin,
                    "customer_name": row.get("customer_name", ""),
                    "invoices": [],
                }
            
            b2b_invoices[gstin]["invoices"].append(format_invoice_for_b2b(row))
        
        elif category == GSTR1_Category.B2CL.value:
            b2cl_invoices.append(format_invoice_for_b2cl(row))
        
        elif category == GSTR1_Category.B2CS.value:
            b2cs_invoices.append(format_invoice_for_b2cs(row))
        
        elif category == GSTR1_Category.EXP.value:
            exp_invoices.append(format_invoice_for_exp(row))
        
        elif category == GSTR1_Category.CDNR.value:
            if gstin not in cdnr_invoices:
                cdnr_invoices[gstin] = {
                    "ctin": gstin,
                    "customer_name": row.get("customer_name", ""),
                    "notes": [],
                }
            
            cdnr_invoices[gstin]["notes"].append(format_invoice_for_cdnr(row))
        
        elif category == GSTR1_Category.CDNUR.value:
            cdnur_invoices.append({
                "note_number": row.get("note_number", row.get("invoice_number", "")),
                GovDataField.NOTE_DATE: format_date_for_gstr(row.get("note_date", row.get("invoice_date"))),
                GovDataField.NOTE_TYPE: "C" if row.get("is_return") else "D",
                GovDataField.DOC_VALUE: flt(row.get("note_value", row.get("invoice_value", 0))),
                GovDataField.POS: extract_state_code(row.get("place_of_supply")),
                GovDataField.TAXABLE_VALUE: taxable_value,
                GovDataField.TAX_RATE: flt(row.get("rate", 0)),
                GovDataField.IGST: igst_amount,
                GovDataField.CESS: cess_amount,
            })
        
        # Handle nil-exempt separately (no taxable value)
        elif category == GSTR1_Category.NIL_EXEMPT.value:
            # These are tracked separately, not in main tables
            pass
    
    # Build result
    result = {
        "b2b": list(b2b_invoices.values()),
        "b2cl": b2cl_invoices,
        "b2cs": b2cs_invoices,
        "exp": exp_invoices,
        "cdnr": list(cdnr_invoices.values()),
        "cdnur": cdnur_invoices,
        "summary": {
            "total_records": total_invoices,
            "total_taxable_value": round(total_taxable, 2),
            "total_igst": round(total_igst, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_cess": round(total_cess, 2),
        }
    }
    
    # Add HSN summary if requested
    if include_hsn:
        result["hsn"] = aggregate_hsn_summary(clean_data)
    
    # Add document summary if requested
    if include_docs:
        result["docs"] = generate_document_summary(clean_data)
    
    # Log summary
    logger.info(
        f"GSTR-1 tables generated: "
        f"{len(result['b2b'])} B2B entities, "
        f"{len(result['b2cl'])} B2CL invoices, "
        f"{len(result['b2cs'])} B2CS entries, "
        f"{len(result['exp'])} exports, "
        f"{len(result['cdnr'])} CDNR entities"
    )
    
    return result


def generate_document_summary(clean_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate document issue summary for GSTR-1.
    
    Counts invoices by nature of document.
    """
    document_counts = {
        "Invoices for outward supply": 0,
        "Invoices for inward supply from unregistered person": 0,
        "Debit Note": 0,
        "Credit Note": 0,
        "Delivery Challan for job work": 0,
    }
    
    for row in clean_data:
        is_return = row.get("is_return", False)
        is_debit_note = row.get("is_debit_note", False)
        
        if is_return:
            document_counts["Credit Note"] += 1
        elif is_debit_note:
            document_counts["Debit Note"] += 1
        else:
            if row.get("place_of_supply") == "96-Other Countries":
                document_counts["Invoices for outward supply"] += 1
            else:
                document_counts["Invoices for outward supply"] += 1
    
    return {
        "document_summary": document_counts,
        "total_documents": sum(document_counts.values()),
    }


def generate_gstr1_json(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    return_period: str = "",
    gstin: str = "",
    username: str = "",
) -> Dict[str, Any]:
    """
    Generate complete GSTR-1 JSON payload for government filing.
    
    Args:
        clean_data: Validated invoice data from processor.py
        company_gstin: Company's GSTIN
        return_period: Return period in MMYYYY format
        gstin: GSTIN of the taxpayer
        username: Username of the taxpayer
    
    Returns:
        Complete GSTR-1 JSON structure ready for filing
    """
    gstr1_tables = generate_gstr1_tables(clean_data, company_gstin)
    
    # Build complete GSTR-1 JSON
    gstr1_json = {
        "gstin": gstin,
        "ret_period": return_period,
        "username": username,
        "fp": return_period,
        "gt": 0.0,
        "cur_gt": 0.0,
        "b2b": gstr1_tables["b2b"],
        "b2cl": gstr1_tables["b2cl"],
        "b2cs": gstr1_tables["b2cs"],
        "exp": gstr1_tables["exp"],
        "cdnr": gstr1_tables["cdnr"],
        "cdnur": gstr1_tables["cdnur"],
        "at": [],
        "txpd": [],
        "hsn": gstr1_tables.get("hsn", []),
        "doc_issue": gstr1_tables.get("docs", {}),
        "sup_ecom": [],
        "nil_exemp": {
            "inv": [],
            "expt_amt": 0.0,
            "nil_amt": 0.0,
            "ngsup_amt": 0.0,
        },
        "txnval": gstr1_tables["summary"]["total_taxable_value"],
        "iamt": gstr1_tables["summary"]["total_igst"],
        "camt": gstr1_tables["summary"]["total_cgst"],
        "samt": gstr1_tables["summary"]["total_sgst"],
        "csamt": gstr1_tables["summary"]["total_cess"],
    }
    
    logger.info(f"Generated GSTR-1 JSON with {len(gstr1_json['b2b'])} B2B entries, "
                f"{len(gstr1_json['b2cl'])} B2CL entries, "
                f"{len(gstr1_json['b2cs'])} B2CS entries")
    
    return gstr1_json
