"""
ERP Connector Exceptions

Custom exceptions for ERP connector operations.
"""

from typing import Optional, Dict, Any


class ERPConnectorError(Exception):
    """Base exception for all ERP connector errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(ERPConnectorError):
    """Raised when authentication fails"""
    pass


class ConnectionError(ERPConnectorError):
    """Raised when connection to ERP fails"""
    pass


class DataExtractionError(ERPConnectorError):
    """Raised when data extraction fails"""
    pass


class DataTransformationError(ERPConnectorError):
    """Raised when data transformation fails"""
    pass


class RateLimitError(ERPConnectorError):
    """Raised when API rate limit is exceeded"""
    
    def __init__(self, message: str, retry_after: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        self.retry_after = retry_after
        super().__init__(message, details)


class ValidationError(ERPConnectorError):
    """Raised when data validation fails"""
    pass


class SyncError(ERPConnectorError):
    """Raised when sync operation fails"""
    pass


class ConfigurationError(ERPConnectorError):
    """Raised when connector configuration is invalid"""
    pass
