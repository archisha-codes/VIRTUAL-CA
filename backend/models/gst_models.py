from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Date, Boolean, JSON, Index, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import uuid

def new_uuid() -> str:
    """Generate a new UUID as a string (SQLite/PostgreSQL compatible)."""
    return str(uuid.uuid4())

class GSTR1_Document(Base):
    __tablename__ = "gstr1_documents"

    id = Column(String(36), primary_key=True, default=new_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)  # Format: MMYYYY
    
    invoice_number = Column(String(50), nullable=False)
    invoice_date = Column(Date, nullable=False)
    document_type = Column(String(20), nullable=False)  # B2B, B2CS, EXP, CDNR, etc.
    pos = Column(String(50), nullable=False)  # Place of Supply
    
    # Customer info
    customer_name = Column(String(255), nullable=True)
    customer_gstin = Column(String(15), nullable=True)
    
    # Financial fields with DECIMAL(18,2) for precision
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0.00)
    igst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    sgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cess = Column(Numeric(18, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(18, 2), nullable=False, default=0.00)

    # Validation info
    validation_status = Column(String(20), default="pending")
    validation_errors = Column(JSON, nullable=True)

    # Relationship
    business = relationship("Business", back_populates="gstr1_documents")

    __table_args__ = (
        Index("idx_gstr1_business_period", "business_id", "return_period"),
    )

class GSTR2B_Document(Base):
    __tablename__ = "gstr2b_documents"

    id = Column(String(36), primary_key=True, default=new_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)
    
    invoice_number = Column(String(50), nullable=False)
    invoice_date = Column(Date, nullable=False)
    document_type = Column(String(20), nullable=False)
    pos = Column(String(50), nullable=False)
    
    # Supplier info
    supplier_name = Column(String(255), nullable=True)
    supplier_gstin = Column(String(15), nullable=True)
    
    # Financial fields
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0.00)
    igst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    sgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cess = Column(Numeric(18, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(18, 2), nullable=False, default=0.00)
    
    # ITC specific fields
    itc_available = Column(Boolean, default=True)
    itc_reason = Column(String(255), nullable=True)

    # Relationship
    business = relationship("Business", back_populates="gstr2b_documents")

    __table_args__ = (
        Index("idx_gstr2b_business_period", "business_id", "return_period"),
    )

class GSTR3B_Draft(Base):
    __tablename__ = "gstr3b_drafts"

    id = Column(String(36), primary_key=True, default=new_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)
    
    # Draft payload stored as JSONB
    payload = Column(JSON, nullable=False)
    is_filed = Column(Boolean, default=False)

    # Relationship
    business = relationship("Business", back_populates="gstr3b_drafts")

    __table_args__ = (
        Index("idx_gstr3b_business_period", "business_id", "return_period"),
    )

class GSTR1_Draft(Base):
    __tablename__ = "gstr1_drafts"

    id = Column(String(36), primary_key=True, default=new_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)
    
    # Draft payload stored as JSONB
    payload = Column(JSON, nullable=False)
    is_filed = Column(Boolean, default=False)
    current_step = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    business = relationship("Business", back_populates="gstr1_drafts")

    __table_args__ = (
        Index("idx_gstr1_draft_business_period", "business_id", "return_period"),
    )

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    category = Column(String(50), default="general")
    link = Column(String(500), nullable=True)
    date = Column(Date, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
