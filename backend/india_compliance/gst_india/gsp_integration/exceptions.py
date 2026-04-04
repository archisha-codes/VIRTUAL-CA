"""
GSP Integration - Custom Exceptions

Exception classes for GSP integration framework.
"""


class GSPException(Exception):
    """Base exception for all GSP-related errors."""
    
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.message = message
        self.code = code or "GSP_ERROR"
        self.details = details or {}
    
    def to_dict(self) -> dict:
        return {
            "error": self.message,
            "code": self.code,
            "details": self.details
        }


class AuthenticationError(GSPException):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed", details: dict = None):
        super().__init__(message, "AUTH_ERROR", details)


class InvalidOTPError(AuthenticationError):
    """Raised when OTP verification fails."""
    
    def __init__(self, message: str = "Invalid OTP", details: dict = None):
        super().__init__(message, "INVALID_OTP", details)


class SessionExpiredError(AuthenticationError):
    """Raised when session token expires."""
    
    def __init__(self, message: str = "Session expired", details: dict = None):
        super().__init__(message, "SESSION_EXPIRED", details)


class RateLimitError(GSPException):
    """Raised when API rate limit is exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = None, details: dict = None):
        super().__init__(message, "RATE_LIMIT", details)
        self.retry_after = retry_after


class FilingError(GSPException):
    """Raised when return filing fails."""
    
    def __init__(self, message: str = "Filing failed", arn: str = None, details: dict = None):
        super().__init__(message, "FILING_ERROR", details)
        self.arn = arn


class DownloadError(GSPException):
    """Raised when data download fails."""
    
    def __init__(self, message: str = "Download failed", details: dict = None):
        super().__init__(message, "DOWNLOAD_ERROR", details)


class GSPNotConfiguredError(GSPException):
    """Raised when GSP is not configured."""
    
    def __init__(self, provider: str = None, message: str = "GSP not configured", details: dict = None):
        details = details or {}
        if provider:
            details["provider"] = provider
        super().__init__(message, "GSP_NOT_CONFIGURED", details)


class GSPAPIError(GSPException):
    """Raised when GSP API returns an error."""
    
    def __init__(self, message: str = "GSP API error", status_code: int = None, 
                 response: dict = None, details: dict = None):
        super().__init__(message, "GSP_API_ERROR", details)
        self.status_code = status_code
        self.response = response


class GSPTimeoutError(GSPException):
    """Raised when GSP API request times out."""
    
    def __init__(self, message: str = "Request timeout", details: dict = None):
        super().__init__(message, "TIMEOUT", details)


class InvalidGSPResponseError(GSPException):
    """Raised when GSP returns invalid response."""
    
    def __init__(self, message: str = "Invalid response", details: dict = None):
        super().__init__(message, "INVALID_RESPONSE", details)


class GSPHealthCheckError(GSPException):
    """Raised when GSP health check fails."""
    
    def __init__(self, provider: str, message: str = "Health check failed", details: dict = None):
        details = details or {}
        details["provider"] = provider
        super().__init__(message, "HEALTH_CHECK_FAILED", details)


class GSTNConnectionError(GSPException):
    """Raised when connection to GSTN fails."""
    
    def __init__(self, message: str = "GSTN connection failed", details: dict = None):
        super().__init__(message, "GSTN_CONNECTION_ERROR", details)


class RequestSigningError(GSPException):
    """Raised when request signing fails."""
    
    def __init__(self, message: str = "Request signing failed", details: dict = None):
        super().__init__(message, "SIGNING_ERROR", details)


class CredentialError(GSPException):
    """Raised when credentials are invalid or missing."""
    
    def __init__(self, message: str = "Invalid credentials", details: dict = None):
        super().__init__(message, "CREDENTIAL_ERROR", details)
