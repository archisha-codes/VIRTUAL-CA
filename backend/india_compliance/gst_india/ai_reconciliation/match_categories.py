"""
Match Categories Module

Defines match categories with confidence levels for AI/ML reconciliation.
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


class MatchCategory(Enum):
    """Match categories with confidence levels"""
    EXACT_MATCH = "exact_match"
    HIGH_PROBABILITY = "high_probability"
    MEDIUM_PROBABILITY = "medium_probability"
    LOW_PROBABILITY = "low_probability"
    GSTIN_MATCH_ONLY = "gstin_match_only"
    AMOUNT_MATCH_ONLY = "amount_match_only"
    PARTIAL_MATCH = "partial_match"
    REVERSE_MATCH = "reverse_match"
    CREDIT_NOTE_MATCH = "credit_note_match"
    NO_MATCH = "no_match"
    ANOMALY = "anomaly"


@dataclass
class MatchCategoryConfig:
    """Configuration for a match category"""
    category: MatchCategory
    min_confidence: float
    max_confidence: float
    requires_review: bool
    eligible_for_itc: bool
    description: str
    color: str
    priority: int


# Category configurations
MATCH_CATEGORY_CONFIGS: Dict[MatchCategory, MatchCategoryConfig] = {
    MatchCategory.EXACT_MATCH: MatchCategoryConfig(
        category=MatchCategory.EXACT_MATCH,
        min_confidence=1.0,
        max_confidence=1.0,
        requires_review=False,
        eligible_for_itc=True,
        description="All fields match exactly - GSTIN, Invoice Number, Amount, Date",
        color="#22c55e",  # green
        priority=1
    ),
    MatchCategory.HIGH_PROBABILITY: MatchCategoryConfig(
        category=MatchCategory.HIGH_PROBABILITY,
        min_confidence=0.90,
        max_confidence=0.99,
        requires_review=False,
        eligible_for_itc=True,
        description="Very likely match - minor differences in non-critical fields",
        color="#3b82f6",  # blue
        priority=2
    ),
    MatchCategory.MEDIUM_PROBABILITY: MatchCategoryConfig(
        category=MatchCategory.MEDIUM_PROBABILITY,
        min_confidence=0.70,
        max_confidence=0.89,
        requires_review=True,
        eligible_for_itc=True,
        description="Probable match - some discrepancies that need verification",
        color="#f59e0b",  # amber
        priority=3
    ),
    MatchCategory.LOW_PROBABILITY: MatchCategoryConfig(
        category=MatchCategory.LOW_PROBABILITY,
        min_confidence=0.50,
        max_confidence=0.69,
        requires_review=True,
        eligible_for_itc=False,
        description="Possible match - needs manual review before ITC claim",
        color="#f97316",  # orange
        priority=4
    ),
    MatchCategory.GSTIN_MATCH_ONLY: MatchCategoryConfig(
        category=MatchCategory.GSTIN_MATCH_ONLY,
        min_confidence=0.30,
        max_confidence=0.49,
        requires_review=True,
        eligible_for_itc=False,
        description="Same GSTIN but different invoice number",
        color="#eab308",  # yellow
        priority=5
    ),
    MatchCategory.AMOUNT_MATCH_ONLY: MatchCategoryConfig(
        category=MatchCategory.AMOUNT_MATCH_ONLY,
        min_confidence=0.20,
        max_confidence=0.39,
        requires_review=True,
        eligible_for_itc=False,
        description="Same amount but different GSTIN - possible supplier mismatch",
        color="#a855f7",  # purple
        priority=6
    ),
    MatchCategory.PARTIAL_MATCH: MatchCategoryConfig(
        category=MatchCategory.PARTIAL_MATCH,
        min_confidence=0.40,
        max_confidence=0.60,
        requires_review=True,
        eligible_for_itc=True,
        description="Partial match - split invoice or consolidated shipment",
        color="#14b8a6",  # teal
        priority=7
    ),
    MatchCategory.REVERSE_MATCH: MatchCategoryConfig(
        category=MatchCategory.REVERSE_MATCH,
        min_confidence=0.60,
        max_confidence=0.80,
        requires_review=True,
        eligible_for_itc=True,
        description="Reverse match - invoice appears in GSTR-2B but not in local data",
        color="#06b6d4",  # cyan
        priority=8
    ),
    MatchCategory.CREDIT_NOTE_MATCH: MatchCategoryConfig(
        category=MatchCategory.CREDIT_NOTE_MATCH,
        min_confidence=0.75,
        max_confidence=1.0,
        requires_review=False,
        eligible_for_itc=True,
        description="Credit/Debit note matches with original invoice",
        color="#8b5cf6",  # violet
        priority=9
    ),
    MatchCategory.NO_MATCH: MatchCategoryConfig(
        category=MatchCategory.NO_MATCH,
        min_confidence=0.0,
        max_confidence=0.19,
        requires_review=True,
        eligible_for_itc=False,
        description="No matching invoice found",
        color="#ef4444",  # red
        priority=10
    ),
    MatchCategory.ANOMALY: MatchCategoryConfig(
        category=MatchCategory.ANOMALY,
        min_confidence=0.0,
        max_confidence=1.0,
        requires_review=True,
        eligible_for_itc=False,
        description="Unusual pattern detected - potential fraud or error",
        color="#dc2626",  # dark red
        priority=0
    ),
}


def get_match_category(confidence: float) -> MatchCategory:
    """Get the match category based on confidence score"""
    for config in sorted(MATCH_CATEGORY_CONFIGS.values(), key=lambda x: x.priority):
        if config.min_confidence <= confidence <= config.max_confidence:
            return config.category
    return MatchCategory.NO_MATCH


def get_category_config(category: MatchCategory) -> MatchCategoryConfig:
    """Get configuration for a specific category"""
    return MATCH_CATEGORY_CONFIGS.get(category)


def get_all_categories() -> List[MatchCategory]:
    """Get all match categories"""
    return list(MatchCategory)


def get_review_required_categories() -> List[MatchCategory]:
    """Get categories that require manual review"""
    return [
        cat for cat, config in MATCH_CATEGORY_CONFIGS.items() 
        if config.requires_review
    ]


def get_itc_eligible_categories() -> List[MatchCategory]:
    """Get categories eligible for ITC"""
    return [
        cat for cat, config in MATCH_CATEGORY_CONFIGS.items() 
        if config.eligible_for_itc
    ]


def format_match_result(
    invoice_pair: Dict[str, Any],
    confidence: float,
    match_type: MatchCategory,
    explanation: str
) -> Dict[str, Any]:
    """Format a match result with all details"""
    config = get_category_config(match_type)
    
    return {
        "sales_invoice": invoice_pair.get("sales_invoice", {}),
        "purchase_invoice": invoice_pair.get("purchase_invoice", {}),
        "confidence": round(confidence * 100, 2),
        "confidence_display": f"{confidence * 100:.0f}%",
        "category": match_type.value,
        "category_display": _format_category_display(match_type),
        "requires_review": config.requires_review if config else True,
        "eligible_for_itc": config.eligible_for_itc if config else False,
        "explanation": explanation,
        "color": config.color if config else "#94a3b8",
        "match_factors": invoice_pair.get("match_factors", {}),
        "discrepancies": invoice_pair.get("discrepancies", []),
    }


def _format_category_display(category: MatchCategory) -> str:
    """Format category for display"""
    return category.value.replace("_", " ").title()
