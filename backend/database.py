import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# DATABASE_URL should be in the format: postgresql://user:password@host:port/dbname
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine
# connect_args={"check_same_thread": False} is only needed for SQLite.
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    # Ensure we use psycopg2 driver if not specified
    if "://" in SQLALCHEMY_DATABASE_URL and not SQLALCHEMY_DATABASE_URL.startswith("postgresql+"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10
    )
    IS_SQLITE = False
else:
    # Fallback for local development
    if not SQLALCHEMY_DATABASE_URL:
        SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    IS_SQLITE = True

    # Enable WAL mode and foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables (safe to call multiple times — uses CREATE IF NOT EXISTS)."""
    Base.metadata.create_all(bind=engine)


# Import models here to ensure they are registered with Base.metadata
# Must be at the bottom to avoid circular imports
from models.tenant_models import User, Workspace, WorkspaceMember, Business  # noqa: E402
