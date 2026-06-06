"""
Authentication & Authorization Dependencies
Production-grade JWT auth with proper user lookup.
"""
import os
import uuid
import hashlib
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models.tenant_models import User, Workspace, WorkspaceMember, UserRole

# ─── Configuration ────────────────────────────────────────────────────────────
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", 60 * 24))  # 24 h

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ─── Token helpers ────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def hash_password(password: str) -> str:
    """SHA-256 hashing — swap for bcrypt in production if needed."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


# ─── Auth dependencies ────────────────────────────────────────────────────────

def _decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token, raise 401 on failure."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise credentials_exception


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the JWT and return the authenticated User ORM object.
    Raises 401 if token is invalid or user is not found/inactive.
    """
    payload = _decode_token(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated User or None (for public-ish endpoints)."""
    if not token:
        return None
    try:
        payload = _decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except HTTPException:
        return None


def verify_workspace_access(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMember:
    """
    Ensure the current user is a member of the requested workspace.
    Raises 403 if they have no membership record.
    Superusers bypass this check.
    """
    if current_user.is_superuser:
        # For superusers, we return a virtual membership if one doesn't exist
        # to satisfy dependencies that expect a WorkspaceMember object.
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        ).first()
        
        if not membership:
            return WorkspaceMember(
                workspace_id=workspace_id,
                user_id=current_user.id,
                role=UserRole.OWNER # Virtual role for superuser
            )
        return membership

    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this workspace",
        )
    return membership


def require_workspace_role(required_roles: list[UserRole]):
    """Factory that returns a dependency requiring a minimum workspace role."""
    def _check(membership: WorkspaceMember = Depends(verify_workspace_access)) -> WorkspaceMember:
        if membership.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {[r.value for r in required_roles]}",
            )
        return membership
    return _check
