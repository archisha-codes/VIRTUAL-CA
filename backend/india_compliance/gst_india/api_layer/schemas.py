"""
GST India API Layer - Pydantic Schemas

Request and Response models for the GST compliance platform API.
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# Enums
class ReturnType(str, Enum):
    GSTR1 = "GSTR-1"
    GSTR2B = "GSTR-2B"
    GSTR3B = "GSTR-3B"
    GSTR4 = "GSTR-4"
    GSTR6 = "GSTR-6"
    GSTR7 = "GSTR-7"
    GSTR8 = "GSTR-8"
    GSTR9 = "GSTR-9"


class FilingStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    FILED = "filed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PENDING = "pending"


class InvoiceCategory(str, Enum):
    B2B = "B2B"
    B2CL = "B2CL"
    B2CS = "B2CS"
    EXP = "EXP"
    CDNR = "CDNR"
    CDNUR = "CDNUR"
    NIL_EXEMPT = "NIL_EXEMPT"


class ValidationLevel(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


# Base Schemas
class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=1000)


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    total_pages: int


# Client & GSTIN Schemas
class ClientBase(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=255, description="Name of the business")
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", description="GSTIN of the business")
    state: str = Field(..., description="State where the business is registered")
    email: Optional[str] = None
    phone: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class ClientResponse(ClientBase, TimestampMixin):
    id: str
    gstins: List["GSTINResponse"] = []

    class Config:
        from_attributes = True


class GSTINBase(BaseModel):
    gstin: str = Field(..., pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    legal_name: str
    trade_name: Optional[str] = None
    state: str
    registration_type: Literal["Regular", "Composition", "SEZ", "Deemed Export", "Input Service Distributor"] = "Regular"
    is_active: bool = True


class GSTINCreate(GSTINBase):
    client_id: str


class GSTINUpdate(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    is_active: Optional[bool] = None


class GSTINResponse(GSTINBase, TimestampMixin):
    id: str
    client_id: str
    last_filed_period: Optional[str] = None

    class Config:
        from_attributes = True


# Invoice Schemas
class InvoiceBase(BaseModel):
    invoice_number: str
    invoice_date: str
    invoice_value: float
    place_of_supply: str
    customer_name: Optional[str] = None
    gstin: Optional[str] = None
    gst_category: Optional[str] = "Unregistered"
    taxable_value: float = 0.0
    rate: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    hsn_code: Optional[str] = None
    quantity: Optional[float] = None
    uom: Optional[str] = None
    is_return: bool = False
    is_debit_note: bool = False
    reverse_charge: bool = False
    gst_treatment: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    client_id: Optional[str] = None
    gstin_id: Optional[str] = None
    return_type: ReturnType = ReturnType.GSTR1
    return_period: Optional[str] = None


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_value: Optional[float] = None
    place_of_supply: Optional[str] = None
    customer_name: Optional[str] = None
    gstin: Optional[str] = None
    gst_category: Optional[str] = None
    taxable_value: Optional[float] = None
    rate: Optional[float] = None
    igst: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    cess: Optional[float] = None
    hsn_code: Optional[str] = None
    quantity: Optional[float] = None
    uom: Optional[str] = None
    is_return: Optional[bool] = None
    is_debit_note: Optional[bool] = None


class InvoiceResponse(InvoiceBase, TimestampMixin):
    id: str
    client_id: Optional[str] = None
    gstin_id: Optional[str] = None
    return_type: str
    return_period: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceListParams(PaginationParams):
    client_id: Optional[str] = None
    gstin_id: Optional[str] = None
    return_type: Optional[ReturnType] = None
    return_period: Optional[str] = None
    gst_category: Optional[str] = None
    search: Optional[str] = None


# GSTR Return Schemas
class GSTR1UploadRequest(BaseModel):
    gstin: str
    return_period: str
    file_data: Optional[str] = None  # Base64 encoded file
    file_name: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None


class GSTR1UploadResponse(BaseModel):
    success: bool
    message: str
    filing_id: str
    records_processed: int
    errors: List[str] = []
    warnings: List[str] = []


class GSTR1DataResponse(BaseModel):
    gstin: str
    return_period: str
    filing_id: str
    status: FilingStatus
    b2b: List[Dict[str, Any]] = []
    b2cl: List[Dict[str, Any]] = []
    b2cs: List[Dict[str, Any]] = []
    exp: List[Dict[str, Any]] = []
    cdnr: List[Dict[str, Any]] = []
    cdnur: List[Dict[str, Any]] = []
    hsn: List[Dict[str, Any]] = []
    summary: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime


class GSTR1UpdateRequest(BaseModel):
    data: Dict[str, Any]


class GSTR1ValidateRequest(BaseModel):
    filing_id: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None


class GSTR1ValidateResponse(BaseModel):
    filing_id: str = ""
    valid: bool = True
    is_valid: bool = True
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    total_invoices: int = 0
    total_errors: int = 0
    success: bool = True


class GSTR1CalculateRequest(BaseModel):
    filing_id: str


class GSTR1CalculateResponse(BaseModel):
    filing_id: str
    taxable_value: float
    igst: float
    cgst: float
    sgst: float
    cess: float
    total_liability: float


class GSTR1FileRequest(BaseModel):
    filing_id: str
    username: str


class GSTR1FileResponse(BaseModel):
    filing_id: str
    success: bool
    ack_number: Optional[str] = None
    filing_date: Optional[datetime] = None
    message: str


# Similar schemas for other GSTR types
class GSTR2BRequest(BaseModel):
    gstin: str
    return_period: str


class GSTR2BResponse(BaseModel):
    gstin: str
    return_period: str
    filing_id: str
    status: FilingStatus
    data: Dict[str, Any] = {}
    created_at: datetime


class GSTR3BRequest(BaseModel):
    gstin: str
    return_period: str


class GSTR3BComputeResponse(BaseModel):
    """Response for GSTR-3B tax computation"""
    gstin: str
    return_period: str
    output_tax: float  # sales tax (output tax liability)
    input_tax: float  # purchase tax (input tax credit)
    payable: float  # net tax = output_tax - input_tax


class GSTR3BResponse(BaseModel):
    gstin: str
    return_period: str
    filing_id: str
    status: FilingStatus
    data: Dict[str, Any] = {}
    summary: Dict[str, Any] = {}
    created_at: datetime


# ============================================================================
# GSTR-3B AUTO-POPULATION RESPONSE SCHEMAS (Enhanced)
# ============================================================================

class TaxAmount(BaseModel):
    """Standard tax amount structure with IGST, CGST, SGST, CESS"""
    igst: float = Field(default=0.0, ge=0.0, description="Integrated GST")
    cgst: float = Field(default=0.0, ge=0.0, description="Central GST")
    sgst: float = Field(default=0.0, ge=0.0, description="State GST")
    cess: float = Field(default=0.0, ge=0.0, description="Cess")


class SupplyTable(BaseModel):
    """Standard supply table structure with status tracking"""
    taxable_value: float = Field(default=0.0, ge=0.0, description="Total taxable value")
    igst: float = Field(default=0.0, ge=0.0)
    cgst: float = Field(default=0.0, ge=0.0)
    sgst: float = Field(default=0.0, ge=0.0)
    cess: float = Field(default=0.0, ge=0.0)
    invoice_count: int = Field(default=0, ge=0, description="Number of invoices")
    credit_note_count: int = Field(default=0, ge=0, description="Number of credit notes")
    source: str = Field(default="", description="Data source (e.g., GSTR-1 Tables 4, 5, 6C)")
    status: Literal["Filed", "Not filed", "Partial"] = Field(default="Not filed", description="Filing status")


class OutwardSupplies(BaseModel):
    """Section 3.1 - Details of Outward Supplies"""
    
    table_3_1_a: SupplyTable = Field(
        ..., 
        description="Outward taxable supplies (other than zero rated, nil rated and exempted)"
    )
    table_3_1_b: SupplyTable = Field(
        ..., 
        description="Zero rated supplies (exports) and Deemed Exports"
    )
    table_3_1_c: SupplyTable = Field(
        ..., 
        description="Nil rated, exempted and non-GST supplies"
    )
    table_3_1_d: SupplyTable = Field(
        ..., 
        description="Inward supplies (liable to reverse charge)"
    )
    table_3_1_e: SupplyTable = Field(
        ..., 
        description="Non-GST outward supplies"
    )


class InterStateSupplies(BaseModel):
    """Section 3.2 - Inter-State Supplies to Unregistered Persons"""
    description: str = "Supplies made to Unregistered Persons (B2C)"
    summary: Dict[str, Dict[str, float]] = Field(default_factory=dict, description="State-wise breakdown")
    total_taxable_value: float = 0.0
    total_igst: float = 0.0
    status: Literal["Filed", "Not filed"] = "Not filed"


class ITCSection(BaseModel):
    """Base structure for ITC sections"""
    available_igst: float = 0.0
    available_cgst: float = 0.0
    available_sgst: float = 0.0
    available_cess: float = 0.0
    blocked_igst: float = 0.0
    blocked_cgst: float = 0.0
    blocked_sgst: float = 0.0
    blocked_cess: float = 0.0


class ITCDetails(BaseModel):
    """Section 4 - Input Tax Credit"""
    section_4a: Dict[str, Any] = Field(
        default_factory=dict, 
        description="ITC Available - 4A (imports and inward supplies)"
    )
    section_4b: Dict[str, Any] = Field(
        default_factory=dict, 
        description="ITC Reversed/Blocked - 4B (reversals and disallowances)"
    )
    section_4c: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Net ITC Available - 4C (4A minus 4B)"
    )
    status: Literal["Generated", "Not generated", "Partial"] = "Not generated"
    note: str = "ITC flow: 4A (Available) → 4B (Reversed) → 4C (Net)"


class TaxSummary(BaseModel):
    """Tax calculation summary"""
    outward_tax_liability: TaxAmount = Field(default_factory=TaxAmount)
    rcm_tax_liability: TaxAmount = Field(default_factory=TaxAmount)
    total_liability: TaxAmount = Field(default_factory=TaxAmount)
    total_itc: TaxAmount = Field(default_factory=TaxAmount)
    total_payable: TaxAmount = Field(default_factory=TaxAmount)


class ComplianceMetadata(BaseModel):
    """Compliance and metadata information"""
    strict_mapping_applied: bool = True
    decimal_precision: str = "2 decimal places"
    negative_values_rule: str = "Default to zero"
    auto_populated_sections: List[str] = Field(
        default=["3.1a", "3.1b", "3.1c", "3.1d", "3.1e", "3.2", "4a", "4b", "4c"]
    )
    manual_entry_sections: List[str] = Field(
        default=["Section 5", "Section 6"]
    )


class FilingStatusFlags(BaseModel):
    """Status flags indicating data availability"""
    gstr1_filed: bool = Field(
        False, 
        description="GSTR-1 filed flag. If false, outward supply tables (3.1a-e, 3.2) return 'Not filed'"
    )
    gstr2b_generated: bool = Field(
        False, 
        description="GSTR-2B generated flag. If false, inward supply (3.1d) and ITC (4) return 'Not generated'"
    )


class GSTR3BAutoPopulateResponse(BaseModel):
    """
    Comprehensive GSTR-3B auto-population response with status flags.
    
    This response includes:
    - All auto-populated sections from GSTR-1 and GSTR-2B
    - Status flags indicating data availability
    - Separation of invoices from credit notes within same month
    - Complete tax computation summary
    - Compliance metadata
    """
    
    # Metadata
    metadata: Dict[str, Any] = Field(
        ..., 
        description="Metadata including GSTIN, return period, filing mode"
    )
    
    # Filing status flags
    filing_status: FilingStatusFlags = Field(
        ..., 
        description="Status flags for GSTR-1 and GSTR-2B data availability"
    )
    
    # Section 3 - Outward Supplies
    section_3_1: OutwardSupplies = Field(
        ..., 
        description="Section 3.1 - Details of Outward Supplies"
    )
    section_3_2: InterStateSupplies = Field(
        ..., 
        description="Section 3.2 - Inter-State Supplies to Unregistered Persons"
    )
    
    # Section 4 - ITC
    section_4: ITCDetails = Field(
        ..., 
        description="Section 4 - Input Tax Credit (ITC) with status flag"
    )
    
    # Tax Summary
    tax_summary: TaxSummary = Field(
        ..., 
        description="Complete tax calculation summary"
    )
    
    # Compliance & Metadata
    compliance: ComplianceMetadata = Field(
        default_factory=ComplianceMetadata,
        description="Compliance rules and metadata"
    )
    
    # Timestamps
    generated_at: datetime = Field(default_factory=datetime.now)
    generated_by: str = "GSTR-3B Auto-Population Engine"
    
    class Config:
        json_schema_extra = {
            "example": {
                "metadata": {
                    "gstin": "27AABCT1234C1Z5",
                    "return_period": "122025",
                    "taxpayer_name": "Company Name",
                    "filing_mode": "auto_populated"
                },
                "filing_status": {
                    "gstr1_filed": True,
                    "gstr2b_generated": True
                },
                "section_3_1": {},
                "section_3_2": {},
                "section_4": {},
                "tax_summary": {}
            }
        }


# Validation Schemas
class ValidationRuleResponse(BaseModel):
    id: str
    rule_code: str
    rule_name: str
    description: str
    return_type: ReturnType
    category: str
    severity: ValidationLevel
    is_active: bool = True


class ValidationRequest(BaseModel):
    filing_id: str
    rules: Optional[List[str]] = None  # If not provided, run all active rules


class ValidationResultResponse(BaseModel):
    id: str
    filing_id: str
    return_type: ReturnType
    valid: bool
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    info: List[Dict[str, Any]] = []
    created_at: datetime


# Reconciliation Schemas
class ReconciliationRequest(BaseModel):
    gstin: str
    return_period: str
    source_filing_id: str
    target_filing_id: Optional[str] = None


class ReconciliationResultResponse(BaseModel):
    id: str
    gstin: str
    return_period: str
    status: str
    matched_invoices: int
    unmatched_source: List[Dict[str, Any]] = []
    unmatched_target: List[Dict[str, Any]] = []
    discrepancies: List[Dict[str, Any]] = []
    created_at: datetime


# Purchase Register vs GSTR2B Reconciliation Schemas
class PurchaseInvoice(BaseModel):
    """Purchase register invoice from books"""
    invoice_number: str
    invoice_date: str
    gstin: str
    supplier_name: str
    taxable_value: float
    tax_amount: float
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0


class GSTR2BInvoice(BaseModel):
    """GSTR2B invoice from government data"""
    invoice_number: str
    invoice_date: str
    gstin: str
    supplier_name: str
    taxable_value: float
    tax_amount: float
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0


class ReconciliationMatchItem(BaseModel):
    """Single reconciliation match result"""
    purchase_invoice: Optional[PurchaseInvoice] = None
    gstr2b_invoice: Optional[GSTR2BInvoice] = None
    match_status: str  # exact_match, mismatch, missing_in_gstr2b, missing_in_books
    match_details: Dict[str, Any] = {}


class PurchaseReconciliationRequest(BaseModel):
    """Request for purchase register vs GSTR2B reconciliation"""
    gstin: str
    return_period: str
    purchase_invoices: List[PurchaseInvoice] = []
    gstr2b_invoices: List[GSTR2BInvoice] = []


class PurchaseReconciliationResponse(BaseModel):
    """Response for purchase register vs GSTR2B reconciliation"""
    gstin: str
    return_period: str
    total_purchase_invoices: int
    total_gstr2b_invoices: int
    exact_matches: int
    mismatches: int
    missing_in_gstr2b: int
    missing_in_books: int
    matched_invoices: List[ReconciliationMatchItem]
    created_at: datetime


# Report Enums
class ReportCategory(str, Enum):
    FILING_COMPLIANCE = "filing_compliance"
    TAX_LIABILITY = "tax_liability"
    ITC_CREDIT = "itc_credit"
    TRANSACTIONS = "transactions"
    RECONCILIATION = "reconciliation"
    ANALYTICS_TRENDS = "analytics_trends"


class ReportFormat(str, Enum):
    JSON = "json"
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"


class ReportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Report Schemas
class ReportParameterSchema(BaseModel):
    name: str
    param_type: str
    required: bool = False
    default: Optional[Any] = None
    description: str = ""


class ReportColumnSchema(BaseModel):
    key: str
    label: str
    data_type: str = "string"
    sortable: bool = True
    format: Optional[str] = None


class ReportConfig(BaseModel):
    id: str
    name: str
    description: str
    category: ReportCategory
    return_type: str
    parameters: List[ReportParameterSchema] = []
    columns: List[ReportColumnSchema] = []
    enable_export: bool = True
    enable_scheduling: bool = True
    enable_drilldown: bool = True


class ReportGenerateRequest(BaseModel):
    report_id: str
    gstin: Optional[str] = None
    return_period: Optional[str] = None
    from_period: Optional[str] = None
    to_period: Optional[str] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    parameters: Dict[str, Any] = {}
    use_cache: bool = True


class ReportChartSchema(BaseModel):
    type: str
    title: str
    data: Any
    value_key: Optional[str] = None


class ReportDataSchema(BaseModel):
    report_id: str
    report_type: str
    parameters: Dict[str, Any]
    data: List[Dict[str, Any]]
    summary: Dict[str, Any]
    charts: List[ReportChartSchema] = []
    generated_at: datetime
    total_records: int
    execution_time_ms: float


class ReportResponse(BaseModel):
    report_id: str
    report_type: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    generated_at: Optional[datetime] = None


class ReportListResponse(BaseModel):
    reports: List[ReportConfig]
    categories: Dict[str, int]


class ReportScheduleRequest(BaseModel):
    report_id: str
    parameters: Dict[str, Any]
    frequency: str  # daily, weekly, monthly
    time: str = "00:00"
    format: str = "pdf"
    recipients: List[str] = []


class ReportScheduleResponse(BaseModel):
    schedule_id: str
    success: bool
    message: str


class ReportComparisonRequest(BaseModel):
    report_id: str
    parameters: Dict[str, Any]
    periods: List[str]


class ReportComparisonResponse(BaseModel):
    report_id: str
    periods: List[str]
    results: Dict[str, Any]
    comparisons: Dict[str, Any]


class AsyncJobResponse(BaseModel):
    job_id: str
    status: ReportStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# Filing Status Schemas
class FilingStatusResponse(BaseModel):
    gstin: str
    return_period: str
    return_type: ReturnType
    status: FilingStatus
    filing_date: Optional[datetime] = None
    ack_number: Optional[str] = None
    arn: Optional[str] = None


class FilingCalendarResponse(BaseModel):
    gstin: str
    events: List[Dict[str, Any]] = []


# File Upload Schema
class FileUploadResponse(BaseModel):
    success: bool
    message: str
    file_id: str
    records_count: int


# Health Check
class HealthCheckResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime


# Error Response
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


# ==================== AI Reconciliation Schemas ====================


class MatchCategoryEnum(str, Enum):
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


class AIRecconciliationRequest(BaseModel):
    """Request to run AI reconciliation"""
    gstin: str
    return_period: str
    sales_data: List[Dict[str, Any]] = []
    purchase_data: List[Dict[str, Any]] = []
    use_ml_matching: bool = True
    use_fuzzy_matching: bool = True
    use_anomaly_detection: bool = True
    confidence_threshold: float = 0.5


class AIRecconciliationResponse(BaseModel):
    """Response from AI reconciliation"""
    job_id: str
    status: str
    message: str
    total_sales: int = 0
    total_purchases: int = 0
    matched_count: int = 0
    match_rate: float = 0.0
    results_url: Optional[str] = None
    created_at: datetime


class MatchResultResponse(BaseModel):
    """Individual match result"""
    id: str
    sales_invoice: Dict[str, Any]
    purchase_invoice: Dict[str, Any]
    confidence: float
    confidence_display: str
    category: str
    category_display: str
    requires_review: bool
    eligible_for_itc: bool
    explanation: str
    color: str
    match_factors: Dict[str, float] = {}
    discrepancies: List[str] = []


class AIRecconciliationResultResponse(BaseModel):
    """Complete AI reconciliation results"""
    job_id: str
    gstin: str
    return_period: str
    status: str
    total_sales_invoices: int
    total_purchase_invoices: int
    matches: List[MatchResultResponse]
    unmatched_sales: List[Dict[str, Any]]
    unmatched_purchases: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    statistics: Dict[str, Any] = {}
    created_at: datetime
    completed_at: Optional[datetime] = None


class UserFeedbackRequest(BaseModel):
    """User feedback on a match"""
    match_id: str
    user_decision: str  # confirm, reject, link, split
    linked_invoices: List[Dict[str, Any]] = []
    notes: str = ""
    user_id: str = ""


class UserFeedbackResponse(BaseModel):
    """Response after processing feedback"""
    success: bool
    message: str
    learning_result: Dict[str, Any] = {}


class ConfidenceScoreResponse(BaseModel):
    """Confidence score for a match"""
    match_id: str
    confidence: float
    confidence_display: str
    factors: Dict[str, float] = {}
    explanations: List[str] = []
    is_anomaly: bool
    anomaly_score: float = 0.0


class AnomalyResponse(BaseModel):
    """Anomaly detection results"""
    invoice: Dict[str, Any]
    anomaly_score: float
    is_anomaly: bool
    anomaly_reasons: List[str] = []


class AnomaliesListResponse(BaseModel):
    """List of detected anomalies"""
    anomalies: List[AnomalyResponse]
    total_count: int


class MatchConfirmRequest(BaseModel):
    """Request to confirm or reject a match"""
    match_id: str
    action: str  # confirm, reject
    notes: str = ""


class ManualLinkRequest(BaseModel):
    """Request to manually link invoices"""
    sales_invoice_id: str
    purchase_invoice_id: str
    notes: str = ""
    user_id: str = ""


class MatchRateAnalyticsResponse(BaseModel):
    """Match rate analytics"""
    total_invoices: int
    matched_invoices: int
    unmatched_invoices: int
    match_rate: float
    exact_match_rate: float
    fuzzy_match_rate: float
    ml_match_rate: float
    itc_claimed: float
    itc_pending: float


class TrendsResponse(BaseModel):
    """Historical trends"""
    trend: str
    message: str
    recent_rates: List[float]
    average_rate: float


class ReconciliationRulesResponse(BaseModel):
    """List of reconciliation rules"""
    rules: List[Dict[str, Any]]
    total_count: int


# Update forward refs
ClientResponse.model_rebuild()

# ==================== Workspace Schemas ====================


class WorkspaceRole(str, Enum):
    """Workspace member roles"""
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    VIEWER = "viewer"


class GSTINStatus(str, Enum):
    """GSTIN registration status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"


class RegistrationType(str, Enum):
    """GST registration type"""
    REGULAR = "regular"
    COMPOSITION = "composition"
    SEZ = "sez"
    ISD = "isd"
    DEEMED_EXPORT = "deemed_export"


class GSTINCategory(str, Enum):
    """GSTIN business category"""
    B2B = "b2b"
    B2C = "b2c"
    EXPORT = "export"
    SEZ = "sez"
    COMPOSITION = "composition"
    ECOMMERCE = "ecommerce"
    MIXED = "mixed"


class WorkspaceSettingsSchema(BaseModel):
    """Workspace-level settings"""
    default_return_type: str = "GSTR-1"
    auto_reconciliation: bool = True
    consolidated_filing: bool = True
    timezone: str = "Asia/Kolkata"


class WorkspaceMemberSchema(BaseModel):
    """Workspace member model"""
    user_id: str
    role: WorkspaceRole = WorkspaceRole.VIEWER
    gstin_access: List[str] = []
    can_manage_members: bool = False
    can_manage_settings: bool = False
    can_file_returns: bool = False
    can_view_reports: bool = True


class GSTINRegistrationSchema(BaseModel):
    """GSTIN registration within a workspace"""
    id: Optional[str] = None
    workspace_id: Optional[str] = None
    gstin: str
    legal_name: str
    trade_name: Optional[str] = None
    state: str
    status: GSTINStatus = GSTINStatus.ACTIVE
    registration_type: RegistrationType = RegistrationType.REGULAR
    category: GSTINCategory = GSTINCategory.B2B
    is_default: bool = False
    can_file_returns: bool = True


class WorkspaceCreate(BaseModel):
    """Request to create a workspace"""
    pan: str
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    """Request to update a workspace"""
    name: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[WorkspaceSettingsSchema] = None


class WorkspaceResponse(BaseModel):
    """Workspace response"""
    id: str
    pan: str
    name: str
    description: Optional[str]
    owner_id: str
    members: List[WorkspaceMemberSchema] = []
    gstins: List[GSTINRegistrationSchema] = []
    settings: WorkspaceSettingsSchema
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WorkspaceSummaryResponse(BaseModel):
    """Summary of workspace for display"""
    id: str
    pan: str
    name: str
    description: Optional[str]
    gstin_count: int
    active_gstin_count: int
    member_count: int
    owner_id: str
    created_at: datetime


class GSTINCreate(BaseModel):
    """Request to add a GSTIN"""
    gstin: str
    legal_name: str
    trade_name: Optional[str] = None
    state: str
    registration_type: RegistrationType = RegistrationType.REGULAR
    category: GSTINCategory = GSTINCategory.B2B


class GSTINUpdate(BaseModel):
    """Request to update a GSTIN"""
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    status: Optional[GSTINStatus] = None
    registration_type: Optional[RegistrationType] = None
    category: Optional[GSTINCategory] = None
    is_default: Optional[bool] = None
    can_file_returns: Optional[bool] = None


class MemberCreate(BaseModel):
    """Request to add a member"""
    user_id: str
    role: WorkspaceRole = WorkspaceRole.VIEWER
    gstin_access: Optional[List[str]] = None


class MemberUpdate(BaseModel):
    """Request to update a member"""
    role: Optional[WorkspaceRole] = None
    gstin_access: Optional[List[str]] = None


class ActiveGstinResponse(BaseModel):
    """Current active GSTIN for a user"""
    gstin_id: str
    gstin: str
    legal_name: str
    workspace_id: str
    workspace_name: str
    state: str
    status: GSTINStatus


class BulkFileRequest(BaseModel):
    """Request for bulk filing"""
    return_type: str
    period: str


class BulkFilingResponse(BaseModel):
    """Response for bulk filing"""
    workspace_id: str
    return_type: str
    period: str
    total_gstins: int
    successful: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]
    pending: List[Dict[str, Any]]
    created_at: datetime


class ConsolidatedMetricsResponse(BaseModel):
    """Consolidated metrics"""
    total_gstins: int
    active_gstins: int
    inactive_gstins: int
    total_taxable_value: float
    total_igst: float
    total_cgst: float
    total_sgst: float
    total_cess: float
    total_liability: float
    total_itc: float
    filed_returns: int
    pending_returns: int
    overdue_returns: int
    period: str
    by_state: Dict[str, Dict[str, float]]
    by_category: Dict[str, Dict[str, float]]


# ==================== Dashboard Schemas ====================


class AnnouncementSchema(BaseModel):
    """Announcement schema"""
    id: str
    title: str
    content: str
    type: str = "info"  # info, warning, success, error
    priority: int = 0
    is_active: bool = True
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class NavigationItemSchema(BaseModel):
    """Navigation item schema"""
    id: str
    label: str
    icon: Optional[str] = None
    path: str
    badge: Optional[int] = None
    children: Optional[List[Dict[str, Any]]] = None


class FormModuleSchema(BaseModel):
    """Form module schema"""
    id: str
    name: str
    description: str
    icon: str
    return_type: str
    is_enabled: bool = True
    order: int = 0


class FormMetadataSchema(BaseModel):
    """Form metadata schema"""
    module: str
    return_type: str
    periods: List[str]
    last_filed_period: Optional[str] = None
    filing_status: Optional[str] = None
    due_date: Optional[str] = None
    sections: List[Dict[str, Any]] = []


class DashboardSummarySchema(BaseModel):
    """Dashboard summary schema"""
    total_businesses: int
    active_gstins: int
    pending_filings: int
    overdue_filings: int
    total_liability: float
    total_itc: float
    recent_activity: List[Dict[str, Any]] = []


# ==================== Settings Schemas ====================


class BusinessCreate(BaseModel):
    """Request to create a business"""
    name: str
    gstin: str
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: str


class BusinessUpdate(BaseModel):
    """Request to update a business"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None


class BusinessResponse(BaseModel):
    """Business response"""
    id: str
    name: str
    gstin: str
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserInviteRequest(BaseModel):
    """Request to invite a user"""
    email: str
    role: WorkspaceRole = WorkspaceRole.VIEWER
    gstin_access: Optional[List[str]] = None


class UserResponse(BaseModel):
    """User response"""
    id: str
    email: str
    name: Optional[str] = None
    role: WorkspaceRole
    gstin_access: List[str] = []
    can_manage_members: bool = False
    can_manage_settings: bool = False
    can_file_returns: bool = False
    can_view_reports: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None


class GSTINCredentialCreate(BaseModel):
    """Request to add GSTIN credentials"""
    gstin: str
    username: str
    password: str
    is_default: bool = False


class GSTINCredentialResponse(BaseModel):
    """GSTIN credential response"""
    id: str
    gstin: str
    username: str
    is_default: bool
    last_authenticated: Optional[datetime] = None
    created_at: datetime


class NICCredentialResponse(BaseModel):
    """NIC credential response"""
    id: str
    username: str
    is_default: bool
    created_at: datetime


class SubscriptionResponse(BaseModel):
    """Subscription response"""
    id: str
    plan: str
    status: str
    start_date: datetime
    end_date: datetime
    features: List[str] = []
    max_gstins: int
    max_users: int


class ProfileUpdate(BaseModel):
    """Request to update profile"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    timezone: Optional[str] = None


class ProfileResponse(BaseModel):
    """Profile response"""
    id: str
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    created_at: datetime
    last_login: Optional[datetime] = None


# ==================== Support Schemas ====================


class ConversationCreate(BaseModel):
    """Request to create a conversation"""
    subject: str
    category: str = "general"  # general, technical, billing, gst, filing
    priority: str = "normal"  # low, normal, high, urgent
    gstin: Optional[str] = None
    message: str


class ConversationResponse(BaseModel):
    """Conversation response"""
    id: str
    subject: str
    category: str
    priority: str
    status: str  # open, pending, resolved, closed
    workspace_id: str
    gstin: Optional[str] = None
    created_by: str
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None


class MessageCreate(BaseModel):
    """Request to create a message"""
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None


class MessageResponse(BaseModel):
    """Message response"""
    id: str
    conversation_id: str
    content: str
    sender_id: str
    sender_type: str  # user, support
    is_internal: bool = False
    attachments: List[Dict[str, Any]] = []
    reactions: List[Dict[str, Any]] = []
    created_at: datetime


class ReactionCreate(BaseModel):
    """Request to add a reaction"""
    emoji: str


class ReactionResponse(BaseModel):
    """Reaction response"""
    id: str
    message_id: str
    user_id: str
    emoji: str
    created_at: datetime
