"""
Workspace Router — Production-Grade
Full CRUD for workspaces, members, and businesses (GSTINs).
"""
import re
from typing import List, Optional, Dict, Any
from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session, joinedload

from database import get_db
from api.dependencies import get_current_user, verify_workspace_access, require_workspace_role
from api.utils import get_state_from_gstin
from models.tenant_models import (
    User, Workspace, WorkspaceMember, Business, UserRole, new_uuid
)
from models.gst_models import GSTR1_Document, GSTR2B_Document, GSTR3B_Draft

router = APIRouter(tags=["Workspaces"])

# ─── Schemas ──────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @validator("name")
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Workspace name cannot be empty")
        if len(v) > 100:
            raise ValueError("Workspace name must be ≤ 100 characters")
        return v


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberInvite(BaseModel):
    email: str
    role: UserRole = UserRole.MEMBER


class MemberRoleUpdate(BaseModel):
    role: UserRole


class BusinessCreate(BaseModel):
    legal_name: str
    trade_name: Optional[str] = None
    gstin: str
    pan: Optional[str] = None
    state: Optional[str] = None
    registration_type: str = "regular"

    @validator("gstin")
    def gstin_format(cls, v: str) -> str:
        v = v.strip().upper()
        # Allow "TEST" or valid GSTIN format
        if v == "TEST":
            return v
        if not re.match(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$", v):
            raise ValueError("Invalid GSTIN format (must be 15 chars or 'TEST')")
        return v


class BusinessUpdate(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    pan: Optional[str] = None


# ─── Response Schemas ─────────────────────────────────────────────────────────

class UserBrief(BaseModel):
    id: str
    email: str
    full_name: Optional[str]

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: str
    user_id: str
    workspace_id: str
    role: UserRole
    user: Optional[UserBrief] = None
    gstin_access: List[str] = []
    can_manage_members: bool = False
    can_file_returns: bool = False
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class BusinessResponse(BaseModel):
    id: str
    workspace_id: str
    legal_name: str
    trade_name: Optional[str]
    gstin: str
    pan: Optional[str]
    state: Optional[str] = None
    registration_type: str = "regular"
    status: str = "active"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_by: str
    member_count: int = 0
    business_count: int = 0
    my_role: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class WorkspaceDetailResponse(WorkspaceResponse):
    members: List[MemberResponse] = []
    gstins: List[BusinessResponse] = []


class ConsolidatedMetrics(BaseModel):
    total_gstins: int
    active_gstins: int
    inactive_gstins: int
    total_taxable_value: float
    total_igst: float
    total_cgst: float
    total_sgst: float
    total_cess: float
    total_liability: float
    total_itc: float
    filed_returns: int
    pending_returns: int
    overdue_returns: int
    period: str
    by_state: Dict[str, Any] = {}
    by_category: Dict[str, Any] = {}


# ─── Helper ───────────────────────────────────────────────────────────────────

def _build_workspace_response(
    workspace: Workspace,
    current_user: User,
) -> WorkspaceResponse:
    my_membership = next(
        (m for m in workspace.members if m.user_id == current_user.id), None
    )
    
    role = None
    if my_membership:
        role = my_membership.role.value
    elif current_user.is_superuser:
        role = UserRole.OWNER.value

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        created_by=workspace.created_by,
        member_count=len(workspace.members),
        business_count=len(workspace.businesses),
        my_role=role,
        created_at=workspace.created_at.isoformat() if workspace.created_at else None,
        updated_at=workspace.updated_at.isoformat() if workspace.updated_at else None,
    )


def _build_business_response(b: Business) -> BusinessResponse:
    return BusinessResponse(
        id=b.id,
        workspace_id=b.workspace_id,
        legal_name=b.legal_name,
        trade_name=b.trade_name,
        gstin=b.gstin,
        pan=b.pan,
        state=b.state or get_state_from_gstin(b.gstin),
        registration_type=b.registration_type,
        status=b.status,
        created_at=b.created_at.isoformat() if b.created_at else None,
        updated_at=b.updated_at.isoformat() if b.updated_at else None,
    )


# ─── Workspace CRUD ───────────────────────────────────────────────────────────

@router.post("/api/workspaces", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    body: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new workspace. The creator is automatically the OWNER."""
    workspace = Workspace(
        id=new_uuid(),
        name=body.name,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(workspace)
    db.flush()  # get the id before adding membership

    member = WorkspaceMember(
        id=new_uuid(),
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=UserRole.OWNER,
    )
    db.add(member)
    db.commit()
    db.refresh(workspace)

    # Eagerly load relationships for the response
    db.refresh(workspace)
    workspace.members  # trigger lazy load
    workspace.businesses

    return _build_workspace_response(workspace, current_user)


@router.get("/api/workspaces", response_model=List[WorkspaceResponse])
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all workspaces where the current user is a member."""
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == current_user.id)
        .all()
    )
    workspace_ids = [m.workspace_id for m in memberships]

    if not workspace_ids:
        return []

    workspaces = (
        db.query(Workspace)
        .options(
            joinedload(Workspace.members),
            joinedload(Workspace.businesses),
        )
        .filter(Workspace.id.in_(workspace_ids))
        .all()
    )

    return [_build_workspace_response(w, current_user) for w in workspaces]


@router.get("/api/workspaces/{workspace_id}", response_model=WorkspaceDetailResponse)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: WorkspaceMember = Depends(verify_workspace_access),
):
    """Get detailed workspace info including members and businesses."""
    workspace = (
        db.query(Workspace)
        .options(
            joinedload(Workspace.members).joinedload(WorkspaceMember.user),
            joinedload(Workspace.businesses),
        )
        .filter(Workspace.id == workspace_id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    response = WorkspaceDetailResponse(
        **_build_workspace_response(workspace, current_user).dict(),
        members=[
            MemberResponse(
                id=m.id,
                user_id=m.user_id,
                workspace_id=m.workspace_id,
                role=m.role,
                user=UserBrief(
                    id=m.user.id,
                    email=m.user.email,
                    full_name=m.user.full_name,
                ) if m.user else None,
                created_at=m.created_at.isoformat() if m.created_at else None,
            )
            for m in workspace.members
        ],
        gstins=[_build_business_response(b) for b in workspace.businesses],
    )
    return response


@router.patch("/api/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update workspace name/description (owner or admin only)."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_([UserRole.OWNER, UserRole.ADMIN]),
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if body.name is not None:
        workspace.name = body.name.strip()
    if body.description is not None:
        workspace.description = body.description

    db.commit()
    db.refresh(workspace)
    workspace.members
    workspace.businesses
    return _build_workspace_response(workspace, current_user)


@router.delete("/api/workspaces/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a workspace (owner only)."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role == UserRole.OWNER,
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Only the workspace owner can delete it")

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.delete(workspace)
    db.commit()


# ─── Member Management ────────────────────────────────────────────────────────

@router.get("/api/workspaces/{workspace_id}/members", response_model=List[MemberResponse])
def list_members(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: WorkspaceMember = Depends(verify_workspace_access),
):
    members = (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .all()
    )
    return [
        MemberResponse(
            id=m.id,
            user_id=m.user_id,
            workspace_id=m.workspace_id,
            role=m.role,
            user=UserBrief(id=m.user.id, email=m.user.email, full_name=m.user.full_name)
            if m.user
            else None,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in members
    ]


@router.post("/api/workspaces/{workspace_id}/members", response_model=MemberResponse, status_code=201)
def invite_member(
    workspace_id: str,
    body: MemberInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a user (by email) to a workspace. Requester must be OWNER or ADMIN."""
    requester_membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_([UserRole.OWNER, UserRole.ADMIN]),
    ).first()
    if not requester_membership:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target_user = db.query(User).filter(User.email == body.email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="No user found with that email address")

    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member of this workspace")

    member = WorkspaceMember(
        id=new_uuid(),
        workspace_id=workspace_id,
        user_id=target_user.id,
        role=body.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return MemberResponse(
        id=member.id,
        user_id=member.user_id,
        workspace_id=member.workspace_id,
        role=member.role,
        user=UserBrief(id=target_user.id, email=target_user.email, full_name=target_user.full_name),
        created_at=member.created_at.isoformat() if member.created_at else None,
    )


@router.patch("/api/workspaces/{workspace_id}/members/{member_user_id}", response_model=MemberResponse)
def update_member_role(
    workspace_id: str,
    member_user_id: str,
    body: MemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change a member's role (owner only)."""
    requester = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role == UserRole.OWNER,
    ).first()
    if not requester:
        raise HTTPException(status_code=403, detail="Only the owner can change roles")

    target = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == member_user_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    target.role = body.role
    db.commit()
    db.refresh(target)

    user = db.query(User).filter(User.id == target.user_id).first()
    return MemberResponse(
        id=target.id,
        user_id=target.user_id,
        workspace_id=target.workspace_id,
        role=target.role,
        user=UserBrief(id=user.id, email=user.email, full_name=user.full_name) if user else None,
        created_at=target.created_at.isoformat() if target.created_at else None,
    )


@router.delete("/api/workspaces/{workspace_id}/members/{member_user_id}", status_code=204)
def remove_member(
    workspace_id: str,
    member_user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a workspace. Owner/Admin can remove others; members can leave."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == member_user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    # Self-removal always allowed; otherwise need OWNER/ADMIN
    if member_user_id != current_user.id:
        requester = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role.in_([UserRole.OWNER, UserRole.ADMIN]),
        ).first()
        if not requester:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    if membership.role == UserRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the workspace owner")

    db.delete(membership)
    db.commit()


# ─── Business (GSTIN) CRUD ────────────────────────────────────────────────────

@router.get("/api/workspaces/{workspace_id}/gstins", response_model=List[BusinessResponse])
def list_businesses(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: WorkspaceMember = Depends(verify_workspace_access),
):
    businesses = db.query(Business).filter(Business.workspace_id == workspace_id).all()
    return [_build_business_response(b) for b in businesses]


@router.post("/api/workspaces/{workspace_id}/gstins", response_model=BusinessResponse, status_code=201)
def create_business(
    workspace_id: str,
    body: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new GSTIN/business to a workspace (OWNER or ADMIN only)."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_([UserRole.OWNER, UserRole.ADMIN]),
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    existing = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == body.gstin,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This GSTIN is already registered in this workspace")

    business = Business(
        id=new_uuid(),
        workspace_id=workspace_id,
        legal_name=body.legal_name,
        trade_name=body.trade_name,
        gstin=body.gstin,
        pan=body.pan,
        state=body.state,
        registration_type=body.registration_type,
        status="active",
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    return _build_business_response(business)


@router.get("/api/workspaces/{workspace_id}/gstins/{business_id}", response_model=BusinessResponse)
def get_business(
    workspace_id: str,
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: WorkspaceMember = Depends(verify_workspace_access),
):
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.workspace_id == workspace_id,
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return _build_business_response(business)


@router.patch("/api/workspaces/{workspace_id}/gstins/{business_id}", response_model=BusinessResponse)
def update_business(
    workspace_id: str,
    business_id: str,
    body: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_([UserRole.OWNER, UserRole.ADMIN]),
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    business = db.query(Business).filter(
        Business.id == business_id,
        Business.workspace_id == workspace_id,
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if body.legal_name is not None:
        business.legal_name = body.legal_name
    if body.trade_name is not None:
        business.trade_name = body.trade_name
    if body.pan is not None:
        business.pan = body.pan

    db.commit()
    db.refresh(business)
    return _build_business_response(business)


@router.delete("/api/workspaces/{workspace_id}/gstins/{business_id}", status_code=204)
@router.delete("/api/gstins/{business_id}", status_code=204)
def delete_business(
    business_id: str,
    workspace_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a business (owner only). Supports both workspace-scoped and direct endpoints."""
    # Find the business first to get its workspace_id if not provided
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    ws_id = workspace_id or business.workspace_id

    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role == UserRole.OWNER,
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Only the workspace owner can delete a business")

    db.delete(business)
    db.commit()


@router.get("/api/workspaces/{workspace_id}/consolidated/summary/{period}", response_model=ConsolidatedMetrics)
def get_consolidated_summary(
    workspace_id: str,
    period: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: WorkspaceMember = Depends(verify_workspace_access),
):
    """
    Get aggregated tax metrics for all businesses in a workspace for a given period.
    Period format: YYYY-MM
    """
    # Convert period YYYY-MM to MMYYYY
    try:
        year, month = period.split("-")
        mm_yyyy = f"{month}{year}"
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid period format. Expected YYYY-MM")

    businesses = db.query(Business).filter(Business.workspace_id == workspace_id).all()
    business_ids = [b.id for b in businesses]

    if not business_ids:
        return ConsolidatedMetrics(
            total_gstins=0,
            active_gstins=0,
            inactive_gstins=0,
            total_taxable_value=0.0,
            total_igst=0.0,
            total_cgst=0.0,
            total_sgst=0.0,
            total_cess=0.0,
            total_liability=0.0,
            total_itc=0.0,
            filed_returns=0,
            pending_returns=0,
            overdue_returns=0,
            period=period
        )

    # 1. Basic Stats
    total_gstins = len(businesses)
    active_gstins = total_gstins # Assuming all for now

    # 2. Liability from GSTR-1 Documents
    liability_data = db.query(
        func.sum(GSTR1_Document.taxable_value).label("taxable_value"),
        func.sum(GSTR1_Document.igst).label("igst"),
        func.sum(GSTR1_Document.cgst).label("cgst"),
        func.sum(GSTR1_Document.sgst).label("sgst"),
        func.sum(GSTR1_Document.cess).label("cess"),
    ).filter(
        GSTR1_Document.business_id.in_(business_ids),
        GSTR1_Document.return_period == mm_yyyy
    ).first()

    taxable_value = float(liability_data.taxable_value or 0)
    igst = float(liability_data.igst or 0)
    cgst = float(liability_data.cgst or 0)
    sgst = float(liability_data.sgst or 0)
    cess = float(liability_data.cess or 0)
    total_liability = igst + cgst + sgst + cess

    # 3. ITC from GSTR-2B Documents
    itc_value = db.query(
        func.sum(GSTR2B_Document.igst + GSTR2B_Document.cgst + GSTR2B_Document.sgst + GSTR2B_Document.cess)
    ).filter(
        GSTR2B_Document.business_id.in_(business_ids),
        GSTR2B_Document.return_period == mm_yyyy
    ).scalar() or 0

    # 4. Filing Status
    filed_count = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id.in_(business_ids),
        GSTR3B_Draft.return_period == mm_yyyy,
        GSTR3B_Draft.is_filed == True
    ).count()

    # 5. By State aggregation
    state_metrics = db.query(
        GSTR1_Document.pos,
        func.sum(GSTR1_Document.taxable_value).label("taxable_value"),
        func.sum(GSTR1_Document.igst).label("igst"),
        func.sum(GSTR1_Document.cgst).label("cgst"),
        func.sum(GSTR1_Document.sgst).label("sgst"),
        func.sum(GSTR1_Document.cess).label("cess"),
    ).filter(
        GSTR1_Document.business_id.in_(business_ids),
        GSTR1_Document.return_period == mm_yyyy
    ).group_by(GSTR1_Document.pos).all()

    by_state = {
        row.pos: {
            "taxable_value": float(row.taxable_value),
            "igst": float(row.igst),
            "cgst": float(row.cgst),
            "sgst": float(row.sgst),
            "cess": float(row.cess)
        }
        for row in state_metrics if row.pos
    }

    return ConsolidatedMetrics(
        total_gstins=total_gstins,
        active_gstins=active_gstins,
        inactive_gstins=0,
        total_taxable_value=taxable_value,
        total_igst=igst,
        total_cgst=cgst,
        total_sgst=sgst,
        total_cess=cess,
        total_liability=total_liability,
        total_itc=float(itc_value),
        filed_returns=filed_count,
        pending_returns=max(0, total_gstins - filed_count),
        overdue_returns=0,
        period=period,
        by_state=by_state
    )
