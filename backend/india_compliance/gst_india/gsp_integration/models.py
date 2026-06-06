"""
GSP Integration - Data Models

Pydantic models for GSP integration framework.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum
from uuid import uuid4


# Enums
class GSPProvider(str, Enum):
    """Supported GSP providers."""
    CLEARTAX = "cleartax"
    GST_SAHAY = "gst_sahay"
    TALLY_NEXT = "tallynext"
    MASTER_INDIA = "master_inddia"
    COMPLETE_GSTR = "complete_gstr"
    MOCK = "mock"


class ReturnType(str, Enum):
    """GSTR return types."""
    GSTR1 = "GSTR-1"
    GSTR2A = "GSTR-2A"
    GSTR2B = "GSTR-2B"
    GSTR3B = "GSTR-3B"
    GSTR4 = "GSTR-4"
    GSTR6 = "GSTR-6"
    GSTR7 = "GSTR-7"
    GSTR8 = "GSTR-8"
    GSTR9 = "GSTR-9"


class FilingStatus(str, Enum):
    """Filing status enum."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    FILED = "FILED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class AuthStatus(str, Enum):
    """Authentication status."""
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    OTP_REQUESTED = "OTP_REQUESTED"
    AUTHENTICATED = "AUTHENTICATED"
    SESSION_EXPIRED = "SESSION_EXPIRED"


class GSPHealthStatus(str, Enum):
    """GSP health status."""
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"
    UNKNOWN = "UNKNOWN"


# GSP Configuration Models
class GSPConfig(BaseModel):
    """GSP Configuration model."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    provider: GSPProvider
    api_key: str
    api_secret: str
    gstin: str
    username: str
    encrypted_password: str
    ip_address: str
    is_active: bool = True
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        use_enum_values = True


class GSPConfigCreate(BaseModel):
    """GSP configuration creation model."""
    provider: GSPProvider
    api_key: str
    api_secret: str
    gstin: str
    username: str
    password: str
    ip_address: str
    is_default: bool = False


class GSPConfigUpdate(BaseModel):
    """GSP configuration update model."""
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    password: Optional[str] = None
    ip_address: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class GSPProviderInfo(BaseModel):
    """GSP provider information."""
    provider: GSPProvider
    name: str
    description: str
    api_version: str
    is_supported: bool = True
    features: List[str] = []
    rate_limit: Optional[int] = None  # requests per minute


# Authentication Models
class AuthRequest(BaseModel):
    """Authentication request model."""
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    username: str
    password: str
    ip_address: Optional[str] = None


class OTPRequest(BaseModel):
    """OTP request model."""
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    username: str
    ip_address: Optional[str] = None


class OTPVerify(BaseModel):
    """OTP verification model."""
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    username: str
    otp: str = Field(..., min_length=6, max_length=6)
    request_id: str


class AuthResponse(BaseModel):
    """Authentication response model."""
    success: bool
    session_token: Optional[str] = None
    expires_in: Optional[int] = None  # seconds
    message: str
    request_id: Optional[str] = None


class AuthStatusResponse(BaseModel):
    """Authentication status response."""
    gstin: str
    username: str
    status: AuthStatus
    authenticated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    provider: Optional[GSPProvider] = None


class TokenRefreshRequest(BaseModel):
    """Token refresh request."""
    gstin: str
    refresh_token: str


# Filing Models
class FilingSummary(BaseModel):
    """Filing summary data."""
    total_taxable_value: float = 0.0
    total_igst: float = 0.0
    total_cgst: float = 0.0
    total_sgst: float = 0.0
    total_cess: float = 0.0
    total_liability: float = 0.0
    total_itc: float = 0.0
    total_advance_received: float = 0.0
    total_advance_adjusted: float = 0.0


class FilingRequest(BaseModel):
    """Filing request model."""
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    return_type: ReturnType
    return_period: str = Field(..., pattern=r"^\d{2}-\d{4}$")  # MM-YYYY
    json_data: Dict[str, Any]
    summary: Optional[FilingSummary] = None


class FilingResponse(BaseModel):
    """Filing response model."""
    success: bool
    arn: Optional[str] = None  # Application Reference Number
    ack_number: Optional[str] = None
    status: FilingStatus
    filed_on: Optional[datetime] = None
    message: str
    acknowledgment_json: Optional[Dict[str, Any]] = None
    error_details: Optional[Dict[str, Any]] = None


class FilingStatusRequest(BaseModel):
    """Filing status request."""
    gstin: str
    arn: str


class FilingStatusResponse(BaseModel):
    """Filing status response."""
    arn: str
    gstin: str
    return_type: ReturnType
    return_period: str
    status: FilingStatus
    filed_on: Optional[datetime] = None
    ack_number: Optional[str] = None
    error_message: Optional[str] = None
    last_checked: datetime = Field(default_factory=datetime.now)


class FilingHistoryItem(BaseModel):
    """Filing history item."""
    arn: str
    gstin: str
    return_type: ReturnType
    return_period: str
    status: FilingStatus
    filed_on: datetime
    ack_number: Optional[str] = None


# Download Models
class DownloadRequest(BaseModel):
    """Download request model."""
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    return_type: ReturnType
    return_period: str = Field(..., pattern=r"^\d{2}-\d{4}$")
    force_refresh: bool = False


class DownloadResponse(BaseModel):
    """Download response model."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str
    download_id: Optional[str] = None
    status: str = "completed"  # completed, processing, failed
    record_count: int = 0
    downloaded_at: Optional[datetime] = None


class DownloadProgress(BaseModel):
    """Download progress tracking."""
    download_id: str
    gstin: str
    return_type: ReturnType
    return_period: str
    status: str  # pending, processing, completed, failed
    progress: int = 0  # 0-100
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


# GSP Health Check
class GSPHealthResponse(BaseModel):
    """GSP health check response."""
    provider: GSPProvider
    status: GSPHealthStatus
    latency_ms: Optional[int] = None
    last_checked: datetime = Field(default_factory=datetime.now)
    message: Optional[str] = None


class GSPHealthCheckResult(BaseModel):
    """Overall GSP health check result."""
    overall_status: GSPHealthStatus
    providers: List[GSPHealthResponse]
    default_provider: Optional[GSPProvider] = None
    last_checked: datetime = Field(default_factory=datetime.now)


# GSP Operation Response
class GSPOperationResponse(BaseModel):
    """Generic GSP operation response."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None


# Audit Log
class GSPAuditLog(BaseModel):
    """GSP operation audit log."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=datetime.now)
    gstin: str
    provider: GSPProvider
    operation: str  # auth, download, file, status_check
    status: str  # success, failed
    request_data: Optional[Dict[str, Any]] = None
    response_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    latency_ms: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
