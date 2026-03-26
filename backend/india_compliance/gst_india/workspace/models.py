"""
Workspace Models

Data models for the multi-GSTIN/PAN workspace system.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class WorkspaceRole(str, Enum):
    """Workspace member roles"""
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    VIEWER = "viewer"


class GSTINStatus(str, Enum):
    """GSTIN registration status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"


class RegistrationType(str, Enum):
    """GST registration type"""
    REGULAR = "regular"
    COMPOSITION = "composition"
    SEZ = "sez"
    ISD = "isd"
    DEEMED_EXPORT = "deemed_export"
    CASUAL_TAXABLE_PERSON = "casual_taxable_person"


class GSTINCategory(str, Enum):
    """GSTIN business category"""
    B2B = "b2b"
    B2C = "b2c"
    EXPORT = "export"
    SEZ = "sez"
    COMPOSITION = "composition"
    ECOMMERCE = "ecommerce"
    MIXED = "mixed"


class WorkspaceSettings(BaseModel):
    """Workspace-level settings"""
    default_return_type: str = "GSTR-1"
    auto_reconciliation: bool = True
    consolidated_filing: bool = True
    notification_preferences: Dict[str, bool] = Field(default_factory=lambda: {
        "email": True,
        "sms": False,
        "push": True
    })
    default_period: Optional[str] = None
    timezone: str = "Asia/Kolkata"


class WorkspaceMember(BaseModel):
    """Workspace member model"""
    user_id: str
    role: WorkspaceRole
    gstin_access: List[str] = Field(default_factory=list)  # List of GSTIN IDs they can access
    can_manage_members: bool = False
    can_manage_settings: bool = False
    can_file_returns: bool = False
    can_view_reports: bool = True
    joined_at: datetime = Field(default_factory=datetime.now)
    last_active: Optional[datetime] = None


class GSTINRegistration(BaseModel):
    """GSTIN registration within a workspace"""
    id: str
    workspace_id: str
    gstin: str
    legal_name: str
    trade_name: Optional[str] = None
    state: str
    status: GSTINStatus = GSTINStatus.ACTIVE
    registration_type: RegistrationType = RegistrationType.REGULAR
    category: GSTINCategory = GSTINCategory.B2B
    is_default: bool = False
    can_file_returns: bool = True
    last_filed_period: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        use_enum_values = True


class Workspace(BaseModel):
    """PAN-level workspace model"""
    id: str
    pan: str
    name: str
    description: Optional[str] = None
    owner_id: str
    members: List[WorkspaceMember] = Field(default_factory=list)
    gstins: List[GSTINRegistration] = Field(default_factory=list)
    settings: WorkspaceSettings = Field(default_factory=WorkspaceSettings)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        use_enum_values = True


class WorkspaceSummary(BaseModel):
    """Summary of workspace for display"""
    id: str
    pan: str
    name: str
    description: Optional[str]
    gstin_count: int
    active_gstin_count: int
    member_count: int
    owner_id: str
    created_at: datetime
    
    @classmethod
    def from_workspace(cls, workspace: Workspace) -> "WorkspaceSummary":
        """Create summary from workspace"""
        return cls(
            id=workspace.id,
            pan=workspace.pan,
            name=workspace.name,
            description=workspace.description,
            gstin_count=len(workspace.gstins),
            active_gstin_count=len([g for g in workspace.gstins if g.status == GSTINStatus.ACTIVE]),
            member_count=len(workspace.members),
            owner_id=workspace.owner_id,
            created_at=workspace.created_at
        )


class ActiveGstinInfo(BaseModel):
    """Current active GSTIN for a user"""
    gstin_id: str
    gstin: str
    legal_name: str
    workspace_id: str
    workspace_name: str
    state: str
    status: GSTINStatus


class ConsolidatedMetrics(BaseModel):
    """Consolidated metrics across all GSTINs in a workspace"""
    total_gstins: int
    active_gstins: int
    inactive_gstins: int
    total_taxable_value: float = 0.0
    total_igst: float = 0.0
    total_cgst: float = 0.0
    total_sgst: float = 0.0
    total_cess: float = 0.0
    total_liability: float = 0.0
    total_itc: float = 0.0
    filed_returns: int = 0
    pending_returns: int = 0
    overdue_returns: int = 0
    period: str
    by_state: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    by_category: Dict[str, Dict[str, float]] = Field(default_factory=dict)


class BulkFilingResult(BaseModel):
    """Result of bulk filing operation"""
    workspace_id: str
    return_type: str
    period: str
    total_gstins: int
    successful: List[Dict[str, Any]] = Field(default_factory=list)
    failed: List[Dict[str, Any]] = Field(default_factory=list)
    pending: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)


class WorkspaceAuditLog(BaseModel):
    """Audit log for workspace operations"""
    id: str
    workspace_id: str
    user_id: str
    action: str
    entity_type: str  # workspace, gstin, member
    entity_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
