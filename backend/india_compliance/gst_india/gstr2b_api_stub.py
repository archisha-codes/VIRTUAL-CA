# GST India - GSTR-2B API Abstraction
# Provides abstraction layer for GSTR-2B data fetching (placeholder for GSP integration)

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum


class ReturnStatus(str, Enum):
    """Status of GSTR-2B return"""
    PENDING = "pending"
    PROCESSED = "processed"
    AVAILABLE = "available"
    NOT_FOUND = "not_found"


@dataclass
class GSTR2BRecord:
    """
    Represents a single invoice from GSTR-2B
    """
    gstin: str
    invoice_number: str
    invoice_date: str
    invoice_value: float
    taxable_value: float
    tax_amount: float
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    invoice_type: str = "B2B"
    pos: str = ""  # Place of Supply
    reverse_charge: str = "N"
    matching_status: str = "exact_match"
    match_confidence: float = 1.0
    supplier_name: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "gstin": self.gstin,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date,
            "invoice_value": self.invoice_value,
            "taxable_value": self.taxable_value,
            "tax_amount": self.tax_amount,
            "igst": self.igst,
            "cgst": self.cgst,
            "sgst": self.sgst,
            "cess": self.cess,
            "invoice_type": self.invoice_type,
            "pos": self.pos,
            "reverse_charge": self.reverse_charge,
            "matching_status": self.matching_status,
            "match_confidence": self.match_confidence,
            "supplier_name": self.supplier_name
        }


@dataclass
class GSTR2BResponse:
    """
    Represents the full GSTR-2B return data
    """
    return_period: str
    taxpayer_gstin: str
    status: ReturnStatus
    filing_date: Optional[str] = None
    record_count: int = 0
    total_taxable: float = 0.0
    total_tax: float = 0.0
    invoices: List[GSTR2BRecord] = field(default_factory=list)
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "return_period": self.return_period,
            "taxpayer_gstin": self.taxpayer_gstin,
            "status": self.status.value,
            "filing_date": self.filing_date,
            "record_count": self.record_count,
            "total_taxable": self.total_taxable,
            "total_tax": self.total_tax,
            "invoices": [inv.to_dict() for inv in self.invoices],
            "error_message": self.error_message
        }


class GSTR2BProvider(ABC):
    """
    Abstract base class for GSTR-2B data providers.
    
    Implement this interface to integrate with different GSPs
    (Goods and Services Tax Suvidha Providers).
    """
    
    @abstractmethod
    def fetch(self, return_period: str, gstin: str) -> GSTR2BResponse:
        """
        Fetch GSTR-2B data for a given return period and GSTIN.
        
        Args:
            return_period: Tax return period (e.g., "122025")
            gstin: Taxpayer GSTIN
            
        Returns:
            GSTR2BResponse containing the return data
        """
        pass
    
    @abstractmethod
    def get_status(self, return_period: str, gstin: str) -> ReturnStatus:
        """
        Check the status of GSTR-2B for a given period.
        
        Args:
            return_period: Tax return period
            gstin: Taxpayer GSTIN
            
        Returns:
            ReturnStatus enum value
        """
        pass


class GSTR2BStubProvider(GSTR2BProvider):
    """
    Stub implementation for testing and development.
    
    This provider returns sample/mock data and does not
    connect to any real GST portal.
    """
    
    def __init__(self):
        self.stub_data = self._load_stub_data()
    
    def _load_stub_data(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load stub sample data"""
        return {
            "122025": [
                {
                    "gstin": "29AABCI1234A1Z5",
                    "invoice_number": "INV/2025/001",
                    "invoice_date": "2025-12-05",
                    "invoice_value": 118000,
                    "taxable_value": 100000,
                    "tax_amount": 18000,
                    "igst": 18000,
                    "cgst": 0,
                    "sgst": 0,
                    "cess": 0,
                    "invoice_type": "B2B",
                    "pos": "29",
                    "reverse_charge": "N",
                    "matching_status": "exact_match",
                    "match_confidence": 1.0,
                    "supplier_name": "Test Supplier Pvt Ltd"
                },
                {
                    "gstin": "27AAACC1234A1Z7",
                    "invoice_number": "INV/2025/002",
                    "invoice_date": "2025-12-10",
                    "invoice_value": 59000,
                    "taxable_value": 50000,
                    "tax_amount": 9000,
                    "igst": 0,
                    "cgst": 4500,
                    "sgst": 4500,
                    "cess": 0,
                    "invoice_type": "B2B",
                    "pos": "27",
                    "reverse_charge": "N",
                    "matching_status": "exact_match",
                    "match_confidence": 1.0,
                    "supplier_name": "Maharashtra Suppliers Co"
                },
                {
                    "gstin": "33AAADD1234A1Z9",
                    "invoice_number": "INV/2025/003",
                    "invoice_date": "2025-12-15",
                    "invoice_value": 236000,
                    "taxable_value": 200000,
                    "tax_amount": 36000,
                    "igst": 36000,
                    "cgst": 0,
                    "sgst": 0,
                    "cess": 0,
                    "invoice_type": "B2B",
                    "pos": "33",
                    "reverse_charge": "N",
                    "matching_status": "probable_match",
                    "match_confidence": 0.7,
                    "supplier_name": "Tamil Nadu Traders"
                },
                {
                    "gstin": "29AABCE5678A1Z3",
                    "invoice_number": "RCM/2025/001",
                    "invoice_date": "2025-12-20",
                    "invoice_value": 59000,
                    "taxable_value": 50000,
                    "tax_amount": 9000,
                    "igst": 0,
                    "cgst": 4500,
                    "sgst": 4500,
                    "cess": 0,
                    "invoice_type": "B2BUR",  # Reverse Charge
                    "pos": "29",
                    "reverse_charge": "Y",
                    "matching_status": "exact_match",
                    "match_confidence": 1.0,
                    "supplier_name": "RCM Supplier Ltd"
                }
            ],
            "112025": [
                {
                    "gstin": "29AABCI1234A1Z5",
                    "invoice_number": "INV/2025/101",
                    "invoice_date": "2025-11-05",
                    "invoice_value": 118000,
                    "taxable_value": 100000,
                    "tax_amount": 18000,
                    "igst": 18000,
                    "cgst": 0,
                    "sgst": 0,
                    "cess": 0,
                    "invoice_type": "B2B",
                    "pos": "29",
                    "reverse_charge": "N",
                    "matching_status": "exact_match",
                    "match_confidence": 1.0,
                    "supplier_name": "Test Supplier Pvt Ltd"
                }
            ]
        }
    
    def fetch(self, return_period: str, gstin: str) -> GSTR2BResponse:
        """Fetch stub GSTR-2B data"""
        
        # Check if data exists for this period
        if return_period not in self.stub_data:
            return GSTR2BResponse(
                return_period=return_period,
                taxpayer_gstin=gstin,
                status=ReturnStatus.NOT_FOUND,
                error_message=f"No GSTR-2B data found for period {return_period}"
            )
        
        invoices_data = self.stub_data[return_period]
        
        # Convert to GSTR2BRecord objects
        invoices = []
        total_taxable = 0.0
        total_tax = 0.0
        
        for inv in invoices_data:
            record = GSTR2BRecord(
                gstin=inv["gstin"],
                invoice_number=inv["invoice_number"],
                invoice_date=inv["invoice_date"],
                invoice_value=inv["invoice_value"],
                taxable_value=inv["taxable_value"],
                tax_amount=inv["tax_amount"],
                igst=inv.get("igst", 0),
                cgst=inv.get("cgst", 0),
                sgst=inv.get("sgst", 0),
                cess=inv.get("cess", 0),
                invoice_type=inv.get("invoice_type", "B2B"),
                pos=inv.get("pos", ""),
                reverse_charge=inv.get("reverse_charge", "N"),
                matching_status=inv.get("matching_status", "exact_match"),
                match_confidence=inv.get("match_confidence", 1.0),
                supplier_name=inv.get("supplier_name", "")
            )
            invoices.append(record)
            total_taxable += record.taxable_value
            total_tax += record.tax_amount
        
        return GSTR2BResponse(
            return_period=return_period,
            taxpayer_gstin=gstin,
            status=ReturnStatus.AVAILABLE,
            filing_date=datetime.now().strftime("%Y-%m-%d"),
            record_count=len(invoices),
            total_taxable=total_taxable,
            total_tax=total_tax,
            invoices=invoices
        )
    
    def get_status(self, return_period: str, gstin: str) -> ReturnStatus:
        """Check stub GSTR-2B status"""
        if return_period in self.stub_data:
            return ReturnStatus.AVAILABLE
        return ReturnStatus.NOT_FOUND
    
    def add_stub_data(self, return_period: str, invoices: List[Dict[str, Any]]):
        """Add custom stub data for testing"""
        self.stub_data[return_period] = invoices


class GSTR2BManager:
    """
    Manager class for handling GSTR-2B operations.
    
    Uses a provider to fetch data and can transform it
    for use in IMS and ITC calculations.
    """
    
    def __init__(self, provider: Optional[GSTR2BProvider] = None):
        self.provider = provider or GSTR2BStubProvider()
    
    def fetch_gstr2b(
        self, 
        return_period: str, 
        gstin: str
    ) -> GSTR2BResponse:
        """
        Fetch GSTR-2B data for a return period.
        
        Args:
            return_period: Tax return period (e.g., "122025")
            gstin: Taxpayer GSTIN
            
        Returns:
            GSTR2BResponse with all data
        """
        return self.provider.fetch(return_period, gstin)
    
    def get_invoices_as_dict(
        self, 
        return_period: str, 
        gstin: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch GSTR-2B and return as list of dictionaries.
        
        This format is compatible with IMS engine.
        
        Args:
            return_period: Tax return period
            gstin: Taxpayer GSTIN
            
        Returns:
            List of invoice dictionaries
        """
        response = self.provider.fetch(return_period, gstin)
        
        if response.status != ReturnStatus.AVAILABLE:
            return []
        
        return [inv.to_dict() for inv in response.invoices]
    
    def get_status(
        self, 
        return_period: str, 
        gstin: str
    ) -> ReturnStatus:
        """Check if GSTR-2B is available"""
        return self.provider.get_status(return_period, gstin)
    
    def get_itc_summary(
        self, 
        return_period: str, 
        gstin: str
    ) -> Dict[str, float]:
        """
        Get ITC summary from GSTR-2B.
        
        Returns:
            Dictionary with ITC breakdown by tax type
        """
        response = self.provider.fetch(return_period, gstin)
        
        if response.status != ReturnStatus.AVAILABLE:
            return {
                "igst": 0.0,
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": 0.0,
                "total": 0.0
            }
        
        igst_total = sum(inv.igst for inv in response.invoices)
        cgst_total = sum(inv.cgst for inv in response.invoices)
        sgst_total = sum(inv.sgst for inv in response.invoices)
        cess_total = sum(inv.cess for inv in response.invoices)
        
        return {
            "igst": igst_total,
            "cgst": cgst_total,
            "sgst": sgst_total,
            "cess": cess_total,
            "total": igst_total + cgst_total + sgst_total + cess_total
        }


def create_gstr2b_provider(provider_type: str = "stub") -> GSTR2BProvider:
    """
    Factory function to create GSTR-2B provider.
    
    Args:
        provider_type: Type of provider ("stub", "gsp", etc.)
        
    Returns:
        GSTR2BProvider instance
    """
    if provider_type == "stub":
        return GSTR2BStubProvider()
    else:
        raise ValueError(f"Unknown provider type: {provider_type}")
