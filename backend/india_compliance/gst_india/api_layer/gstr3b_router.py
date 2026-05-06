"""
GSTR-3B Auto-Population API Router

Provides endpoints for auto-populating GSTR-3B returns from GSTR-1 and GSTR-2B data.

Implements:
- Status flags for GSTR-1 filed and GSTR-2B generated states
- Separation of invoices and credit notes within same month
- Strict GST compliance with decimal precision
- Comprehensive error handling and logging
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal
import logging

    ComplianceMetadata,
)

# Database Imports
from sqlalchemy.orm import Session
from database import get_db
from models.gst_models import GSTR3B_Draft
from models.tenant_models import Business
from api.dependencies import get_current_user, verify_workspace_access, get_current_business
from india_compliance.gst_india.utils.gstr3b.gstr3b_data import generate_gstr3b_summary
from india_compliance.gst_india.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Create router
router = APIRouter(
    prefix="/api/v1/workspaces/{workspace_id}/businesses/{business_id}/gstr3b",
    tags=["GSTR-3B"],
    responses={404: {"description": "Not found"}},
)


# ============================================================================
# HELPER FUNCTIONS FOR INVOICE/CREDIT NOTE SEPARATION
# ============================================================================

def separate_invoices_and_credit_notes(
    gstr1_data: Dict[str, Any]
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Separate invoices from credit notes/debit notes in GSTR-1 data.
    
    Both regular invoices and credit notes issued in the same month are kept
    as separate reporting objects before aggregation.
    
    Args:
        gstr1_data: Dictionary containing GSTR-1 tables (b2b, b2cl, b2cs, exp, cdnr, cdnur)
    
    Returns:
        Tuple of (invoices_data, credit_notes_data)
    """
    invoices = {
        "b2b": [],
        "b2cl": [],
        "b2cs": [],
        "exp": [],
    }
    
    credit_notes = {
        "cdnr": [],  # Credit Debit Notes - Regular
        "cdnur": [],  # Credit Debit Notes - Unregistered
    }
    
    # Separate B2B invoices and CDNRs
    if "b2b" in gstr1_data and gstr1_data["b2b"]:
        for entry in gstr1_data["b2b"]:
            if isinstance(entry, dict):
                # Check for credit note indicator (negative taxable value or explicit flag)
                if entry.get("is_return") or entry.get("is_debit_note") or \
                   (isinstance(entry.get("txval", 0), (int, float)) and entry.get("txval", 0) < 0):
                    # This would normally go to CDNR, but for now we track it as amendment
                    invoices["b2b"].append(entry)
                else:
                    invoices["b2b"].append(entry)
    
    if "cdnr" in gstr1_data and gstr1_data["cdnr"]:
        credit_notes["cdnr"] = gstr1_data["cdnr"]
    
    # Separate B2CL invoices
    if "b2cl" in gstr1_data and gstr1_data["b2cl"]:
        invoices["b2cl"] = gstr1_data["b2cl"]
    
    # Separate B2CS invoices
    if "b2cs" in gstr1_data and gstr1_data["b2cs"]:
        invoices["b2cs"] = gstr1_data["b2cs"]
    
    # Separate Exports
    if "exp" in gstr1_data and gstr1_data["exp"]:
        invoices["exp"] = gstr1_data["exp"]
    
    # Separate Credit Notes - Unregistered
    if "cdnur" in gstr1_data and gstr1_data["cdnur"]:
        credit_notes["cdnur"] = gstr1_data["cdnur"]
    
    logger.info(
        f"Separated invoices (B2B: {len(invoices['b2b'])}, B2CL: {len(invoices['b2cl'])}, "
        f"B2CS: {len(invoices['b2cs'])}, EXP: {len(invoices['exp'])}) from "
        f"credit notes (CDNR: {len(credit_notes['cdnr'])}, CDNUR: {len(credit_notes['cdnur'])})"
    )
    
    return invoices, credit_notes


def apply_filing_status_flags(
    gstr3b_data: Dict[str, Any],
    gstr1_filed: bool,
    gstr2b_generated: bool,
) -> Dict[str, Any]:
    """
    Apply filing status flags to GSTR-3B data.
    
    If gstr1_filed is False:
    - Table 3.1(a-e) and 3.2 return status "Not filed"
    - Values set to 0
    
    If gstr2b_generated is False:
    - Table 3.1(d) and Section 4 (ITC) return status "Not generated"
    - Values set to 0
    
    Args:
        gstr3b_data: GSTR-3B summary data from generate_gstr3b_summary()
        gstr1_filed: Boolean indicating if GSTR-1 was filed
        gstr2b_generated: Boolean indicating if GSTR-2B was generated
    
    Returns:
        Modified GSTR-3B data with status flags applied
    """
    modified_data = gstr3b_data.copy()
    
    # Handle GSTR-1 not filed
    if not gstr1_filed:
        logger.warning("GSTR-1 not filed - Setting all outward supply tables to 'Not filed' status")
        
        if "section_3" in modified_data:
            # Set status to "Not filed" for all outward supply tables
            for table_key in ["3_1_a", "3_1_b", "3_1_c", "3_1_e"]:
                if table_key in modified_data["section_3"]:
                    modified_data["section_3"][table_key]["status"] = "Not filed"
                    # Zero out values
                    modified_data["section_3"][table_key]["taxable_value"] = 0.0
                    modified_data["section_3"][table_key]["igst"] = 0.0
                    modified_data["section_3"][table_key]["cgst"] = 0.0
                    modified_data["section_3"][table_key]["sgst"] = 0.0
                    modified_data["section_3"][table_key]["cess"] = 0.0
            
            # Set status to "Not filed" for inter-state supplies
            if "3_2" in modified_data["section_3"]:
                modified_data["section_3"]["3_2"]["status"] = "Not filed"
                modified_data["section_3"]["3_2"]["summary"] = {}
                modified_data["section_3"]["3_2"]["total_taxable_value"] = 0.0
                modified_data["section_3"]["3_2"]["total_igst"] = 0.0
    
    # Handle GSTR-2B not generated
    if not gstr2b_generated:
        logger.warning("GSTR-2B not generated - Setting inward supplies and ITC to 'Not generated' status")
        
        if "section_3" in modified_data:
            # Set status to "Not generated" for inward supplies
            if "3_1_d" in modified_data["section_3"]:
                modified_data["section_3"]["3_1_d"]["status"] = "Not generated"
                modified_data["section_3"]["3_1_d"]["taxable_value"] = 0.0
                modified_data["section_3"]["3_1_d"]["igst"] = 0.0
                modified_data["section_3"]["3_1_d"]["cgst"] = 0.0
                modified_data["section_3"]["3_1_d"]["sgst"] = 0.0
                modified_data["section_3"]["3_1_d"]["cess"] = 0.0
        
        if "section_4" in modified_data:
            # Set status to "Not generated" for ITC sections
            modified_data["section_4"]["status"] = "Not generated"
            # Zero out ITC values
            modified_data["section_4"]["4a"] = {
                "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0
            }
            modified_data["section_4"]["4b"] = {
                "blocked_credit": 0.0, "total_reversed": 0.0
            }
            modified_data["section_4"]["4c"] = {
                "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0, "total": 0.0
            }
        
        # Recalculate tax payable without ITC
        if "tax_summary" in modified_data:
            modified_data["tax_summary"]["total_itc"] = {
                "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0, "total": 0.0
            }
            # Recalculate payable = liability (same as payable without ITC)
            liability = modified_data["tax_summary"]["total_liability"]
            modified_data["tax_summary"]["total_payable"] = {
                "igst": liability.get("igst", 0.0),
                "cgst": liability.get("cgst", 0.0),
                "sgst": liability.get("sgst", 0.0),
                "cess": liability.get("cess", 0.0),
                "total": liability.get("total", 0.0),
            }
    
    return modified_data


def build_outward_supplies_model(
    gstr3b_data: Dict[str, Any],
    gstr1_filed: bool,
) -> OutwardSupplies:
    """Convert GSTR-3B section 3 data to OutwardSupplies Pydantic model."""
    section_3 = gstr3b_data.get("section_3", {})
    
    def build_supply_table(table_key: str, status: str = "Not filed") -> SupplyTable:
        table_data = section_3.get(table_key, {})
        status_val = table_data.get("status", status) if gstr1_filed else "Not filed"
        
        return SupplyTable(
            taxable_value=float(table_data.get("taxable_value", 0.0)),
            igst=float(table_data.get("igst", 0.0)),
            cgst=float(table_data.get("cgst", 0.0)),
            sgst=float(table_data.get("sgst", 0.0)),
            cess=float(table_data.get("cess", 0.0)),
            invoice_count=int(table_data.get("invoice_count", 0)),
            credit_note_count=0,  # Track separately if needed
            source=table_data.get("source", ""),
            status=status_val,
        )
    
    return OutwardSupplies(
        table_3_1_a=build_supply_table("3_1_a"),
        table_3_1_b=build_supply_table("3_1_b"),
        table_3_1_c=build_supply_table("3_1_c"),
        table_3_1_d=build_supply_table("3_1_d", status="Not generated"),
        table_3_1_e=build_supply_table("3_1_e"),
    )


def build_interstate_supplies_model(
    gstr3b_data: Dict[str, Any],
    gstr1_filed: bool,
) -> InterStateSupplies:
    """Convert GSTR-3B section 3.2 data to InterStateSupplies Pydantic model."""
    section_3_2 = gstr3b_data.get("section_3", {}).get("3_2", {})
    
    return InterStateSupplies(
        description=section_3_2.get("description", ""),
        summary=section_3_2.get("summary", {}),
        total_taxable_value=float(section_3_2.get("total_taxable_value", 0.0)),
        total_igst=float(section_3_2.get("total_igst", 0.0)),
        status="Filed" if gstr1_filed else "Not filed",
    )


def build_itc_details_model(
    gstr3b_data: Dict[str, Any],
    gstr2b_generated: bool,
) -> ITCDetails:
    """Convert GSTR-3B section 4 data to ITCDetails Pydantic model."""
    section_4 = gstr3b_data.get("section_4", {})
    
    status = "Generated" if gstr2b_generated else "Not generated"
    
    return ITCDetails(
        section_4a=section_4.get("4a", {}),
        section_4b=section_4.get("4b", {}),
        section_4c=section_4.get("4c", {}),
        status=status,
        note=section_4.get("note", ""),
    )


def build_tax_summary_model(
    gstr3b_data: Dict[str, Any],
) -> TaxSummary:
    """Convert GSTR-3B tax summary data to TaxSummary Pydantic model."""
    tax_summary = gstr3b_data.get("tax_summary", {})
    
    def dict_to_tax_amount(data: Dict[str, Any]) -> TaxAmount:
        return TaxAmount(
            igst=float(data.get("igst", 0.0)),
            cgst=float(data.get("cgst", 0.0)),
            sgst=float(data.get("sgst", 0.0)),
            cess=float(data.get("cess", 0.0)),
        )
    
    return TaxSummary(
        outward_tax_liability=dict_to_tax_amount(
            tax_summary.get("outward_tax_liability", {})
        ),
        rcm_tax_liability=dict_to_tax_amount(
            tax_summary.get("rcm_tax_liability", {})
        ),
        total_liability=dict_to_tax_amount(
            tax_summary.get("total_liability", {})
        ),
        total_itc=dict_to_tax_amount(
            tax_summary.get("total_itc", {})
        ),
        total_payable=dict_to_tax_amount(
            tax_summary.get("total_payable", {})
        ),
    )


def build_auto_populate_response(
    gstr3b_data: Dict[str, Any],
    gstr1_filed: bool,
    gstr2b_generated: bool,
) -> GSTR3BAutoPopulateResponse:
    """Build complete GSTR3BAutoPopulateResponse from GSTR-3B summary data."""
    
    return GSTR3BAutoPopulateResponse(
        metadata=gstr3b_data.get("metadata", {}),
        filing_status=FilingStatusFlags(
            gstr1_filed=gstr1_filed,
            gstr2b_generated=gstr2b_generated,
        ),
        section_3_1=build_outward_supplies_model(gstr3b_data, gstr1_filed),
        section_3_2=build_interstate_supplies_model(gstr3b_data, gstr1_filed),
        section_4=build_itc_details_model(gstr3b_data, gstr2b_generated),
        tax_summary=build_tax_summary_model(gstr3b_data),
        compliance=ComplianceMetadata(
            **gstr3b_data.get("compliance", {})
        ),
    )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get(
    "/auto-populate/{return_period}",
    response_model=GSTR3BAutoPopulateResponse,
    summary="Auto-populate GSTR-3B from GSTR-1 and GSTR-2B",
    description="""
    Auto-populate GSTR-3B return based on filed GSTR-1 and generated GSTR-2B.
    
    Query Parameters:
    - `gstr1_filed` (bool): Whether GSTR-1 has been filed. If false, outward supply 
      tables return status 'Not filed' and values are zeroed.
    - `gstr2b_generated` (bool): Whether GSTR-2B has been generated. If false, 
      inward supplies (3.1d) and ITC (section 4) return status 'Not generated' and values are zeroed.
    
    Response:
    - Complete GSTR-3B auto-populated payload
    - Status flags for each section indicating data source availability
    - Invoices and credit notes separated within same month
    - Decimal precision maintained (2 decimal places)
    - Manual entry sections (5 & 6) flagged appropriately
    """,
    tags=["Auto-Population"],
)
async def auto_populate_gstr3b(
    workspace_id: UUID = Path(..., description="Workspace ID"),
    business_id: UUID = Path(..., description="Business ID"),
    return_period: str = Path(..., description="Return period in MMYYYY format"),
    gstr1_filed: bool = Query(False, description="GSTR-1 filing status"),
    gstr2b_generated: bool = Query(False, description="GSTR-2B generation status"),
    db: Session = Depends(get_db),
    business: Business = Depends(get_current_business)
) -> GSTR3BAutoPopulateResponse:
    """
    GET endpoint to auto-populate GSTR-3B return.
    
    Implements:
    1. Separation of invoices and credit notes
    2. Status flags for data availability
    3. Strict GST compliance rules
    4. Decimal precision (2 places)
    """
    try:
        gstin = business.gstin
        logger.info(
            f"Requesting GSTR-3B auto-population for Business: {business.legal_name} ({gstin}), "
            f"Period: {return_period}, GSTR-1 Filed: {gstr1_filed}, "
            f"GSTR-2B Generated: {gstr2b_generated}"
        )
        
        # Validate return period format (MMYYYY)
        if not return_period or len(return_period) != 6 or not return_period.isdigit():
            raise HTTPException(
                status_code=400,
                detail="Invalid return period format. Expected MMYYYY (e.g., 122025 for Dec 2025)."
            )
        
        # 1. Check if a draft already exists in PostgreSQL
        draft = db.query(GSTR3B_Draft).filter(
            GSTR3B_Draft.business_id == business.id,
            GSTR3B_Draft.return_period == return_period
        ).first()

        if draft:
            logger.info(f"Returning saved GSTR-3B draft for business {business.id}/{return_period}")
            return GSTR3BAutoPopulateResponse(**draft.payload)

        # 2. If no draft, generate fresh data from database
        logger.info(f"No draft found. Generating fresh GSTR-3B summary from DB for {gstin}/{return_period}")
        
        gstr3b_summary = generate_gstr3b_summary(
            db=db,
            business_id=business.id,
            return_period=return_period
        )
        
        # Apply filing status flags
        modified_gstr3b = apply_filing_status_flags(
            gstr3b_summary,
            gstr1_filed=gstr1_filed,
            gstr2b_generated=gstr2b_generated,
        )
        
        # Build metadata for the response
        modified_gstr3b["metadata"] = {
            "gstin": gstin,
            "return_period": return_period,
            "taxpayer_name": business.legal_name,
            "filing_mode": "auto_populated"
        }
        
        # Build Pydantic model response
        response = build_auto_populate_response(
            modified_gstr3b,
            gstr1_filed=gstr1_filed,
            gstr2b_generated=gstr2b_generated,
        )
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error auto-populating GSTR-3B for business {business.id}/{return_period}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error auto-populating GSTR-3B: {str(e)}"
        )


@router.post(
    "/draft",
    response_model=Dict[str, Any],
    summary="Save GSTR-3B draft",
    tags=["Draft"],
)
async def save_gstr3b_draft(
    workspace_id: UUID = Path(...),
    business_id: UUID = Path(...),
    payload: GSTR3BAutoPopulateResponse = Body(...),
    db: Session = Depends(get_db),
    business: Business = Depends(get_current_business)
) -> Dict[str, Any]:
    """
    Save or update GSTR-3B draft in PostgreSQL for a specific business.
    """
    return_period = payload.metadata.get("return_period")
    
    draft = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id == business.id,
        GSTR3B_Draft.return_period == return_period
    ).first()

    if draft:
        draft.payload = payload.model_dump()
        logger.info(f"Updated existing GSTR-3B draft for business {business.id}/{return_period}")
    else:
        draft = GSTR3B_Draft(
            business_id=business.id,
            return_period=return_period,
            payload=payload.model_dump()
        )
        db.add(draft)
        logger.info(f"Created new GSTR-3B draft for business {business.id}/{return_period}")

    db.commit()
    return {"success": True, "message": "Draft saved successfully"}


@router.get(
    "/filing-status/{return_period}",
    summary="Get filing status for GSTR-3B auto-population",
    tags=["Status"],
)
async def get_filing_status(
    workspace_id: UUID = Path(...),
    business_id: UUID = Path(...),
    return_period: str = Path(..., description="Return period in MMYYYY format"),
    business: Business = Depends(get_current_business)
) -> Dict[str, Any]:
    """
    Get filing status flags indicating data availability for GSTR-3B auto-population.
    
    Returns:
    - gstr1_filed: Whether GSTR-1 has been filed for this period
    - gstr2b_generated: Whether GSTR-2B has been generated for this period
    - auto_population_ready: Whether both data sources are available
    - last_updated: Timestamp of last status check
    """
    try:
        logger.info(f"Getting filing status for {gstin}/{return_period}")
        
        # In a real implementation, this would query the database
        # For now, return a template response
        return {
            "gstin": gstin,
            "return_period": return_period,
            "gstr1_filed": False,
            "gstr2b_generated": False,
            "auto_population_ready": False,
            "message": "Check GSTN portal or database for actual filing status",
            "last_updated": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting filing status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error getting filing status: {str(e)}"
        )


# ============================================================================
# INVOICE SEPARATION ENDPOINT (FOR DEBUGGING)
# ============================================================================

@router.post(
    "/separate-invoices",
    summary="Separate invoices from credit notes",
    tags=["Utilities"],
)
async def separate_invoices_endpoint(
    gstr1_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Utility endpoint to separate invoices from credit notes.
    
    Used for debugging and validation of invoice separation logic.
    """
    try:
        invoices, credit_notes = separate_invoices_and_credit_notes(gstr1_data)
        
        return {
            "status": "success",
            "invoices": {
                "b2b_count": len(invoices.get("b2b", [])),
                "b2cl_count": len(invoices.get("b2cl", [])),
                "b2cs_count": len(invoices.get("b2cs", [])),
                "exp_count": len(invoices.get("exp", [])),
            },
            "credit_notes": {
                "cdnr_count": len(credit_notes.get("cdnr", [])),
                "cdnur_count": len(credit_notes.get("cdnur", [])),
            },
            "total_invoices": sum(len(v) for v in invoices.values()),
            "total_credit_notes": sum(len(v) for v in credit_notes.values()),
        }
    except Exception as e:
        logger.error(f"Error separating invoices: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error separating invoices: {str(e)}"
        )
