"""
Dynamic Header Mapping System for Client Excel Files

This module provides fuzzy matching and normalization for Excel column headers.
It handles various client formats and maps them to canonical internal field names.

Features:
- Comprehensive alias dictionary for all field variations
- Fuzzy matching with similarity threshold (>= 80%)
- Dynamic header row detection
- Automatic column normalization
- Safe numeric conversion (handles commas, currency symbols, parentheses)
- Auto-derivation of missing values
- Tolerance-based GST tax validation
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP


# =============================================================================
# CANONICAL FIELD NAMES
# =============================================================================

CANONICAL_FIELDS = {
    # Core invoice fields
    "gstin": "GSTIN of the customer/recipient",
    "invoice_number": "Invoice identification number",
    "invoice_date": "Date of invoice",
    "invoice_value": "Total invoice value",
    "taxable_value": "Taxable amount (before tax)",
    
    # Tax fields
    "rate": "GST tax rate percentage",
    "igst": "Integrated GST amount",
    "cgst": "Central GST amount",
    "sgst": "State GST amount",
    "cess": "CESS amount",
    
    # Product fields
    "hsn_code": "HSN/SAC code for goods/services",
    "quantity": "Item quantity",
    "uom": "Unit of measure",
    
    # Additional fields
    "place_of_supply": "Place of Supply (state code)",
    "reverse_charge": "Whether reverse charge applies",
    "document_type": "Type of document (Invoice/Credit Note/Debit Note)",
    "supply_type": "Type of supply (Export/Inter-state/Intra-state)",
    
    # E-invoice fields
    "irn": "Invoice Reference Number",
    "ack_no": "Acknowledgement number",
    "ack_date": "Acknowledgement date",
    
    # Customer fields
    "customer_name": "Name of customer/recipient",
    "customer_address": "Address of customer",
    
    # Note fields (for credit/debit notes)
    "note_number": "Note reference number",
    "note_date": "Date of note",
    "note_value": "Value of note",
}


# =============================================================================
# COMPREHENSIVE HEADER ALIAS DICTIONARY
# =============================================================================

HEADER_ALIASES: Dict[str, List[str]] = {
    # GSTIN variations
    "gstin": [
        # Direct variations
        "gstin", "gstin no", "gstin number", "gstin#",
        "gst no", "gst number", "gst no.", "gst number.",
        "gstn", "gstn no", "gstn number",
        "gst identification number",
        # Business/party variations
        "business tax id", "business tax number",
        "registration no", "registration number", "registration no.",
        "tax id", "tax number", "tax id no", "tax identification number",
        "party gst", "party gstin", "party gst no", "party gst number",
        "customer gst", "customer gstin", "customer gst no", "customer gst number",
        "vendor gst", "vendor gstin", "vendor gst no", "vendor gst number",
        "recipient gst", "recipient gstin",
        "buyer gst", "buyer gstin",
        "consignee gst", "consignee gstin",
        "tax number 3", "taxnumber3",
        "GSTIN/UIN", "GSTIN of Recipient", "GSTIN of B2B Recipient",
        "Recipient GSTIN", "GST Number", "GST No",
        # Business No (common variation)
        "business no", "business no.",
        # State/country variations
        "company gst", "company gstin",
    ],
    
    # Invoice Number variations
    "invoice_number": [
        # Standard variations
        "invoice no", "invoice number", "invoice no.", "invoice number.",
        "invoice#", "invoice #", "inv no", "inv number", "inv no.", "inv number.",
        "inv#", "inv #",
        # Document variations
        "bill no", "bill number", "bill no.", "bill number.",
        "bill#", "bill #",
        "document no", "document number", "document no.", "document number.",
        "doc no", "doc number", "doc no.", "doc number.",
        "voucher no", "voucher number", "voucher no.", "voucher number.",
        "voucher#", "voucher #",
        # Reference variations
        "ref no", "ref number", "reference no", "reference number",
        "transaction ref", "transaction reference",
        # Other
        "serial no", "serial number", "sl no", "sl number",
        "entry no", "entry number",
        "receipt no", "receipt number",
        "challan no", "challan number",
        "order no", "order number", "po no", "po number",
        "Invoice Number", "Invoice No", "Invoice No.", "Invoice#",
        "Bill Number", "Voucher Number", "Invoice",
        "Document Number", "Doc No", "Voucher No", "Voucher Number",
    ],
    
    # Invoice Date variations
    "invoice_date": [
        # Standard variations
        "invoice date", "invoice dt", "inv date", "inv dt",
        "bill date", "bill dt",
        "document date", "doc date", "doc dt",
        "voucher date", "voucher dt",
        # Simple date
        "date", "dt", "posting date", "post date",
        "transaction date", "entry date",
        # Other
        "Invoice Date", "Invoice Date ", "Date", "Invoice Dt",
        "Bill Date", "Transaction Date", "Document Date",
        "Voucher Date", "Doc Date",
    ],
    
    # Invoice Value variations
    "invoice_value": [
        # Standard variations
        "invoice value", "invoice amount", "inv value", "inv amount",
        "bill value", "bill amount",
        "total invoice value", "total invoice amount",
        "grand total", "grand total amount", "total amount", "total value",
        "total", "total amount", "total value",
        "voucher value", "voucher amount",
        "doc value", "doc amount",
        # Basic amount
        "basic amount", "basic value", "basic",
        "Invoice Value", "Total Invoice Value", "Invoice Amount",
        "Bill Value", "Total Amount", "Grand Total", "Total",
        "Voucher Value", "Doc Value", "Basic Amount", "Basic",
    ],
    
    # Taxable Value variations
    "taxable_value": [
        # Standard variations
        "taxable value", "taxable amount", "taxable", "taxable val",
        "taxable amount (INR)", "taxable value (INR)",
        # Net/assessable
        "net amount", "net value", "net", "net amt",
        "assessable value", "assessable amount", "assessable",
        "taxable net",
        # Basic amount (Tally)
        "item value", "line amount", "line total",
        # Other
        "tax base", "tax base amount",
        "Taxable Value", "Taxable Amount", "Net Amount",
        "Taxable", "Amount", "Taxable Value ", "Taxable Value (INR)", "Taxable Amount (INR)",
    ],
    
    # Rate variations
    "rate": [
        # Standard variations
        "rate", "tax rate", "gst rate", "rate %", "rate(%)", "rate (%)",
        "percentage", "tax percentage", "tax %", "gst%",
        "tax rate %", "gst rate %",
        # Other
        "Rate", "Tax Rate", "GST Rate", "Rate %", "Percentage",
        "Tax Percentage", "Rate(%)", "Rate ( % )", "Tax %",
    ],
    
    # IGST variations
    "igst": [
        # Standard variations
        "igst", "igst amount", "igst value", "igst amt",
        "integrated tax", "integrated tax amount", "integrated gst",
        "integrated gst amount", "i.g.s.t", "i g s t", "i_g_s_t",
        "i_tax", "i tax", "i/tax",
        "igst tax", "igst tax amount",
        # Tally
        "igst amount", "igst ", " igst", "IGST (INR)",
        # Other
        "Integrated GST", "Integrated Tax", "IGST Amount", "IGST",
        "IGST ", " igst", "IGST (INR)",
        # JOI (common variation)
        "joi", "joi amount", "joi tax", "joi amt",
    ],
    
    # CGST variations
    "cgst": [
        # Standard variations
        "cgst", "cgst amount", "cgst value", "cgst amt",
        "central tax", "central tax amount", "central gst",
        "central gst amount", "c.g.s.t", "c g s t", "c_g_s_t",
        "c_tax", "c tax", "c/tax",
        "cgst tax", "cgst tax amount",
        # Tally
        "cgst amount", "cgst ", " cgst", "CGST (INR)",
        # Other
        "Central GST", "Central Tax", "CGST Amount", "CGST",
        "CGST ", " cgst", "CGST (INR)",
    ],
    
    # SGST variations
    "sgst": [
        # Standard variations
        "sgst", "sgst amount", "sgst value", "sgst amt",
        "state tax", "state tax amount", "state gst",
        "state gst amount", "s.g.s.t", "s g s t", "s_g_s_t",
        "s_tax", "s tax", "s/tax",
        "sgst tax", "sgst tax amount",
        # Tally
        "sgst amount", "sgst ", " sgst", "SGST (INR)",
        # Other
        "State GST", "State Tax", "SGST Amount", "SGST",
        "SGST ", " sgst", "SGST (INR)",
    ],
    
    # CESS variations
    "cess": [
        # Standard variations
        "cess", "cess amount", "cess value", "cess amt",
        "cess tax", "cess tax amount",
        "compensations cess", "compensation cess",
        # Tally
        "cess amount", "cess ", " cess", "Cess (INR)",
        # Other
        "CESS", "CESS Amount", " cess", " CESS", "Cess (INR)",
    ],
    
    # HSN Code variations
    "hsn_code": [
        # Standard variations
        "hsn", "hsn code", "hsn number", "hsn no",
        "sac", "sac code", "sac number", "sac no",
        "hsn/sac", "hsn/sac code",
        "gst hsn", "gst hsn code",
        "tariff code", "tariff number",
        # Other
        "HSN", "HSN Code", "HSN/SAC", "SAC Code", "GST HSN",
        "HSN Code ", "HSN/SAC Code",
    ],
    
    # Quantity variations
    "quantity": [
        # Standard variations
        "qty", "quantity", "qty.", "quantity.", "qty no",
        "quantity no", "no of items", "number of items",
        "total quantity", "total qty",
        # Other
        "Quantity", "Qty", "Qty.", "Quantity ", "Total Quantity",
    ],
    
    # UOM variations
    "uom": [
        # Standard variations
        "uom", "unit of measure", "unit", "uqc",
        "uom code", "uom description",
        "measurement unit", "measure unit",
        # Other
        "UOM", "Unit", "Unit of Measure", "UQC", "UoM",
    ],
    
    # Place of Supply variations
    "place_of_supply": [
        # Standard variations
        "place of supply", "pos", "pos code",
        "state", "state code", "state name",
        "supply state", "supply destination",
        "destination state", "destination",
        "place of destination", "delivery state",
        # Other
        "Place Of Supply", "POS", "Place of Supply", "State",
        "Supply State", "Destination State",
        "Tax Country", "Country", "Port Code",
    ],
    
    # Reverse Charge variations
    "reverse_charge": [
        # Standard variations
        "reverse charge", "reverse charge (y/n)", "rcm",
        "reverse charge applicable", "is reverse charge",
        # Other
        "Reverse Charge", "RCM", "rcm",
    ],
    
    # Document Type variations
    "document_type": [
        # Standard variations
        "document type", "doc type", "voucher type",
        "type of document", "type of invoice", "invoice type",
        "transaction type", "nature of document",
        # Other
        "Document Type", "Type", "Invoice Type", "Type of invoice",
        "Voucher Type Name", "Voucher Type",
    ],
    
    # Supply Type variations
    "supply_type": [
        # Standard variations
        "supply type", "type of supply", "nature of supply",
        "export type", "transaction type",
        "inter state", "intra state", "inter-state", "intra-state",
        # Other
        "Supply Type", "Export Type",
    ],
    
    # Customer Name variations
    "customer_name": [
        # Standard variations
        "customer name", "customer", "party name", "party",
        "receiver name", "recipient name", "consignee name",
        "buyer name", "billed to", "ship to",
        "ledger name", "ledger",
        # Other
        "Customer Name", "Receiver Name", "Recipient Name", "Party Name",
        "Name of Recipient", "Consignee Name", "Buyer Name",
        "Ledger Name", "Party",
    ],
    
    # IRN variations
    "irn": [
        # Standard variations
        "irn", "irn no", "irn number",
        "invoice reference number", "e-invoice irn",
        "e invoice irn", "einvoice irn",
        # Other
        "IRN", "Invoice Reference Number", "e-Invoice IRN",
        "IRN No", "IRN Number", "GST IRN",
    ],
    
    # Acknowledgement Number variations
    "ack_no": [
        # Standard variations
        "ack no", "ack number", "acknowledgement no",
        "acknowledgement number", "ack no.", "ack number.",
        "acknowledgement no.", "acknowledgement number.",
        # Other
        "Ack No", "Ack Number", "Acknowledgement No",
        "Acknowledgement Number", "Ack. No.", "Ack No.",
    ],
    
    # Acknowledgement Date variations
    "ack_date": [
        # Standard variations
        "ack date", "ack date ", "acknowledgement date",
        "ack dt", "acknowledgement dt",
        # Other
        "Ack Date", "Ack Date ", "Acknowledgement Date",
        "Ack. Date", "Date of Acknowledgement",
    ],
    
    # Note Number variations (for credit/debit notes)
    "note_number": [
        "note no", "note number", "credit note no", "credit note number",
        "debit note no", "debit note number",
        "cn no", "cn number", "dn no", "dn number",
    ],
    
    # Note Date variations
    "note_date": [
        "note date", "credit note date", "debit note date",
        "cn date", "dn date",
    ],
    
    # Note Value variations
    "note_value": [
        "note value", "credit note value", "debit note value",
        "cn value", "dn value",
        "note amount", "credit note amount", "debit note amount",
    ],
    
    # Description variations
    "description": [
        "description", "item description", "product description",
        "goods description", "service description",
        "item name", "product name", "particulars",
        # Other
        "Description", "Item Description", "Product Description",
        "Goods/Services Description", "Particulars",
    ],
    
    # Shipping Bill Number variations
    "shipping_bill_number": [
        "shipping bill", "shipping bill no", "shipping bill number",
        "sb no", "sb number", "sb no.", "sb number.",
        "export bill", "export bill no",
        # Other
        "Shipping Bill No", "Shipping Bill",
    ],
    
    # Shipping Bill Date variations
    "shipping_bill_date": [
        "shipping bill date", "shipping bill dt",
        "sb date", "sb dt", "export bill date",
        # Other
        "Shipping Bill Date",
    ],
    
    # Port Code variations
    "port_code": [
        "port code", "port", "shipping port", "port of export",
        "export port", "port code",
    ],
    
    # Export Type variations
    "export_type": [
        "export type", "type of export", "export (wpay/wopay)",
        "export with payment", "export without payment",
        "wpay", "wopay", "expwp", "expwop",
    ],
    
    # E-Commerce GSTIN variations
    "ecommerce_gstin": [
        "ecommerce gstin", "e-commerce gstin",
        "ecommerce operator gstin", "gstin of e-commerce operator",
        "portal gstin",
    ],
}


# =============================================================================
# FUZZY MATCHING UTILITIES
# =============================================================================

def normalize_header(header: str) -> str:
    """
    Normalize header for comparison:
    - Convert to lowercase
    - Replace underscores with spaces (so Invoice_No matches "invoice no")
    - Remove special characters (keep alphanumeric and spaces)
    - Remove extra whitespace
    """
    if not header:
        return ""
    
    # Convert to lowercase
    normalized = header.lower().strip()
    
    # Replace underscores with spaces first (before other normalization)
    normalized = normalized.replace('_', ' ')
    
    # Remove special characters (keep alphanumeric and spaces)
    normalized = re.sub(r'[^\w\s]', '', normalized)
    
    # Remove extra whitespace
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized


def get_similarity(str1: str, str2: str) -> float:
    """
    Calculate similarity ratio between two strings (0.0 to 1.0).
    Uses SequenceMatcher for fuzzy matching.
    """
    norm1 = normalize_header(str1)
    norm2 = normalize_header(str2)
    
    if not norm1 or not norm2:
        return 0.0
    
    return SequenceMatcher(None, norm1, norm2).ratio()


def is_similar(header: str, alias: str, threshold: float = 0.8) -> bool:
    """
    Check if header is similar to alias within threshold.
    """
    return get_similarity(header, alias) >= threshold


def contains_keyword(header: str, keywords: List[str]) -> bool:
    """
    Check if header contains any of the keywords.
    """
    normalized = normalize_header(header)
    for keyword in keywords:
        if keyword in normalized:
            return True
    return False


# =============================================================================
# NUMERIC CONVERSION UTILITIES
# =============================================================================

def clean_numeric_value(value: Any) -> Optional[float]:
    """
    Clean and convert a value to float.
    
    Handles:
    - Comma-separated numbers (1,234.56)
    - Currency symbols (INR, $, Rs., etc.)
    - Parentheses for negative values ((123.45))
    - Percentage values (12% -> 0.12)
    - Whitespace
    """
    if value is None:
        return None
    
    if isinstance(value, (int, float)):
        return float(value) if not (isinstance(value, float) and (value != value or value == float('inf'))) else None
    
    if isinstance(value, str):
        # Clean the string
        cleaned = value.strip()
        
        # Handle empty strings
        if not cleaned:
            return None
        
        # Check for negative in parentheses
        is_negative = False
        if cleaned.startswith('(') and cleaned.endswith(')'):
            is_negative = True
            cleaned = cleaned[1:-1]
        
        # Check for percentage before removing %
        is_percent = '%' in cleaned
        
        # Remove currency symbols, spaces (keep digits, decimal, minus)
        cleaned = re.sub(r'[^\d\.\-]', '', cleaned)
        
        try:
            result = float(cleaned)
            if is_negative:
                result = -result
            if is_percent:
                result = result / 100
            return result
        except ValueError:
            return None
    
    return None


# =============================================================================
# DATE PARSING UTILITIES
# =============================================================================

DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
    "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d",
    "%d %B %Y", "%d %b %Y", "%B %d, %Y",
    "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y %H:%M:%S", "%d %B %Y %H:%M:%S",
]


def parse_date_value(value: Any) -> Optional[datetime]:
    """
    Parse a date value into datetime object.
    
    Handles:
    - datetime objects
    - date objects
    - Various string formats
    """
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    
    if isinstance(value, str):
        cleaned = value.strip()
        
        if not cleaned:
            return None
        
        # Try each format
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(cleaned, fmt)
            except ValueError:
                continue
        
        return None
    
    return None


# =============================================================================
# ESSENTIAL FIELDS DEFINITION
# =============================================================================

ESSENTIAL_FIELDS = {
    "invoice_number": "Invoice number is required",
    "invoice_date": "Invoice date is required",
    "taxable_value": "Taxable value is required",
    "invoice_value": "Invoice value is required",
    "place_of_supply": "Place of Supply is required",
    "rate": "Tax rate is required",
}


# =============================================================================
# GST VALIDATION CONSTANTS (STRICT MODE)
# =============================================================================

# Tolerance for tax validation (INR) - STRICT MODE
# Mismatch > ₹0.50 → Error
# Mismatch ≤ ₹0.50 → Auto-correct
GST_TOLERANCE = 0.50

# Small deviation threshold for auto-correction (INR)
AUTO_CORRECT_THRESHOLD = 0.50

# Large deviation threshold for raising error (INR)
ERROR_THRESHOLD = 0.50

# Indian state codes (first 2 digits of GSTIN)
INDIAN_STATES = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Ladakh',
}

# Union territories (considered as inter-state)
UNION_TERRITORIES = {'05', '07', '25', '26', '31', '34', '35', '37'}


# =============================================================================
# TAX VALIDATION FUNCTIONS
# =============================================================================

def extract_state_code(gstin_or_pos: Optional[str]) -> Optional[str]:
    """
    Extract state code from GSTIN or place of supply.
    
    GSTIN format: XX####XXXXX#X#XX (first 2 digits are state code)
    Place of supply can be state code (01-37) or state name.
    """
    if not gstin_or_pos:
        return None
    
    # Clean the input
    value = str(gstin_or_pos).strip()
    
    # If it's a numeric state code (01-37)
    if re.match(r'^\d{2}$', value):
        return value
    
    # If it's a GSTIN format
    if len(value) >= 2:
        state_code = value[:2]
        if state_code.isdigit() and 1 <= int(state_code) <= 37:
            return state_code.zfill(2)
    
    # Try to match state name
    for code, name in INDIAN_STATES.items():
        if name.lower() in value.lower():
            return code
    
    return None


def is_inter_state(supply_type: Optional[str], place_of_supply: Optional[str], 
                   gstin: Optional[str] = None) -> Optional[bool]:
    """
    Determine if transaction is inter-state or intra-state.
    
    Inter-state: Different state codes OR Export/SEZ supplies
    Intra-state: Same state code
    
    Returns:
        True: Inter-state (IGST applicable)
        False: Intra-state (CGST+SGST applicable)
        None: Cannot determine
    """
    # Check explicit supply type
    if supply_type:
        supply_lower = str(supply_type).lower()
        if 'export' in supply_lower or 'sez' in supply_lower:
            return True
        if 'inter-state' in supply_lower or 'interstate' in supply_lower:
            return True
        if 'intra-state' in supply_lower or 'intrastate' in supply_lower:
            return False
    
    # Extract state codes
    pos_code = extract_state_code(place_of_supply)
    gstin_code = extract_state_code(gstin) if gstin else None
    
    # If we have both codes
    if pos_code and gstin_code:
        # Union territories are treated as inter-state
        if pos_code in UNION_TERRITORIES or gstin_code in UNION_TERRITORIES:
            return pos_code != gstin_code
        return pos_code != gstin_code
    
    # If only place of supply is a union territory, it's inter-state
    if pos_code in UNION_TERRITORIES:
        return True
    
    # Cannot determine
    return None


def calculate_expected_tax(taxable_value: float, rate: float) -> float:
    """
    Calculate expected tax amount.
    
    Expected Tax = taxable_value x rate / 100
    
    Note: rate can be either percentage (e.g., 18) or decimal (e.g., 0.18).
    If rate > 1, it's treated as percentage.
    """
    if taxable_value is None or rate is None:
        return None
    
    # If rate is a decimal (<= 1), convert to percentage
    if 0 < rate <= 1:
        rate = rate * 100
    
    return round(taxable_value * rate / 100, 2)


class TaxValidationResult:
    """Result of tax validation with structured error reporting."""
    
    def __init__(
        self,
        is_valid: bool,
        action: str,  # 'ok', 'warning', 'auto_corrected', 'error'
        expected_tax: float,
        actual_tax: float,
        difference: float,
        corrections: Optional[Dict[str, float]] = None,
        messages: Optional[List[str]] = None
    ):
        self.is_valid = is_valid
        self.action = action
        self.expected_tax = expected_tax
        self.actual_tax = actual_tax
        self.difference = difference
        self.corrections = corrections or {}
        self.messages = messages or []
    
    def to_dict(self) -> Dict:
        return {
            'is_valid': self.is_valid,
            'action': self.action,
            'expected_tax': self.expected_tax,
            'actual_tax': self.actual_tax,
            'difference': self.difference,
            'corrections': self.corrections,
            'messages': self.messages
        }


def validate_gst_tax(
    taxable_value: float,
    rate: float,
    igst: Optional[float] = None,
    cgst: Optional[float] = None,
    sgst: Optional[float] = None,
    is_inter_state_supply: Optional[bool] = None
) -> TaxValidationResult:
    """
    Validate GST tax amounts with STRICT tolerance-based logic.
    
    Rules:
    - Expected Tax = taxable_value x rate / 100
    - If inter-state: IGST = expected tax
    - If intra-state: CGST + SGST = expected tax (each = expected / 2)
    
    STRICT Tolerance: ₹0.50
    
    Actions:
    - Difference ≤ ₹0.50: Auto-correct and log
    - Difference > ₹0.50: Raise validation error (never allow wrong tax silently)
    """
    # Calculate expected tax
    expected_tax = calculate_expected_tax(taxable_value, rate)
    
    if expected_tax is None:
        return TaxValidationResult(
            is_valid=False,
            action='error',
            expected_tax=None,
            actual_tax=0,
            difference=0,
            messages=['Cannot validate tax: missing taxable_value or rate']
        )
    
    # Initialize actual tax values
    actual_igst = clean_numeric_value(igst) or 0
    actual_cgst = clean_numeric_value(cgst) or 0
    actual_sgst = clean_numeric_value(sgst) or 0
    
    total_actual_tax = actual_igst + actual_cgst + actual_sgst
    
    # Calculate difference
    difference = round(total_actual_tax - expected_tax, 2)
    abs_difference = abs(difference)
    
    # Determine expected tax distribution
    if is_inter_state_supply:
        # Inter-state: IGST should equal expected tax
        expected_igst = expected_tax
        expected_cgst = 0
        expected_sgst = 0
    else:
        # Intra-state: CGST = SGST = expected_tax / 2
        expected_igst = 0
        expected_cgst = round(expected_tax / 2, 2)
        expected_sgst = round(expected_tax / 2, 2)
    
    # STRICT MODE: Only auto-correct for small differences
    if abs_difference <= GST_TOLERANCE:
        corrections = {}
        
        if is_inter_state_supply:
            corrections['igst'] = expected_igst
        else:
            corrections['cgst'] = expected_cgst
            corrections['sgst'] = expected_sgst
        
        return TaxValidationResult(
            is_valid=True,
            action='auto_corrected',
            expected_tax=expected_tax,
            actual_tax=total_actual_tax,
            difference=difference,
            corrections=corrections,
            messages=[
                f'Tax auto-corrected: {total_actual_tax:.2f} -> {expected_tax:.2f}',
                f'Difference: ₹{difference:.2f} (within ₹{GST_TOLERANCE} tolerance)'
            ]
        )
    
    # STRICT MODE: Any difference > tolerance is an ERROR
    return TaxValidationResult(
        is_valid=False,
        action='error',
        expected_tax=expected_tax,
        actual_tax=total_actual_tax,
        difference=difference,
        messages=[
            f'Tax validation FAILED: expected ₹{expected_tax:.2f}, got ₹{total_actual_tax:.2f}',
            f'Difference: ₹{difference:.2f} (exceeds ₹{GST_TOLERANCE} tolerance)',
            'Never allow wrong tax to pass silently!'
        ]
    )


# =============================================================================
# TRANSACTION CLASSIFICATION CONSTANTS
# =============================================================================

# Threshold for B2CL classification (INR)
B2CL_THRESHOLD = 250000.00  # 2.5 Lakhs

# Reverse charge positive indicators
RCM_INDICATORS = {'y', 'yes', '1', 'true', 't', 'on'}


# =============================================================================
# TRANSACTION CLASSIFICATION FUNCTIONS
# =============================================================================

def is_export(supply_type: Optional[str], place_of_supply: Optional[str] = None) -> bool:
    """
    Check if transaction is an export.
    
    Rules:
    - supply_type contains "export" OR POS == 96
    
    Args:
        supply_type: Supply type string
        place_of_supply: Place of Supply string (to check for 96)
    
    Returns:
        True if export, False otherwise
    """
    # Check supply_type
    if supply_type:
        supply_lower = str(supply_type).lower().strip()
        
        # Check for export keywords
        export_keywords = [
            'export', 'exp', 'expwp', 'expwop',
            'export with payment', 'export without payment',
            'sez', 'free export',
        ]
        
        if any(keyword in supply_lower for keyword in export_keywords):
            return True
    
    # Check POS == 96 (Overseas/Other Countries)
    if place_of_supply:
        pos_str = str(place_of_supply).strip()
        # Check for "96" or "other countries" or "overseas"
        if pos_str == '96' or pos_str.startswith('96-') or '96' in pos_str:
            return True
        if 'other countries' in pos_str.lower() or 'overseas' in pos_str.lower():
            return True
    
    return False


def is_credit_note(document_type: Optional[str]) -> bool:
    """
    Check if document is a credit note.
    
    Args:
        document_type: Document type string
    
    Returns:
        True if credit note, False otherwise
    """
    if not document_type:
        return False
    
    doc_lower = str(document_type).lower().strip()
    
    # Check for credit note keywords
    credit_keywords = [
        'credit', 'cr', 'cr note', 'credit note',
        'cn', 'c/n', 'c n',
    ]
    
    return any(keyword in doc_lower for keyword in credit_keywords)


def is_debit_note(document_type: Optional[str]) -> bool:
    """
    Check if document is a debit note.
    
    Args:
        document_type: Document type string
    
    Returns:
        True if debit note, False otherwise
    """
    if not document_type:
        return False
    
    doc_lower = str(document_type).lower().strip()
    
    # Check for debit note keywords
    debit_keywords = [
        'debit', 'dr', 'dr note', 'debit note',
        'dn', 'd/n', 'd n',
    ]
    
    return any(keyword in doc_lower for keyword in debit_keywords)


def is_rcm(reverse_charge: Optional[Any]) -> bool:
    """
    Check if reverse charge applies.
    
    Args:
        reverse_charge: Reverse charge field value
    
    Returns:
        True if RCM applies, False otherwise
    """
    if reverse_charge is None:
        return False
    
    # Handle string values
    if isinstance(reverse_charge, str):
        rc_lower = reverse_charge.lower().strip()
        return rc_lower in RCM_INDICATORS
    
    # Handle numeric values
    if isinstance(reverse_charge, (int, float)):
        return reverse_charge in (1, True, 1.0)
    
    # Handle boolean
    if isinstance(reverse_charge, bool):
        return reverse_charge
    
    return False


class TransactionClassification:
    """
    Result of transaction classification.
    
    Attributes:
        transaction_type: B2B, B2CL, B2CS, EXPORT, etc.
        is_credit_note: Whether it's a credit note
        is_debit_note: Whether it's a debit note
        is_rcm: Whether reverse charge applies
        is_export: Whether it's an export transaction
        raw_flags: Raw classification flags
    """
    
    def __init__(
        self,
        transaction_type: str,
        is_credit_note: bool = False,
        is_debit_note: bool = False,
        is_rcm: bool = False,
        is_export: bool = False,
        raw_flags: Optional[Dict[str, bool]] = None
    ):
        self.transaction_type = transaction_type
        self.is_credit_note = is_credit_note
        self.is_debit_note = is_debit_note
        self.is_rcm = is_rcm
        self.is_export = is_export
        self.raw_flags = raw_flags or {}
    
    def to_dict(self) -> Dict:
        return {
            'transaction_type': self.transaction_type,
            'is_credit_note': self.is_credit_note,
            'is_debit_note': self.is_debit_note,
            'is_rcm': self.is_rcm,
            'is_export': self.is_export,
            'raw_flags': self.raw_flags
        }


def classify_transaction(
    gstin: Optional[str],
    invoice_value: Optional[float],
    supply_type: Optional[str] = None,
    document_type: Optional[str] = None,
    reverse_charge: Optional[Any] = None,
    is_inter_state_supply: Optional[bool] = None,
    place_of_supply: Optional[str] = None
) -> TransactionClassification:
    """
    Classify a transaction into B2B, B2CL, B2CS, EXPORT, CDNR, CDNUR.
    
    STRICT Classification Order (GSTN Rules):
    1. If supply_type contains "export" OR POS == 96 → EXPORT / EXPORT_CR / EXPORT_DR
    2. If document_type contains "credit" → CDNR / CDNUR (registered/unregistered)
    3. If document_type contains "debit" → CDNR / CDNUR
    4. If reverse_charge is Y/Yes/1 → mark RCM flag
    5. If GSTIN present → B2B / B2B_CR / B2B_DR / B2B_RCM
    6. If GSTIN empty AND inter-state AND invoice_value > 2.5L → B2CL
    7. Else GSTIN empty → B2CS
    
    B2CL Threshold: ₹2,50,000 (2.5 Lakhs)
    
    Args:
        gstin: Customer GSTIN (None if not available)
        invoice_value: Total invoice value
        supply_type: Type of supply
        document_type: Type of document
        reverse_charge: Whether reverse charge applies
        is_inter_state_supply: Whether transaction is inter-state
        place_of_supply: Place of Supply for export detection
    
    Returns:
        TransactionClassification with type and flags
    """
    # Check for credit/debit note keywords
    is_cr_note = is_credit_note(document_type)
    is_dr_note = is_debit_note(document_type)
    
    # Check for RCM
    is_rcm_flag = is_rcm(reverse_charge)
    
    # Check for export (supply_type OR POS == 96)
    is_export_flag = is_export(supply_type, place_of_supply)
    
    # Clean GSTIN
    gstin_clean = gstin.strip() if isinstance(gstin, str) else ''
    gstin_present = bool(gstin_clean and len(gstin_clean) >= 2)
    
    # Determine base transaction type
    if is_export_flag:
        # Export transactions
        if is_cr_note:
            transaction_type = 'EXPORT_CR'
        elif is_dr_note:
            transaction_type = 'EXPORT_DR'
        else:
            transaction_type = 'EXPORT'
    elif is_cr_note or is_dr_note:
        # Credit/Debit Notes
        if gstin_present:
            transaction_type = 'CDNR'  # Registered recipient
        else:
            transaction_type = 'CDNUR'  # Unregistered recipient
    elif gstin_present:
        # B2B transactions
        if is_rcm_flag:
            transaction_type = 'B2B_RCM'
        else:
            transaction_type = 'B2B'
    elif invoice_value is not None and invoice_value > B2CL_THRESHOLD and is_inter_state_supply:
        # B2CL (high-value, no GSTIN, inter-state)
        transaction_type = 'B2CL'
    else:
        # B2CS (low-value, no GSTIN)
        transaction_type = 'B2CS'
    
    return TransactionClassification(
        transaction_type=transaction_type,
        is_credit_note=is_cr_note,
        is_debit_note=is_dr_note,
        is_rcm=is_rcm_flag,
        is_export=is_export_flag,
        raw_flags={
            'gstin_present': gstin_present,
            'invoice_value': invoice_value,
            'is_inter_state': is_inter_state_supply,
            'b2cl_threshold': B2CL_THRESHOLD,
        }
    )


# =============================================================================
# HEADER MAPPING CLASS
# =============================================================================

class HeaderMapper:
    """
    Dynamic header mapping system for Excel files.
    
    Features:
    - Automatic canonical field detection
    - Fuzzy matching for unknown headers
    - Dynamic header row detection
    - Column normalization to internal format
    - Safe numeric conversion
    - Auto-derivation of missing values
    - GST tax validation with tolerance
    """
    
    # Similarity threshold for fuzzy matching
    SIMILARITY_THRESHOLD = 0.80
    
    # Minimum canonical matches required for header detection
    MIN_HEADER_MATCHES = 3
    
    def __init__(self):
        """Initialize the header mapper with all aliases."""
        self._build_alias_lookup()
    
    def _build_alias_lookup(self):
        """
        Build a reverse lookup: normalized alias -> canonical field.
        This enables O(1) lookup after normalization.
        """
        self.alias_lookup: Dict[str, str] = {}
        self.keyword_lookup: Dict[str, List[str]] = {}
        
        for canonical, aliases in HEADER_ALIASES.items():
            self.keyword_lookup[canonical] = []
            
            for alias in aliases:
                normalized = normalize_header(alias)
                if normalized:
                    self.alias_lookup[normalized] = canonical
                    self.keyword_lookup[canonical].append(normalized)
    
    def get_canonical_field(self, header: str) -> Optional[str]:
        """
        Get canonical field name for a header.
        Returns None if no match found.
        """
        normalized = normalize_header(header)
        
        # Direct lookup
        if normalized in self.alias_lookup:
            return self.alias_lookup[normalized]
        
        # Fuzzy matching
        for alias, canonical in self.alias_lookup.items():
            if is_similar(header, alias, self.SIMILARITY_THRESHOLD):
                return canonical
        
        # Keyword-based matching for complex headers
        for canonical, keywords in self.keyword_lookup.items():
            if contains_keyword(header, keywords):
                return canonical
        
        return None
    
    def map_headers(self, headers: List[str]) -> Dict[str, str]:
        """
        Map a list of headers to canonical field names.
        
        Returns:
            Dictionary mapping original header -> canonical field name
        """
        mapping = {}
        
        for header in headers:
            canonical = self.get_canonical_field(header)
            if canonical:
                mapping[header] = canonical
        
        return mapping
    
    def detect_header_row(
        self,
        worksheet,
        max_rows: int = 10
    ) -> int:
        """
        Detect the header row in a worksheet.
        
        Ignores blank rows above the header.
        Checks each row for minimum required canonical field matches.
        
        Args:
            worksheet: openpyxl worksheet object
            max_rows: Maximum rows to scan
            
        Returns:
            Row number (1-based) of detected header, or 1 if not detected
        """
        for row_idx in range(1, min(max_rows + 1, worksheet.max_row + 1)):
            # Get headers from this row
            row_headers = []
            for col in range(1, min(20, worksheet.max_column + 1)):
                cell_value = worksheet.cell(row=row_idx, column=col).value
                if cell_value is not None:
                    row_headers.append(str(cell_value))
            
            # Skip if row is empty or nearly empty
            non_empty = [h for h in row_headers if h.strip()]
            if len(non_empty) < 2:
                continue
            
            # Count canonical field matches
            matches = 0
            for header in row_headers:
                if self.get_canonical_field(header):
                    matches += 1
            
            # Check if minimum matches found
            if matches >= self.MIN_HEADER_MATCHES:
                return row_idx
        
        # Default to first row
        return 1
    
    def detect_header_row_pandas(self, df, max_rows: int = 10) -> int:
        """
        Detect header row in pandas DataFrame.
        
        For pandas, we scan columns to find the best match row.
        
        Args:
            df: pandas DataFrame
            max_rows: Maximum rows to check
            
        Returns:
            Index of detected header row
        """
        # Get all columns from first few rows
        for idx in range(min(max_rows, len(df.columns))):
            # Check if this row's columns match canonical fields
            cols = df.iloc[idx].astype(str).tolist()
            non_empty = [c for c in cols if c and c.strip() and c.lower() != 'nan']
            
            if len(non_empty) < 2:
                continue
            
            matches = sum(1 for col in cols if self.get_canonical_field(col))
            
            if matches >= self.MIN_HEADER_MATCHES:
                return idx
        
        return 0
    
    def is_empty_row(self, row: Dict[str, Any]) -> bool:
        """
        Check if a row is completely empty.
        """
        for value in row.values():
            if value is not None and str(value).strip():
                return False
        return True
    
    def trim_whitespace(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Trim whitespace from all string values in a row.
        """
        trimmed = {}
        for key, value in row.items():
            if isinstance(value, str):
                trimmed[key] = value.strip()
            else:
                trimmed[key] = value
        return trimmed
    
    def convert_numeric_fields(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert numeric fields safely.
        Handles commas, currency symbols, and parentheses.
        """
        numeric_fields = {
            'invoice_value', 'taxable_value', 'rate',
            'igst', 'cgst', 'sgst', 'cess',
            'quantity', 'unit_price', 'item_value'
        }
        
        converted = {}
        for key, value in row.items():
            if key in numeric_fields:
                converted[key] = clean_numeric_value(value)
            else:
                converted[key] = value
        
        return converted
    
    def convert_date_fields(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert date fields to datetime objects.
        """
        date_fields = {'invoice_date', 'note_date', 'ack_date', 'shipping_bill_date'}
        
        converted = {}
        for key, value in row.items():
            if key in date_fields:
                converted[key] = parse_date_value(value)
            else:
                converted[key] = value
        
        return converted
    
    def auto_derive_values(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Auto-derive missing values:
        - invoice_value = taxable_value + igst + cgst + sgst + cess
        - taxable_value = invoice_value - (igst + cgst + sgst + cess)
        """
        derived = row.copy()
        
        # Get values
        invoice_value = clean_numeric_value(row.get('invoice_value'))
        taxable_value = clean_numeric_value(row.get('taxable_value'))
        igst = clean_numeric_value(row.get('igst', 0)) or 0
        cgst = clean_numeric_value(row.get('cgst', 0)) or 0
        sgst = clean_numeric_value(row.get('sgst', 0)) or 0
        cess = clean_numeric_value(row.get('cess', 0)) or 0
        
        total_tax = igst + cgst + sgst + cess
        
        # Auto-derive invoice_value if missing
        if invoice_value is None and taxable_value is not None:
            invoice_value = taxable_value + total_tax
            if invoice_value > 0:
                derived['invoice_value'] = invoice_value
        
        # Auto-derive taxable_value if missing
        if taxable_value is None and invoice_value is not None:
            taxable_value = invoice_value - total_tax
            if taxable_value >= 0:
                derived['taxable_value'] = taxable_value
        
        return derived
    
    def validate_tax(self, row: Dict[str, Any]) -> TaxValidationResult:
        """
        Validate GST tax amounts in a row.
        
        Returns:
            TaxValidationResult with validation status and any corrections
        """
        # Get required fields
        taxable_value = clean_numeric_value(row.get('taxable_value'))
        rate = clean_numeric_value(row.get('rate'))
        
        if taxable_value is None or rate is None:
            return TaxValidationResult(
                is_valid=False,
                action='error',
                expected_tax=None,
                actual_tax=0,
                difference=0,
                messages=['Cannot validate tax: missing taxable_value or rate']
            )
        
        igst = row.get('igst')
        cgst = row.get('cgst')
        sgst = row.get('sgst')
        
        # Determine if inter-state
        place_of_supply = row.get('place_of_supply')
        gstin = row.get('gstin')
        supply_type = row.get('supply_type')
        
        inter_state = is_inter_state(supply_type, place_of_supply, gstin)
        
        return validate_gst_tax(
            taxable_value=float(taxable_value),
            rate=float(rate),
            igst=igst,
            cgst=cgst,
            sgst=sgst,
            is_inter_state_supply=inter_state
        )
    
    def classify_transaction(self, row: Dict[str, Any]) -> TransactionClassification:
        """
        Classify a transaction into B2B, B2CL, B2CS, EXPORT, etc.
        
        Returns:
            TransactionClassification with type and flags
        """
        gstin = row.get('gstin')
        invoice_value = clean_numeric_value(row.get('invoice_value'))
        supply_type = row.get('supply_type')
        document_type = row.get('document_type')
        reverse_charge = row.get('reverse_charge')
        place_of_supply = row.get('place_of_supply')
        
        # Determine if inter-state
        inter_state = is_inter_state(supply_type, place_of_supply, gstin)
        
        return classify_transaction(
            gstin=gstin,
            invoice_value=invoice_value,
            supply_type=supply_type,
            document_type=document_type,
            reverse_charge=reverse_charge,
            is_inter_state_supply=inter_state,
            place_of_supply=place_of_supply
        )
    
    def normalize_row(
        self,
        row: Dict[str, Any],
        mapping: Dict[str, str]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Normalize a row using the header mapping.
        
        Steps:
        1. Map columns to canonical names
        2. Trim whitespace
        3. Convert numeric fields
        4. Convert date fields
        5. Auto-derive missing values
        6. Validate GST tax
        7. Classify transaction
        
        Returns:
            Tuple of (normalized row, errors)
        """
        normalized = {}
        errors = {}
        warnings = []
        
        # Map columns to canonical names
        for original_key, value in row.items():
            if original_key in mapping:
                canonical = mapping[original_key]
                normalized[canonical] = value
            else:
                # Keep original key if no mapping found
                normalized[original_key] = value
        
        # Trim whitespace
        normalized = self.trim_whitespace(normalized)
        
        # Remove empty rows
        if self.is_empty_row(normalized):
            return normalized, {'errors': {}, 'warnings': []}
        
        # Convert numeric fields
        normalized = self.convert_numeric_fields(normalized)
        
        # Convert date fields
        normalized = self.convert_date_fields(normalized)
        
        # Auto-derive missing values
        normalized = self.auto_derive_values(normalized)
        
        # Validate GST tax
        tax_result = self.validate_tax(normalized)
        
        # Apply corrections if needed
        if tax_result.action == 'auto_corrected':
            for field, value in tax_result.corrections.items():
                normalized[field] = value
            warnings.extend(tax_result.messages)
        
        # Add warning messages
        if tax_result.action == 'warning':
            warnings.extend(tax_result.messages)
        
        # Add error if validation failed
        if not tax_result.is_valid and tax_result.action == 'error':
            errors['tax_validation'] = tax_result.messages
        
        # Check for essential fields
        for field, error_msg in ESSENTIAL_FIELDS.items():
            value = normalized.get(field)
            if value is None or value == '':
                errors[field] = error_msg
        
        # Classify transaction
        classification = self.classify_transaction(normalized)
        normalized['transaction_type'] = classification.transaction_type
        normalized['is_credit_note'] = classification.is_credit_note
        normalized['is_debit_note'] = classification.is_debit_note
        normalized['is_rcm'] = classification.is_rcm
        normalized['is_export'] = classification.is_export
        
        return normalized, {'errors': errors, 'warnings': warnings}
    
    def normalize_dataframe(
        self,
        df,
        mapping: Optional[Dict[str, str]] = None
    ) -> Tuple[Any, Dict[str, Any], List[Dict]]:
        """
        Normalize entire DataFrame using header mapping.
        
        Args:
            df: pandas DataFrame
            mapping: Optional pre-computed mapping
            
        Returns:
            Tuple of (normalized DataFrame, summary, errors)
        """
        # Import pandas inside function to avoid top-level dependency issues
        import pandas as pd
        
        if mapping is None:
            mapping = self.map_headers(df.columns.tolist())
        
        # Rename columns
        df_normalized = df.rename(columns=mapping)
        
        # Process each row
        normalized_rows = []
        row_errors = []
        all_warnings = []
        
        for idx, row in df_normalized.iterrows():
            # Skip completely empty rows
            if row.isna().all() or not row.any():
                continue
            
            # Convert row to dict and normalize
            row_dict = row.where(pd.notnull(row), None).to_dict()
            normalized_row, validation = self.normalize_row(row_dict, mapping)
            
            if not self.is_empty_row(normalized_row):
                normalized_rows.append(normalized_row)
                
                if validation['errors'] or validation['warnings']:
                    row_errors.append({
                        'row_index': idx,
                        'errors': validation['errors'],
                        'warnings': validation['warnings'],
                        'data': normalized_row
                    })
                    all_warnings.extend(validation['warnings'])
        
        # Create normalized DataFrame
        df_result = pd.DataFrame(normalized_rows)
        
        summary = {
            'total_rows': len(df),
            'normalized_rows': len(normalized_rows),
            'rows_with_warnings': len([r for r in row_errors if r['warnings']]),
            'rows_with_errors': len([r for r in row_errors if r['errors']]),
        }
        
        return df_result, summary, row_errors


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_header_mapper() -> HeaderMapper:
    """
    Create a new HeaderMapper instance.
    
    Returns:
        HeaderMapper instance ready for use
    """
    return HeaderMapper()


# Alias for backwards compatibility
get_mapper = create_header_mapper


def map_excel_headers(headers: List[str]) -> Dict[str, str]:
    """
    Map a list of Excel headers to canonical field names.
    
    Args:
        headers: List of header strings from Excel
    
    Returns:
        Dictionary mapping original header -> canonical field name
    """
    mapper = HeaderMapper()
    return mapper.map_headers(headers)


def normalize_excel_data(
    df,
    header_row: Optional[int] = None
) -> Tuple[Any, Dict[str, Any], List[Dict]]:
    """
    Normalize Excel data from a pandas DataFrame.
    
    Args:
        df: pandas DataFrame with Excel data
        header_row: Optional row index containing headers (0-based)
    
    Returns:
        Tuple of (normalized DataFrame, summary, errors)
    """
    mapper = HeaderMapper()
    
    # If header_row is specified, set it as the header
    if header_row is not None:
        df.columns = df.iloc[header_row]
        df = df.iloc[header_row + 1:]
    
    return mapper.normalize_dataframe(df)


# Alias for backwards compatibility
normalize_dataframe = normalize_excel_data


def normalize_dataframe_simple(df) -> Tuple[Any, Dict[str, str]]:
    """
    Simple normalize_dataframe that returns (DataFrame, mapping).
    
    For backwards compatibility with existing code.
    """
    mapper = HeaderMapper()
    mapping = mapper.map_headers(df.columns.tolist())
    df_result, _, _ = mapper.normalize_dataframe(df)
    return df_result, mapping


# Example usage and testing
if __name__ == "__main__":
    # Test basic functionality
    mapper = HeaderMapper()
    
    # Test header mapping
    test_headers = ["GSTIN No", "Invoice No", "Invoice Date", "Taxable Amount", 
                   "IGST", "CGST", "SGST", "Rate %"]
    
    mapping = mapper.map_headers(test_headers)
    print("Header Mapping:")
    for orig, canonical in mapping.items():
        print(f"  {orig} -> {canonical}")
    
    # Test transaction classification
    test_row = {
        'gstin': '27ABCDE1234F2Z5',
        'invoice_value': 118000,
        'supply_type': 'Inter-state',
        'document_type': 'Invoice',
        'reverse_charge': 'N'
    }
    
    classification = mapper.classify_transaction(test_row)
    print(f"\nTransaction Classification:")
    print(f"  Type: {classification.transaction_type}")
    print(f"  Is Credit Note: {classification.is_credit_note}")
    print(f"  Is Debit Note: {classification.is_debit_note}")
    print(f"  Is RCM: {classification.is_rcm}")
    print(f"  Is Export: {classification.is_export}")
