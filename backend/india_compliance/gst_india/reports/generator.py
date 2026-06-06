"""
GST India Reports Generator Engine

Advanced report generation engine with caching, async support,
and comprehensive data processing capabilities.
"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import uuid

from india_compliance.gst_india.reports import (
    ReportMetadata,
    ReportData,
    ReportParameter,
    ReportColumn,
    REPORT_REGISTRY,
    get_report_list,
    get_report_by_category,
    get_report_metadata,
    ReportCategory,
    FilingRecord,
    InvoiceSummary,
)

logger = logging.getLogger(__name__)


class CacheStrategy(str, Enum):
    """Cache strategies for reports"""
    NONE = "none"
    MEMORY = "memory"
    FILE = "file"
    DATABASE = "database"


@dataclass
class ReportGenerationJob:
    """Background job for async report generation"""
    job_id: str
    report_id: str
    parameters: Dict[str, Any]
    status: str = "pending"  # pending, running, completed, failed
    result: Optional[ReportData] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ReportCache:
    """In-memory cache for generated reports"""
    
    def __init__(self, ttl: int = 3600):
        self.ttl = ttl
        self._cache: Dict[str, tuple[ReportData, datetime]] = {}
    
    def _generate_key(self, report_id: str, parameters: Dict[str, Any]) -> str:
        """Generate cache key from report ID and parameters"""
        param_str = json.dumps(parameters, sort_keys=True)
        key_str = f"{report_id}:{param_str}"
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, report_id: str, parameters: Dict[str, Any]) -> Optional[ReportData]:
        """Get cached report if available and not expired"""
        key = self._generate_key(report_id, parameters)
        
        if key in self._cache:
            report_data, cached_at = self._cache[key]
            
            # Check if cache is still valid
            age = (datetime.now() - cached_at).total_seconds()
            if age < self.ttl:
                logger.info(f"Cache hit for report {report_id}")
                return report_data
            else:
                del self._cache[key]
        
        return None
    
    def set(self, report_id: str, parameters: Dict[str, Any], report_data: ReportData):
        """Cache a generated report"""
        key = self._generate_key(report_id, parameters)
        self._cache[key] = (report_data, datetime.now())
        logger.info(f"Cached report {report_id}")
    
    def invalidate(self, report_id: Optional[str] = None):
        """Invalidate cache for specific report or all"""
        if report_id:
            keys_to_remove = [
                k for k in self._cache.keys() 
                if k.startswith(hashlib.md5(report_id.encode()).hexdigest()[:8])
            ]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_entries = len(self._cache)
        expired_entries = 0
        
        for _, cached_at in self._cache.values():
            age = (datetime.now() - cached_at).total_seconds()
            if age >= self.ttl:
                expired_entries += 1
        
        return {
            "total_entries": total_entries,
            "active_entries": total_entries - expired_entries,
            "expired_entries": expired_entries,
            "ttl_seconds": self.ttl
        }


class ReportScheduler:
    """Scheduler for automated report generation"""
    
    def __init__(self):
        self._scheduled_jobs: Dict[str, Dict[str, Any]] = {}
    
    def schedule_report(
        self,
        schedule_id: str,
        report_id: str,
        parameters: Dict[str, Any],
        frequency: str,  # daily, weekly, monthly
        time: str = "00:00",
        recipients: List[str] = None,
        format: str = "pdf"
    ):
        """Schedule a report to run automatically"""
        self._scheduled_jobs[schedule_id] = {
            "report_id": report_id,
            "parameters": parameters,
            "frequency": frequency,
            "time": time,
            "recipients": recipients or [],
            "format": format,
            "enabled": True,
            "last_run": None,
            "next_run": self._calculate_next_run(frequency, time)
        }
        logger.info(f"Scheduled report {report_id} with frequency {frequency}")
    
    def _calculate_next_run(self, frequency: str, time: str) -> datetime:
        """Calculate next run time based on frequency"""
        now = datetime.now()
        hour, minute = map(int, time.split(':'))
        
        if frequency == "daily":
            next_run = now.replace(hour=hour, minute=minute, second=0)
            if next_run <= now:
                next_run += timedelta(days=1)
        elif frequency == "weekly":
            next_run = now.replace(hour=hour, minute=minute, second=0)
            if next_run <= now:
                next_run += timedelta(days=7)
        elif frequency == "monthly":
            next_run = now.replace(hour=hour, minute=minute, second=0)
            if next_run <= now:
                # Add one month
                if next_run.month == 12:
                    next_run = next_run.replace(year=next_run.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=next_run.month + 1)
        else:
            next_run = now + timedelta(days=1)
        
        return next_run
    
    def get_scheduled_reports(self) -> List[Dict[str, Any]]:
        """Get all scheduled reports"""
        return [
            {"schedule_id": k, **v} 
            for k, v in self._scheduled_jobs.items()
        ]
    
    def delete_schedule(self, schedule_id: str):
        """Delete a scheduled report"""
        if schedule_id in self._scheduled_jobs:
            del self._scheduled_jobs[schedule_id]


class ReportComparisonEngine:
    """Engine for comparing report data across periods"""
    
    def compare_periods(
        self,
        report_id: str,
        parameters: Dict[str, Any],
        periods: List[str]
    ) -> Dict[str, Any]:
        """Compare report data across multiple periods"""
        from india_compliance.gst_india.reports import generate_report
        
        results = {}
        
        for period in periods:
            params = {**parameters, "return_period": period}
            try:
                report_data = generate_report(report_id, params)
                results[period] = {
                    "data": report_data.data,
                    "summary": report_data.summary
                }
            except Exception as e:
                logger.error(f"Error generating report for period {period}: {e}")
                results[period] = {"error": str(e)}
        
        # Calculate comparisons
        comparisons = self._calculate_comparisons(results)
        
        return {
            "periods": periods,
            "results": results,
            "comparisons": comparisons
        }
    
    def _calculate_comparisons(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate period-over-period comparisons"""
        comparisons = {}
        periods = sorted(results.keys())
        
        if len(periods) < 2:
            return comparisons
        
        for i in range(1, len(periods)):
            current_period = periods[i]
            previous_period = periods[i - 1]
            
            if "error" in results[current_period] or "error" in results[previous_period]:
                continue
            
            # Get summary values
            current_summary = results[current_period].get("summary", {})
            previous_summary = results[previous_period].get("summary", {})
            
            # Calculate growth rates
            for key in current_summary:
                if isinstance(current_summary[key], (int, float)) and key in previous_summary:
                    current_val = current_summary[key]
                    previous_val = previous_summary[key]
                    
                    if previous_val != 0:
                        growth = ((current_val - previous_val) / previous_val) * 100
                    else:
                        growth = 0
                    
                    comparisons[f"{previous_period}_to_{current_period}"] = {
                        "current": current_val,
                        "previous": previous_val,
                        "absolute_change": current_val - previous_val,
                        "percentage_change": growth
                    }
        
        return comparisons


class ReportDrillDown:
    """Drill-down functionality for reports"""
    
    def __init__(self):
        self._drilldown_relations: Dict[str, List[str]] = {
            "gstr1_filing_status": ["gstr1_invoices", "gstr1_summary"],
            "tax_liability_summary": ["tax_rate_analysis", "rcm_liability"],
            "b2b_invoices": ["b2b_invoice_detail", "b2b_amendments"],
            "hsn_code_summary": ["hsn_invoice_detail"],
            "gstr1_vs_gstr3b": ["gstr1_detail", "gstr3b_detail"],
        }
    
    def get_drilldown_options(self, report_id: str) -> List[str]:
        """Get available drilldown options for a report"""
        return self._drilldown_relations.get(report_id, [])
    
    def get_drilldown_report(
        self,
        source_report_id: str,
        drilldown_id: str,
        source_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate drilldown report based on source data"""
        # Map drilldown IDs to actual report IDs
        drilldown_map = {
            "gstr1_invoices": "b2b_invoices",
            "gstr1_summary": "tax_liability_summary",
            "tax_rate_analysis": "tax_rate_analysis",
            "rcm_liability": "rcm_liability",
            "b2b_invoice_detail": "b2b_invoices",
            "b2b_amendments": "credit_debit_notes",
            "hsn_invoice_detail": "hsn_code_summary",
            "gstr1_detail": "gstr1_filing_status",
            "gstr3b_detail": "gstr3b_filing_status",
        }
        
        target_report = drilldown_map.get(drilldown_id)
        
        if not target_report:
            return {"error": "Unknown drilldown target"}
        
        # Extract filter parameters from source data
        parameters = {
            "gstin": source_data.get("gstin", ""),
            "return_period": source_data.get("return_period", ""),
        }
        
        # Add any additional filters from source
        if "customer_gstin" in source_data:
            parameters["customer_gstin"] = source_data["customer_gstin"]
        
        if "hsn_code" in source_data:
            parameters["hsn_code"] = source_data["hsn_code"]
        
        return {
            "source_report": source_report_id,
            "drilldown_report": target_report,
            "parameters": parameters
        }


# Global instances
_report_cache = ReportCache()
_report_scheduler = ReportScheduler()
_report_comparison = ReportComparisonEngine()
_report_drilldown = ReportDrillDown()
_async_jobs: Dict[str, ReportGenerationJob] = {}


# =============================================================================
# Report Generation Functions
# =============================================================================

def generate_report(
    report_id: str,
    parameters: Dict[str, Any],
    use_cache: bool = True,
    invalidate_cache: bool = False
) -> ReportData:
    """
    Generate a report with given parameters.
    
    Args:
        report_id: The report identifier
        parameters: Report parameters
        use_cache: Whether to use cached results
        invalidate_cache: Whether to invalidate cache before generation
    
    Returns:
        Generated report data
    """
    metadata = get_report_metadata(report_id)
    
    if metadata is None:
        raise ValueError(f"Unknown report: {report_id}")
    
    # Check cache
    if use_cache and not invalidate_cache:
        cached_result = _report_cache.get(report_id, parameters)
        if cached_result:
            return cached_result
    
    # Validate parameters
    for param in metadata.parameters:
        if param.required and param.name not in parameters:
            raise ValueError(f"Required parameter '{param.name}' is missing")
    
    # Generate report
    from india_compliance.gst_india.reports import MockReportGenerator
    
    generator = MockReportGenerator(metadata)
    report_data = generator.generate(parameters)
    
    # Cache result
    if use_cache:
        _report_cache.set(report_id, parameters, report_data)
    
    return report_data


async def generate_report_async(
    report_id: str,
    parameters: Dict[str, Any]
) -> str:
    """
    Generate a report asynchronously.
    
    Returns:
        Job ID for tracking the generation
    """
    job_id = str(uuid.uuid4())
    
    job = ReportGenerationJob(
        job_id=job_id,
        report_id=report_id,
        parameters=parameters
    )
    
    _async_jobs[job_id] = job
    
    # Run generation in background
    asyncio.create_task(_run_async_job(job_id))
    
    return job_id


async def _run_async_job(job_id: str):
    """Run async report generation job"""
    job = _async_jobs.get(job_id)
    
    if not job:
        return
    
    try:
        job.status = "running"
        job.started_at = datetime.now()
        
        # Generate report
        result = generate_report(job.report_id, job.parameters, use_cache=False)
        
        job.result = result
        job.status = "completed"
        job.completed_at = datetime.now()
        
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.completed_at = datetime.now()
        logger.error(f"Async job {job_id} failed: {e}")


def get_async_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get status of async report generation job"""
    job = _async_jobs.get(job_id)
    
    if not job:
        return None
    
    return {
        "job_id": job.job_id,
        "report_id": job.report_id,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error": job.error
    }


def get_async_job_result(job_id: str) -> Optional[ReportData]:
    """Get result of completed async job"""
    job = _async_jobs.get(job_id)
    
    if job and job.status == "completed":
        return job.result
    
    return None


def compare_report_periods(
    report_id: str,
    parameters: Dict[str, Any],
    periods: List[str]
) -> Dict[str, Any]:
    """Compare report across multiple periods"""
    return _report_comparison.compare_periods(report_id, parameters, periods)


def get_drilldown_options(report_id: str) -> List[str]:
    """Get drilldown options for a report"""
    return _report_drilldown.get_drilldown_options(report_id)


def get_drilldown_report(
    source_report_id: str,
    drilldown_id: str,
    source_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Get drilldown report for selected data"""
    return _report_drilldown.get_drilldown_report(
        source_report_id, drilldown_id, source_data
    )


def get_cache_stats() -> Dict[str, Any]:
    """Get report cache statistics"""
    return _report_cache.get_stats()


def clear_cache(report_id: Optional[str] = None):
    """Clear report cache"""
    _report_cache.invalidate(report_id)


def schedule_report(
    report_id: str,
    parameters: Dict[str, Any],
    frequency: str,
    time: str = "00:00",
    recipients: List[str] = None,
    format: str = "pdf"
) -> str:
    """Schedule a report for automatic generation"""
    schedule_id = str(uuid.uuid4())
    
    _report_scheduler.schedule_report(
        schedule_id=schedule_id,
        report_id=report_id,
        parameters=parameters,
        frequency=frequency,
        time=time,
        recipients=recipients,
        format=format
    )
    
    return schedule_id


def get_scheduled_reports() -> List[Dict[str, Any]]:
    """Get all scheduled reports"""
    return _report_scheduler.get_scheduled_reports()


def delete_scheduled_report(schedule_id: str):
    """Delete a scheduled report"""
    _report_scheduler.delete_schedule(schedule_id)


# =============================================================================
# Utility Functions
# =============================================================================

def get_reports_by_category() -> Dict[str, List[Dict[str, Any]]]:
    """Get all reports organized by category"""
    categories = {
        "filing_compliance": ReportCategory.FILING_COMPLIANCE,
        "tax_liability": ReportCategory.TAX_LIABILITY,
        "itc_credit": ReportCategory.ITC_CREDIT,
        "transactions": ReportCategory.TRANSACTIONS,
        "reconciliation": ReportCategory.RECONCILIATION,
        "analytics_trends": ReportCategory.ANALYTICS_TRENDS,
    }
    
    result = {}
    for category_name, category in categories.items():
        reports = get_report_by_category(category)
        result[category_name] = [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "return_type": r.return_type,
                "parameters": [
                    {
                        "name": p.name,
                        "type": p.param_type,
                        "required": p.required,
                        "description": p.description
                    }
                    for p in r.parameters
                ],
                "columns": [
                    {
                        "key": c.key,
                        "label": c.label,
                        "data_type": c.data_type
                    }
                    for c in r.columns
                ]
            }
            for r in reports
        ]
    
    return result


def validate_report_parameters(
    report_id: str,
    parameters: Dict[str, Any]
) -> Dict[str, Any]:
    """Validate parameters for a report"""
    metadata = get_report_metadata(report_id)
    
    if not metadata:
        return {"valid": False, "error": f"Unknown report: {report_id}"}
    
    errors = []
    warnings = []
    
    # Check required parameters
    for param in metadata.parameters:
        if param.required and param.name not in parameters:
            errors.append(f"Required parameter '{param.name}' is missing")
        
        # Type validation
        if param.name in parameters:
            value = parameters[param.name]
            
            if param.param_type == "gstin" and value:
                if not _validate_gstin(value):
                    errors.append(f"Invalid GSTIN format: {value}")
            
            if param.param_type == "period" and value:
                if not _validate_period(value):
                    warnings.append(f"Period format should be MMYYYY: {value}")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def _validate_gstin(gstin: str) -> bool:
    """Validate GSTIN format"""
    import re
    pattern = r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    return bool(re.match(pattern, gstin))


def _validate_period(period: str) -> bool:
    """Validate period format (MMYYYY)"""
    import re
    pattern = r"^(0[1-9]|1[0-2])20\d{2}$"
    return bool(re.match(pattern, period))
