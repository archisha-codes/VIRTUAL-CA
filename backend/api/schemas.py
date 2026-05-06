from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from models.tenant_models import UserRole

class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceResponse(WorkspaceBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

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
    id: UUID
    workspace_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True
