"""
GSP Integration - Mock GSP Implementation

Mock implementation of GSP for testing and development.
"""

import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.models import (
    GSPProvider,
    GSPHealthStatus,
    AuthStatus,
    FilingStatus,
    ReturnType
)


logger = logging.getLogger(__name__)


class MockGSP(GSPBase):
    """
    Mock GSP implementation for testing.
    
    Simulates real GSP behavior without actual GSTN connectivity.
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider = GSPProvider.MOCK
        self._mock_delay = 0.1  # Simulate network delay
    
    def get_provider_name(self) -> str:
        return "Mock GSP"
    
    def authenticate(
        self,
        gstin: str,
        username: str,
        password: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mock authentication."""
        # Simulate authentication delay
        import time
        time.sleep(self._mock_delay)
        
        # Generate mock session token
        session_token = f"MOCK_{uuid.uuid4().hex.upper()}"
        
        self.session_token = session_token
        self.token_expiry = datetime.now() + timedelta(hours=1)
        
        # Store in authenticated gstins
        self.authenticated_gstins[gstin] = {
            "session_token": session_token,
            "expires_at": self.token_expiry,
            "username": username
        }
        
        return {
            "success": True,
            "session_token": session_token,
            "expires_in": 3600,
            "message": "Authentication successful (Mock)"
        }
    
    def request_otp(
        self,
        gstin: str,
        username: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mock OTP request."""
        import time
        time.sleep(self._mock_delay)
        
        request_id = f"REQ{uuid.uuid4().hex[:12].upper()}"
        
        return {
            "success": True,
            "request_id": request_id,
            "message": "OTP sent to registered mobile number (Mock)"
        }
    
    def verify_otp(
        self,
        gstin: str,
        username: str,
        otp: str,
        request_id: str
    ) -> Dict[str, Any]:
        """Mock OTP verification."""
        import time
        time.sleep(self._mock_delay)
        
        # Mock: Accept any 6-digit OTP
        if len(otp) == 6 and otp.isdigit():
            session_token = f"MOCK_{uuid.uuid4().hex.upper()}"
            
            self.session_token = session_token
            self.token_expiry = datetime.now() + timedelta(hours=1)
            
            self.authenticated_gstins[gstin] = {
                "session_token": session_token,
                "expires_at": self.token_expiry,
                "username": username
            }
            
            return {
                "success": True,
                "session_token": session_token,
                "expires_in": 3600,
                "message": "Authentication successful (Mock)"
            }
        
        return {
            "success": False,
            "error": "Invalid OTP",
            "error_code": "AUTH_003"
        }
    
    def refresh_session(self, gstin: str) -> Dict[str, Any]:
        """Mock session refresh."""
        import time
        time.sleep(self._mock_delay)
        
        session_token = f"MOCK_{uuid.uuid4().hex.upper()}"
        self.session_token = session_token
        self.token_expiry = datetime.now() + timedelta(hours=1)
        
        if gstin in self.authenticated_gstins:
            self.authenticated_gstins[gstin]["session_token"] = session_token
            self.authenticated_gstins[gstin]["expires_at"] = self.token_expiry
        
        return {
            "success": True,
            "session_token": session_token,
            "expires_in": 3600,
            "message": "Session refreshed (Mock)"
        }
    
    def logout(self, gstin: str) -> bool:
        """Mock logout."""
        if gstin in self.authenticated_gstins:
            del self.authenticated_gstins[gstin]
        return True
    
    def get_gstr1(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Mock GSTR-1 download."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        # Return mock GSTR-1 data
        return {
            "success": True,
            "gstin": gstin,
            "return_period": return_period,
            "data": {
                "b2b": [],
                "b2cl": [],
                "b2cs": [],
                "exp": [],
                "cdnr": [],
                "cdnur": [],
                "hsn": []
            },
            "status": "Generated",
            "processing_status": "success"
        }
    
    def get_gstr2a(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Mock GSTR-2A download."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        return {
            "success": True,
            "gstin": gstin,
            "return_period": return_period,
            "data": {
                "b2b": [],
                "b2bur": [],
                "cdnr": [],
                "cdnur": [],
                "isd": [],
                "impg": [],
                "impgsez": []
            },
            "status": "Generated",
            "processing_status": "success"
        }
    
    def get_gstr2b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Mock GSTR-2B download."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        return {
            "success": True,
            "gstin": gstin,
            "return_period": return_period,
            "data": {
                "b2b": [],
                "b2bur": [],
                "cdnr": [],
                "cdnur": [],
                "isd": [],
                "impg": [],
                "impgsez": []
            },
            "status": "Generated",
            "processing_status": "success"
        }
    
    def get_gstr3b(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Mock GSTR-3B download."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        return {
            "success": True,
            "gstin": gstin,
            "return_period": return_period,
            "data": {
                "sup_details": {
                    "osup_ty": {"txval": 0, "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    "osup_zero": {"txval": 0, "iamt": 0},
                    "osup_exempt": {"txval": 0, "iamt": 0},
                    "osup_nongst": {"txval": 0, "iamt": 0}
                },
                "itc_elg": {
                    "itc_avail": {"iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    "itc_rev": {"iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    "itc_net": {"iamt": 0, "camt": 0, "samt": 0, "csamt": 0}
                },
                "tax_pay": {
                    "igst": 0,
                    "cgst": 0,
                    "sgst": 0,
                    "cess": 0,
                    "total_tax": 0
                }
            },
            "status": "Generated"
        }
    
    def get_gstr9(
        self,
        gstin: str,
        financial_year: str
    ) -> Dict[str, Any]:
        """Mock GSTR-9 download."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        return {
            "success": True,
            "gstin": gstin,
            "financial_year": financial_year,
            "data": {},
            "status": "Generated"
        }
    
    def file_gstr1(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Mock GSTR-1 filing."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        ack_number = f"ACK{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8].upper()}"
        
        return {
            "success": True,
            "ack_number": ack_number,
            "arn": f"ARN{return_period.replace('-', '')}{uuid.uuid4().hex[:12].upper()}",
            "filing_date": datetime.now().isoformat(),
            "status": "filed",
            "message": "GSTR-1 filed successfully (Mock)"
        }
    
    def file_gstr3b(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Mock GSTR-3B filing."""
        import time
        time.sleep(self._mock_delay)
        
        if not self.validate_session(gstin):
            raise Exception("Session expired")
        
        ack_number = f"ACK{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8].upper()}"
        
        return {
            "success": True,
            "ack_number": ack_number,
            "arn": f"ARN{return_period.replace('-', '')}{uuid.uuid4().hex[:12].upper()}",
            "filing_date": datetime.now().isoformat(),
            "status": "filed",
            "message": "GSTR-3B filed successfully (Mock)"
        }
    
    def get_filing_status(
        self,
        gstin: str,
        arn: str
    ) -> Dict[str, Any]:
        """Mock filing status check."""
        import time
        time.sleep(self._mock_delay)
        
        return {
            "success": True,
            "gstin": gstin,
            "arn": arn,
            "status": "FILED",
            "filing_date": datetime.now().isoformat(),
            "ack_number": f"ACK{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Mock health check."""
        return {
            "status": "healthy",
            "latency_ms": 50,
            "message": "Mock GSP is running"
        }


# Register the mock GSP provider
def register_mock_gsp():
    """Register the mock GSP provider with the registry."""
    from india_compliance.gst_india.gsp_integration.gsp_registry import (
        get_gsp_registry,
        GSP_PROVIDER_INFO
    )
    
    registry = get_gsp_registry()
    registry.register_provider(GSPProvider.MOCK, MockGSP)
    
    logger.info("Mock GSP provider registered")


# Auto-register on import
register_mock_gsp()
