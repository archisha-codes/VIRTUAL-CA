"""
Learning System for AI/ML Reconciliation

This module provides continuous learning capabilities by storing user corrections
and updating matching weights based on feedback.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class UserCorrection:
    """User correction for a match"""
    id: str
    match_id: str
    original_match: Dict[str, Any]
    user_decision: str  # confirm, reject, link, split
    linked_invoices: List[Dict[str, Any]] = field(default_factory=list)
    notes: str = ""
    user_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class LearningMetrics:
    """Learning system metrics"""
    total_corrections: int = 0
    confirmations: int = 0
    rejections: int = 0
    manual_links: int = 0
    splits: int = 0
    accuracy_improvement: float = 0.0
    last_updated: datetime = field(default_factory=datetime.now)


class LearningSystem:
    """
    Learning system for continuous improvement of matching algorithms.
    
    Features:
    - Store user corrections
    - Update matching weights based on corrections
    - Feedback loop for model improvement
    - A/B testing support
    """
    
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir
        self.corrections: List[UserCorrection] = []
        self.metrics = LearningMetrics()
        self.weight_adjustments: Dict[str, float] = {}
        self._load_corrections()
        
    def learn_from_corrections(self, corrections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Learn from user corrections.
        
        Args:
            corrections: List of user corrections
            
        Returns:
            Learning results
        """
        new_corrections = 0
        
        for correction_data in corrections:
            correction = UserCorrection(
                id=self._generate_correction_id(),
                match_id=correction_data.get("match_id", ""),
                original_match=correction_data.get("original_match", {}),
                user_decision=correction_data.get("user_decision", ""),
                linked_invoices=correction_data.get("linked_invoices", []),
                notes=correction_data.get("notes", ""),
                user_id=correction_data.get("user_id", ""),
                timestamp=datetime.now(),
            )
            
            self.corrections.append(correction)
            new_corrections += 1
            
            # Update metrics
            self._update_metrics(correction)
            
            # Adjust weights
            self._adjust_weights(correction)
        
        # Save corrections
        self._save_corrections()
        
        logger.info(f"Learned from {new_corrections} corrections")
        
        return {
            "corrections_processed": new_corrections,
            "total_corrections": len(self.corrections),
            "metrics": self.get_metrics(),
        }
    
    def _update_metrics(self, correction: UserCorrection):
        """Update learning metrics"""
        self.metrics.total_corrections += 1
        
        if correction.user_decision == "confirm":
            self.metrics.confirmations += 1
        elif correction.user_decision == "reject":
            self.metrics.rejections += 1
        elif correction.user_decision == "link":
            self.metrics.manual_links += 1
        elif correction.user_decision == "split":
            self.metrics.splits += 1
        
        self.metrics.last_updated = datetime.now()
    
    def _adjust_weights(self, correction: UserCorrection):
        """Adjust matching weights based on correction"""
        
        original = correction.original_match
        
        if correction.user_decision == "reject":
            # The match was wrong - reduce weights for similar patterns
            if "factors" in original:
                for factor, score in original["factors"].items():
                    if score > 0.5:
                        # Reduce weight for this factor
                        current = self.weight_adjustments.get(factor, 0)
                        self.weight_adjustments[factor] = current - 0.05
                        
        elif correction.user_decision == "confirm":
            # The match was correct - increase weights
            if "factors" in original:
                for factor, score in original["factors"].items():
                    if score > 0.5:
                        current = self.weight_adjustments.get(factor, 0)
                        self.weight_adjustments[factor] = current + 0.02
        
        elif correction.user_decision == "link":
            # User linked different invoices - learn the new pattern
            if correction.linked_invoices:
                # Learn from manual links
                self._learn_from_manual_link(correction)
    
    def _learn_from_manual_link(self, correction: UserCorrection):
        """Learn from manual links"""
        linked = correction.linked_invoices
        if len(linked) >= 2:
            # Learn pattern between linked invoices
            logger.debug(f"Learning pattern from manual link: {correction.match_id}")
    
    def get_adjusted_weights(self, base_weights: Dict[str, float]) -> Dict[str, float]:
        """
        Get adjusted weights based on learning.
        
        Args:
            base_weights: Base weights from model
            
        Returns:
            Adjusted weights
        """
        adjusted = base_weights.copy()
        
        for factor, adjustment in self.weight_adjustments.items():
            if factor in adjusted:
                # Apply adjustment with limits
                adjusted[factor] = max(0.01, min(0.5, adjusted[factor] + adjustment))
        
        return adjusted
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get learning system metrics"""
        
        total = self.metrics.total_corrections
        if total == 0:
            return {
                "total_corrections": 0,
                "confirm_rate": 0,
                "reject_rate": 0,
                "accuracy_improvement": 0,
                "last_updated": None,
            }
        
        return {
            "total_corrections": total,
            "confirmations": self.metrics.confirmations,
            "rejections": self.metrics.rejections,
            "manual_links": self.metrics.manual_links,
            "splits": self.metrics.splits,
            "confirm_rate": round(self.metrics.confirmations / total * 100, 2),
            "reject_rate": round(self.metrics.rejections / total * 100, 2),
            "accuracy_improvement": round(self.metrics.accuracy_improvement * 100, 2),
            "weight_adjustments": self.weight_adjustments,
            "last_updated": self.metrics.last_updated.isoformat() if self.metrics.last_updated else None,
        }
    
    def get_corrections(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        decision_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get stored corrections with filters"""
        
        results = self.corrections
        
        if start_date:
            results = [c for c in results if c.timestamp >= start_date]
        if end_date:
            results = [c for c in results if c.timestamp <= end_date]
        if decision_type:
            results = [c for c in results if c.user_decision == decision_type]
        
        # Sort by timestamp descending
        results = sorted(results, key=lambda x: x.timestamp, reverse=True)
        
        # Convert to dict
        return [
            {
                "id": c.id,
                "match_id": c.match_id,
                "user_decision": c.user_decision,
                "notes": c.notes,
                "timestamp": c.timestamp.isoformat(),
            }
            for c in results[:limit]
        ]
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get learned patterns from corrections"""
        
        patterns = {
            "common_rejections": [],
            "common_links": [],
            "factor_importance": {},
        }
        
        # Analyze rejections
        rejection_patterns = defaultdict(int)
        for correction in self.corrections:
            if correction.user_decision == "reject":
                if "factors" in correction.original_match:
                    for factor in correction.original_match["factors"]:
                        rejection_patterns[factor] += 1
        
        patterns["common_rejections"] = dict(rejection_patterns)
        
        return patterns
    
    def train_on_corrections(
        self,
        model_weights: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Train model weights on corrections.
        
        Args:
            model_weights: Current model weights
            
        Returns:
            Updated weights
        """
        # Start with base weights
        updated_weights = model_weights.copy()
        
        # Apply learning adjustments
        updated_weights = self.get_adjusted_weights(updated_weights)
        
        # Add learned patterns
        patterns = self.get_patterns()
        
        # If invoice number is commonly rejected, reduce its weight
        if "invoice_number" in patterns["common_rejections"]:
            rejection_count = patterns["common_rejections"]["invoice_number"]
            if rejection_count > 5:
                updated_weights["invoice_number_similarity"] = max(
                    0.1, 
                    updated_weights.get("invoice_number_similarity", 0.3) - 0.05
                )
        
        # If GSTIN match is reliable, increase its weight
        confirm_rate = self.metrics.confirmations / max(self.metrics.total_corrections, 1)
        if confirm_rate > 0.8:
            updated_weights["gstin_match"] = min(
                0.4,
                updated_weights.get("gstin_match", 0.25) + 0.03
            )
        
        logger.info(f"Updated model weights based on {len(self.corrections)} corrections")
        
        return updated_weights
    
    def get_ab_test_variants(self) -> Dict[str, Dict[str, Any]]:
        """Get A/B test variants"""
        
        return {
            "control": {
                "name": "Control (Original)",
                "weight": 0.5,
                "description": "Original matching algorithm",
            },
            "variant_a": {
                "name": "Variant A (Learning-Enhanced)",
                "weight": 0.25,
                "description": "Uses learned weight adjustments",
            },
            "variant_b": {
                "name": "Variant B (ML-Heavy)",
                "weight": 0.25,
                "description": "More weight on ML predictions",
            },
        }
    
    def record_ab_test_result(
        self,
        variant: str,
        success: bool,
        match_id: str
    ):
        """Record A/B test result"""
        logger.debug(f"A/B test result: variant={variant}, success={success}, match_id={match_id}")
    
    def reset_learning(self):
        """Reset all learning data"""
        self.corrections = []
        self.metrics = LearningMetrics()
        self.weight_adjustments = {}
        logger.info("Learning system reset")
    
    def export_learning_data(self) -> Dict[str, Any]:
        """Export learning data for backup"""
        
        return {
            "corrections": [
                {
                    "id": c.id,
                    "match_id": c.match_id,
                    "user_decision": c.user_decision,
                    "timestamp": c.timestamp.isoformat(),
                }
                for c in self.corrections
            ],
            "metrics": self.get_metrics(),
            "weight_adjustments": self.weight_adjustments,
            "exported_at": datetime.now().isoformat(),
        }
    
    def _load_corrections(self):
        """Load corrections from storage"""
        if not self.data_dir:
            return
            
        corrections_file = Path(self.data_dir) / "corrections.json"
        if corrections_file.exists():
            try:
                with open(corrections_file, "r") as f:
                    data = json.load(f)
                    # Load corrections
                    self.corrections = [
                        UserCorrection(
                            id=c["id"],
                            match_id=c["match_id"],
                            original_match=c.get("original_match", {}),
                            user_decision=c["user_decision"],
                            linked_invoices=c.get("linked_invoices", []),
                            notes=c.get("notes", ""),
                            timestamp=datetime.fromisoformat(c["timestamp"])
                        )
                        for c in data.get("corrections", [])
                    ]
                    # Load metrics
                    self.metrics = LearningMetrics(
                        total_corrections=data.get("total_corrections", 0),
                    )
                    self.weight_adjustments = data.get("weight_adjustments", {})
                logger.info(f"Loaded {len(self.corrections)} corrections")
            except Exception as e:
                logger.error(f"Failed to load corrections: {e}")
    
    def _save_corrections(self):
        """Save corrections to storage"""
        if not self.data_dir:
            return
            
        corrections_file = Path(self.data_dir) / "corrections.json"
        
        try:
            with open(corrections_file, "w") as f:
                json.dump(self.export_learning_data(), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save corrections: {e}")
    
    @staticmethod
    def _generate_correction_id() -> str:
        """Generate unique correction ID"""
        import uuid
        return f"CORR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"


# Global learning system instance
_learning_system = None

def get_learning_system() -> LearningSystem:
    """Get the global learning system instance"""
    global _learning_system
    if _learning_system is None:
        _learning_system = LearningSystem()
    return _learning_system
