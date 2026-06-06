"""
GST India Reports Module

Comprehensive reporting engine for GST compliance platform with 30+ reports
covering all aspects of GST compliance, tax analytics, and business insights.

Reports organized into 6 categories:
1. Filing & Compliance Reports (8 reports)
2. Tax Liability Reports (6 reports)
3. ITC & Credit Reports (5 reports)
4. Transaction Reports (6 reports)
5. Reconciliation Reports (5 reports)
6. Analytics & Trends (4 reports)
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import uuid
import json
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class ReportCategory(str, Enum):
    """Report categories for organization"""
    FILING_COMPLIANCE = "filing_compliance"
    TAX_LIABILITY = "tax_liability"
    ITC_CREDIT = "itc_credit"
    TRANSACTIONS = "transactions"
    RECONCILIATION = "reconciliation"
    ANALYTICS_TRENDS = "analytics_trends"


class ReportFormat(str, Enum):
    """Export format types"""
    JSON = "json"
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"


class FilingStatus(str, Enum):
    """Filing status enumeration"""
    DRAFT = "draft"
    PENDING = "pending"
    FILED = "filed"
    OVERDUE = "overdue"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class TaxRate(str, Enum):
    """Standard GST tax rates"""
    RATE_0 = "0"
    RATE_0_1 = "0.1"
    RATE_0_25 = "0.25"
    RATE_1 = "1"
    RATE_1_5 = "1.5"
    RATE_3 = "3"
    RATE_5 = "5"
    RATE_6 = "6"
    RATE_7_5 = "7.5"
    RATE_12 = "12"
    RATE_18 = "18"
    RATE_28 = "28"


@dataclass
class ReportParameter:
    """Report parameter definition"""
    name: str
    param_type: str  # string, number, date, period, gstin
    required: bool = False
    default: Any = None
    description: str = ""
    options: List[Any] = None


@dataclass
class ReportColumn:
    """Report column definition for display"""
    key: str
    label: str
    data_type: str = "string"  # string, number, date, currency
    sortable: bool = True
    visible: bool = True
    width: Optional[int] = None
    format: Optional[str] = None  # currency, percentage, date


@dataclass
class ReportMetadata:
    """Report metadata and configuration"""
    id: str
    name: str
    description: str
    category: ReportCategory
    return_type: str  # GSTR-1, GSTR-3B, etc.
    parameters: List[ReportParameter] = field(default_factory=list)
    columns: List[ReportColumn] = field(default_factory=list)
    enable_export: bool = True
    enable_scheduling: bool = True
    enable_drilldown: bool = True
    cache_ttl: int = 3600  # seconds
    is_async: bool = False


@dataclass
class ReportData:
    """Generated report data"""
    report_id: str
    report_type: str
    parameters: Dict[str, Any]
    data: List[Dict[str, Any]]
    summary: Dict[str, Any]
    charts: List[Dict[str, Any]] = field(default_factory=list)
    generated_at: datetime
    generated_by: Optional[str] = None
    total_records: int = 0
    execution_time_ms: float = 0


@dataclass
class FilingRecord:
    """GST filing record"""
    id: str
    gstin: str
    return_type: str
    return_period: str
    due_date: datetime
    filed_date: Optional[datetime] = None
    status: FilingStatus = FilingStatus.PENDING
    tax_amount: float = 0
    late_fee: float = 0
    ack_number: Optional[str] = None
    arn: Optional[str] = None


@dataclass
class InvoiceSummary:
    """Invoice summary data"""
    invoice_number: str
    invoice_date: str
    invoice_value: float
    taxable_value: float
    cgst: float = 0
    sgst: float = 0
    igst: float = 0
    cess: float = 0
    rate: float = 0
    hsn_code: str = ""
    customer_name: str = ""
    customer_gstin: str = ""
    place_of_supply: str = ""
    transaction_type: str = "B2B"  # B2B, B2CL, B2CS, EXP, CDNR, etc.
    is_export: bool = False
    is_reverse_charge: bool = False


# Report Registry - Contains all 34 reports
REPORT_REGISTRY: Dict[str, ReportMetadata] = {}


def register_report(metadata: ReportMetadata):
    """Register a report in the global registry"""
    REPORT_REGISTRY[metadata.id] = metadata
    return metadata


# =============================================================================
# CATEGORY 1: FILING & COMPLIANCE REPORTS (8 Reports)
# =============================================================================

# 1. GSTR-1 Filing Status
register_report(ReportMetadata(
    id="gstr1_filing_status",
    name="GSTR-1 Filing Status",
    description="Monthly/quarterly filing status by GSTIN showing filed, pending, and overdue returns",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True, description="GSTIN to filter"),
        ReportParameter("from_period", "period", False, description="From return period (MMYYYY)"),
        ReportParameter("to_period", "period", False, description="To return period (MMYYYY)"),
    ],
    columns=[
        ReportColumn("return_period", "Period"),
        ReportColumn("due_date", "Due Date", "date"),
        ReportColumn("filed_date", "Filed Date", "date"),
        ReportColumn("status", "Status"),
        ReportColumn("tax_amount", "Tax Amount", "currency"),
        ReportColumn("late_fee", "Late Fee", "currency"),
    ]
))

# 2. GSTR-3B Filing Status
register_report(ReportMetadata(
    id="gstr3b_filing_status",
    name="GSTR-3B Filing Status",
    description="Tax payment and filing status for GSTR-3B returns",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", False),
        ReportParameter("to_period", "period", False),
    ],
    columns=[
        ReportColumn("return_period", "Period"),
        ReportColumn("due_date", "Due Date", "date"),
        ReportColumn("filed_date", "Filed Date", "date"),
        ReportColumn("status", "Status"),
        ReportColumn("tax_liability", "Tax Liability", "currency"),
        ReportColumn("tax_paid", "Tax Paid", "currency"),
        ReportColumn("late_fee", "Late Fee", "currency"),
    ]
))

# 3. GSTR-9 Annual Summary
register_report(ReportMetadata(
    id="gstr9_annual_summary",
    name="GSTR-9 Annual Summary",
    description="Annual return reconciliation showing annual figures vs monthly returns",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="GSTR-9",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("financial_year", "string", True, description="e.g., 2025-26"),
    ],
    columns=[
        ReportColumn("category", "Category"),
        ReportColumn("annual_value", "Annual Value", "currency"),
        ReportColumn("monthly_total", "Monthly Returns Total", "currency"),
        ReportColumn("difference", "Difference", "currency"),
    ]
))

# 4. Filing Calendar
register_report(ReportMetadata(
    id="filing_calendar",
    name="Filing Calendar",
    description="Upcoming filing deadlines for all GST returns",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", False),
        ReportParameter("year", "number", False, datetime.now().year),
    ],
    columns=[
        ReportColumn("return_type", "Return Type"),
        ReportColumn("period", "Period"),
        ReportColumn("due_date", "Due Date", "date"),
        ReportColumn("status", "Status"),
        ReportColumn("days_remaining", "Days Remaining"),
    ]
))

# 5. Late Fee Calculator
register_report(ReportMetadata(
    id="late_fee_calculator",
    name="Late Fee Calculator",
    description="Calculate late fees for delayed GST return filings",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_type", "string", True),
        ReportParameter("return_period", "period", True),
        ReportParameter("actual_filing_date", "date", True),
    ],
    columns=[
        ReportColumn("return_type", "Return Type"),
        ReportColumn("return_period", "Period"),
        ReportColumn("due_date", "Due Date", "date"),
        ReportColumn("filing_date", "Actual Filing Date", "date"),
        ReportColumn("days_late", "Days Late"),
        ReportColumn("late_fee", "Late Fee", "currency"),
        ReportColumn("interest", "Interest", "currency"),
    ]
))

# 6. Amendment Tracker
register_report(ReportMetadata(
    id="amendment_tracker",
    name="Amendment Tracker",
    description="Track all amendments filed in GSTR-1 for inward and outward supplies",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", False),
        ReportParameter("to_period", "period", False),
    ],
    columns=[
        ReportColumn("amendment_period", "Amendment For"),
        ReportColumn("filed_date", "Filed Date", "date"),
        ReportColumn("original_invoice", "Original Invoice"),
        ReportColumn("amended_invoice", "Amended Invoice"),
        ReportColumn("original_value", "Original Value", "currency"),
        ReportColumn("amended_value", "Amended Value", "currency"),
        ReportColumn("difference", "Difference", "currency"),
    ]
))

# 7. Compliance Scorecard
register_report(ReportMetadata(
    id="compliance_scorecard",
    name="Compliance Scorecard",
    description="Overall compliance rating based on filing timeliness, accuracy, and reconciliation",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", False),
        ReportParameter("to_period", "period", False),
    ],
    columns=[
        ReportColumn("metric", "Compliance Metric"),
        ReportColumn("score", "Score", "number"),
        ReportColumn("max_score", "Max Score", "number"),
        ReportColumn("rating", "Rating"),
    ]
))

# 8. Fraud Risk Indicators
register_report(ReportMetadata(
    id="fraud_risk_indicators",
    name="Fraud Risk Indicators",
    description="Flag suspicious transactions and potential fraud risk patterns",
    category=ReportCategory.FILING_COMPLIANCE,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_date", "date", False),
        ReportParameter("to_date", "date", False),
    ],
    columns=[
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("customer_name", "Customer Name"),
        ReportColumn("risk_type", "Risk Type"),
        ReportColumn("risk_score", "Risk Score", "number"),
        ReportColumn("details", "Details"),
    ]
))


# =============================================================================
# CATEGORY 2: TAX LIABILITY REPORTS (6 Reports)
# =============================================================================

# 9. Tax Liability Summary
register_report(ReportMetadata(
    id="tax_liability_summary",
    name="Tax Liability Summary",
    description="CGST/SGST/IGST liability breakdown by period with tax rate analysis",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("return_period", "Period"),
        ReportColumn("cgst", "CGST", "currency"),
        ReportColumn("sgst", "SGST", "currency"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("cess", "Cess", "currency"),
        ReportColumn("total_liability", "Total", "currency"),
    ]
))

# 10. Tax Rate Analysis
register_report(ReportMetadata(
    id="tax_rate_analysis",
    name="Tax Rate Analysis",
    description="Tax breakdown by rate (5%, 12%, 18%, 28%) showing taxable value and tax",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("tax_rate", "Tax Rate"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("cgst", "CGST", "currency"),
        ReportColumn("sgst", "SGST", "currency"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("total_tax", "Total Tax", "currency"),
        ReportColumn("invoice_count", "Invoice Count", "number"),
    ]
))

# 11. RCM Liability Report
register_report(ReportMetadata(
    id="rcm_liability",
    name="RCM Liability Report",
    description="Reverse Charge Mechanism liabilities for specified supplies",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("supplier_name", "Supplier Name"),
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("invoice_date", "Invoice Date", "date"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("rate", "Rate"),
        ReportColumn("rcm_tax", "RCM Tax", "currency"),
    ]
))

# 12. TDS/TCS Summary
register_report(ReportMetadata(
    id="tds_tcs_summary",
    name="TDS/TCS Summary",
    description="Tax deducted/collected at source summary from GSTR-7 and GSTR-8",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-7",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("return_type", "Return Type"),
        ReportColumn("period", "Period"),
        ReportColumn("deductee_count", "No. of Deductees", "number"),
        ReportColumn("total_deduction", "Total Deduction", "currency"),
        ReportColumn("tds_payable", "TDS Payable", "currency"),
    ]
))

# 13. Interest Calculator
register_report(ReportMetadata(
    id="interest_calculator",
    name="Interest Calculator",
    description="Interest on late tax payment calculated as per GST Act provisions",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("tax_period", "period", True),
        ReportParameter("actual_payment_date", "date", True),
    ],
    columns=[
        ReportColumn("tax_type", "Tax Type"),
        ReportColumn("tax_amount", "Tax Amount", "currency"),
        ReportColumn("due_date", "Due Date", "date"),
        ReportColumn("payment_date", "Payment Date", "date"),
        ReportColumn("days_late", "Days Late"),
        ReportColumn("interest_rate", "Interest Rate %"),
        ReportColumn("interest", "Interest Amount", "currency"),
    ]
))

# 14. Tax Cash Flow
register_report(ReportMetadata(
    id="tax_cash_flow",
    name="Tax Cash Flow",
    description="GST tax outflow projections and cash flow analysis",
    category=ReportCategory.TAX_LIABILITY,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("tax_liability", "Tax Liability", "currency"),
        ReportColumn("itc_availed", "ITC Availed", "currency"),
        ReportColumn("tax_payable", "Tax Payable", "currency"),
        ReportColumn("tax_paid", "Tax Paid", "currency"),
        ReportColumn("balance", "Balance", "currency"),
    ]
))


# =============================================================================
# CATEGORY 3: ITC & CREDIT REPORTS (5 Reports)
# =============================================================================

# 15. ITC Availment Report
register_report(ReportMetadata(
    id="itc_availment",
    name="ITC Availment Report",
    description="Input tax credit claimed in GSTR-3B with breakdown by source",
    category=ReportCategory.ITC_CREDIT,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("itc_type", "ITC Type"),
        ReportColumn("itc_amount", "ITC Amount", "currency"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("cgst", "CGST", "currency"),
        ReportColumn("sgst", "SGST", "currency"),
    ]
))

# 16. ITC Reversal Report
register_report(ReportMetadata(
    id="itc_reversal",
    name="ITC Reversal Report",
    description="ITC reversed or disallowed with reasons and amounts",
    category=ReportCategory.ITC_CREDIT,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("reversal_reason", "Reversal Reason"),
        ReportColumn("amount", "Amount", "currency"),
        ReportColumn("rule", "Rule Reference"),
    ]
))

# 17. ITC Eligibility Matrix
register_report(ReportMetadata(
    id="itc_eligibility_matrix",
    name="ITC Eligibility Matrix",
    description="Eligible vs ineligible ITC based on GST rules and conditions",
    category=ReportCategory.ITC_CREDIT,
    return_type="GSTR-2B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("supplier_gstin", "Supplier GSTIN"),
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("itc_claimed", "ITC Claimed", "currency"),
        ReportColumn("eligibility_status", "Eligibility Status"),
        ReportColumn("reason", "Reason"),
    ]
))

# 18. Credit Ledger Status
register_report(ReportMetadata(
    id="credit_ledger_status",
    name="Credit Ledger Status",
    description="Electronic credit ledger balance with ITC utilization details",
    category=ReportCategory.ITC_CREDIT,
    return_type="GSTR-3B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("as_on_date", "date", True),
    ],
    columns=[
        ReportColumn("ledger_type", "Ledger Type"),
        ReportColumn("opening_balance", "Opening Balance", "currency"),
        ReportColumn("credit_received", "Credit Received", "currency"),
        ReportColumn("utilized", "Utilized", "currency"),
        ReportColumn("closing_balance", "Closing Balance", "currency"),
    ]
))

# 19. Unclaimed ITC Report
register_report(ReportMetadata(
    id="unclaimed_itc",
    name="Unclaimed ITC Report",
    description="ITC available in GSTR-2B that could have been claimed but wasn't",
    category=ReportCategory.ITC_CREDIT,
    return_type="GSTR-2B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("supplier_gstin", "Supplier GSTIN"),
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("itc_available", "ITC Available", "currency"),
        ReportColumn("itc_unclaimed", "ITC Unclaimed", "currency"),
    ]
))


# =============================================================================
# CATEGORY 4: TRANSACTION REPORTS (6 Reports)
# =============================================================================

# 20. B2B Invoices Detail
register_report(ReportMetadata(
    id="b2b_invoices",
    name="B2B Invoices Detail",
    description="Business to business invoices with complete details",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
        ReportParameter("customer_gstin", "string", False),
    ],
    columns=[
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("invoice_date", "Invoice Date", "date"),
        ReportColumn("customer_name", "Customer Name"),
        ReportColumn("customer_gstin", "Customer GSTIN"),
        ReportColumn("invoice_value", "Invoice Value", "currency"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("rate", "Rate"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("cgst", "CGST", "currency"),
        ReportColumn("sgst", "SGST", "currency"),
    ]
))

# 21. B2C Invoices Detail
register_report(ReportMetadata(
    id="b2c_invoices",
    name="B2C Invoices Detail",
    description="Business to consumer invoices with state-wise breakdown",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
        ReportParameter("state", "string", False),
    ],
    columns=[
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("invoice_date", "Invoice Date", "date"),
        ReportColumn("customer_name", "Customer Name"),
        ReportColumn("place_of_supply", "Place of Supply"),
        ReportColumn("invoice_value", "Invoice Value", "currency"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("rate", "Rate"),
        ReportColumn("tax", "Tax", "currency"),
    ]
))

# 22. Export Invoices
register_report(ReportMetadata(
    id="export_invoices",
    name="Export Invoices",
    description="Export transactions with shipping bill details",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
        ReportParameter("export_type", "string", False),  # WPAY, WOPAY
    ],
    columns=[
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("invoice_date", "Invoice Date", "date"),
        ReportColumn("export_type", "Export Type"),
        ReportColumn("shipping_bill_number", "Shipping Bill Number"),
        ReportColumn("port_code", "Port Code"),
        ReportColumn("destination_country", "Destination Country"),
        ReportColumn("fob_value", "FOB Value", "currency"),
        ReportColumn("igst", "IGST", "currency"),
    ]
))

# 23. Nil Rated/Exempt Supplies
register_report(ReportMetadata(
    id="nil_rated_supplies",
    name="Nil Rated/Exempt Supplies",
    description="Zero tax supplies with category breakdown",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("supply_type", "Supply Type"),
        ReportColumn("description", "Description"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("nil_rated", "Nil Rated", "currency"),
        ReportColumn("exempt", "Exempt", "currency"),
        ReportColumn("non_gst", "Non-GST", "currency"),
    ]
))

# 24. Credit/Debit Notes
register_report(ReportMetadata(
    id="credit_debit_notes",
    name="Credit/Debit Notes",
    description="Amendment invoices for returns and discounts",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
        ReportParameter("note_type", "string", False),  # Credit, Debit
    ],
    columns=[
        ReportColumn("note_type", "Note Type"),
        ReportColumn("note_number", "Note Number"),
        ReportColumn("note_date", "Note Date", "date"),
        ReportColumn("original_invoice", "Original Invoice"),
        ReportColumn("customer_name", "Customer Name"),
        ReportColumn("customer_gstin", "Customer GSTIN"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("tax", "Tax", "currency"),
    ]
))

# 25. HSN Code Summary
register_report(ReportMetadata(
    id="hsn_code_summary",
    name="HSN Code Summary",
    description="Goods/services breakdown by HSN/SAC code with tax analysis",
    category=ReportCategory.TRANSACTIONS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("hsn_code", "HSN/SAC Code"),
        ReportColumn("description", "Description"),
        ReportColumn("uom", "UOM"),
        ReportColumn("quantity", "Quantity", "number"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("rate", "Rate"),
        ReportColumn("cgst", "CGST", "currency"),
        ReportColumn("sgst", "SGST", "currency"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("cess", "Cess", "currency"),
    ]
))


# =============================================================================
# CATEGORY 5: RECONCILIATION REPORTS (5 Reports)
# =============================================================================

# 26. GSTR-1 vs GSTR-3B
register_report(ReportMetadata(
    id="gstr1_vs_gstr3b",
    name="GSTR-1 vs GSTR-3B",
    description="Outward supply reconciliation between GSTR-1 and tax liability in GSTR-3B",
    category=ReportCategory.RECONCILIATION,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("category", "Category"),
        ReportColumn("gstr1_value", "GSTR-1 Value", "currency"),
        ReportColumn("gstr3b_value", "GSTR-3B Value", "currency"),
        ReportColumn("difference", "Difference", "currency"),
        ReportColumn("status", "Status"),
    ]
))

# 27. GSTR-2A vs GSTR-2B
register_report(ReportMetadata(
    id="gstr2a_vs_gstr2b",
    name="GSTR-2A vs GSTR-2B",
    description="Purchase reconciliation between GSTR-2A and final GSTR-2B",
    category=ReportCategory.RECONCILIATION,
    return_type="GSTR-2B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("supplier_gstin", "Supplier GSTIN"),
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("gstr2a_value", "GSTR-2A Value", "currency"),
        ReportColumn("gstr2b_value", "GSTR-2B Value", "currency"),
        ReportColumn("difference", "Difference", "currency"),
        ReportColumn("status", "Status"),
    ]
))

# 28. GSTN Portal vs Books
register_report(ReportMetadata(
    id="portal_vs_books",
    name="GSTN Portal vs Books",
    description="External GSTN data comparison with internal accounting records",
    category=ReportCategory.RECONCILIATION,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("data_source", "Data Source"),
        ReportColumn("total_invoices", "Total Invoices", "number"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("tax", "Tax", "currency"),
        ReportColumn("difference", "Difference", "currency"),
    ]
))

# 29. Missing Invoices
register_report(ReportMetadata(
    id="missing_invoices",
    name="Missing Invoices",
    description="Invoices present in one return but missing in another",
    category=ReportCategory.RECONCILIATION,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("source", "Source"),
        ReportColumn("invoice_number", "Invoice Number"),
        ReportColumn("supplier_gstin", "Supplier/Customer GSTIN"),
        ReportColumn("invoice_date", "Invoice Date", "date"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("tax", "Tax", "currency"),
    ]
))

# 30. Mismatch Report
register_report(ReportMetadata(
    id="mismatch_report",
    name="Mismatch Report",
    description="All mismatches between returns with amounts and percentages",
    category=ReportCategory.RECONCILIATION,
    return_type="ALL",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("mismatch_type", "Mismatch Type"),
        ReportColumn("return_1", "Return 1"),
        ReportColumn("return_2", "Return 2"),
        ReportColumn("amount_1", "Amount 1", "currency"),
        ReportColumn("amount_2", "Amount 2", "currency"),
        ReportColumn("difference", "Difference", "currency"),
    ]
))


# =============================================================================
# CATEGORY 6: ANALYTICS & TRENDS (4 Reports)
# =============================================================================

# 31. Sales Trend Analysis
register_report(ReportMetadata(
    id="sales_trend_analysis",
    name="Sales Trend Analysis",
    description="Monthly/quarterly sales trends with comparison and growth rates",
    category=ReportCategory.ANALYTICS_TRENDS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("period", "Period"),
        ReportColumn("total_sales", "Total Sales", "currency"),
        ReportColumn("total_tax", "Total Tax", "currency"),
        ReportColumn("invoice_count", "Invoice Count", "number"),
        ReportColumn("avg_invoice_value", "Avg Invoice Value", "currency"),
        ReportColumn("growth_rate", "Growth Rate %"),
    ]
))

# 32. Purchase Pattern Analysis
register_report(ReportMetadata(
    id="purchase_pattern",
    name="Purchase Pattern Analysis",
    description="Supplier analysis with purchase volumes and ITC analysis",
    category=ReportCategory.ANALYTICS_TRENDS,
    return_type="GSTR-2B",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("from_period", "period", True),
        ReportParameter("to_period", "period", True),
    ],
    columns=[
        ReportColumn("supplier_name", "Supplier Name"),
        ReportColumn("supplier_gstin", "Supplier GSTIN"),
        ReportColumn("invoice_count", "Invoice Count", "number"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("itc_claimed", "ITC Claimed", "currency"),
        ReportColumn("purchase_share", "Purchase Share %"),
    ]
))

# 33. Tax Rate Distribution
register_report(ReportMetadata(
    id="tax_rate_distribution",
    name="Tax Rate Distribution",
    description="Visual breakdown of tax rates across all transactions",
    category=ReportCategory.ANALYTICS_TRENDS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("tax_rate", "Tax Rate"),
        ReportColumn("taxable_value", "Taxable Value", "currency"),
        ReportColumn("tax", "Tax", "currency"),
        ReportColumn("percentage", "Percentage %"),
    ]
))

# 34. State-wise Sales
register_report(ReportMetadata(
    id="state_wise_sales",
    name="State-wise Sales",
    description="Inter-state vs intra-state sales breakdown by state",
    category=ReportCategory.ANALYTICS_TRENDS,
    return_type="GSTR-1",
    parameters=[
        ReportParameter("gstin", "gstin", True),
        ReportParameter("return_period", "period", True),
    ],
    columns=[
        ReportColumn("state", "State"),
        ReportColumn("intra_state", "Intra-State", "currency"),
        ReportColumn("inter_state", "Inter-State", "currency"),
        ReportColumn("total", "Total", "currency"),
        ReportColumn("igst", "IGST", "currency"),
        ReportColumn("cgst_sgst", "CGST+SGST", "currency"),
    ]
))


# =============================================================================
# Report Generator Engine
# =============================================================================

class BaseReportGenerator(ABC):
    """Base class for all report generators"""
    
    def __init__(self, metadata: ReportMetadata):
        self.metadata = metadata
        self.data_cache: Dict[str, Any] = {}
    
    @abstractmethod
    def generate(self, parameters: Dict[str, Any]) -> ReportData:
        """Generate the report with given parameters"""
        pass
    
    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """Validate required parameters"""
        for param in self.metadata.parameters:
            if param.required and param.name not in parameters:
                raise ValueError(f"Required parameter '{param.name}' is missing")
        return True
    
    def apply_filters(self, data: List[Dict[str, Any]], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply filters to report data"""
        return data
    
    def calculate_summary(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics"""
        return {"total_records": len(data)}
    
    def format_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format data for display"""
        return data


class ReportGeneratorFactory:
    """Factory for creating report generators"""
    
    @staticmethod
    def get_generator(report_id: str) -> Optional[BaseReportGenerator]:
        """Get the appropriate generator for a report"""
        if report_id not in REPORT_REGISTRY:
            return None
        
        metadata = REPORT_REGISTRY[report_id]
        
        # Create generator based on report type
        # In production, this would load actual data from database
        return MockReportGenerator(metadata)


class MockReportGenerator(BaseReportGenerator):
    """Mock report generator for demonstration"""
    
    def generate(self, parameters: Dict[str, Any]) -> ReportData:
        start_time = datetime.now()
        
        self.validate_parameters(parameters)
        
        # Generate mock data based on report type
        data = self._generate_mock_data(parameters)
        
        summary = self.calculate_summary(data)
        formatted_data = self.format_data(data)
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return ReportData(
            report_id=self.metadata.id,
            report_type=self.metadata.name,
            parameters=parameters,
            data=formatted_data,
            summary=summary,
            charts=self._generate_charts(formatted_data),
            generated_at=datetime.now(),
            total_records=len(formatted_data),
            execution_time_ms=execution_time
        )
    
    def _generate_mock_data(self, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate mock data for demonstration"""
        report_id = self.metadata.id
        
        # Sample data based on report type
        if report_id == "gstr1_filing_status":
            return [
                {"return_period": "012026", "due_date": "2026-02-11", "filed_date": "2026-02-08", "status": "filed", "tax_amount": 150000, "late_fee": 0},
                {"return_period": "122025", "due_date": "2026-01-11", "filed_date": "2026-01-10", "status": "filed", "tax_amount": 125000, "late_fee": 0},
                {"return_period": "022026", "due_date": "2026-03-11", "filed_date": None, "status": "pending", "tax_amount": 0, "late_fee": 0},
            ]
        elif report_id == "tax_liability_summary":
            return [
                {"return_period": "012026", "cgst": 25000, "sgst": 25000, "igst": 50000, "cess": 5000, "total_liability": 105000},
                {"return_period": "122025", "cgst": 22000, "sgst": 22000, "igst": 45000, "cess": 4500, "total_liability": 93500},
            ]
        elif report_id == "b2b_invoices":
            return [
                {"invoice_number": "INV001", "invoice_date": "2026-01-15", "customer_name": "ABC Corp", "customer_gstin": "27AAAAA1234A1Z1", "invoice_value": 118000, "taxable_value": 100000, "rate": 18, "igst": 0, "cgst": 9000, "sgst": 9000},
                {"invoice_number": "INV002", "invoice_date": "2026-01-20", "customer_name": "XYZ Ltd", "customer_gstin": "29BBBB B1234B1Z1", "invoice_value": 236000, "taxable_value": 200000, "rate": 18, "igst": 36000, "cgst": 0, "sgst": 0},
            ]
        elif report_id == "sales_trend_analysis":
            return [
                {"period": "012026", "total_sales": 5000000, "total_tax": 900000, "invoice_count": 150, "avg_invoice_value": 33333, "growth_rate": 5.2},
                {"period": "122025", "total_sales": 4750000, "total_tax": 855000, "invoice_count": 142, "avg_invoice_value": 33451, "growth_rate": 3.8},
                {"period": "112025", "total_sales": 4580000, "total_tax": 824400, "invoice_count": 138, "avg_invoice_value": 33188, "growth_rate": 4.1},
            ]
        elif report_id == "hsn_code_summary":
            return [
                {"hsn_code": "1001", "description": "Wheat", "uom": "TONNE", "quantity": 1000, "taxable_value": 500000, "rate": 0, "cgst": 0, "sgst": 0, "igst": 0, "cess": 0},
                {"hsn_code": "8517", "description": "Mobile Phones", "uom": "PCS", "quantity": 500, "taxable_value": 2500000, "rate": 18, "cgst": 225000, "sgst": 225000, "igst": 0, "cess": 0},
                {"hsn_code": "8703", "description": "Motor Cars", "uom": "PCS", "quantity": 10, "taxable_value": 10000000, "rate": 28, "cgst": 1400000, "sgst": 1400000, "igst": 0, "cess": 500000},
            ]
        else:
            # Default mock data
            return [
                {"id": 1, "description": "Sample Record 1", "value": 10000},
                {"id": 2, "description": "Sample Record 2", "value": 20000},
                {"id": 3, "description": "Sample Record 3", "value": 15000},
            ]
    
    def _generate_charts(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate chart data for visualization"""
        charts = []
        
        # Check if we have numeric data suitable for charts
        numeric_keys = []
        for record in data:
            for key, value in record.items():
                if isinstance(value, (int, float)) and key not in ['id', 'rate', 'quantity']:
                    numeric_keys.append(key)
                    break
        
        if numeric_keys:
            charts.append({
                "type": "bar",
                "title": "Overview",
                "data": data[:10] if len(data) > 10 else data,
                "value_key": numeric_keys[0] if numeric_keys else "value"
            })
        
        return charts


def get_report_list() -> List[ReportMetadata]:
    """Get list of all available reports"""
    return list(REPORT_REGISTRY.values())


def get_report_by_category(category: ReportCategory) -> List[ReportMetadata]:
    """Get reports filtered by category"""
    return [r for r in REPORT_REGISTRY.values() if r.category == category]


def get_report_metadata(report_id: str) -> Optional[ReportMetadata]:
    """Get metadata for a specific report"""
    return REPORT_REGISTRY.get(report_id)


def generate_report(report_id: str, parameters: Dict[str, Any]) -> ReportData:
    """Generate a report with given parameters"""
    generator = ReportGeneratorFactory.get_generator(report_id)
    
    if generator is None:
        raise ValueError(f"Unknown report: {report_id}")
    
    return generator.generate(parameters)


def export_report(report_id: str, format: ReportFormat, parameters: Dict[str, Any]) -> bytes:
    """Export report in specified format"""
    report_data = generate_report(report_id, parameters)
    
    if format == ReportFormat.JSON:
        return json.dumps({
            "report": report_data.report_type,
            "generated_at": report_data.generated_at.isoformat(),
            "data": report_data.data,
            "summary": report_data.summary
        }, indent=2).encode('utf-8')
    
    elif format == ReportFormat.CSV:
        import csv
        import io
        
        if not report_data.data:
            return b""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=report_data.data[0].keys())
        writer.writeheader()
        writer.writerows(report_data.data)
        
        return output.getvalue().encode('utf-8')
    
    # For PDF and Excel, would need additional libraries
    # This is a placeholder
    return json.dumps({"message": f"Export to {format} not implemented"}).encode('utf-8')
