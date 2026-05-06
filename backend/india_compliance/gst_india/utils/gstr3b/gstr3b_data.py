import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from decimal import Decimal
from models.gst_models import GSTR1_Document, GSTR2B_Document
from uuid import UUID

logger = logging.getLogger("gstr3b_data")

def get_db_invoice_totals(db: Session, business_id: UUID, return_period: str, document_types: List[str], exclude_nil: bool = False):
    """
    Helper to aggregate totals from GSTR1_Document table for specific document types.
    """
    query = db.query(
        func.sum(GSTR1_Document.taxable_value).label("taxable_value"),
        func.sum(GSTR1_Document.igst).label("igst_amount"),
        func.sum(GSTR1_Document.cgst).label("cgst_amount"),
        func.sum(GSTR1_Document.sgst).label("sgst_amount"),
        func.sum(GSTR1_Document.cess).label("cess_amount")
    ).filter(
        GSTR1_Document.business_id == business_id,
        GSTR1_Document.return_period == return_period,
        GSTR1_Document.document_type.in_(document_types)
    )

    if exclude_nil:
        # Exclude records where taxable value is > 0 but tax is 0 (Nil/Exempt)
        # Note: In a real scenario, we might have a specific flag, 
        # but here we follow the "rate is 0" logic.
        # Since we don't store 'rate' in the simplified model, we use the sum of taxes as a proxy
        # or we assume document_type already helps.
        # However, the user mentioned "excluding 0% rate". 
        # Let's assume for this logic that if igst+cgst+sgst == 0, it's nil rated.
        query = query.filter((GSTR1_Document.igst + GSTR1_Document.cgst + GSTR1_Document.sgst) > 0)

    result = query.one()
    
    # Return rounded values, default to 0.00 if None, ensure non-negative
    def clean(val):
        d = Decimal(str(val or "0.00"))
        return float(max(Decimal("0.00"), d).quantize(Decimal("0.00")))

    return {
        "taxable_value": clean(result.taxable_value),
        "igst_amount": clean(result.igst_amount),
        "cgst_amount": clean(result.cgst_amount),
        "sgst_amount": clean(result.sgst_amount),
        "cess_amount": clean(result.cess_amount)
    }

def fetch_gstr2b_summary(db: Session, business_id: UUID, return_period: str) -> Dict[str, Any]:
    """
    Queries GSTR2B_Document table to calculate ITC summary for Table 4.
    """
    # All other ITC (4A5)
    itc_query = db.query(
        func.sum(GSTR2B_Document.igst).label("igst"),
        func.sum(GSTR2B_Document.cgst).label("cgst"),
        func.sum(GSTR2B_Document.sgst).label("sgst"),
        func.sum(GSTR2B_Document.cess).label("cess")
    ).filter(
        GSTR2B_Document.business_id == business_id,
        GSTR2B_Document.return_period == return_period,
        GSTR2B_Document.itc_available == True
    ).one()

    def clean(val):
        d = Decimal(str(val or "0.00"))
        return float(max(Decimal("0.00"), d).quantize(Decimal("0.00")))

    return {
        "itc_igst": clean(itc_query.igst),
        "itc_cgst": clean(itc_query.cgst),
        "itc_sgst": clean(itc_query.sgst),
        "itc_cess": clean(itc_query.cess)
    }

def generate_gstr3b_summary(db: Session, business_id: UUID, return_period: str) -> Dict[str, Any]:
    """
    Database-driven GSTR-3B summary generation.
    Queries PostgreSQL for GSTR-1 and GSTR-2B documents to auto-populate Table 3.1 and Table 4.
    """
    logger.info(f"Generating GSTR-3B summary for Business ID: {business_id}, Period: {return_period}")

    # Table 3.1(a): Outward taxable supplies (other than zero rated, nil rated and exempted)
    # Includes B2B, B2CL, B2CS, CDNR, CDNUR where tax > 0
    t31a = get_db_invoice_totals(db, business_id, return_period, ["B2B", "B2CL", "B2CS", "CDNR", "CDNUR"], exclude_nil=True)

    # Table 3.1(b): Outward taxable supplies (zero rated) - Exports
    t31b = get_db_invoice_totals(db, business_id, return_period, ["EXP"])

    # Table 3.1(c): Other outward supplies (Nil rated, exempted)
    # Query where document_type is any but tax is 0, OR specifically categorized as Nil/Exempt
    # For this implementation, we query records where total tax is 0 but taxable_value > 0
    t31c_query = db.query(
        func.sum(GSTR1_Document.taxable_value).label("taxable_value")
    ).filter(
        GSTR1_Document.business_id == business_id,
        GSTR1_Document.return_period == return_period,
        (GSTR1_Document.igst + GSTR1_Document.cgst + GSTR1_Document.sgst) == 0,
        GSTR1_Document.taxable_value > 0
    ).one()
    
    t31c_val = float(max(Decimal("0.00"), Decimal(str(t31c_query.taxable_value or "0.00"))).quantize(Decimal("0.00")))

    # Fetch ITC from GSTR-2B
    itc_summary = fetch_gstr2b_summary(db, business_id, return_period)

    gstr3b_summary = {
        "3.1": {
            "a": {
                "description": "Outward taxable supplies (other than zero rated, nil rated and exempted)",
                "taxable_value": t31a["taxable_value"],
                "igst": t31a["igst_amount"],
                "cgst": t31a["cgst_amount"],
                "sgst": t31a["sgst_amount"],
                "cess": t31a["cess_amount"],
            },
            "b": {
                "description": "Outward taxable supplies (zero rated)",
                "taxable_value": t31b["taxable_value"],
                "igst": t31b["igst_amount"],
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": t31b["cess_amount"],
            },
            "c": {
                "description": "Other outward supplies (Nil rated, exempted)",
                "taxable_value": t31c_val,
                "igst": 0.0,
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": 0.0,
            }
        },
        "4": {
            "description": "Eligible ITC",
            "itc_igst": itc_summary["itc_igst"],
            "itc_cgst": itc_summary["itc_cgst"],
            "itc_sgst": itc_summary["itc_sgst"],
            "itc_cess": itc_summary["itc_cess"],
        }
    }

    logger.info("GSTR-3B summary generation from database completed")
    return gstr3b_summary
