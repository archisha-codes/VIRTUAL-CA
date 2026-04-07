"""
AI/ML Matching Engine

This module provides advanced AI/ML-based invoice matching with multiple algorithms
including exact matching, fuzzy matching, and ML-based matching.
"""

from typing import Dict, Any, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import re
import logging

from india_compliance.gst_india.ai_reconciliation.models import (
    InvoiceMatchingModel,
    AnomalyDetector,
    InvoiceFeatures,
    MatchResult,
)
from india_compliance.gst_india.ai_reconciliation.match_categories import (
    MatchCategory,
    get_match_category,
    format_match_result,
    MATCH_CATEGORY_CONFIGS,
)
from india_compliance.gst_india.ai_reconciliation.exceptions import (
    MatchingError,
    InvalidInvoiceDataError,
)

logger = logging.getLogger(__name__)


@dataclass
class MatchingConfig:
    """Configuration for matching engine"""
    # Exact matching
    exact_match_enabled: bool = True
    amount_tolerance_percent: float = 1.0
    
    # Fuzzy matching
    fuzzy_match_enabled: bool = True
    fuzzy_invoice_threshold: float = 0.8
    fuzzy_amount_threshold: float = 0.9
    
    # ML matching
    ml_match_enabled: bool = True
    ml_confidence_threshold: float = 0.7
    
    # Anomaly detection
    anomaly_detection_enabled: bool = True
    
    # Multi-match handling
    allow_multi_match: bool = False
    best_match_only: bool = True


@dataclass
class MatchCandidate:
    """A potential match candidate"""
    sales_invoice: Dict[str, Any]
    purchase_invoice: Dict[str, Any]
    confidence: float
    category: MatchCategory
    factors: Dict[str, float] = field(default_factory=dict)
    explanations: List[str] = field(default_factory=list)


@dataclass 
class ReconciliationResult:
    """Result of reconciliation process"""
    job_id: str
    gstin: str
    return_period: str
    status: str
    total_sales_invoices: int = 0
    total_purchase_invoices: int = 0
    matches: List[Dict[str, Any]] = field(default_factory=list)
    unmatched_sales: List[Dict[str, Any]] = field(default_factory=list)
    unmatched_purchases: List[Dict[str, Any]] = field(default_factory=list)
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


class AIMatchingEngine:
    """
    AI-powered matching engine for invoice reconciliation.
    
    Supports multiple matching algorithms:
    - Exact matching (GSTIN + Invoice Number + Amount)
    - Fuzzy matching (Levenshtein distance, phonetic matching)
    - ML-based matching (trained model)
    - Anomaly detection
    """
    
    def __init__(self, config: Optional[MatchingConfig] = None):
        self.config = config or MatchingConfig()
        self.ml_model = InvoiceMatchingModel()
        self.anomaly_detector = AnomalyDetector()
        
    def match_invoices(
        self,
        sales_data: List[Dict[str, Any]],
        purchase_data: List[Dict[str, Any]],
        gstin: str = "",
        return_period: str = ""
    ) -> ReconciliationResult:
        """
        Match invoices between sales (GSTR-1) and purchase (GSTR-2B) data.
        
        Args:
            sales_data: List of sales invoices
            purchase_data: List of purchase invoices
            gstin: GSTIN for the filing
            return_period: Return period (MMYYYY)
            
        Returns:
            ReconciliationResult with match details
        """
        logger.info(f"Starting AI reconciliation: {len(sales_data)} sales, {len(purchase_data)} purchase invoices")
        
        result = ReconciliationResult(
            job_id=self._generate_job_id(),
            gstin=gstin,
            return_period=return_period,
            status="running",
            total_sales_invoices=len(sales_data),
            total_purchase_invoices=len(purchase_data),
        )
        
        try:
            # Preprocess data
            sales_invoices = self._preprocess_invoices(sales_data, "sales")
            purchase_invoices = self._preprocess_invoices(purchase_data, "purchase")
            
            # Build indices
            sales_index = self._build_invoice_index(sales_invoices)
            purchase_index = self._build_invoice_index(purchase_invoices)
            
            # Find matches using multiple algorithms
            matches = []
            matched_sales = set()
            matched_purchase = set()
            
            # Phase 1: Exact matching
            if self.config.exact_match_enabled:
                exact_matches = self._exact_match(sales_invoices, purchase_invoices)
                for match in exact_matches:
                    sales_key = self._get_invoice_key(match["sales_invoice"])
                    purchase_key = self._get_invoice_key(match["purchase_invoice"])
                    if sales_key not in matched_sales and purchase_key not in matched_purchase:
                        matches.append(match)
                        matched_sales.add(sales_key)
                        matched_purchase.add(purchase_key)
            
            # Phase 2: Fuzzy matching
            if self.config.fuzzy_match_enabled:
                fuzzy_matches = self._fuzzy_match(
                    sales_invoices, purchase_invoices, matched_sales, matched_purchase
                )
                for match in fuzzy_matches:
                    sales_key = self._get_invoice_key(match["sales_invoice"])
                    purchase_key = self._get_invoice_key(match["purchase_invoice"])
                    if self.config.best_match_only and sales_key in matched_sales:
                        continue
                    matches.append(match)
                    matched_sales.add(sales_key)
                    matched_purchase.add(purchase_key)
                    if self.config.best_match_only:
                        break
            
            # Phase 3: ML-based matching
            if self.config.ml_match_enabled:
                ml_matches = self._ml_match(
                    sales_invoices, purchase_invoices, matched_sales, matched_purchase
                )
                for match in ml_matches:
                    sales_key = self._get_invoice_key(match["sales_invoice"])
                    if sales_key not in matched_sales:
                        matches.append(match)
                        matched_sales.add(sales_key)
            
            # Find unmatched invoices
            result.unmatched_sales = [
                inv for inv in sales_invoices 
                if self._get_invoice_key(inv) not in matched_sales
            ]
            result.unmatched_purchases = [
                inv for inv in purchase_invoices 
                if self._get_invoice_key(inv) not in matched_purchase
            ]
            
            # Anomaly detection
            if self.config.anomaly_detection_enabled:
                all_invoices = sales_invoices + purchase_invoices
                self.anomaly_detector.fit(all_invoices)
                anomalies = self.anomaly_detector.detect_anomalies(all_invoices)
                result.anomalies = [a for a in anomalies if a.get("is_anomaly")]
            
            # Calculate statistics
            result.statistics = self._calculate_statistics(matches, result)
            result.matches = matches
            result.status = "completed"
            result.completed_at = datetime.now()
            
            logger.info(
                f"Reconciliation completed: {len(matches)} matches, "
                f"{len(result.unmatched_sales)} unmatched sales, "
                f"{len(result.unmatched_purchases)} unmatched purchases"
            )
            
        except Exception as e:
            logger.error(f"Reconciliation failed: {str(e)}")
            result.status = "failed"
            result.statistics = {"error": str(e)}
        
        return result
    
    def calculate_confidence_score(
        self,
        sales_invoice: Dict[str, Any],
        purchase_invoice: Dict[str, Any]
    ) -> MatchResult:
        """Calculate confidence score for a potential match"""
        
        features = self.ml_model.extract_features(sales_invoice, purchase_invoice)
        
        # Calculate individual factor scores
        factors = {}
        explanations = []
        
        # Invoice number match
        inv_no_score = features.invoice_number_similarity
        factors["invoice_number"] = inv_no_score
        if inv_no_score >= 1.0:
            explanations.append("Invoice numbers match exactly")
        elif inv_no_score >= 0.8:
            explanations.append("Invoice numbers are very similar")
        
        # GSTIN match
        factors["gstin"] = features.gstin_match
        if features.gstin_match:
            explanations.append("Supplier GSTIN matches")
        
        # Amount difference
        amount_score = max(0, 1 - (features.amount_difference_percent / 100))
        factors["amount"] = amount_score
        if features.amount_difference_percent <= self.config.amount_tolerance_percent:
            explanations.append(f"Amount within tolerance ({self.config.amount_tolerance_percent}%)")
        else:
            explanations.append(f"Amount differs by {features.amount_difference_percent:.2f}%")
        
        # Date proximity
        date_score = max(0, 1 - (features.date_difference_days / 30))
        factors["date"] = date_score
        if features.date_difference_days == 0:
            explanations.append("Invoice dates match")
        elif features.date_difference_days <= 7:
            explanations.append("Invoice dates are very close")
        
        # Supplier name
        if features.supplier_name_similarity > 0.5:
            explanations.append("Supplier names are similar")
        
        # Calculate overall confidence
        confidence = self.ml_model.predict_match_probability(features)
        
        # Determine category
        category = get_match_category(confidence)
        
        # Check for anomalies
        is_anomaly = False
        anomaly_score = 0.0
        if features.amount_difference_percent > 50:
            is_anomaly = True
            anomaly_score = 0.8
            explanations.append("WARNING: Large amount difference detected")
        
        return MatchResult(
            confidence=confidence,
            category=category.value,
            factors=factors,
            explanations=explanations,
            is_anomaly=is_anomaly,
            anomaly_score=anomaly_score,
        )
    
    def suggest_corrections(
        self,
        low_confidence_matches: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Suggest corrections for low confidence matches"""
        
        suggestions = []
        
        for match in low_confidence_matches:
            sales = match.get("sales_invoice", {})
            purchase = match.get("purchase_invoice", {})
            
            suggestion = {
                "match_id": match.get("id"),
                "suggestions": [],
                "confidence": match.get("confidence", 0),
            }
            
            # Check for common issues
            sales_inv_no = sales.get("invoice_number", "")
            purchase_inv_no = purchase.get("invoice_number", "")
            
            if sales_inv_no != purchase_inv_no:
                suggestion["suggestions"].append({
                    "type": "invoice_number",
                    "message": "Invoice numbers differ",
                    "options": [sales_inv_no, purchase_inv_no],
                })
            
            # Check amount
            sales_amt = float(sales.get("invoice_value", 0))
            purchase_amt = float(purchase.get("invoice_value", 0))
            
            if abs(sales_amt - purchase_amt) > 0:
                diff_pct = abs(sales_amt - purchase_amt) / max(purchase_amt, 1) * 100
                if diff_pct > 10:
                    suggestion["suggestions"].append({
                        "type": "amount",
                        "message": f"Amount differs by {diff_pct:.1f}%",
                        "options": [sales_amt, purchase_amt],
                    })
            
            suggestions.append(suggestion)
        
        return suggestions
    
    def _preprocess_invoices(
        self, 
        invoices: List[Dict[str, Any]], 
        source: str
    ) -> List[Dict[str, Any]]:
        """Preprocess invoices for matching"""
        processed = []
        
        for idx, inv in enumerate(invoices):
            processed_inv = {
                **inv,
                "_source": source,
                "_index": idx,
                "_id": f"{source}_{idx}",
                "invoice_number": inv.get("invoice_number", inv.get("inv_no", "")),
                "invoice_value": float(inv.get("invoice_value", inv.get("txval", inv.get("amount", 0)))),
                "supplier_gstin": inv.get("supplier_gstin", inv.get("gstin", "")),
                "invoice_date": inv.get("invoice_date", inv.get("inv_date", "")),
            }
            processed.append(processed_inv)
        
        return processed
    
    def _build_invoice_index(
        self, 
        invoices: List[Dict[str, Any]]
    ) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
        """Build lookup index for invoices"""
        index = defaultdict(list)
        
        for inv in invoices:
            gstin = self._normalize_gstin(inv.get("supplier_gstin", ""))
            inv_no = self._normalize_invoice_number(inv.get("invoice_number", ""))
            
            if gstin and inv_no:
                index[(gstin, inv_no)].append(inv)
        
        return index
    
    def _exact_match(
        self,
        sales: List[Dict[str, Any]],
        purchases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Perform exact matching"""
        matches = []
        
        # Build purchase index
        purchase_index = self._build_invoice_index(purchases)
        
        for sale in sales:
            sale_gstin = self._normalize_gstin(sale.get("supplier_gstin", ""))
            sale_inv_no = self._normalize_invoice_number(sale.get("invoice_number", ""))
            sale_amount = sale.get("invoice_value", 0)
            
            # Exact match: GSTIN + Invoice Number
            key = (sale_gstin, sale_inv_no)
            if key in purchase_index:
                for purchase in purchase_index[key]:
                    # Check amount tolerance
                    purchase_amount = purchase.get("invoice_value", 0)
                    amount_diff_pct = abs(sale_amount - purchase_amount) / max(purchase_amount, 1) * 100
                    
                    if amount_diff_pct <= self.config.amount_tolerance_percent:
                        confidence = 1.0
                        match = format_match_result(
                            {"sales_invoice": sale, "purchase_invoice": purchase},
                            confidence,
                            MatchCategory.EXACT_MATCH,
                            "Exact match: GSTIN, Invoice Number, and Amount match"
                        )
                        match["id"] = self._generate_match_id()
                        matches.append(match)
        
        return matches
    
    def _fuzzy_match(
        self,
        sales: List[Dict[str, Any]],
        purchases: List[Dict[str, Any]],
        already_matched_sales: set,
        already_matched_purchases: set
    ) -> List[Dict[str, Any]]:
        """Perform fuzzy matching"""
        matches = []
        
        for sale in sales:
            sale_key = self._get_invoice_key(sale)
            if sale_key in already_matched_sales:
                continue
            
            best_match = None
            best_confidence = 0
            
            sale_gstin = self._normalize_gstin(sale.get("supplier_gstin", ""))
            sale_inv_no = sale.get("invoice_number", "")
            sale_amount = sale.get("invoice_value", 0)
            
            for purchase in purchases:
                purchase_key = self._get_invoice_key(purchase)
                if purchase_key in already_matched_purchases:
                    continue
                
                # Calculate fuzzy match
                result = self.calculate_confidence_score(sale, purchase)
                
                if result.confidence >= self.config.fuzzy_invoice_threshold:
                    if result.confidence > best_confidence:
                        best_confidence = result.confidence
                        best_match = {
                            "sales_invoice": sale,
                            "purchase_invoice": purchase,
                            "confidence": result.confidence,
                            "factors": result.factors,
                            "explanations": result.explanations,
                        }
            
            if best_match and best_confidence >= self.config.fuzzy_invoice_threshold:
                category = get_match_category(best_confidence)
                formatted = format_match_result(
                    best_match,
                    best_confidence,
                    category,
                    " | ".join(best_match["explanations"])
                )
                formatted["id"] = self._generate_match_id()
                matches.append(formatted)
        
        return matches
    
    def _ml_match(
        self,
        sales: List[Dict[str, Any]],
        purchases: List[Dict[str, Any]],
        already_matched_sales: set,
        already_matched_purchases: set
    ) -> List[Dict[str, Any]]:
        """Perform ML-based matching"""
        matches = []
        
        for sale in sales:
            sale_key = self._get_invoice_key(sale)
            if sale_key in already_matched_sales:
                continue
            
            best_match = None
            best_confidence = 0
            
            for purchase in purchases:
                purchase_key = self._get_invoice_key(purchase)
                if purchase_key in already_matched_purchases:
                    continue
                
                # Use ML model
                result = self.calculate_confidence_score(sale, purchase)
                
                if result.confidence >= self.config.ml_confidence_threshold:
                    if result.confidence > best_confidence:
                        best_confidence = result.confidence
                        best_match = {
                            "sales_invoice": sale,
                            "purchase_invoice": purchase,
                            "confidence": result.confidence,
                            "factors": result.factors,
                            "explanations": result.explanations,
                        }
            
            if best_match:
                category = get_match_category(best_confidence)
                formatted = format_match_result(
                    best_match,
                    best_confidence,
                    category,
                    "ML-based match: " + " | ".join(best_match["explanations"])
                )
                formatted["id"] = self._generate_match_id()
                matches.append(formatted)
        
        return matches
    
    def _calculate_statistics(
        self, 
        matches: List[Dict[str, Any]],
        result: ReconciliationResult
    ) -> Dict[str, Any]:
        """Calculate reconciliation statistics"""
        
        # Category breakdown
        category_breakdown = defaultdict(int)
        for match in matches:
            category_breakdown[match.get("category", "unknown")] += 1
        
        # Confidence distribution
        confidence_ranges = {
            "90-100%": 0,
            "70-89%": 0,
            "50-69%": 0,
            "below_50%": 0,
        }
        
        for match in matches:
            conf = match.get("confidence", 0)
            if conf >= 90:
                confidence_ranges["90-100%"] += 1
            elif conf >= 70:
                confidence_ranges["70-89%"] += 1
            elif conf >= 50:
                confidence_ranges["50-69%"] += 1
            else:
                confidence_ranges["below_50%"] += 1
        
        # Amount statistics
        matched_amount = sum(
            m.get("purchase_invoice", {}).get("invoice_value", 0) 
            for m in matches
        )
        
        total_sales_amount = sum(
            s.get("invoice_value", 0) for s in result.unmatched_sales
        ) + matched_amount
        
        return {
            "total_matches": len(matches),
            "exact_matches": category_breakdown.get("exact_match", 0),
            "high_probability": category_breakdown.get("high_probability", 0),
            "medium_probability": category_breakdown.get("medium_probability", 0),
            "low_probability": category_breakdown.get("low_probability", 0),
            "no_match": len(result.unmatched_sales),
            "category_breakdown": dict(category_breakdown),
            "confidence_distribution": confidence_ranges,
            "matched_amount": round(matched_amount, 2),
            "unmatched_amount": round(total_sales_amount - matched_amount, 2),
            "match_rate": round(len(matches) / max(result.total_sales_invoices, 1) * 100, 2),
            "anomalies_count": len(result.anomalies),
        }
    
    @staticmethod
    def _normalize_gstin(gstin: str) -> str:
        """Normalize GSTIN"""
        if not gstin:
            return ""
        return re.sub(r'[^0-9A-Z]', '', str(gstin).upper())
    
    @staticmethod
    def _normalize_invoice_number(inv_no: str) -> str:
        """Normalize invoice number"""
        if not inv_no:
            return ""
        return re.sub(r'[^0-9A-Za-z]', '', str(inv_no).upper())
    
    @staticmethod
    def _get_invoice_key(invoice: Dict[str, Any]) -> Tuple[str, str]:
        """Get invoice key for matching"""
        gstin = AIMatchingEngine._normalize_gstin(
            invoice.get("supplier_gstin", "")
        )
        inv_no = AIMatchingEngine._normalize_invoice_number(
            invoice.get("invoice_number", "")
        )
        return (gstin, inv_no)
    
    @staticmethod
    def _generate_job_id() -> str:
        """Generate unique job ID"""
        import uuid
        return f"RECON-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:8]}"
    
    @staticmethod
    def _generate_match_id() -> str:
        """Generate unique match ID"""
        import uuid
        return f"MATCH-{str(uuid.uuid4())[:12]}"
