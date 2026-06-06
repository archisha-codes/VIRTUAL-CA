"""Custom exceptions for GST compliance operations."""


class GSPServerError(Exception):
    """Base exception for GSP/GST server errors."""
    message = "GSP/GST server is down"
    http_status_code = 500

    def __init__(self, message=None, *args, **kwargs):
        self.message = message or self.message
        self.http_status_code = kwargs.pop("http_status_code", self.http_status_code)
        super().__init__(self.message, *args, **kwargs)


class GSPLimitExceededError(GSPServerError):
    """Exception raised when GSP/GST account limit is exceeded."""
    message = "GSP/GST account limit exceeded"
    http_status_code = 429


class GatewayTimeoutError(GSPServerError):
    """Exception raised when the server takes too long to respond."""
    message = "The server took too long to respond"
    http_status_code = 504


class OTPRequestedError(Exception):
    """Exception raised when OTP is requested."""
    def __init__(self, message="OTP has been requested", *args, **kwargs):
        self.response = kwargs.pop("response", None)
        super().__init__(message, *args, **kwargs)


class InvalidOTPError(Exception):
    """Exception raised when OTP is invalid."""
    def __init__(self, message="Invalid OTP", *args, **kwargs):
        self.response = kwargs.pop("response", None)
        super().__init__(message, *args, **kwargs)


class InvalidAuthTokenError(Exception):
    """Exception raised when auth token is invalid."""
    def __init__(self, message="Invalid Auth Token", *args, **kwargs):
        super().__init__(message, *args, **kwargs)


class ValidationError(Exception):
    """Exception raised for validation errors."""
    def __init__(self, message, field=None):
        self.message = message
        self.field = field
        super().__init__(message)


class GSTINValidationError(ValidationError):
    """Exception raised for GSTIN validation errors."""
    pass


class TaxCalculationError(ValidationError):
    """Exception raised for tax calculation errors."""
    pass


class ExcelParsingError(Exception):
    """Exception raised for Excel parsing errors."""
    pass
