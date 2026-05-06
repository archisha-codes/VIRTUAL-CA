from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from api.dependencies import verify_workspace_access
from api.schemas import BusinessCreate, BusinessResponse
from models.tenant_models import Business

router = APIRouter(prefix="/workspaces/{workspace_id}/businesses", tags=["Businesses"])

@router.post("/", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    workspace_id: UUID,
    business_in: BusinessCreate,
    db: Session = Depends(get_db),
    _ = Depends(verify_workspace_access)
):
    """
    Adds a new client business to the specified workspace.
    Enforces tenant isolation by verifying workspace access via dependency.
    """
    new_business = Business(
        workspace_id=workspace_id,
        legal_name=business_in.legal_name,
        trade_name=business_in.trade_name,
        gstin=business_in.gstin,
        pan=business_in.pan
    )
    db.add(new_business)
    db.commit()
    db.refresh(new_business)
    return new_business

@router.get("/", response_model=List[BusinessResponse])
def list_businesses(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    _ = Depends(verify_workspace_access)
):
    """
    Lists all client businesses within a workspace.
    Enforces tenant isolation by verifying workspace access via dependency.
    """
    businesses = db.query(Business).filter(Business.workspace_id == workspace_id).all()
    return businesses

@router.get("-with-gstins")
def list_businesses_with_gstins(
    workspace_id: UUID,
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
        
        # Extract state from GSTIN (first 2 chars) if state is not in model
        # The Business model has legal_name, trade_name, gstin, pan
        # We'll use trade_name for state if it looks like one, or default
        state = b.trade_name if b.trade_name else (b.gstin[:2] if len(b.gstin) >= 2 else "Unknown")
        
        grouped[key]["gstins"].append({
            "id": str(b.id),
            "gstin": b.gstin,
            "state": state,
            "status": "Regular",
            "isConnected": True, # For now default to true to allow filing
            "lastVerified": b.updated_at.isoformat() if b.updated_at else None
        })
    
    return {"success": True, "data": list(grouped.values())}
