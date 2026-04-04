"""
AI/ML Reconciliation Exceptions

Custom exceptions for the AI/ML reconciliation module.
"""

from typing import Optional, Any, Dict


class AIReconciliationError(Exception):
    """Base exception for AI reconciliation errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class MatchingError(AIReconciliationError):
    """Error during invoice matching"""
    pass


class ModelError(AIReconciliationError):
    """Error in ML model operations"""
    pass


class AnomalyDetectionError(AIReconciliationError):
    """Error during anomaly detection"""
    pass


class LearningError(AIReconciliationError):
    """Error in learning system"""
    pass


class InvalidInvoiceDataError(AIReconciliationError):
    """Invalid invoice data provided"""
    pass


class InsufficientDataError(AIReconciliationError):
    """Insufficient data for ML operations"""
    pass


class ConfigurationError(AIReconciliationError):
    """Configuration error"""
    pass


class APIError(AIReconciliationError):
    """API error during reconciliation"""
    
    def __init__(self, message: str, status_code: int = 500, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


class ReconciliationTimeoutError(AIReconciliationError):
    """Reconciliation process timeout"""
    pass


class DataQualityError(AIReconciliationError):
    """Data quality issues detected"""
    pass


class DuplicateMatchError(AIReconciliationError):
    """Duplicate match detected"""
    pass


class UnmatchedInvoiceError(AIReconciliationError):
    """Invoice could not be matched"""
    pass
