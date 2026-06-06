from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from database import get_db
from models.gst_models import GSTR3B_Draft
from models.tenant_models import Business, User
from api.dependencies import get_current_user, verify_workspace_access
# UUID imports removed - using str
from datetime import datetime
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["GSTR-3B"])

class GSTR3BWorkflowStateRequest(BaseModel):
    workspace_id: str
    gstin: str
    return_period: str
    current_step: str
    step_data: Dict[str, Any]
    gstr3b_data: Optional[Dict[str, Any]] = None
    gstr1_data: Optional[Dict[str, Any]] = None
    itc_data: Optional[Dict[str, Any]] = None
    tax_computation: Optional[Dict[str, Any]] = None
    filing_result: Optional[Dict[str, Any]] = None
    status: str = "draft"
    last_saved: str

class GSTR3BValidateRequest(BaseModel):
    gstin: str
    ret_period: str
    gstr3b_data: Dict[str, Any]
    previous_period_liability: Optional[Dict[str, Any]] = None
    gstr1_reference: Optional[Dict[str, Any]] = None
    gstr2b_reference: Optional[Dict[str, Any]] = None
    override_flags: Optional[Dict[str, Any]] = None
    nil_return: bool = False

class GSTR3BComputeRequest(BaseModel):
    gstin: str
    ret_period: str
    outward_supplies: Dict[str, Any] = {}
    rcm_liability: Dict[str, Any] = {}
    itc_4a: Dict[str, Any] = {}
    itc_4b: Dict[str, Any] = {}
    nil_return: bool = False
    gstr2b_import_id: Optional[str] = None
    workspace_id: Optional[str] = None
    auto_save: bool = True

class GSTR3BFileRequest(BaseModel):
    gstin: str
    ret_period: str
    workspace_id: str
    gstr3b_data: Dict[str, Any]
    otp: Optional[str] = None

@router.get("/api/gstr3b/state")
async def get_gstr3b_state(
    workspace_id: str,
    gstin: str,
    return_period: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    draft = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id == business.id,
        GSTR3B_Draft.return_period == return_period
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="State not found")
        
    return {
        "success": True,
        "data": draft.payload
    }

@router.post("/api/gstr3b/state")
async def save_gstr3b_state(
    request: GSTR3BWorkflowStateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_workspace_access(request.workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == request.workspace_id,
        Business.gstin == request.gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    draft = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id == business.id,
        GSTR3B_Draft.return_period == request.return_period
    ).first()
    
    state_data = request.dict()
    # Convert UUID to str for JSON serialization
    state_data["workspace_id"] = str(state_data["workspace_id"])
    state_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    if draft:
        # Preserve created_at
        state_data["created_at"] = draft.payload.get("created_at", state_data["updated_at"])
        draft.payload = state_data
    else:
        state_data["created_at"] = state_data["updated_at"]
        draft = GSTR3B_Draft(
            business_id=business.id,
            return_period=request.return_period,
            payload=state_data
        )
        db.add(draft)
    
    db.commit()
    return {
        "success": True,
        "message": "GSTR-3B state saved successfully",
        "data": state_data
    }

@router.delete("/api/gstr3b/state")
async def delete_gstr3b_state(
    workspace_id: str,
    gstin: str,
    return_period: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        return {"success": True, "message": "Business not found"}
        
    db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id == business.id,
        GSTR3B_Draft.return_period == return_period
    ).delete()
    
    db.commit()
    return {"success": True, "message": "GSTR-3B state cleared"}

@router.get("/api/gstr3b/state/list")
async def list_gstr3b_states(
    workspace_id: str,
    gstin: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    query = db.query(GSTR3B_Draft).join(Business).filter(
        Business.workspace_id == workspace_id
    )
    
    if gstin:
        query = query.filter(Business.gstin == gstin)
        
    drafts = query.order_by(GSTR3B_Draft.id.desc()).limit(limit).all()
    
    return {
        "success": True,
        "data": [d.payload for d in drafts],
        "total": len(drafts)
    }

@router.post("/api/gstr3b/validate")
async def validate_gstr3b(
    request: GSTR3BValidateRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        from india_compliance.gst_india.gstr3b_validation import (
            validate_gstr3b as run_validation,
            derive_section_state,
        )

        # Merge request fields into data dict
        data = dict(request.gstr3b_data)
        data["gstin"] = request.gstin
        data["ret_period"] = request.ret_period
        data["nil_return"] = request.nil_return

        if request.previous_period_liability:
            data["previous_period_liability"] = request.previous_period_liability
        if request.gstr1_reference:
            data["gstr1_reference"] = request.gstr1_reference
        if request.gstr2b_reference:
            data["gstr2b_reference"] = request.gstr2b_reference
        if request.override_flags:
            data["override_flags"] = request.override_flags

        result = run_validation(data)
        section_state = derive_section_state(data)

        return {
            "success": True,
            "gstin": request.gstin,
            "ret_period": request.ret_period,
            "validation": result.to_dict(),
            "section_state": section_state,
        }
    except Exception as e:
        logger.error(f"GSTR-3B validation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@router.post("/api/gstr3b/compute")
async def compute_gstr3b(
    request: GSTR3BComputeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        from india_compliance.gst_india.gstr3b_engine import compute_gstr3b_tax
        from india_compliance.gst_india.gstr3b_validation import (
            validate_gstr3b as run_validation,
            derive_section_state,
        )

        # Core computation
        itc_4a = dict(request.itc_4a)
        computation = compute_gstr3b_tax(
            outward_supplies=request.outward_supplies,
            rcm_liability=request.rcm_liability,
            itc_4a=itc_4a,
            itc_4b=request.itc_4b,
            nil_return=request.nil_return,
            return_period=request.ret_period,
        )

        computed_data = {
            "gstin": request.gstin,
            "ret_period": request.ret_period,
            "nil_return": request.nil_return,
            "3_1_a": request.outward_supplies,
            "3_1_d": request.rcm_liability,
            "4": {
                "4a": itc_4a,
                "4b": request.itc_4b,
                "4c": {
                    k: computation["net_itc_4c"].get(k, 0)
                    for k in ("igst", "cgst", "sgst", "cess")
                },
            },
            "total_liability": computation["total_liability"],
            "total_itc": {
                k: computation["net_itc_4c"].get(k, 0)
                for k in ("igst", "cgst", "sgst", "cess")
            },
            "itc_utilized": computation["itc_utilized"],
            "cash_liability": computation["cash_liability"],
            "carry_forward": computation["carry_forward"],
            "total_payable": computation["total_payable"],
        }

        validation = run_validation(computed_data)
        section_state = derive_section_state(computed_data)

        # Auto-save draft if requested
        saved = False
        if request.auto_save and request.workspace_id:
            verify_workspace_access(request.workspace_id, current_user=current_user, db=db)
            business = db.query(Business).filter(
                Business.workspace_id == request.workspace_id,
                Business.gstin == request.gstin
            ).first()
            
            if business:
                draft = db.query(GSTR3B_Draft).filter(
                    GSTR3B_Draft.business_id == business.id,
                    GSTR3B_Draft.return_period == request.ret_period
                ).first()
                
                state_data = {
                    "workspace_id": str(request.workspace_id),
                    "gstin": request.gstin,
                    "return_period": request.ret_period,
                    "current_step": "review",
                    "status": "computed",
                    "nil_return": request.nil_return,
                    "gstr3b_data": computed_data,
                    "computation": computation,
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                }
                
                if draft:
                    state_data["created_at"] = draft.payload.get("created_at", state_data["updated_at"])
                    draft.payload = state_data
                else:
                    state_data["created_at"] = state_data["updated_at"]
                    draft = GSTR3B_Draft(
                        business_id=business.id,
                        return_period=request.ret_period,
                        payload=state_data
                    )
                    db.add(draft)
                db.commit()
                saved = True

        return {
            "success": True,
            "gstin": request.gstin,
            "ret_period": request.ret_period,
            "computation": computation,
            "computed_data": computed_data,
            "validation": validation.to_dict(),
            "section_state": section_state,
            "draft_saved": saved,
        }
    except Exception as e:
        logger.error(f"GSTR-3B compute error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")

@router.get("/api/gstr3b/section-state")
async def get_gstr3b_section_state(
    workspace_id: str,
    gstin: str,
    return_period: str,
    nil_return: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        verify_workspace_access(workspace_id, current_user=current_user, db=db)
        
        data = {
            "gstin": gstin,
            "ret_period": return_period,
            "nil_return": nil_return,
        }

        business = db.query(Business).filter(
            Business.workspace_id == workspace_id,
            Business.gstin == gstin
        ).first()
        
        if business:
            draft = db.query(GSTR3B_Draft).filter(
                GSTR3B_Draft.business_id == business.id,
                GSTR3B_Draft.return_period == return_period
            ).first()
            if draft:
                data.update(draft.payload.get("gstr3b_data", {}))
                nil_return = draft.payload.get("nil_return", nil_return)
                data["nil_return"] = nil_return

        from india_compliance.gst_india.gstr3b_validation import derive_section_state
        section_state = derive_section_state(data)

        return {
            "success": True,
            "gstin": gstin,
            "ret_period": return_period,
            "nil_return": nil_return,
            "section_state": section_state,
            "auto_populated_fields": {
                "3_1_a": True,
                "3_1_b": True,
                "4a": True,
                "4b": False,
            },
            "confirmed_sections": [],
        }
    except Exception as e:
        logger.error(f"GSTR-3B section state error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Section state fetch failed: {str(e)}")

@router.post("/api/gstr3b/file")
async def file_gstr3b(
    request: GSTR3BFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        verify_workspace_access(request.workspace_id, current_user=current_user, db=db)
        
        from india_compliance.gst_india.gstr3b_validation import validate_filing_eligibility

        data = dict(request.gstr3b_data)
        data["gstin"] = request.gstin
        data["ret_period"] = request.ret_period

        eligibility = validate_filing_eligibility(data)

        if not eligibility["can_file"]:
            return {
                "success": False,
                "filed": False,
                "message": "Filing blocked by validation errors. Please fix all errors before filing.",
                "blocking_reasons": eligibility["blocking_reasons"],
                "validation": eligibility["validation_summary"],
            }

        filing_ref = f"3B{request.gstin[:5]}{request.ret_period}{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        # Update draft to filed status
        business = db.query(Business).filter(
            Business.workspace_id == request.workspace_id,
            Business.gstin == request.gstin
        ).first()
        
        if business:
            draft = db.query(GSTR3B_Draft).filter(
                GSTR3B_Draft.business_id == business.id,
                GSTR3B_Draft.return_period == request.ret_period
            ).first()
            if draft:
                draft.is_filed = True
                draft.payload["status"] = "filed"
                draft.payload["arn"] = filing_ref
                draft.payload["filed_at"] = datetime.utcnow().isoformat() + "Z"
                db.commit()

        return {
            "success": True,
            "filed": True,
            "message": f"GSTR-3B for {request.ret_period} filed successfully.",
            "gstin": request.gstin,
            "ret_period": request.ret_period,
            "arn": filing_ref,
            "filed_at": datetime.utcnow().isoformat() + "Z",
            "validation": eligibility["validation_summary"],
            "warnings": eligibility["validation_summary"].get("warnings", []),
        }

    except Exception as e:
        logger.error(f"GSTR-3B filing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Filing failed: {str(e)}")
