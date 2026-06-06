"""
GST India Workspace Module

Multi-GSTIN/PAN Workspace Support for managing multiple GSTINs under a single PAN.
"""

from india_compliance.gst_india.workspace.models import (
    Workspace,
    GSTINRegistration,
    WorkspaceMember,
    WorkspaceSettings,
    WorkspaceRole,
    GSTINStatus,
    RegistrationType,
    GSTINCategory,
)
from india_compliance.gst_india.workspace.manager import WorkspaceManager
from india_compliance.gst_india.workspace.consolidated_reports import ConsolidatedReporting
from india_compliance.gst_india.workspace.permissions import WorkspacePermissions
from india_compliance.gst_india.workspace.exceptions import (
    WorkspaceError,
    WorkspaceNotFoundError,
    GSTINNotFoundError,
    MemberNotFoundError,
    PermissionDeniedError,
    DuplicateGSTINError,
)

__all__ = [
    "Workspace",
    "GSTINRegistration", 
    "WorkspaceMember",
    "WorkspaceSettings",
    "WorkspaceRole",
    "GSTINStatus",
    "RegistrationType",
    "GSTINCategory",
    "WorkspaceManager",
    "ConsolidatedReporting",
    "WorkspacePermissions",
    "WorkspaceError",
    "WorkspaceNotFoundError",
    "GSTINNotFoundError",
    "MemberNotFoundError",
    "PermissionDeniedError",
    "DuplicateGSTINError",
]
