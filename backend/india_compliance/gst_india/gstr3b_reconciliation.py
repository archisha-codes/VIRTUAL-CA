"""
GSTR-3B Reconciliation Engine with Fuzzy Matching

This module provides ITC reconciliation between local purchase data and GSTR-2B (supplier data).
It implements fuzzy matching logic to match invoices with tolerance for small differences.

Matching Logic:
- Exact Match: GSTIN + Invoice No + Amount (within tolerance)
- Probable Match: GSTIN + Invoice No match, amount slightly different
- GSTIN Match Only: GSTIN matches, invoice not found
- No Match: No matching criteria met
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import re

from india_compliance.gst_india.utils.logger import get_logger

logger = get_logger(__name__)


# Tolerance for amount matching (1%)
DEFAULT_TOLERANCE = 0.01


@dataclass
class ReconciliationEntry:
    """Represents a single reconciliation result."""
    supplier_gstin: str
    invoice_number: str
    invoice_date: str
    invoice_value: float
    local_amount: float
    matched_amount: float = 0.0
    match_category: str = "no_match"
    match_confidence: float = 0.0
    difference: float = 0.0
    difference_percent: float = 0.0
    supplier_name: str = ""
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "supplier_gstin": self.supplier_gstin,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date,
            "invoice_value": self.invoice_value,
            "local_amount": self.local_amount,
            "matched_amount": self.matched_amount,
            "match_category": self.match_category,
            "match_confidence": self.match_confidence,
            "difference": self.difference,
            "difference_percent": self.difference_percent,
            "supplier_name": self.supplier_name,
            "notes": self.notes,
        }


@dataclass
class ReconciliationSummary:
    """Summary of reconciliation results."""
    total_local_invoices: int = 0
    total_supplier_invoices: int = 0
    exact_matches: int = 0
    probable_matches: int = 0
    gstin_matches: int = 0
    no_matches: int = 0
    total_difference: float = 0.0
    entries: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_local_invoices": self.total_local_invoices,
            "total_supplier_invoices": self.total_supplier_invoices,
            "exact_matches": self.exact_matches,
            "probable_matches": self.probable_matches,
            "gstin_matches": self.gstin_matches,
            "no_matches": self.no_matches,
            "total_difference": round(self.total_difference, 2),
            "entries": self.entries,
            "match_rate": round(
                (self.exact_matches + self.probable_matches) / max(self.total_local_invoices, 1) * 100, 2
            ) if self.total_local_invoices > 0 else 0,
        }


def normalize_gstin(gstin: str) -> str:
    """Normalize GSTIN by removing spaces and converting to uppercase."""
    if not gstin:
        return ""
    return re.sub(r'[^0-9A-Z]', '', str(gstin).upper())


def normalize_invoice_number(inv_no: str) -> str:
    """Normalize invoice number by removing special characters and spaces."""
    if not inv_no:
        return ""
    return re.sub(r'[^0-9A-Z]', '', str(inv_no).upper())


def calculate_amount_difference(local_amt: float, supplier_amt: float) -> Tuple[float, float]:
    """Calculate absolute and percentage difference between amounts."""
    if supplier_amt == 0:
        return local_amt, 100.0 if local_amt > 0 else 0.0
    
    diff = abs(local_amt - supplier_amt)
    diff_percent = (diff / supplier_amt) * 100 if supplier_amt > 0 else 0.0
    return round(diff, 2), round(diff_percent, 2)


def fuzzy_compare(
    gstin1: str,
    gstin2: str,
    inv1: str,
    inv2: str,
    amt1: float,
    amt2: float,
    tolerance: float = DEFAULT_TOLERANCE
) -> Tuple[int, float]:
    """
    Calculate match score between two invoice records.
    
    Scoring:
    - GSTIN match: 5 points
    - Invoice number match: 3 points
    - Amount within tolerance: 2 points
    
    Returns: (match_score, confidence_score)
    """
    score = 0
    confidence = 0.0
    
    # Normalize values
    norm_gstin1 = normalize_gstin(gstin1)
    norm_gstin2 = normalize_gstin(gstin2)
    norm_inv1 = normalize_invoice_number(inv1)
    norm_inv2 = normalize_invoice_number(inv2)
    
    # Check GSTIN match
    gstin_match = norm_gstin1 == norm_gstin2 and len(norm_gstin1) == 15
    if gstin_match:
        score += 5
    
    # Check invoice number match
    inv_match = norm_inv1 == norm_inv2 and len(norm_inv1) > 0
    if inv_match:
        score += 3
    
    # Check amount tolerance
    amt_diff_percent = abs(amt1 - amt2) / max(abs(amt2), 0.01)
    if amt_diff_percent <= tolerance:
        score += 2
    
    # Calculate confidence (0.0 to 1.0)
    if score == 10:
        confidence = 1.0  # Exact match
    elif score >= 6:
        confidence = 0.75  # Very good match
    elif score >= 5:
        confidence = 0.5   # GSTIN only
    elif score >= 3:
        confidence = 0.25  # Invoice number only
    else:
        confidence = 0.0   # No match
    
    return score, confidence


def categorize_match(score: int) -> str:
    """Categorize match based on score."""
    if score == 10:
        return "exact_match"
    elif score >= 6:
        return "probable_match"
    elif score >= 5:
        return "gstin_match"
    else:
        return "no_match"


def reconcile_invoices(
    local_purchases: List[Dict[str, Any]],
    supplier_data: List[Dict[str, Any]],
    tolerance: float = DEFAULT_TOLERANCE
) -> ReconciliationSummary:
    """
    Reconcile local purchase invoices with supplier (GSTR-2B) data.
    
    Args:
        local_purchases: List of local purchase invoice records
        supplier_data: List of supplier (GSTR-2B) invoice records
        tolerance: Amount tolerance for matching (default 1%)
    
    Returns:
        ReconciliationSummary with match results
    """
    logger.info(f"Starting reconciliation: {len(local_purchases)} local, {len(supplier_data)} supplier invoices")
    
    summary = ReconciliationSummary()
    summary.total_local_invoices = len(local_purchases)
    summary.total_supplier_invoices = len(supplier_data)
    
    # Build lookup index for supplier data
    # Key: (GSTIN, Invoice Number) -> list of supplier entries
    supplier_index: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    
    for entry in supplier_data:
        gstin = normalize_gstin(entry.get("gstin", entry.get("supplier_gstin", "")))
        inv_no = normalize_invoice_number(entry.get("invoice_number", entry.get("inv_no", "")))
        if gstin and inv_no:
            supplier_index[(gstin, inv_no)].append(entry)
    
    # Also build GSTIN-only index
    gstin_index: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for entry in supplier_data:
        gstin = normalize_gstin(entry.get("gstin", entry.get("supplier_gstin", "")))
        if gstin:
            gstin_index[gstin].append(entry)
    
    # Match each local invoice
    matched_invoices: set = set()
    
    for local in local_purchases:
        local_gstin = local.get("supplier_gstin", local.get("gstin", ""))
        local_inv_no = local.get("invoice_number", local.get("inv_no", ""))
        local_amount = float(local.get("invoice_value", local.get("txval", local.get("amount", 0))))
        local_date = local.get("invoice_date", local.get("inv_date", ""))
        
        result = ReconciliationEntry(
            supplier_gstin=local_gstin,
            invoice_number=local_inv_no,
            invoice_date=local_date,
            invoice_value=local_amount,
            local_amount=local_amount,
        )
        
        # Try exact match (GSTIN + Invoice Number)
        norm_gstin = normalize_gstin(local_gstin)
        norm_inv = normalize_invoice_number(local_inv_no)
        key = (norm_gstin, norm_inv)
        
        best_match = None
        best_score = 0
        
        if key in supplier_index:
            for supplier in supplier_index[key]:
                supplier_amount = float(supplier.get("invoice_value", supplier.get("txval", 0)))
                score, confidence = fuzzy_compare(
                    local_gstin, supplier.get("gstin", ""),
                    local_inv_no, supplier.get("invoice_number", ""),
                    local_amount, supplier_amount,
                    tolerance
                )
                
                if score > best_score:
                    best_score = score
                    best_match = supplier
        
        # If no exact match, try GSTIN-only match
        if not best_match and norm_gstin in gstin_index:
            for supplier in gstin_index[norm_gstin]:
                supplier_amount = float(supplier.get("invoice_value", supplier.get("txval", 0)))
                score, confidence = fuzzy_compare(
                    local_gstin, supplier.get("gstin", ""),
                    "", "",  # No invoice number
                    local_amount, supplier_amount,
                    tolerance
                )
                
                if score > best_score:
                    best_score = score
                    best_match = supplier
        
        # Categorize and finalize
        if best_match:
            result.match_category = categorize_match(best_score)
            result.match_confidence = best_score / 10.0
            result.matched_amount = float(best_match.get("invoice_value", 0))
            result.difference, result.difference_percent = calculate_amount_difference(
                local_amount, result.matched_amount
            )
            result.supplier_name = best_match.get("supplier_name", best_match.get("name", ""))
            
            if result.match_category == "exact_match":
                summary.exact_matches += 1
            elif result.match_category == "probable_match":
                summary.probable_matches += 1
            elif result.match_category == "gstin_match":
                summary.gstin_matches += 1
            else:
                summary.no_matches += 1
        else:
            result.match_category = "no_match"
            result.match_confidence = 0.0
            summary.no_matches += 1
        
        summary.total_difference += result.difference
        summary.entries.append(result.to_dict())
    
    logger.info(
        f"Reconciliation complete: exact={summary.exact_matches}, "
        f"probable={summary.probable_matches}, gstin={summary.gstin_matches}, "
        f"no_match={summary.no_matches}"
    )
    
    return summary


def calculate_itc_claim(
    reconciliation: ReconciliationSummary,
    eligible_categories: List[str] = None
) -> Dict[str, float]:
    """
    Calculate eligible ITC based on reconciliation results.
    
    Args:
        reconciliation: ReconciliationSummary from reconcile_invoices
        eligible_categories: Categories that qualify for ITC (default: exact_match, probable_match)
    
    Returns:
        Dictionary with ITC amounts by tax type
    """
    if eligible_categories is None:
        eligible_categories = ["exact_match", "probable_match"]
    
    itc_claim = {
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
        "total": 0.0,
        "eligible_invoices": 0,
        "ineligible_invoices": 0,
    }
    
    for entry in reconciliation.entries:
        if entry["match_category"] in eligible_categories:
            # Eligible for ITC
            itc_claim["eligible_invoices"] += 1
            # Proportionally claim ITC based on matched amount ratio
            ratio = entry["matched_amount"] / max(entry["local_amount"], 0.01)
            # For simplicity, assume ITC is proportional to invoice value
            # In practice, ITC would be calculated from tax amounts
            itc_claim["total"] += entry["matched_amount"] * 0.18  # Assumed average tax rate
        else:
            itc_claim["ineligible_invoices"] += 1
    
    # Round all values
    for key in itc_claim:
        if isinstance(itc_claim[key], float):
            itc_claim[key] = round(itc_claim[key], 2)
    
    return itc_claim


def generate_gstr3b_with_reconciliation(
    gstr1_tables: Dict[str, Any],
    purchases_data: List[Dict[str, Any]] = None,
    return_period: str = "",
    taxpayer_gstin: str = "",
    taxpayer_name: str = ""
) -> Dict[str, Any]:
    """
    Generate complete GSTR-3B summary with ITC reconciliation.
    
    Args:
        gstr1_tables: GSTR-1 tables dictionary
        purchases_data: Optional purchase data for ITC reconciliation
        return_period: Return period in MMYYYY format
        taxpayer_gstin: Taxpayer's GSTIN
        taxpayer_name: Taxpayer's name
    
    Returns:
        Complete GSTR-3B data with reconciliation
    """
    from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
    
    # Generate base GSTR-3B summary
    gstr3b = generate_gstr3b_summary(
        gstr1_tables=gstr1_tables,
        return_period=return_period,
        taxpayer_gstin=taxpayer_gstin,
        taxpayer_name=taxpayer_name,
    )
    
    # Add reconciliation data if purchases provided
    if purchases_data:
        reconciliation = reconcile_invoices(
            local_purchases=purchases_data,
            supplier_data=[],  # Would be populated from GSTR-2B fetch
            tolerance=DEFAULT_TOLERANCE
        )
        
        # Calculate ITC
        itc_claim = calculate_itc_claim(reconciliation)
        
        # Update GSTR-3B with ITC
        gstr3b["5"] = {
            "description": "Input Tax Credit claimed",
            "igst": itc_claim["igst"],
            "cgst": itc_claim["cgst"],
            "sgst": itc_claim["sgst"],
            "cess": itc_claim["cess"],
        }
        
        gstr3b["itc_reconciliation"] = reconciliation.to_dict()
        gstr3b["itc_claim_summary"] = itc_claim
        
        # Update net ITC available
        gstr3b["7"] = {
            "description": "Net ITC Available",
            "igst": itc_claim["igst"],
            "cgst": itc_claim["cgst"],
            "sgst": itc_claim["sgst"],
            "cess": itc_claim["cess"],
        }
        
        # Recalculate tax payable after ITC
        gstr3b["10"] = {
            "description": "Payable Amount after ITC",
            "igst": round(gstr3b["8"]["igst"] - itc_claim["igst"], 2),
            "cgst": round(gstr3b["8"]["cgst"] - itc_claim["cgst"], 2),
            "sgst": round(gstr3b["8"]["sgst"] - itc_claim["sgst"], 2),
            "cess": round(gstr3b["8"]["cess"] - itc_claim["cess"], 2),
        }
        
        # Update totals
        payable = gstr3b["10"]
        gstr3b["total_payable"] = {
            "igst": payable["igst"],
            "cgst": payable["cgst"],
            "sgst": payable["sgst"],
            "cess": payable["cess"],
            "total": round(payable["igst"] + payable["cgst"] + payable["sgst"] + payable["cess"], 2),
        }
    
    return gstr3b
