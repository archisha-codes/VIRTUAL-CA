"""
GST India GSP Integration Module

Production-ready GSP (GST Suvidha Provider) integration framework
for real GSTN Portal connectivity.

Supported GSPs:
- ClearTax
- GST Sahay
- TallyNext
- Master India
- Complete GSTR
"""

from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.gsp_registry import (
    GSPRegistry,
    get_gsp_registry,
    register_gsp,
    get_gsp_provider
)
from india_compliance.gst_india.gsp_integration.auth_handler import (
    AuthHandler,
    get_auth_handler
)
from india_compliance.gst_india.gsp_integration.filing_service import (
    FilingService,
    get_filing_service
)
from india_compliance.gst_india.gsp_integration.download_service import (
    DownloadService,
    get_download_service
)
from india_compliance.gst_india.gsp_integration.exceptions import (
    GSPException,
    AuthenticationError,
    RateLimitError,
    SessionExpiredError,
    FilingError,
    DownloadError,
    GSPNotConfiguredError,
    InvalidOTPError,
    GSPAPIError
)
from india_compliance.gst_india.gsp_integration.models import (
    GSPProvider,
    GSPProviderInfo,
    GSPConfig,
    GSPConfigCreate,
    ReturnType,
    AuthRequest,
    OTPRequest,
    OTPVerify,
    AuthResponse,
    AuthStatusResponse,
    FilingRequest,
    FilingResponse,
    FilingStatusRequest,
    FilingStatusResponse as GSPFilingStatusResponse,
    DownloadRequest,
    DownloadResponse,
    GSPHealthResponse,
    GSPHealthCheckResult
)

__all__ = [
    # Base
    "GSPBase",
    
    # Registry
    "GSPRegistry",
    "get_gsp_registry",
    "register_gsp",
    "get_gsp_provider",
    
    # Services
    "AuthHandler",
    "get_auth_handler",
    "FilingService",
    "get_filing_service",
    "DownloadService",
    "get_download_service",
    
    # Exceptions
    "GSPException",
    "AuthenticationError",
    "RateLimitError",
    "SessionExpiredError",
    "FilingError",
    "DownloadError",
    "GSPNotConfiguredError",
    "InvalidOTPError",
    "GSPAPIError",
    
    # Models
    "GSPProvider",
    "GSPProviderInfo",
    "GSPConfig",
    "GSPConfigCreate",
    "AuthRequest",
    "OTPRequest",
    "OTPVerify",
    "AuthResponse",
    "AuthStatusResponse",
    "FilingRequest",
    "FilingResponse",
    "FilingStatusRequest",
    "GSPFilingStatusResponse",
    "DownloadRequest",
    "DownloadResponse",
    "GSPHealthResponse",
    "GSPHealthCheckResult"
]

__version__ = "1.0.0"
