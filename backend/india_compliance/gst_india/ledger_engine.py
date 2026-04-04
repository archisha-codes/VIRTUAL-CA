# GST India - ITC Ledger Engine
# Handles credit utilization and cross-utilization rules for GST tax payments

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class TaxType(str, Enum):
    """Types of GST tax components"""
    IGST = "igst"
    CGST = "cgst"
    SGST = "sgst"
    CESS = "cess"


@dataclass
class TaxLedger:
    """
    Represents the tax credit ledger for a taxpayer.
    
    Tracks available ITC for each tax type and handles
    cross-utilization according to GST rules.
    """
    igst_credit: float = 0.0
    cgst_credit: float = 0.0
    sgst_credit: float = 0.0
    cess_credit: float = 0.0
    
    # Utilization history
    igst_utilized: float = 0.0
    cgst_utilized: float = 0.0
    sgst_utilized: float = 0.0
    cess_utilized: float = 0.0
    
    def get_available_credit(self, tax_type: TaxType) -> float:
        """Get available credit for a specific tax type"""
        if tax_type == TaxType.IGST:
            return self.igst_credit - self.igst_utilized
        elif tax_type == TaxType.CGST:
            return self.cgst_credit - self.cgst_utilized
        elif tax_type == TaxType.SGST:
            return self.sgst_credit - self.sgst_utilized
        elif tax_type == TaxType.CESS:
            return self.cess_credit - self.cess_utilized
        return 0.0
    
    def add_credit(self, tax_type: TaxType, amount: float):
        """Add ITC credit to the ledger"""
        if tax_type == TaxType.IGST:
            self.igst_credit += amount
        elif tax_type == TaxType.CGST:
            self.cgst_credit += amount
        elif tax_type == TaxType.SGST:
            self.sgst_credit += amount
        elif tax_type == TaxType.CESS:
            self.cess_credit += amount
    
    def get_balance(self) -> Dict[str, float]:
        """Get current balance of all tax types"""
        return {
            "igst": self.get_available_credit(TaxType.IGST),
            "cgst": self.get_available_credit(TaxType.CGST),
            "sgst": self.get_available_credit(TaxType.SGST),
            "cess": self.get_available_credit(TaxType.CESS)
        }
    
    def get_total_balance(self) -> float:
        """Get total available ITC"""
        return sum(self.get_balance().values())


@dataclass
class TaxLiability:
    """
    Represents tax liability for a tax period.
    """
    igst_liability: float = 0.0
    cgst_liability: float = 0.0
    sgst_liability: float = 0.0
    cess_liability: float = 0.0
    
    def get_total(self) -> float:
        """Get total tax liability"""
        return (self.igst_liability + self.cgst_liability + 
                self.sgst_liability + self.cess_liability)
    
    def get_component(self, tax_type: TaxType) -> float:
        """Get liability for specific tax type"""
        if tax_type == TaxType.IGST:
            return self.igst_liability
        elif tax_type == TaxType.CGST:
            return self.cgst_liability
        elif tax_type == TaxType.SGST:
            return self.sgst_liability
        elif tax_type == TaxType.CESS:
            return self.cess_liability
        return 0.0


@dataclass
class CreditUtilizationResult:
    """
    Result of credit utilization calculation.
    """
    remaining_liability: TaxLiability
    remaining_credit: TaxLedger
    utilization_details: Dict[str, Any]
    cross_utilization_made: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "remaining_liability": {
                "igst": self.remaining_liability.igst_liability,
                "cgst": self.remaining_liability.cgst_liability,
                "sgst": self.remaining_liability.sgst_liability,
                "cess": self.remaining_liability.cess_liability,
                "total": self.remaining_liability.get_total()
            },
            "remaining_credit": self.remaining_credit.get_balance(),
            "utilization_details": self.utilization_details,
            "cross_utilization_made": self.cross_utilization_made
        }


class LedgerEngine:
    """
    ITC Credit Ledger Engine
    
    Implements GST cross-utilization rules:
    
    IGST credit can be used for:
    - IGST payment → IGST → CGST → SGST
    
    CGST credit can be used for:
    - CGST payment → IGST
    
    SGST credit can be used for:
    - SGST payment → IGST
    
    IMPORTANT: CGST ↔ SGST cannot be used directly
    
    Utilization priority:
    1. First set off IGST liability with IGST credit
    2. Then use remaining IGST for CGST and SGST
    3. Use CGST credit for CGST, then IGST
    4. Use SGST credit for SGST, then IGST
    5. CESS can only be used for CESS
    """
    
    def __init__(self, ledger: Optional[TaxLedger] = None):
        self.ledger = ledger or TaxLedger()
    
    def apply_credit(
        self, 
        liability: TaxLiability,
        itc_pool: Optional[TaxLedger] = None
    ) -> CreditUtilizationResult:
        """
        Apply ITC credit to tax liability.
        
        Args:
            liability: Tax liability to be paid
            itc_pool: ITC pool to use (if None, uses internal ledger)
            
        Returns:
            CreditUtilizationResult with remaining liability and credit
        """
        if itc_pool:
            self.ledger = itc_pool
        
        # Create working copies
        remaining_liability = TaxLiability(
            igst_liability=liability.igst_liability,
            cgst_liability=liability.cgst_liability,
            sgst_liability=liability.sgst_liability,
            cess_liability=liability.cess_liability
        )
        
        utilization_details = {
            "igst_utilized": 0.0,
            "cgst_utilized": 0.0,
            "sgst_utilized": 0.0,
            "cess_utilized": 0.0,
            "cross_utilization": []
        }
        
        cross_util_made = False
        
        # Step 1: Set off IGST liability with IGST credit
        if remaining_liability.igst_liability > 0:
            igst_available = self.ledger.get_available_credit(TaxType.IGST)
            igst_used = min(igst_available, remaining_liability.igst_liability)
            remaining_liability.igst_liability -= igst_used
            utilization_details["igst_utilized"] = igst_used
        
        # Step 2: Use remaining IGST credit for CGST and SGST (cross-utilization)
        igst_remaining = self.ledger.get_available_credit(TaxType.IGST)
        
        if igst_remaining > 0:
            # Use IGST for CGST
            if remaining_liability.cgst_liability > 0:
                cgst_from_igst = min(igst_remaining, remaining_liability.cgst_liability)
                remaining_liability.cgst_liability -= cgst_from_igst
                utilization_details["igst_utilized"] += cgst_from_igst
                utilization_details["cross_utilization"].append({
                    "from": "IGST",
                    "to": "CGST",
                    "amount": cgst_from_igst
                })
                cross_util_made = True
                igst_remaining -= cgst_from_igst
            
            # Use remaining IGST for SGST
            if igst_remaining > 0 and remaining_liability.sgst_liability > 0:
                sgst_from_igst = min(igst_remaining, remaining_liability.sgst_liability)
                remaining_liability.sgst_liability -= sgst_from_igst
                utilization_details["igst_utilized"] += sgst_from_igst
                utilization_details["cross_utilization"].append({
                    "from": "IGST",
                    "to": "SGST",
                    "amount": sgst_from_igst
                })
                cross_util_made = True
        
        # Step 3: Use CGST credit
        if remaining_liability.cgst_liability > 0:
            cgst_available = self.ledger.get_available_credit(TaxType.CGST)
            cgst_used = min(cgst_available, remaining_liability.cgst_liability)
            remaining_liability.cgst_liability -= cgst_used
            utilization_details["cgst_utilized"] = cgst_used
            
            # Cross-utilize CGST to IGST if CGST is exhausted but IGST liability remains
            if cgst_used > 0 and remaining_liability.igst_liability > 0:
                cgst_available_after = self.ledger.get_available_credit(TaxType.CGST)
                if cgst_available_after == 0:
                    # Use IGST for remaining CGST
                    igst_for_cgst = min(
                        self.ledger.get_available_credit(TaxType.IGST),
                        remaining_liability.cgst_liability
                    )
                    remaining_liability.cgst_liability -= igst_for_cgst
                    utilization_details["igst_utilized"] += igst_for_cgst
                    utilization_details["cross_utilization"].append({
                        "from": "IGST",
                        "to": "CGST",
                        "amount": igst_for_cgst
                    })
                    cross_util_made = True
        
        # Step 4: Use SGST credit
        if remaining_liability.sgst_liability > 0:
            sgst_available = self.ledger.get_available_credit(TaxType.SGST)
            sgst_used = min(sgst_available, remaining_liability.sgst_liability)
            remaining_liability.sgst_liability -= sgst_used
            utilization_details["sgst_utilized"] = sgst_used
            
            # Cross-utilize SGST to IGST if needed
            if sgst_used > 0 and remaining_liability.igst_liability > 0:
                sgst_available_after = self.ledger.get_available_credit(TaxType.SGST)
                if sgst_available_after == 0:
                    igst_for_sgst = min(
                        self.ledger.get_available_credit(TaxType.IGST),
                        remaining_liability.sgst_liability
                    )
                    remaining_liability.sgst_liability -= igst_for_sgst
                    utilization_details["igst_utilized"] += igst_for_sgst
                    utilization_details["cross_utilization"].append({
                        "from": "IGST",
                        "to": "SGST",
                        "amount": igst_for_sgst
                    })
                    cross_util_made = True
        
        # Step 5: Use CESS credit (cannot be cross-utilized)
        if remaining_liability.cess_liability > 0:
            cess_available = self.ledger.get_available_credit(TaxType.CESS)
            cess_used = min(cess_available, remaining_liability.cess_liability)
            remaining_liability.cess_liability -= cess_used
            utilization_details["cess_utilized"] = cess_used
        
        # Update ledger with utilization
        self.ledger.igst_utilized += utilization_details["igst_utilized"]
        self.ledger.cgst_utilized += utilization_details["cgst_utilized"]
        self.ledger.sgst_utilized += utilization_details["sgst_utilized"]
        self.ledger.cess_utilized += utilization_details["cess_utilized"]
        
        return CreditUtilizationResult(
            remaining_liability=remaining_liability,
            remaining_credit=self.ledger,
            utilization_details=utilization_details,
            cross_utilization_made=cross_util_made
        )
    
    def calculate_reverse_charge_credit(
        self, 
        rcm_invoices: List[Dict[str, Any]]
    ) -> TaxLedger:
        """
        Calculate ITC available from RCM (Reverse Charge Mechanism) invoices.
        
        Args:
            rcm_invoices: List of RCM invoice records
            
        Returns:
            TaxLedger with ITC from RCM
        """
        rcm_ledger = TaxLedger()
        
        for invoice in rcm_invoices:
            rcm_ledger.add_credit(TaxType.IGST, float(invoice.get("igst", 0) or 0))
            rcm_ledger.add_credit(TaxType.CGST, float(invoice.get("cgst", 0) or 0))
            rcm_ledger.add_credit(TaxType.SGST, float(invoice.get("sgst", 0) or 0))
            rcm_ledger.add_credit(TaxType.CESS, float(invoice.get("cess", 0) or 0))
        
        return rcm_ledger
    
    def calculate_import_credit(
        self, 
        import_invoices: List[Dict[str, Any]]
    ) -> TaxLedger:
        """
        Calculate ITC available from imports (IGST paid on imports).
        
        Args:
            import_invoices: List of import records
            
        Returns:
            TaxLedger with ITC from imports
        """
        import_ledger = TaxLedger()
        
        for imp in import_invoices:
            import_ledger.add_credit(TaxType.IGST, float(imp.get("igst", 0) or 0))
            import_ledger.add_credit(TaxType.CESS, float(imp.get("cess", 0) or 0))
        
        return import_ledger
    
    def calculate_itc_from_gstr2b(
        self, 
        gstr2b_data: List[Dict[str, Any]],
        ims_accepted_only: bool = True
    ) -> TaxLedger:
        """
        Calculate total ITC available from GSTR-2B data.
        
        Args:
            gstr2b_data: List of GSTR-2B invoice records
            ims_accepted_only: If True, only use IMS-accepted invoices
            
        Returns:
            TaxLedger with total available ITC
        """
        itc_ledger = TaxLedger()
        
        for invoice in gstr2b_data:
            # Filter by IMS action if required
            if ims_accepted_only:
                ims_action = invoice.get("ims_action", "accepted")
                if ims_action != "accepted":
                    continue
            
            itc_ledger.add_credit(TaxType.IGST, float(invoice.get("igst", 0) or 0))
            itc_ledger.add_credit(TaxType.CGST, float(invoice.get("cgst", 0) or 0))
            itc_ledger.add_credit(TaxType.SGST, float(invoice.get("sgst", 0) or 0))
            itc_ledger.add_credit(TaxType.CESS, float(invoice.get("cess", 0) or 0))
        
        return itc_ledger


def create_ledger_from_itc(
    igst: float = 0,
    cgst: float = 0,
    sgst: float = 0,
    cess: float = 0
) -> TaxLedger:
    """Factory function to create a TaxLedger with initial ITC"""
    ledger = TaxLedger()
    ledger.add_credit(TaxType.IGST, igst)
    ledger.add_credit(TaxType.CGST, cgst)
    ledger.add_credit(TaxType.SGST, sgst)
    ledger.add_credit(TaxType.CESS, cess)
    return ledger


def calculate_net_liability(
    gross_liability: TaxLiability,
    itc_available: TaxLedger
) -> TaxLiability:
    """
    Calculate net tax liability after ITC.
    
    Args:
        gross_liability: Total tax liability
        itc_available: Available ITC
        
    Returns:
        Net tax liability to be paid
    """
    engine = LedgerEngine(itc_available)
    result = engine.apply_credit(gross_liability, itc_available)
    return result.remaining_liability
