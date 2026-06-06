"""
Reporting Module for AI/ML Reconciliation

This module provides comprehensive reporting for reconciliation results,
including match rate analytics, category breakdown, and trend analysis.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class ReconciliationReport:
    """Comprehensive reconciliation report"""
    report_id: str
    gstin: str
    return_period: str
    generated_at: datetime
    summary: Dict[str, Any] = field(default_factory=dict)
    match_categories: Dict[str, Any] = field(default_factory=dict)
    confidence_distribution: Dict[str, int] = field(default_factory=dict)
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    trends: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class MatchRateAnalytics:
    """Match rate analytics"""
    total_invoices: int = 0
    matched_invoices: int = 0
    unmatched_invoices: int = 0
    match_rate: float = 0.0
    exact_match_rate: float = 0.0
    fuzzy_match_rate: float = 0.0
    ml_match_rate: float = 0.0
    itc_claimed: float = 0.0
    itc_pending: float = 0.0


class ReconciliationReporter:
    """
    Reporter for reconciliation results and analytics.
    """
    
    def __init__(self):
        self.historical_data: List[Dict[str, Any]] = []
        
    def generate_report(
        self,
        reconciliation_result: Dict[str, Any],
        gstin: str,
        return_period: str
    ) -> ReconciliationReport:
        """Generate comprehensive reconciliation report"""
        
        report_id = self._generate_report_id()
        
        # Extract data from result
        matches = reconciliation_result.get("matches", [])
        unmatched_sales = reconciliation_result.get("unmatched_sales", [])
        unmatched_purchases = reconciliation_result.get("unmatched_purchases", [])
        anomalies = reconciliation_result.get("anomalies", [])
        statistics = reconciliation_result.get("statistics", {})
        
        # Build report
        report = ReconciliationReport(
            report_id=report_id,
            gstin=gstin,
            return_period=return_period,
            generated_at=datetime.now(),
            summary=self._generate_summary(
                matches, unmatched_sales, unmatched_purchases, statistics
            ),
            match_categories=self._generate_category_breakdown(matches),
            confidence_distribution=self._generate_confidence_distribution(matches),
            anomalies=anomalies,
            trends=self._generate_trends(),
            recommendations=self._generate_recommendations(
                matches, unmatched_sales, anomalies, statistics
            ),
        )
        
        # Store for historical analysis
        self._store_result(reconciliation_result, gstin, return_period)
        
        return report
    
    def _generate_summary(
        self,
        matches: List[Dict[str, Any]],
        unmatched_sales: List[Dict[str, Any]],
        unmatched_purchases: List[Dict[str, Any]],
        statistics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate summary section"""
        
        total_sales = len(matches) + len(unmatched_sales)
        total_purchases = len(matches) + len(unmatched_purchases)
        
        # Calculate amounts
        matched_amount = sum(
            m.get("purchase_invoice", {}).get("invoice_value", 0)
            for m in matches
        )
        unmatched_amount = sum(
            inv.get("invoice_value", 0) for inv in unmatched_sales
        )
        
        # Calculate ITC
        itc_claimed = 0
        itc_pending = 0
        
        for match in matches:
            if match.get("eligible_for_itc", False):
                itc_claimed += match.get("purchase_invoice", {}).get("invoice_value", 0) * 0.18
            else:
                itc_pending += match.get("purchase_invoice", {}).get("invoice_value", 0) * 0.18
        
        return {
            "total_sales_invoices": total_sales,
            "total_purchase_invoices": total_purchases,
            "matched_invoices": len(matches),
            "unmatched_sales": len(unmatched_sales),
            "unmatched_purchases": len(unmatched_purchases),
            "match_rate": round(len(matches) / max(total_sales, 1) * 100, 2),
            "matched_amount": round(matched_amount, 2),
            "unmatched_amount": round(unmatched_amount, 2),
            "itc_claimed": round(itc_claimed, 2),
            "itc_pending": round(itc_pending, 2),
            "total_anomalies": len(statistics.get("anomalies_count", 0)),
        }
    
    def _generate_category_breakdown(
        self,
        matches: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate category breakdown"""
        
        categories = defaultdict(lambda: {"count": 0, "amount": 0.0})
        
        for match in matches:
            category = match.get("category", "unknown")
            amount = match.get("purchase_invoice", {}).get("invoice_value", 0)
            
            categories[category]["count"] += 1
            categories[category]["amount"] += amount
        
        # Convert to regular dict
        breakdown = {}
        for cat, data in categories.items():
            breakdown[cat] = {
                "count": data["count"],
                "amount": round(data["amount"], 2),
                "percentage": round(data["count"] / max(len(matches), 1) * 100, 2),
            }
        
        return breakdown
    
    def _generate_confidence_distribution(
        self,
        matches: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """Generate confidence score distribution"""
        
        distribution = {
            "90-100%": 0,
            "70-89%": 0,
            "50-69%": 0,
            "below_50%": 0,
        }
        
        for match in matches:
            conf = match.get("confidence", 0)
            
            if conf >= 90:
                distribution["90-100%"] += 1
            elif conf >= 70:
                distribution["70-89%"] += 1
            elif conf >= 50:
                distribution["50-69%"] += 1
            else:
                distribution["below_50%"] += 1
        
        return distribution
    
    def _generate_trends(self) -> Dict[str, Any]:
        """Generate trend analysis"""
        
        if len(self.historical_data) < 2:
            return {
                "trend": "insufficient_data",
                "message": "Need more data for trend analysis",
            }
        
        # Calculate trend
        recent_match_rates = [
            d.get("match_rate", 0) for d in self.historical_data[-3:]
        ]
        
        if len(recent_match_rates) >= 2:
            if recent_match_rates[-1] > recent_match_rates[-2]:
                trend = "improving"
                message = "Match rate is improving"
            elif recent_match_rates[-1] < recent_match_rates[-2]:
                trend = "declining"
                message = "Match rate is declining"
            else:
                trend = "stable"
                message = "Match rate is stable"
        else:
            trend = "unknown"
            message = "Cannot determine trend"
        
        return {
            "trend": trend,
            "message": message,
            "recent_rates": recent_match_rates,
            "average_rate": round(sum(recent_match_rates) / len(recent_match_rates), 2) if recent_match_rates else 0,
        }
    
    def _generate_recommendations(
        self,
        matches: List[Dict[str, Any]],
        unmatched_sales: List[Dict[str, Any]],
        anomalies: List[Dict[str, Any]],
        statistics: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on analysis"""
        
        recommendations = []
        
        # Check match rate
        match_rate = statistics.get("match_rate", 0)
        if match_rate < 70:
            recommendations.append(
                "Low match rate detected. Consider reviewing data quality or adjusting matching thresholds."
            )
        elif match_rate >= 90:
            recommendations.append(
                "Excellent match rate achieved. Consider reducing manual review requirements."
            )
        
        # Check high confidence matches
        high_conf = sum(1 for m in matches if m.get("confidence", 0) >= 90)
        if high_conf > 0:
            recommendations.append(
                f"{high_conf} high-confidence matches can be auto-processed without review."
            )
        
        # Check low confidence matches
        low_conf = sum(1 for m in matches if m.get("confidence", 0) < 50)
        if low_conf > 5:
            recommendations.append(
                f"{low_conf} low-confidence matches require manual review."
            )
        
        # Check anomalies
        if len(anomalies) > 0:
            recommendations.append(
                f"{len(anomalies)} anomalies detected. Review flagged invoices for potential issues."
            )
        
        # Check unmatched invoices
        if len(unmatched_sales) > 10:
            recommendations.append(
                f"{len(unmatched_sales)} invoices could not be matched. "
                "Consider supplier data quality or amendment handling."
            )
        
        return recommendations
    
    def get_match_rate_analytics(
        self,
        gstin: Optional[str] = None,
        from_period: Optional[str] = None,
        to_period: Optional[str] = None
    ) -> MatchRateAnalytics:
        """Get match rate analytics"""
        
        # Filter historical data
        data = self.historical_data
        
        if gstin:
            data = [d for d in data if d.get("gstin") == gstin]
        
        if from_period:
            data = [d for d in data if d.get("return_period", "") >= from_period]
        
        if to_period:
            data = [d for d in data if d.get("return_period", "") <= to_period]
        
        if not data:
            return MatchRateAnalytics()
        
        # Calculate analytics
        total_invoices = sum(d.get("total_invoices", 0) for d in data)
        matched = sum(d.get("matched", 0) for d in data)
        
        analytics = MatchRateAnalytics(
            total_invoices=total_invoices,
            matched_invoices=matched,
            unmatched_invoices=total_invoices - matched,
            match_rate=round(matched / max(total_invoices, 1) * 100, 2),
        )
        
        # Category rates
        exact = sum(d.get("exact_matches", 0) for d in data)
        fuzzy = sum(d.get("fuzzy_matches", 0) for d in data)
        ml = sum(d.get("ml_matches", 0) for d in data)
        
        analytics.exact_match_rate = round(exact / max(total_invoices, 1) * 100, 2)
        analytics.fuzzy_match_rate = round(fuzzy / max(total_invoices, 1) * 100, 2)
        analytics.ml_match_rate = round(ml / max(total_invoices, 1) * 100, 2)
        
        return analytics
    
    def get_period_comparison(
        self,
        periods: List[str],
        gstin: Optional[str] = None
    ) -> Dict[str, Any]:
        """Compare reconciliation results across periods"""
        
        results = []
        
        for period in periods:
            period_data = [
                d for d in self.historical_data
                if d.get("return_period") == period
                and (not gstin or d.get("gstin") == gstin)
            ]
            
            if period_data:
                results.append({
                    "period": period,
                    "match_rate": sum(d.get("match_rate", 0) for d in period_data) / len(period_data),
                    "total_matches": sum(d.get("matched", 0) for d in period_data),
                    "anomalies": sum(d.get("anomalies", 0) for d in period_data),
                })
        
        return {
            "periods": periods,
            "comparison": results,
        }
    
    def get_supplier_analysis(
        self,
        gstin: str,
        return_period: str
    ) -> Dict[str, Any]:
        """Get supplier-wise reconciliation analysis"""
        
        # This would analyze matches by supplier
        return {
            "suppliers": [],
            "total_suppliers": 0,
            "match_rates_by_supplier": {},
        }
    
    def export_report(
        self,
        report: ReconciliationReport,
        format: str = "json"
    ) -> Dict[str, Any]:
        """Export report in specified format"""
        
        if format == "json":
            return {
                "report_id": report.report_id,
                "gstin": report.gstin,
                "return_period": report.return_period,
                "generated_at": report.generated_at.isoformat(),
                "summary": report.summary,
                "match_categories": report.match_categories,
                "confidence_distribution": report.confidence_distribution,
                "anomalies": report.anomalies,
                "trends": report.trends,
                "recommendations": report.recommendations,
            }
        
        elif format == "csv":
            # Generate CSV content
            lines = ["Category,Count,Amount,Percentage"]
            
            for cat, data in report.match_categories.items():
                lines.append(f"{cat},{data['count']},{data['amount']},{data['percentage']}")
            
            return {"content": "\n".join(lines), "content_type": "text/csv"}
        
        return {"error": f"Unsupported format: {format}"}
    
    def _store_result(
        self,
        result: Dict[str, Any],
        gstin: str,
        return_period: str
    ):
        """Store result for historical analysis"""
        
        # Keep last 100 results
        if len(self.historical_data) >= 100:
            self.historical_data = self.historical_data[-99:]
        
        self.historical_data.append({
            "gstin": gstin,
            "return_period": return_period,
            "match_rate": result.get("statistics", {}).get("match_rate", 0),
            "total_invoices": result.get("total_sales_invoices", 0),
            "matched": len(result.get("matches", [])),
            "exact_matches": result.get("statistics", {}).get("exact_matches", 0),
            "fuzzy_matches": result.get("statistics", {}).get("high_probability", 0),
            "ml_matches": result.get("statistics", {}).get("medium_probability", 0),
            "anomalies": len(result.get("anomalies", [])),
            "timestamp": datetime.now().isoformat(),
        })
    
    @staticmethod
    def _generate_report_id() -> str:
        """Generate unique report ID"""
        import uuid
        return f"REPORT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}"


# Global reporter instance
_reconciliation_reporter = None

def get_reconciliation_reporter() -> ReconciliationReporter:
    """Get the global reconciliation reporter instance"""
    global _reconciliation_reporter
    if _reconciliation_reporter is None:
        _reconciliation_reporter = ReconciliationReporter()
    return _reconciliation_reporter
