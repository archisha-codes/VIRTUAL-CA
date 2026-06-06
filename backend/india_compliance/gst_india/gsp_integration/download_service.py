"""
GSP Integration - Download Service

Handles downloading GSTR data from GSTN.
"""

import uuid
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field

from india_compliance.gst_india.gsp_integration.models import (
    ReturnType,
    GSPProvider
)
from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.auth_handler import get_auth_handler
from india_compliance.gst_india.gsp_integration.exceptions import (
    DownloadError,
    SessionExpiredError,
    GSPNotConfiguredError,
    AuthenticationError
)


logger = logging.getLogger(__name__)


@dataclass
class DownloadRecord:
    """Record of a download operation."""
    download_id: str
    gstin: str
    return_type: ReturnType
    return_period: str
    provider: GSPProvider
    status: str = "pending"  # pending, processing, completed, failed
    progress: int = 0
    data: Optional[Dict[str, Any]] = None
    record_count: int = 0
    error_details: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


class DownloadService:
    """
    Service for downloading GSTR data from GSTN.
    
    Supports:
    - GSTR-1 download
    - GSTR-2A download
    - GSTR-2B download
    - GSTR-9 download
    - Background download with progress tracking
    """
    
    def __init__(self, gsp_registry=None, auth_handler=None):
        """
        Initialize download service.
        
        Args:
            gsp_registry: GSP registry instance
            auth_handler: Auth handler instance
        """
        self._gsp_registry = gsp_registry
        self._auth_handler = auth_handler
        self._download_records: Dict[str, DownloadRecord] = {}  # download_id -> record
    
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
        """Check if return type is supported for download."""
        supported = {
            ReturnType.GSTR1,
            ReturnType.GSTR2A,
            ReturnType.GSTR2B,
            ReturnType.GSTR3B,
            ReturnType.GSTR9
        }
        return return_type in supported
    
    def _get_download_method(self, return_type: ReturnType) -> str:
        """Get the GSP method name for downloading."""
        method_map = {
            ReturnType.GSTR1: "get_gstr1",
            ReturnType.GSTR2A: "get_gstr2a",
            ReturnType.GSTR2B: "get_gstr2b",
            ReturnType.GSTR3B: "get_gstr3b",
            ReturnType.GSTR9: "get_gstr9"
        }
        return method_map.get(return_type, "get_return")
    
    def create_download(
        self,
        gstin: str,
        return_type: ReturnType,
        return_period: str,
        provider: Optional[GSPProvider] = None
    ) -> str:
        """
        Create a download record.
        
        Args:
            gstin: GSTIN
            return_type: Return type
            return_period: Return period in MM-YYYY format
            provider: GSP provider
            
        Returns:
            Download ID
        """
        if not self._validate_return_type(return_type):
            raise DownloadError(f"Unsupported return type for download: {return_type}")
        
        download_id = f"DL{uuid.uuid4().hex[:12].upper()}"
        
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        record = DownloadRecord(
            download_id=download_id,
            gstin=gstin,
            return_type=return_type,
            return_period=return_period,
            provider=provider,
            status="pending"
        )
        
        self._download_records[download_id] = record
        
        logger.info(f"Created download record: {download_id} for {gstin} {return_type}")
        
        return download_id
    
    def download_gstr1(
        self,
        gstin: str,
        return_period: str,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Download GSTR-1 data.
        
        Args:
            gstin: GSTIN
            return_period: Return period in MM-YYYY format
            provider: GSP provider
            force_refresh: Force refresh even if cached
            
        Returns:
            Dictionary with GSTR-1 data
        """
        return self._download_data(
            gstin=gstin,
            return_type=ReturnType.GSTR1,
            return_period=return_period,
            provider=provider,
            force_refresh=force_refresh
        )
    
    def download_gstr2a(
        self,
        gstin: str,
        return_period: str,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Download GSTR-2A data.
        
        Args:
            gstin: GSTIN
            return_period: Return period in MM-YYYY format
            provider: GSP provider
            force_refresh: Force refresh even if cached
            
        Returns:
            Dictionary with GSTR-2A data
        """
        return self._download_data(
            gstin=gstin,
            return_type=ReturnType.GSTR2A,
            return_period=return_period,
            provider=provider,
            force_refresh=force_refresh
        )
    
    def download_gstr2b(
        self,
        gstin: str,
        return_period: str,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Download GSTR-2B data.
        
        Args:
            gstin: GSTIN
            return_period: Return period in MM-YYYY format
            provider: GSP provider
            force_refresh: Force refresh even if cached
            
        Returns:
            Dictionary with GSTR-2B data
        """
        return self._download_data(
            gstin=gstin,
            return_type=ReturnType.GSTR2B,
            return_period=return_period,
            provider=provider,
            force_refresh=force_refresh
        )
    
    def download_gstr9(
        self,
        gstin: str,
        financial_year: str,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Download GSTR-9 annual return.
        
        Args:
            gstin: GSTIN
            financial_year: Financial year in YYYY-YY format
            provider: GSP provider
            force_refresh: Force refresh even if cached
            
        Returns:
            Dictionary with GSTR-9 data
        """
        # GSTR-9 uses financial year instead of return period
        return_type = ReturnType.GSTR9
        
        # Check authentication
        if not self.auth_handler.is_authenticated(gstin):
            raise AuthenticationError("Not authenticated. Please authenticate first.")
        
        # Get provider
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        gsp = self.gsp_registry.get_provider(provider)
        
        # Create download record
        download_id = self.create_download(
            gstin=gstin,
            return_type=return_type,
            return_period=financial_year,
            provider=provider
        )
        
        record = self._download_records[download_id]
        record.status = "processing"
        record.progress = 10
        
        try:
            # Call GSP download API
            method = self._get_download_method(return_type)
            download_func = getattr(gsp, method)
            
            result = download_func(
                gstin=gstin,
                return_period=financial_year
            )
            
            record.progress = 90
            
            # Update record with result
            record.data = result.get("data", {})
            record.status = "completed" if result.get("success") else "failed"
            record.record_count = self._count_records(result.get("data", {}))
            record.completed_at = datetime.now()
            
            logger.info(f"GSTR-9 downloaded: {download_id}, Records: {record.record_count}")
            
            return {
                "success": True,
                "download_id": download_id,
                "data": record.data,
                "record_count": record.record_count,
                "status": record.status,
                "message": "GSTR-9 downloaded successfully"
            }
            
        except GSPNotConfiguredError:
            raise DownloadError("GSP not configured")
        except SessionExpiredError:
            raise AuthenticationError("Session expired. Please re-authenticate.")
        except Exception as e:
            logger.error(f"GSTR-9 download failed: {str(e)}")
            record.status = "failed"
            record.error_details = {"error": str(e)}
            raise DownloadError(f"GSTR-9 download failed: {str(e)}")
    
    def _download_data(
        self,
        gstin: str,
        return_type: ReturnType,
        return_period: str,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Internal method to download GSTR data.
        
        Args:
            gstin: GSTIN
            return_type: Return type
            return_period: Return period
            provider: GSP provider
            force_refresh: Force refresh
            
        Returns:
            Dictionary with data
        """
        # Check authentication
        if not self.auth_handler.is_authenticated(gstin):
            raise AuthenticationError("Not authenticated. Please authenticate first.")
        
        # Get provider
        if provider is None:
            provider = self.gsp_registry.get_default_provider()
        
        gsp = self.gsp_registry.get_provider(provider)
        
        # Create download record
        download_id = self.create_download(
            gstin=gstin,
            return_type=return_type,
            return_period=return_period,
            provider=provider
        )
        
        record = self._download_records[download_id]
        record.status = "processing"
        record.progress = 10
        
        try:
            # Call GSP download API
            method = self._get_download_method(return_type)
            download_func = getattr(gsp, method)
            
            result = download_func(
                gstin=gstin,
                return_period=return_period
            )
            
            record.progress = 90
            
            # Update record with result
            record.data = result.get("data", {})
            record.status = "completed" if result.get("success") else "failed"
            record.record_count = self._count_records(result.get("data", {}))
            record.completed_at = datetime.now()
            
            logger.info(f"{return_type.value} downloaded: {download_id}, Records: {record.record_count}")
            
            return {
                "success": True,
                "download_id": download_id,
                "data": record.data,
                "record_count": record.record_count,
                "status": record.status,
                "message": f"{return_type.value} downloaded successfully"
            }
            
        except GSPNotConfiguredError:
            raise DownloadError("GSP not configured")
        except SessionExpiredError:
            raise AuthenticationError("Session expired. Please re-authenticate.")
        except Exception as e:
            logger.error(f"{return_type.value} download failed: {str(e)}")
            record.status = "failed"
            record.error_details = {"error": str(e)}
            raise DownloadError(f"{return_type.value} download failed: {str(e)}")
    
    def _count_records(self, data: Dict[str, Any]) -> int:
        """Count total records in downloaded data."""
        count = 0
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, list):
                    count += len(value)
                elif isinstance(value, dict):
                    count += self._count_records(value)
        return count
    
    def get_download_status(
        self,
        download_id: str
    ) -> Dict[str, Any]:
        """
        Get download status by ID.
        
        Args:
            download_id: Download ID
            
        Returns:
            Dictionary with download status
        """
        record = self._download_records.get(download_id)
        
        if not record:
            return {
                "download_id": download_id,
                "status": "NOT_FOUND",
                "error": "Download record not found"
            }
        
        return {
            "download_id": record.download_id,
            "gstin": record.gstin,
            "return_type": record.return_type.value,
            "return_period": record.return_period,
            "status": record.status,
            "progress": record.progress,
            "record_count": record.record_count,
            "created_at": record.created_at.isoformat(),
            "completed_at": record.completed_at.isoformat() if record.completed_at else None
        }
    
    def get_download_history(
        self,
        gstin: str,
        return_type: Optional[ReturnType] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get download history for a GSTIN.
        
        Args:
            gstin: GSTIN
            return_type: Filter by return type
            limit: Maximum records to return
            
        Returns:
            List of download records
        """
        result = []
        
        for record in self._download_records.values():
            if record.gstin != gstin:
                continue
            
            if return_type and record.return_type != return_type:
                continue
            
            result.append({
                "download_id": record.download_id,
                "return_type": record.return_type.value,
                "return_period": record.return_period,
                "status": record.status,
                "record_count": record.record_count,
                "provider": record.provider.value,
                "created_at": record.created_at.isoformat(),
                "completed_at": record.completed_at.isoformat() if record.completed_at else None
            })
        
        # Sort by created_at descending
        result.sort(key=lambda x: x["created_at"], reverse=True)
        
        return result[:limit]
    
    def get_download_record(self, download_id: str) -> Optional[DownloadRecord]:
        """Get download record by ID."""
        return self._download_records.get(download_id)
    
    def retry_download(
        self,
        download_id: str
    ) -> Dict[str, Any]:
        """
        Retry a failed download.
        
        Args:
            download_id: Download ID
            
        Returns:
            Retry result
        """
        record = self._download_records.get(download_id)
        
        if not record:
            return {
                "success": False,
                "error": "Download not found"
            }
        
        if record.status != "failed":
            return {
                "success": False,
                "error": f"Cannot retry download with status: {record.status}"
            }
        
        # Re-download
        return self._download_data(
            gstin=record.gstin,
            return_type=record.return_type,
            return_period=record.return_period,
            provider=record.provider
        )


# Global instance
_download_service: Optional[DownloadService] = None


def get_download_service() -> DownloadService:
    """Get the global download service instance."""
    global _download_service
    if _download_service is None:
        _download_service = DownloadService()
    return _download_service
