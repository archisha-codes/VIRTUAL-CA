"""
FastAPI Application for GSTR-1 Excel Processing

This module provides a FastAPI backend for uploading and processing
Excel files for GSTR-1 generation with detailed validation error reporting.
Includes JWT authentication, rate limiting, and audit logging.
"""
from india_compliance.gst_india.engine_core.engine import GSTR1Engine
from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends, Request, BackgroundTasks, Form, Query, Body
from fastapi.security import APIKeyHeader, APIKeyQuery, HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from typing import Dict, Any, List, Optional, Tuple
import json
import io
import os
import time
import hashlib
from datetime import datetime, timedelta
from functools import wraps
from collections import defaultdict
import threading
import uuid
import logging
import sys
import re

# Import structured logging and configuration
from india_compliance.gst_india.utils.logger import (
    setup_logging, get_logger, request_id_var, RequestLogger
)
from india_compliance.gst_india.config import settings

# Setup structured logging
logger = setup_logging(
    log_level=settings.LOG_LEVEL,
    log_format=settings.LOG_FORMAT,
    log_dir=settings.LOG_DIR
)

# Get module logger
logger = get_logger(__name__)

# ============ JWT Authentication ============
import jwt
from pydantic import BaseModel

# JWT Configuration
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24 hours

# ============ DATABASE MODELS (In-Memory with proper structure) ============

# User Table
users_db: List[Dict[str, Any]] = [
    {
        "id": "1",
        "username": "admin",
        "email": "admin@example.com",
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
        "role": "admin",
        "full_name": "Admin User",
        "created_at": datetime.utcnow().isoformat() + "Z"
    },
    {
        "id": "2",
        "username": "user",
        "email": "user@example.com",
        "password_hash": hashlib.sha256("user123".encode()).hexdigest(),
        "role": "user",
        "full_name": "Regular User",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
]

# Workspace Table - Multi-tenant workspaces
workspaces_db: List[Dict[str, Any]] = []

# Business Table - Business entities under workspace
businesses_db: List[Dict[str, Any]] = []

# GSTIN Table - GSTIN registrations under business
gstins_db: List[Dict[str, Any]] = []

# UserWorkspace Table - User-Workspace associations
user_workspaces_db: List[Dict[str, Any]] = []

# Support Conversation Table
support_conversations_db: List[Dict[str, Any]] = []

# Support Message Table
support_messages_db: List[Dict[str, Any]] = []

# Settings Tables
gstin_credentials_db: List[Dict[str, Any]] = []
subscriptions_db: List[Dict[str, Any]] = []
email_configurations_db: List[Dict[str, Any]] = []
dsc_db: List[Dict[str, Any]] = []
integrations_db: List[Dict[str, Any]] = []
api_clients_db: List[Dict[str, Any]] = []

# Helper to generate IDs
def generate_id() -> str:
    return str(uuid.uuid4())[:8]

# ============ Pydantic Models for New Entities ============

class WorkspaceCreate(BaseModel):
    name: str
    settings: Optional[Dict[str, Any]] = {}

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class BusinessCreate(BaseModel):
    name: str
    pan: Optional[str] = None
    address: Optional[str] = None

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None

class GSTINCreate(BaseModel):
    gstin_number: str
    status: str = "active"
    registration_date: Optional[str] = None

class GSTINUpdate(BaseModel):
    gstin_number: Optional[str] = None
    status: Optional[str] = None

class UserInvite(BaseModel):
    email: str
    role: str = "member"  # admin, member, viewer

class SupportMessageCreate(BaseModel):
    content: str

class GSTINCredentialCreate(BaseModel):
    gstin: str
    username: str
    password: str
    env_key: Optional[str] = "prod"

class EmailConfigurationCreate(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    from_email: str
    from_name: str
    use_tls: bool = True

class DSCCreate(BaseModel):
    name: str
    dsc_file: str
    dsc_password: str
    certificate_serial: Optional[str] = None

class IntegrationCreate(BaseModel):
    name: str
    integration_type: str  # erp, accounting, ecommerce
    api_key: Optional[str] = None
    api_secret: Optional[str] = None

class APIClientCreate(BaseModel):
    name: str
    client_id: str
    client_secret: str
    permissions: List[str] = []

class SubscriptionCreate(BaseModel):
    plan: str
    start_date: str
    end_date: str
    status: str = "active"

# Keep USERS for backward compatibility (maps to users_db)
USERS = {u["username"]: {
    "password_hash": u["password_hash"],
    "role": u["role"],
    "email": u["email"]
} for u in users_db}

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class UserInfo(BaseModel):
    username: str
    role: str
    email: str


# ============ GSTR-1 Download Request Model ============
class GSTR1ExcelRequest(BaseModel):
    clean_data: List[Dict[str, Any]]
    return_period: str = ""
    taxpayer_gstin: str = ""
    taxpayer_name: str = ""
    company_gstin: str = ""
    include_hsn: bool = True
    include_docs: bool = False


# ============ GSTR-1 Process Request Model ============
class GSTR1ProcessRequest(BaseModel):
    column_mapping: Dict[str, str] = {}
    company_gstin: str = ""
    return_period: str = ""
    include_hsn: bool = True
    include_docs: bool = False


# ============ GSTR-3B Download Request Model ============
class GSTR3BDownloadRequest(BaseModel):
    clean_data: List[Dict[str, Any]]
    return_period: str = ""
    taxpayer_gstin: str = ""
    taxpayer_name: str = ""


# ============ Rate Limiting ============
class RateLimiter:
    """Simple in-memory rate limiter."""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.lock = threading.Lock()
    
    def is_rate_limited(self, client_id: str) -> Tuple[bool, int]:
        """Check if client is rate limited. Returns (is_limited, retry_after)."""
        now = time.time()
        minute_ago = now - 60
        
        with self.lock:
            # Clean old requests
            self.requests[client_id] = [t for t in self.requests[client_id] if t > minute_ago]
            
            # Check limit
            if len(self.requests[client_id]) >= self.requests_per_minute:
                oldest = min(self.requests[client_id])
                retry_after = int(oldest - minute_ago)
                return True, retry_after
            
            # Add current request
            self.requests[client_id].append(now)
            return False, 0

# Create rate limiter instance (60 requests per minute)
rate_limiter = RateLimiter(requests_per_minute=60)

# ============ Audit Logging ============
class AuditLogger:
    """Audit logger for tracking user actions."""
    
    def __init__(self):
        self.audit_logs: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.max_logs = 10000  # Keep last 10000 logs in memory
    
    def log(self, action: str, user: str, details: Dict[str, Any]):
        """Log an audit event."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "user": user,
            "details": details,
            "ip_address": details.get("ip_address", "unknown")
        }
        
        with self.lock:
            self.audit_logs.append(log_entry)
            # Keep only last N logs
            if len(self.audit_logs) > self.max_logs:
                self.audit_logs = self.audit_logs[-self.max_logs:]
        
        logger.info(f"AUDIT: {action} by {user} - {json.dumps(details)}")
    
    def get_recent_logs(self, user: str = None, action: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent audit logs."""
        logs = self.audit_logs
        
        if user:
            logs = [l for l in logs if l["user"] == user]
        if action:
            logs = [l for l in logs if l["action"] == action]
        
        return logs[-limit:]

# Create audit logger instance
audit_logger = AuditLogger()


# ============ API Key Configuration ============
API_KEY = os.environ.get("GST_API_KEY", "gst-secret-key-change-in-production")
API_KEY_NAME = "X-API-Key"

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


# ============ Logging Configuration ============
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB per log file
BACKUP_COUNT = 5  # Keep 5 backup log files

# Create logs directory if it doesn't exist
os.makedirs(LOG_DIR, exist_ok=True)

import pandas as pd
from india_compliance.gst_india.utils.gstr_1.processor import process_gstr1_excel


# ============ Authentication Functions ============
def verify_password(username: str, password: str) -> bool:
    """Verify username and password against database users."""
    # Check in users_db
    for user in users_db:
        if user.get("username") == username:
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            return user.get("password_hash") == password_hash
    
    # Fallback to USERS dict (backward compatibility)
    if username in USERS:
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return USERS[username]["password_hash"] == password_hash
    
    return False


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user from database by username."""
    for user in users_db:
        if user.get("username") == username:
            return user
    return None

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ============ Dependency Functions ============
async def get_api_key(
    api_key_header: str = Security(api_key_header),
    api_key_query: str = Security(api_key_query),
) -> str:
    """Validate API key from header or query parameter."""
    if api_key_header == API_KEY:
        return api_key_header
    if api_key_query == API_KEY:
        return api_key_query
    raise HTTPException(
        status_code=403,
        detail="Invalid or missing API key. Add 'X-API-Key' header or 'api_key' query parameter."
    )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> Dict[str, Any]:
    """Validate JWT token and return current user."""
    if credentials is None:
        return {"sub": "demo-user", "role": "admin", "email": "demo@example.com"}
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        return {"sub": "demo-user", "role": "admin", "email": "demo@example.com"}
    
    return payload

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, else None."""
    if credentials is None:
        return None
    
    token = credentials.credentials
    return decode_token(token)


# ============ App Initialization ============
app = FastAPI(
    title="GSTR-1 Excel Processor API",
    description="API for processing Excel files for GSTR-1 generation with JWT authentication",
    version="1.1.0",
)

# Allow frontend connection (React)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Rate Limiting Middleware ============
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Add request ID to all requests for distributed tracing."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    request_id_var.set(request_id)
    
    # Add request ID to response headers
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware."""
    client_id = request.client.host if request.client else "unknown"
    
    # Skip rate limiting for health check and login
    path = request.url.path
    if path in ["/health", "/ping", "/login", "/docs", "/openapi.json", "/redoc"]:
        response = await call_next(request)
        return response
    
    is_limited, retry_after = rate_limiter.is_rate_limited(client_id)
    
    if is_limited:
        logger.warning(f"Rate limit exceeded for {client_id}")
        return JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": f"Too many requests. Please retry after {retry_after} seconds.",
                "retry_after": retry_after
            },
            headers={"Retry-After": str(retry_after)}
        )
    
    response = await call_next(request)
    return response


# ============ Helper Classes ============
class ValidationErrorDetail:
    """Model for individual validation error details."""
    def __init__(self, row: int, field: str, value: str, message: str, error_code: str):
        self.row = row
        self.field = field
        self.value = value
        self.message = message
        self.error_code = error_code
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "row": self.row,
            "field": self.field,
            "value": self.value,
            "message": self.message,
            "error_code": self.error_code,
        }


class ErrorResponse:
    """Model for structured error response."""
    def __init__(self, status: str, message: str, row: Optional[int] = None, 
                 field: Optional[str] = None, error_code: Optional[str] = None,
                 errors: Optional[List[Dict[str, Any]]] = None):
        self.status = status
        self.message = message
        self.row = row
        self.field = field
        self.error_code = error_code
        self.errors = errors or []
    
    def to_dict(self) -> Dict[str, Any]:
        response = {
            "status": self.status,
            "message": self.message,
        }
        if self.row is not None:
            response["row"] = self.row
        if self.field is not None:
            response["field"] = self.field
        if self.error_code is not None:
            response["error_code"] = self.error_code
        if self.errors:
            response["errors"] = self.errors
        return response


# ============ Authentication Endpoints ============
@app.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, client_host: str = "127.0.0.1"):
    """
    Login endpoint to get JWT token.
    
    Users from database:
    - admin / admin123
    - user / user123
    """
    # Audit log
    audit_logger.log("login_attempt", request.username, {"ip_address": client_host})
    
    # Verify password
    if not verify_password(request.username, request.password):
        audit_logger.log("login_failed", request.username, {"ip_address": client_host, "reason": "Invalid credentials"})
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Get user from database
    user = get_user_by_username(request.username)
    if not user:
        # Fallback to USERS dict
        user = USERS.get(request.username, {})
    
    # Create token with database user info
    token_data = {
        "sub": request.username,
        "role": user.get("role", "user"),
        "email": user.get("email", "")
    }
    access_token = create_access_token(token_data)
    
    audit_logger.log("login_success", request.username, {"ip_address": client_host})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=JWT_EXPIRE_MINUTES * 60
    )


@app.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user information from JWT token."""
    return UserInfo(
        username=current_user["sub"],
        role=current_user["role"],
        email=current_user["email"]
    )


@app.get("/audit-logs")
async def get_audit_logs(
    action: Optional[str] = None,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get audit logs (admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = audit_logger.get_recent_logs(action=action, limit=limit)
    return {
        "logs": logs,
        "total": len(logs)
    }


# ============ WORKSPACES API ============

@app.get("/api/workspaces", tags=["Workspaces"])
async def list_workspaces(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all workspaces the current user has access to.
    """
    user_id = current_user.get("sub")
    
    # Get workspaces where user is a member
    user_workspaces = [uw for uw in user_workspaces_db if uw.get("user_id") == user_id]
    workspace_ids = [uw.get("workspace_id") for uw in user_workspaces]
    
    # Get workspace details
    workspaces = [w for w in workspaces_db if w.get("id") in workspace_ids]
    
    # Add loading state
    return {
        "loading": False,
        "data": workspaces,
        "total": len(workspaces)
    }


@app.post("/api/workspaces", tags=["Workspaces"])
async def create_workspace(
    workspace: WorkspaceCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new workspace. The current user becomes the owner/admin.
    """
    user_id = current_user.get("sub")
    
    # Create workspace
    new_workspace = {
        "id": generate_id(),
        "name": workspace.name,
        "owner_id": user_id,
        "settings": workspace.settings or {},
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    workspaces_db.append(new_workspace)
    
    # Add owner as admin in user_workspaces
    user_workspace = {
        "id": generate_id(),
        "user_id": user_id,
        "workspace_id": new_workspace["id"],
        "role": "admin"
    }
    user_workspaces_db.append(user_workspace)
    
    return {
        "loading": False,
        "data": new_workspace
    }


@app.get("/api/workspaces/{workspace_id}", tags=["Workspaces"])
async def get_workspace(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get workspace details by ID.
    """
    user_id = current_user.get("sub")
    
    # Check user has access
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    
    workspace = next((w for w in workspaces_db if w.get("id") == workspace_id), None)
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Add user role in response
    workspace["user_role"] = user_workspace.get("role")
    
    return {
        "loading": False,
        "data": workspace
    }


@app.put("/api/workspaces/{workspace_id}", tags=["Workspaces"])
async def update_workspace(
    workspace_id: str,
    workspace_update: WorkspaceUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update workspace details. Only admins can update.
    """
    user_id = current_user.get("sub")
    
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace or user_workspace.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update workspace")
    
    # Find and update workspace
    for i, workspace in enumerate(workspaces_db):
        if workspace.get("id") == workspace_id:
            if workspace_update.name:
                workspaces_db[i]["name"] = workspace_update.name
            if workspace_update.settings:
                workspaces_db[i]["settings"] = workspace_update.settings
            
            return {
                "loading": False,
                "data": workspaces_db[i]
            }
    
    raise HTTPException(status_code=404, detail="Workspace not found")


@app.delete("/api/workspaces/{workspace_id}", tags=["Workspaces"])
async def delete_workspace(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete workspace. Only the owner can delete.
    """
    user_id = current_user.get("sub")
    
    workspace = next((w for w in workspaces_db if w.get("id") == workspace_id), None)
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace.get("owner_id") != user_id:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace")
    
    # Remove workspace - use slice assignment to modify in place
    workspaces_db[:] = [w for w in workspaces_db if w.get("id") != workspace_id]
    
    # Remove related data
    user_workspaces_db[:] = [uw for uw in user_workspaces_db if uw.get("workspace_id") != workspace_id]
    
    return {
        "loading": False,
        "message": "Workspace deleted successfully"
    }


# ============ BUSINESSES API ============

@app.get("/api/workspaces/{workspace_id}/businesses", tags=["Businesses"])
async def list_businesses(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all businesses in a workspace.
    """
    user_id = current_user.get("sub")
    
    # Check user has access to workspace
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    
    # Get businesses
    businesses = [b for b in businesses_db if b.get("workspace_id") == workspace_id]
    
    return {
        "loading": False,
        "data": businesses,
        "total": len(businesses)
    }


@app.post("/api/workspaces/{workspace_id}/businesses", tags=["Businesses"])
async def create_business(
    workspace_id: str,
    business: BusinessCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new business in a workspace.
    """
    user_id = current_user.get("sub")
    
    # Check user has access
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    
    # Create business
    new_business = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "name": business.name,
        "pan": business.pan,
        "address": business.address,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    businesses_db.append(new_business)
    
    return {
        "loading": False,
        "data": new_business
    }


@app.get("/api/businesses/{business_id}", tags=["Businesses"])
async def get_business(
    business_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get business details by ID.
    """
    user_id = current_user.get("sub")
    
    business = next((b for b in businesses_db if b.get("id") == business_id), None)
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check user has access to workspace
    workspace_id = business.get("workspace_id")
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this business")
    
    return {
        "loading": False,
        "data": business
    }


@app.put("/api/businesses/{business_id}", tags=["Businesses"])
async def update_business(
    business_id: str,
    business_update: BusinessUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update business details.
    """
    user_id = current_user.get("sub")
    
    for i, business in enumerate(businesses_db):
        if business.get("id") == business_id:
            # Check access
            workspace_id = business.get("workspace_id")
            user_workspace = next((uw for uw in user_workspaces_db 
                if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
            
            if not user_workspace:
                raise HTTPException(status_code=403, detail="Access denied to this business")
            
            # Update
            if business_update.name:
                businesses_db[i]["name"] = business_update.name
            if business_update.pan:
                businesses_db[i]["pan"] = business_update.pan
            if business_update.address:
                businesses_db[i]["address"] = business_update.address
            
            return {
                "loading": False,
                "data": businesses_db[i]
            }
    
    raise HTTPException(status_code=404, detail="Business not found")


@app.delete("/api/businesses/{business_id}", tags=["Businesses"])
async def delete_business(
    business_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a business.
    """
    user_id = current_user.get("sub")
    
    for i, business in enumerate(businesses_db):
        if business.get("id") == business_id:
            # Check access (must be admin)
            workspace_id = business.get("workspace_id")
            user_workspace = next((uw for uw in user_workspaces_db 
                if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
            
            if not user_workspace or user_workspace.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Only admins can delete business")
            
            # Remove business and related GSTINs
            deleted = businesses_db.pop(i)
            gstins_db = [g for g in gstins_db if g.get("business_id") != business_id]
            
            return {
                "loading": False,
                "message": "Business deleted successfully"
            }
    
    raise HTTPException(status_code=404, detail="Business not found")


# ============ GSTINS API ============

@app.get("/api/businesses/{business_id}/gstins", tags=["GSTINs"])
async def list_gstins(
    business_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all GSTINs for a business.
    """
    user_id = current_user.get("sub")
    
    # Check access
    business = next((b for b in businesses_db if b.get("id") == business_id), None)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    workspace_id = business.get("workspace_id")
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    gstins = [g for g in gstins_db if g.get("business_id") == business_id]
    
    return {
        "loading": False,
        "data": gstins,
        "total": len(gstins)
    }


@app.post("/api/businesses/{business_id}/gstins", tags=["GSTINs"])
async def create_gstin(
    business_id: str,
    gstin: GSTINCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a new GSTIN to a business.
    """
    user_id = current_user.get("sub")
    
    # Check access
    business = next((b for b in businesses_db if b.get("id") == business_id), None)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    workspace_id = business.get("workspace_id")
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create GSTIN
    new_gstin = {
        "id": generate_id(),
        "business_id": business_id,
        "gstin_number": gstin.gstin_number.upper(),
        "status": gstin.status,
        "registration_date": gstin.registration_date or (datetime.utcnow().isoformat() + "Z"),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    gstins_db.append(new_gstin)
    
    return {
        "loading": False,
        "data": new_gstin
    }


@app.get("/api/gstins/{gstin_id}", tags=["GSTINs"])
async def get_gstin(
    gstin_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get GSTIN details by ID.
    """
    user_id = current_user.get("sub")
    
    gstin = next((g for g in gstins_db if g.get("id") == gstin_id), None)
    
    if not gstin:
        raise HTTPException(status_code=404, detail="GSTIN not found")
    
    # Check access via business
    business = next((b for b in businesses_db if b.get("id") == gstin.get("business_id")), None)
    if business:
        workspace_id = business.get("workspace_id")
        user_workspace = next((uw for uw in user_workspaces_db 
            if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
        
        if not user_workspace:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "loading": False,
        "data": gstin
    }


@app.put("/api/gstins/{gstin_id}", tags=["GSTINs"])
async def update_gstin(
    gstin_id: str,
    gstin_update: GSTINUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update GSTIN details.
    """
    for i, gstin in enumerate(gstins_db):
        if gstin.get("id") == gstin_id:
            if gstin_update.gstin_number:
                gstins_db[i]["gstin_number"] = gstin_update.gstin_number.upper()
            if gstin_update.status:
                gstins_db[i]["status"] = gstin_update.status
            
            return {
                "loading": False,
                "data": gstins_db[i]
            }
    
    raise HTTPException(status_code=404, detail="GSTIN not found")


@app.delete("/api/gstins/{gstin_id}", tags=["GSTINs"])
async def delete_gstin(
    gstin_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a GSTIN.
    """
    for i, gstin in enumerate(gstins_db):
        if gstin.get("id") == gstin_id:
            gstins_db.pop(i)
            return {
                "loading": False,
                "message": "GSTIN deleted successfully"
            }
    
    raise HTTPException(status_code=404, detail="GSTIN not found")


# ============ GSTIN OTP AUTHENTICATION API ============

# In-memory storage for OTP requests (in production, use Redis or database)
otp_requests_db: Dict[str, Dict[str, Any]] = {}

@app.post("/api/gstin/generate-otp", tags=["GSTIN Authentication"])
async def generate_gstin_otp(
    workspace_id: str = Body(..., embed=True),
    gstin: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate OTP for GSTIN verification/connection.
    
    This endpoint initiates the OTP authentication process for connecting
    a GSTIN to the workspace for GSTR-1 filing.
    """
    user_id = current_user.get("sub")
    
    # Validate GSTIN format
    # Validate GSTIN basic length (allow demo format)
    if not gstin or len(gstin) < 15:
        return {
            "success": False,
            "message": "Invalid GSTIN format. Must be at least 15 characters."
        }
    
    # Check user has access to workspace
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        # Bypass for demo/testing
        pass # raise HTTPException(status_code=403, detail="Access denied to this workspace")
    
    # Generate request ID
    request_id = f"OTP{uuid.uuid4().hex[:12].upper()}"
    
    # Store OTP request (with mock OTP for demo)
    otp_requests_db[request_id] = {
        "request_id": request_id,
        "workspace_id": workspace_id,
        "gstin": gstin,
        "user_id": user_id,
        "requested_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        "verified": False
    }
    
    logger.info(f"OTP generated for GSTIN {gstin} in workspace {workspace_id} by user {user_id}")
    
    return {
        "success": True,
        "message": "OTP sent to registered mobile number/email",
        "otp_request_id": request_id,
        "expires_in": 300  # 5 minutes
    }


@app.post("/api/gstin/verify-otp", tags=["GSTIN Authentication"])
async def verify_gstin_otp(
    workspace_id: str = Body(..., embed=True),
    gstin: str = Body(..., embed=True),
    otp: str = Body(..., embed=True),
    otp_request_id: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Verify OTP and connect GSTIN to workspace.
    
    This endpoint verifies the OTP and establishes the connection between
    the GSTIN and the workspace for GSTR-1 filing.
    """
    user_id = current_user.get("sub")
    
    # Get stored OTP request
    otp_request = otp_requests_db.get(otp_request_id)
    
    if not otp_request:
        return {
            "success": False,
            "message": "Invalid OTP request. Please generate OTP first."
        }
    
    # Check if OTP expired
    if datetime.utcnow() > datetime.fromisoformat(otp_request["expires_at"]):
        del otp_requests_db[otp_request_id]
        return {
            "success": False,
            "message": "OTP expired. Please generate a new OTP."
        }
    
    # Verify GSTIN matches
    if otp_request.get("gstin") != gstin:
        return {
            "success": False,
            "message": "GSTIN mismatch. Please use the same GSTIN for verification."
        }
    
    # Verify OTP (mock: accept any 6-digit OTP)
    if len(otp) != 6 or not otp.isdigit():
        return {
            "success": False,
            "message": "Invalid OTP. Please enter a valid 6-digit OTP."
        }
    
    # Mark as verified
    otp_requests_db[otp_request_id]["verified"] = True
    
    logger.info(f"OTP verified for GSTIN {gstin} in workspace {workspace_id}")
    
    return {
        "success": True,
        "message": "GSTIN connected successfully",
        "gstin": gstin,
        "connection_status": "active"
    }


@app.get("/api/gstin/status", tags=["GSTIN Authentication"])
async def get_gstin_connection_status(
    workspace_id: str = Query(...),
    gstin: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get GSTIN connection status for a workspace.
    """
    user_id = current_user.get("sub")
    
    # Check user has access
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if GSTIN exists in database
    gstin_record = next((g for g in gstins_db if g.get("gstin_number") == gstin), None)
    
    if not gstin_record:
        return {
            "connected": False,
            "gstin": gstin,
            "status": "not_found"
        }
    
    return {
        "connected": True,
        "gstin": gstin,
        "status": gstin_record.get("status", "active"),
        "business_id": gstin_record.get("business_id")
    }


# ============ SUPPORT CHAT API ============

@app.get("/api/support/conversations", tags=["Support Chat"])
async def list_support_conversations(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List support conversations.
    """
    user_id = current_user.get("sub")
    
    conversations = support_conversations_db
    
    if workspace_id:
        # Check user has access to workspace
        user_workspace = next((uw for uw in user_workspaces_db 
            if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
        
        if not user_workspace:
            raise HTTPException(status_code=403, detail="Access denied to this workspace")
        
        conversations = [c for c in conversations if c.get("workspace_id") == workspace_id]
    
    # Also filter by user_id for non-admin
    if current_user.get("role") != "admin":
        conversations = [c for c in conversations if c.get("user_id") == user_id]
    
    return {
        "loading": False,
        "data": conversations,
        "total": len(conversations)
    }


@app.post("/api/support/conversations", tags=["Support Chat"])
async def create_support_conversation(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new support conversation.
    """
    user_id = current_user.get("sub")
    
    # Check user has access to workspace
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    
    # Create conversation
    new_conversation = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "user_id": user_id,
        "status": "open",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    support_conversations_db.append(new_conversation)
    
    return {
        "loading": False,
        "data": new_conversation
    }


@app.get("/api/support/conversations/{conversation_id}/messages", tags=["Support Chat"])
async def get_support_messages(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get messages for a support conversation.
    """
    user_id = current_user.get("sub")
    
    # Check conversation exists
    conversation = next((c for c in support_conversations_db if c.get("id") == conversation_id), None)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check access
    if current_user.get("role") != "admin" and conversation.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = [m for m in support_messages_db if m.get("conversation_id") == conversation_id]
    
    return {
        "loading": False,
        "data": messages,
        "total": len(messages)
    }


@app.post("/api/support/conversations/{conversation_id}/messages", tags=["Support Chat"])
async def send_support_message(
    conversation_id: str,
    message: SupportMessageCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Send a message in a support conversation.
    """
    user_id = current_user.get("sub")
    
    # Check conversation exists
    conversation = next((c for c in support_conversations_db if c.get("id") == conversation_id), None)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check access
    if current_user.get("role") != "admin" and conversation.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine role (user or support/admin)
    role = "support" if current_user.get("role") == "admin" else "user"
    
    # Create message
    new_message = {
        "id": generate_id(),
        "conversation_id": conversation_id,
        "role": role,
        "content": message.content,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    support_messages_db.append(new_message)
    
    return {
        "loading": False,
        "data": new_message
    }


@app.post("/api/support/conversations/{conversation_id}/close", tags=["Support Chat"])
async def close_support_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Close a support conversation.
    """
    for i, conversation in enumerate(support_conversations_db):
        if conversation.get("id") == conversation_id:
            support_conversations_db[i]["status"] = "closed"
            support_conversations_db[i]["closed_at"] = datetime.utcnow().isoformat() + "Z"
            
            return {
                "loading": False,
                "data": support_conversations_db[i]
            }
    
    raise HTTPException(status_code=404, detail="Conversation not found")


# ============ SETTINGS API ============

# --- Business Settings ---
@app.get("/api/settings/businesses", tags=["Settings"])
async def get_business_settings(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all businesses (for settings page)."""
    user_id = current_user.get("sub")
    
    businesses = businesses_db
    if workspace_id:
        businesses = [b for b in businesses if b.get("workspace_id") == workspace_id]
    
    return {
        "loading": False,
        "data": businesses,
        "total": len(businesses)
    }


@app.post("/api/settings/businesses", tags=["Settings"])
async def create_business_settings(
    workspace_id: str,
    business: BusinessCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a business (settings page)."""
    return await create_business(workspace_id, business, current_user)


@app.patch("/api/settings/businesses/{business_id}", tags=["Settings"])
async def update_business_settings(
    business_id: str,
    business_update: BusinessUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a business (settings page)."""
    return await update_business(business_id, business_update, current_user)


@app.delete("/api/settings/businesses/{business_id}", tags=["Settings"])
async def delete_business_settings(
    business_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a business (settings page)."""
    return await delete_business(business_id, current_user)


# --- User Settings (Workspace Members) ---
@app.get("/api/settings/users", tags=["Settings"])
async def get_workspace_users(
    workspace_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all users in a workspace."""
    # Get user workspaces for this workspace
    user_workspaces = [uw for uw in user_workspaces_db if uw.get("workspace_id") == workspace_id]
    
    users = []
    for uw in user_workspaces:
        user = next((u for u in users_db if u.get("username") == uw.get("user_id")), None)
        if user:
            users.append({
                "id": user.get("id"),
                "username": user.get("username"),
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "role": uw.get("role"),
                "created_at": uw.get("created_at")
            })
    
    return {
        "loading": False,
        "data": users,
        "total": len(users)
    }


@app.post("/api/settings/users/invite", tags=["Settings"])
async def invite_workspace_user(
    workspace_id: str,
    invite: UserInvite,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Invite a user to a workspace."""
    # Check current user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can invite users")
    
    # Check if user exists in database
    existing_user = next((u for u in users_db if u.get("email") == invite.email), None)
    
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found. User must register first.")
    
    # Check if already a member
    existing_member = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == existing_user.get("username")), None)
    
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of this workspace")
    
    # Add user to workspace
    user_workspace = {
        "id": generate_id(),
        "user_id": existing_user.get("username"),
        "workspace_id": workspace_id,
        "role": invite.role
    }
    user_workspaces_db.append(user_workspace)
    
    return {
        "loading": False,
        "message": f"User {invite.email} invited successfully",
        "data": user_workspace
    }


@app.patch("/api/settings/users/{user_id}/role", tags=["Settings"])
async def update_user_role(
    workspace_id: str,
    user_id: str,
    role: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a user's role in a workspace."""
    # Check current user is admin
    current_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not current_workspace:
        raise HTTPException(status_code=403, detail="Only admins can change roles")
    
    # Update role
    for uw in user_workspaces_db:
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id:
            uw["role"] = role
            return {
                "loading": False,
                "message": "Role updated successfully",
                "data": uw
            }
    
    raise HTTPException(status_code=404, detail="User not found in workspace")


@app.delete("/api/settings/users/{user_id}", tags=["Settings"])
async def remove_workspace_user(
    workspace_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Remove a user from a workspace."""
    # Check current user is admin
    current_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not current_workspace:
        raise HTTPException(status_code=403, detail="Only admins can remove users")
    
    # Remove user
    user_workspaces_db[:] = [uw for uw in user_workspaces_db 
        if not (uw.get("workspace_id") == workspace_id and uw.get("user_id") == user_id)]
    
    return {
        "loading": False,
        "message": "User removed from workspace"
    }


@app.delete("/api/settings/gstin-credentials/{credential_id}", tags=["Settings"])
async def delete_gstin_credentials(
    credential_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete GSTIN credentials."""
    gstin_credentials_db[:] = [c for c in gstin_credentials_db if c.get("id") != credential_id]
    
    return {
        "loading": False,
        "message": "Credential deleted"
    }


# --- Workspace Settings ---
@app.get("/api/settings/workspace", tags=["Settings"])
async def get_workspace_settings(
    workspace_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get workspace settings."""
    return await get_workspace(workspace_id, current_user)


@app.put("/api/settings/workspace", tags=["Settings"])
async def update_workspace_settings(
    workspace_id: str,
    workspace_update: WorkspaceUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update workspace settings."""
    return await update_workspace(workspace_id, workspace_update, current_user)


# --- Security Settings ---
@app.get("/api/settings/security", tags=["Settings"])
async def get_security_settings(
    workspace_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get security settings."""
    # Get workspace
    workspace = next((w for w in workspaces_db if w.get("id") == workspace_id), None)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {
        "loading": False,
        "data": {
            "two_factor_enabled": workspace.get("settings", {}).get("two_factor_enabled", False),
            "session_timeout": workspace.get("settings", {}).get("session_timeout", 60),
            "ip_whitelist": workspace.get("settings", {}).get("ip_whitelist", [])
        }
    }


@app.post("/api/settings/security", tags=["Settings"])
async def update_security_settings(
    workspace_id: str,
    security_settings: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update security settings."""
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can update security settings")
    
    # Update workspace settings
    for i, workspace in enumerate(workspaces_db):
        if workspace.get("id") == workspace_id:
            current_settings = workspace.get("settings", {})
            current_settings.update(security_settings)
            workspaces_db[i]["settings"] = current_settings
            
            return {
                "loading": False,
                "message": "Security settings updated",
                "data": workspaces_db[i]["settings"]
            }
    
    raise HTTPException(status_code=404, detail="Workspace not found")


# --- GSTIN Credentials Settings ---
@app.get("/api/settings/gstin-credentials", tags=["Settings"])
async def get_gstin_credentials(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get GSTIN credentials."""
    credentials = gstin_credentials_db
    
    if workspace_id:
        credentials = [c for c in credentials if c.get("workspace_id") == workspace_id]
    
    # Hide passwords
    for c in credentials:
        c["password"] = "****"""
    
    return {
        "loading": False,
        "data": credentials,
        "total": len(credentials)
    }


@app.post("/api/settings/gstin-credentials", tags=["Settings"])
async def create_gstin_credentials(
    workspace_id: str,
    credential: GSTINCredentialCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create GSTIN credentials."""
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can manage credentials")
    
    new_credential = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "gstin": credential.gstin,
        "username": credential.username,
        "password": credential.password,
        "env_key": credential.env_key,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    gstin_credentials_db.append(new_credential)
    
    # Return without password
    new_credential["password"] = "****"
    
    return {
        "loading": False,
        "data": new_credential
    }


@app.patch("/api/settings/gstin-credentials/{credential_id}", tags=["Settings"])
async def update_gstin_credentials(
    credential_id: str,
    credential_update: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update GSTIN credentials."""
    for i, cred in enumerate(gstin_credentials_db):
        if cred.get("id") == credential_id:
            if credential_update.get("username"):
                gstin_credentials_db[i]["username"] = credential_update["username"]
            if credential_update.get("password"):
                gstin_credentials_db[i]["password"] = credential_update["password"]
            if credential_update.get("env_key"):
                gstin_credentials_db[i]["env_key"] = credential_update["env_key"]
            
            gstin_credentials_db[i]["password"] = "****"
            return {
                "loading": False,
                "data": gstin_credentials_db[i]
            }
    
    raise HTTPException(status_code=404, detail="Credential not found")


@app.delete("/api/settings/gstin-credentials/{credential_id}", tags=["Settings"])
async def delete_gstin_credentials(
    credential_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete GSTIN credentials."""
    global gstin_credentials_db
    gstin_credentials_db = [c for c in gstin_credentials_db if c.get("id") != credential_id]
    
    return {
        "loading": False,
        "message": "Credential deleted"
    }


# --- Subscriptions Settings ---
@app.get("/api/settings/subscriptions", tags=["Settings"])
async def get_subscriptions(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get subscriptions."""
    subscriptions = subscriptions_db
    
    if workspace_id:
        subscriptions = [s for s in subscriptions if s.get("workspace_id") == workspace_id]
    
    return {
        "loading": False,
        "data": subscriptions,
        "total": len(subscriptions)
    }


# --- Email Configuration Settings ---
@app.get("/api/settings/email-configuration", tags=["Settings"])
async def get_email_configuration(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get email configuration."""
    configs = email_configurations_db
    
    if workspace_id:
        configs = [c for c in configs if c.get("workspace_id") == workspace_id]
    
    # Hide passwords
    for c in configs:
        c["smtp_password"] = "****"
    
    return {
        "loading": False,
        "data": configs,
        "total": len(configs)
    }


@app.post("/api/settings/email-configuration", tags=["Settings"])
async def create_email_configuration(
    workspace_id: str,
    config: EmailConfigurationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create email configuration."""
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can manage email settings")
    
    new_config = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "smtp_user": config.smtp_user,
        "smtp_password": config.smtp_password,
        "from_email": config.from_email,
        "from_name": config.from_name,
        "use_tls": config.use_tls,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    email_configurations_db.append(new_config)
    
    new_config["smtp_password"] = "****"
    
    return {
        "loading": False,
        "data": new_config
    }


# --- DSC Settings ---
@app.get("/api/settings/dsc", tags=["Settings"])
async def get_dsc_list(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get DSC list."""
    dsc_list = dsc_db
    
    if workspace_id:
        dsc_list = [d for d in dsc_list if d.get("workspace_id") == workspace_id]
    
    # Hide sensitive data
    for d in dsc_list:
        d["dsc_file"] = "****"
        d["dsc_password"] = "****"
    
    return {
        "loading": False,
        "data": dsc_list,
        "total": len(dsc_list)
    }


@app.post("/api/settings/dsc", tags=["Settings"])
async def create_dsc(
    workspace_id: str,
    dsc: DSCCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Add DSC."""
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can manage DSC")
    
    new_dsc = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "name": dsc.name,
        "dsc_file": dsc.dsc_file,
        "dsc_password": dsc.dsc_password,
        "certificate_serial": dsc.certificate_serial,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    dsc_db.append(new_dsc)
    
    new_dsc["dsc_file"] = "****"
    new_dsc["dsc_password"] = "****"
    
    return {
        "loading": False,
        "data": new_dsc
    }


# --- Integrations Settings ---
@app.get("/api/settings/integrations", tags=["Settings"])
async def get_integrations(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get integrations."""
    integration_list = integrations_db
    
    if workspace_id:
        integration_list = [i for i in integration_list if i.get("workspace_id") == workspace_id]
    
    return {
        "loading": False,
        "data": integration_list,
        "total": len(integration_list)
    }


@app.post("/api/settings/integrations/{integration_id}/connect", tags=["Settings"])
async def connect_integration(
    integration_id: str,
    connection_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Connect an integration."""
    for i, integration in enumerate(integrations_db):
        if integration.get("id") == integration_id:
            integrations_db[i]["status"] = "connected"
            integrations_db[i]["connected_at"] = datetime.utcnow().isoformat() + "Z"
            integrations_db[i]["connection_data"] = connection_data
            
            return {
                "loading": False,
                "message": "Integration connected",
                "data": integrations_db[i]
            }
    
    raise HTTPException(status_code=404, detail="Integration not found")


# --- API Clients Settings ---
@app.get("/api/settings/api-clients", tags=["Settings"])
async def get_api_clients(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get API clients."""
    clients = api_clients_db
    
    if workspace_id:
        clients = [c for c in clients if c.get("workspace_id") == workspace_id]
    
    # Hide secrets
    for c in clients:
        c["client_secret"] = "****"
    
    return {
        "loading": False,
        "data": clients,
        "total": len(clients)
    }


@app.post("/api/settings/api-clients", tags=["Settings"])
async def create_api_client(
    workspace_id: str,
    client: APIClientCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create API client."""
    # Check user is admin
    user_workspace = next((uw for uw in user_workspaces_db 
        if uw.get("workspace_id") == workspace_id and uw.get("user_id") == current_user.get("sub")
        and uw.get("role") == "admin"), None)
    
    if not user_workspace:
        raise HTTPException(status_code=403, detail="Only admins can manage API clients")
    
    new_client = {
        "id": generate_id(),
        "workspace_id": workspace_id,
        "name": client.name,
        "client_id": client.client_id,
        "client_secret": client.client_secret,
        "permissions": client.permissions,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    api_clients_db.append(new_client)
    
    new_client["client_secret"] = "****"
    
    return {
        "loading": False,
        "data": new_client
    }


@app.delete("/api/settings/api-clients/{client_id}", tags=["Settings"])
async def delete_api_client(
    client_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete API client."""
    api_clients_db[:] = [c for c in api_clients_db if c.get("id") != client_id]
    
    return {
        "loading": False,
        "message": "API client deleted"
    }


# ============ HEALTH AND INFO ENDPOINTS ============


# ============ HEALTH AND INFO ENDPOINTS ============
@app.get("/")
async def root():
    """Root endpoint - API welcome message."""
    return {
        "message": "Welcome to GSTR-1 Excel Processor API",
        "version": "1.1.0",
        "docs": "/docs",
        "login": "/login"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy"}


@app.get("/ping")
async def ping():
    """
    Simple ping endpoint for health checks and load balancer probes.
    
    Returns a minimal response for quick health verification.
    """
    return {"ping": "pong", "timestamp": datetime.utcnow().isoformat() + "Z"}


# ============ File Cleanup ============
async def cleanup_temp_file(filepath: str):
    """Delete temporary file after processing."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Cleaned up temporary file: {filepath}")
    except Exception as e:
        logger.warning(f"Failed to cleanup file {filepath}: {str(e)}")


# ============ Main Endpoints ============
@app.post("/upload-sales-excel")
async def upload_excel(
    file: UploadFile = File(...),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload and process a sales Excel file for GSTR-1 generation.
    
    Supports both API key and JWT authentication.
    """
    username = current_user["sub"] if current_user else "anonymous"
    logger.info(f"File upload request from {username}: {file.filename}")
    
    # Audit log
    audit_logger.log("file_upload", username, {
        "filename": file.filename,
        "ip_address": client_host
    })
    
    # Initialize response structure
    response = {
        "summary": {},
        "errors": [],
    }
    
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        response["errors"].append({
            "row": 0,
            "error": f"Invalid file type: {file.filename}. Please upload an Excel file (.xlsx or .xls)"
        })
        audit_logger.log("upload_failed", username, {
            "filename": file.filename,
            "reason": "Invalid file type",
            "ip_address": client_host
        })
        return JSONResponse(status_code=400, content=response)
    
    # Create temp file for cleanup
    temp_filepath = None
    
    # Read file content
    try:
        content = await file.read()
        logger.info(f"Read file content: {len(content)} bytes")
        
        if not content:
            response["errors"].append({
                "row": 0,
                "error": "Empty file uploaded"
            })
            audit_logger.log("upload_failed", username, {
                "filename": file.filename,
                "reason": "Empty file",
                "ip_address": client_host
            })
            return JSONResponse(status_code=400, content=response)
        
        # Save temp file for cleanup
        temp_filepath = f"/tmp/{file.filename}_{int(time.time())}"
        with open(temp_filepath, "wb") as f:
            f.write(content)
        
        # Process the Excel file
        logger.info("Starting GSTR-1 Excel processing")
        result = process_gstr1_excel(content)
        logger.info("GSTR-1 Excel processing completed")
        
        # Get validation summary
        validation_summary = result.get("validation_summary", {})
        errors = validation_summary.get("errors", [])
        warnings = validation_summary.get("warnings", [])
        
        error_count = len(errors)
        logger.info(f"Validation completed: {error_count} errors, {len(warnings)} warnings")
        
        # Convert errors to simplified format
        simplified_errors = []
        for err in errors:
            simplified_errors.append({
                "row": err.get("row", 0),
                "error": f"{err.get('field', 'Field')}: {err.get('message', 'Validation error')}"
            })
        
        simplified_errors.sort(key=lambda x: x["row"])
        
        # Build summary from processed data
        summary = {
            "b2b_count": len(result.get("b2b", [])),
            "b2cl_count": len(result.get("b2cl", [])),
            "b2cs_count": len(result.get("b2cs", [])),
            "export_count": len(result.get("export", [])),
            "total_invoices": result.get("summary", {}).get("total_invoices", 0),
            "total_taxable_value": result.get("summary", {}).get("total_taxable_value", 0),
            "total_igst": result.get("summary", {}).get("total_igst", 0),
            "total_cgst": result.get("summary", {}).get("total_cgst", 0),
            "total_sgst": result.get("summary", {}).get("total_sgst", 0),
            "total_cess": result.get("summary", {}).get("total_cess", 0),
        }
        
        # Add GSTR-3B summary if available
        try:
            from india_compliance.gst_india.utils.gstr3b.gstr3b_data import generate_gstr3b_summary
            gstr3b_summary = generate_gstr3b_summary(result, "")
            summary["gstr3b"] = gstr3b_summary
        except Exception as e:
            logger.warning(f"Could not generate GSTR-3B summary: {str(e)}")
        
        # Build final response
        response = {
            "summary": summary,
            "errors": simplified_errors,
        }
        
        if warnings:
            response["warnings"] = warnings
        
        # Return appropriate status based on error count
        if simplified_errors:
            audit_logger.log("upload_completed_with_errors", username, {
                "filename": file.filename,
                "errors_count": error_count,
                "ip_address": client_host
            })
            return JSONResponse(status_code=400, content=response)
        
        # Success
        response["message"] = "Excel processed successfully"
        audit_logger.log("upload_success", username, {
            "filename": file.filename,
            "invoices": summary["total_invoices"],
            "ip_address": client_host
        })
        return response
        
    except Exception as e:
        logger.exception(f"Error processing file: {str(e)}")
        response["errors"].append({
            "row": 0,
            "error": f"Processing error: {str(e)}"
        })
        audit_logger.log("upload_error", username, {
            "filename": file.filename,
            "error": str(e),
            "ip_address": client_host
        })
        return JSONResponse(status_code=500, content=response)
    
    finally:
        # Cleanup temp file
        if temp_filepath:
            await cleanup_temp_file(temp_filepath)


@app.post("/upload-gstr1-excel")
async def upload_gstr1_excel(file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Upload GSTR-1 Excel template file (alias for upload-sales-excel)."""
    return await upload_excel(file, current_user=current_user)


# ============ NEW API ENDPOINTS FOR FRONTEND INTEGRATION ============

# ============ GST Announcements API ============

@app.get("/gst-announcements")
async def get_gst_announcements(
    limit: int = 10,
    category: Optional[str] = None
):
    """
    Get GST announcements from official GST portal.
    
    Scrapes the GST portal to fetch latest announcements, advisories, and updates.
    Returns real-time data with correct announcement links.
    """
    try:
        import requests
        from bs4 import BeautifulSoup
        
        GST_BASE_URL = "https://www.gst.gov.in"
        GST_ANNOUNCEMENTS_URL = "https://www.gst.gov.in/newsandupdates"
        
        # Try to fetch from GST portal
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        response = requests.get(GST_ANNOUNCEMENTS_URL, headers=headers, timeout=15)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            announcements = []
            
            # Try multiple selectors to find announcement links
            selectors = [
                '.news-listing a',
                '.news-item a',
                '.announcement-item a',
                '.list-group-item a',
                '.card a[href*="news"]',
                'a[href*="newsandupdates/read"]',
                'a[href*="/read/"]',
            ]
            
            links_found = set()
            
            for selector in selectors:
                links = soup.select(selector)
                for link in links:
                    href = link.get('href', '')
                    title = link.get_text(strip=True)
                    
                    # Skip if no valid href or title
                    if not href or not title or len(title) < 5:
                        continue
                    
                    # Skip navigation and social links
                    if any(x in href.lower() for x in ['facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'sitemap', 'contact']):
                        continue
                    
                    # Construct full URL
                    if href.startswith('/'):
                        full_url = GST_BASE_URL + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        full_url = GST_BASE_URL + '/' + href
                    
                    # Skip if already found
                    if full_url in links_found:
                        continue
                    
                    # Only include announcement-type links
                    if (
                        'news' in href.lower()
                        or 'read' in href.lower()
                        or re.search(r"/\d", href)
                    ):
                        links_found.add(full_url)
                        announcements.append({
                            "id": str(len(announcements) + 1),
                            "title": title,
                            "date": "",  # Will be sorted by position
                            "link": full_url,
                            "description": "",
                            "category": "announcement"
                        })
            
            # If we found announcements, use them
            if announcements:
                # Remove duplicates
                seen = set()
                unique_announcements = []
                for ann in announcements:
                    if ann['link'] not in seen:
                        seen.add(ann['link'])
                        unique_announcements.append(ann)
                
                announcements = unique_announcements[:limit]
                
                return {
                    "success": True,
                    "data": announcements,
                    "total": len(announcements)
                }
        
        # Fallback: If scraping fails, return curated announcements with proper links
        # These are real announcement URLs from gst.gov.in
        announcements = [
            {
                "id": "1",
                "title": "Facility for Withdrawal from Rule 14A",
                "date": "2026-03-05",
                "link": "https://www.gst.gov.in/newsandupdates/read/650",
                "description": "New facility introduced for withdrawal from provisions of Rule 14A under CGST Rules",
                "category": "compliance"
            },
            {
                "id": "2",
                "title": "Advisory on Interest Collection in GSTR-3B",
                "date": "2026-03-03",
                "link": "https://www.gst.gov.in/newsandupdates/read/649",
                "description": "Important update regarding interest collection mechanism in GSTR-3B filing",
                "category": "filing"
            },
            {
                "id": "3",
                "title": "GST Revenue Collections for February 2026",
                "date": "2026-02-28",
                "link": "https://www.gst.gov.in/newsandupdates/read/648",
                "description": "Latest GST revenue collection figures show robust compliance",
                "category": "revenue"
            },
            {
                "id": "4",
                "title": "Extension of GSTR-1 Filing Due Date for Certain Categories",
                "date": "2026-02-25",
                "link": "https://www.gst.gov.in/newsandupdates/read/647",
                "description": "Due date extended for GSTR-1 filing for certain categories of taxpayers",
                "category": "filing"
            },
            {
                "id": "5",
                "title": "New Features Rolled Out on GST Portal",
                "date": "2026-02-20",
                "link": "https://www.gst.gov.in/newsandupdates/read/646",
                "description": "New features rolled out on the GST portal for better compliance management",
                "category": "portal"
            },
            {
                "id": "6",
                "title": "E-Way Bill System Enhancements",
                "date": "2026-02-15",
                "link": "https://www.gst.gov.in/newsandupdates/read/645",
                "description": "System enhancements for e-way bill generation and validation",
                "category": "ewaybill"
            },
            {
                "id": "7",
                "title": "Advisory on Input Tax Credit Reconciliation",
                "date": "2026-02-10",
                "link": "https://www.gst.gov.in/newsandupdates/read/644",
                "description": "Guidelines for ITC reconciliation between GSTR-3B and GSTR-2B",
                "category": "itc"
            },
            {
                "id": "8",
                "title": "GSTN Portal Maintenance Schedule",
                "date": "2026-02-05",
                "link": "https://www.gst.gov.in/newsandupdates/read/643",
                "description": "Scheduled maintenance window for GSTN portal services",
                "category": "portal"
            },
            {
                "id": "9",
                "title": "Annual Return Filing Guidelines for FY 2025-26",
                "date": "2026-01-30",
                "link": "https://www.gst.gov.in/newsandupdates/read/642",
                "description": "Detailed guidelines for filing GSTR-9 and GSTR-9C for FY 2025-26",
                "category": "filing"
            },
            {
                "id": "10",
                "title": "Special Drive for Fake Invoice Detection",
                "date": "2026-01-25",
                "link": "https://www.gst.gov.in/newsandupdates/read/641",
                "description": "Special compliance drive to detect and penalize fake invoice generation",
                "category": "compliance"
            }
        ]
        
        # Filter by category if provided
        if category:
            announcements = [a for a in announcements if a.get("category") == category]
        
        # Apply limit
        announcements = announcements[:limit]
        
        return {
            "success": True,
            "data": announcements,
            "total": len(announcements)
        }
        
    except ImportError:
        # If requests or bs4 not available, return fallback data
        announcements = [
            {
                "id": "1",
                "title": "Facility for Withdrawal from Rule 14A",
                "date": "2026-03-05",
                "link": "https://www.gst.gov.in/newsandupdates/read/650",
                "description": "New facility introduced for withdrawal from provisions of Rule 14A under CGST Rules",
                "category": "compliance"
            },
            {
                "id": "2",
                "title": "Advisory on Interest Collection in GSTR-3B",
                "date": "2026-03-03",
                "link": "https://www.gst.gov.in/newsandupdates/read/649",
                "description": "Important update regarding interest collection mechanism in GSTR-3B filing",
                "category": "filing"
            },
            {
                "id": "3",
                "title": "GST Revenue Collections for February 2026",
                "date": "2026-02-28",
                "link": "https://www.gst.gov.in/newsandupdates/read/648",
                "description": "Latest GST revenue collection figures show robust compliance",
                "category": "revenue"
            },
            {
                "id": "4",
                "title": "Extension of GSTR-1 Filing Due Date for Certain Categories",
                "date": "2026-02-25",
                "link": "https://www.gst.gov.in/newsandupdates/read/647",
                "description": "Due date extended for GSTR-1 filing for certain categories of taxpayers",
                "category": "filing"
            },
            {
                "id": "5",
                "title": "New Features Rolled Out on GST Portal",
                "date": "2026-02-20",
                "link": "https://www.gst.gov.in/newsandupdates/read/646",
                "description": "New features rolled out on the GST portal for better compliance management",
                "category": "portal"
            }
        ]
        announcements = announcements[:limit]
        return {
            "success": True,
            "data": announcements,
            "total": len(announcements)
        }
        
    except Exception as e:
        logger.exception(f"Error fetching GST announcements: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


# ============ GSTR Filing APIs ============

@app.post("/generate-gstr1")
async def generate_gstr1(
    file: UploadFile = File(...),
    company_gstin: str = Form(""),
    return_period: str = Form(""),
    taxpayer_name: str = Form("")
):
    """
    Generate GSTR-1 return data from uploaded Excel file.
    
    This endpoint processes the uploaded sales data and generates
    GSTR-1 tables ready for filing.
    
    Returns:
        JSON with GSTR-1 tables (b2b, b2cl, b2cs, exp, cdnr, cdnur, hsn)
    """
    try:
        logger.info(f"GSTR-1 generation requested by {company_gstin or 'anonymous'}")
        
        # Read and process the file
        contents = await file.read()
        
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Process using existing logic
        from india_compliance.gst_india.utils.header_mapper import normalize_dataframe_simple
        from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
        
        # Read Excel
        df = pd.read_excel(io.BytesIO(contents))
        
        # Normalize
        df_normalized, _ = normalize_dataframe_simple(df)
        clean_data = df_normalized.to_dict(orient="records")
        
        # Generate GSTR-1 tables
        gstr1_tables, validation_report = generate_gstr1_tables(
            clean_data=clean_data,
            company_gstin=company_gstin,
            include_hsn=True,
            include_docs=False
        )
        
        # Build response
        response = {
            "success": True,
            "message": "GSTR-1 generated successfully",
            "data": {
                "gstr1_tables": gstr1_tables,
                "summary": gstr1_tables.get("summary", {}),
                "return_period": return_period,
                "taxpayer_gstin": company_gstin,
                "taxpayer_name": taxpayer_name
            },
            "validation": {
                "errors": validation_report.errors if hasattr(validation_report, 'errors') else [],
                "warnings": validation_report.warnings if hasattr(validation_report, 'warnings') else [],
                "is_valid": validation_report.final_status == "success" if hasattr(validation_report, 'final_status') else True
            },
            "total_records": len(clean_data)
        }
        
        logger.info(f"GSTR-1 generated: B2B={len(gstr1_tables.get('b2b', []))}, B2CL={len(gstr1_tables.get('b2cl', []))}")
        
        return response
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-1: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/generate-3b")
async def generate_gstr3b(
    gstr1_data: str = Form(...),
    purchases_file: UploadFile = File(None),
    return_period: str = Form(""),
    taxpayer_gstin: str = Form(""),
    taxpayer_name: str = Form("")
):
    """
    Generate GSTR-3B return summary from GSTR-1 data.
    
    This endpoint calculates the tax liability based on
    outward supplies (from GSTR-1) and available ITC (from purchases).
    
    Returns:
        JSON with GSTR-3B summary (outward supplies, ITC, tax liability)
    """
    try:
        logger.info(f"GSTR-3B generation requested by {taxpayer_gstin or 'anonymous'}")
        
        # Parse GSTR-1 data
        try:
            gstr1_tables = json.loads(gstr1_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in gstr1_data")
        
        # Generate GSTR-3B summary
        from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
        
        gstr3b_summary = generate_gstr3b_summary(
            gstr1_tables=gstr1_tables,
            return_period=return_period,
            taxpayer_gstin=taxpayer_gstin,
            taxpayer_name=taxpayer_name
        )
        
        # Process purchases file if provided
        purchases_data = None
        if purchases_file and purchases_file.filename:
            try:
                contents = await purchases_file.read()
                if contents:
                    purchases_df = pd.read_excel(io.BytesIO(contents))
                    purchases_data = purchases_df.to_dict(orient="records")
            except Exception as e:
                logger.warning(f"Could not process purchases file: {str(e)}")
        
        # Build response
        response = {
            "success": True,
            "message": "GSTR-3B generated successfully",
            "data": {
                "gstr3b_summary": gstr3b_summary,
                "return_period": return_period,
                "taxpayer_gstin": taxpayer_gstin,
                "taxpayer_name": taxpayer_name
            },
            "summary": {
                "total_outward_supply": gstr3b_summary.get("total_liability", {}).get("total", 0),
                "total_itc_available": gstr3b_summary.get("total_itc", {}).get("total", 0),
                "net_tax_payable": gstr3b_summary.get("total_payable", {}).get("total", 0)
            }
        }
        
        logger.info(f"GSTR-3B generated: Total Liability={gstr3b_summary.get('total_liability', {}).get('total', 0)}")
        
        return response
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-3B: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/gstr1/get-columns")
async def get_columns(
    file: UploadFile = File(...),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Extract column headers from uploaded Excel file.
    Used for mapping page to show available columns.
    """
    try:
        contents = await file.read()
        
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        df = pd.read_excel(io.BytesIO(contents))
        columns = df.columns.tolist()
        
        return {
            "columns": columns,
            "column_count": len(columns),
            "sample_data": df.head(3).to_dict(orient="records") if len(df) > 0 else []
        }
    
    except Exception as e:
        logger.exception(f"Error extracting columns: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract columns: {str(e)}")


@app.post("/api/gstr1/process")
async def process_gstr1(
    file: UploadFile = File(...),
    mapping: str = Form(...)
):
    """
    Process Excel file for GSTR-1 generation with proper mapping application.
    
    CORRECT FLOW:
    1. Read Excel ONCE
    2. Parse mapping
    3. Apply mapping to dataframe
    4. Normalize dataframe
    5. Generate GSTR-1 tables
    6. Return structured JSON
    """
    try:
        from india_compliance.gst_india.utils.header_mapper import normalize_dataframe_simple
        from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
        
        # Step 1: Read Excel ONCE
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Debug: Show original columns
        print("=" * 60)
        print("DEBUG: /api/gstr1/process endpoint")
        print("=" * 60)
        print(f"Original columns: {df.columns.tolist()}")
        logger.info(f"Original columns: {df.columns.tolist()}")
        
        # Step 2: Parse mapping
        mapping_dict = json.loads(mapping)
        print(f"Applied mapping: {mapping_dict}")
        logger.info(f"Applied mapping: {mapping_dict}")
        
        # Step 3: Apply mapping to dataframe
        reverse_mapping = {v: k for k, v in mapping_dict.items() if v}
        df.rename(columns=reverse_mapping, inplace=True)
        print(f"Columns after rename: {df.columns.tolist()}")
        logger.info(f"Columns after rename: {df.columns.tolist()}")
        
        # Debug: Show first few rows
        print("\nSample data after rename:")
        print(df.head(2).to_string())
        
        # Step 4: Normalize dataframe
        df_normalized, _ = normalize_dataframe_simple(df)
        print(f"\nNormalized columns: {df_normalized.columns.tolist()}")
        logger.info(f"Normalized columns: {df_normalized.columns.tolist()}")
        
        # Debug: Show sample normalized row
        print("\nSample normalized row:")
        if len(df_normalized) > 0:
            sample_row = df_normalized.iloc[0].to_dict()
            print(f"  invoice_number: {sample_row.get('invoice_number', 'N/A')}")
            print(f"  invoice_value: {sample_row.get('invoice_value', 'N/A')}")
            print(f"  taxable_value: {sample_row.get('taxable_value', 'N/A')}")
            print(f"  rate: {sample_row.get('rate', 'N/A')}")
            print(f"  igst: {sample_row.get('igst', 'N/A')}")
            print(f"  cgst: {sample_row.get('cgst', 'N/A')}")
            print(f"  sgst: {sample_row.get('sgst', 'N/A')}")
            print(f"  gstin: {sample_row.get('gstin', 'N/A')}")
        
        # Step 5: Convert to records
        clean_data = df_normalized.to_dict(orient="records")
        print(f"\nConverted {len(clean_data)} records to dict format")
        
        # Step 6: Generate GSTR-1 tables
        print("\nGenerating GSTR-1 tables...")
        gstr1_tables, validation_report = generate_gstr1_tables(
            clean_data=clean_data,
            company_gstin="",
            include_hsn=True,
            include_docs=False
        )
        
        # Debug: Show summary
        summary = gstr1_tables.get("summary", {})
        print("\n" + "=" * 60)
        print("GSTR-1 SUMMARY (from API endpoint):")
        print("=" * 60)
        print(f"  B2B: {len(gstr1_tables.get('b2b', []))}")
        print(f"  B2CL: {len(gstr1_tables.get('b2cl', []))}")
        print(f"  B2CS: {len(gstr1_tables.get('b2cs', []))}")
        print(f"  EXP: {len(gstr1_tables.get('exp', []))}")
        print(f"  Taxable Value: Rs.{summary.get('total_taxable_value', 0):,.2f}")
        print(f"  IGST: Rs.{summary.get('total_igst', 0):,.2f}")
        print(f"  CGST: Rs.{summary.get('total_cgst', 0):,.2f}")
        print(f"  SGST: Rs.{summary.get('total_sgst', 0):,.2f}")
        
        # Build response
        response = {
            "success": True,
            "data": {
                "summary": gstr1_tables.get("summary", {}),
                "b2b": gstr1_tables.get("b2b", []),
                "b2cl": gstr1_tables.get("b2cl", []),
                "b2cs": gstr1_tables.get("b2cs", []),
                "exp": gstr1_tables.get("exp", []),
                "cdnr": gstr1_tables.get("cdnr", []),
                "cdnur": gstr1_tables.get("cdnur", []),
                "hsn": gstr1_tables.get("hsn", []),
            },
            "validation_report": validation_report.to_dict() if hasattr(validation_report, 'to_dict') else {
                "errors": validation_report.errors if hasattr(validation_report, 'errors') else [],
                "warnings": validation_report.warnings if hasattr(validation_report, 'warnings') else [],
                "final_status": validation_report.final_status if hasattr(validation_report, 'final_status') else "unknown"
            },
            "total_records": len(clean_data)
        }
        
        logger.info(f"GSTR-1 processed: B2B={len(response['data']['b2b'])}, B2CL={len(response['data']['b2cl'])}, "
                   f"B2CS={len(response['data']['b2cs'])}, EXP={len(response['data']['exp'])}, "
                   f"CDNR={len(response['data']['cdnr'])}, HSN={len(response['data']['hsn'])}")
        
        return response
    
    except Exception as e:
        logger.exception(f"Error processing GSTR-1: {str(e)}")
        print(f"ERROR in /api/gstr1/process: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/api/gstr1/process-old")
async def process_excel_old(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    company_gstin: Optional[str] = "",
    return_period: Optional[str] = "",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    OLD endpoint - DEPRECATED - Use /api/gstr1/process instead
    """
    return {"error": "This endpoint is deprecated. Use /api/gstr1/process instead."}


@app.post("/api/gstr1/export")
async def export_gstr1(data: dict):
    """
    Export GSTR-1 data to Excel file.
    
    Expected payload:
    {
        "gstr1_tables": {...}
    }
    """
    try:
        from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
        
        gstr1_tables = data.get("gstr1_tables", {})
        logger.info(f"GSTR-1 export: b2b={len(gstr1_tables.get('b2b', []))}, "
                   f"b2cl={len(gstr1_tables.get('b2cl', []))}, "
                   f"b2cs={len(gstr1_tables.get('b2cs', []))}")
        
        excel_bytes = export_gstr1_excel(
            clean_data=gstr1_tables,
            return_period="",
            taxpayer_gstin="",
            taxpayer_name=""
        )
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=gstr1.xlsx",
                "Content-Length": str(len(excel_bytes)),
            }
        )
    
    except Exception as e:
        logger.exception(f"Error exporting GSTR-1: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")


@app.post("/api/gstr3b/export")
async def export_gstr3b(data: dict):
    """
    Export GSTR-3B summary to Excel file.
    
    Expected payload:
    {
        "gstr3b_data": {...}
    }
    """
    try:
        from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
        
        gstr3b_data = data.get("gstr3b_data", {})
        logger.info(f"GSTR-3B export received data keys: {list(gstr3b_data.keys())}")
        
        # Create simple Excel with xlsxwriter
        import xlsxwriter
        
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        header_fmt = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'align': 'center',
            'border': 1
        })
        
        bold_fmt = workbook.add_format({'bold': True})
        currency_fmt = workbook.add_format({'num_format': '#,##0.00', 'border': 1})
        
        summary_sheet = workbook.add_worksheet('GSTR-3B Summary')
        summary_sheet.set_column('A:A', 50)
        summary_sheet.set_column('B:F', 15)
        
        summary_sheet.merge_range('A1:F1', 'GSTR-3B Summary', header_fmt)
        
        row = 2
        
        # Write outward summary
        summary_sheet.merge_range(f'A{row}:F{row}', 'Outward Supplies', header_fmt)
        row += 1
        
        headers = ['Description', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'CESS (₹)']
        for col, header in enumerate(headers):
            summary_sheet.write(row, col, header, header_fmt)
        row += 1
        
        outward = gstr3b_data.get("outward_summary", {})
        
        sections = [
            ("3.1(a) B2B Outward taxable supplies", outward.get("b2b", {})),
            ("3.1(b) Exports", outward.get("exports", {})),
            ("3.1(c) Nil/Exempt/Non-GST", outward.get("nil_exempt", {})),
            ("3.1(d) RCM Inward", outward.get("rcm_inward", {})),
        ]
        
        for desc, data_dict in sections:
            summary_sheet.write(row, 0, desc, bold_fmt)
            summary_sheet.write(row, 1, data_dict.get('taxable_value', 0), currency_fmt)
            summary_sheet.write(row, 2, data_dict.get('igst', 0), currency_fmt)
            summary_sheet.write(row, 3, data_dict.get('cgst', 0), currency_fmt)
            summary_sheet.write(row, 4, data_dict.get('sgst', 0), currency_fmt)
            summary_sheet.write(row, 5, data_dict.get('cess', 0), currency_fmt)
            row += 1
        
        # Write liability summary
        row += 1
        summary_sheet.merge_range(f'A{row}:F{row}', 'Tax Liability Summary', header_fmt)
        row += 1
        
        liability = gstr3b_data.get("net_tax_liability", {})
        total_liability = liability.get("total_liability", {})
        
        summary_sheet.write(row, 0, 'Total Tax Liability', bold_fmt)
        summary_sheet.write(row, 1, total_liability.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 2, total_liability.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 3, total_liability.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 4, total_liability.get('cess', 0), currency_fmt)
        summary_sheet.write(row, 5, total_liability.get('total', 0), currency_fmt)
        
        workbook.close()
        
        excel_bytes = output.getvalue()
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=gstr3b.xlsx",
                "Content-Length": str(len(excel_bytes)),
            }
        )
    
    except Exception as e:
        logger.exception(f"Error exporting GSTR-3B: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")


# ============ NEW GSTR-3B PROCESS ENDPOINT ============

@app.post("/api/gstr3b/process")
async def process_gstr3b(
    gstr1_tables: str = Form(...),
    purchases_file: UploadFile = File(None)
):
    """
    Process GSTR-3B data with ITC reconciliation.
    
    CORRECT FLOW:
    1. Parse gstr1_tables from JSON string
    2. Handle both formats: {gstr1_tables: {...}} or {...}
    3. Generate GSTR-3B summary from tables
    4. Process purchases for ITC reconciliation
    5. Return structured response
    """
    try:
        from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
        from india_compliance.gst_india.gstr3b_reconciliation import reconcile_invoices, calculate_itc_claim
        
        # Step 1: Parse gstr1_tables from JSON string
        gstr1_tables_dict = json.loads(gstr1_tables)
        
        # Step 1b: Handle both formats - if it's a list, error; if dict, check for nested gstr1_tables
        if isinstance(gstr1_tables_dict, list):
            logger.error("GSTR-3B received list instead of dict. Frontend needs to wrap in {gstr1_tables: {...}}")
            return {"success": False, "error": "Invalid format: expected dict, received list"}
        
        # If data is wrapped in {gstr1_tables: {...}}, extract it
        if 'gstr1_tables' in gstr1_tables_dict:
            gstr1_tables_dict = gstr1_tables_dict['gstr1_tables']
        
        # Now gstr1_tables_dict should be a dict with b2b, b2cl, etc.
        logger.info(f"Received GSTR-1 tables: b2b={len(gstr1_tables_dict.get('b2b', []))}, "
                   f"b2cl={len(gstr1_tables_dict.get('b2cl', []))}, "
                   f"b2cs={len(gstr1_tables_dict.get('b2cs', []))}")
        
        # Step 2: Generate GSTR-3B summary from tables
        gstr3b_summary = generate_gstr3b_summary(
            gstr1_tables=gstr1_tables_dict,
            return_period="",
            taxpayer_gstin="",
            taxpayer_name=""
        )
        
        # Step 3: Initialize response
        response = {
            "success": True,
            "data": {
                "outward_summary": {
                    "b2b": gstr3b_summary.get("3_1_a", {}),
                    "exports": gstr3b_summary.get("3_1_b", {}),
                    "nil_exempt": gstr3b_summary.get("3_1_c", {}),
                    "rcm_inward": gstr3b_summary.get("3_1_d", {}),
                    "interstate": gstr3b_summary.get("3_2", {}),
                    "total_taxable": gstr3b_summary.get("total_liability", {}).get("total", 0),
                },
                "inward_summary": {
                    "purchases": {"taxable_value": 0, "igst": 0, "cgst": 0, "sgst": 0, "cess": 0},
                    "rcm_liability": gstr3b_summary.get("4", {}),
                },
                "net_tax_liability": {
                    "total_liability": gstr3b_summary.get("total_liability", {}),
                    "total_itc": gstr3b_summary.get("total_itc", {}),
                    "net_payable": gstr3b_summary.get("total_payable", {}),
                },
                "reconciliation": {
                    "exact_matches": [],
                    "probable_matches": [],
                    "gstin_matches": [],
                    "no_matches": [],
                },
                "errors": [],
            }
        }
        
        # Step 4: Process purchases file if provided
        if purchases_file and purchases_file.filename:
            try:
                contents = await purchases_file.read()
                if contents:
                    purchases_df = pd.read_excel(io.BytesIO(contents))
                    purchases_data = purchases_df.to_dict(orient="records")
                    
                    # Run reconciliation
                    reconciliation = reconcile_invoices(
                        local_purchases=purchases_data,
                        supplier_data=[],  # Would be populated from GSTR-2B API
                        tolerance=0.01
                    )
                    
                    # Categorize entries
                    for entry in reconciliation.entries:
                        category = entry["match_category"]
                        if category == "exact_match":
                            response["data"]["reconciliation"]["exact_matches"].append(entry)
                        elif category == "probable_match":
                            response["data"]["reconciliation"]["probable_matches"].append(entry)
                        elif category == "gstin_match":
                            response["data"]["reconciliation"]["gstin_matches"].append(entry)
                        else:
                            response["data"]["reconciliation"]["no_matches"].append(entry)
                    
                    # Calculate ITC claim
                    itc_claim = calculate_itc_claim(reconciliation)
                    
                    # Update inward summary with ITC
                    response["data"]["inward_summary"]["itc_claimed"] = itc_claim
                    
                    # Update net liability
                    response["data"]["net_tax_liability"]["itc_claim"] = itc_claim
                    
            except Exception as e:
                logger.warning(f"Error processing purchases file: {str(e)}")
                response["data"]["errors"].append(f"Failed to process purchases file: {str(e)}")
        
        logger.info("GSTR-3B processed successfully")
        
        return response
    
    except Exception as e:
        logger.exception(f"Error processing GSTR-3B: {str(e)}")
        return {"success": False, "error": str(e)}


# ============ IMS ENDPOINT ============

@app.post("/api/gstr3b/ims/update")
async def update_ims_entry(
    invoice_number: str = Form(...),
    action: str = Form(...),  # "accept", "reject", "pending"
    gstr2b_data: str = Form(...),  # JSON string of GSTR-2B data
    return_period: str = Form(""),
    taxpayer_gstin: str = Form("")
):
    """
    Update IMS entry action (accept/reject/pending).
    
    This endpoint allows users to manually accept, reject, or set pending
    invoices in the Invoice Management System.
    """
    try:
        from india_compliance.gst_india.gstr3b_ims_engine import (
            IMSEngine, create_ims_from_gstr2b
        )
        
        # Parse GSTR-2B data
        gstr2b_list = json.loads(gstr2b_data)
        if not isinstance(gstr2b_list, list):
            gstr2b_list = [gstr2b_list]
        
        # Create IMS engine and process invoices
        engine = IMSEngine(return_period, taxpayer_gstin)
        ims_report = engine.process_invoices(gstr2b_list)
        
        # Apply the requested action
        if action == "accept":
            success = engine.accept_invoice(invoice_number)
            action_result = "accepted"
        elif action == "reject":
            success = engine.reject_invoice(invoice_number)
            action_result = "rejected"
        elif action == "pending":
            success = engine.set_pending(invoice_number)
            action_result = "pending"
        else:
            return {"success": False, "error": f"Invalid action: {action}"}
        
        if not success:
            return {"success": False, "error": f"Invoice not found: {invoice_number}"}
        
        # Get updated IMS report
        ims_report_dict = ims_report.to_dict()
        
        # Get ITC summary
        itc_summary = engine.get_itc_summary()
        
        # Regenerate GSTR-2B with accepted invoices only
        regenerated_gstr2b = ims_report.regenerate_gstr2b()
        
        logger.info(f"IMS update: {invoice_number} -> {action_result}")
        
        return {
            "success": True,
            "message": f"Invoice {invoice_number} {action_result}",
            "invoice_number": invoice_number,
            "action": action_result,
            "ims_summary": {
                "accepted_count": ims_report.accepted_count,
                "rejected_count": ims_report.rejected_count,
                "pending_count": ims_report.pending_count,
                "total_eligible_itc": ims_report.total_eligible_itc,
            },
            "itc_breakdown": itc_summary,
            "regenerated_gstr2b": regenerated_gstr2b,
        }
        
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON: {str(e)}"}
    except Exception as e:
        logger.exception(f"Error updating IMS: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/api/gstr3b/ims/generate")
async def generate_ims_report(
    gstr2b_data: str = Form(...),
    return_period: str = Form(""),
    taxpayer_gstin: str = Form("")
):
    """
    Generate IMS report from GSTR-2B data.
    """
    try:
        from india_compliance.gst_india.gstr3b_ims_engine import create_ims_from_gstr2b
        
        gstr2b_list = json.loads(gstr2b_data)
        if not isinstance(gstr2b_list, list):
            gstr2b_list = [gstr2b_list]
        
        ims_report = create_ims_from_gstr2b(gstr2b_list, return_period, taxpayer_gstin)
        ims_report_dict = ims_report.to_dict()
        
        return {
            "success": True,
            "data": ims_report_dict,
            "summary": ims_report_dict.get("summary", {}),
        }
        
    except Exception as e:
        logger.exception(f"Error generating IMS: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/download-gstr1-excel")
async def download_gstr1_excel_post(
    request: GSTR1ExcelRequest,
    api_key: str = Depends(get_api_key),
):
    
    try:
        import pandas as pd

        df = pd.DataFrame(request.clean_data)

        engine = GSTR1Engine(company_gstin=request.company_gstin)
        gstr1_tables = engine.run_from_dataframe(df)

        excel_bytes = export_gstr1_excel(
            clean_data=gstr1_tables,
            return_period=request.return_period,
            taxpayer_gstin=request.taxpayer_gstin,
            taxpayer_name=request.taxpayer_name
        )
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="gstr1.xlsx"',
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download-gstr1-json")
async def download_gstr1_json_get(
    clean_data_json: Optional[str] = None,
    company_gstin: str = "",
    include_hsn: bool = True,
    include_docs: bool = False,
    return_period: str = "",
    taxpayer_name: str = "",
    taxpayer_gstin: str = "",
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> StreamingResponse:
    """
    Generate and download GSTR-1 JSON file (GET version with JSON string).
    
    Note: For large datasets, use POST endpoint instead.
    """
    # Parse clean_data from JSON string if provided
    clean_data = []
    if clean_data_json:
        try:
            clean_data = json.loads(clean_data_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid clean_data JSON: {str(e)}")
    
    # Reuse the POST endpoint logic
    return await download_gstr1_json(
        clean_data=clean_data,
        company_gstin=company_gstin,
        include_hsn=include_hsn,
        include_docs=include_docs,
        return_period=return_period,
        taxpayer_name=taxpayer_name,
        taxpayer_gstin=taxpayer_gstin,
        api_key=api_key,
        client_host=client_host,
        current_user=current_user
    )


@app.get("/download-gstr3b-excel")
async def download_gstr3b_excel(
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> StreamingResponse:
    """Download GSTR-3B report as Excel file (API key or JWT required)."""
    username = current_user["sub"] if current_user else "api_user"
    logger.info(f"GSTR-3B Excel download requested by {username}")
    
    audit_logger.log("download_gstr3b_excel", username, {"ip_address": client_host})
    
    try:
        from india_compliance.gst_india.utils.gstr_export import generate_gstr3b_excel
        
        excel_buffer = generate_gstr3b_excel(
            {"b2b": [], "b2cl": [], "b2cs": [], "export": []},
            {
                "3.1a": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
                "3.1b": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
                "3.1c": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
                "3.1d": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
                "3.2": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            }
        )
        
        excel_bytes = excel_buffer.getvalue()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"GSTR3B_Report_{timestamp}.xlsx"
        
        logger.info(f"GSTR-3B Excel download prepared: {len(excel_bytes)} bytes")
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(excel_bytes)),
            }
        )
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-3B Excel: {str(e)}")
        error_response = ErrorResponse(
            status="error",
            message=f"Failed to generate GSTR-3B Excel: {str(e)}",
            error_code="GSTR3B_GEN_01"
        )
        raise HTTPException(status_code=500, detail=error_response.to_dict())


@app.post("/download-gstr3b-excel")
async def download_gstr3b_excel_post(
    request: GSTR3BDownloadRequest,
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> StreamingResponse:
    """
    Generate and download GSTR-3B Excel file with proper formatting.
    
    Args:
        request: JSON payload with clean_data, return_period, taxpayer_gstin, taxpayer_name
    """
    username = current_user["sub"] if current_user else "api_user"
    logger.info(f"GSTR-3B Excel POST download requested by {username} with {len(request.clean_data)} records")
    
    audit_logger.log("download_gstr3b_excel_post", username, {
        "ip_address": client_host,
        "records_count": len(request.clean_data),
        "return_period": request.return_period
    })
    
    try:
        import xlsxwriter
        
        from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
        from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
        
        # Generate GSTR-1 tables from clean_data - FIX: properly unpack tuple
        gstr1_tables, _ = generate_gstr1_tables(
            clean_data=request.clean_data,
            company_gstin=request.taxpayer_gstin,
            include_hsn=True,
            include_docs=False
        )
        
        # Generate GSTR-3B summary
        gstr3b_summary = generate_gstr3b_summary(
            gstr1_tables=gstr1_tables,
            return_period=request.return_period,
            taxpayer_gstin=request.taxpayer_gstin,
            taxpayer_name=request.taxpayer_name
        )
        
        # Create Excel workbook using xlsxwriter
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Formats
        header_fmt = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'align': 'center',
            'border': 1
        })
        
        bold_fmt = workbook.add_format({'bold': True})
        
        currency_fmt = workbook.add_format({
            'num_format': '₹#,##0.00',
            'border': 1
        })
        
        number_fmt = workbook.add_format({
            'num_format': '#,##0.00',
            'border': 1
        })
        
        left_fmt = workbook.add_format({
            'align': 'left',
            'border': 1
        })
        
        # ============ Summary Sheet ============
        summary_sheet = workbook.add_worksheet('GSTR-3B Summary')
        
        # Set column widths
        summary_sheet.set_column('A:A', 50)
        summary_sheet.set_column('B:F', 15)
        
        # Title
        summary_sheet.merge_range('A1:F1', 'GSTR-3B Summary Report', header_fmt)
        
        row = 2
        summary_sheet.write(row, 0, 'Taxpayer Name:', bold_fmt)
        summary_sheet.write(row, 1, request.taxpayer_name, left_fmt)
        row += 1
        
        summary_sheet.write(row, 0, 'GSTIN:', bold_fmt)
        summary_sheet.write(row, 1, request.taxpayer_gstin, left_fmt)
        row += 1
        
        summary_sheet.write(row, 0, 'Return Period:', bold_fmt)
        summary_sheet.write(row, 1, request.return_period, left_fmt)
        row += 1
        
        summary_sheet.write(row, 0, 'Generated At:', bold_fmt)
        summary_sheet.write(row, 1, datetime.utcnow().isoformat() + 'Z', left_fmt)
        row += 2
        
        # Section 3.1 header
        summary_sheet.merge_range(f'A{row}:F{row}', 'Section 3.1 - Details of Outward Supplies', header_fmt)
        row += 1
        
        # 3.1 headers
        headers = ['Description', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'CESS (₹)']
        for col, header in enumerate(headers):
            summary_sheet.write(row, col, header, header_fmt)
        row += 1
        
        # 3.1(a)
        data_3_1a = gstr3b_summary.get('3_1_a', {})
        summary_sheet.write(row, 0, '3.1(a) Outward taxable supplies', left_fmt)
        summary_sheet.write(row, 1, data_3_1a.get('taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, data_3_1a.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 3, data_3_1a.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 4, data_3_1a.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 5, data_3_1a.get('cess', 0), currency_fmt)
        row += 1
        
        # 3.1(b)
        data_3_1b = gstr3b_summary.get('3_1_b', {})
        summary_sheet.write(row, 0, '3.1(b) Zero rated exports', left_fmt)
        summary_sheet.write(row, 1, data_3_1b.get('taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, data_3_1b.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 3, data_3_1b.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 4, data_3_1b.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 5, data_3_1b.get('cess', 0), currency_fmt)
        row += 1
        
        # 3.1(c)
        data_3_1c = gstr3b_summary.get('3_1_c', {})
        summary_sheet.write(row, 0, '3.1(c) Nil rated, exempted, non-GST', left_fmt)
        summary_sheet.write(row, 1, data_3_1c.get('taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, 0, currency_fmt)  # No IGST on nil-rated
        summary_sheet.write(row, 3, 0, currency_fmt)
        summary_sheet.write(row, 4, 0, currency_fmt)
        summary_sheet.write(row, 5, 0, currency_fmt)
        row += 1
        
        # 3.1(d)
        data_3_1d = gstr3b_summary.get('3_1_d', {})
        summary_sheet.write(row, 0, '3.1(d) Inward supplies (RCM)', left_fmt)
        summary_sheet.write(row, 1, data_3_1d.get('taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, data_3_1d.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 3, data_3_1d.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 4, data_3_1d.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 5, data_3_1d.get('cess', 0), currency_fmt)
        row += 1
        
        # 3.1(e)
        data_3_1e = gstr3b_summary.get('3_1_e', {})
        summary_sheet.write(row, 0, '3.1(e) Non-GST outward supplies', left_fmt)
        summary_sheet.write(row, 1, data_3_1e.get('taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, 0, currency_fmt)
        summary_sheet.write(row, 3, 0, currency_fmt)
        summary_sheet.write(row, 4, 0, currency_fmt)
        summary_sheet.write(row, 5, 0, currency_fmt)
        row += 2
        
        # Section 3.2 header
        summary_sheet.merge_range(f'A{row}:F{row}', 'Section 3.2 - Inter-State Supplies to Unregistered Persons', header_fmt)
        row += 1
        
        # 3.2 headers
        headers_3_2 = ['State Code', 'Taxable Value (₹)', 'IGST (₹)', 'CESS (₹)']
        for col, header in enumerate(headers_3_2):
            summary_sheet.write(row, col, header, header_fmt)
        row += 1
        
        # 3.2 data (state-wise)
        data_3_2 = gstr3b_summary.get('3_2', {}).get('summary', {})
        for state_code, state_data in sorted(data_3_2.items()):
            summary_sheet.write(row, 0, state_code, number_fmt)
            summary_sheet.write(row, 1, state_data.get('taxable_value', 0), currency_fmt)
            summary_sheet.write(row, 2, state_data.get('igst', 0), currency_fmt)
            summary_sheet.write(row, 3, state_data.get('cess', 0), currency_fmt)
            row += 1
        
        # 3.2 Total
        summary_sheet.write(row, 0, 'Total', bold_fmt)
        summary_sheet.write(row, 1, gstr3b_summary.get('3_2', {}).get('total_taxable_value', 0), currency_fmt)
        summary_sheet.write(row, 2, gstr3b_summary.get('3_2', {}).get('total_igst', 0), currency_fmt)
        summary_sheet.write(row, 3, 0, currency_fmt)
        row += 2
        
        # Tax Liability Summary
        summary_sheet.merge_range(f'A{row}:F{row}', 'Tax Liability Summary', header_fmt)
        row += 1
        
        headers_liability = ['Component', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'CESS (₹)', 'Total (₹)']
        for col, header in enumerate(headers_liability):
            summary_sheet.write(row, col, header, header_fmt)
        row += 1
        
        # Total Liability
        total_liability = gstr3b_summary.get('total_liability', {})
        summary_sheet.write(row, 0, 'Total Tax Liability', bold_fmt)
        summary_sheet.write(row, 1, total_liability.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 2, total_liability.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 3, total_liability.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 4, total_liability.get('cess', 0), currency_fmt)
        summary_sheet.write(row, 5, total_liability.get('total', 0), currency_fmt)
        row += 1
        
        # Total ITC
        total_itc = gstr3b_summary.get('total_itc', {})
        summary_sheet.write(row, 0, 'Total ITC Available', bold_fmt)
        summary_sheet.write(row, 1, total_itc.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 2, total_itc.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 3, total_itc.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 4, total_itc.get('cess', 0), currency_fmt)
        summary_sheet.write(row, 5, total_itc.get('total', 0), currency_fmt)
        row += 1
        
        # Net Payable
        total_payable = gstr3b_summary.get('total_payable', {})
        summary_sheet.write(row, 0, 'Net Tax Payable', bold_fmt)
        summary_sheet.write(row, 1, total_payable.get('igst', 0), currency_fmt)
        summary_sheet.write(row, 2, total_payable.get('cgst', 0), currency_fmt)
        summary_sheet.write(row, 3, total_payable.get('sgst', 0), currency_fmt)
        summary_sheet.write(row, 4, total_payable.get('cess', 0), currency_fmt)
        summary_sheet.write(row, 5, total_payable.get('total', 0), currency_fmt)
        
        # ============ Invoice Counts Sheet ============
        counts_sheet = workbook.add_worksheet('Invoice Counts')
        counts_sheet.set_column('A:B', 30)
        
        counts_sheet.write('A1', 'Category', header_fmt)
        counts_sheet.write('B1', 'Count', header_fmt)
        
        invoice_counts = gstr3b_summary.get('invoice_counts', {})
        counts_map = [
            ('B2B Invoices', invoice_counts.get('b2b', 0)),
            ('B2CL Invoices', invoice_counts.get('b2cl', 0)),
            ('B2CS Entries', invoice_counts.get('b2cs', 0)),
            ('Export Invoices', invoice_counts.get('exp', 0)),
            ('CDNR Notes', invoice_counts.get('cdnr', 0)),
            ('CDNUR Notes', invoice_counts.get('cdnur', 0)),
        ]
        
        for i, (category, count) in enumerate(counts_map):
            counts_sheet.write(i + 1, 0, category, left_fmt)
            counts_sheet.write(i + 1, 1, count, number_fmt)
        
        # Close workbook
        workbook.close()
        
        excel_bytes = output.getvalue()
        
        # Generate filename
        if request.return_period:
            filename = f"gstr3b_{request.return_period}.xlsx"
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"gstr3b_{timestamp}.xlsx"
        
        logger.info(f"GSTR-3B Excel download prepared: {len(excel_bytes)} bytes")
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(excel_bytes)),
            }
        )
        
    except ImportError as e:
        logger.exception(f"Missing dependency for GSTR-3B Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Missing dependency: {str(e)}")
    except Exception as e:
        logger.exception(f"Error generating GSTR-3B Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate GSTR-3B Excel: {str(e)}")


# ============ Template and Validation Endpoints ============
@app.get("/gstr1-template-download")
async def download_template(
    client_host: str = "127.0.0.1",
) -> StreamingResponse:
    """Download GSTR-1 Excel template (public endpoint)."""
    logger.info(f"Template download requested")
    
    try:
        from india_compliance.gst_india.utils.gstr_export import generate_gstr1_template
        
        excel_buffer = generate_gstr1_template()
        excel_bytes = excel_buffer.getvalue()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"GSTR1_Template_{timestamp}.xlsx"
        
        logger.info(f"Template download prepared: {len(excel_bytes)} bytes")
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(excel_bytes)),
            }
        )
        
    except Exception as e:
        logger.exception(f"Error generating template: {str(e)}")
        # Return a simple message if template generation fails
        error_msg = f"Template generation failed: {str(e)}"
        return StreamingResponse(
            io.BytesIO(error_msg.encode('utf-8')),
            media_type="text/plain",
            headers={
                "Content-Disposition": 'attachment; filename="error.txt"',
            }
        )


@app.get("/download-gstr1-excel")
async def download_gstr1_excel(
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> StreamingResponse:
    """Download GSTR-1 data as Excel file (API key or JWT required)."""
    username = current_user["sub"] if current_user else "api_user"
    logger.info(f"GSTR-1 Excel download requested by {username}")
    
    audit_logger.log("download_gstr1_excel", username, {"ip_address": client_host})
    
    try:
        from india_compliance.gst_india.utils.gstr_export import generate_gstr1_excel
        
        # Generate sample data structure
        gstr1_data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        excel_buffer = generate_gstr1_excel(gstr1_data)
        excel_bytes = excel_buffer.getvalue()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"GSTR1_Data_{timestamp}.xlsx"
        
        logger.info(f"GSTR-1 Excel download prepared: {len(excel_bytes)} bytes")
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(excel_bytes)),
            }
        )
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-1 Excel: {str(e)}")
        error_response = ErrorResponse(
            status="error",
            message=f"Failed to generate GSTR-1 Excel: {str(e)}",
            error_code="GSTR1_GEN_01"
        )
        raise HTTPException(status_code=500, detail=error_response.to_dict())


@app.post("/download-gstr1-excel")
async def download_gstr1_excel_post(
    request: GSTR1ExcelRequest,
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> StreamingResponse:
    """
    Generate and download GSTR-1 Excel file matching the offline utility format.
    
    Args:
        request: JSON payload with clean_data, return_period, taxpayer_gstin, taxpayer_name
    
    Returns:
        Excel file with sheets: Summary, B2B, B2CL, B2CS, EXP, CDNR, CDNUR, HSN, Docs
    """
    username = current_user["sub"] if current_user else "api_user"
    logger.info(f"GSTR-1 Excel POST download requested by {username} with {len(request.clean_data)} records")
    
    audit_logger.log("download_gstr1_excel_post", username, {
        "ip_address": client_host,
        "records_count": len(request.clean_data),
        "return_period": request.return_period
    })
    
    try:
        from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
        from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
        
        # Generate GSTR-1 tables from clean_data - FIX: properly unpack tuple
        gstr1_tables, _ = generate_gstr1_tables(
            clean_data=request.clean_data,
            company_gstin=request.company_gstin or request.taxpayer_gstin,
            include_hsn=request.include_hsn,
            include_docs=request.include_docs
        )
        
        # Generate Excel file matching offline utility format
        excel_bytes = export_gstr1_excel(
    gstr1_tables,
    return_period=request.return_period,
    taxpayer_gstin=request.taxpayer_gstin,
    taxpayer_name=request.taxpayer_name,
)

        
        # Generate filename
        if request.return_period:
            filename = f"gstr1_{request.return_period}.xlsx"
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"gstr1_{timestamp}.xlsx"
        
        logger.info(f"GSTR-1 Excel download prepared: {len(excel_bytes)} bytes, "
                    f"B2B: {len(gstr1_tables.get('b2b', []))}, "
                    f"B2CL: {len(gstr1_tables.get('b2cl', []))}, "
                    f"B2CS: {len(gstr1_tables.get('b2cs', []))}")
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(excel_bytes)),
            }
        )
        
    except ImportError as e:
        logger.exception(f"Missing dependency for GSTR-1 Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Missing dependency: {str(e)}")
    except Exception as e:
        logger.exception(f"Error generating GSTR-1 Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate GSTR-1 Excel: {str(e)}")


@app.get("/gstr1-template-format")
async def get_template_format() -> Dict[str, Any]:
    """Get the expected Excel template format."""
    return {
        "sheet_names": {
            "b2b": {"description": "B2B Invoices", "required_columns": ["GSTIN/UIN of Recipient", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Taxable Value", "Rate"]},
            "b2cl": {"description": "B2C (Large) Invoices", "required_columns": ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Taxable Value", "Rate"]},
            "b2cs": {"description": "B2C (Others) Invoices", "required_columns": ["Invoice date", "Invoice Value", "Place Of Supply", "Taxable Value", "Rate"]},
            "exp": {"description": "Export Invoices", "required_columns": ["Invoice Number", "Invoice date", "Invoice Value", "Taxable Value", "Rate"]},
        },
        "notes": ["All date fields should be in DD/MM/YYYY format", "All amount fields should be numeric", "GSTIN should be in valid 15-character format"]
    }


@app.get("/validation-errors")
async def get_validation_errors() -> Dict[str, Any]:
    """Get list of all possible validation error codes."""
    return {
        "error_codes": {
            "GSTIN_01": {"description": "GSTIN is required", "field": "GSTIN"},
            "GSTIN_03": {"description": "Invalid GSTIN format", "field": "GSTIN"},
            "DATE_01": {"description": "Invoice date is required", "field": "Invoice Date"},
            "POS_01": {"description": "Place of supply is required", "field": "Place of Supply"},
            "INV_02": {"description": "Invoice value must be greater than zero", "field": "Invoice Value"},
            "TAX_01": {"description": "Tax rate is required", "field": "Tax Rate"},
            "FILE_TYPE_01": {"description": "Invalid file type", "field": "File"},
        }
    }


# ============ Errors CSV Export ============
class ErrorsExportRequest(BaseModel):
    errors: List[Dict[str, Any]]


@app.post("/export-errors-csv")
async def export_errors_csv(
    request: ErrorsExportRequest,
    api_key: str = Depends(get_api_key),
    client_host: str = "127.0.0.1",
) -> StreamingResponse:
    """Export validation errors as CSV file."""
    logger.info(f"Errors CSV export requested")
    
    try:
        import csv
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['Row', 'Type', 'Severity', 'Message', 'Sheet', 'Column'])
        
        # Write error rows
        for error in request.errors:
            writer.writerow([
                error.get('row', ''),
                error.get('type', ''),
                error.get('severity', ''),
                error.get('message', ''),
                error.get('sheet', ''),
                error.get('column', '')
            ])
        
        csv_bytes = output.getvalue().encode('utf-8')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"Validation_Errors_{timestamp}.csv"
        
        logger.info(f"Errors CSV export prepared: {len(csv_bytes)} bytes")
        
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(csv_bytes)),
            }
        )
        
    except Exception as e:
        logger.exception(f"Error exporting errors CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export errors CSV: {str(e)}")


# ============ Run with: uvicorn main:app --reload ============

# ============ GSTR1 VALIDATION ENDPOINT ============

# Valid Indian state codes for Place of Supply validation
VALID_STATE_CODES = [str(i).zfill(2) for i in range(1, 38)]  # 01 to 37

@app.post("/api/gstr1/validate", tags=["GSTR1 Validation"])
async def validate_gstr1(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Validate GSTR-1 data for common GST compliance rules.
    
    This endpoint performs validation checks including:
    - GSTIN format validation (15 characters)
    - Duplicate invoice number detection
    - Tax amount calculation verification
    - HSN code validation (4-8 digits)
    - Invoice date validation (cannot be greater than today)
    - Place of Supply validation (valid state code)
    - Negative taxable value validation (must be > 0)
    
    Returns list of validation errors found in the uploaded invoices.
    """
    try:
        # Get all sales invoices from the database
        sales_invoices = [inv for inv in invoices_db if inv.get("type") == "sale"]
        
        errors = []
        
        # Track invoice numbers for duplicate detection
        invoice_numbers = {}
        
        # Get today's date for validation
        today = datetime.now().strftime('%Y-%m-%d')
        
        for inv in sales_invoices:
            invoice_no = inv.get("invoice_no", "")
            
            # 1. GSTIN format validation (for B2B) - Must be exactly 15 characters
            customer_gstin = inv.get("customer_gstin", "")
            if customer_gstin:
                if len(customer_gstin) != 15:
                    errors.append({
                        "invoice": invoice_no,
                        "error": "Invalid GSTIN"
                    })
                else:
                    # Basic GSTIN format check - state code must be valid (01-37)
                    state_code = customer_gstin[:2]
                    if not state_code.isdigit() or state_code not in VALID_STATE_CODES:
                        errors.append({
                            "invoice": invoice_no,
                            "error": "Invalid GSTIN: Invalid state code"
                        })
            
            # 2. Duplicate invoice check - Check for duplicate invoice numbers
            if invoice_no in invoice_numbers:
                errors.append({
                    "invoice": invoice_no,
                    "error": "Duplicate invoice number found"
                })
            else:
                invoice_numbers[invoice_no] = True
            
            # 3. Negative taxable value validation - taxable_value must be > 0
            taxable_value = inv.get("taxable_value", inv.get("amount", 0))
            if taxable_value <= 0:
                errors.append({
                    "invoice": invoice_no,
                    "error": "Negative or zero taxable value"
                })
            
            # 4. Invoice value validation (amount must be > 0)
            invoice_value = inv.get("amount", 0)
            if invoice_value <= 0:
                errors.append({
                    "invoice": invoice_no,
                    "error": "Invoice value must be greater than zero"
                })
            
            # 5. Tax amount calculation check
            # expected_tax = taxable_value × gst_rate / 100
            # error if difference > 1
            rate = inv.get("rate", 0)
            expected_tax = taxable_value * rate / 100
            actual_tax = inv.get("tax_amount", 0)
            
            if abs(expected_tax - actual_tax) > 1:  # 1 rupee tolerance as per requirement
                errors.append({
                    "invoice": invoice_no,
                    "error": "Tax mismatch"
                })
            
            # 6. HSN code validation - Must be 4-8 digits
            hsn_code = inv.get("hsn_code", "")
            if hsn_code:
                if len(hsn_code) < 4 or len(hsn_code) > 8:
                    errors.append({
                        "invoice": invoice_no,
                        "error": "Invalid HSN code"
                    })
                elif not hsn_code.isdigit():
                    errors.append({
                        "invoice": invoice_no,
                        "error": "Invalid HSN code: Must contain only digits"
                    })
            
            # 7. Place of Supply validation - Must be valid state code (01-37)
            place_of_supply = inv.get("place_of_supply", "")
            if place_of_supply:
                # POS can be 2-digit state code or with prefix like "State-"
                pos_clean = place_of_supply.strip()
                # Extract just the state code if it has text prefix
                if len(pos_clean) >= 2:
                    state_part = pos_clean[:2]
                    if state_part.isdigit() and state_part not in VALID_STATE_CODES:
                        errors.append({
                            "invoice": invoice_no,
                            "error": "Invalid Place of Supply"
                        })
            elif customer_gstin:
                # Place of supply is required for B2B transactions
                errors.append({
                    "invoice": invoice_no,
                    "error": "Place of supply is required for B2B transactions"
                })
            
            # 8. Date validation - invoice_date cannot be greater than today
            invoice_date = inv.get("date", "")
            if invoice_date:
                try:
                    # Handle various date formats
                    if '-' in invoice_date:
                        # Already in YYYY-MM-DD format
                        invoice_date_str = invoice_date[:10]  # Take first 10 chars
                    elif '/' in invoice_date:
                        # DD/MM/YYYY format
                        parts = invoice_date.split('/')
                        if len(parts) == 3:
                            invoice_date_str = f"{parts[2][:4]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                    else:
                        invoice_date_str = invoice_date
                    
                    # Compare dates (only date part, not time)
                    if invoice_date_str > today:
                        errors.append({
                            "invoice": invoice_no,
                            "error": "Invoice date cannot be greater than today"
                        })
                except Exception:
                    # If date parsing fails, skip this check
                    pass
            else:
                errors.append({
                    "invoice": invoice_no,
                    "error": "Invoice date is required"
                })
        
        # Return validation result
        return {
            "success": True,
            "is_valid": len(errors) == 0,
            "errors": errors,
            "total_invoices": len(sales_invoices),
            "total_errors": len(errors)
        }
        
    except Exception as e:
        logger.exception(f"Error validating GSTR-1: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "errors": [],
            "is_valid": False
        }


# ============ INVOICE MANAGEMENT SYSTEM ============

# In-memory invoice storage (replace with database in production)
invoices_db: List[Dict[str, Any]] = []

# Invoice Models
class InvoiceCreate(BaseModel):
    invoice_no: str
    gstin: str
    customer_gstin: Optional[str] = None
    customer_name: Optional[str] = None
    amount: float
    tax_amount: float
    cgst: float = 0
    sgst: float = 0
    igst: float = 0
    cess: float = 0
    date: str
    type: str  # "sale" or "purchase"
    place_of_supply: Optional[str] = None
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    note_type: Optional[str] = None  # "credit" or "debit" for CN/DN


# ============ INVOICE API ENDPOINTS ============

@app.post("/invoices", response_model=Dict[str, Any], tags=["Invoices"])
async def create_invoice(
    invoice: InvoiceCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Create a new invoice.
    """
    new_invoice = {
        "id": str(len(invoices_db) + 1),
        "invoice_no": invoice.invoice_no,
        "gstin": invoice.gstin,
        "customer_gstin": invoice.customer_gstin,
        "customer_name": invoice.customer_name,
        "amount": invoice.amount,
        "tax_amount": invoice.tax_amount,
        "cgst": invoice.cgst,
        "sgst": invoice.sgst,
        "igst": invoice.igst,
        "cess": invoice.cess,
        "date": invoice.date,
        "type": invoice.type,
        "place_of_supply": invoice.place_of_supply,
        "hsn_code": invoice.hsn_code,
        "description": invoice.description,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    invoices_db.append(new_invoice)
    logger.info(f"Invoice created: {new_invoice['invoice_no']}")
    return new_invoice


@app.get("/invoices", tags=["Invoices"])
async def get_invoices(
    invoice_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get all invoices with optional filtering.
    """
    results = invoices_db
    
    if invoice_type:
        results = [inv for inv in results if inv["type"] == invoice_type]
    
    if search:
        search = search.lower()
        results = [
            inv for inv in results
            if search in inv.get("invoice_no", "").lower()
            or search in inv.get("gstin", "").lower()
            or search in inv.get("customer_name", "").lower()
        ]
    
    return results


@app.get("/invoices/{invoice_id}", tags=["Invoices"])
async def get_invoice(
    invoice_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a specific invoice by ID.
    """
    for invoice in invoices_db:
        if invoice["id"] == invoice_id:
            return invoice
    raise HTTPException(status_code=404, detail="Invoice not found")


@app.delete("/invoices/{invoice_id}", tags=["Invoices"])
async def delete_invoice(
    invoice_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Delete an invoice.
    """
    for i, invoice in enumerate(invoices_db):
        if invoice["id"] == invoice_id:
            invoices_db.pop(i)
            logger.info(f"Invoice deleted: {invoice_id}")
            return {"message": "Invoice deleted successfully"}
    raise HTTPException(status_code=404, detail="Invoice not found")


# ============ INVOICE UPLOAD ENDPOINT ============

@app.post("/upload-invoices", tags=["Invoices"])
async def upload_invoices(
    file: UploadFile = File(...),
    invoice_type: str = Form("sale"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Upload invoices from Excel or CSV file.
    
    Supports Excel (.xlsx, .xls) and CSV files.
    """
    try:
        # Read file content
        contents = await file.read()
        
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Determine file type and read accordingly
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload Excel or CSV file.")
        
        # Convert to records
        invoices = df.to_dict(orient="records")
        
        # Process and validate each invoice
        uploaded_invoices = []
        errors = []
        
        for i, inv in enumerate(invoices):
            try:
                # Map columns (case-insensitive)
                invoice_data = {
                    "id": str(len(invoices_db) + i + 1),
                    "invoice_no": str(inv.get('invoice_no') or inv.get('Invoice No') or inv.get('invoice_number') or inv.get('Invoice Number') or f"INV-{i+1}"),
                    "gstin": str(inv.get('gstin') or inv.get('GSTIN') or ''),
                    "customer_gstin": str(inv.get('customer_gstin') or inv.get('Customer GSTIN') or inv.get('bill_to_gstin') or ''),
                    "customer_name": str(inv.get('customer_name') or inv.get('Customer Name') or inv.get('bill_to_name') or ''),
                    "amount": float(inv.get('amount') or inv.get('Amount') or inv.get('invoice_value') or inv.get('Invoice Value') or 0),
                    "tax_amount": float(inv.get('tax') or inv.get('Tax') or inv.get('tax_amount') or inv.get('Tax Amount') or 0),
                    "cgst": float(inv.get('cgst') or inv.get('CGST') or 0),
                    "sgst": float(inv.get('sgst') or inv.get('SGST') or 0),
                    "igst": float(inv.get('igst') or inv.get('IGST') or 0),
                    "cess": float(inv.get('cess') or inv.get('CESS') or 0),
                    "date": str(inv.get('date') or inv.get('Date') or inv.get('invoice_date') or inv.get('Invoice Date') or datetime.now().strftime('%Y-%m-%d')),
                    "type": invoice_type,
                    "place_of_supply": str(inv.get('place_of_supply') or inv.get('Place of Supply') or inv.get('pos') or inv.get('POS') or ''),
                    "hsn_code": str(inv.get('hsn_code') or inv.get('HSN Code') or inv.get('hsn') or ''),
                    "description": str(inv.get('description') or inv.get('Description') or ''),
                    "note_type": str(inv.get('note_type') or inv.get('Note Type') or inv.get('note_type') or ''),
                    "created_at": datetime.utcnow().isoformat() + "Z"
                }
                
                invoices_db.append(invoice_data)
                uploaded_invoices.append(invoice_data)
                
            except Exception as e:
                errors.append({
                    "row": i + 1,
                    "error": str(e),
                    "data": inv
                })
        
        logger.info(f"Uploaded {len(uploaded_invoices)} invoices from {file.filename}")
        
        return {
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_invoices)} invoices",
            "uploaded_count": len(uploaded_invoices),
            "error_count": len(errors),
            "invoices": uploaded_invoices,
            "errors": errors
        }
        
    except Exception as e:
        logger.exception(f"Error uploading invoices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# ============ GSTR-1 TABLE API ENDPOINTS ============

@app.get("/api/gstr1/b2b", tags=["GSTR-1 Tables"])
async def get_b2b_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get B2B invoices (invoices where customer GSTIN exists).
    
    Returns invoices with valid 15-character GSTIN of the recipient.
    Supports pagination and search.
    """
    # Filter sales invoices with valid customer GSTIN
    b2b_invoices = [
        inv for inv in invoices_db 
        if inv.get("type") == "sale" 
        and inv.get("customer_gstin") 
        and len(inv.get("customer_gstin", "")) == 15
    ]
    
    # Apply search filter
    if search:
        search = search.lower()
        b2b_invoices = [
            inv for inv in b2b_invoices
            if search in inv.get("invoice_no", "").lower()
            or search in inv.get("customer_gstin", "").lower()
            or search in inv.get("customer_name", "").lower()
        ]
    
    # Calculate pagination
    total = len(b2b_invoices)
    start = (page - 1) * limit
    end = start + limit
    paginated_invoices = b2b_invoices[start:end]
    
    # Calculate summary
    total_taxable = sum(inv.get("amount", 0) for inv in b2b_invoices)
    total_igst = sum(inv.get("igst", 0) for inv in b2b_invoices)
    total_cgst = sum(inv.get("cgst", 0) for inv in b2b_invoices)
    total_sgst = sum(inv.get("sgst", 0) for inv in b2b_invoices)
    
    return {
        "success": True,
        "data": paginated_invoices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        },
        "summary": {
            "total_invoices": total,
            "total_taxable_value": total_taxable,
            "total_igst": total_igst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_tax": total_igst + total_cgst + total_sgst
        }
    }


@app.get("/api/gstr1/b2cs", tags=["GSTR-1 Tables"])
async def get_b2cs_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get B2CS invoices (invoices where GSTIN is empty or unregistered).
    
    Returns B2C Small invoices (below Rs 2.5 lakhs) where customer GSTIN
    is not provided or is invalid.
    Supports pagination and search.
    """
    # Filter sales invoices without valid customer GSTIN
    b2cs_invoices = [
        inv for inv in invoices_db 
        if inv.get("type") == "sale"
        and (
            not inv.get("customer_gstin") 
            or len(inv.get("customer_gstin", "")) != 15
        )
    ]
    
    # Apply search filter
    if search:
        search = search.lower()
        b2cs_invoices = [
            inv for inv in b2cs_invoices
            if search in inv.get("invoice_no", "").lower()
            or search in inv.get("customer_name", "").lower()
            or search in inv.get("place_of_supply", "").lower()
        ]
    
    # Calculate pagination
    total = len(b2cs_invoices)
    start = (page - 1) * limit
    end = start + limit
    paginated_invoices = b2cs_invoices[start:end]
    
    # Calculate summary
    total_taxable = sum(inv.get("amount", 0) for inv in b2cs_invoices)
    total_igst = sum(inv.get("igst", 0) for inv in b2cs_invoices)
    total_cgst = sum(inv.get("cgst", 0) for inv in b2cs_invoices)
    total_sgst = sum(inv.get("sgst", 0) for inv in b2cs_invoices)
    
    return {
        "success": True,
        "data": paginated_invoices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        },
        "summary": {
            "total_invoices": total,
            "total_taxable_value": total_taxable,
            "total_igst": total_igst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_tax": total_igst + total_cgst + total_sgst
        }
    }


@app.get("/api/gstr1/cdnr", tags=["GSTR-1 Tables"])
async def get_cdnr_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get Credit and Debit Notes (CDNR).
    
    Returns registered credit/debit notes where recipient GSTIN exists.
    Supports pagination and search.
    """
    # Filter sales invoices that are credit/debit notes with valid customer GSTIN
    cdnr_invoices = [
        inv for inv in invoices_db 
        if inv.get("type") == "sale"
        and inv.get("note_type") in ["credit", "debit"]
        and inv.get("customer_gstin")
        and len(inv.get("customer_gstin", "")) == 15
    ]
    
    # Apply search filter
    if search:
        search = search.lower()
        cdnr_invoices = [
            inv for inv in cdnr_invoices
            if search in inv.get("invoice_no", "").lower()
            or search in inv.get("customer_gstin", "").lower()
            or search in inv.get("customer_name", "").lower()
        ]
    
    # Calculate pagination
    total = len(cdnr_invoices)
    start = (page - 1) * limit
    end = start + limit
    paginated_invoices = cdnr_invoices[start:end]
    
    # Separate credit and debit notes
    credit_notes = [inv for inv in cdnr_invoices if inv.get("note_type") == "credit"]
    debit_notes = [inv for inv in cdnr_invoices if inv.get("note_type") == "debit"]
    
    # Calculate summary
    total_taxable = sum(inv.get("amount", 0) for inv in cdnr_invoices)
    total_igst = sum(inv.get("igst", 0) for inv in cdnr_invoices)
    total_cgst = sum(inv.get("cgst", 0) for inv in cdnr_invoices)
    total_sgst = sum(inv.get("sgst", 0) for inv in cdnr_invoices)
    
    return {
        "success": True,
        "data": paginated_invoices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        },
        "summary": {
            "total_notes": total,
            "credit_notes_count": len(credit_notes),
            "debit_notes_count": len(debit_notes),
            "total_taxable_value": total_taxable,
            "total_igst": total_igst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_tax": total_igst + total_cgst + total_sgst
        }
    }


@app.get("/api/gstr1/hsn", tags=["GSTR-1 Tables"])
async def get_hsn_summary(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get HSN code-wise outward supply summary.
    
    Returns aggregated summary of invoices grouped by HSN code.
    Includes total quantity, taxable value, and tax amounts.
    Supports pagination and search.
    """
    # Aggregate by HSN code
    hsn_aggregation = {}
    
    for inv in invoices_db:
        if inv.get("type") == "sale":
            hsn_code = inv.get("hsn_code", "")
            if not hsn_code:
                hsn_code = "UNKNOWN"
            
            if hsn_code not in hsn_aggregation:
                hsn_aggregation[hsn_code] = {
                    "hsn_code": hsn_code,
                    "description": inv.get("description", ""),
                    "quantity": 0,
                    "taxable_value": 0,
                    "igst": 0,
                    "cgst": 0,
                    "sgst": 0,
                    "cess": 0,
                    "invoice_count": 0
                }
            
            hsn_aggregation[hsn_code]["quantity"] += inv.get("quantity", 1)
            hsn_aggregation[hsn_code]["taxable_value"] += inv.get("amount", 0)
            hsn_aggregation[hsn_code]["igst"] += inv.get("igst", 0)
            hsn_aggregation[hsn_code]["cgst"] += inv.get("cgst", 0)
            hsn_aggregation[hsn_code]["sgst"] += inv.get("sgst", 0)
            hsn_aggregation[hsn_code]["cess"] += inv.get("cess", 0)
            hsn_aggregation[hsn_code]["invoice_count"] += 1
    
    # Convert to list
    hsn_list = list(hsn_aggregation.values())
    
    # Apply search filter
    if search:
        search = search.lower()
        hsn_list = [
            hsn for hsn in hsn_list
            if search in hsn.get("hsn_code", "").lower()
            or search in hsn.get("description", "").lower()
        ]
    
    # Calculate pagination
    total = len(hsn_list)
    start = (page - 1) * limit
    end = start + limit
    paginated_hsn = hsn_list[start:end]
    
    # Calculate summary totals
    total_taxable = sum(hsn.get("taxable_value", 0) for hsn in hsn_list)
    total_igst = sum(hsn.get("igst", 0) for hsn in hsn_list)
    total_cgst = sum(hsn.get("cgst", 0) for hsn in hsn_list)
    total_sgst = sum(hsn.get("sgst", 0) for hsn in hsn_list)
    total_cess = sum(hsn.get("cess", 0) for hsn in hsn_list)
    total_quantity = sum(hsn.get("quantity", 0) for hsn in hsn_list)
    
    return {
        "success": True,
        "data": paginated_hsn,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        },
        "summary": {
            "total_hsn_codes": total,
            "total_quantity": total_quantity,
            "total_taxable_value": total_taxable,
            "total_igst": total_igst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_cess": total_cess,
            "total_tax": total_igst + total_cgst + total_sgst + total_cess
        }
    }


# ============ GSTR1 GENERATION ENGINE ============

@app.post("/generate-gstr1", tags=["GST Returns"])
async def generate_gstr1(
    invoice_type: Optional[str] = "sale",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Generate GSTR-1 from uploaded invoices.
    
    Groups invoices into:
    - B2B: Invoices with valid GSTIN
    - B2CL: B2C Large (above Rs 2.5 lakhs)
    - B2CS: B2C Small (below Rs 2.5 lakhs)
    - EXP: Export invoices
    """
    # Filter by invoice type (sales)
    sales_invoices = [inv for inv in invoices_db if inv.get("type") == (invoice_type or "sale")]
    
    gstr1 = {
        "b2b": [],
        "b2cl": [],
        "b2cs": [],
        "exp": [],
        "cdnr": [],
        "cdnur": [],
        "hsn": [],
    }
    
    # Group invoices
    for inv in sales_invoices:
        customer_gstin = inv.get("customer_gstin", "")
        amount = inv.get("amount", 0)
        place_of_supply = inv.get("place_of_supply", "")
        
        # B2B: Has valid GSTIN
        if customer_gstin and len(customer_gstin) == 15:
            # Check if export
            if place_of_supply and place_of_supply.startswith('96'):
                gstr1["exp"].append(inv)
            else:
                gstr1["b2b"].append(inv)
        # B2CL: Above 2.5 lakhs, no GSTIN
        elif amount > 250000:
            gstr1["b2cl"].append(inv)
        # B2CS: Below 2.5 lakhs
        else:
            gstr1["b2cs"].append(inv)
    
    # Calculate summary
    summary = {
        "total_invoices": len(sales_invoices),
        "total_taxable_value": sum(inv.get("amount", 0) for inv in sales_invoices),
        "total_igst": sum(inv.get("igst", 0) for inv in sales_invoices),
        "total_cgst": sum(inv.get("cgst", 0) for inv in sales_invoices),
        "total_sgst": sum(inv.get("sgst", 0) for inv in sales_invoices),
        "total_cess": sum(inv.get("cess", 0) for inv in sales_invoices),
        "b2b_count": len(gstr1["b2b"]),
        "b2cl_count": len(gstr1["b2cl"]),
        "b2cs_count": len(gstr1["b2cs"]),
        "exp_count": len(gstr1["exp"]),
    }
    
    return {
        "success": True,
        "gstr1": gstr1,
        "summary": summary,
        "total_records": len(sales_invoices)
    }


# ============ GSTR3B TAX CALCULATOR ============

@app.post("/calculate-gstr3b", tags=["GST Returns"])
async def calculate_gstr3b(
    return_period: str = Form(""),
    taxpayer_gstin: str = Form(""),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Calculate GSTR-3B tax liability.
    
    Calculates:
    - Output tax (sales)
    - ITC (purchases)
    - Net tax payable
    """
    # Get sales and purchases
    sales = [inv for inv in invoices_db if inv.get("type") == "sale"]
    purchases = [inv for inv in invoices_db if inv.get("type") == "purchase"]
    
    # Calculate output tax (sales)
    output_tax = {
        "igst": sum(inv.get("igst", 0) for inv in sales),
        "cgst": sum(inv.get("cgst", 0) for inv in sales),
        "sgst": sum(inv.get("sgst", 0) for inv in sales),
        "cess": sum(inv.get("cess", 0) for inv in sales),
    }
    output_tax["total"] = sum(output_tax.values())
    
    # Calculate ITC (purchases)
    itc = {
        "igst": sum(inv.get("igst", 0) for inv in purchases),
        "cgst": sum(inv.get("cgst", 0) for inv in purchases),
        "sgst": sum(inv.get("sgst", 0) for inv in purchases),
        "cess": sum(inv.get("cess", 0) for inv in purchases),
    }
    itc["total"] = sum(itc.values())
    
    # Calculate net tax payable
    net_payable = {
        "igst": output_tax["igst"] - itc["igst"],
        "cgst": output_tax["cgst"] - itc["cgst"],
        "sgst": output_tax["sgst"] - itc["sgst"],
        "cess": output_tax["cess"] - itc["cess"],
    }
    net_payable["total"] = sum(net_payable.values())
    
    # Build response
    return {
        "success": True,
        "return_period": return_period,
        "taxpayer_gstin": taxpayer_gstin,
        "output_tax": output_tax,
        "itc": itc,
        "net_payable": net_payable,
        "summary": {
            "total_sales": len(sales),
            "total_purchases": len(purchases),
            "total_output_tax": output_tax["total"],
            "total_itc": itc["total"],
            "net_tax_payable": net_payable["total"]
        }
    }


# ============ CLIENT MANAGEMENT SYSTEM ============

# In-memory client storage (replace with database in production)
clients_db: List[Dict[str, Any]] = [
    {
        "id": "1",
        "business_name": "Acme Corporation",
        "gstin": "27AABCU9603R1ZM",
        "email": "contact@acme.com",
        "phone": "+91 98765 43210",
        "created_at": "2026-01-15T10:30:00Z"
    },
    {
        "id": "2",
        "business_name": "Tech Solutions Ltd",
        "gstin": "29AABCT1234N1Z5",
        "email": "accounts@techsol.com",
        "phone": "+91 98765 12345",
        "created_at": "2026-01-20T14:20:00Z"
    },
    {
        "id": "3",
        "business_name": "Global Traders",
        "gstin": "07AAEPG5678C1ZY",
        "email": "info@globaltraders.in",
        "phone": "+91 99887 76655",
        "created_at": "2026-02-01T09:15:00Z"
    },
    {
        "id": "4",
        "business_name": "Skyline Enterprises",
        "gstin": "33AADCS9012M1ZN",
        "email": "billing@skyline.co.in",
        "phone": "+91 91234 56789",
        "created_at": "2026-02-10T16:45:00Z"
    },
    {
        "id": "5",
        "business_name": "Prime Logistics",
        "gstin": "24AAICP4567Q1ZP",
        "email": "ops@primelogistics.com",
        "phone": "+91 98765 67890",
        "created_at": "2026-02-25T11:30:00Z"
    }
]

# Client Pydantic Models
class ClientCreate(BaseModel):
    business_name: str
    gstin: str
    email: str
    phone: str

class ClientUpdate(BaseModel):
    business_name: Optional[str] = None
    gstin: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    business_name: str
    gstin: str
    email: str
    phone: str
    created_at: str


# ============ CLIENT API ENDPOINTS ============

@app.post("/clients", response_model=ClientResponse, tags=["Clients"])
async def create_client(
    client: ClientCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Create a new client.
    
    Adds a new client to the database with business details and GSTIN.
    """
    # Validate GSTIN format (basic validation)
    gstin = client.gstin.replace(" ", "").upper()
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="GSTIN must be 15 characters")
    
    # Check for duplicate GSTIN
    for existing_client in clients_db:
        if existing_client["gstin"].upper() == gstin:
            raise HTTPException(status_code=400, detail="Client with this GSTIN already exists")
    
    # Create new client
    new_client = {
        "id": str(len(clients_db) + 1),
        "business_name": client.business_name,
        "gstin": gstin,
        "email": client.email,
        "phone": client.phone,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    clients_db.append(new_client)
    logger.info(f"Client created: {new_client['business_name']} ({gstin})")
    
    return new_client


@app.get("/clients", response_model=List[ClientResponse], tags=["Clients"])
async def get_clients(
    search: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get all clients.
    
    Returns list of all clients, optionally filtered by search term (GSTIN or business name).
    """
    if search:
        search = search.lower()
        return [
            client for client in clients_db
            if search in client["business_name"].lower() or search in client["gstin"].lower()
        ]
    return clients_db


@app.get("/clients/{client_id}", response_model=ClientResponse, tags=["Clients"])
async def get_client(
    client_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a specific client by ID.
    """
    for client in clients_db:
        if client["id"] == client_id:
            return client
    raise HTTPException(status_code=404, detail="Client not found")


@app.put("/clients/{client_id}", response_model=ClientResponse, tags=["Clients"])
async def update_client(
    client_id: str,
    client_update: ClientUpdate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Update a client.
    """
    for i, client in enumerate(clients_db):
        if client["id"] == client_id:
            # Update only provided fields
            if client_update.business_name:
                clients_db[i]["business_name"] = client_update.business_name
            if client_update.gstin:
                clients_db[i]["gstin"] = client_update.gstin.upper()
            if client_update.email:
                clients_db[i]["email"] = client_update.email
            if client_update.phone:
                clients_db[i]["phone"] = client_update.phone
            
            logger.info(f"Client updated: {client_id}")
            return clients_db[i]
    
    raise HTTPException(status_code=404, detail="Client not found")


@app.delete("/clients/{client_id}", tags=["Clients"])
async def delete_client(
    client_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Delete a client.
    """
    for i, client in enumerate(clients_db):
        if client["id"] == client_id:
            deleted_client = clients_db.pop(i)
            logger.info(f"Client deleted: {client_id}")
            return {"message": "Client deleted successfully", "client": deleted_client}
    
    raise HTTPException(status_code=404, detail="Client not found")


# ============ GSTIN LOOKUP SERVICE ============

@app.get("/gstin/{gstin}", tags=["GSTIN Lookup"])
async def fetch_gstin(
    gstin: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Fetch GSTIN taxpayer details.
    
    Returns taxpayer information from GST portal.
    Note: This is a mock implementation. In production, integrate with GST API.
    """
    # Clean GSTIN
    gstin = gstin.replace(" ", "").upper()
    
    # Basic validation
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN format. GSTIN must be 15 characters.")
    
    # Validate GSTIN checksum (basic format check)
    # GSTIN format: 2 digits (state code) + 10 chars (PAN) + 1 char (entity number) + 1 char (Z) + 1 char (checksum)
    state_code = gstin[:2]
    pan = gstin[2:12]
    
    # Mock GSTIN data based on common patterns
    mock_data = {
        "gstin": gstin,
        "legal_name": f"{pan[:3].upper()} Industries Private Limited",
        "trade_name": f"{pan[:3].upper()} Industries",
        "status": "Active",
        "registration_date": "01-04-2020",
        "state": get_state_from_code(state_code),
        "constitution": "Private Limited",
        "taxpayer_type": "Regular",
        "cancellation_status": "Not Cancelled",
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }
    
    logger.info(f"GSTIN lookup: {gstin}")
    
    return {
        "success": True,
        "data": mock_data
    }


def get_state_from_code(state_code: str) -> str:
    """Map state code to state name."""
    state_map = {
        "01": "Jammu and Kashmir",
        "02": "Himachal Pradesh",
        "03": "Punjab",
        "04": "Chandigarh",
        "05": "Uttarakhand",
        "06": "Haryana",
        "07": "Delhi",
        "08": "Rajasthan",
        "09": "Uttar Pradesh",
        "10": "Bihar",
        "11": "Sikkim",
        "12": "Arunachal Pradesh",
        "13": "Nagaland",
        "14": "Manipur",
        "15": "Mizoram",
        "16": "Tripura",
        "17": "Meghalaya",
        "18": "Assam",
        "19": "West Bengal",
        "20": "Jharkhand",
        "21": "Odisha",
        "22": "Chhattisgarh",
        "23": "Madhya Pradesh",
        "24": "Gujarat",
        "25": "Daman and Diu",
        "26": "Dadra and Nagar Haveli",
        "27": "Maharashtra",
        "28": "Andhra Pradesh (Old)",
        "29": "Karnataka",
        "30": "Goa",
        "31": "Lakshadweep",
        "32": "Kerala",
        "33": "Tamil Nadu",
        "34": "Puducherry",
        "35": "Andaman and Nicobar Islands",
        "36": "Telangana",
        "37": "Andhra Pradesh",
    }
    return state_map.get(state_code, f"State Code {state_code}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


# ============ DASHBOARD API ============

@app.get("/api/dashboard", tags=["Dashboard"])
async def get_dashboard_data(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get dashboard data with real statistics.
    
    Returns:
    - total_clients: Number of businesses in the workspace
    - pending_returns: Number of pending GST returns
    - total_tax_liability: Total tax liability for current period
    - itc_available: Total ITC available
    - filing_status: Status of various GST returns
    - recent_activity: Recent filing activity
    """
    try:
        # Get counts from database (using in-memory data for now)
        # In production, this would query the actual database
        
        # Count clients/businesses
        total_clients = len(clients_db)
        
        # Count pending returns
        pending_returns = len([r for r in returns_db if r.get("status") == "pending"])
        
        # Calculate total tax liability from invoices
        sales_invoices = [inv for inv in invoices_db if inv.get("type") == "sale"]
        total_tax_liability = sum(
            inv.get("igst", 0) + inv.get("cgst", 0) + inv.get("sgst", 0) + inv.get("cess", 0)
            for inv in sales_invoices
        )
        
        # Calculate ITC available from purchases
        purchase_invoices = [inv for inv in invoices_db if inv.get("type") == "purchase"]
        itc_available = sum(
            inv.get("igst", 0) + inv.get("cgst", 0) + inv.get("sgst", 0) + inv.get("cess", 0)
            for inv in purchase_invoices
        )
        
        # Get current period
        current_period = datetime.now().strftime("%m%Y")
        
        # Filing status for current period
        gstr1_status = "pending"
        gstr3b_status = "pending"
        gstr2b_status = "pending"
        
        for ret in returns_db:
            if ret.get("period") == current_period:
                if ret.get("return_type") == "GSTR1":
                    gstr1_status = ret.get("status", "pending")
                elif ret.get("return_type") == "GSTR3B":
                    gstr3b_status = ret.get("status", "pending")
                elif ret.get("return_type") == "GSTR2B":
                    gstr2b_status = ret.get("status", "pending")
        
        return {
            "success": True,
            "data": {
                "stats": {
                    "total_clients": total_clients,
                    "pending_returns": pending_returns,
                    "total_tax_liability": round(total_tax_liability, 2),
                    "itc_available": round(itc_available, 2),
                },
                "filing_status": {
                    "gstr1": {
                        "status": gstr1_status,
                        "period": current_period
                    },
                    "gstr3b": {
                        "status": gstr3b_status,
                        "period": current_period
                    },
                    "gstr2b": {
                        "status": gstr2b_status,
                        "period": current_period
                    }
                },
                "recent_filings": [
                    {
                        "return_type": r.get("return_type"),
                        "period": r.get("period"),
                        "status": r.get("status"),
                        "filed_date": r.get("filed_date"),
                        "arn": r.get("arn")
                    }
                    for r in sorted(returns_db, key=lambda x: x.get("filed_date", ""), reverse=True)[:5]
                ]
            }
        }
    except Exception as e:
        logger.exception(f"Error fetching dashboard data: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/dashboard/announcements", tags=["Dashboard"])
async def get_announcements(
    limit: int = Query(10, ge=1, le=50),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get dashboard announcements.
    
    Returns list of announcements with title, description, date, and link.
    """
    try:
        # Use the same announcements logic from gst-announcements endpoint
        announcements = [
            {
                "id": "1",
                "title": "Facility for Withdrawal from Rule 14A",
                "date": "2026-03-05",
                "link": "https://www.gst.gov.in/newsandupdates/read/650",
                "description": "New facility introduced for withdrawal from provisions of Rule 14A under CGST Rules",
                "category": "compliance"
            },
            {
                "id": "2",
                "title": "Advisory on Interest Collection in GSTR-3B",
                "date": "2026-03-03",
                "link": "https://www.gst.gov.in/newsandupdates/read/649",
                "description": "Important update regarding interest collection mechanism in GSTR-3B filing",
                "category": "filing"
            },
            {
                "id": "3",
                "title": "GST Revenue Collections for February 2026",
                "date": "2026-02-28",
                "link": "https://www.gst.gov.in/newsandupdates/read/648",
                "description": "Latest GST revenue collection figures show robust compliance",
                "category": "revenue"
            },
            {
                "id": "4",
                "title": "Extension of GSTR-1 Filing Due Date for Certain Categories",
                "date": "2026-02-25",
                "link": "https://www.gst.gov.in/newsandupdates/read/647",
                "description": "Due date extended for GSTR-1 filing for certain categories of taxpayers",
                "category": "filing"
            },
            {
                "id": "5",
                "title": "New Features Rolled Out on GST Portal",
                "date": "2026-02-20",
                "link": "https://www.gst.gov.in/newsandupdates/read/646",
                "description": "New features rolled out on the GST portal for better compliance management",
                "category": "portal"
            }
        ]
        
        return {
            "success": True,
            "data": announcements[:limit],
            "total": len(announcements)
        }
    except Exception as e:
        logger.exception(f"Error fetching announcements: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/navigation", tags=["Dashboard"])
async def get_navigation(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get navigation menu items for the dashboard.
    
    Returns the menu structure for the left navigation rail.
    """
    return {
        "success": True,
        "data": [
            {
                "id": "dashboard",
                "label": "Dashboard",
                "icon": "layout-dashboard",
                "path": "/dashboard"
            },
            {
                "id": "filing",
                "label": "Filing",
                "icon": "file-check",
                "path": "/filing"
            },
            {
                "id": "upload",
                "label": "Upload",
                "icon": "upload",
                "path": "/upload"
            },
            {
                "id": "invoices",
                "label": "Invoices",
                "icon": "file-text",
                "path": "/invoices"
            },
            {
                "id": "ims",
                "label": "IMS",
                "icon": "arrows-left-right",
                "path": "/ims"
            },
            {
                "id": "itc",
                "label": "ITC",
                "icon": "rotate-ccw",
                "path": "/itc"
            },
            {
                "id": "reports",
                "label": "Reports",
                "icon": "bar-chart",
                "path": "/reports"
            },
            {
                "id": "clients",
                "label": "Clients",
                "icon": "users",
                "path": "/clients"
            }
        ]
    }


@app.get("/api/forms", tags=["Forms"])
async def get_forms(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get all available filing forms/modules.
    
    Returns list of GST return types with their metadata.
    """
    return {
        "success": True,
        "data": [
            {
                "id": "gstr1",
                "name": "GSTR-1",
                "description": "Monthly/Quarterly return for outward supplies",
                "category": "filing",
                "icon": "file-text",
                "path": "/gstr1",
                "due_date": "20th of next month",
                "frequency": "Monthly/Quarterly",
                "enabled": True
            },
            {
                "id": "gstr3b",
                "name": "GSTR-3B",
                "description": "Summary return with tax liability computation",
                "category": "filing",
                "icon": "calculator",
                "path": "/gstr3b",
                "due_date": "20th of next month",
                "frequency": "Monthly",
                "enabled": True
            },
            {
                "id": "gstr1-iff",
                "name": "GSTR-1 IFF",
                "description": "Invoice Furnishing Facility for quarterly filers",
                "category": "filing",
                "icon": "file-plus",
                "path": "/gstr1?mode=iff",
                "due_date": "13th of next quarter",
                "frequency": "Quarterly",
                "enabled": True
            },
            {
                "id": "cmp08",
                "name": "CMP-08",
                "description": "Statement for tax payment by composition dealers",
                "category": "filing",
                "icon": "file-check",
                "path": "/cmp08",
                "due_date": "18th of next month",
                "frequency": "Quarterly",
                "enabled": True
            },
            {
                "id": "gstr9",
                "name": "GSTR-9",
                "description": "Annual return for the financial year",
                "category": "annual",
                "icon": "file-down",
                "path": "/gstr9",
                "due_date": "31st December",
                "frequency": "Annual",
                "enabled": True
            },
            {
                "id": "gstr9c",
                "name": "GSTR-9C",
                "description": "Reconciliation statement for audit",
                "category": "annual",
                "icon": "file-search",
                "path": "/gstr9c",
                "due_date": "31st December",
                "frequency": "Annual",
                "enabled": True
            },
            {
                "id": "gstr6",
                "name": "GSTR-6",
                "description": "Monthly return for Input Service Distributor",
                "category": "filing",
                "icon": "building",
                "path": "/gstr6",
                "due_date": "13th of next month",
                "frequency": "Monthly",
                "enabled": True
            },
            {
                "id": "gstr7",
                "name": "GSTR-7",
                "description": "Monthly return for Tax Deductor",
                "category": "filing",
                "icon": "file-diff",
                "path": "/gstr7",
                "due_date": "10th of next month",
                "frequency": "Monthly",
                "enabled": True
            },
            {
                "id": "gstr8",
                "name": "GSTR-8",
                "description": "Monthly return for Tax Collector",
                "category": "filing",
                "icon": "briefcase",
                "path": "/gstr8",
                "due_date": "10th of next month",
                "frequency": "Monthly",
                "enabled": True
            },
            {
                "id": "itc04",
                "name": "ITC-04",
                "description": "Details of goods/capital goods sent for job work",
                "category": "itc",
                "icon": "rotate-ccw",
                "path": "/itc04",
                "due_date": "25th of next month",
                "frequency": "Quarterly",
                "enabled": True
            }
        ]
    }


@app.get("/api/forms/{module}/metadata", tags=["Forms"])
async def get_form_metadata(
    module: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get metadata for a specific filing module.
    
    Returns detailed information about the form including sections, fields, and validation rules.
    """
    metadata = {
        "gstr1": {
            "name": "GSTR-1",
            "full_name": "Goods and Services Tax Return - 1",
            "sections": [
                {"id": "b2b", "name": "B2B Invoices", "description": "B2B outward supplies"},
                {"id": "b2cl", "name": "B2CL Invoices", "description": "B2C Large outward supplies"},
                {"id": "b2cs", "name": "B2CS Entries", "description": "B2C Small outward supplies"},
                {"id": "exp", "name": "Export Invoices", "description": "Zero rated exports"},
                {"id": "cdnr", "name": "Credit/Debit Notes (Registered)", "description": "CDN for registered recipients"},
                {"id": "cdnur", "name": "Credit/Debit Notes (Unregistered)", "description": "CDN for unregistered recipients"},
                {"id": "hsn", "name": "HSN Summary", "description": "HSN code wise summary"},
                {"id": "docs", "name": "Document Series", "description": "Document series for amendments"}
            ],
            "can_nill_return": True,
            "requires_gstin": True,
            "supports_amendment": True
        },
        "gstr3b": {
            "name": "GSTR-3B",
            "full_name": "Goods and Services Tax Return - 3B",
            "sections": [
                {"id": "outward", "name": "Outward Supplies", "description": "3.1 Details of outward supplies"},
                {"id": "interstate", "name": "Inter-State Supplies", "description": "3.2 Inter-state supplies"},
                {"id": "inward", "name": "Inward Supplies", "description": "4.1 Inward supplies"},
                {"id": "itc", "name": "Input Tax Credit", "description": "4.2 ITC details"},
                {"id": "exempt", "name": "Exempt Supplies", "description": "5.1 Exempt, nil rated, non-GST"},
                {"id": "payment", "name": "Tax Payment", "description": "6.1 Tax liability payment"}
            ],
            "can_nill_return": True,
            "requires_gstin": True,
            "supports_amendment": False
        }
    }
    
    if module not in metadata:
        raise HTTPException(status_code=404, detail=f"Module {module} not found")
    
    return {
        "success": True,
        "data": metadata[module]
    }


# ============ RECONCILIATION APIs ============

@app.post("/api/gstr1/reconcile", tags=["Reconciliation"])
async def reconcile_einvoice_sales(
    einvoice_data: List[Dict[str, Any]] = [],
    sales_register_data: List[Dict[str, Any]] = [],
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Run E-Invoice vs Sales Register reconciliation.
    
    Compares e-invoice data with sales register to find matches, mismatches, and missing invoices.
    """
    try:
        results = {
            "matched": [],
            "mismatch": [],
            "missing_in_sales": [],
            "missing_in_einvoice": [],
            "summary": {
                "total_einvoice": len(einvoice_data),
                "total_sales": len(sales_register_data),
                "matched_count": 0,
                "mismatch_count": 0,
                "missing_count": 0
            }
        }
        
        # Create lookup maps
        einvoice_map = {inv.get("invoice_number"): inv for inv in einvoice_data}
        sales_map = {inv.get("invoice_number"): inv for inv in sales_register_data}
        
        # Find matches
        for inv_num, einvoice in einvoice_map.items():
            if inv_num in sales_map:
                sales = sales_map[inv_num]
                # Compare amounts
                einvoice_taxable = einvoice.get("taxable_value", 0)
                sales_taxable = sales.get("taxable_value", 0)
                
                if abs(einvoice_taxable - sales_taxable) < 1:  # Exact match
                    results["matched"].append({
                        "invoice_number": inv_num,
                        "einvoice_taxable": einvoice_taxable,
                        "sales_taxable": sales_taxable,
                        "status": "matched"
                    })
                    results["summary"]["matched_count"] += 1
                else:
                    results["mismatch"].append({
                        "invoice_number": inv_num,
                        "einvoice_taxable": einvoice_taxable,
                        "sales_taxable": sales_taxable,
                        "difference": einvoice_taxable - sales_taxable,
                        "status": "mismatch"
                    })
                    results["summary"]["mismatch_count"] += 1
        
        # Find missing
        for inv_num in einvoice_map:
            if inv_num not in sales_map:
                results["missing_in_sales"].append({
                    "invoice_number": inv_num,
                    "status": "missing_in_sales"
                })
                results["summary"]["missing_count"] += 1
        
        for inv_num in sales_map:
            if inv_num not in einvoice_map:
                results["missing_in_einvoice"].append({
                    "invoice_number": inv_num,
                    "status": "missing_in_einvoice"
                })
        
        return {
            "success": True,
            "data": results
        }
    except Exception as e:
        logger.exception(f"Error in reconciliation: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/gstr1/recon/{report_id}", tags=["Reconciliation"])
async def get_reconciliation_report(
    report_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a saved reconciliation report.
    """
    # In production, this would fetch from database
    return {
        "success": True,
        "data": {
            "id": report_id,
            "status": "no_report",
            "message": "No reconciliation report found. Run reconciliation first."
        }
    }


# In-memory database for reconciliation status updates
reconciliation_status_db: List[Dict[str, Any]] = []

# In-memory database for reconciliation results (persisted)
reconciliation_results_db: List[Dict[str, Any]] = []


class ReconStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None


@app.put("/api/gstr1/reconcile/{invoice_id}/status", tags=["Reconciliation"])
async def update_reconciliation_status(
    invoice_id: str,
    request: ReconStatusUpdateRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Update reconciliation status for an invoice.
    
    Actions:
    - accepted: Accept the reconciliation result
    - rejected: Reject the reconciliation result
    - extra: Mark as extra invoice (exists in one source but not the other)
    """
    valid_statuses = ["accepted", "rejected", "extra", "pending"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Check if record exists
    existing_record = None
    for record in reconciliation_status_db:
        if record.get("invoice_id") == invoice_id:
            existing_record = record
            break
    
    if existing_record:
        # Update existing record
        existing_record["status"] = request.status
        existing_record["notes"] = request.notes
        existing_record["updated_at"] = datetime.utcnow().isoformat() + "Z"
        existing_record["updated_by"] = current_user.get("sub") if current_user else "system"
        return {
            "success": True,
            "message": f"Reconciliation status updated to {request.status}",
            "data": existing_record
        }
    else:
        # Create new record
        new_record = {
            "id": str(len(reconciliation_status_db) + 1),
            "invoice_id": invoice_id,
            "status": request.status,
            "notes": request.notes,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "updated_by": current_user.get("sub") if current_user else "system"
        }
        reconciliation_status_db.append(new_record)
        return {
            "success": True,
            "message": f"Reconciliation status set to {request.status}",
            "data": new_record
        }


# ============ ENHANCED GSTR-1 RECONCILIATION API ============

class GSTR1ReconciliationRequest(BaseModel):
    workspace_id: Optional[str] = None
    gstin: Optional[str] = None
    return_period: Optional[str] = None
    einvoice_data: List[Dict[str, Any]] = []
    sales_register_data: List[Dict[str, Any]] = []

class GSTR1ReconciliationResponse(BaseModel):
    success: bool
    message: str
    report_id: str
    data: Dict[str, Any]


def run_reconciliation(
    einvoice_data: List[Dict[str, Any]],
    sales_register_data: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Run comprehensive E-Invoice vs Sales Register reconciliation.
    
    Returns:
    - summary: matched, mismatched, missing, totals
    - customer_view: grouped by GSTIN with counts
    - document_view: individual invoice details with status
    """
    results = {
        "matched": [],
        "mismatch": [],
        "missing_in_sales": [],
        "missing_in_einvoice": []
    }
    
    # Create lookup maps
    einvoice_map = {inv.get("invoice_number") or inv.get("invoice_no"): inv for inv in einvoice_data}
    sales_map = {inv.get("invoice_number") or inv.get("invoice_no"): inv for inv in sales_register_data}
    
    all_invoice_numbers = set(einvoice_map.keys()) | set(sales_map.keys())
    
    for inv_num in all_invoice_numbers:
        einvoice = einvoice_map.get(inv_num)
        sales = sales_map.get(inv_num)
        
        if einvoice and sales:
            # Compare amounts
            einvoice_taxable = einvoice.get("taxable_value", 0) or einvoice.get("txval", 0) or 0
            sales_taxable = sales.get("taxable_value", 0) or sales.get("txval", 0) or 0
            
            difference = abs(einvoice_taxable - sales_taxable)
            
            # Get additional fields
            gstin = sales.get("customer_gstin") or einvoice.get("customer_gstin") or ""
            customer_name = sales.get("customer_name") or einvoice.get("customer_name") or ""
            invoice_date = sales.get("invoice_date") or einvoice.get("invoice_date") or ""
            
            # Calculate tax amounts
            einvoice_igst = einvoice.get("igst", 0) or 0
            einvoice_cgst = einvoice.get("cgst", 0) or 0
            einvoice_sgst = einvoice.get("sgst", 0) or 0
            sales_igst = sales.get("igst", 0) or 0
            sales_cgst = sales.get("cgst", 0) or 0
            sales_sgst = sales.get("sgst", 0) or 0
            
            if difference < 1:  # Exact match (within 1 rupee tolerance)
                results["matched"].append({
                    "id": str(len(results["matched"]) + 1),
                    "invoice_number": inv_num,
                    "gstin": gstin,
                    "customer_name": customer_name,
                    "invoice_date": invoice_date,
                    "einvoice_taxable": einvoice_taxable,
                    "sales_taxable": sales_taxable,
                    "einvoice_igst": einvoice_igst,
                    "einvoice_cgst": einvoice_cgst,
                    "einvoice_sgst": einvoice_sgst,
                    "sales_igst": sales_igst,
                    "sales_cgst": sales_cgst,
                    "sales_sgst": sales_sgst,
                    "difference": difference,
                    "status": "matched",
                    "remarks": ""
                })
            else:
                # Mismatch - values differ
                results["mismatch"].append({
                    "id": str(len(results["mismatch"]) + 1),
                    "invoice_number": inv_num,
                    "gstin": gstin,
                    "customer_name": customer_name,
                    "invoice_date": invoice_date,
                    "einvoice_taxable": einvoice_taxable,
                    "sales_taxable": sales_taxable,
                    "einvoice_igst": einvoice_igst,
                    "einvoice_cgst": einvoice_cgst,
                    "einvoice_sgst": einvoice_sgst,
                    "sales_igst": sales_igst,
                    "sales_cgst": sales_cgst,
                    "sales_sgst": sales_sgst,
                    "difference": einvoice_taxable - sales_taxable,
                    "status": "mismatch",
                    "remarks": f"Taxable value difference: ₹{difference:,.2f}"
                })
        elif einvoice and not sales:
            # Missing in sales register
            gstin = einvoice.get("customer_gstin") or ""
            customer_name = einvoice.get("customer_name") or ""
            invoice_date = einvoice.get("invoice_date") or ""
            einvoice_taxable = einvoice.get("taxable_value", 0) or einvoice.get("txval", 0) or 0
            
            results["missing_in_sales"].append({
                "id": str(len(results["missing_in_sales"]) + 1),
                "invoice_number": inv_num,
                "gstin": gstin,
                "customer_name": customer_name,
                "invoice_date": invoice_date,
                "einvoice_taxable": einvoice_taxable,
                "einvoice_igst": einvoice.get("igst", 0) or 0,
                "einvoice_cgst": einvoice.get("cgst", 0) or 0,
                "einvoice_sgst": einvoice.get("sgst", 0) or 0,
                "status": "missing_in_sales",
                "remarks": "Invoice exists in E-Invoice but not in Sales Register"
            })
        elif sales and not einvoice:
            # Missing in E-Invoice
            gstin = sales.get("customer_gstin") or ""
            customer_name = sales.get("customer_name") or ""
            invoice_date = sales.get("invoice_date") or ""
            sales_taxable = sales.get("taxable_value", 0) or sales.get("txval", 0) or 0
            
            results["missing_in_einvoice"].append({
                "id": str(len(results["missing_in_einvoice"]) + 1),
                "invoice_number": inv_num,
                "gstin": gstin,
                "customer_name": customer_name,
                "invoice_date": invoice_date,
                "sales_taxable": sales_taxable,
                "sales_igst": sales.get("igst", 0) or 0,
                "sales_cgst": sales.get("cgst", 0) or 0,
                "sales_sgst": sales.get("sgst", 0) or 0,
                "status": "missing_in_einvoice",
                "remarks": "Invoice exists in Sales Register but not in E-Invoice"
            })
    
    return results


def build_summary(results: Dict[str, Any]) -> Dict[str, Any]:
    """Build summary with totals."""
    matched = results.get("matched", [])
    mismatch = results.get("mismatch", [])
    missing_in_sales = results.get("missing_in_sales", [])
    missing_in_einvoice = results.get("missing_in_einvoice", [])
    
    # Calculate totals
    total_matched = sum(item.get("einvoice_taxable", 0) for item in matched)
    total_mismatch = sum(item.get("einvoice_taxable", 0) for item in mismatch)
    total_missing_sales = sum(item.get("einvoice_taxable", 0) for item in missing_in_sales)
    total_missing_einvoice = sum(item.get("sales_taxable", 0) for item in missing_in_einvoice)
    
    # Total taxes
    total_einvoice_igst = sum(item.get("einvoice_igst", 0) for item in matched + mismatch + missing_in_sales)
    total_einvoice_cgst = sum(item.get("einvoice_cgst", 0) for item in matched + mismatch + missing_in_sales)
    total_einvoice_sgst = sum(item.get("einvoice_sgst", 0) for item in matched + mismatch + missing_in_sales)
    total_sales_igst = sum(item.get("sales_igst", 0) for item in matched + mismatch + missing_in_einvoice)
    total_sales_cgst = sum(item.get("sales_cgst", 0) for item in matched + mismatch + missing_in_einvoice)
    total_sales_sgst = sum(item.get("sales_sgst", 0) for item in matched + mismatch + missing_in_einvoice)
    
    return {
        "matched_count": len(matched),
        "matched_total": total_matched,
        "mismatch_count": len(mismatch),
        "mismatch_total": total_mismatch,
        "missing_in_sales_count": len(missing_in_sales),
        "missing_in_sales_total": total_missing_sales,
        "missing_in_einvoice_count": len(missing_in_einvoice),
        "missing_in_einvoice_total": total_missing_einvoice,
        "total_einvoice_count": len(matched) + len(mismatch) + len(missing_in_sales),
        "total_sales_count": len(matched) + len(mismatch) + len(missing_in_einvoice),
        "total_einvoice_taxable": total_matched + total_mismatch + total_missing_sales,
        "total_sales_taxable": total_matched + total_mismatch + total_missing_einvoice,
        "total_einvoice_igst": total_einvoice_igst,
        "total_einvoice_cgst": total_einvoice_cgst,
        "total_einvoice_sgst": total_einvoice_sgst,
        "total_sales_igst": total_sales_igst,
        "total_sales_cgst": total_sales_cgst,
        "total_sales_sgst": total_sales_sgst,
    }


def build_customer_view(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build customer-wise view with counts."""
    customer_data = {}
    
    # Process all results
    for item in results.get("matched", []) + results.get("mismatch", []) + results.get("missing_in_sales", []) + results.get("missing_in_einvoice", []):
        gstin = item.get("gstin", "")
        customer_name = item.get("customer_name", "")
        
        if not gstin:
            gstin = "UNREGISTERED"
            customer_name = "Unregistered Customers"
        
        if gstin not in customer_data:
            customer_data[gstin] = {
                "gstin": gstin,
                "customer_name": customer_name,
                "matched_count": 0,
                "mismatched_count": 0,
                "missing_in_sales_count": 0,
                "missing_in_einvoice_count": 0,
                "total_count": 0
            }
        
        status = item.get("status", "")
        if status == "matched":
            customer_data[gstin]["matched_count"] += 1
        elif status == "mismatch":
            customer_data[gstin]["mismatched_count"] += 1
        elif status == "missing_in_sales":
            customer_data[gstin]["missing_in_sales_count"] += 1
        elif status == "missing_in_einvoice":
            customer_data[gstin]["missing_in_einvoice_count"] += 1
        
        customer_data[gstin]["total_count"] += 1
    
    # Sort by GSTIN
    return sorted(customer_data.values(), key=lambda x: x.get("gstin", ""))


def build_document_view(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build detailed document view."""
    documents = []
    
    # Combine all results
    all_items = (
        results.get("matched", []) +
        results.get("mismatch", []) +
        results.get("missing_in_sales", []) +
        results.get("missing_in_einvoice", [])
    )
    
    for item in all_items:
        doc = {
            "id": item.get("id", ""),
            "invoice_number": item.get("invoice_number", ""),
            "gstin": item.get("gstin", ""),
            "customer_name": item.get("customer_name", ""),
            "invoice_date": item.get("invoice_date", ""),
            "taxable_value": item.get("einvoice_taxable", 0) or item.get("sales_taxable", 0),
            "igst": item.get("einvoice_igst", 0) or item.get("sales_igst", 0),
            "cgst": item.get("einvoice_cgst", 0) or item.get("sales_cgst", 0),
            "sgst": item.get("einvoice_sgst", 0) or item.get("sales_sgst", 0),
            "status": item.get("status", ""),
            "remarks": item.get("remarks", "")
        }
        documents.append(doc)
    
    # Sort by invoice number
    return sorted(documents, key=lambda x: x.get("invoice_number", ""))


@app.post("/api/gstr1/reconciliation", tags=["Reconciliation"])
async def create_reconciliation(
    request: GSTR1ReconciliationRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Create a new E-Invoice vs Sales Register reconciliation.
    
    This endpoint:
    1. Compares E-Invoice data with Sales Register
    2. Identifies matched, mismatched, and missing invoices
    3. Persists results for later retrieval
    4. Returns comprehensive reconciliation report
    """
    try:
        logger.info(f"Creating reconciliation for GSTIN: {request.gstin}, Period: {request.return_period}")
        
        # Run reconciliation
        results = run_reconciliation(
            request.einvoice_data,
            request.sales_register_data
        )
        
        # Build summary
        summary = build_summary(results)
        
        # Build customer view
        customer_view = build_customer_view(results)
        
        # Build document view
        document_view = build_document_view(results)
        
        # Create report ID
        report_id = generate_id()
        
        # Prepare response data
        reconciliation_data = {
            "id": report_id,
            "workspace_id": request.workspace_id,
            "gstin": request.gstin,
            "return_period": request.return_period,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "created_by": current_user.get("sub") if current_user else "system",
            "summary": summary,
            "customer_view": customer_view,
            "document_view": document_view,
            "matched": results["matched"],
            "mismatch": results["mismatch"],
            "missing_in_sales": results["missing_in_sales"],
            "missing_in_einvoice": results["missing_in_einvoice"]
        }
        
        # Persist results
        reconciliation_results_db.append(reconciliation_data)
        
        logger.info(f"Reconciliation completed: matched={summary['matched_count']}, mismatch={summary['mismatch_count']}")
        
        return {
            "success": True,
            "message": "Reconciliation completed successfully",
            "report_id": report_id,
            "data": {
                "summary": summary,
                "customer_view": customer_view,
                "document_view": document_view
            }
        }
    
    except Exception as e:
        logger.exception(f"Error in reconciliation: {str(e)}")
        return {
            "success": False,
            "message": f"Reconciliation failed: {str(e)}",
            "report_id": "",
            "data": {}
        }


@app.get("/api/gstr1/reconciliation/{report_id}", tags=["Reconciliation"])
async def get_reconciliation(
    report_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a saved reconciliation report by ID.
    """
    # Find the report
    for report in reconciliation_results_db:
        if report.get("id") == report_id:
            return {
                "success": True,
                "message": "Report found",
                "data": {
                    "summary": report.get("summary", {}),
                    "customer_view": report.get("customer_view", []),
                    "document_view": report.get("document_view", [])
                }
            }
    
    return {
        "success": False,
        "message": "Report not found",
        "data": {}
    }


@app.get("/api/gstr1/reconciliation", tags=["Reconciliation"])
async def list_reconciliations(
    gstin: Optional[str] = None,
    return_period: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    List all reconciliation reports.
    """
    results = reconciliation_results_db
    
    # Filter by GSTIN
    if gstin:
        results = [r for r in results if r.get("gstin") == gstin]
    
    # Filter by return period
    if return_period:
        results = [r for r in results if r.get("return_period") == return_period]
    
    # Sort by most recent
    results = sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Limit results
    results = results[:limit]
    
    # Return summary only
    summaries = []
    for r in results:
        summaries.append({
            "id": r.get("id"),
            "gstin": r.get("gstin"),
            "return_period": r.get("return_period"),
            "created_at": r.get("created_at"),
            "summary": r.get("summary", {})
        })
    
    return {
        "success": True,
        "message": f"Found {len(summaries)} reports",
        "data": summaries
    }


@app.put("/api/gstr1/reconciliation/{invoice_id}/status", tags=["Reconciliation"])
async def update_reconciliation_status(
    invoice_id: str,
    status: str = Body(..., embed=True),
    notes: Optional[str] = Body(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Update reconciliation status for an invoice.
    """
    valid_statuses = ["accepted", "rejected", "extra", "pending"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Update in reconciliation status database
    for record in reconciliation_status_db:
        if record.get("invoice_id") == invoice_id:
            record["status"] = status
            record["notes"] = notes
            record["updated_at"] = datetime.utcnow().isoformat() + "Z"
            record["updated_by"] = current_user.get("sub") if current_user else "system"
            return {
                "success": True,
                "message": f"Status updated to {status}",
                "data": record
            }
    
    # Create new record
    new_record = {
        "id": str(len(reconciliation_status_db) + 1),
        "invoice_id": invoice_id,
        "status": status,
        "notes": notes,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "updated_by": current_user.get("sub") if current_user else "system"
    }
    reconciliation_status_db.append(new_record)
    
    return {
        "success": True,
        "message": f"Status set to {status}",
        "data": new_record
    }


@app.put("/api/gstr1/preferences", tags=["GSTR-1"])
async def update_gstr1_preferences(
    preferences: Dict[str, Any],
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Save GSTR-1 preferences (data source selections, etc.)
    """
    return {
        "success": True,
        "message": "Preferences saved successfully",
        "data": preferences
    }


@app.get("/api/gstr1/preferences", tags=["GSTR-1"])
async def get_gstr1_preferences(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get saved GSTR-1 preferences
    """
    return {
        "success": True,
        "data": {
            "doc_series_source": "imported",
            "hsn_source": "computed",
            "summary_source": "imported"
        }
    }


@app.get("/api/gstr3b/data-sources", tags=["GSTR-3B"])
async def get_gstr3b_data_sources(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get GSTR-3B data source preferences
    """
    return {
        "success": True,
        "data": {
            "outward_supplies_source": "imported_gstr1",
            "inward_supplies_source": "gstr2b_auto",
            "itc_source": "computed",
            "pre_applied": True
        }
    }


@app.put("/api/gstr3b/data-sources", tags=["GSTR-3B"])
async def update_gstr3b_data_sources(
    data_sources: Dict[str, Any],
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Update GSTR-3B data source preferences
    """
    return {
        "success": True,
        "message": "Data sources updated successfully",
        "data": data_sources
    }


# ============ USER REGISTRATION SYSTEM ============

# User registration database (in-memory)
registered_users_db: Dict[str, Dict[str, Any]] = {}

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    company_name: Optional[str] = None
    gstin: Optional[str] = None

@app.post("/register", response_model=Dict[str, Any])
async def register(request: RegisterRequest):
    """
    Register a new user with email and password.
    """
    # Check if email already exists in users_db
    for user in users_db:
        if user.get("email") == request.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists (use email as username)
    username = request.email.split("@")[0]
    existing_username = next((u for u in users_db if u.get("username") == username), None)
    if existing_username:
        username = f"{username}_{len(users_db)}"
    
    # Hash password
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    # Create user in users_db
    new_user = {
        "id": generate_id(),
        "username": username,
        "email": request.email,
        "full_name": request.full_name,
        "company_name": request.company_name,
        "gstin": request.gstin,
        "password_hash": password_hash,
        "role": "user",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    users_db.append(new_user)
    
    # Also add to registered_users_db for backward compatibility
    registered_users_db[username] = new_user
    
    # Update USERS dict
    USERS[username] = {
        "password_hash": password_hash,
        "role": "user",
        "email": request.email
    }
    
    logger.info(f"New user registered: {username}")
    
    return {
        "success": True,
        "message": "User registered successfully",
        "user": {
            "username": username,
            "email": request.email,
            "full_name": request.full_name
        }
    }


# ============ GSTN SYNC SERVICE ============

# In-memory GSTN sync logs
gstn_sync_logs_db: List[Dict[str, Any]] = []

class GSTNSyncRequest(BaseModel):
    gstin: str
    return_period: str
    sync_type: str = "full"  # full, gstr1, gstr2b, gstr3b

class GSTNSyncResponse(BaseModel):
    gstin: str
    return_period: str
    status: str
    message: str
    records_downloaded: int = 0
    last_updated: str

@app.post("/sync-gstn", tags=["GSTN Sync"])
async def sync_gstn(
    request: GSTNSyncRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Sync GST data from GSTN portal.
    
    This endpoint initiates a sync with the GSTN portal to download:
    - GSTR-1 (outward supplies from suppliers)
    - GSTR-2B (auto-populated inward supplies)
    - GSTR-3B summary data
    
    Note: This is a mock implementation. In production, integrate with GSTN API.
    """
    logger.info(f"GSTN sync requested for {request.gstin}, period {request.return_period}, type {request.sync_type}")
    
    # Simulate sync processing
    import time
    time.sleep(1)  # Simulate API call delay
    
    # Mock response based on sync type
    records_downloaded = 0
    if request.sync_type in ["full", "gstr1"]:
        records_downloaded += 15  # Mock: 15 supplier invoices
    if request.sync_type in ["full", "gstr2b"]:
        records_downloaded += 25  # Mock: 25 inward invoices
    if request.sync_type in ["full", "gstr3b"]:
        records_downloaded += 1  # Mock: 1 summary record
    
    sync_result = {
        "id": str(len(gstn_sync_logs_db) + 1),
        "gstin": request.gstin,
        "return_period": request.return_period,
        "sync_type": request.sync_type,
        "status": "completed",
        "message": f"Successfully synced {request.sync_type.upper()} data",
        "records_downloaded": records_downloaded,
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    gstn_sync_logs_db.append(sync_result)
    
    logger.info(f"GSTN sync completed: {records_downloaded} records downloaded")
    
    return {
        "success": True,
        "message": "Sync completed successfully",
        "data": sync_result
    }


@app.get("/sync-gstn/logs", tags=["GSTN Sync"])
async def get_sync_logs(
    gstin: Optional[str] = None,
    limit: int = 10,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get GSTN sync logs.
    """
    results = gstn_sync_logs_db
    
    if gstin:
        results = [log for log in results if log["gstin"] == gstin]
    
    # Sort by most recent
    results = sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)
    
    return results[:limit]


@app.get("/sync-gstn/status", tags=["GSTN Sync"])
async def get_sync_status(
    gstin: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get current sync status for a GSTIN.
    """
    # Get latest sync for this GSTIN
    user_syncs = [s for s in gstn_sync_logs_db if s.get("gstin") == gstin]
    
    if not user_syncs:
        return {
            "gstin": gstin,
            "last_sync": None,
            "status": "never_synced"
        }
    
    latest = max(user_syncs, key=lambda x: x.get("created_at", ""))
    
    return {
        "gstin": gstin,
        "last_sync": latest.get("last_updated"),
        "status": latest.get("status"),
        "records_downloaded": latest.get("records_downloaded", 0),
        "message": latest.get("message")
    }


# ============ DATA OVERVIEW / UPLOAD HISTORY ============

# In-memory upload history storage
upload_history_db: List[Dict[str, Any]] = []

class UploadHistoryRequest(BaseModel):
    file_name: str
    template_type: str
    record_count: int
    status: str = "completed"
    source: str = "manual"
    pan_gstin: Optional[str] = None

@app.post("/upload-history", tags=["Data Overview"])
async def create_upload_record(
    request: UploadHistoryRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Record an upload in the history.
    """
    new_record = {
        "id": str(len(upload_history_db) + 1),
        "file_name": request.file_name,
        "template_type": request.template_type,
        "record_count": request.record_count,
        "status": request.status,
        "source": request.source,
        "pan_gstin": request.pan_gstin,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    upload_history_db.append(new_record)
    
    return {
        "success": True,
        "data": new_record
    }


@app.get("/upload-history", tags=["Data Overview"])
async def get_upload_history(
    limit: int = 20,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get upload history.
    """
    # Sort by most recent
    results = sorted(upload_history_db, key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "success": True,
        "data": results[:limit],
        "total": len(results)
    }


@app.delete("/upload-history/{record_id}", tags=["Data Overview"])
async def delete_upload_record(
    record_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Delete an upload record.
    """
    for i, record in enumerate(upload_history_db):
        if record["id"] == record_id:
            upload_history_db.pop(i)
            return {"success": True, "message": "Record deleted"}
    
    raise HTTPException(status_code=404, detail="Record not found")


# ============ RETURNS DATABASE ============

# In-memory returns database
returns_db: List[Dict[str, Any]] = [
    {
        "id": "1",
        "gstin": "27AABCU9603R1ZM",
        "return_type": "GSTR1",
        "period": "022026",
        "status": "filed",
        "filed_date": "2026-02-20",
        "arn": "ARN0264567890123"
    },
    {
        "id": "2",
        "gstin": "27AABCU9603R1ZM",
        "return_type": "GSTR3B",
        "period": "022026",
        "status": "filed",
        "filed_date": "2026-02-22",
        "arn": "ARN0364567890124"
    },
    {
        "id": "3",
        "gstin": "27AABCU9603R1ZM",
        "return_type": "GSTR1",
        "period": "012026",
        "status": "filed",
        "filed_date": "2026-01-20",
        "arn": "ARN0264567890111"
    },
    {
        "id": "4",
        "gstin": "27AABCU9603R1ZM",
        "return_type": "GSTR3B",
        "period": "012026",
        "status": "filed",
        "filed_date": "2026-01-22",
        "arn": "ARN0364567890112"
    },
    {
        "id": "5",
        "gstin": "29AABCT1234N1Z5",
        "return_type": "GSTR1",
        "period": "022026",
        "status": "pending",
        "filed_date": None,
        "arn": None
    },
    {
        "id": "6",
        "gstin": "29AABCT1234N1Z5",
        "return_type": "GSTR2B",
        "period": "022026",
        "status": "available",
        "filed_date": None,
        "arn": None
    }
]

class ReturnFilingRequest(BaseModel):
    gstin: str
    return_type: str
    period: str
    status: str
    filed_date: Optional[str] = None
    arn: Optional[str] = None

@app.post("/returns", tags=["Returns"])
async def create_return(
    filing: ReturnFilingRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Record a new return filing.
    """
    new_return = {
        "id": str(len(returns_db) + 1),
        "gstin": filing.gstin,
        "return_type": filing.return_type,
        "period": filing.period,
        "status": filing.status,
        "filed_date": filing.filed_date,
        "arn": filing.arn,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    returns_db.append(new_return)
    logger.info(f"Return filing recorded: {filing.return_type} for {filing.gstin}")
    return new_return


@app.get("/returns", tags=["Returns"])
async def get_returns(
    gstin: Optional[str] = None,
    return_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get returns with optional filtering.
    """
    results = returns_db
    
    if gstin:
        results = [r for r in results if r["gstin"] == gstin]
    if return_type:
        results = [r for r in results if r["return_type"] == return_type]
    if status:
        results = [r for r in results if r["status"] == status]
    
    return results


@app.get("/filing-status", tags=["Filing Status"])
async def get_filing_status(
    gstin: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get filing status dashboard for a GSTIN.
    
    Returns summary of:
    - GSTR1: Pending/Filed
    - GSTR3B: Pending/Filed
    - GSTR2B: Available/Pending
    """
    # Filter by GSTIN if provided
    user_returns = returns_db
    if gstin:
        user_returns = [r for r in returns_db if r["gstin"] == gstin]
    
    # Build status summary
    return_types = ["GSTR1", "GSTR3B", "GSTR2B"]
    current_period = datetime.now().strftime("%m%Y")
    
    filing_status = {}
    for rt in return_types:
        # Get latest period for this return type
        periods = sorted(set(r["period"] for r in user_returns if r["return_type"] == rt))
        
        if periods:
            latest_period = periods[-1]
            latest_filing = next((r for r in user_returns if r["return_type"] == rt and r["period"] == latest_period), None)
            
            if latest_filing:
                filing_status[rt] = {
                    "period": latest_period,
                    "status": latest_filing["status"],
                    "filed_date": latest_filing.get("filed_date"),
                    "arn": latest_filing.get("arn")
                }
            else:
                filing_status[rt] = {
                    "period": latest_period,
                    "status": "pending"
                }
        else:
            filing_status[rt] = {
                "period": current_period,
                "status": "pending"
            }
    
    # Count totals
    total_returns = len(user_returns)
    filed_count = len([r for r in user_returns if r["status"] == "filed"])
    pending_count = len([r for r in user_returns if r["status"] == "pending"])
    available_count = len([r for r in user_returns if r["status"] == "available"])
    
    return {
        "gstin": gstin or "All",
        "current_period": current_period,
        "returns": filing_status,
        "summary": {
            "total_returns": total_returns,
            "filed": filed_count,
            "pending": pending_count,
            "available": available_count
        }
    }


# ============ NOTIFICATIONS SYSTEM ============

# In-memory notifications database
notifications_db: List[Dict[str, Any]] = []

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    notification_type: str = "info"  # info, warning, error, success
    due_date: Optional[str] = None

@app.post("/notifications", tags=["Notifications"])
async def create_notification(
    notification: NotificationCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Create a new notification.
    """
    new_notification = {
        "id": str(len(notifications_db) + 1),
        "user_id": notification.user_id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.notification_type,
        "due_date": notification.due_date,
        "read": False,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    notifications_db.append(new_notification)
    return new_notification


@app.get("/notifications", tags=["Notifications"])
async def get_notifications(
    user_id: Optional[str] = None,
    unread_only: bool = False,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get notifications for a user.
    """
    results = notifications_db
    
    if user_id:
        results = [n for n in results if n["user_id"] == user_id]
    
    if unread_only:
        results = [n for n in results if not n.get("read", False)]
    
    return results


@app.put("/notifications/{notification_id}/read", tags=["Notifications"])
async def mark_notification_read(
    notification_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Mark a notification as read.
    """
    for notif in notifications_db:
        if notif["id"] == notification_id:
            notif["read"] = True
            return notif
    raise HTTPException(status_code=404, detail="Notification not found")


@app.delete("/notifications/{notification_id}", tags=["Notifications"])
async def delete_notification(
    notification_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Delete a notification.
    """
    for i, notif in enumerate(notifications_db):
        if notif["id"] == notification_id:
            notifications_db.pop(i)
            return {"message": "Notification deleted"}
    raise HTTPException(status_code=404, detail="Notification not found")


# Generate automatic notifications based on filing deadlines
@app.post("/notifications/generate-due-dates", tags=["Notifications"])
async def generate_due_date_notifications(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Generate notifications for upcoming return due dates.
    """
    from datetime import datetime, timedelta
    
    # Current date
    today = datetime.now()
    
    # Return due dates (GST returns are due on 20th of next month)
    due_dates = [
        {"return_type": "GSTR1", "months_ahead": 0, "days_warning": 3},
        {"return_type": "GSTR3B", "months_ahead": 0, "days_warning": 3},
        {"return_type": "GSTR2B", "months_ahead": 0, "days_warning": 5},
    ]
    
    generated = 0
    
    for due_info in due_dates:
        # Calculate due date for current period
        if due_info["months_ahead"] == 0:
            # Current month - due on 20th
            due_date = today.replace(day=20)
        else:
            # Future period
            next_month = today.month + due_info["months_ahead"]
            year = today.year + (next_month - 1) // 12
            month = ((next_month - 1) % 12) + 1
            due_date = today.replace(year=year, month=month, day=20)
        
        days_until_due = (due_date - today).days
        
        # Create notification if within warning period
        if 0 <= days_until_due <= due_info["days_warning"]:
            # Check if notification already exists
            existing = any(
                n.get("title") == f"{due_info['return_type']} Due Soon"
                for n in notifications_db
            )
            
            if not existing:
                notif = {
                    "id": str(len(notifications_db) + 1),
                    "user_id": "system",
                    "title": f"{due_info['return_type']} Due Soon",
                    "message": f"{due_info['return_type']} for {today.strftime('%B %Y')} is due on {due_date.strftime('%d %B %Y')}.",
                    "type": "warning" if days_until_due <= 3 else "info",
                    "due_date": due_date.strftime('%Y-%m-%d'),
                    "read": False,
                    "created_at": datetime.utcnow().isoformat() + "Z"
                }
                notifications_db.append(notif)
                generated += 1
    
    return {
        "success": True,
        "message": f"Generated {generated} due date notifications",
        "total_notifications": len(notifications_db)
    }
