"""
Workspace Permissions

Role-based access control for workspace operations.
"""

from typing import List, Optional
from india_compliance.gst_india.workspace.models import (
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
    GSTINRegistration,
)
from india_compliance.gst_india.workspace.exceptions import (
    PermissionDeniedError,
    GSTINAccessDeniedError,
    CannotRemoveOwnerError,
)


class WorkspacePermissions:
    """
    Handles role-based permissions for workspace operations.
    """
    
    # Role hierarchy - higher roles have all permissions of lower roles
    ROLE_HIERARCHY = {
        WorkspaceRole.OWNER: 4,
        WorkspaceRole.ADMIN: 3,
        WorkspaceRole.MANAGER: 2,
        WorkspaceRole.VIEWER: 1,
    }
    
    @staticmethod
    def get_role_level(role: WorkspaceRole) -> int:
        """Get the hierarchy level for a role"""
        return WorkspacePermissions.ROLE_HIERARCHY.get(role, 0)
    
    @staticmethod
    def has_higher_role(role1: WorkspaceRole, role2: WorkspaceRole) -> bool:
        """Check if role1 has higher or equal privileges than role2"""
        return WorkspacePermissions.get_role_level(role1) >= WorkspacePermissions.get_role_level(role2)
    
    @staticmethod
    def can_manage_workspace(workspace: Workspace, user_id: str) -> bool:
        """Check if user can manage workspace settings"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]
    
    @staticmethod
    def can_add_gstin(workspace: Workspace, user_id: str) -> bool:
        """Check if user can add GSTINs to workspace"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER]
    
    @staticmethod
    def can_remove_gstin(workspace: Workspace, user_id: str, gstin: GSTINRegistration) -> bool:
        """Check if user can remove a GSTIN from workspace"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        # Only OWNER and ADMIN can remove GSTINs
        return member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]
    
    @staticmethod
    def can_manage_members(workspace: Workspace, user_id: str) -> bool:
        """Check if user can manage workspace members"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] or member.can_manage_members
    
    @staticmethod
    def can_file_returns(workspace: Workspace, user_id: str, gstin_id: Optional[str] = None) -> bool:
        """Check if user can file returns"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        
        # Check role-based permission
        if member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER]:
            # If specific GSTIN requested, check access
            if gstin_id:
                return gstin_id in member.gstin_access or not member.gstin_access
            return True
        
        return member.can_file_returns
    
    @staticmethod
    def can_view_reports(workspace: Workspace, user_id: str) -> bool:
        """Check if user can view reports"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER] or member.can_view_reports
    
    @staticmethod
    def can_access_gstin(workspace: Workspace, user_id: str, gstin_id: str) -> bool:
        """Check if user can access a specific GSTIN"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        
        # Owners and admins can access all GSTINs
        if member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return True
        
        # Check if GSTIN is in user's allowed list
        return gstin_id in member.gstin_access or not member.gstin_access
    
    @staticmethod
    def can_delete_workspace(workspace: Workspace, user_id: str) -> bool:
        """Check if user can delete workspace"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role == WorkspaceRole.OWNER
    
    @staticmethod
    def can_transfer_ownership(workspace: Workspace, user_id: str) -> bool:
        """Check if user can transfer workspace ownership"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        return member.role == WorkspaceRole.OWNER
    
    @staticmethod
    def can_update_role(workspace: Workspace, user_id: str, target_role: WorkspaceRole) -> bool:
        """Check if user can update another user's role"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return False
        
        # Only OWNER can change ownership
        if target_role == WorkspaceRole.OWNER:
            return member.role == WorkspaceRole.OWNER
        
        # ADMIN can manage ADMIN, MANAGER, VIEWER
        if member.role == WorkspaceRole.ADMIN:
            return True
        
        return False
    
    @staticmethod
    def require_permission(workspace: Workspace, user_id: str, action: str, required_roles: List[WorkspaceRole] = None):
        """
        Decorator-like function to check permission and raise error if not allowed.
        
        Usage:
            WorkspacePermissions.require_permission(workspace, user_id, "manage_members")
        """
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            raise PermissionDeniedError(action)
        
        if required_roles and member.role not in required_roles:
            raise PermissionDeniedError(action, required_roles[0].value)
        
        return True
    
    @staticmethod
    def check_gstin_access(workspace: Workspace, user_id: str, gstin_id: str):
        """Check GSTIN access and raise error if not allowed"""
        if not WorkspacePermissions.can_access_gstin(workspace, user_id, gstin_id):
            raise GSTINAccessDeniedError(gstin_id, user_id)
    
    @staticmethod
    def _get_member(workspace: Workspace, user_id: str) -> Optional[WorkspaceMember]:
        """Get workspace member by user_id"""
        for member in workspace.members:
            if member.user_id == user_id:
                return member
        return None
    
    @staticmethod
    def get_accessible_gstins(workspace: Workspace, user_id: str) -> List[GSTINRegistration]:
        """Get list of GSTINs accessible to a user"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        if not member:
            return []
        
        # Owners and admins can access all GSTINs
        if member.role in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return workspace.gstins
        
        # Filter by user's GSTIN access list
        if member.gstin_access:
            return [g for g in workspace.gstins if g.id in member.gstin_access]
        
        # No restrictions
        return workspace.gstins
    
    @staticmethod
    def validate_member_removal(workspace: Workspace, user_id: str, target_user_id: str):
        """Validate if a member can be removed"""
        member = WorkspacePermissions._get_member(workspace, user_id)
        target = WorkspacePermissions._get_member(workspace, target_user_id)
        
        if not member or not target:
            return
        
        # Cannot remove owner
        if target.role == WorkspaceRole.OWNER:
            raise CannotRemoveOwnerError()
        
        # Only OWNER and ADMIN can remove members
        if member.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise PermissionDeniedError("remove_member")
        
        # Cannot remove someone with equal or higher role
        if WorkspacePermissions.has_higher_role(target.role, member.role):
            raise PermissionDeniedError("remove_member", member.role.value)
