"""
GSP Integration - Base GSP Interface

Abstract base class for GSP implementations.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

from india_compliance.gst_india.gsp_integration.models import (
    GSPProvider,
    GSPHealthStatus,
    AuthStatus,
    FilingStatus,
    ReturnType
)
from india_compliance.gst_india.gsp_integration.exceptions import (
    GSPException,
    AuthenticationError,
    SessionExpiredError,
    RateLimitError,
    FilingError,
    DownloadError
)


logger = logging.getLogger(__name__)


class GSPBase(ABC):
    """
    Abstract base class for GSP (GST Suvidha Provider) implementations.
    
    All GSP implementations must inherit from this class and implement
    the abstract methods.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize GSP with configuration.
        
        Args:
            config: Dictionary containing GSP credentials and settings
        """
        self.config = config
        self.provider: GSPProvider = None
        self.session_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.authenticated_gstins: Dict[str, Dict[str, Any]] = {}  # gstin -> auth data
        self._rate_limiter = None
    
    @property
    def is_authenticated(self) -> bool:
        """Check if GSP has valid session."""
        if not self.session_token:
            return False
        if self.token_expiry and datetime.now() >= self.token_expiry:
            return False
        return True
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the GSP provider name."""
        pass
    
    # Authentication Methods
    @abstractmethod
    def authenticate(
        self,
        gstin: str,
        username: str,
        password: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate with GSP using username and password.
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            password: GSP password
            ip_address: User's IP address
            
        Returns:
            Dictionary with session token and expiry
            
        Raises:
            AuthenticationError: If authentication fails
        """
        pass
    
    @abstractmethod
    def request_otp(
        self,
        gstin: str,
        username: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Request OTP for authentication.
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            ip_address: User's IP address
            
        Returns:
            Dictionary with request_id for OTP verification
            
        Raises:
            AuthenticationError: If OTP request fails
        """
        pass
    
    @abstractmethod
    def verify_otp(
        self,
        gstin: str,
        username: str,
        otp: str,
        request_id: str
    ) -> Dict[str, Any]:
        """
        Verify OTP and get session token.
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            otp: 6-digit OTP
            request_id: Request ID from OTP request
            
        Returns:
            Dictionary with session token and expiry
            
        Raises:
            AuthenticationError: If OTP verification fails
        """
        pass
    
    @abstractmethod
    def refresh_session(self, gstin: str) -> Dict[str, Any]:
        """
        Refresh the session token.
        
        Args:
            gstin: GSTIN of the user
            
        Returns:
            Dictionary with new session token and expiry
            
        Raises:
            SessionExpiredError: If session cannot be refreshed
        """
        pass
    
    @abstractmethod
    def logout(self, gstin: str) -> bool:
        """
        Logout and invalidate session.
        
        Args:
            gstin: GSTIN of the user
            
        Returns:
            True if logout successful
        """
        pass
    
    # GSTR Data Methods
    @abstractmethod
    def get_gstr1(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """
        Download GSTR-1 data from GSTN.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            
        Returns:
            Dictionary containing GSTR-1 data
            
        Raises:
            SessionExpiredError: If session expired
            DownloadError: If download fails
        """
        pass
    
    @abstractmethod
    def get_gstr2a(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """
        Download GSTR-2A data from GSTN.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            
        Returns:
            Dictionary containing GSTR-2A data
            
        Raises:
            SessionExpiredError: If session expired
            DownloadError: If download fails
        """
        pass
    
    @abstractmethod
    def get_gstr2b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """
        Download GSTR-2B data from GSTN.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            
        Returns:
            Dictionary containing GSTR-2B data
            
        Raises:
            SessionExpiredError: If session expired
            DownloadError: If download fails
        """
        pass
    
    @abstractmethod
    def get_gstr3b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """
        Download GSTR-3B data from GSTN.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            
        Returns:
            Dictionary containing GSTR-3B data
            
        Raises:
            SessionExpiredError: If session expired
            DownloadError: If download fails
        """
        pass
    
    @abstractmethod
    def get_gstr9(
        self,
        gstin: str,
        financial_year: str
    ) -> Dict[str, Any]:
        """
        Download GSTR-9 annual return data from GSTN.
        
        Args:
            gstin: GSTIN of the user
            financial_year: Financial year in YYYY-YY format
            
        Returns:
            Dictionary containing GSTR-9 data
            
        Raises:
            SessionExpiredError: If session expired
            DownloadError: If download fails
        """
        pass
    
    # Filing Methods
    @abstractmethod
    def file_gstr1(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        File GSTR-1 return.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            json_data: GSTR-1 JSON data
            
        Returns:
            Dictionary with ARN, status, and filing details
            
        Raises:
            SessionExpiredError: If session expired
            FilingError: If filing fails
        """
        pass
    
    @abstractmethod
    def file_gstr3b(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        File GSTR-3B return.
        
        Args:
            gstin: GSTIN of the user
            return_period: Return period in MM-YYYY format
            json_data: GSTR-3B JSON data
            
        Returns:
            Dictionary with ARN, status, and filing details
            
        Raises:
            SessionExpiredError: If session expired
            FilingError: If filing fails
        """
        pass
    
    @abstractmethod
    def get_filing_status(
        self,
        gstin: str,
        arn: str
    ) -> Dict[str, Any]:
        """
        Get filing status by ARN.
        
        Args:
            gstin: GSTIN of the user
            arn: Application Reference Number
            
        Returns:
            Dictionary with filing status details
            
        Raises:
            SessionExpiredError: If session expired
            GSPException: If status check fails
        """
        pass
    
    # Health Check
    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """
        Check GSP service health.
        
        Returns:
            Dictionary with health status
        """
        pass
    
    # Utility Methods
    def validate_session(self, gstin: str) -> bool:
        """
        Validate if session is active for GSTIN.
        
        Args:
            gstin: GSTIN to validate
            
        Returns:
            True if session is valid
        """
        if gstin not in self.authenticated_gstins:
            return False
        
        auth_data = self.authenticated_gstins[gstin]
        expiry = auth_data.get("expires_at")
        
        if expiry and datetime.now() >= expiry:
            return False
        
        return True
    
    def get_auth_status(self, gstin: str) -> AuthStatus:
        """
        Get authentication status for GSTIN.
        
        Args:
            gstin: GSTIN to check
            
        Returns:
            AuthStatus enum value
        """
        if gstin not in self.authenticated_gstins:
            return AuthStatus.NOT_AUTHENTICATED
        
        auth_data = self.authenticated_gstins[gstin]
        expiry = auth_data.get("expires_at")
        
        if expiry and datetime.now() >= expiry:
            return AuthStatus.SESSION_EXPIRED
        
        return AuthStatus.AUTHENTICATED
    
    def set_rate_limiter(self, rate_limiter) -> None:
        """Set rate limiter for API calls."""
        self._rate_limiter = rate_limiter
    
    def _apply_rate_limit(self) -> None:
        """Apply rate limiting if configured."""
        if self._rate_limiter:
            self._rate_limiter.wait_if_needed()
    
    def _handle_api_error(self, error: Exception, operation: str) -> None:
        """Handle API errors and convert to custom exceptions."""
        error_message = str(error)
        
        if "rate limit" in error_message.lower():
            raise RateLimitError(f"Rate limit exceeded during {operation}")
        
        if "session" in error_message.lower() or "token" in error_message.lower():
            raise SessionExpiredError(f"Session expired during {operation}")
        
        if isinstance(error, GSPException):
            raise error
        
        raise GSPException(f"Error during {operation}: {error_message}")
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} provider={self.get_provider_name()}>"
