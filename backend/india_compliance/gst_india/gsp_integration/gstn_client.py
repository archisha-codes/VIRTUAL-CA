"""
GSP Integration - GSTN Client

Direct GSTN API client for authorized GSPs.
Handles request signing, OTP handling, and session management.
"""

import uuid
import hashlib
import hmac
import base64
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from india_compliance.gst_india.gsp_integration.exceptions import (
    GSTNConnectionError,
    RequestSigningError,
    GSPAPIError,
    GSPTimeoutError,
    RateLimitError,
    SessionExpiredError
)


logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple rate limiter for API calls."""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.min_interval = 60.0 / requests_per_minute
        self.last_request_time = 0.0
    
    def wait_if_needed(self) -> None:
        """Wait if needed to respect rate limits."""
        import time
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()


class GSTNClient:
    """
    GSTN API Client for direct GSTN connectivity.
    
    Handles:
    - Request signing with HMAC-SHA256
    - Session management
    - OTP handling
    - Request retries
    - Rate limiting
    """
    
    # GSTN API Base URLs (Production)
    GSTN_BASE_URL = "https://gstn1.gst.gov.in"
    GSTN_API_PATH = "/api/"
    
    # GSTN API Endpoints
    ENDPOINTS = {
        "auth": "authenticate/",
        "otp_request": "otpla/",
        "otp_verify": "otplverify/",
        "profile": "taxpayerprofile/",
        "gstr1": "returns/gstr1/",
        "gstr2a": "returns/gstr2a/",
        "gstr2b": "returns/gstr2b/",
        "gstr3b": "returns/gstr3b/",
        "gstr9": "returns/gstr9/",
        "gstr_filing": "returns/gstr/",
        "filing_status": "returns/filingstatus/"
    }
    
    def __init__(
        self,
        app_key: str,
        secret_key: str,
        gstin: str,
        ip_address: str,
        base_url: Optional[str] = None,
        timeout: int = 60,
        rate_limit: int = 60
    ):
        """
        Initialize GSTN Client.
        
        Args:
            app_key: GSP application key
            secret_key: GSP secret key
            gstin: GSP's GSTIN
            ip_address: IP address for requests
            base_url: Override GSTN base URL
            timeout: Request timeout in seconds
            rate_limit: Requests per minute
        """
        self.app_key = app_key
        self.secret_key = secret_key
        self.gstin = gstin
        self.ip_address = ip_address
        self.base_url = base_url or self.GSTN_BASE_URL
        self.timeout = timeout
        
        # Session management
        self.session_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        
        # Rate limiter
        self.rate_limiter = RateLimiter(rate_limit)
        
        # Create session with retry strategy
        self.session = self._create_session()
        
        # Request counter for idempotency
        self._request_counter = 0
    
    def _create_session(self) -> requests.Session:
        """Create requests session with retry strategy."""
        session = requests.Session()
        
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        self._request_counter += 1
        return f"{datetime.now().strftime('%Y%m%d%H%M%S')}{self._request_counter:06d}"
    
    def _generate_signature(
        self,
        method: str,
        url: str,
        payload: str
    ) -> str:
        """
        Generate HMAC-SHA256 signature for request.
        
        Args:
            method: HTTP method
            url: Request URL
            payload: Request body
            
        Returns:
            Base64 encoded signature
        """
        try:
            message = f"{method}|{url}|{payload}"
            signature = hmac.new(
                self.secret_key.encode(),
                message.encode(),
                hashlib.sha256
            ).digest()
            return base64.b64encode(signature).decode()
        except Exception as e:
            raise RequestSigningError(f"Failed to generate signature: {str(e)}")
    
    def _get_headers(
        self,
        content_type: str = "application/json",
        include_auth: bool = False
    ) -> Dict[str, str]:
        """Get request headers."""
        headers = {
            "Content-Type": content_type,
            "user_name": self.gstin,
            "ip_address": self.ip_address,
            "device_id": self._generate_request_id()[:15],
            "request_id": self._generate_request_id(),
            "ts": datetime.now().isoformat()
        }
        
        if include_auth and self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"
        
        return headers
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        include_auth: bool = False,
        retry_on_expired: bool = True
    ) -> Dict[str, Any]:
        """
        Make API request to GSTN.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request data
            include_auth: Include session token
            retry_on_expired: Retry on session expiry
            
        Returns:
            Response data
            
        Raises:
            GSPAPIError: On API error
            SessionExpiredError: On session expiry
            RateLimitError: On rate limit
        """
        url = urljoin(self.base_url, endpoint)
        
        # Apply rate limiting
        self.rate_limiter.wait_if_needed()
        
        # Prepare payload
        payload = json.dumps(data) if data else ""
        
        # Generate signature
        signature = self._generate_signature(method, url, payload)
        
        # Get headers
        headers = self._get_headers(include_auth=include_auth)
        headers["signature"] = signature
        
        try:
            start_time = datetime.now()
            
            if method == "GET":
                response = self.session.get(
                    url,
                    headers=headers,
                    timeout=self.timeout
                )
            else:
                response = self.session.post(
                    url,
                    data=payload,
                    headers=headers,
                    timeout=self.timeout
                )
            
            latency = (datetime.now() - start_time).total_seconds() * 1000
            
            # Handle response
            return self._handle_response(response, latency)
            
        except requests.exceptions.Timeout:
            raise GSPTimeoutError(f"Request timeout for {endpoint}")
        except requests.exceptions.ConnectionError as e:
            raise GSTNConnectionError(f"Connection failed: {str(e)}")
        except GSPAPIError:
            raise
        except Exception as e:
            raise GSPAPIError(f"Request failed: {str(e)}")
    
    def _handle_response(
        self,
        response: requests.Response,
        latency_ms: float
    ) -> Dict[str, Any]:
        """Handle API response."""
        status_code = response.status_code
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {"raw_response": response.text}
        
        # Check for errors
        if status_code == 200:
            return data
        elif status_code == 400:
            error_msg = data.get("message", "Bad request")
            if "session" in error_msg.lower():
                raise SessionExpiredError(error_msg, details=data)
            raise GSPAPIError(
                message=error_msg,
                status_code=status_code,
                response=data
            )
        elif status_code == 401:
            raise SessionExpiredError("Unauthorized - session may be expired")
        elif status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            raise RateLimitError(
                "Rate limit exceeded",
                retry_after=retry_after
            )
        elif status_code >= 500:
            raise GSPAPIError(
                message="GSTN server error",
                status_code=status_code,
                response=data
            )
        else:
            raise GSPAPIError(
                message=data.get("message", "Unknown error"),
                status_code=status_code,
                response=data
            )
    
    # Authentication Methods
    def authenticate(
        self,
        username: str,
        password: str
    ) -> Dict[str, Any]:
        """
        Authenticate with GSTN using credentials.
        
        Args:
            username: GSTN username
            password: GSTN password
            
        Returns:
            Session token and expiry
        """
        data = {
            "username": username,
            "password": password,
            "app_key": self.app_key
        }
        
        response = self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["auth"],
            data=data
        )
        
        # Update session
        if response.get("session_token"):
            self.session_token = response["session_token"]
            self.refresh_token = response.get("refresh_token")
            exp_seconds = response.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=exp_seconds)
        
        return response
    
    def request_otp(self, username: str) -> Dict[str, Any]:
        """
        Request OTP for authentication.
        
        Args:
            username: GSTN username
            
        Returns:
            Request ID for OTP verification
        """
        data = {
            "username": username,
            "app_key": self.app_key
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["otp_request"],
            data=data
        )
    
    def verify_otp(
        self,
        username: str,
        otp: str,
        request_id: str
    ) -> Dict[str, Any]:
        """
        Verify OTP and get session token.
        
        Args:
            username: GSTN username
            otp: 6-digit OTP
            request_id: Request ID from OTP request
            
        Returns:
            Session token and expiry
        """
        data = {
            "username": username,
            "otp": otp,
            "request_id": request_id,
            "app_key": self.app_key
        }
        
        response = self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["otp_verify"],
            data=data
        )
        
        # Update session
        if response.get("session_token"):
            self.session_token = response["session_token"]
            self.refresh_token = response.get("refresh_token")
            exp_seconds = response.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=exp_seconds)
        
        return response
    
    def refresh_session(self) -> Dict[str, Any]:
        """Refresh the session token."""
        if not self.refresh_token:
            raise SessionExpiredError("No refresh token available")
        
        data = {
            "refresh_token": self.refresh_token,
            "app_key": self.app_key
        }
        
        response = self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["auth"],
            data=data
        )
        
        # Update session
        if response.get("session_token"):
            self.session_token = response["session_token"]
            self.refresh_token = response.get("refresh_token")
            exp_seconds = response.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=exp_seconds)
        
        return response
    
    def logout(self) -> bool:
        """Logout and invalidate session."""
        self.session_token = None
        self.refresh_token = None
        self.token_expiry = None
        return True
    
    # GSTR Data Methods
    def get_gstr1(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Download GSTR-1 data."""
        data = {
            "gstin": gstin,
            "rtp": return_period  # Return period
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr1"],
            data=data,
            include_auth=True
        )
    
    def get_gstr2a(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Download GSTR-2A data."""
        data = {
            "gstin": gstin,
            "rtp": return_period
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr2a"],
            data=data,
            include_auth=True
        )
    
    def get_gstr2b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Download GSTR-2B data."""
        data = {
            "gstin": gstin,
            "rtp": return_period
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr2b"],
            data=data,
            include_auth=True
        )
    
    def get_gstr3b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Download GSTR-3B data."""
        data = {
            "gstin": gstin,
            "rtp": return_period
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr3b"],
            data=data,
            include_auth=True
        )
    
    def get_gstr9(
        self,
        gstin: str,
        financial_year: str
    ) -> Dict[str, Any]:
        """Download GSTR-9 annual return."""
        data = {
            "gstin": gstin,
            "fy": financial_year
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr9"],
            data=data,
            include_auth=True
        )
    
    # Filing Methods
    def file_return(
        self,
        gstin: str,
        return_type: str,
        return_period: str,
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        File a return.
        
        Args:
            gstin: GSTIN
            return_type: Return type (GSTR1, GSTR3B, etc.)
            return_period: Return period
            json_data: Return JSON data
            
        Returns:
            Filing response with ARN
        """
        data = {
            "gstin": gstin,
            "rtp": return_period,
            "return_type": return_type,
            "json_str": json.dumps(json_data)
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["gstr_filing"],
            data=data,
            include_auth=True
        )
    
    def get_filing_status(
        self,
        gstin: str,
        arn: str
    ) -> Dict[str, Any]:
        """Get filing status by ARN."""
        data = {
            "gstin": gstin,
            "arn": arn
        }
        
        return self._make_request(
            method="POST",
            endpoint=self.ENDPOINTS["filing_status"],
            data=data,
            include_auth=True
        )
    
    # Health Check
    def health_check(self) -> Dict[str, Any]:
        """Check GSTN connection health."""
        try:
            start = datetime.now()
            
            # Simple profile request to check connectivity
            response = self._make_request(
                method="POST",
                endpoint=self.ENDPOINTS["profile"],
                data={"gstin": self.gstin},
                include_auth=True,
                retry_on_expired=False
            )
            
            latency = (datetime.now() - start).total_seconds() * 1000
            
            return {
                "status": "healthy",
                "latency_ms": int(latency),
                "message": "Connected to GSTN"
            }
        except SessionExpiredError:
            # Session expired but connection works
            return {
                "status": "healthy",
                "latency_ms": None,
                "message": "Connected to GSTN (session expired)"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": str(e)
            }
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client has valid session."""
        if not self.session_token:
            return False
        if self.token_expiry and datetime.now() >= self.token_expiry:
            return False
        return True
