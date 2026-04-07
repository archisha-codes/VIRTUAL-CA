"""
Data Mapper Module

Maps ERP-specific fields to GST schema.
Handles field transformation rules and custom field mappings.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable
import logging


@dataclass
class FieldMapping:
    """Field mapping configuration"""
    source_field: str
    target_field: str
    transform: Optional[str] = None  # Function name to apply
    default_value: Any = None
    required: bool = False


@dataclass
class TransformRule:
    """Transformation rule configuration"""
    name: str
    source_fields: List[str]
    target_field: str
    function: str  # Name of transformation function
    description: str = ""


@dataclass
class MappingConfig:
    """Complete mapping configuration for a connector"""
    connector_type: str
    version: str = "1.0"
    
    # Invoice mappings
    invoice_mappings: List[FieldMapping] = field(default_factory=list)
    
    # Item mappings
    item_mappings: List[FieldMapping] = field(default_factory=list)
    
    # Contact mappings
    contact_mappings: List[FieldMapping] = field(default_factory=list)
    
    # Transformation rules
    transform_rules: List[TransformRule] = field(default_factory=list)


class DataMapper:
    """
    Maps ERP data to GST schema with customizable transformations.
    """
    
    # Standard GST fields
    GST_INVOICE_FIELDS = {
        "invoice_number": "Invoice Number",
        "invoice_date": "Invoice Date",
        "invoice_value": "Invoice Value",
        "place_of_supply": "Place of Supply",
        "customer_name": "Customer Name",
        "customer_gstin": "Customer GSTIN",
        "gst_category": "GST Category",
        "taxable_value": "Taxable Value",
        "rate": "GST Rate",
        "igst": "IGST Amount",
        "cgst": "CGST Amount",
        "sgst": "SGST Amount",
        "cess": "CESS Amount",
        "hsn_code": "HSN Code",
        "quantity": "Quantity",
        "uom": "Unit of Measurement",
        "is_return": "Is Credit/Debit Note",
        "is_debit_note": "Is Debit Note",
        "reverse_charge": "Reverse Charge",
        "port_code": "Port Code",
        "shipping_bill_no": "Shipping Bill Number",
        "shipping_bill_date": "Shipping Bill Date",
    }
    
    GST_ITEM_FIELDS = {
        "item_code": "Item Code",
        "item_name": "Item Name",
        "hsn_code": "HSN Code",
        "tax_rate": "Tax Rate",
        "unit": "Unit",
        "is_exempt": "Is Exempt",
    }
    
    GST_CONTACT_FIELDS = {
        "name": "Name",
        "gstin": "GSTIN",
        "email": "Email",
        "phone": "Phone",
        "address": "Address",
        "state": "State",
        "pincode": "Pincode",
        "is_registered": "Is Registered",
    }
    
    def __init__(self, config: Optional[MappingConfig] = None):
        self.config = config or MappingConfig(connector_type="generic")
        self.logger = logging.getLogger("DataMapper")
        
        # Register built-in transformation functions
        self._register_builtin_transforms()
        
        # Custom transformation functions
        self.custom_transforms: Dict[str, Callable] = {}
    
    def _register_builtin_transforms(self):
        """Register built-in transformation functions"""
        self.transforms = {
            "uppercase": self._transform_uppercase,
            "lowercase": self._transform_lowercase,
            "trim": self._transform_trim,
            "date_format": self._transform_date_format,
            "date_parse": self._transform_date_parse,
            "number": self._transform_number,
            "gstin_format": self._transform_gstin_format,
            "state_code": self._transform_state_code,
            "hsn_code": self._transform_hsn_code,
            "rate_mapping": self._transform_rate_mapping,
            "category_mapping": self._transform_category_mapping,
            "tax_calculation": self._transform_tax_calculation,
            "default": self._transform_default,
        }
    
    def get_mapping_config(self, connector_type: str) -> MappingConfig:
        """Get default mapping configuration for a connector type"""
        
        mapping_configs = {
            "tally": self._get_tally_mappings(),
            "sap": self._get_sap_mappings(),
            "oracle": self._get_oracle_mappings(),
            "quickbooks": self._get_quickbooks_mappings(),
            "zoho": self._get_zoho_mappings(),
            "generic": self._get_generic_mappings(),
        }
        
        return mapping_configs.get(connector_type, self._get_generic_mappings())
    
    def map_invoice(self, source_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map source invoice data to GST format"""
        result = {}
        
        for mapping in self.config.invoice_mappings:
            value = self._get_value_from_source(source_data, mapping.source_field)
            
            if mapping.transform and value is not None:
                value = self._apply_transform(value, mapping.transform, source_data)
            
            if value is None:
                value = mapping.default_value
            
            result[mapping.target_field] = value
        
        return result
    
    def map_item(self, source_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map source item data to GST format"""
        result = {}
        
        for mapping in self.config.item_mappings:
            value = self._get_value_from_source(source_data, mapping.source_field)
            
            if mapping.transform and value is not None:
                value = self._apply_transform(value, mapping.transform, source_data)
            
            if value is None:
                value = mapping.default_value
            
            result[mapping.target_field] = value
        
        return result
    
    def map_contact(self, source_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map source contact data to GST format"""
        result = {}
        
        for mapping in self.config.contact_mappings:
            value = self._get_value_from_source(source_data, mapping.source_field)
            
            if mapping.transform and value is not None:
                value = self._apply_transform(value, mapping.transform, source_data)
            
            if value is None:
                value = mapping.default_value
            
            result[mapping.target_field] = value
        
        return result
    
    def _get_value_from_source(self, source: Dict[str, Any], path: str) -> Any:
        """Get value from nested source data using dot notation"""
        keys = path.split(".")
        value = source
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            elif isinstance(value, list) and key.isdigit():
                idx = int(key)
                value = value[idx] if idx < len(value) else None
            else:
                return None
            
            if value is None:
                return None
        
        return value
    
    def _apply_transform(
        self, 
        value: Any, 
        transform_name: str, 
        source_data: Dict[str, Any]
    ) -> Any:
        """Apply transformation function to value"""
        
        if transform_name in self.custom_transforms:
            return self.custom_transforms[transform_name](value, source_data)
        
        if transform_name in self.transforms:
            return self.transforms[transform_name](value, source_data)
        
        return value
    
    def register_transform(self, name: str, func: Callable):
        """Register custom transformation function"""
        self.custom_transforms[name] = func
    
    def _transform_uppercase(self, value: Any, source: Dict) -> str:
        return str(value).upper() if value else ""
    
    def _transform_lowercase(self, value: Any, source: Dict) -> str:
        return str(value).lower() if value else ""
    
    def _transform_trim(self, value: Any, source: Dict) -> str:
        return str(value).strip() if value else ""
    
    def _transform_date_format(self, value: Any, source: Dict) -> str:
        return str(value)
    
    def _transform_date_parse(self, value: Any, source: Dict) -> str:
        return str(value)
    
    def _transform_number(self, value: Any, source: Dict) -> float:
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _transform_gstin_format(self, value: Any, source: Dict) -> Optional[str]:
        if not value:
            return None
        
        gstin = str(value).upper().strip()
        
        import re
        pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if re.match(pattern, gstin):
            return gstin
        
        return None
    
    def _transform_state_code(self, value: Any, source: Dict) -> str:
        state_mapping = {
            "maharashtra": "27", "delhi": "07", "karnataka": "29",
            "tamil nadu": "33", "tamilnadu": "33", "gujarat": "24",
            "uttar pradesh": "09", "west bengal": "19", "rajasthan": "08",
            "madhya pradesh": "23", "telangana": "36", "andhra pradesh": "28",
            "kerala": "32", "punjab": "03", "haryana": "06",
            "uttarakhand": "05", "jharkhand": "20", "odisha": "21",
            "bihar": "10", "assam": "18", "chhattisgarh": "22",
        }
        
        state = str(value).lower().strip()
        return state_mapping.get(state, "27")
    
    def _transform_hsn_code(self, value: Any, source: Dict) -> str:
        if not value:
            return "99999999"
        
        hsn = str(value).strip()
        
        if len(hsn) in [4, 6, 8]:
            return hsn
        
        return "99999999"
    
    def _transform_rate_mapping(self, value: Any, source: Dict) -> float:
        rate_mapping = {
            "0": 0, "0.1": 0.1, "0.25": 0.25, "1": 1, "1.5": 1.5,
            "3": 3, "5": 5, "6": 6, "7": 7, "7.5": 7.5,
            "12": 12, "18": 18, "28": 28, "exempt": 0, "nil": 0, "zero": 0,
        }
        
        rate_str = str(value).lower().strip()
        return rate_mapping.get(rate_str, float(value) if value else 0)
    
    def _transform_category_mapping(self, value: Any, source: Dict) -> str:
        customer_gstin = source.get("customer_gstin") or source.get("gstin")
        
        if customer_gstin:
            return "B2B"
        
        export_fields = ["is_export", "export", "is_overseas"]
        for field in export_fields:
            if source.get(field):
                return "EXP"
        
        invoice_value = source.get("invoice_value", 0)
        if invoice_value and float(invoice_value) > 250000:
            return "B2CL"
        
        return "B2CS"
    
    def _transform_tax_calculation(self, value: Any, source: Dict) -> Dict[str, float]:
        taxable = float(source.get("taxable_value", 0) or 0)
        rate = float(source.get("rate", 0) or 0)
        
        total_tax = taxable * (rate / 100)
        
        return {"igst": total_tax, "cgst": 0, "sgst": 0, "cess": 0}
    
    def _transform_default(self, value: Any, source: Dict) -> Any:
        return value
    
    def _get_tally_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="tally",
            invoice_mappings=[
                FieldMapping("VoucherNumber", "invoice_number", "trim"),
                FieldMapping("VoucherDate", "invoice_date"),
                FieldMapping("VoucherTotal", "invoice_value", "number"),
                FieldMapping("PartyName", "customer_name"),
                FieldMapping("PartyLedgerName", "customer_gstin", "gstin_format"),
                FieldMapping("TaxableAmount", "taxable_value", "number"),
                FieldMapping("IGSTAmount", "igst", "number", 0),
                FieldMapping("CGSTAmount", "cgst", "number", 0),
                FieldMapping("SGSTAmount", "sgst", "number", 0),
            ],
            item_mappings=[
                FieldMapping("StockItemName", "item_name"),
                FieldMapping("HSNCode", "hsn_code", "hsn_code"),
                FieldMapping("Rate", "tax_rate", "rate_mapping"),
            ],
            contact_mappings=[
                FieldMapping("PartyName", "name"),
                FieldMapping("GSTIN", "gstin", "gstin_format"),
            ]
        )
    
    def _get_sap_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="sap",
            invoice_mappings=[
                FieldMapping("BELNR", "invoice_number"),
                FieldMapping("BLDAT", "invoice_date"),
                FieldMapping("WRBTR", "invoice_value", "number"),
                FieldMapping("NAME1", "customer_name"),
                FieldMapping("STCD3", "customer_gstin", "gstin_format"),
                FieldMapping("BWBTR", "taxable_value", "number"),
            ],
            item_mappings=[
                FieldMapping("MATNR", "item_code"),
                FieldMapping("MAKTX", "item_name"),
                FieldMapping("MTART", "item_type"),
            ],
            contact_mappings=[
                FieldMapping("NAME1", "name"),
                FieldMapping("STCD3", "gstin", "gstin_format"),
            ]
        )
    
    def _get_oracle_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="oracle",
            invoice_mappings=[
                FieldMapping("INVOICE_NUM", "invoice_number"),
                FieldMapping("INVOICE_DATE", "invoice_date"),
                FieldMapping("INVOICE_AMOUNT", "invoice_value", "number"),
                FieldMapping("VENDOR_NAME", "customer_name"),
                FieldMapping("GST_REGISTRATION_NUMBER", "customer_gstin", "gstin_format"),
                FieldMapping("AMOUNT", "taxable_value", "number"),
            ],
            item_mappings=[
                FieldMapping("SEGMENT1", "item_code"),
                FieldMapping("DESCRIPTION", "item_name"),
            ],
            contact_mappings=[
                FieldMapping("VENDOR_NAME", "name"),
                FieldMapping("GST_REGISTRATION_NUMBER", "gstin", "gstin_format"),
            ]
        )
    
    def _get_quickbooks_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="quickbooks",
            invoice_mappings=[
                FieldMapping("DocNumber", "invoice_number"),
                FieldMapping("TxnDate", "invoice_date"),
                FieldMapping("TotalAmt", "invoice_value", "number"),
                FieldMapping("CustomerRef.name", "customer_name"),
            ],
            item_mappings=[
                FieldMapping("Id", "item_code"),
                FieldMapping("Name", "item_name"),
            ],
            contact_mappings=[
                FieldMapping("DisplayName", "name"),
            ]
        )
    
    def _get_zoho_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="zoho",
            invoice_mappings=[
                FieldMapping("invoice_number", "invoice_number"),
                FieldMapping("date", "invoice_date"),
                FieldMapping("total", "invoice_value", "number"),
                FieldMapping("customer_name", "customer_name"),
                FieldMapping("customer.gstin", "customer_gstin", "gstin_format"),
                FieldMapping("sub_total", "taxable_value", "number"),
            ],
            item_mappings=[
                FieldMapping("item_id", "item_code"),
                FieldMapping("name", "item_name"),
                FieldMapping("hsn_code", "hsn_code", "hsn_code"),
            ],
            contact_mappings=[
                FieldMapping("contact_name", "name"),
                FieldMapping("gstin", "gstin", "gstin_format"),
            ]
        )
    
    def _get_generic_mappings(self) -> MappingConfig:
        return MappingConfig(
            connector_type="generic",
            invoice_mappings=[
                FieldMapping("invoice_number", "invoice_number", "trim", required=True),
                FieldMapping("invoice_date", "invoice_date", default_value=""),
                FieldMapping("invoice_value", "invoice_value", "number", 0),
                FieldMapping("customer_name", "customer_name", default_value=""),
                FieldMapping("customer_gstin", "customer_gstin", "gstin_format"),
                FieldMapping("taxable_value", "taxable_value", "number", 0),
                FieldMapping("rate", "rate", "rate_mapping", 0),
            ],
            item_mappings=[
                FieldMapping("item_code", "item_code"),
                FieldMapping("item_name", "item_name"),
                FieldMapping("hsn_code", "hsn_code", "hsn_code", "99999999"),
            ],
            contact_mappings=[
                FieldMapping("name", "name", required=True),
                FieldMapping("gstin", "gstin", "gstin_format"),
            ]
        )
    
    def export_mappings(self) -> Dict[str, Any]:
        """Export current mapping configuration"""
        return {
            "connector_type": self.config.connector_type,
            "version": self.config.version,
            "invoice_mappings": [
                {
                    "source": m.source_field,
                    "target": m.target_field,
                    "transform": m.transform,
                    "default": m.default_value,
                    "required": m.required
                }
                for m in self.config.invoice_mappings
            ],
        }
    
    def import_mappings(self, data: Dict[str, Any]):
        """Import mapping configuration"""
        self.config.connector_type = data.get("connector_type", "generic")
        self.config.version = data.get("version", "1.0")
        
        invoice_maps = data.get("invoice_mappings", [])
        self.config.invoice_mappings = [
            FieldMapping(
                m["source"],
                m["target"],
                m.get("transform"),
                m.get("default"),
                m.get("required", False)
            )
            for m in invoice_maps
        ]
