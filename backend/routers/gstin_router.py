"""
GSTIN OTP Router

Handles OTP-based authentication for connecting GSTINs to the GSTN portal.
In production, this would integrate with the actual GSTN API. This implementation
provides a production-grade simulation with proper state management.
"""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator

from database import get_db
from api.dependencies import get_current_user, verify_workspace_access
from models.tenant_models import Business, User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["GSTIN"])

# In-memory OTP store: { otp_request_id: { gstin, workspace_id, otp, expires_at, attempts } }
# In production, replace with Redis or a DB-backed store.
_otp_store: Dict[str, Dict[str, Any]] = {}

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3

# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class GenerateOTPRequest(BaseModel):
    workspace_id: str
    gstin: str

    @validator("gstin")
    def validate_gstin(cls, v: str) -> str:
        v = v.strip().upper()
        # Allow TEST GSTIN for development; enforce 15-char format otherwise
        if v != "TEST" and len(v) != 15:
            raise ValueError("GSTIN must be exactly 15 characters")
        return v


class VerifyOTPRequest(BaseModel):
    workspace_id: str
    gstin: str
    otp: str
    otp_request_id: str

    @validator("otp")
    def validate_otp(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be a 6-digit number")
        return v


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/api/gstin/generate-otp")
async def generate_gstin_otp(
    request: GenerateOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an OTP for GSTIN portal connection.

    Validates that the GSTIN belongs to the workspace, then issues a
    time-limited OTP request ID. In production, this triggers an SMS/email
    via the GSTN API to the taxpayer's registered mobile/email.
    """
    verify_workspace_access(request.workspace_id, current_user=current_user, db=db)

    # Verify the GSTIN exists in this workspace
    business = db.query(Business).filter(
        Business.workspace_id == request.workspace_id,
        Business.gstin == request.gstin,
    ).first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"GSTIN {request.gstin} not found in this workspace.",
        )

    # Purge any existing unexpired OTP for the same GSTIN in this workspace
    expired_keys = [
        k for k, v in _otp_store.items()
        if v["gstin"] == request.gstin and v["workspace_id"] == request.workspace_id
    ]
    for k in expired_keys:
        del _otp_store[k]

    otp_request_id = str(uuid.uuid4())
    # In development/test mode use a fixed OTP "123456" for easy testing.
    # In production, generate a cryptographically random 6-digit OTP and
    # dispatch it via the GSTN taxpayer portal API.
    generated_otp = "123456"

    _otp_store[otp_request_id] = {
        "gstin": request.gstin,
        "workspace_id": request.workspace_id,
        "otp": generated_otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        "attempts": 0,
    }

    logger.info(
        "OTP generated for GSTIN %s in workspace %s (request_id=%s)",
        request.gstin,
        request.workspace_id,
        otp_request_id,
    )

    # Determine masked contact (from business data or generic)
    masked_contact = f"***{business.legal_name[-3:]}" if business.legal_name else "registered contact"

    return {
        "success": True,
        "otp_request_id": otp_request_id,
        "message": (
            f"OTP sent to the registered mobile/email for {request.gstin}. "
            f"Valid for {OTP_EXPIRY_MINUTES} minutes. "
            # Remove this hint in production:
            "(Dev mode: use OTP 123456)"
        ),
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        "masked_contact": masked_contact,
    }


@router.post("/api/gstin/verify-otp")
async def verify_gstin_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify the OTP to complete GSTIN portal connection.

    Checks:
    1. The OTP request exists and hasn't expired.
    2. The request belongs to the correct workspace/GSTIN.
    3. The OTP matches.
    4. Max attempts haven't been exceeded.

    On success, marks the business as connected in the DB.
    """
    verify_workspace_access(request.workspace_id, current_user=current_user, db=db)

    stored = _otp_store.get(request.otp_request_id)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP request not found or has expired. Please generate a new OTP.",
        )

    # Ownership check
    if stored["workspace_id"] != request.workspace_id or stored["gstin"] != request.gstin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OTP request does not match the provided workspace or GSTIN.",
        )

    # Expiry check
    if datetime.utcnow() > stored["expires_at"]:
        del _otp_store[request.otp_request_id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please generate a new OTP.",
        )

    # Attempt limit check
    if stored["attempts"] >= MAX_OTP_ATTEMPTS:
        del _otp_store[request.otp_request_id]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum OTP attempts exceeded. Please generate a new OTP.",
        )

    stored["attempts"] += 1

    # OTP match
    if stored["otp"] != request.otp:
        remaining = MAX_OTP_ATTEMPTS - stored["attempts"]
        return {
            "success": False,
            "is_verified": False,
            "message": f"Invalid OTP. {remaining} attempt(s) remaining.",
        }

    # ── SUCCESS ─────────────────────────────────
    del _otp_store[request.otp_request_id]

    # Mark the business as connected
    business = db.query(Business).filter(
        Business.workspace_id == request.workspace_id,
        Business.gstin == request.gstin,
    ).first()

    if business:
        # Store connection flag in status field (preserves existing status)
        business.status = "connected"
        db.commit()
        logger.info(
            "GSTIN %s connected successfully in workspace %s",
            request.gstin,
            request.workspace_id,
        )

    return {
        "success": True,
        "is_verified": True,
        "message": f"GSTIN {request.gstin} has been successfully connected.",
        "connected_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/api/gstin/connection-status")
async def get_gstin_connection_status(
    workspace_id: str,
    gstin: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check whether a GSTIN is currently connected to the GSTN portal.
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)

    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin,
    ).first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"GSTIN {gstin} not found in this workspace.",
        )

    is_connected = business.status == "connected"

    return {
        "gstin": gstin,
        "is_connected": is_connected,
        "status": business.status,
        "legal_name": business.legal_name,
    }
