"""
ML Models for Invoice Reconciliation

This module provides ML-based models for invoice matching and anomaly detection.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json
import hashlib
import re
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class InvoiceFeatures:
    """Extracted features for an invoice pair"""
    invoice_number_similarity: float = 0.0
    gstin_match: float = 0.0
    amount_difference: float = 0.0
    amount_difference_percent: float = 0.0
    date_difference_days: int = 0
    supplier_name_similarity: float = 0.0
    hsn_match: float = 0.0
    place_of_supply_match: float = 0.0
    invoice_type_match: float = 0.0
    reverse_charge_match: float = 0.0
    is_credit_note: float = 0.0
    is_amendment: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "invoice_number_similarity": self.invoice_number_similarity,
            "gstin_match": self.gstin_match,
            "amount_difference": self.amount_difference,
            "amount_difference_percent": self.amount_difference_percent,
            "date_difference_days": self.date_difference_days,
            "supplier_name_similarity": self.supplier_name_similarity,
            "hsn_match": self.hsn_match,
            "place_of_supply_match": self.place_of_supply_match,
            "invoice_type_match": self.invoice_type_match,
            "reverse_charge_match": self.reverse_charge_match,
            "is_credit_note": self.is_credit_note,
            "is_amendment": self.is_amendment,
        }


@dataclass
class MatchResult:
    """Result of a match operation"""
    confidence: float
    category: str
    factors: Dict[str, float]
    explanations: List[str]
    is_anomaly: bool = False
    anomaly_score: float = 0.0


class InvoiceMatchingModel:
    """
    ML-based invoice matching model.
    
    Uses feature extraction and weighted scoring for invoice matching.
    Can be trained on historical data for improved accuracy.
    """
    
    # Default weights for feature matching
    DEFAULT_WEIGHTS = {
        "invoice_number_similarity": 0.30,
        "gstin_match": 0.25,
        "amount_difference_percent": 0.20,
        "date_difference_days": 0.10,
        "supplier_name_similarity": 0.05,
        "hsn_match": 0.03,
        "place_of_supply_match": 0.02,
        "invoice_type_match": 0.02,
        "reverse_charge_match": 0.02,
        "is_credit_note": 0.01,
    }
    
    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()
        self.trained = False
        self.training_data: List[Tuple[InvoiceFeatures, int]] = []
        
    def extract_features(
        self, 
        sales_invoice: Dict[str, Any], 
        purchase_invoice: Dict[str, Any]
    ) -> InvoiceFeatures:
        """Extract features from an invoice pair"""
        
        features = InvoiceFeatures()
        
        # Invoice number similarity
        sales_inv_no = self._normalize_invoice_number(
            sales_invoice.get("invoice_number", sales_invoice.get("inv_no", ""))
        )
        purchase_inv_no = self._normalize_invoice_number(
            purchase_invoice.get("invoice_number", purchase_invoice.get("inv_no", ""))
        )
        features.invoice_number_similarity = self._calculate_similarity(
            sales_inv_no, purchase_inv_no
        )
        
        # GSTIN match
        sales_gstin = self._normalize_gstin(
            sales_invoice.get("supplier_gstin", sales_invoice.get("gstin", ""))
        )
        purchase_gstin = self._normalize_gstin(
            purchase_invoice.get("supplier_gstin", purchase_invoice.get("gstin", ""))
        )
        features.gstin_match = 1.0 if sales_gstin == purchase_gstin else 0.0
        
        # Amount difference
        sales_amount = float(sales_invoice.get("invoice_value", sales_invoice.get("txval", 0)))
        purchase_amount = float(purchase_invoice.get("invoice_value", purchase_invoice.get("txval", 0)))
        
        if purchase_amount > 0:
            features.amount_difference = abs(sales_amount - purchase_amount)
            features.amount_difference_percent = abs(sales_amount - purchase_amount) / purchase_amount * 100
        else:
            features.amount_difference = abs(sales_amount - purchase_amount)
            features.amount_difference_percent = 100.0 if sales_amount > 0 else 0.0
        
        # Date difference
        sales_date = self._parse_date(sales_invoice.get("invoice_date", ""))
        purchase_date = self._parse_date(purchase_invoice.get("invoice_date", ""))
        if sales_date and purchase_date:
            features.date_difference_days = abs((sales_date - purchase_date).days)
        
        # Supplier name similarity
        sales_name = sales_invoice.get("supplier_name", sales_invoice.get("name", "")).lower()
        purchase_name = purchase_invoice.get("supplier_name", purchase_invoice.get("name", "")).lower()
        features.supplier_name_similarity = self._calculate_similarity(sales_name, purchase_name)
        
        # HSN match
        sales_hsn = str(sales_invoice.get("hsn_code", sales_invoice.get("hsn", "")))
        purchase_hsn = str(purchase_invoice.get("hsn_code", purchase_invoice.get("hsn", "")))
        features.hsn_match = 1.0 if sales_hsn == purchase_hsn and sales_hsn else 0.0
        
        # Place of supply
        sales_pos = sales_invoice.get("place_of_supply", sales_invoice.get("pos", ""))
        purchase_pos = purchase_invoice.get("place_of_supply", purchase_pos, "")
        features.place_of_supply_match = 1.0 if sales_pos == purchase_pos else 0.0
        
        # Invoice type
        sales_type = sales_invoice.get("invoice_type", "")
        purchase_type = purchase_invoice.get("invoice_type", "")
        features.invoice_type_match = 1.0 if sales_type == purchase_type else 0.5
        
        # Reverse charge
        sales_rc = sales_invoice.get("reverse_charge", "N")
        purchase_rc = purchase_invoice.get("reverse_charge", "N")
        features.reverse_charge_match = 1.0 if sales_rc == purchase_rc else 0.0
        
        # Credit note flag
        sales_type_lower = str(sales_invoice.get("invoice_type", "")).lower()
        purchase_type_lower = str(purchase_invoice.get("invoice_type", "")).lower()
        features.is_credit_note = 1.0 if "credit" in sales_type_lower or "debit" in purchase_type_lower else 0.0
        
        # Amendment flag
        features.is_amendment = 1.0 if sales_invoice.get("is_amendment") or purchase_invoice.get("is_amendment") else 0.0
        
        return features
    
    def predict_match_probability(self, features: InvoiceFeatures) -> float:
        """Predict match probability based on features"""
        
        # Calculate weighted score
        score = 0.0
        
        # Invoice number similarity
        score += features.invoice_number_similarity * self.weights.get("invoice_number_similarity", 0)
        
        # GSTIN match (binary)
        score += features.gstin_match * self.weights.get("gstin_match", 0)
        
        # Amount difference (inverse - lower is better)
        amount_score = max(0, 1 - (features.amount_difference_percent / 100))
        score += amount_score * self.weights.get("amount_difference_percent", 0)
        
        # Date difference (inverse - closer is better)
        date_score = max(0, 1 - (features.date_difference_days / 30))  # 30 days = 0 score
        score += date_score * self.weights.get("date_difference_days", 0)
        
        # Supplier name
        score += features.supplier_name_similarity * self.weights.get("supplier_name_similarity", 0)
        
        # Other features
        score += features.hsn_match * self.weights.get("hsn_match", 0)
        score += features.place_of_supply_match * self.weights.get("place_of_supply_match", 0)
        score += features.invoice_type_match * self.weights.get("invoice_type_match", 0)
        score += features.reverse_charge_match * self.weights.get("reverse_charge_match", 0)
        score += features.is_credit_note * self.weights.get("is_credit_note", 0)
        
        return min(1.0, max(0.0, score))
    
    def train(self, labeled_data: List[Tuple[Dict, Dict, int]]):
        """
        Train the model on labeled data.
        
        Args:
            labeled_data: List of (sales_invoice, purchase_invoice, label) tuples
                        label: 1 for match, 0 for no match
        """
        self.training_data = []
        
        for sales_inv, purchase_inv, label in labeled_data:
            features = self.extract_features(sales_inv, purchase_inv)
            self.training_data.append((features, label))
        
        # In a real implementation, this would train an actual ML model
        # For now, we adjust weights based on training data
        self._adjust_weights()
        self.trained = True
        
        logger.info(f"Model trained on {len(labeled_data)} labeled samples")
    
    def _adjust_weights(self):
        """Adjust weights based on training data"""
        # Calculate average features for matches vs non-matches
        if not self.training_data:
            return
            
        match_features = []
        non_match_features = []
        
        for features, label in self.training_data:
            if label == 1:
                match_features.append(features)
            else:
                non_match_features.append(features)
        
        if not match_features or not non_match_features:
            return
        
        # Calculate importance of each feature
        for key in self.weights:
            match_avg = sum(getattr(f, key, 0) for f in match_features) / len(match_features)
            non_match_avg = sum(getattr(f, key, 0) for f in non_match_features) / len(non_match_features)
            
            # Weight should be higher if there's more difference
            diff = abs(match_avg - non_match_avg)
            if diff > 0.1:
                self.weights[key] = min(0.5, self.weights[key] * (1 + diff))
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores"""
        total = sum(self.weights.values())
        return {k: v / total for k, v in self.weights.items()}
    
    @staticmethod
    def _normalize_invoice_number(inv_no: str) -> str:
        """Normalize invoice number"""
        if not inv_no:
            return ""
        # Remove special characters, keep alphanumeric
        return re.sub(r'[^0-9A-Za-z]', '', str(inv_no).upper())
    
    @staticmethod
    def _normalize_gstin(gstin: str) -> str:
        """Normalize GSTIN"""
        if not gstin:
            return ""
        return re.sub(r'[^0-9A-Z]', '', str(gstin).upper())
    
    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """Parse date string"""
        if not date_str:
            return None
        
        formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d%m%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(str(date_str), fmt)
            except ValueError:
                continue
        return None
    
    @staticmethod
    def _calculate_similarity(str1: str, str2: str) -> float:
        """Calculate similarity between two strings using multiple methods"""
        if not str1 and not str2:
            return 0.0
        if not str1 or not str2:
            return 0.0
        
        # Exact match
        if str1 == str2:
            return 1.0
        
        # Levenshtein-based similarity
        max_len = max(len(str1), len(str2))
        if max_len == 0:
            return 0.0
        
        # Simple edit distance
        len_diff = abs(len(str1) - len(str2))
        common_prefix = 0
        for c1, c2 in zip(str1, str2):
            if c1 == c2:
                common_prefix += 1
            else:
                break
        
        similarity = (common_prefix / max_len) * (1 - len_diff / max_len)
        return max(0.0, min(1.0, similarity))


class AnomalyDetector:
    """
    Anomaly detection for invoice reconciliation.
    
    Uses statistical methods to detect unusual patterns.
    """
    
    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.fitted = False
        self._feature_stats: Dict[str, Dict[str, float]] = {}
        self._thresholds: Dict[str, float] = {}
        
    def fit(self, invoices: List[Dict[str, Any]]):
        """
        Fit the anomaly detector on historical invoice data.
        
        Args:
            invoices: List of invoice records
        """
        if not invoices:
            return
        
        # Calculate statistics for each feature
        amounts = [float(inv.get("invoice_value", inv.get("txval", 0))) for inv in invoices]
        
        self._feature_stats = {
            "amount": {
                "mean": sum(amounts) / len(amounts) if amounts else 0,
                "std": self._calculate_std(amounts),
                "min": min(amounts) if amounts else 0,
                "max": max(amounts) if amounts else 0,
            }
        }
        
        # Calculate thresholds
        if amounts:
            mean = self._feature_stats["amount"]["mean"]
            std = self._feature_stats["amount"]["std"]
            self._thresholds["amount_zscore"] = 3.0  # 3 standard deviations
            self._thresholds["amount_iqr"] = 1.5  # IQR multiplier
        
        self.fitted = True
        logger.info(f"Anomaly detector fitted on {len(invoices)} invoices")
    
    def detect_anomalies(
        self, 
        invoices: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies in invoice data.
        
        Returns:
            List of invoices with anomaly scores
        """
        if not self.fitted:
            self.fit(invoices)
        
        results = []
        
        for invoice in invoices:
            amount = float(invoice.get("invoice_value", invoice.get("txval", 0)))
            anomaly_score = self._calculate_anomaly_score(amount)
            is_anomaly = anomaly_score > self._thresholds.get("amount_zscore", 3.0)
            
            result = {
                **invoice,
                "anomaly_score": round(anomaly_score, 3),
                "is_anomaly": is_anomaly,
                "anomaly_reasons": self._get_anomaly_reasons(invoice),
            }
            results.append(result)
        
        return results
    
    def _calculate_anomaly_score(self, amount: float) -> float:
        """Calculate anomaly score using z-score"""
        if not self._feature_stats:
            return 0.0
        
        stats = self._feature_stats.get("amount", {})
        mean = stats.get("mean", 0)
        std = stats.get("std", 0)
        
        if std == 0:
            return 0.0 if amount == mean else 1.0
        
        return abs((amount - mean) / std)
    
    def _get_anomaly_reasons(self, invoice: Dict[str, Any]) -> List[str]:
        """Get reasons for anomaly"""
        reasons = []
        amount = float(invoice.get("invoice_value", invoice.get("txval", 0)))
        
        stats = self._feature_stats.get("amount", {})
        
        if amount < stats.get("min", 0) * 0.5:
            reasons.append("Unusually low amount")
        if amount > stats.get("max", 0) * 2:
            reasons.append("Unusually high amount")
        
        # Check for unusual patterns in invoice number
        inv_no = invoice.get("invoice_number", "")
        if len(inv_no) > 20:
            reasons.append("Unusually long invoice number")
        
        # Check for round amounts (potential fraud indicator)
        if amount > 10000 and amount == round(amount):
            reasons.append("Suspicious round amount")
        
        return reasons
    
    @staticmethod
    def _calculate_std(values: List[float]) -> float:
        """Calculate standard deviation"""
        if not values:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return variance ** 0.5
