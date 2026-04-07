"""
GSP Integration - Filing Service

Handles return filing workflows including GSTR-1, GSTR-3B, etc.
"""

import uuid
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

from india_compliance.gst_india.gsp_integration.models import (
    ReturnType,
    FilingStatus,
    GSPProvider
)
from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.auth_handler import get_auth_handler
from india_compliance.gst_india.gsp_integration.exceptions import (
    FilingError,
    SessionExpiredError,
    GSPNotConfiguredError,
    AuthenticationError
)


logger = logging.getLogger(__name__)


class FilingOperation(str, Enum):
    """Filing operation types."""
    FILE_GSTR1 = "file_gstr1"
    FILE_GSTR3B = "file_gstr3b"
    FILE_GSTR4 = "file_gstr4"
    FILE_GSTR9 = "file_gstr9"
    AMEND_GSTR1 = "amend_gstr1"


@dataclass
class FilingRecord:
    """Record of a filing operation."""
    filing_id: str
    gstin: str
    return_type: ReturnType
    return_period: str
    provider: GSPProvider
    arn: Optional[str] = None
    ack_number: Optional[str] = None
    status: FilingStatus = FilingStatus.PENDING
    json_data: Dict[str, Any] = field(default_factory=dict)
    filed_on: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    error_details: Optional[Dict[str, Any]] = None


class FilingService:
    """
    Service for handling return filing operations.
    
    Manages:
    - GSTR-1 filing
    - GSTR-3B filing
    - Amendment filing
    - Filing status tracking
    - ARN management
    """
    
    def __init__(self, gsp_registry=None, auth_handler=None):
        """
        Initialize filing service.
        
        Args:
            gsp_registry: GSP registry instance
            auth_handler: Auth handler instance
        """
        self._gsp_registry = gsp_registry
        self._auth_handler = auth_handler
        self._filing_records: Dict[str, FilingRecord] = {}  # filing_id -> record
    
    @property
    def gsp_registry(self):
        """Get GSP registry."""
        if self._gsp_registry is None:
            from india_compliance.gst_india.gsp_integration.gsp_registry import get_gsp_registry
            self._gsp_registry = get_gsp_registry()
        return self._gsp_registry
    
    @property
    def auth_handler(self):
        """Get auth handler."""
        if self._auth_handler is None:
            self._auth_handler = get_auth_handler()
        return self._auth_handler
    
    def _validate_return_type(self, return_type: ReturnType) -> bool:
        """Check if return type is supported for filing."""
        supported = {
            ReturnType.GSTR1,
            ReturnType.GSTR3B,
            ReturnType.GSTR4,
            ReturnType.GSTR9
        }
        return return_type in supported
    
    def _get_filing_method(self, return_type: ReturnType) -> str:
        """Get the GSP method name for filing."""
        method_map = {
            ReturnType.GSTR1: "file_gstr1",
            ReturnType.GSTR3B: "file_gstr3b",
            ReturnType.GSTR4: "file_gstr4",
            ReturnType.GSTR9: "file_gstr9"
        }
        return method_map.get(return_type, "file_return")
    
    def create_filing(
        self,
        gstin: str,
        return_type: ReturnType,
        return_period: str,
        json_data: Dict[str, Any],
        provider: Optional[GSPProvider] = None
    ) -> str:
        """
        Create a filing record.
        
        Args:
            gstin: GSTIN
            return_type: Return type
            return_period: Return period in MM-YYYY format
            json_data: Return JSON data
            provider: GSP provider
            
        Returns:
            Filing ID
        """
        if not self._validate_return_type(return_type):
            raise FilingError(f"Unsupported return type for filing: {return_type}")
        
        filing_id = f"FIL{uuid.uuid4().hex[:12].upper()}"
        
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        record = FilingRecord(
            filing_id=filing_id,
            gstin=gstin,
            return_type=return_type,
            return_period=return_period,
            provider=provider,
            json_data=json_data,
            status=FilingStatus.PENDING
        )
        
        self._filing_records[filing_id] = record
        
        logger.info(f"Created filing record: {filing_id} for {gstin} {return_type}")
        
        return filing_id
    
    def file_gstr1(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any],
        provider: Optional[GSPProvider] = None
    ) -> Dict[str, Any]:
        """
        File GSTR-1 return.
        
        Args:
            gstin: GSTIN
            return_period: Return period in MM-YYYY format
            json_data: GSTR-1 JSON data
            provider: GSP provider
            
        Returns:
            Dictionary with ARN, status, and filing details
            
        Raises:
            FilingError: If filing fails
        """
        # Check authentication
        if not self.auth_handler.is_authenticated(gstin):
            raise AuthenticationError("Not authenticated. Please authenticate first.")
        
        # Get provider
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        gsp = self.gsp_registry.get_provider(provider)
        
        try:
            # Call GSP filing API
            result = gsp.file_gstr1(
                gstin=gstin,
                return_period=return_period,
                json_data=json_data
            )
            
            # Create filing record
            filing_id = self.create_filing(
                gstin=gstin,
                return_type=ReturnType.GSTR1,
                return_period=return_period,
                json_data=json_data,
                provider=provider
            )
            
            # Update record with result
            record = self._filing_records[filing_id]
            record.arn = result.get("arn")
            record.ack_number = result.get("ack_number")
            record.status = FilingStatus.FILED if result.get("success") else FilingStatus.FAILED
            record.filed_on = datetime.now()
            
            logger.info(f"GSTR-1 filed: {filing_id}, ARN: {result.get('arn')}")
            
            return {
                "success": True,
                "filing_id": filing_id,
                "arn": result.get("arn"),
                "ack_number": result.get("ack_number"),
                "status": record.status.value,
                "filed_on": record.filed_on.isoformat(),
                "message": result.get("message", "GSTR-1 filed successfully")
            }
            
        except GSPNotConfiguredError:
            raise FilingError("GSP not configured")
        except SessionExpiredError:
            raise AuthenticationError("Session expired. Please re-authenticate.")
        except Exception as e:
            logger.error(f"GSTR-1 filing failed: {str(e)}")
            
            # Create failed filing record
            filing_id = self.create_filing(
                gstin=gstin,
                return_type=ReturnType.GSTR1,
                return_period=return_period,
                json_data=json_data,
                provider=provider
            )
            
            record = self._filing_records[filing_id]
            record.status = FilingStatus.FAILED
            record.error_details = {"error": str(e)}
            
            raise FilingError(f"GSTR-1 filing failed: {str(e)}", details={"filing_id": filing_id})
    
    def file_gstr3b(
        self,
        gstin: str,
        return_period: str,
        json_data: Dict[str, Any],
        provider: Optional[GSPProvider] = None
    ) -> Dict[str, Any]:
        """
        File GSTR-3B return.
        
        Args:
            gstin: GSTIN
            return_period: Return period in MM-YYYY format
            json_data: GSTR-3B JSON data
            provider: GSP provider
            
        Returns:
            Dictionary with ARN, status, and filing details
            
        Raises:
            FilingError: If filing fails
        """
        # Check authentication
        if not self.auth_handler.is_authenticated(gstin):
            raise AuthenticationError("Not authenticated. Please authenticate first.")
        
        # Get provider
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        gsp = self.gsp_registry.get_provider(provider)
        
        try:
            # Call GSP filing API
            result = gsp.file_gstr3b(
                gstin=gstin,
                return_period=return_period,
                json_data=json_data
            )
            
            # Create filing record
            filing_id = self.create_filing(
                gstin=gstin,
                return_type=ReturnType.GSTR3B,
                return_period=return_period,
                json_data=json_data,
                provider=provider
            )
            
            # Update record with result
            record = self._filing_records[filing_id]
            record.arn = result.get("arn")
            record.ack_number = result.get("ack_number")
            record.status = FilingStatus.FILED if result.get("success") else FilingStatus.FAILED
            record.filed_on = datetime.now()
            
            logger.info(f"GSTR-3B filed: {filing_id}, ARN: {result.get('arn')}")
            
            return {
                "success": True,
                "filing_id": filing_id,
                "arn": result.get("arn"),
                "ack_number": result.get("ack_number"),
                "status": record.status.value,
                "filed_on": record.filed_on.isoformat(),
                "message": result.get("message", "GSTR-3B filed successfully")
            }
            
        except GSPNotConfiguredError:
            raise FilingError("GSP not configured")
        except SessionExpiredError:
            raise AuthenticationError("Session expired. Please re-authenticate.")
        except Exception as e:
            logger.error(f"GSTR-3B filing failed: {str(e)}")
            
            # Create failed filing record
            filing_id = self.create_filing(
                gstin=gstin,
                return_type=ReturnType.GSTR3B,
                return_period=return_period,
                json_data=json_data,
                provider=provider
            )
            
            record = self._filing_records[filing_id]
            record.status = FilingStatus.FAILED
            record.error_details = {"error": str(e)}
            
            raise FilingError(f"GSTR-3B filing failed: {str(e)}", details={"filing_id": filing_id})
    
    def get_filing_status(
        self,
        arn: str,
        gstin: Optional[str] = None,
        provider: Optional[GSPProvider] = None
    ) -> Dict[str, Any]:
        """
        Get filing status by ARN.
        
        Args:
            arn: Application Reference Number
            gstin: GSTIN (optional, used to find provider)
            provider: GSP provider
            
        Returns:
            Dictionary with filing status
        """
        # Find filing record
        for filing_id, record in self._filing_records.items():
            if record.arn == arn:
                # Check current status from GSP
                if provider is None:
                    provider = record.provider
                
                gsp = self.gsp_registry.get_provider(provider)
                
                try:
                    result = gsp.get_filing_status(
                        gstin=record.gstin,
                        arn=arn
                    )
                    
                    # Update record
                    record.status = FilingStatus(result.get("status", record.status.value))
                    record.updated_at = datetime.now()
                    
                    return {
                        "filing_id": filing_id,
                        "arn": arn,
                        "gstin": record.gstin,
                        "return_type": record.return_type.value,
                        "return_period": record.return_period,
                        "status": record.status.value,
                        "filed_on": result.get("filed_on"),
                        "ack_number": result.get("ack_number")
                    }
                    
                except Exception as e:
                    logger.warning(f"Status check failed: {str(e)}")
                    return {
                        "filing_id": filing_id,
                        "arn": arn,
                        "gstin": record.gstin,
                        "status": record.status.value,
                        "error": str(e)
                    }
        
        return {
            "arn": arn,
            "status": "NOT_FOUND",
            "error": "Filing record not found"
        }
    
    def get_filing_history(
        self,
        gstin: str,
        return_type: Optional[ReturnType] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get filing history for a GSTIN.
        
        Args:
            gstin: GSTIN
            return_type: Filter by return type
            limit: Maximum records to return
            
        Returns:
            List of filing records
        """
        result = []
        
        for record in self._filing_records.values():
            if record.gstin != gstin:
                continue
            
            if return_type and record.return_type != return_type:
                continue
            
            result.append({
                "filing_id": record.filing_id,
                "arn": record.arn,
                "ack_number": record.ack_number,
                "return_type": record.return_type.value,
                "return_period": record.return_period,
                "status": record.status.value,
                "provider": record.provider.value,
                "filed_on": record.filed_on.isoformat() if record.filed_on else None,
                "created_at": record.created_at.isoformat()
            })
        
        # Sort by created_at descending
        result.sort(key=lambda x: x["created_at"], reverse=True)
        
        return result[:limit]
    
    def get_filing_record(self, filing_id: str) -> Optional[FilingRecord]:
        """Get filing record by ID."""
        return self._filing_records.get(filing_id)
    
    def cancel_filing(
        self,
        filing_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Cancel a pending filing.
        
        Args:
            filing_id: Filing ID
            reason: Cancellation reason
            
        Returns:
            Cancellation result
        """
        record = self._filing_records.get(filing_id)
        
        if not record:
            return {
                "success": False,
                "error": "Filing not found"
            }
        
        if record.status != FilingStatus.PENDING:
            return {
                "success": False,
                "error": f"Cannot cancel filing with status: {record.status.value}"
            }
        
        record.status = FilingStatus.FAILED
        record.error_details = {"cancelled": True, "reason": reason}
        record.updated_at = datetime.now()
        
        logger.info(f"Filing cancelled: {filing_id}")
        
        return {
            "success": True,
            "filing_id": filing_id,
            "message": "Filing cancelled"
        }


# Global instance
_filing_service: Optional[FilingService] = None


def get_filing_service() -> FilingService:
    """Get the global filing service instance."""
    global _filing_service
    if _filing_service is None:
        _filing_service = FilingService()
    return _filing_service
