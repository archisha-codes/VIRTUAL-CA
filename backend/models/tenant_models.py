"""
Tenant Models — SQLite/PostgreSQL compatible
Uses String(36) for UUIDs so the same code works with both databases.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, String, ForeignKey, Enum as SQLEnum, DateTime, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database import Base


class UserRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


def new_uuid() -> str:
    """Generate a new UUID as a string (SQLite/PostgreSQL compatible)."""
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    # UUID stored as a 36-character string — works with both SQLite and PostgreSQL
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    owned_workspaces: Mapped[List["Workspace"]] = relationship(
        "Workspace", back_populates="owner", foreign_keys="Workspace.created_by"
    )
    memberships: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="user"
    )


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User", back_populates="owned_workspaces", foreign_keys=[created_by]
    )
    members: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan"
    )
    businesses: Mapped[List["Business"]] = relationship(
        "Business", back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMember(Base, TimestampMixin):
    __tablename__ = "workspace_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole), default=UserRole.MEMBER, nullable=False
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )


class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trade_name: Mapped[Optional[str]] = mapped_column(String(255))
    gstin: Mapped[str] = mapped_column(String(15), nullable=False)
    pan: Mapped[Optional[str]] = mapped_column(String(10))
    state: Mapped[Optional[str]] = mapped_column(String(50))
    registration_type: Mapped[str] = mapped_column(String(20), default="regular")
    status: Mapped[str] = mapped_column(String(20), default="active")

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="businesses")

    # GST Data Relationships (late binding to avoid circular imports)
    gstr1_documents: Mapped[List["GSTR1_Document"]] = relationship(
        "GSTR1_Document", back_populates="business", cascade="all, delete-orphan"
    )
    gstr2b_documents: Mapped[List["GSTR2B_Document"]] = relationship(
        "GSTR2B_Document", back_populates="business", cascade="all, delete-orphan"
    )
    gstr3b_drafts: Mapped[List["GSTR3B_Draft"]] = relationship(
        "GSTR3B_Draft", back_populates="business", cascade="all, delete-orphan"
    )
    gstr1_drafts: Mapped[List["GSTR1_Draft"]] = relationship(
        "GSTR1_Draft", back_populates="business", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "gstin", name="uq_workspace_gstin"),
    )


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[str]] = mapped_column(String(50))
    details: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
