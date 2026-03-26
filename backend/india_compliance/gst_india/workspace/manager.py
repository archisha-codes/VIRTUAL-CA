"""
Workspace Manager

Manages workspace operations including GSTINs, members, and bulk operations.
"""

import uuid
import re
from datetime import datetime
from typing import List, Optional, Dict, Any

from india_compliance.gst_india.workspace.models import (
    Workspace,
    WorkspaceMember,
    GSTINRegistration,
    WorkspaceSettings,
    WorkspaceRole,
    GSTINStatus,
    RegistrationType,
    GSTINCategory,
    WorkspaceSummary,
    ActiveGstinInfo,
    BulkFilingResult,
    WorkspaceAuditLog,
)
from india_compliance.gst_india.workspace.permissions import WorkspacePermissions
from india_compliance.gst_india.workspace.exceptions import (
    WorkspaceNotFoundError,
    GSTINNotFoundError,
    MemberNotFoundError,
    PermissionDeniedError,
    DuplicateGSTINError,
    InvalidGSTINError,
    InvalidPANError,
    GSTINAccessDeniedError,
    InvalidRoleError,
    WorkspaceInactiveError,
    GSTINInactiveError,
)


# In-memory storage for workspaces (replace with database in production)
_workspaces_db: Dict[str, Workspace] = {}
_user_active_gstin: Dict[str, str] = {}  # user_id -> gstin_id
_audit_logs: List[WorkspaceAuditLog] = []


class WorkspaceManager:
    """
    Manages workspace operations for multi-GSTIN/PAN management.
    """
    
    GSTIN_PATTERN = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
    PAN_PATTERN = re.compile(r'^[A-Z]{5}\d{4}[A-Z]{1}$')
    
    @staticmethod
    def validate_gstin(gstin: str) -> bool:
        """Validate GSTIN format"""
        return bool(WorkspaceManager.GSTIN_PATTERN.match(gstin))
    
    @staticmethod
    def validate_pan(pan: str) -> bool:
        """Validate PAN format"""
        return bool(WorkspaceManager.PAN_PATTERN.match(pan))
    
    @staticmethod
    def create_workspace(
        pan: str,
        name: str,
        owner_id: str,
        description: Optional[str] = None,
    ) -> Workspace:
        """
        Create a new workspace.
        
        Args:
            pan: PAN number (must be valid format)
            name: Workspace name
            owner_id: User ID of the owner
            description: Optional description
            
        Returns:
            Created workspace
            
        Raises:
            InvalidPANError: If PAN format is invalid
        """
        # Validate PAN
        pan = pan.upper()
        if not WorkspaceManager.validate_pan(pan):
            raise InvalidPANError(pan)
        
        # Check if workspace with same PAN already exists
        for ws in _workspaces_db.values():
            if ws.pan == pan:
                raise DuplicateGSTINError(f"Workspace with PAN {pan} already exists")
        
        workspace_id = str(uuid.uuid4())
        
        # Create owner as first member
        owner_member = WorkspaceMember(
            user_id=owner_id,
            role=WorkspaceRole.OWNER,
            gstin_access=[],
            can_manage_members=True,
            can_manage_settings=True,
            can_file_returns=True,
            can_view_reports=True,
        )
        
        workspace = Workspace(
            id=workspace_id,
            pan=pan,
            name=name,
            description=description,
            owner_id=owner_id,
            members=[owner_member],
            gstins=[],
            settings=WorkspaceSettings(),
            is_active=True,
        )
        
        _workspaces_db[workspace_id] = workspace
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=owner_id,
            action="create_workspace",
            entity_type="workspace",
            entity_id=workspace_id,
        )
        
        return workspace
    
    @staticmethod
    def get_workspace(workspace_id: str) -> Workspace:
        """Get workspace by ID"""
        if workspace_id not in _workspaces_db:
            raise WorkspaceNotFoundError(workspace_id)
        return _workspaces_db[workspace_id]
    
    @staticmethod
    def get_workspaces_for_user(user_id: str) -> List[WorkspaceSummary]:
        """Get all workspaces a user is a member of"""
        summaries = []
        for ws in _workspaces_db.values():
            for member in ws.members:
                if member.user_id == user_id and ws.is_active:
                    summaries.append(WorkspaceSummary.from_workspace(ws))
                    break
        return summaries
    
    @staticmethod
    def update_workspace(
        workspace_id: str,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        settings: Optional[WorkspaceSettings] = None,
    ) -> Workspace:
        """Update workspace details"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        if not WorkspacePermissions.can_manage_workspace(workspace, user_id):
            raise PermissionDeniedError("update_workspace")
        
        if name:
            workspace.name = name
        if description is not None:
            workspace.description = description
        if settings:
            workspace.settings = settings
        
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="update_workspace",
            entity_type="workspace",
            entity_id=workspace_id,
        )
        
        return workspace
    
    @staticmethod
    def delete_workspace(workspace_id: str, user_id: str) -> bool:
        """Delete a workspace"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        if not WorkspacePermissions.can_delete_workspace(workspace, user_id):
            raise PermissionDeniedError("delete_workspace")
        
        del _workspaces_db[workspace_id]
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="delete_workspace",
            entity_type="workspace",
            entity_id=workspace_id,
        )
        
        return True
    
    # ==================== GSTIN Management ====================
    
    @staticmethod
    def add_gstin(
        workspace_id: str,
        user_id: str,
        gstin: str,
        legal_name: str,
        state: str,
        trade_name: Optional[str] = None,
        registration_type: RegistrationType = RegistrationType.REGULAR,
        category: GSTINCategory = GSTINCategory.B2B,
    ) -> GSTINRegistration:
        """
        Add a GSTIN to the workspace.
        
        Args:
            workspace_id: Workspace ID
            user_id: User performing the action
            gstin: GSTIN number
            legal_name: Legal name of business
            state: State code
            trade_name: Trade name (optional)
            registration_type: Registration type
            category: Business category
            
        Returns:
            Created GSTIN registration
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        if not WorkspacePermissions.can_add_gstin(workspace, user_id):
            raise PermissionDeniedError("add_gstin")
        
        # Validate GSTIN
        gstin = gstin.upper()
        if not WorkspaceManager.validate_gstin(gstin):
            raise InvalidGSTINError(gstin)
        
        # Check for duplicate GSTIN in workspace
        for existing_gstin in workspace.gstins:
            if existing_gstin.gstin == gstin:
                raise DuplicateGSTINError(gstin)
        
        gstin_id = str(uuid.uuid4())
        
        # First GSTIN is default
        is_default = len(workspace.gstins) == 0
        
        new_gstin = GSTINRegistration(
            id=gstin_id,
            workspace_id=workspace_id,
            gstin=gstin,
            legal_name=legal_name,
            trade_name=trade_name,
            state=state,
            status=GSTINStatus.ACTIVE,
            registration_type=registration_type,
            category=category,
            is_default=is_default,
        )
        
        workspace.gstins.append(new_gstin)
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="add_gstin",
            entity_type="gstin",
            entity_id=gstin_id,
            details={"gstin": gstin, "legal_name": legal_name},
        )
        
        return new_gstin
    
    @staticmethod
    def update_gstin(
        workspace_id: str,
        user_id: str,
        gstin_id: str,
        **updates,
    ) -> GSTINRegistration:
        """Update GSTIN details"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Find GSTIN
        gstin = None
        for g in workspace.gstins:
            if g.id == gstin_id:
                gstin = g
                break
        
        if not gstin:
            raise GSTINNotFoundError(gstin_id)
        
        # Check permission
        if not WorkspacePermissions.can_add_gstin(workspace, user_id):
            raise PermissionDeniedError("update_gstin")
        
        # Apply updates
        allowed_fields = ['legal_name', 'trade_name', 'status', 'registration_type', 'category', 'is_default', 'can_file_returns']
        for field in allowed_fields:
            if field in updates:
                setattr(gstin, field, updates[field])
        
        gstin.updated_at = datetime.now()
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="update_gstin",
            entity_type="gstin",
            entity_id=gstin_id,
            details=updates,
        )
        
        return gstin
    
    @staticmethod
    def remove_gstin(workspace_id: str, user_id: str, gstin_id: str) -> bool:
        """Remove a GSTIN from workspace"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Find GSTIN
        gstin = None
        for g in workspace.gstins:
            if g.id == gstin_id:
                gstin = g
                break
        
        if not gstin:
            raise GSTINNotFoundError(gstin_id)
        
        # Check permission
        if not WorkspacePermissions.can_remove_gstin(workspace, user_id, gstin):
            raise PermissionDeniedError("remove_gstin")
        
        workspace.gstins = [g for g in workspace.gstins if g.id != gstin_id]
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="remove_gstin",
            entity_type="gstin",
            entity_id=gstin_id,
            details={"gstin": gstin.gstin},
        )
        
        return True
    
    @staticmethod
    def get_gstins(workspace_id: str, user_id: str) -> List[GSTINRegistration]:
        """Get all GSTINs accessible to a user"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        return WorkspacePermissions.get_accessible_gstins(workspace, user_id)
    
    # ==================== Member Management ====================
    
    @staticmethod
    def add_member(
        workspace_id: str,
        user_id: str,
        new_user_id: str,
        role: WorkspaceRole = WorkspaceRole.VIEWER,
        gstin_access: Optional[List[str]] = None,
    ) -> WorkspaceMember:
        """Add a member to workspace"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        if not WorkspacePermissions.can_manage_members(workspace, user_id):
            raise PermissionDeniedError("add_member")
        
        # Check if user is already a member
        for member in workspace.members:
            if member.user_id == new_user_id:
                raise PermissionDeniedError(f"User {new_user_id} is already a member")
        
        # Validate role change
        if not WorkspacePermissions.can_update_role(workspace, user_id, role):
            raise PermissionDeniedError("assign_role")
        
        new_member = WorkspaceMember(
            user_id=new_user_id,
            role=role,
            gstin_access=gstin_access or [],
            can_manage_members=role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
            can_manage_settings=role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
            can_file_returns=role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER],
            can_view_reports=True,
        )
        
        workspace.members.append(new_member)
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="add_member",
            entity_type="member",
            entity_id=new_user_id,
            details={"role": role.value},
        )
        
        return new_member
    
    @staticmethod
    def update_member(
        workspace_id: str,
        user_id: str,
        target_user_id: str,
        role: Optional[WorkspaceRole] = None,
        gstin_access: Optional[List[str]] = None,
    ) -> WorkspaceMember:
        """Update member details"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Find member
        member = None
        for m in workspace.members:
            if m.user_id == target_user_id:
                member = m
                break
        
        if not member:
            raise MemberNotFoundError(target_user_id)
        
        # Check permission
        WorkspacePermissions.validate_member_removal(workspace, user_id, target_user_id)
        
        if role:
            if not WorkspacePermissions.can_update_role(workspace, user_id, role):
                raise PermissionDeniedError("update_role")
            member.role = role
            member.can_manage_members = role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]
            member.can_manage_settings = role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]
            member.can_file_returns = role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER]
        
        if gstin_access is not None:
            member.gstin_access = gstin_access
        
        member.last_active = datetime.now()
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="update_member",
            entity_type="member",
            entity_id=target_user_id,
            details={"role": role.value if role else None, "gstin_access": gstin_access},
        )
        
        return member
    
    @staticmethod
    def remove_member(workspace_id: str, user_id: str, target_user_id: str) -> bool:
        """Remove a member from workspace"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        WorkspacePermissions.validate_member_removal(workspace, user_id, target_user_id)
        
        workspace.members = [m for m in workspace.members if m.user_id != target_user_id]
        workspace.updated_at = datetime.now()
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="remove_member",
            entity_type="member",
            entity_id=target_user_id,
        )
        
        return True
    
    @staticmethod
    def get_members(workspace_id: str) -> List[WorkspaceMember]:
        """Get all members of workspace"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        return workspace.members
    
    # ==================== GSTIN Selection ====================
    
    @staticmethod
    def switch_gstin(user_id: str, workspace_id: str, gstin_id: str) -> ActiveGstinInfo:
        """Switch active GSTIN for user"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Find GSTIN
        gstin = None
        for g in workspace.gstins:
            if g.id == gstin_id:
                gstin = g
                break
        
        if not gstin:
            raise GSTINNotFoundError(gstin_id)
        
        # Check access
        if not WorkspacePermissions.can_access_gstin(workspace, user_id, gstin_id):
            raise GSTINAccessDeniedError(gstin_id, user_id)
        
        # Check if GSTIN is active
        if gstin.status != GSTINStatus.ACTIVE:
            raise GSTINInactiveError(gstin_id)
        
        # Store active GSTIN
        _user_active_gstin[user_id] = gstin_id
        
        # Update last active
        for member in workspace.members:
            if member.user_id == user_id:
                member.last_active = datetime.now()
                break
        
        return ActiveGstinInfo(
            gstin_id=gstin.id,
            gstin=gstin.gstin,
            legal_name=gstin.legal_name,
            workspace_id=workspace.id,
            workspace_name=workspace.name,
            state=gstin.state,
            status=gstin.status,
        )
    
    @staticmethod
    def get_active_gstin(user_id: str, workspace_id: str) -> Optional[ActiveGstinInfo]:
        """Get current active GSTIN for user"""
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check if user has active GSTIN stored
        gstin_id = _user_active_gstin.get(user_id)
        
        if not gstin_id:
            # Return default GSTIN
            for g in workspace.gstins:
                if g.is_default and g.status == GSTINStatus.ACTIVE:
                    gstin_id = g.id
                    break
        
        if not gstin_id:
            return None
        
        # Find GSTIN
        for g in workspace.gstins:
            if g.id == gstin_id:
                return ActiveGstinInfo(
                    gstin_id=g.id,
                    gstin=g.gstin,
                    legal_name=g.legal_name,
                    workspace_id=workspace.id,
                    workspace_name=workspace.name,
                    state=g.state,
                    status=g.status,
                )
        
        return None
    
    # ==================== Bulk Operations ====================
    
    @staticmethod
    def bulk_file(
        workspace_id: str,
        user_id: str,
        return_type: str,
        period: str,
    ) -> BulkFilingResult:
        """
        File returns for all GSTINs in workspace.
        
        Note: This is a mock implementation. In production, this would
        integrate with the GSP filing service.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Check permission
        if not WorkspacePermissions.can_file_returns(workspace, user_id):
            raise PermissionDeniedError("bulk_file")
        
        result = BulkFilingResult(
            workspace_id=workspace_id,
            return_type=return_type,
            period=period,
            total_gstins=0,
        )
        
        for gstin in workspace.gstins:
            if gstin.status != GSTINStatus.ACTIVE:
                result.pending.append({
                    "gstin_id": gstin.id,
                    "gstin": gstin.gstin,
                    "status": "skipped",
                    "reason": "GSTIN is not active"
                })
                continue
            
            # Check access
            if not WorkspacePermissions.can_access_gstin(workspace, user_id, gstin.id):
                result.failed.append({
                    "gstin_id": gstin.id,
                    "gstin": gstin.gstin,
                    "status": "failed",
                    "reason": "Access denied"
                })
                continue
            
            # Mock filing (in production, integrate with GSP)
            result.successful.append({
                "gstin_id": gstin.id,
                "gstin": gstin.gstin,
                "status": "filed",
                "ack_number": f"ACK{datetime.now().strftime('%Y%m%d%H%M%S')}"
            })
        
        result.total_gstins = len(result.successful) + len(result.failed) + len(result.pending)
        
        # Log the action
        WorkspaceManager._log_audit(
            workspace_id=workspace_id,
            user_id=user_id,
            action="bulk_file",
            entity_type="workspace",
            details={"return_type": return_type, "period": period, "result": {
                "successful": len(result.successful),
                "failed": len(result.failed),
                "pending": len(result.pending),
            }},
        )
        
        return result
    
    # ==================== Audit ====================
    
    @staticmethod
    def _log_audit(
        workspace_id: str,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ):
        """Log an audit event"""
        log = WorkspaceAuditLog(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address,
        )
        _audit_logs.append(log)
    
    @staticmethod
    def get_audit_logs(workspace_id: str, limit: int = 100) -> List[WorkspaceAuditLog]:
        """Get audit logs for workspace"""
        return [log for log in _audit_logs if log.workspace_id == workspace_id][-limit:]


# Initialize with sample data
def init_sample_workspaces():
    """Initialize sample workspace data - DISABLED for production
    
    This function previously auto-created demo workspaces.
    Now disabled to ensure the app requires real authentication.
    To enable for development, set environment variable ENABLE_DEMO_DATA=true
    """
    import os
    
    # Only run if explicitly enabled
    if os.environ.get("ENABLE_DEMO_DATA", "false").lower() != "true":
        return
    
    # Create a sample workspace (only when explicitly enabled)
    try:
        ws = WorkspaceManager.create_workspace(
            pan="AAAAA1234A",
            name="Demo Company Workspace",
            owner_id="demo_user",
            description="Demo workspace for multi-GSTIN management"
        )
        
        # Add sample GSTINs
        WorkspaceManager.add_gstin(
            workspace_id=ws.id,
            user_id="demo_user",
            gstin="27AAAAA1234A1Z1",
            legal_name="Demo Company Private Limited",
            state="Maharashtra",
            trade_name="Demo Company",
            registration_type=RegistrationType.REGULAR,
            category=GSTINCategory.B2B,
        )
        
        WorkspaceManager.add_gstin(
            workspace_id=ws.id,
            user_id="demo_user",
            gstin="29AAAAA1234A1Z1",
            legal_name="Demo Company Karnataka Branch",
            state="Karnataka",
            trade_name="Demo Company - Bangalore",
            registration_type=RegistrationType.REGULAR,
            category=GSTINCategory.B2B,
        )
        
    except Exception:
        pass  # Already initialized or error


# Initialize on module load
init_sample_workspaces()
