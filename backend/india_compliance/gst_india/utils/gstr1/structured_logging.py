import logging
import json
import uuid
import contextvars
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Context variables to support trace_id, gstin, return_period, invoice_no, and row_number
_trace_id = contextvars.ContextVar("trace_id", default="")
_gstin = contextvars.ContextVar("gstin", default="")
_return_period = contextvars.ContextVar("return_period", default="")
_invoice_no = contextvars.ContextVar("invoice_no", default="")
_row_number = contextvars.ContextVar("row_number", default=0)

class StructuredJSONFormatter(logging.Formatter):
    """
    Structured JSON Formatter for production-grade logging observability.
    Includes custom fields: timestamp, trace_id, gstin, return_period, module, and event.
    """
    def format(self, record: logging.LogRecord) -> str:
        # Base log fields
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.name,
            "message": record.getMessage(),
            "trace_id": _trace_id.get() or str(uuid.uuid4()),
            "gstin": _gstin.get() or getattr(record, "gstin", ""),
            "return_period": _return_period.get() or getattr(record, "return_period", ""),
            "invoice_no": _invoice_no.get() or getattr(record, "invoice_no", ""),
            "row_number": _row_number.get() or getattr(record, "row_number", 0),
            "event": getattr(record, "event", "generic_log")
        }
        
        # Merge extra fields if passed in args as a dictionary
        if isinstance(record.args, dict):
            log_data.update(record.args)
            # Clear args so logging's format method doesn't try to format with them
            record.args = ()
        
        # Include exception info if available
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_data)

def get_structured_logger(name: str) -> logging.Logger:
    """
    Configures and returns a logger instance with StructuredJSONFormatter.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if already configured
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredJSONFormatter())
        logger.addHandler(handler)
        logger.propagate = False # Prevent double logging in standard root handlers
        
    return logger

def set_log_context(trace_id: str = "", gstin: str = "", return_period: str = ""):
    """
    Sets context variables for logging dynamically in routes or pipelines.
    """
    if trace_id:
        _trace_id.set(trace_id)
    if gstin:
        _gstin.set(gstin)
    if return_period:
        _return_period.set(return_period)

def set_row_context(invoice_no: str = "", row_number: int = 0):
    """
    Sets context variables for the current invoice row during validation loops.
    """
    _invoice_no.set(invoice_no)
    _row_number.set(row_number)

def clear_log_context():
    """
    Clears context variables after request completion.
    """
    _trace_id.set("")
    _gstin.set("")
    _return_period.set("")
    _invoice_no.set("")
    _row_number.set(0)
