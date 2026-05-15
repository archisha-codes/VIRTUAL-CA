from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from api.dependencies import verify_workspace_access, get_current_user
from api.schemas import BusinessCreate, BusinessResponse
from api.utils import get_state_from_gstin
from models.tenant_models import Business, WorkspaceMember, User

router = APIRouter(tags=["Businesses"])

# Note: /businesses CRUD is now handled by workspace_router.py
# This file is kept for the businesses-with-gstins grouping endpoint only.

@router.get("/api/workspaces/{workspace_id}/businesses-with-gstins")
def list_businesses_with_gstins(
    workspace_id: str,
    db: Session = Depends(get_db),
    _ = Depends(verify_workspace_access)
):
    """
    Groups businesses by PAN/Legal name for the frontend tree-view selector.
    Matches the structure expected by GSTR1/3B drawer flows.
    """
    businesses = db.query(Business).filter(Business.workspace_id == workspace_id).all()
    
    # Group by legal_name/pan
    grouped = {}
    for b in businesses:
        # Use legal_name as the primary group key, fallback to PAN
        key = b.legal_name or b.pan or "Unknown Business"
        
        if key not in grouped:
            grouped[key] = {
                "id": str(b.id),
                "name": b.legal_name,
                "pan": b.pan or "",
                "gstins": []
            }
        
        grouped[key]["gstins"].append({
            "id": str(b.id),
            "gstin": b.gstin,
            "legal_name": b.legal_name,
            "trade_name": b.trade_name,
            "state": get_state_from_gstin(b.gstin),
            "status": "active",
            "registration_type": "regular",
            "category": "b2b",
            "is_default": False,
            "lastVerified": b.updated_at.isoformat() if b.updated_at else None
        })
    
    return {"success": True, "data": list(grouped.values())}
