"""
Environment-based configuration for GST Compliance Backend

This module provides centralized configuration management using pydantic.BaseSettings.
Environment variables can override default values.

Example usage:
    from india_compliance.gst_india.config import settings
    print(settings.JWT_SECRET_KEY)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """
    Application settings with environment variable support.
    
    Environment variables can override default values.
    """
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore'
    )
    
    # Application Settings
    APP_NAME: str = "GSTR Compliance Backend"
    APP_VERSION: str = "1.1.0"
    ENV: str = "development"
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # API Key
    GST_API_KEY: str = "gst-secret-key-change-in-production"
    API_KEY_NAME: str = "X-API-Key"
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text
    LOG_DIR: str = "/app/logs"
    
    # File Upload Settings
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_DIR: str = "/tmp/uploads"
    TEMP_DIR: str = "/tmp"
    
    # Database (for future use)
    DATABASE_URL: Optional[str] = None
    DATABASE_TYPE: str = "sqlite"  # sqlite, postgresql, mysql
    
    # CORS Settings
    CORS_ORIGINS: str = "*"
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Session Settings
    SESSION_SECRET_KEY: str = "session-secret-change-in-production"
    
    # Redis (for future use - caching, rate limiting)
    REDIS_URL: Optional[str] = None
    
    # Frontend URL (for CORS)
    FRONTEND_URL: str = "http://localhost:3000"
    
    # GST-Specific Settings
    DEFAULT_GSTIN: str = "27AAAAA1234A1ZA"
    GST_PORTAL_TOKEN: Optional[str] = None
    GST_API_SECRET: Optional[str] = None
    GST_PORTAL_SYNC_ENABLED: bool = False
    
    @property
    def MAX_FILE_SIZE_BYTES(self) -> int:
        """Convert MB to bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENV == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENV == "development"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    This function is cached to avoid re-reading environment variables
    on every call.
    """
    return Settings()


# Global settings instance
settings = get_settings()
