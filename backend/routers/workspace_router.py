from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from api.dependencies import get_current_user
from api.schemas import WorkspaceCreate, WorkspaceResponse
from models.tenant_models import Workspace, WorkspaceMember, User, UserRole

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    workspace_in: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new CA Firm workspace. The current user is automatically assigned as OWNER.
    """
    new_workspace = Workspace(
        name=workspace_in.name,
        created_by=current_user.id
    )
    db.add(new_workspace)
    db.flush()  # To populate new_workspace.id
    
    # Create the initial membership for the creator
    membership = WorkspaceMember(
        workspace_id=new_workspace.id,
        user_id=current_user.id,
        role=UserRole.OWNER
    )
    db.add(membership)
    
    db.commit()
    db.refresh(new_workspace)
    return new_workspace

@router.get("/", response_model=List[WorkspaceResponse])
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all workspaces where the current user is a member.
    """
    workspaces = db.query(Workspace).join(WorkspaceMember).filter(
        WorkspaceMember.user_id == current_user.id
    ).all()
    return workspaces
