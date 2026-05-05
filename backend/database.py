import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# DATABASE_URL should be in the format: postgresql://user:password@host:port/dbname
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback for local development if DATABASE_URL is not set
if not SQLALCHEMY_DATABASE_URL:
    # Use SQLite as a temporary fallback if no Postgres URL is provided
    # but the docker-compose setup will provide the correct URL.
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

# Create engine
# connect_args={"check_same_thread": False} is only needed for SQLite.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Import models here to ensure they are registered with Base.metadata
# We do this at the bottom to avoid circular imports
from models.tenant_models import User, Workspace, WorkspaceMember, Business
