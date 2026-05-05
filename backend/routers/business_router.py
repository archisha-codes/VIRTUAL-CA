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
