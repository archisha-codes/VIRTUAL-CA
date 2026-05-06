from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Date, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as SQL_UUID
from database import Base
import uuid

class GSTR1_Document(Base):
    __tablename__ = "gstr1_documents"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(SQL_UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)  # Format: MMYYYY
    
    invoice_number = Column(String(50), nullable=False)
    invoice_date = Column(Date, nullable=False)
    document_type = Column(String(20), nullable=False)  # B2B, B2CS, EXP, CDNR, etc.
    pos = Column(String(50), nullable=False)  # Place of Supply
    
    # Financial fields with DECIMAL(18,2) for precision
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0.00)
    igst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    sgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cess = Column(Numeric(18, 2), nullable=False, default=0.00)

    # Relationship
    business = relationship("Business", back_populates="gstr1_documents")

    __table_args__ = (
        Index("idx_gstr1_business_period", "business_id", "return_period"),
    )

class GSTR2B_Document(Base):
    __tablename__ = "gstr2b_documents"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(SQL_UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)
    
    invoice_number = Column(String(50), nullable=False)
    invoice_date = Column(Date, nullable=False)
    document_type = Column(String(20), nullable=False)
    pos = Column(String(50), nullable=False)
    
    # Financial fields
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0.00)
    igst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    sgst = Column(Numeric(18, 2), nullable=False, default=0.00)
    cess = Column(Numeric(18, 2), nullable=False, default=0.00)
    
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

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(SQL_UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    return_period = Column(String(6), index=True, nullable=False)
    
    # Draft payload stored as JSONB
    payload = Column(JSON, nullable=False)
    is_filed = Column(Boolean, default=False)

    # Relationship
    business = relationship("Business", back_populates="gstr3b_drafts")

    __table_args__ = (
        Index("idx_gstr3b_business_period", "business_id", "return_period"),
    )
