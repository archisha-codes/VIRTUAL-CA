# GST India - GSTR-3B IMS (Invoice Management System) Engine
# This module handles invoice matching and ITC eligibility based on IMS rules

from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Optional, Any
from enum import Enum


class MatchStatus(str, Enum):
    """Invoice matching status from GSTR-2B"""
    EXACT = "exact_match"
    PROBABLE = "probable_match"
    NO_MATCH = "no_match"


class IMSAction(str, Enum):
    """Action taken on matched invoice"""
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PENDING = "pending"


@dataclass
class IMSEntry:
    """
    Represents an IMS entry for invoice matching and ITC eligibility.
    
    Attributes:
        gstin: Supplier GSTIN
        invoice_number: Supplier invoice number
        invoice_date: Date of invoice
        taxable_value: Taxable value of the invoice
        tax_amount: Total tax amount (IGST + CGST + SGST)
        match_status: Matching status from GSTR-2B
        ims_action: Action taken (accepted/rejected/pending)
        eligible_itc: ITC amount eligible to claim
        invoice_type: Type of invoice (B2B, B2BUR, IMPS, etc.)
    """
    gstin: str
    invoice_number: str
    invoice_date: date
    taxable_value: float
    tax_amount: float
    match_status: MatchStatus = MatchStatus.NO_MATCH
    ims_action: IMSAction = IMSAction.PENDING
    eligible_itc: float = 0.0
    invoice_type: str = "B2B"
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    
    def __post_init__(self):
        """Apply IMS logic rules after initialization"""
        self._apply_ims_logic()
    
    def _apply_ims_logic(self):
        """
        Apply IMS logic rules:
        - Exact match → accepted (full ITC)
        - Probable match → pending (50% provisional ITC)
        - No match → rejected (0 ITC)
        """
        # Determine default action based on match status
        if self.match_status == MatchStatus.EXACT:
            self.ims_action = IMSAction.ACCEPTED
        elif self.match_status == MatchStatus.PROBABLE:
            self.ims_action = IMSAction.PENDING
        else:
            self.ims_action = IMSAction.REJECTED
        
        # Calculate eligible ITC based on action
        self._calculate_eligible_itc()
    
    def _calculate_eligible_itc(self):
        """Calculate eligible ITC based on IMS action"""
        if self.ims_action == IMSAction.ACCEPTED:
            # Full ITC available
            self.eligible_itc = self.tax_amount
        elif self.ims_action == IMSAction.PENDING:
            # 50% provisional ITC
            self.eligible_itc = self.tax_amount * 0.5
        else:
            # Rejected - no ITC
            self.eligible_itc = 0.0
    
    def accept_invoice(self):
        """Manually accept an invoice"""
        self.ims_action = IMSAction.ACCEPTED
        self._calculate_eligible_itc()
    
    def reject_invoice(self):
        """Manually reject an invoice"""
        self.ims_action = IMSAction.REJECTED
        self._calculate_eligible_itc()
    
    def set_pending(self):
        """Set invoice to pending status"""
        self.ims_action = IMSAction.PENDING
        self._calculate_eligible_itc()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "gstin": self.gstin,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date.isoformat() if isinstance(self.invoice_date, date) else str(self.invoice_date),
            "taxable_value": self.taxable_value,
            "tax_amount": self.tax_amount,
            "match_status": self.match_status.value,
            "ims_action": self.ims_action.value,
            "eligible_itc": self.eligible_itc,
            "invoice_type": self.invoice_type,
            "igst": self.igst,
            "cgst": self.cgst,
            "sgst": self.sgst,
            "cess": self.cess
        }


@dataclass
class IMSReport:
    """
    IMS Report containing all IMS entries and summaries
    """
    return_period: str
    taxpayer_gstin: str
    entries: List[IMSEntry] = field(default_factory=list)
    
    @property
    def accepted_count(self) -> int:
        return sum(1 for e in self.entries if e.ims_action == IMSAction.ACCEPTED)
    
    @property
    def rejected_count(self) -> int:
        return sum(1 for e in self.entries if e.ims_action == IMSAction.REJECTED)
    
    @property
    def pending_count(self) -> int:
        return sum(1 for e in self.entries if e.ims_action == IMSAction.PENDING)
    
    @property
    def total_taxable(self) -> float:
        return sum(e.taxable_value for e in self.entries)
    
    @property
    def total_tax(self) -> float:
        return sum(e.tax_amount for e in self.entries)
    
    @property
    def total_eligible_itc(self) -> float:
        return sum(e.eligible_itc for e in self.entries)
    
    @property
    def accepted_itc(self) -> float:
        return sum(e.eligible_itc for e in self.entries if e.ims_action == IMSAction.ACCEPTED)
    
    @property
    def provisional_itc(self) -> float:
        return sum(e.eligible_itc for e in self.entries if e.ims_action == IMSAction.PENDING)
    
    @property
    def rejected_itc(self) -> float:
        return sum(e.eligible_itc for e in self.entries if e.ims_action == IMSAction.REJECTED)
    
    def add_entry(self, entry: IMSEntry):
        """Add an IMS entry"""
        self.entries.append(entry)
    
    def regenerate_gstr2b(self) -> List[Dict[str, Any]]:
        """
        Regenerate simulated GSTR-2B with only accepted invoices.
        This dataset feeds into ITC calculation.
        """
        accepted_invoices = [
            e for e in self.entries 
            if e.ims_action == IMSAction.ACCEPTED
        ]
        
        return [invoice.to_dict() for invoice in accepted_invoices]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "return_period": self.return_period,
            "taxpayer_gstin": self.taxpayer_gstin,
            "summary": {
                "total_entries": len(self.entries),
                "accepted_count": self.accepted_count,
                "rejected_count": self.rejected_count,
                "pending_count": self.pending_count,
                "total_taxable": self.total_taxable,
                "total_tax": self.total_tax,
                "total_eligible_itc": self.total_eligible_itc,
                "accepted_itc": self.accepted_itc,
                "provisional_itc": self.provisional_itc,
                "rejected_itc": self.rejected_itc
            },
            "entries": [e.to_dict() for e in self.entries],
            "regenerated_gstr2b": self.regenerate_gstr2b()
        }


class IMSEngine:
    """
    Invoice Management System Engine
    
    Handles:
    - Invoice matching from GSTR-2B
    - IMS action assignment (accept/reject/pending)
    - ITC eligibility calculation
    - GSTR-2B regeneration after IMS
    """
    
    def __init__(self, return_period: str, taxpayer_gstin: str):
        self.return_period = return_period
        self.taxpayer_gstin = taxpayer_gstin
        self.report = IMSReport(
            return_period=return_period,
            taxpayer_gstin=taxpayer_gstin
        )
    
    def process_invoices(self, gstr2b_data: List[Dict[str, Any]]) -> IMSReport:
        """
        Process GSTR-2B invoices and create IMS entries.
        
        Args:
            gstr2b_data: List of GSTR-2B invoice records
            
        Returns:
            IMSReport with all entries and summaries
        """
        for inv in gstr2b_data:
            entry = self._create_ims_entry(inv)
            self.report.add_entry(entry)
        
        return self.report
    
    def _create_ims_entry(self, invoice: Dict[str, Any]) -> IMSEntry:
        """Create an IMS entry from a GSTR-2B invoice"""
        
        # Parse invoice date
        invoice_date = invoice.get("invoice_date")
        if isinstance(invoice_date, str):
            invoice_date = date.fromisoformat(invoice_date)
        
        # Extract tax amounts
        igst = float(invoice.get("igst", 0) or 0)
        cgst = float(invoice.get("cgst", 0) or 0)
        sgst = float(invoice.get("sgst", 0) or 0)
        cess = float(invoice.get("cess", 0) or 0)
        
        taxable_value = float(invoice.get("taxable_value", 0) or 0)
        tax_amount = igst + cgst + sgst + cess
        
        # Determine match status
        match_status = self._determine_match_status(invoice)
        
        entry = IMSEntry(
            gstin=invoice.get("gstin", ""),
            invoice_number=invoice.get("invoice_number", ""),
            invoice_date=invoice_date or date.today(),
            taxable_value=taxable_value,
            tax_amount=tax_amount,
            match_status=match_status,
            invoice_type=invoice.get("invoice_type", "B2B"),
            igst=igst,
            cgst=cgst,
            sgst=sgst,
            cess=cess
        )
        
        return entry
    
    def _determine_match_status(self, invoice: Dict[str, Any]) -> MatchStatus:
        """
        Determine match status based on available data.
        
        In a real implementation, this would compare against
        purchase register data. Here we use simple heuristics.
        """
        # Check if invoice has all required fields
        has_gstin = bool(invoice.get("gstin"))
        has_invoice_number = bool(invoice.get("invoice_number"))
        has_taxable = float(invoice.get("taxable_value", 0) or 0) > 0
        
        if has_gstin and has_invoice_number and has_taxable:
            # Check for probability indicators
            if invoice.get("match_confidence", 0) >= 0.9:
                return MatchStatus.EXACT
            elif invoice.get("match_confidence", 0) >= 0.5:
                return MatchStatus.PROBABLE
            else:
                # Default to exact match for well-formed invoices
                return MatchStatus.EXACT
        
        return MatchStatus.NO_MATCH
    
    def accept_invoice(self, invoice_number: str) -> bool:
        """Manually accept a specific invoice"""
        for entry in self.report.entries:
            if entry.invoice_number == invoice_number:
                entry.accept_invoice()
                return True
        return False
    
    def reject_invoice(self, invoice_number: str) -> bool:
        """Manually reject a specific invoice"""
        for entry in self.report.entries:
            if entry.invoice_number == invoice_number:
                entry.reject_invoice()
                return True
        return False
    
    def set_pending(self, invoice_number: str) -> bool:
        """Set a specific invoice to pending"""
        for entry in self.report.entries:
            if entry.invoice_number == invoice_number:
                entry.set_pending()
                return True
        return False
    
    def get_accepted_invoices(self) -> List[IMSEntry]:
        """Get all accepted invoices"""
        return [e for e in self.report.entries if e.ims_action == IMSAction.ACCEPTED]
    
    def get_rejected_invoices(self) -> List[IMSEntry]:
        """Get all rejected invoices"""
        return [e for e in self.report.entries if e.ims_action == IMSAction.REJECTED]
    
    def get_pending_invoices(self) -> List[IMSEntry]:
        """Get all pending invoices"""
        return [e for e in self.report.entries if e.ims_action == IMSAction.PENDING]
    
    def get_itc_summary(self) -> Dict[str, float]:
        """Get ITC summary breakdown"""
        return {
            "total_eligible_itc": self.report.total_eligible_itc,
            "accepted_itc": self.report.accepted_itc,
            "provisional_itc": self.report.provisional_itc,
            "rejected_itc": self.report.rejected_itc
        }


def create_ims_from_gstr2b(
    gstr2b_data: List[Dict[str, Any]],
    return_period: str,
    taxpayer_gstin: str
) -> IMSReport:
    """
    Factory function to create IMS report from GSTR-2B data.
    
    Args:
        gstr2b_data: List of GSTR-2B invoice records
        return_period: Tax return period (e.g., "122025")
        taxpayer_gstin: Taxpayer GSTIN
        
    Returns:
        IMSReport with all entries and summaries
    """
    engine = IMSEngine(return_period, taxpayer_gstin)
    return engine.process_invoices(gstr2b_data)


def get_regenerated_gstr2b(ims_report: IMSReport) -> List[Dict[str, Any]]:
    """
    Get regenerated GSTR-2B with only accepted invoices.
    
    This is used to feed ITC calculations after IMS actions.
    """
    return ims_report.regenerate_gstr2b()
