"""
Base ERP Connector Framework

Abstract base class for all ERP connectors with common interface
for data extraction, authentication, and transformation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional, Literal
import logging
import time
import uuid

from india_compliance.gst_india.erp_connectors.exceptions import (
    AuthenticationError,
    ConnectionError,
    DataExtractionError,
    RateLimitError,
    SyncError,
)


# Data Classes for Standardized Data Models
@dataclass
class Invoice:
    """Standardized Invoice model for GST"""
    # Basic Info
    invoice_number: str
    invoice_date: str
    invoice_value: float
    place_of_supply: str
    
    # Customer Info
    customer_name: str
    customer_gstin: Optional[str] = None
    
    # GST Category
    gst_category: str = "B2B"  # B2B, B2CL, B2CS, EXP, CDNR, CDNUR, NIL_EXEMPT
    
    # Tax Details
    taxable_value: float = 0.0
    rate: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    
    # Item Details
    hsn_code: Optional[str] = None
    quantity: Optional[float] = None
    uom: Optional[str] = None
    item_description: Optional[str] = None
    
    # Flags
    is_return: bool = False
    is_debit_note: bool = False
    reverse_charge: bool = False
    
    # Additional
    port_code: Optional[str] = None
    shipping_bill_no: Optional[str] = None
    shipping_bill_date: Optional[str] = None
    
    # Metadata
    source_invoice_id: Optional[str] = None
    source_system: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Item:
    """Standardized Item/Product model for GST"""
    item_code: str
    item_name: str
    hsn_code: str
    tax_rate: float
    unit: Optional[str] = None
    is_exempt: bool = False
    is_gst_applicable: bool = True
    
    # Additional
    source_item_id: Optional[str] = None
    source_system: Optional[str] = None


@dataclass
class Contact:
    """Standardized Contact/Customer model for GST"""
    name: str
    gstin: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_registered: bool = False
    
    # Additional
    source_contact_id: Optional[str] = None
    source_system: Optional[str] = None


@dataclass
class SyncResult:
    """Result of a sync operation"""
    sync_id: str
    connector_type: str
    connection_id: str
    status: Literal["success", "partial", "failed"]
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    # Counts
    invoices_extracted: int = 0
    invoices_imported: int = 0
    items_extracted: int = 0
    contacts_extracted: int = 0
    
    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    
    # Metadata
    sync_type: str = "full"  # full, incremental
    records_processed: int = 0


# Authentication Types
@dataclass
class AuthConfig:
    """Authentication configuration"""
    auth_type: str  # api_key, oauth2, basic, custom_header
    credentials: Dict[str, str] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    
    # OAuth2 specific
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    
    # Rate limiting
    rate_limit_calls: int = 100
    rate_limit_period: int = 60  # seconds


# Connection Configuration
@dataclass
class ConnectionConfig:
    """Connection configuration for an ERP"""
    connection_id: str
    connector_type: str
    name: str
    
    # Connection Details
    base_url: str
    port: Optional[int] = None
    
    # Authentication
    auth: AuthConfig
    
    # Settings
    is_active: bool = True
    is_default: bool = False
    
    # Sync Settings
    default_sync_type: str = "incremental"
    sync_interval_minutes: int = 60
    
    # Field Mappings
    field_mappings: Dict[str, Any] = field(default_factory=dict)


# Base Connector Class
class ERPConnector(ABC):
    """
    Abstract base class for all ERP connectors.
    
    All ERP connectors must implement these methods:
    - authenticate()
    - extract_invoices()
    - extract_items()
    - extract_contacts()
    """
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        self._authenticated = False
        self._last_request_time = 0
        self._request_count = 0
        
    # ==================== Abstract Methods ====================
    
    @abstractmethod
    def authenticate(self) -> bool:
        """
        Authenticate with the ERP system.
        
        Returns:
            bool: True if authentication successful
            
        Raises:
            AuthenticationError: If authentication fails
        """
        pass
    
    @abstractmethod
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        **kwargs
    ) -> List[Invoice]:
        """
        Extract invoices from the ERP system.
        
        Args:
            start_date: Start date for extraction (YYYY-MM-DD)
            end_date: End date for extraction (YYYY-MM-DD)
            **kwargs: Additional connector-specific parameters
            
        Returns:
            List of Invoice objects
        """
        pass
    
    @abstractmethod
    def extract_items(self, **kwargs) -> List[Item]:
        """
        Extract items/products from the ERP system.
        
        Args:
            **kwargs: Additional connector-specific parameters
            
        Returns:
            List of Item objects
        """
        pass
    
    @abstractmethod
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """
        Extract contacts/customers from the ERP system.
        
        Args:
            **kwargs: Additional connector-specific parameters
            
        Returns:
            List of Contact objects
        """
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to the ERP system.
        
        Returns:
            Dict with connection test results
        """
        pass
    
    # ==================== Common Methods ====================
    
    def is_authenticated(self) -> bool:
        """Check if currently authenticated"""
        return self._authenticated
    
    def disconnect(self):
        """Disconnect from the ERP system"""
        self._authenticated = False
        self.logger.info(f"Disconnected from {self.config.connector_type}")
    
    def get_last_sync_info(self) -> Optional[Dict[str, Any]]:
        """Get information about the last sync"""
        return getattr(self, '_last_sync', None)
    
    # ==================== Rate Limiting ====================
    
    def _check_rate_limit(self):
        """Check and enforce rate limits"""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        
        if elapsed < 1:  # Within a second
            self._request_count += 1
            if self._request_count > self.config.auth.rate_limit_calls:
                wait_time = 1 - elapsed
                self.logger.warning(f"Rate limit reached, waiting {wait_time:.2f}s")
                time.sleep(wait_time)
                self._request_count = 0
        else:
            self._request_count = 0
            
        self._last_request_time = current_time
    
    def _handle_rate_limit(self, response):
        """Handle rate limit response from API"""
        retry_after = response.headers.get('Retry-After')
        raise RateLimitError(
            "Rate limit exceeded",
            retry_after=int(retry_after) if retry_after else 60
        )
    
    # ==================== Retry Logic ====================
    
    def _retry_with_backoff(
        self,
        func,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        backoff_factor: float = 2.0
    ):
        """Execute function with exponential backoff retry"""
        delay = initial_delay
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return func()
            except RateLimitError as e:
                self.logger.warning(f"Rate limit hit, attempt {attempt + 1}/{max_retries}")
                wait_time = e.retry_after or delay
                time.sleep(wait_time)
                delay *= backoff_factor
                last_error = e
            except ConnectionError as e:
                self.logger.warning(f"Connection error, attempt {attempt + 1}/{max_retries}")
                time.sleep(delay)
                delay *= backoff_factor
                last_error = e
            except Exception as e:
                last_error = e
                break
        
        raise last_error
    
    # ==================== Data Transformation ====================
    
    def transform_invoice(self, raw_data: Dict[str, Any]) -> Invoice:
        """
        Transform raw invoice data to standardized Invoice model.
        
        This method can be overridden by subclasses for custom transformation.
        """
        # Get field mappings or use defaults
        mappings = self.config.field_mappings.get('invoice', {})
        
        # Extract fields with fallbacks
        invoice = Invoice(
            invoice_number=self._get_mapped_value(raw_data, mappings, 'invoice_number', 'invoice_number'),
            invoice_date=self._get_mapped_value(raw_data, mappings, 'invoice_date', 'invoice_date'),
            invoice_value=float(self._get_mapped_value(raw_data, mappings, 'invoice_value', 'invoice_value', 0)),
            place_of_supply=self._get_mapped_value(raw_data, mappings, 'place_of_supply', 'place_of_supply'),
            customer_name=self._get_mapped_value(raw_data, mappings, 'customer_name', 'customer_name'),
            customer_gstin=self._get_mapped_value(raw_data, mappings, 'customer_gstin', 'customer_gstin'),
            gst_category=self._get_mapped_value(raw_data, mappings, 'gst_category', 'gst_category', 'B2B'),
            taxable_value=float(self._get_mapped_value(raw_data, mappings, 'taxable_value', 'taxable_value', 0)),
            rate=float(self._get_mapped_value(raw_data, mappings, 'rate', 'rate', 0)),
            igst=float(self._get_mapped_value(raw_data, mappings, 'igst', 'igst', 0)),
            cgst=float(self._get_mapped_value(raw_data, mappings, 'cgst', 'cgst', 0)),
            sgst=float(self._get_mapped_value(raw_data, mappings, 'sgst', 'sgst', 0)),
            cess=float(self._get_mapped_value(raw_data, mappings, 'cess', 'cess', 0)),
            hsn_code=self._get_mapped_value(raw_data, mappings, 'hsn_code', 'hsn_code'),
            quantity=self._get_mapped_value(raw_data, mappings, 'quantity', 'quantity'),
            uom=self._get_mapped_value(raw_data, mappings, 'uom', 'uom'),
            is_return=bool(self._get_mapped_value(raw_data, mappings, 'is_return', 'is_return', False)),
            is_debit_note=bool(self._get_mapped_value(raw_data, mappings, 'is_debit_note', 'is_debit_note', False)),
            reverse_charge=bool(self._get_mapped_value(raw_data, mappings, 'reverse_charge', 'reverse_charge', False)),
            source_system=self.config.connector_type,
            raw_data=raw_data
        )
        
        return invoice
    
    def transform_item(self, raw_data: Dict[str, Any]) -> Item:
        """Transform raw item data to standardized Item model"""
        mappings = self.config.field_mappings.get('item', {})
        
        item = Item(
            item_code=self._get_mapped_value(raw_data, mappings, 'item_code', 'item_code'),
            item_name=self._get_mapped_value(raw_data, mappings, 'item_name', 'item_name'),
            hsn_code=self._get_mapped_value(raw_data, mappings, 'hsn_code', 'hsn_code', '99999999'),
            tax_rate=float(self._get_mapped_value(raw_data, mappings, 'tax_rate', 'tax_rate', 0)),
            unit=self._get_mapped_value(raw_data, mappings, 'unit', 'unit'),
            is_exempt=bool(self._get_mapped_value(raw_data, mappings, 'is_exempt', 'is_exempt', False)),
            source_system=self.config.connector_type
        )
        
        return item
    
    def transform_contact(self, raw_data: Dict[str, Any]) -> Contact:
        """Transform raw contact data to standardized Contact model"""
        mappings = self.config.field_mappings.get('contact', {})
        
        contact = Contact(
            name=self._get_mapped_value(raw_data, mappings, 'name', 'name'),
            gstin=self._get_mapped_value(raw_data, mappings, 'gstin', 'gstin'),
            email=self._get_mapped_value(raw_data, mappings, 'email', 'email'),
            phone=self._get_mapped_value(raw_data, mappings, 'phone', 'phone'),
            address=self._get_mapped_value(raw_data, mappings, 'address', 'address'),
            state=self._get_mapped_value(raw_data, mappings, 'state', 'state'),
            pincode=self._get_mapped_value(raw_data, mappings, 'pincode', 'pincode'),
            is_registered=bool(self._get_mapped_value(raw_data, mappings, 'is_registered', 'is_registered', False)),
            source_system=self.config.connector_type
        )
        
        return contact
    
    def _get_mapped_value(
        self,
        data: Dict[str, Any],
        mappings: Dict[str, str],
        key: str,
        default_key: str,
        default: Any = None
    ) -> Any:
        """Get value with field mapping support"""
        # Try mapped key first
        if key in mappings:
            mapped_key = mappings[key]
            if mapped_key in data:
                return data[mapped_key]
        
        # Try default key
        if default_key in data:
            return data[default_key]
        
        return default
    
    # ==================== Validation ====================
    
    def validate_invoice(self, invoice: Invoice) -> List[Dict[str, Any]]:
        """Validate invoice data"""
        errors = []
        
        # Required fields
        if not invoice.invoice_number:
            errors.append({"field": "invoice_number", "message": "Invoice number is required"})
        
        if not invoice.invoice_date:
            errors.append({"field": "invoice_date", "message": "Invoice date is required"})
        
        if invoice.invoice_value is None or invoice.invoice_value < 0:
            errors.append({"field": "invoice_value", "message": "Invalid invoice value"})
        
        if not invoice.place_of_supply:
            errors.append({"field": "place_of_supply", "message": "Place of supply is required"})
        
        # GSTIN validation for registered customers
        if invoice.customer_name and invoice.gst_category == "B2B":
            if invoice.customer_gstin and not self._validate_gstin(invoice.customer_gstin):
                errors.append({"field": "customer_gstin", "message": "Invalid GSTIN format"})
        
        return errors
    
    def _validate_gstin(self, gstin: str) -> bool:
        """Validate GSTIN format"""
        import re
        pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        return bool(re.match(pattern, gstin.upper()))
    
    # ==================== Sync Operations ====================
    
    def create_sync_result(self, sync_type: str = "full") -> SyncResult:
        """Create a new sync result tracker"""
        return SyncResult(
            sync_id=str(uuid.uuid4()),
            connector_type=self.config.connector_type,
            connection_id=self.config.connection_id,
            status="success",
            started_at=datetime.now(),
            sync_type=sync_type
        )


# Connector Registry
class ConnectorRegistry:
    """Registry for available ERP connectors"""
    
    _connectors: Dict[str, type] = {}
    
    @classmethod
    def register(cls, connector_type: str, connector_class: type):
        """Register a connector class"""
        cls._connectors[connector_type] = connector_class
        logging.info(f"Registered connector: {connector_type}")
    
    @classmethod
    def get_connector(cls, connector_type: str) -> Optional[type]:
        """Get connector class by type"""
        return cls._connectors.get(connector_type)
    
    @classmethod
    def get_available_connectors(cls) -> List[str]:
        """Get list of available connector types"""
        return list(cls._connectors.keys())
    
    @classmethod
    def create_connector(cls, connector_type: str, config: ConnectionConfig) -> ERPConnector:
        """Create a connector instance"""
        connector_class = cls.get_connector(connector_type)
        if not connector_class:
            raise ValueError(f"Unknown connector type: {connector_type}")
        return connector_class(config)
