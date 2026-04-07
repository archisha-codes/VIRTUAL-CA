"""
GSP Integration - Authentication Handler

Handles OTP generation, verification, and session token management.
"""

import uuid
import hashlib
import base64
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field

from india_compliance.gst_india.gsp_integration.models import (
    AuthStatus,
    GSPProvider
)
from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.exceptions import (
    AuthenticationError,
    InvalidOTPError,
    SessionExpiredError,
    GSPNotConfiguredError
)


logger = logging.getLogger(__name__)


@dataclass
class AuthSession:
    """Authentication session data."""
    gstin: str
    username: str
    provider: GSPProvider
    session_token: str
    refresh_token: Optional[str] = None
    expires_at: datetime = field(default_factory=lambda: datetime.now() + timedelta(hours=1))
    created_at: datetime = field(default_factory=datetime.now)
    last_refreshed: datetime = field(default_factory=datetime.now)
    ip_address: Optional[str] = None


class AuthHandler:
    """
    Authentication handler for GSP integration.
    
    Manages:
    - OTP generation and verification
    - Session token management
    - Auto-refresh tokens
    - Secure credential storage
    """
    
    def __init__(self, gsp_registry=None):
        """
        Initialize authentication handler.
        
        Args:
            gsp_registry: GSP registry instance
        """
        self._gsp_registry = gsp_registry
        self._sessions: Dict[str, AuthSession] = {}  # gstin -> session
        self._pending_otp: Dict[str, Dict[str, Any]] = {}  # gstin -> otp request data
    
    @property
    def gsp_registry(self):
        """Get GSP registry."""
        if self._gsp_registry is None:
            from india_compliance.gst_india.gsp_integration.gsp_registry import get_gsp_registry
            self._gsp_registry = get_gsp_registry()
        return self._gsp_registry
    
    def request_otp(
        self,
        gstin: str,
        username: str,
        provider: Optional[GSPProvider] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Request OTP for authentication.
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            provider: GSP provider (uses default if not specified)
            ip_address: User's IP address
            
        Returns:
            Dictionary with request_id and message
            
        Raises:
            AuthenticationError: If OTP request fails
        """
        try:
            gsp = self.gsp_registry.get_provider(provider)
            
            result = gsp.request_otp(
                gstin=gstin,
                username=username,
                ip_address=ip_address
            )
            
            # Store pending OTP request
            self._pending_otp[gstin] = {
                "request_id": result.get("request_id", str(uuid.uuid4())),
                "username": username,
                "provider": gsp.provider,
                "requested_at": datetime.now(),
                "ip_address": ip_address
            }
            
            logger.info(f"OTP requested for GSTIN: {gstin}, Provider: {gsp.provider.value}")
            
            return {
                "success": True,
                "request_id": result.get("request_id"),
                "message": "OTP sent to registered mobile number",
                "expires_in": 300  # 5 minutes
            }
            
        except GSPNotConfiguredError as e:
            raise AuthenticationError(f"GSP not configured: {str(e)}")
        except Exception as e:
            logger.error(f"OTP request failed: {str(e)}")
            raise AuthenticationError(f"Failed to request OTP: {str(e)}")
    
    def verify_otp(
        self,
        gstin: str,
        username: str,
        otp: str,
        provider: Optional[GSPProvider] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Verify OTP and create session.
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            otp: 6-digit OTP
            provider: GSP provider (uses default if not specified)
            ip_address: User's IP address
            
        Returns:
            Dictionary with session token and expiry
            
        Raises:
            InvalidOTPError: If OTP is invalid
            AuthenticationError: If verification fails
        """
        # Get pending OTP request
        pending = self._pending_otp.get(gstin)
        
        if not pending:
            raise InvalidOTPError("No OTP request found. Please request OTP first.")
        
        # Check OTP expiry (5 minutes)
        if (datetime.now() - pending["requested_at"]).total_seconds() > 300:
            del self._pending_otp[gstin]
            raise InvalidOTPError("OTP expired. Please request a new OTP.")
        
        # Use provider from pending request if not specified
        if provider is None:
            provider = pending.get("provider")
        
        try:
            gsp = self.gsp_registry.get_provider(provider)
            
            result = gsp.verify_otp(
                gstin=gstin,
                username=username,
                otp=otp,
                request_id=pending["request_id"]
            )
            
            # Create session
            session = AuthSession(
                gstin=gstin,
                username=username,
                provider=gsp.provider,
                session_token=result.get("session_token", ""),
                refresh_token=result.get("refresh_token"),
                expires_at=datetime.now() + timedelta(seconds=result.get("expires_in", 3600)),
                ip_address=ip_address or pending.get("ip_address")
            )
            
            # Store session
            self._sessions[gstin] = session
            
            # Clear pending OTP
            del self._pending_otp[gstin]
            
            logger.info(f"OTP verified for GSTIN: {gstin}, Provider: {gsp.provider.value}")
            
            return {
                "success": True,
                "session_token": session.session_token,
                "refresh_token": session.refresh_token,
                "expires_in": result.get("expires_in", 3600),
                "expires_at": session.expires_at.isoformat(),
                "message": "Authentication successful"
            }
            
        except InvalidOTPError:
            raise
        except Exception as e:
            logger.error(f"OTP verification failed: {str(e)}")
            raise AuthenticationError(f"Failed to verify OTP: {str(e)}")
    
    def authenticate(
        self,
        gstin: str,
        username: str,
        password: str,
        provider: Optional[GSPProvider] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate with username and password (non-OTP).
        
        Args:
            gstin: GSTIN of the user
            username: GSP username
            password: GSP password
            provider: GSP provider
            ip_address: User's IP address
            
        Returns:
            Dictionary with session token and expiry
            
        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            gsp = self.gsp_registry.get_provider(provider)
            
            result = gsp.authenticate(
                gstin=gstin,
                username=username,
                password=password,
                ip_address=ip_address
            )
            
            # Create session
            session = AuthSession(
                gstin=gstin,
                username=username,
                provider=gsp.provider,
                session_token=result.get("session_token", ""),
                refresh_token=result.get("refresh_token"),
                expires_at=datetime.now() + timedelta(seconds=result.get("expires_in", 3600)),
                ip_address=ip_address
            )
            
            # Store session
            self._sessions[gstin] = session
            
            logger.info(f"Authenticated GSTIN: {gstin}, Provider: {gsp.provider.value}")
            
            return {
                "success": True,
                "session_token": session.session_token,
                "refresh_token": session.refresh_token,
                "expires_in": result.get("expires_in", 3600),
                "expires_at": session.expires_at.isoformat(),
                "message": "Authentication successful"
            }
            
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    def refresh_token(
        self,
        gstin: str,
        provider: Optional[GSPProvider] = None
    ) -> Dict[str, Any]:
        """
        Refresh session token.
        
        Args:
            gstin: GSTIN of the user
            provider: GSP provider
            
        Returns:
            Dictionary with new session token and expiry
            
        Raises:
            SessionExpiredError: If session cannot be refreshed
        """
        session = self._sessions.get(gstin)
        
        if not session:
            raise SessionExpiredError("No active session found")
        
        if provider is None:
            provider = session.provider
        
        try:
            gsp = self.gsp_registry.get_provider(provider)
            
            result = gsp.refresh_session(gstin)
            
            # Update session
            session.session_token = result.get("session_token", session.session_token)
            session.refresh_token = result.get("refresh_token", session.refresh_token)
            session.expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 3600))
            session.last_refreshed = datetime.now()
            
            logger.info(f"Token refreshed for GSTIN: {gstin}")
            
            return {
                "success": True,
                "session_token": session.session_token,
                "refresh_token": session.refresh_token,
                "expires_in": result.get("expires_in", 3600),
                "expires_at": session.expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Token refresh failed: {str(e)}")
            raise SessionExpiredError(f"Failed to refresh token: {str(e)}")
    
    def logout(
        self,
        gstin: str,
        provider: Optional[GSPProvider] = None
    ) -> bool:
        """
        Logout and invalidate session.
        
        Args:
            gstin: GSTIN of the user
            provider: GSP provider
            
        Returns:
            True if logout successful
        """
        session = self._sessions.get(gstin)
        
        if session:
            try:
                if provider is None:
                    provider = session.provider
                
                gsp = self.gsp_registry.get_provider(provider)
                gsp.logout(gstin)
            except Exception as e:
                logger.warning(f"GSP logout error: {str(e)}")
            finally:
                del self._sessions[gstin]
        
        logger.info(f"Logged out GSTIN: {gstin}")
        return True
    
    def get_auth_status(
        self,
        gstin: str
    ) -> Dict[str, Any]:
        """
        Get authentication status for GSTIN.
        
        Args:
            gstin: GSTIN to check
            
        Returns:
            Dictionary with auth status
        """
        session = self._sessions.get(gstin)
        
        if not session:
            return {
                "gstin": gstin,
                "status": AuthStatus.NOT_AUTHENTICATED.value,
                "is_authenticated": False
            }
        
        # Check if expired
        if datetime.now() >= session.expires_at:
            return {
                "gstin": gstin,
                "status": AuthStatus.SESSION_EXPIRED.value,
                "is_authenticated": False,
                "expires_at": session.expires_at.isoformat()
            }
        
        return {
            "gstin": gstin,
            "username": session.username,
            "provider": session.provider.value,
            "status": AuthStatus.AUTHENTICATED.value,
            "is_authenticated": True,
            "created_at": session.created_at.isoformat(),
            "expires_at": session.expires_at.isoformat(),
            "last_refreshed": session.last_refreshed.isoformat()
        }
    
    def is_authenticated(self, gstin: str) -> bool:
        """Check if GSTIN has valid session."""
        status = self.get_auth_status(gstin)
        return status.get("is_authenticated", False)
    
    def get_session(self, gstin: str) -> Optional[AuthSession]:
        """Get session for GSTIN."""
        return self._sessions.get(gstin)
    
    def list_sessions(self) -> Dict[str, Dict[str, Any]]:
        """List all active sessions."""
        result = {}
        for gstin, session in self._sessions.items():
            result[gstin] = {
                "username": session.username,
                "provider": session.provider.value,
                "created_at": session.created_at.isoformat(),
                "expires_at": session.expires_at.isoformat()
            }
        return result
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions."""
        expired = []
        now = datetime.now()
        
        for gstin, session in self._sessions.items():
            if now >= session.expires_at:
                expired.append(gstin)
        
        for gstin in expired:
            del self._sessions[gstin]
        
        return len(expired)


# Global instance
_auth_handler: Optional[AuthHandler] = None


def get_auth_handler() -> AuthHandler:
    """Get the global auth handler instance."""
    global _auth_handler
    if _auth_handler is None:
        _auth_handler = AuthHandler()
    return _auth_handler
