"""
Reconciliation Rules Module

Defines business rules for invoice reconciliation including special handling
for amendments, credit notes, reverse charge, and import of services.
"""

from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class RuleType(Enum):
    """Types of reconciliation rules"""
    MATCHING = "matching"
    VALIDATION = "validation"
    FILTERING = "filtering"
    ENRICHMENT = "enrichment"
    ANOMALY = "anomaly"


class RulePriority(Enum):
    """Rule priority levels"""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


@dataclass
class Rule:
    """Reconciliation rule definition"""
    id: str
    name: str
    description: str
    rule_type: RuleType
    priority: RulePriority
    enabled: bool = True
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    actions: List[Dict[str, Any]] = field(default_factory=list)
    apply_on: str = "match"  # match, validate, filter, enrich


@dataclass
class RuleResult:
    """Result of applying a rule"""
    rule_id: str
    rule_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


class ReconciliationRules:
    """
    Reconciliation rules engine.
    
    Handles business rules for:
    - Same invoice appearing in multiple periods (amendments)
    - Credit/Debit notes matching
    - Reverse charge invoices
    - Import of services
    - ISD invoices
    """
    
    def __init__(self):
        self.rules = self._load_default_rules()
        self.custom_rules: List[Rule] = []
        
    def _load_default_rules(self) -> Dict[str, Rule]:
        """Load default reconciliation rules"""
        
        rules = {}
        
        # Rule 1: Amendment matching
        rules["AMENDMENT_MATCH"] = Rule(
            id="AMENDMENT_MATCH",
            name="Amendment Invoice Matching",
            description="Match amended invoices with original invoices across periods",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.HIGH,
            conditions=[
                {"field": "is_amendment", "operator": "equals", "value": True},
            ],
            actions=[
                {"action": "link_to_original", "field": "original_invoice_number"},
            ]
        )
        
        # Rule 2: Credit note matching
        rules["CREDIT_NOTE_MATCH"] = Rule(
            id="CREDIT_NOTE_MATCH",
            name="Credit/Debit Note Matching",
            description="Match credit/debit notes with original invoices",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.HIGH,
            conditions=[
                {"field": "invoice_type", "operator": "in", "value": ["Credit Note", "Debit Note", "cn", "dn"]},
            ],
            actions=[
                {"action": "link_to_original", "field": "related_invoice_number"},
            ]
        )
        
        # Rule 3: Reverse charge handling
        rules["REVERSE_CHARGE"] = Rule(
            id="REVERSE_CHARGE",
            name="Reverse Charge Invoice Handling",
            description="Handle reverse charge invoices with special matching rules",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.MEDIUM,
            conditions=[
                {"field": "reverse_charge", "operator": "equals", "value": "Y"},
            ],
            actions=[
                {"action": "set_category", "value": "reverse_charge"},
            ]
        )
        
        # Rule 4: Import of services
        rules["IMPORT_SERVICES"] = Rule(
            id="IMPORT_SERVICES",
            name="Import of Services Matching",
            description="Handle import of services invoices differently",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.MEDIUM,
            conditions=[
                {"field": "place_of_supply", "operator": "equals", "value": "99"},
            ],
            actions=[
                {"action": "set_category", "value": "import_services"},
            ]
        )
        
        # Rule 5: ISD invoice matching
        rules["ISD_INVOICE"] = Rule(
            id="ISD_INVOICE",
            name="ISD Invoice Matching",
            description="Handle Input Service Distributor invoices",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.MEDIUM,
            conditions=[
                {"field": "invoice_type", "operator": "equals", "value": "ISD"},
            ],
            actions=[
                {"action": "set_category", "value": "isd_invoice"},
            ]
        )
        
        # Rule 6: High value invoice validation
        rules["HIGH_VALUE_VALIDATION"] = Rule(
            id="HIGH_VALUE_VALIDATION",
            name="High Value Invoice Validation",
            description="Flag high-value invoices for additional review",
            rule_type=RuleType.VALIDATION,
            priority=RulePriority.MEDIUM,
            conditions=[
                {"field": "invoice_value", "operator": "greater_than", "value": 1000000},
            ],
            actions=[
                {"action": "flag_for_review", "reason": "High value invoice"},
            ]
        )
        
        # Rule 7: Round amount anomaly
        rules["ROUND_AMOUNT_ANOMALY"] = Rule(
            id="ROUND_AMOUNT_ANOMALY",
            name="Round Amount Anomaly Detection",
            description="Detect suspicious round amounts",
            rule_type=RuleType.ANOMALY,
            priority=RulePriority.LOW,
            conditions=[
                {"field": "invoice_value", "operator": "is_round", "value": True},
                {"field": "invoice_value", "operator": "greater_than", "value": 10000},
            ],
            actions=[
                {"action": "flag_anomaly", "reason": "Suspicious round amount"},
            ]
        )
        
        # Rule 8: Same-day invoice pattern
        rules["SAME_DAY_PATTERN"] = Rule(
            id="SAME_DAY_PATTERN",
            name="Same-Day Multiple Invoices",
            description="Detect unusual same-day invoices from same supplier",
            rule_type=RuleType.ANOMALY,
            priority=RulePriority.LOW,
            conditions=[
                {"field": "same_day_count", "operator": "greater_than", "value": 10},
            ],
            actions=[
                {"action": "flag_anomaly", "reason": "Unusual number of same-day invoices"},
            ]
        )
        
        # Rule 9: GSTIN format validation
        rules["GSTIN_FORMAT"] = Rule(
            id="GSTIN_FORMAT",
            name="GSTIN Format Validation",
            description="Validate GSTIN format",
            rule_type=RuleType.VALIDATION,
            priority=RulePriority.HIGH,
            conditions=[
                {"field": "supplier_gstin", "operator": "is_valid_gstin", "value": True},
            ],
            actions=[
                {"action": "validate_format"},
            ]
        )
        
        # Rule 10: Invoice number pattern
        rules["INVOICE_PATTERN"] = Rule(
            id="INVOICE_PATTERN",
            name="Invoice Number Pattern Matching",
            description="Validate invoice number against supplier pattern",
            rule_type=RuleType.MATCHING,
            priority=RulePriority.LOW,
            conditions=[
                {"field": "invoice_number", "operator": "matches_pattern", "value": True},
            ],
            actions=[
                {"action": "set_confidence_boost", "value": 0.1},
            ]
        )
        
        return rules
    
    def apply_rules(
        self,
        invoices: List[Dict[str, Any]],
        rule_type: RuleType,
        context: Optional[Dict[str, Any]] = None
    ) -> List[RuleResult]:
        """Apply rules to invoices"""
        
        results = []
        
        for invoice in invoices:
            for rule in self.rules.values():
                if not rule.enabled or rule.rule_type != rule_type:
                    continue
                
                if self._check_conditions(rule.conditions, invoice, context):
                    result = self._apply_rule(rule, invoice)
                    results.append(result)
        
        return results
    
    def _check_conditions(
        self,
        conditions: List[Dict[str, Any]],
        invoice: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> bool:
        """Check if conditions are met"""
        
        for condition in conditions:
            field = condition.get("field")
            operator = condition.get("operator")
            expected_value = condition.get("value")
            
            actual_value = invoice.get(field)
            
            if operator == "equals":
                if actual_value != expected_value:
                    return False
            elif operator == "in":
                if actual_value not in expected_value:
                    return False
            elif operator == "greater_than":
                if not (actual_value and float(actual_value) > float(expected_value)):
                    return False
            elif operator == "less_than":
                if not (actual_value and float(actual_value) < float(expected_value)):
                    return False
            elif operator == "is_round":
                if actual_value and float(actual_value) != int(float(actual_value)):
                    return False
        
        return True
    
    def _apply_rule(self, rule: Rule, invoice: Dict[str, Any]) -> RuleResult:
        """Apply a single rule to an invoice"""
        
        passed = True
        message = f"Rule {rule.name} applied"
        details = {}
        
        for action in rule.actions:
            action_type = action.get("action")
            
            if action_type == "flag_for_review":
                invoice["requires_review"] = True
                invoice["review_reason"] = action.get("reason")
                details["flagged"] = True
                
            elif action_type == "flag_anomaly":
                invoice["is_anomaly"] = True
                invoice["anomaly_reasons"] = invoice.get("anomaly_reasons", [])
                invoice["anomaly_reasons"].append(action.get("reason"))
                details["anomaly_flagged"] = True
                
            elif action_type == "set_category":
                invoice["category"] = action.get("value")
                details["category_set"] = action.get("value")
                
            elif action_type == "link_to_original":
                details["linked"] = True
                
            elif action_type == "set_confidence_boost":
                current_boost = invoice.get("confidence_boost", 0)
                invoice["confidence_boost"] = current_boost + action.get("value", 0)
                details["boost_applied"] = action.get("value")
        
        return RuleResult(
            rule_id=rule.id,
            rule_name=rule.name,
            passed=passed,
            message=message,
            details=details,
        )
    
    def add_custom_rule(self, rule: Rule):
        """Add a custom rule"""
        self.custom_rules.append(rule)
        logger.info(f"Custom rule added: {rule.id}")
    
    def remove_custom_rule(self, rule_id: str):
        """Remove a custom rule"""
        self.custom_rules = [r for r in self.custom_rules if r.id != rule_id]
        logger.info(f"Custom rule removed: {rule_id}")
    
    def get_rule(self, rule_id: str) -> Optional[Rule]:
        """Get a specific rule"""
        return self.rules.get(rule_id)
    
    def get_rules_by_type(self, rule_type: RuleType) -> List[Rule]:
        """Get all rules of a specific type"""
        return [r for r in self.rules.values() if r.rule_type == rule_type]
    
    def enable_rule(self, rule_id: str):
        """Enable a rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True
            logger.info(f"Rule enabled: {rule_id}")
    
    def disable_rule(self, rule_id: str):
        """Disable a rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False
            logger.info(f"Rule disabled: {rule_id}")
    
    def get_all_rules(self) -> List[Dict[str, Any]]:
        """Get all rules as dictionaries"""
        rules_list = []
        for rule in list(self.rules.values()) + self.custom_rules:
            rules_list.append({
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "type": rule.rule_type.value,
                "priority": rule.priority.value,
                "enabled": rule.enabled,
                "apply_on": rule.apply_on,
            })
        return rules_list


# Global rules instance
_reconciliation_rules = None

def get_reconciliation_rules() -> ReconciliationRules:
    """Get the global reconciliation rules instance"""
    global _reconciliation_rules
    if _reconciliation_rules is None:
        _reconciliation_rules = ReconciliationRules()
    return _reconciliation_rules
