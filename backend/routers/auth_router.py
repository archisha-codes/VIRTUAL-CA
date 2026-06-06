"""
Authentication Router
Handles user registration, login, token refresh, and profile retrieval.
"""
import os
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models.tenant_models import User, new_uuid
from api.dependencies import (
    create_access_token,
    hash_password,
    verify_password,
    get_current_user,
    JWT_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ─── Schemas ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    # We can add more fields here later (phone, etc.)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserMeResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user account and return a JWT immediately.
    """
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )

    user = User(
        id=new_uuid(),
        email=body.email,
        full_name=body.full_name or body.email.split("@")[0],
        hashed_password=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, expires_in=JWT_EXPIRE_MINUTES * 60)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate an existing user with email + password.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, expires_in=JWT_EXPIRE_MINUTES * 60)


@router.post("/dev-login", response_model=TokenResponse)
def dev_login(db: Session = Depends(get_db)):
    """
    Development-only bypass login. Returns a token for the dev test user.
    Requires DEV_MODE=true in environment.
    """
    if os.environ.get("DEV_MODE", "").lower() != "true":
        raise HTTPException(status_code=403, detail="Development login is disabled")

    dev_email = "dev@virtualca.test"
    user = db.query(User).filter(User.email == dev_email).first()

    if not user:
        # Auto-create the dev test account
        user = User(
            id="00000000-0000-0000-0000-000000000001",
            email=dev_email,
            full_name="Dev Admin",
            hashed_password=hash_password("devpassword123"),
            is_active=True,
            is_superuser=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, expires_in=JWT_EXPIRE_MINUTES * 60)


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserMeResponse)
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the currently authenticated user's profile."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def update_password(
    body: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
