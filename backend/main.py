"""
Virtual CA Backend API

This module serves as the entry point for the Virtual CA backend, providing
a FastAPI application that integrates various tax compliance modules.
"""
import os
import uuid
import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

from fastapi import FastAPI, Request, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

# Setup logging (must be before lifespan)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    from database import create_tables, engine
    from sqlalchemy import text
    create_tables()
    logger.info("Database tables initialized — fresh SQLite-compatible schema ready")
    
    # Add version column to gstr1_drafts table if it does not exist
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE gstr1_drafts ADD COLUMN version INTEGER DEFAULT 1"))
            conn.commit()
            logger.info("Added version column to gstr1_drafts table via ALTER TABLE")
    except Exception as e:
        logger.info(f"Version column already exists or ALTER TABLE skipped: {e}")
        
    yield

# Import routers
from routers import (
    workspace_router, 
    business_router, 
    gstr1_router, 
    gstr3b_router, 
    auth_router,
    dashboard_router,
    invoice_router,
    gstin_router
)


# Initialize FastAPI app


app = FastAPI(
    title="Virtual CA API",
    description="Backend API for GST compliance and CA firm management",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from typing import Any

def sanitize_validation_error(obj: Any) -> Any:
    """Recursively sanitize validation errors to ensure JSON serializability."""
    if isinstance(obj, dict):
        return {k: sanitize_validation_error(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_validation_error(v) for v in obj]
    elif isinstance(obj, tuple):
        return [sanitize_validation_error(v) for v in obj]
    elif isinstance(obj, Exception):
        return str(obj)
    elif hasattr(obj, "__dict__"):
        return str(obj)
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        return str(obj)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    sanitized_errors = sanitize_validation_error(exc.errors())
    logger.error(f"Validation error for request {request.url}: {sanitized_errors}")
    try:
        body = await request.body()
        logger.error(f"Body: {body}")
    except:
        pass
    return JSONResponse(
        status_code=422,
        content={"detail": sanitized_errors, "body": str(exc.body)},
    )

# In production, this should be restricted to the frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting simple implementation
rate_limit_storage = defaultdict(list)
RATE_LIMIT_CALLS = 100
RATE_LIMIT_WINDOW = 60 # seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    now = time.time()
    
    # Filter out old requests
    rate_limit_storage[client_ip] = [t for t in rate_limit_storage[client_ip] if now - t < RATE_LIMIT_WINDOW]
    
    if len(rate_limit_storage[client_ip]) >= RATE_LIMIT_CALLS:
        retry_after = int(RATE_LIMIT_WINDOW - (now - rate_limit_storage[client_ip][0]))
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. Please try again later.",
                "retry_after": retry_after
            },
            headers={"Retry-After": str(retry_after)}
        )
    
    rate_limit_storage[client_ip].append(now)
    return await call_next(request)

# ============ Route Registration ============
# Note: Routers now use absolute paths in their decorators (e.g., /api/workspaces)
# to avoid prefix mismatches and trailing slash redirect issues.
app.include_router(auth_router.router)
app.include_router(workspace_router.router)
app.include_router(business_router.router)
app.include_router(dashboard_router.router)
app.include_router(gstr1_router.router)
app.include_router(gstr3b_router.router)
app.include_router(invoice_router.router)
app.include_router(gstin_router.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
