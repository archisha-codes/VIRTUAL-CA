"""
Workspace Exceptions

Custom exceptions for the workspace module.
"""


class WorkspaceError(Exception):
    """Base exception for workspace operations"""
    def __init__(self, message: str, code: str = "WORKSPACE_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class WorkspaceNotFoundError(WorkspaceError):
    """Raised when a workspace is not found"""
    def __init__(self, workspace_id: str):
        super().__init__(
            message=f"Workspace not found: {workspace_id}",
            code="WORKSPACE_NOT_FOUND"
        )
        self.workspace_id = workspace_id


class GSTINNotFoundError(WorkspaceError):
    """Raised when a GSTIN is not found"""
    def __init__(self, gstin_id: str):
        super().__init__(
            message=f"GSTIN not found: {gstin_id}",
            code="GSTIN_NOT_FOUND"
        )
        self.gstin_id = gstin_id


class DuplicateGSTINError(WorkspaceError):
    """Raised when attempting to add a duplicate GSTIN"""
    def __init__(self, gstin: str):
        super().__init__(
            message=f"GSTIN already exists: {gstin}",
            code="DUPLICATE_GSTIN"
        )
        self.gstin = gstin


class MemberNotFoundError(WorkspaceError):
    """Raised when a workspace member is not found"""
    def __init__(self, user_id: str):
        super().__init__(
            message=f"Member not found: {user_id}",
            code="MEMBER_NOT_FOUND"
        )
        self.user_id = user_id


class PermissionDeniedError(WorkspaceError):
    """Raised when a user doesn't have permission to perform an action"""
    def __init__(self, action: str, required_role: str = None):
        message = f"Permission denied for action: {action}"
        if required_role:
            message += f". Required role: {required_role}"
        super().__init__(
            message=message,
            code="PERMISSION_DENIED"
        )
        self.action = action
        self.required_role = required_role


class InvalidGSTINError(WorkspaceError):
    """Raised when a GSTIN format is invalid"""
    def __init__(self, gstin: str):
        super().__init__(
            message=f"Invalid GSTIN format: {gstin}",
            code="INVALID_GSTIN"
        )
        self.gstin = gstin


class InvalidPANError(WorkspaceError):
    """Raised when a PAN format is invalid"""
    def __init__(self, pan: str):
        super().__init__(
            message=f"Invalid PAN format: {pan}",
            code="INVALID_PAN"
        )
        self.pan = pan


class GSTINAccessDeniedError(WorkspaceError):
    """Raised when user doesn't have access to a specific GSTIN"""
    def __init__(self, gstin_id: str, user_id: str):
        super().__init__(
            message=f"User {user_id} does not have access to GSTIN {gstin_id}",
            code="GSTIN_ACCESS_DENIED"
        )
        self.gstin_id = gstin_id
        self.user_id = user_id


class CannotRemoveOwnerError(WorkspaceError):
    """Raised when attempting to remove the workspace owner"""
    def __init__(self):
        super().__init__(
            message="Cannot remove workspace owner",
            code="CANNOT_REMOVE_OWNER"
        )


class InvalidRoleError(WorkspaceError):
    """Raised when an invalid role is specified"""
    def __init__(self, role: str):
        super().__init__(
            message=f"Invalid role: {role}",
            code="INVALID_ROLE"
        )
        self.role = role


class WorkspaceInactiveError(WorkspaceError):
    """Raised when workspace is inactive"""
    def __init__(self, workspace_id: str):
        super().__init__(
            message=f"Workspace is inactive: {workspace_id}",
            code="WORKSPACE_INACTIVE"
        )
        self.workspace_id = workspace_id


class GSTINInactiveError(WorkspaceError):
    """Raised when GSTIN is inactive"""
    def __init__(self, gstin_id: str):
        super().__init__(
            message=f"GSTIN is inactive: {gstin_id}",
            code="GSTIN_INACTIVE"
        )
        self.gstin_id = gstin_id
