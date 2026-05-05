from sqlalchemy.orm import Session
from decimal import Decimal
from typing import List, Dict, Any
from models.gst_models import GSTR1_Document
from datetime import datetime

def save_gstr1_documents(db: Session, company_id: int, return_period: str, clean_data: List[Dict[str, Any]]) -> int:
    """
    Persists GSTR-1 normalized data to the database.
    Clears existing records for the same company and period to prevent duplicates.
    """
    # 1. Clear existing records for the company and return period
    db.query(GSTR1_Document).filter(
        GSTR1_Document.company_id == company_id,
        GSTR1_Document.return_period == return_period
    ).delete()

    # 2. Prepare new records
    documents = []
    for item in clean_data:
        # Map frontend/pipeline keys to ORM model fields
        # Note: We handle multiple sections (B2B, B2CS, etc.)
        
        # Ensure invoice_date is a date object
        inv_date = item.get("invoice_date")
        if isinstance(inv_date, str):
            try:
                inv_date = datetime.strptime(inv_date, "%Y-%m-%d").date()
            except ValueError:
                inv_date = datetime.now().date()
        elif not inv_date:
            inv_date = datetime.now().date()

        doc = GSTR1_Document(
            company_id=company_id,
            return_period=return_period,
            invoice_number=str(item.get("invoice_number", item.get("invoice_no", ""))),
            invoice_date=inv_date,
            document_type=item.get("section", "B2B"),
            pos=str(item.get("pos", item.get("place_of_supply", ""))),
            
            # Financial fields with Decimal conversion and defaults
            taxable_value=Decimal(str(item.get("taxable_value", "0.00"))),
            igst=Decimal(str(item.get("igst", "0.00"))),
            cgst=Decimal(str(item.get("cgst", "0.00"))),
            sgst=Decimal(str(item.get("sgst", "0.00"))),
            cess=Decimal(str(item.get("cess", "0.00")))
        )
        documents.append(doc)

    # 3. Bulk insert
    if documents:
        db.add_all(documents)
        db.commit()
    
    return len(documents)
