"""
Shared Pydantic schemas used across multiple routers.
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from models.tenant_models import UserRole


class WorkspaceBase(BaseModel):
    name: str


class WorkspaceCreate(WorkspaceBase):
    description: Optional[str] = None


class WorkspaceResponse(WorkspaceBase):
    id: str
    description: Optional[str] = None
    created_by: str
    member_count: int = 0
    business_count: int = 0
    my_role: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class BusinessBase(BaseModel):
    legal_name: str
    trade_name: Optional[str] = None
    gstin: str
    pan: Optional[str] = None


class BusinessCreate(BusinessBase):
    pass


class BusinessResponse(BusinessBase):
    id: str
    workspace_id: str
    state: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: str
    user_id: str
    workspace_id: str
    role: UserRole
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class GSTINResponse(BaseModel):
    id: str
    gstin: str
    legal_name: str
    trade_name: Optional[str] = None
    state: Optional[str] = None
    status: str = "active"
    registration_type: str = "regular"
    category: str = "b2b"
    is_default: bool = False
    lastVerified: Optional[datetime] = None


class WorkspaceDetailsResponse(WorkspaceResponse):
    members: List[MemberResponse] = []
    gstins: List[GSTINResponse] = []


class StateMetric(BaseModel):
    taxable_value: float = 0
    igst: float = 0
    cgst: float = 0
    sgst: float = 0
    cess: float = 0


class ConsolidatedMetricsResponse(BaseModel):
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
    by_state: dict[str, StateMetric] = {}
    by_category: dict[str, StateMetric] = {}
