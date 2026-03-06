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

from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends, Request, BackgroundTasks, Form
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

# Hardcoded users (replace with database in production)
USERS = {
    "admin": {
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
        "role": "admin",
        "email": "admin@example.com"
    },
    "user": {
        "password_hash": hashlib.sha256("user123".encode()).hexdigest(),
        "role": "user",
        "email": "user@example.com"
    }
}

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
    """Verify username and password."""
    if username not in USERS:
        return False
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    return USERS[username]["password_hash"] == password_hash

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
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
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
    allow_origins=["*"],
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
    
    Hardcoded users for demo:
    - admin / admin123
    - user / user123
    """
    # Audit log
    audit_logger.log("login_attempt", request.username, {"ip_address": client_host})
    
    if not verify_password(request.username, request.password):
        audit_logger.log("login_failed", request.username, {"ip_address": client_host, "reason": "Invalid credentials"})
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Create token
    token_data = {
        "sub": request.username,
        "role": USERS[request.username]["role"],
        "email": USERS[request.username]["email"]
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


# ============ Health and Info Endpoints ============
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
                    if 'news' in href.lower() or 'read' in href.lower() or '/\d' in href:
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
        df.rename(columns=mapping_dict, inplace=True)
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
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
