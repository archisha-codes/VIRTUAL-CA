"""
Structured Logging Module for GST Compliance Backend

This module provides structured JSON logging with request ID tracking,
log levels, and consistent formatting.

Features:
- JSON and text log formatting
- Request ID tracking for distributed tracing
- Context-aware logging
- Rotating file handlers
- Module-level loggers
"""

import logging
import sys
import os
import json
import uuid
import time
from datetime import datetime
from typing import Any, Dict, Optional, Union
from functools import lru_cache
from pathlib import Path
from logging.handlers import RotatingFileHandler
from contextvars import ContextVar

# Context variable for request ID
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    
    Outputs logs as JSON lines for easy parsing by log aggregation tools.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format the log record as JSON.
        
        Args:
            record: The log record to format
            
        Returns:
            JSON string representation of the log record
        """
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add request ID if available
        request_id = request_id_var.get()
        if request_id:
            log_data["request_id"] = request_id
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra attributes
        if hasattr(record, 'extra_data'):
            log_data["extra"] = record.extra_data
        
        # Add request info if available
        if hasattr(record, 'request_info'):
            log_data["request"] = record.request_info
        
        return json.dumps(log_data)


class TextFormatter(logging.Formatter):
    """
    Human-readable text formatter with consistent formatting.
    """
    
    def __init__(self, fmt: str = None, datefmt: str = None):
        super().__init__(fmt, datefmt)
        self.formatter = logging.Formatter(
            fmt or '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as human-readable text."""
        return self.formatter.format(record)


class LoggerManager:
    """
    Manager for application loggers.
    
    Provides centralized logger configuration with support for
    JSON/text formatting and multiple handlers.
    """
    
    def __init__(self):
        self.loggers: Dict[str, logging.Logger] = {}
        self._configured = False
    
    def configure(
        self,
        log_level: str = "INFO",
        log_format: str = "json",
        log_dir: str = "/app/logs",
        max_bytes: int = 10 * 1024 * 1024,  # 10 MB
        backup_count: int = 5
    ) -> None:
        """
        Configure the logging system.
        
        Args:
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            log_format: Log format (json or text)
            log_dir: Directory for log files
            max_bytes: Maximum size of each log file
            backup_count: Number of backup log files to keep
        """
        if self._configured:
            return
        
        # Create log directory if it doesn't exist
        Path(log_dir).mkdir(parents=True, exist_ok=True)
        
        # Get the root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        # Clear existing handlers
        root_logger.handlers.clear()
        
        # Create formatter
        if log_format == "json":
            formatter = JSONFormatter()
        else:
            formatter = TextFormatter()
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # Create file handler for all logs
        log_file = os.path.join(log_dir, 'app.log')
        file_handler = RotatingFileHandler(
            log_file, maxBytes=max_bytes, backupCount=backup_count
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        
        # Create separate error log file
        error_log_file = os.path.join(log_dir, 'error.log')
        error_handler = RotatingFileHandler(
            error_log_file, maxBytes=max_bytes, backupCount=backup_count
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        root_logger.addHandler(error_handler)
        
        self._configured = True
    
    def get_logger(self, name: str) -> logging.Logger:
        """
        Get a logger with the specified name.
        
        Args:
            name: Name of the logger (usually __name__)
            
        Returns:
            Configured logger instance
        """
        if name not in self.loggers:
            logger = logging.getLogger(name)
            self.loggers[name] = logger
        
        return self.loggers[name]


@lru_cache()
def get_logger_manager() -> LoggerManager:
    """
    Get cached logger manager instance.
    """
    return LoggerManager()


def setup_logging(
    log_level: str = "INFO",
    log_format: str = "json",
    log_dir: str = "/app/logs"
) -> logging.Logger:
    """
    Setup application logging.
    
    Args:
        log_level: Logging level
        log_format: Log format (json or text)
        log_dir: Log directory
        
    Returns:
        Root logger instance
    """
    logger_manager = get_logger_manager()
    logger_manager.configure(log_level, log_format, log_dir)
    
    return logging.getLogger()


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for the specified module.
    
    Args:
        name: Module name (usually __name__)
        
    Returns:
        Logger instance
    """
    logger_manager = get_logger_manager()
    return logger_manager.get_logger(name)


class RequestLogger:
    """
    Context manager for request-scoped logging.
    
    Automatically adds request_id to all log entries within the context.
    """
    
    def __init__(self, request_id: Optional[str] = None):
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self._token = None
    
    def __enter__(self) -> str:
        """Enter the context and set the request ID."""
        self._token = request_id_var.set(self.request_id)
        return self.request_id
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit the context and clear the request ID."""
        if self._token:
            request_id_var.reset(self._token)
        return False
    
    @property
    def request_id(self) -> str:
        """Get the current request ID."""
        return self._request_id
    
    @request_id.setter
    def request_id(self, value: str):
        """Set the request ID."""
        self._request_id = value


def log_request(
    logger: logging.Logger,
    level: int = logging.INFO,
    message: str = "",
    **kwargs
) -> None:
    """
    Log a message with request context.
    
    Args:
        logger: Logger instance
        level: Log level
        message: Log message
        **kwargs: Additional context to include in the log
    """
    extra = kwargs.pop('extra_data', {})
    
    # Create log record with extra data
    log_record = logging.LogRecord(
        name=logger.name,
        level=level,
        pathname=__file__,
        lineno=0,
        msg=message,
        args=(),
        exc_info=None
    )
    
    # Add request ID and extra data
    request_id = request_id_var.get()
    if request_id:
        log_record.__dict__['request_id'] = request_id
    
    if extra:
        log_record.__dict__['extra_data'] = extra
    
    logger.handle(log_record)


# Convenience functions for structured logging
def log_debug(logger: logging.Logger, message: str, **kwargs) -> None:
    """Log a debug message with structured data."""
    log_request(logger, logging.DEBUG, message, **kwargs)


def log_info(logger: logging.Logger, message: str, **kwargs) -> None:
    """Log an info message with structured data."""
    log_request(logger, logging.INFO, message, **kwargs)


def log_warning(logger: logging.Logger, message: str, **kwargs) -> None:
    """Log a warning message with structured data."""
    log_request(logger, logging.WARNING, message, **kwargs)


def log_error(logger: logging.Logger, message: str, **kwargs) -> None:
    """Log an error message with structured data."""
    log_request(logger, logging.ERROR, message, **kwargs)


def log_exception(logger: logging.Logger, message: str, exc: Exception, **kwargs) -> None:
    """Log an error message with exception details."""
    log_record = logging.LogRecord(
        name=logger.name,
        level=logging.ERROR,
        pathname=__file__,
        lineno=0,
        msg=message,
        args=(),
        exc_info=exc
    )
    
    request_id = request_id_var.get()
    if request_id:
        log_record.__dict__['request_id'] = request_id
    
    extra = kwargs.pop('extra_data', {})
    if extra:
        log_record.__dict__['extra_data'] = extra
    
    logger.handle(log_record)
