"""
FastAPI-compatible frappe compatibility layer.

This module provides replacements for frappe functions and utilities
to allow the codebase to run without the frappe framework.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from functools import wraps
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Union
from base64 import b64decode, b64encode

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# Global Flags and Local Context (Replacements for frappe.flags and frappe.local)
# =============================================================================

class FastAPIFlags:
    """Replaces frappe.flags for managing global flags."""
    
    def __init__(self):
        self._flags = {}
    
    def __getattr__(self, name: str) -> Any:
        return self._flags.get(name)
    
    def __setattr__(self, name: str, value: Any):
        if name.startswith('_'):
            super().__setattr__(name, value)
        else:
            self._flags[name] = value
    
    def get(self, name: str, default: Any = None) -> Any:
        return self._flags.get(name, default)
    
    def set(self, name: str, value: Any):
        self._flags[name] = value


class FastAPILocal:
    """Replaces frappe.local for request-local storage."""
    
    def __init__(self):
        self._data = {}
    
    def __getattr__(self, name: str) -> Any:
        return self._data.get(name)
    
    def __setattr__(self, name: str, value: Any):
        if name.startswith('_'):
            super().__setattr__(name, value)
        else:
            self._data[name] = value


# Global instances
flags = FastAPIFlags()
local = FastAPILocal()


# =============================================================================
# Dict-like Objects (Replacements for frappe._dict)
# =============================================================================

def _dict(data: Any = None, **kwargs) -> Dict[str, Any]:
    """
    Convert data to a dictionary.
    Replaces frappe._dict()
    """
    if data is None:
        data = {}
    elif hasattr(data, '__dict__'):
        return {**data.__dict__, **kwargs}
    elif isinstance(data, dict):
        return {**data, **kwargs}
    else:
        return dict(data)
    
    return data if isinstance(data, dict) else {}


def dict_to_object(data: Dict[str, Any]) -> SimpleNamespace:
    """Convert dictionary to SimpleNamespace object."""
    return SimpleNamespace(**data)


# =============================================================================
# Exception Raising (Replacements for frappe.throw)
# =============================================================================

class ValidationError(Exception):
    """Base validation error."""
    def __init__(self, message: str, title: str = "Validation Error", **kwargs):
        self.message = message
        self.title = title
        self.http_status_code = kwargs.pop('http_status_code', 400)
        super().__init__(message)


class PermissionError(Exception):
    """Permission denied error."""
    pass


class DoesNotExistError(Exception):
    """Document does not exist error."""
    pass


def throw(message: str, title: str = "Validation Error", exc: Exception = None, **kwargs):
    """
    Raise an exception with the given message.
    Replaces frappe.throw()
    """
    http_status_code = kwargs.pop('http_status_code', 400)
    
    if exc:
        # Re-raise with additional context
        raise ValidationError(message, title=title, exc=exc, http_status_code=http_status_code) from exc
    
    raise ValidationError(message, title=title, http_status_code=http_status_code)


def generate_hash(length: int = 32) -> str:
    """
    Generate a random hash string.
    Replaces frappe.generate_hash()
    """
    return hashlib.sha256(f"{datetime.now().timestamp()}".encode()).hexdigest()[:length]


# =============================================================================
# JSON Utilities (Replacements for frappe.as_json, frappe.parse_json)
# =============================================================================

def as_json(obj: Any, indent: int = None, **kwargs) -> str:
    """
    Convert object to JSON string.
    Replaces frappe.as_json()
    """
    return json.dumps(obj, indent=indent, **kwargs)


def parse_json(data: Union[str, bytes]) -> Any:
    """
    Parse JSON string to object.
    Replaces frappe.parse_json()
    """
    if isinstance(data, bytes):
        data = data.decode('utf-8')
    return json.loads(data)


# =============================================================================
# Type Conversion Utilities (Replacements for frappe.utils functions)
# =============================================================================

def sbool(value: Any) -> bool:
    """
    Convert value to boolean.
    Replaces frappe.utils.sbool()
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('1', 'true', 'yes', 'on')
    return bool(value)


def cint(value: Any) -> int:
    """
    Convert value to integer.
    Replaces frappe.utils.cint()
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def cstr(value: Any) -> str:
    """
    Convert value to string.
    Replaces frappe.utils.cstr()
    """
    if value is None:
        return ""
    return str(value)


# =============================================================================
# Date and Time Utilities (Replacements for frappe.utils date functions)
# =============================================================================

def getdate(date=None):
    """
    Convert value to date object.
    Replaces frappe.utils.getdate()
    """
    from dateutil import parser
    
    if date is None:
        return datetime.now().date()
    
    if isinstance(date, datetime):
        return date.date()
    if isinstance(date, datetime.date):
        return date
    
    try:
        return parser.parse(str(date)).date()
    except (ValueError, TypeError):
        return None


def now_datetime():
    """
    Get current datetime.
    Replaces frappe.utils.now_datetime()
    """
    return datetime.now()


def add_to_date(date=None, years=0, months=0, days=0, hours=0, minutes=0, seconds=0, as_datetime=False):
    """
    Add time to a date.
    Replaces frappe.utils.add_to_date()
    """
    from dateutil.relativedelta import relativedelta
    
    date = date or datetime.now()
    
    if years or months:
        date = date + relativedelta(years=years, months=months, days=days,
                                     hours=hours, minutes=minutes, seconds=seconds)
    else:
        date = date + timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
    
    return date if as_datetime else date.date()


def format_date(date, format="dd/MM/yyyy"):
    """
    Format date to string.
    Replaces frappe.utils.format_date()
    """
    if not date:
        return ""
    
    if isinstance(date, str):
        date = getdate(date)
    
    if isinstance(date, datetime.date):
        replacements = {
            "dd": str(date.day).zfill(2),
            "d": str(date.day),
            "MM": str(date.month).zfill(2),
            "M": str(date.month),
            "yyyy": str(date.year),
            "yy": str(date.year)[-2:],
        }
        result = format
        for key, value in replacements.items():
            result = result.replace(key.upper(), value)
        return result
    
    return str(date)


def get_date_str(date):
    """
    Get date string representation.
    Replaces frappe.utils.get_date_str()
    """
    if isinstance(date, datetime):
        return date.strftime("%Y-%m-%d")
    if isinstance(date, datetime.date):
        return date.strftime("%Y-%m-%d")
    return str(date)


# =============================================================================
# Cache Operations (Replacements for frappe.cache)
# =============================================================================

class FastAPICache:
    """Replaces frappe.cache for caching operations."""
    
    def __init__(self):
        self._cache = {}
    
    def get_value(self, key: str, default: Any = None):
        """Get value from cache."""
        return self._cache.get(key, default)
    
    def set_value(self, key: str, value: Any, expires_in_sec: int = 0):
        """Set value in cache."""
        self._cache[key] = value


cache = FastAPICache()


# =============================================================================
# Database Operations (Replacements for frappe.db)
# =============================================================================

class FastAPIDatabase:
    """Replaces frappe.db for database operations."""
    
    def __init__(self):
        # Placeholder - actual implementation depends on database choice
        self._db_config = None
    
    def set_value(self, doctype: str, name: str, field: str, value: Any):
        """
        Set a value in the database.
        Replaces frappe.db.set_value()
        """
        logger.warning(f"Database set_value called for {doctype}.{name}.{field} = {value} (not implemented)")
    
    def set_value(self, doctype: str, filters: Any, values: Dict[str, Any]):
        """
        Set values matching filters.
        Replaces frappe.db.set_value() with dict filters
        """
        logger.warning(f"Database set_value called for {doctype} with filters {filters} (not implemented)")
    
    def commit(self):
        """
        Commit transaction.
        Replaces frappe.db.commit()
        """
        logger.debug("Database commit called")


db = FastAPIDatabase()


# =============================================================================
# Document Cache Operations (Replacements for frappe.clear_document_cache)
# =============================================================================

def clear_document_cache(doctype: str):
    """
    Clear document cache.
    Replaces frappe.clear_document_cache()
    """
    cache_key = f"doc_cache_{doctype}"
    cache.set_value(cache_key, None)


# =============================================================================
# Scheduler Status (Replacements for frappe.utils.scheduler)
# =============================================================================

def is_scheduler_disabled() -> bool:
    """
    Check if scheduler is disabled.
    Replaces frappe.utils.scheduler.is_scheduler_disabled()
    """
    return True  # Scheduler is disabled in FastAPI context


# =============================================================================
# Translation Function (Replacements for frappe._)
# =============================================================================

def _(text: str) -> str:
    """
    Translation function placeholder.
    Replaces frappe.translate() for i18n.
    In FastAPI, this just returns the text as-is.
    """
    return text


# =============================================================================
# Message Print (Replacements for frappe.msgprint)
# =============================================================================

def msgprint(message: str, title: str = "Message", alert: bool = False, **kwargs):
    """
    Print/display a message.
    Replaces frappe.msgprint()
    """
    logger.info(f"Message: {title} - {message}")
    # In FastAPI, this would typically be handled via responses
    # For now, just log it


# =============================================================================
# Settings and Configuration Access (Replacements for frappe.conf)
# =============================================================================

class FastAPIConfig:
    """Replaces frappe.conf for configuration access."""
    
    def __init__(self):
        import os
        self._config = {
            'ic_api_secret': os.environ.get('IC_API_SECRET', ''),
            'developer_mode': os.environ.get('DEVELOPER_MODE', '0') == '1',
        }
    
    def __getattr__(self, name: str) -> Any:
        return self._config.get(name)
    
    def get(self, name: str, default: Any = None) -> Any:
        return self._config.get(name, default)


conf = FastAPIConfig()


# =============================================================================
# Get Cached Doc (Replacements for frappe.get_cached_doc)
# =============================================================================

class FastAPIDocumentCache:
    """Replaces frappe.get_cached_doc for document retrieval."""
    
    def __init__(self):
        self._documents = {}
    
    def get_cached_doc(self, doctype: str, name: str = None):
        """
        Get cached document.
        Replaces frappe.get_cached_doc()
        
        Note: In FastAPI context, this should be replaced with actual
        database queries or static configuration loading.
        """
        cache_key = f"{doctype}:{name or 'default'}"
        
        if cache_key not in self._documents:
            # For GST Settings, we can load from environment or config
            if doctype == "GST Settings":
                self._documents[cache_key] = self._load_gst_settings()
            else:
                logger.warning(f"Document {doctype}/{name} not found in cache")
                return None
        
        return self._documents.get(cache_key)
    
    def _load_gst_settings(self):
        """Load GST Settings from environment/config."""
        import os
        return FastAPIDocument({
            'doctype': 'GST Settings',
            'sandbox_mode': os.environ.get('GST_SANDBOX_MODE', '0') == '1',
            'api_secret': os.environ.get('GST_API_SECRET', ''),
            'gstn_public_certificate': '',
            'nic_public_key': '',
            'credentials': [],
        })


class FastAPIDocument:
    """Basic document-like object for FastAPI."""
    
    def __init__(self, data: Dict[str, Any]):
        self._data = data
        for key, value in data.items():
            setattr(self, key, value)
    
    def __getattr__(self, name: str) -> Any:
        return self._data.get(name)
    
    def get(self, name: str, default: Any = None) -> Any:
        return self._data.get(name, default)
    
    def get_password(self, field: str, raise_exception: bool = False) -> str:
        """Get password field."""
        value = self._data.get(field, '')
        if not value and raise_exception:
            raise ValidationError(f"Password field {field} is empty")
        return value
    
    def db_set(self, field: str, value: Any):
        """Set field value in database."""
        self._data[field] = value
        setattr(self, field, value)


# Global document cache instance
document_cache = FastAPIDocumentCache()


# =============================================================================
# Password Utilities
# =============================================================================

class FastAPIPasswordManager:
    """Replaces frappe.utils.password for password operations."""
    
    @staticmethod
    def get_decrypted_password(doctype: str, name: str, field: str = 'password') -> str:
        """
        Get decrypted password.
        Replaces frappe.utils.password.get_decrypted_password()
        """
        # In production, this would decrypt the actual password
        logger.warning(f"Password retrieval for {doctype}/{name}/{field} requested")
        return ""
    
    @staticmethod
    def set_encrypted_password(doctype: str, name: str, field: str, password: str):
        """
        Set encrypted password.
        Replaces frappe.utils.password.set_encrypted_password()
        """
        # In production, this would encrypt and store the password
        logger.warning(f"Password set for {doctype}/{name}/{field}")


# =============================================================================
# Export all replacement functions
# =============================================================================

__all__ = [
    # Flags and local context
    'flags',
    'local',
    
    # Dict operations
    '_dict',
    'dict_to_object',
    
    # Exceptions
    'ValidationError',
    'PermissionError', 
    'DoesNotExistError',
    'throw',
    
    # Hash and JSON
    'generate_hash',
    'as_json',
    'parse_json',
    
    # Type conversion
    'sbool',
    'cint',
    'cstr',
    
    # Date and time
    'getdate',
    'now_datetime',
    'add_to_date',
    'format_date',
    'get_date_str',
    
    # Cache
    'cache',
    
    # Database
    'db',
    'commit',
    'clear_document_cache',
    
    # Scheduler
    'is_scheduler_disabled',
    
    # Translation
    '_',
    
    # Messages
    'msgprint',
    
    # Configuration
    'conf',
    
    # Document cache
    'document_cache',
    'get_cached_doc',
    
    # Password
    'FastAPIPasswordManager',
]
