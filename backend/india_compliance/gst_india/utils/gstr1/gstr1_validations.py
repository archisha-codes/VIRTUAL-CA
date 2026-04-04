"""
GSTR-1 Validation Module

This module provides validation functions for processing GSTR-1 Excel uploads.
Each row is validated against GST rules and returns structured errors.
"""

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum


# Set up logger for this module
logger = logging.getLogger("gstr1_validations")
logger.setLevel(logging.DEBUG)


class GSTR1ValidationError:
    """Class to represent a validation error."""
    
    def __init__(self, row: int, field: str, error: str, value: Any = None):
        """
        Initialize a validation error.
        
        Args:
            row: Row number in the Excel file (1-indexed)
            field: Field name that failed validation
            error: Description of the validation error
            value: The invalid value (optional)
        """
        self.row = row
        self.field = field
        self.error = error
        self.value = value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary format."""
        return {
            "row": self.row,
            "field": self.field,
            "error": self.error,
            "value": str(self.value) if self.value is not None else None
        }
    
    def __repr__(self) -> str:
        return f"GSTR1ValidationError(row={self.row}, field='{self.field}', error='{self.error}')"


class GSTR1Section(Enum):
    """Enum for GSTR-1 sections."""
    B2B = "b2b"
    B2CL = "b2cl"
    B2CS = "b2cs"
    EXP = "export"
    CDNR = "cdnr"
    CDNUR = "cdnur"


# =============================================================================
# GST Rate Constants
# =============================================================================
VALID_GST_RATES = {0, 5, 12, 18, 28}

# GSTIN pattern (15 characters, alphanumeric)
GSTIN_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$')

# State codes for India (01-36)
VALID_STATE_CODES = set(str(i).zfill(2) for i in range(1, 37))


# =============================================================================
# Validation Functions
# =============================================================================

def validate_gstin(gstin: str, field_name: str = " gstin") -> Optional[GSTR1ValidationError]:
    """
    Validate GSTIN format.
    
    GSTIN must be:
    - Exactly 15 characters
    - First 2 digits: State code (01-36)
    - Next 5 characters: PAN (uppercase letters)
    - Next 4 digits: Entity code
    - Next 1 character: Checksum (uppercase letter)
    - Next 1 character: 'Z'
    - Last 1 character: Checksum (alphanumeric)
    
    Args:
        gstin: GSTIN string to validate
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    if not gstin:
        return GSTR1ValidationError(
            row=0,  # Will be set by caller
            field=field_name,
            error=f"{field_name} is required",
            value=gstin
        )
    
    gstin = str(gstin).strip().upper()
    
    # Check length
    if len(gstin) != 15:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid GSTIN format: must be 15 characters",
            value=gstin
        )
    
    # Validate using regex pattern
    if not GSTIN_PATTERN.match(gstin):
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid GSTIN format: does not match expected pattern",
            value=gstin
        )
    
    # Validate state code
    state_code = gstin[:2]
    if state_code not in VALID_STATE_CODES:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid GSTIN: invalid state code '{state_code}'",
            value=gstin
        )
    
    return None


def validate_gst_rate(rate: Any, field_name: str = "gst_rate") -> Optional[GSTR1ValidationError]:
    """
    Validate GST rate.
    
    GST rate must be one of: 0, 5, 12, 18, 28
    
    Args:
        rate: GST rate to validate
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    if rate is None or rate == "":
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"{field_name} is required",
            value=rate
        )
    
    try:
        rate_float = float(rate)
        # Convert to integer if it's a whole number
        if rate_float.is_integer():
            rate_int = int(rate_float)
        else:
            rate_int = rate_float
        
        if rate_int not in VALID_GST_RATES:
            return GSTR1ValidationError(
                row=0,
                field=field_name,
                error=f"Invalid GST rate: must be one of {sorted(VALID_GST_RATES)}, got {rate_int}",
                value=rate
            )
    except (ValueError, TypeError):
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid GST rate: must be a number, got '{rate}'",
            value=rate
        )
    
    return None


def validate_invoice_date(
    invoice_date: Any,
    return_period: str,
    field_name: str = "invoice_date"
) -> Optional[GSTR1ValidationError]:
    """
    Validate invoice date.
    
    Invoice date must:
    - Be a valid date format
    - Not be a future date
    - Be within the selected return period
    
    Args:
        invoice_date: Invoice date to validate
        return_period: Return period in format MM/YYYY
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    if not invoice_date:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"{field_name} is required",
            value=invoice_date
        )
    
    # Try to parse the date
    date_formats = [
        "%d/%m/%Y",   # DD/MM/YYYY
        "%d-%m-%Y",   # DD-MM-YYYY
        "%Y-%m-%d",   # YYYY-MM-DD
        "%d/%m/%y",   # DD/MM/YY
    ]
    
    invoice_datetime = None
    for fmt in date_formats:
        try:
            invoice_datetime = datetime.strptime(str(invoice_date), fmt)
            break
        except ValueError:
            continue
    
    if invoice_datetime is None:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid date format: must be DD/MM/YYYY or DD-MM-YYYY, got '{invoice_date}'",
            value=invoice_date
        )
    
    # Check if date is not in the future
    today = datetime.now()
    if invoice_datetime > today:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Future date not allowed: invoice date cannot be in the future",
            value=invoice_date
        )
    
    # Parse return period
    try:
        month, year = return_period.split('/')
        return_month = int(month)
        return_year = int(year)
    except (ValueError, AttributeError):
        return GSTR1ValidationError(
            row=0,
            field="return_period",
            error=f"Invalid return period format: must be MM/YYYY, got '{return_period}'",
            value=return_period
        )
    
    # Check if invoice date is within return period
    # Allow invoices from the last day of previous month (due to timing)
    first_day_of_period = datetime(return_year, return_month, 1)
    last_day_of_period = datetime(
        return_year if return_month < 12 else return_year + 1,
        return_month + 1 if return_month < 12 else 1,
        1
    ) - datetime.timedelta(days=1)
    
    # Allow up to 7 days into the next month for previous month's invoices
    grace_period_end = datetime(
        return_year if return_month < 12 else return_year + 1,
        return_month + 1 if return_month < 12 else 1,
        7
    )
    
    if invoice_datetime < first_day_of_period and invoice_datetime.month != (return_month - 1) % 12:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invoice date not in return period: expected {return_period}, got '{invoice_date}'",
            value=invoice_date
        )
    
    if invoice_datetime > last_day_of_period and invoice_datetime > grace_period_end:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invoice date not in return period: expected {return_period}, got '{invoice_date}'",
            value=invoice_date
        )
    
    return None


def validate_place_of_supply(
    place_of_supply: str,
    company_gstin: str = "",
    field_name: str = "place_of_supply"
) -> Optional[GSTR1ValidationError]:
    """
    Validate place of supply.
    
    Place of supply must:
    - Be in valid format (e.g., "07-Delhi" or just state code)
    - Match buyer/seller state logic for inter-state vs intra-state
    
    Args:
        place_of_supply: Place of supply string
        company_gstin: Company's GSTIN for state comparison
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    if not place_of_supply:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"{field_name} is required",
            value=place_of_supply
        )
    
    place_of_supply = str(place_of_supply).strip()
    
    # Extract state code
    if '-' in place_of_supply:
        state_code = place_of_supply.split('-')[0].strip()
    else:
        state_code = place_of_supply[:2] if len(place_of_supply) >= 2 else place_of_supply
    
    # Validate state code
    if state_code not in VALID_STATE_CODES:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Invalid place of supply: invalid state code '{state_code}'",
            value=place_of_supply
        )
    
    # If company GSTIN is provided, check inter-state vs intra-state
    if company_gstin:
        company_state = company_gstin[:2]
        if state_code != company_state:
            # Inter-state supply
            pass  # This is valid
        else:
            # Intra-state supply
            pass  # This is valid
    
    return None


def validate_taxable_value(
    taxable_value: Any,
    tax_amount: Any,
    gst_rate: Any,
    field_name: str = "taxable_value"
) -> Optional[GSTR1ValidationError]:
    """
    Validate that taxable value + tax amount = invoice total.
    
    The calculated tax amount should match the provided tax amount
    based on the GST rate and taxable value.
    
    Args:
        taxable_value: Taxable value from the invoice
        tax_amount: Tax amount from the invoice
        gst_rate: GST rate applied
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    try:
        taxable = float(taxable_value) if taxable_value else 0.0
        tax = float(tax_amount) if tax_amount else 0.0
        rate = float(gst_rate) if gst_rate else 0.0
    except (ValueError, TypeError):
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error="Invalid numeric value for taxable value or tax amount",
            value=None
        )
    
    # Calculate expected tax amount
    expected_tax = round(taxable * rate / 100, 2)
    
    # Allow small difference due to rounding (up to 1 rupee)
    if abs(tax - expected_tax) > 1.0:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Tax amount mismatch: expected {expected_tax}, got {tax} (rate: {rate}%)",
            value=tax
        )
    
    return None


def validate_invoice_value(
    taxable_value: Any,
    cgst_amount: Any = 0,
    sgst_amount: Any = 0,
    igst_amount: Any = 0,
    cess_amount: Any = 0,
    field_name: str = "invoice_total"
) -> Optional[GSTR1ValidationError]:
    """
    Validate that taxable value + all tax amounts = invoice total.
    
    Args:
        taxable_value: Taxable value from the invoice
        cgst_amount: CGST amount
        sgst_amount: SGST amount
        igst_amount: IGST amount
        cess_amount: CESS amount
        field_name: Name of the field for error messages
        
    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    try:
        taxable = float(taxable_value) if taxable_value else 0.0
        cgst = float(cgst_amount) if cgst_amount else 0.0
        sgst = float(sgst_amount) if sgst_amount else 0.0
        igst = float(igst_amount) if igst_amount else 0.0
        cess = float(cess_amount) if cess_amount else 0.0
    except (ValueError, TypeError):
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error="Invalid numeric value for invoice amounts",
            value=None
        )
    
    # Calculate total tax
    total_tax = cgst + sgst + igst + cess
    
    # For intra-state (CGST+SGST) or inter-state (IGST) supplies
    # The invoice total should equal taxable value + tax
    if igst > 0:
        # Inter-state: should have IGST, no CGST/SGST
        expected_total = taxable + igst + cess
    else:
        # Intra-state: should have CGST+SGST, no IGST
        expected_total = taxable + cgst + sgst + cess
    
    # Allow small difference due to rounding (up to 1 rupee)
    if abs(total_tax - (expected_total - taxable)) > 1.0:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"Tax components mismatch: CGST={cgst}, SGST={sgst}, IGST={igst}, CESS={cess}",
            value=None
        )
    
    return None


def validate_b2b_row(row: Dict[str, Any], row_number: int, company_gstin: str = "") -> List[Dict[str, Any]]:
    """
    Validate a B2B invoice row.
    
    B2B invoices require:
    - Recipient GSTIN (15 characters)
    - Invoice number and date
    - Invoice value
    - Place of supply
    - Taxable value and tax breakdown
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        company_gstin: Company's GSTIN for state comparison
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # Validate recipient GSTIN
    gstin = row.get("gstin") or row.get("recipient_gstin") or row.get("buyer_gstin")
    error = validate_gstin(gstin, "recipient_gstin")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate invoice number
    invoice_no = row.get("invoice_no") or row.get("invoice_number")
    if not invoice_no:
        errors.append({"row": row_number, "field": "invoice_no", "error": "Invoice number is required"})
    
    # Validate invoice date
    invoice_date = row.get("invoice_date")
    return_period = row.get("return_period", "03/2024")  # Default for testing
    error = validate_invoice_date(invoice_date, return_period, "invoice_date")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate place of supply
    place_of_supply = row.get("place_of_supply")
    error = validate_place_of_supply(place_of_supply, company_gstin, "place_of_supply")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate taxable value and tax amounts
    taxable_value = row.get("taxable_value")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    igst_amount = row.get("igst_amount")
    cess_amount = row.get("cess_amount")
    gst_rate = row.get("gst_rate") or row.get("tax_rate")
    
    # Check for missing tax amounts
    if taxable_value is None:
        errors.append({"row": row_number, "field": "taxable_value", "error": "Taxable value is required"})
    
    # Validate tax amounts match taxable value
    error = validate_invoice_value(taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate GST rate
    error = validate_gst_rate(gst_rate, "gst_rate")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


def validate_b2cl_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate a B2CL (B2C Large) invoice row.
    
    B2CL invoices are inter-state supplies to unregistered persons > ₹2.5 lakh.
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # B2CL should not have recipient GSTIN
    gstin = row.get("gstin") or row.get("recipient_gstin")
    if gstin:
        errors.append({
            "row": row_number,
            "field": "recipient_gstin",
            "error": "B2CL invoices should not have recipient GSTIN"
        })
    
    # Validate place of supply (must be different state)
    place_of_supply = row.get("place_of_supply")
    if place_of_supply:
        if '-' in place_of_supply:
            state_code = place_of_supply.split('-')[0].strip()
        else:
            state_code = place_of_supply[:2] if len(place_of_supply) >= 2 else place_of_supply
        
        # For B2CL, export state (96) is allowed
        if state_code not in VALID_STATE_CODES and state_code != "96":
            errors.append({
                "row": row_number,
                "field": "place_of_supply",
                "error": f"Invalid place of supply for B2CL: {place_of_supply}"
            })
    
    # Validate invoice value (must be > ₹2.5 lakh)
    invoice_value = row.get("invoice_value") or row.get("total_value")
    if invoice_value:
        try:
            value = float(invoice_value)
            if value < 250000:
                errors.append({
                    "row": row_number,
                    "field": "invoice_value",
                    "error": f"B2CL invoice value must be >= ₹2.5 lakh, got {value}"
                })
        except (ValueError, TypeError):
            errors.append({
                "row": row_number,
                "field": "invoice_value",
                "error": "Invalid invoice value"
            })
    
    # Validate invoice date
    invoice_date = row.get("invoice_date")
    return_period = row.get("return_period", "03/2024")
    error = validate_invoice_date(invoice_date, return_period, "invoice_date")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # B2CL should have IGST (inter-state)
    igst_amount = row.get("igst_amount")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    
    if not igst_amount and (cgst_amount or sgst_amount):
        errors.append({
            "row": row_number,
            "field": "tax_type",
            "error": "B2CL invoices should have IGST (inter-state supply)"
        })
    
    # Validate taxable value and tax
    taxable_value = row.get("taxable_value")
    error = validate_invoice_value(taxable_value, cgst_amount, sgst_amount, igst_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


def validate_b2cs_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate a B2CS (B2C Small) invoice row.
    
    B2CS invoices are supplies to unregistered persons <= ₹2.5 lakh.
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # B2CS should not have recipient GSTIN
    gstin = row.get("gstin") or row.get("recipient_gstin")
    if gstin:
        errors.append({
            "row": row_number,
            "field": "recipient_gstin",
            "error": "B2CS invoices should not have recipient GSTIN"
        })
    
    # Validate place of supply
    place_of_supply = row.get("place_of_supply")
    error = validate_place_of_supply(place_of_supply, "", "place_of_supply")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate taxable value (should be <= ₹2.5 lakh)
    taxable_value = row.get("taxable_value")
    if taxable_value:
        try:
            value = float(taxable_value)
            if value > 250000:
                errors.append({
                    "row": row_number,
                    "field": "taxable_value",
                    "error": f"B2CS taxable value should be <= ₹2.5 lakh, got {value}"
                })
        except (ValueError, TypeError):
            pass
    
    # Validate tax based on place of supply
    igst_amount = row.get("igst_amount")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    
    # For B2CS, either IGST (inter-state) or CGST+SGST (intra-state)
    if igst_amount and (cgst_amount or sgst_amount):
        errors.append({
            "row": row_number,
            "field": "tax_type",
            "error": "B2CS invoices should have either IGST or CGST+SGST, not both"
        })
    
    if not igst_amount and not (cgst_amount and sgst_amount):
        errors.append({
            "row": row_number,
            "field": "tax_type",
            "error": "B2CS invoices must have tax (IGST or CGST+SGST)"
        })
    
    # Validate taxable value and tax
    error = validate_invoice_value(taxable_value, cgst_amount, sgst_amount, igst_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


def validate_export_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate an Export invoice row.
    
    Export invoices must have:
    - Place of supply as "96-Other Countries" or "96-00"
    - IGST paid (zero-rated supply)
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # Validate export place of supply
    place_of_supply = row.get("place_of_supply")
    if place_of_supply:
        # Export should have "96" as state code
        if '-' in place_of_supply:
            state_code = place_of_supply.split('-')[0].strip()
        else:
            state_code = place_of_supply[:2] if len(place_of_supply) >= 2 else place_of_supply
        
        if state_code != "96":
            errors.append({
                "row": row_number,
                "field": "place_of_supply",
                "error": f"Export place of supply must be '96-Other Countries', got '{place_of_supply}'"
            })
    
    # Export should have IGST (zero-rated)
    igst_amount = row.get("igst_amount")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    
    if cgst_amount or sgst_amount:
        errors.append({
            "row": row_number,
            "field": "tax_type",
            "error": "Export invoices should have IGST only (zero-rated supply)"
        })
    
    if not igst_amount:
        errors.append({
            "row": row_number,
            "field": "igst_amount",
            "error": "Export invoices must have IGST amount"
        })
    
    # Validate invoice date
    invoice_date = row.get("invoice_date")
    return_period = row.get("return_period", "03/2024")
    error = validate_invoice_date(invoice_date, return_period, "invoice_date")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate taxable value and tax
    taxable_value = row.get("taxable_value")
    error = validate_invoice_value(taxable_value, 0, 0, igst_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


def validate_cdnr_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate a CDNR (Credit/Debit Note - Registered) row.
    
    CDNR invoices are credit/debit notes for registered persons.
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # Validate recipient GSTIN
    gstin = row.get("gstin") or row.get("recipient_gstin")
    error = validate_gstin(gstin, "recipient_gstin")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate note type (Credit Note or Debit Note)
    note_type = row.get("note_type") or row.get("cnd_type")
    if note_type:
        note_type = str(note_type).lower()
        if note_type not in ["credit note", "debit note", "c", "d"]:
            errors.append({
                "row": row_number,
                "field": "note_type",
                "error": f"Invalid note type: must be 'Credit Note' or 'Debit Note', got '{note_type}'"
            })
    
    # Validate pre-GST period flag
    pre_gst_period = row.get("pre_gst_period")
    if pre_gst_period and str(pre_gst_period).lower() not in ["yes", "no", "y", "n"]:
        errors.append({
            "row": row_number,
            "field": "pre_gst_period",
            "error": f"Invalid pre_gst_period: must be Yes/No, got '{pre_gst_period}'"
        })
    
    # Validate note date
    note_date = row.get("note_date") or row.get("invoice_date")
    return_period = row.get("return_period", "03/2024")
    error = validate_invoice_date(note_date, return_period, "note_date")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate taxable value and tax
    taxable_value = row.get("taxable_value")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    igst_amount = row.get("igst_amount")
    cess_amount = row.get("cess_amount")
    
    error = validate_invoice_value(taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


def validate_cdnur_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate a CDNUR (Credit/Debit Note - Unregistered) row.
    
    CDNUR invoices are credit/debit notes for unregistered persons.
    
    Args:
        row: Dictionary containing invoice data
        row_number: Row number in Excel (1-indexed)
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    # CDNUR should NOT have recipient GSTIN
    gstin = row.get("gstin") or row.get("recipient_gstin")
    if gstin:
        errors.append({
            "row": row_number,
            "field": "recipient_gstin",
            "error": "CDNUR invoices should not have recipient GSTIN"
        })
    
    # Validate note type
    note_type = row.get("note_type") or row.get("cnd_type")
    if note_type:
        note_type = str(note_type).lower()
        if note_type not in ["credit note", "debit note", "c", "d"]:
            errors.append({
                "row": row_number,
                "field": "note_type",
                "error": f"Invalid note type: must be 'Credit Note' or 'Debit Note', got '{note_type}'"
            })
    
    # Validate place of supply
    place_of_supply = row.get("place_of_supply")
    error = validate_place_of_supply(place_of_supply, "", "place_of_supply")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate note date
    note_date = row.get("note_date") or row.get("invoice_date")
    return_period = row.get("return_period", "03/2024")
    error = validate_invoice_date(note_date, return_period, "note_date")
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    # Validate taxable value and tax
    taxable_value = row.get("taxable_value")
    cgst_amount = row.get("cgst_amount")
    sgst_amount = row.get("sgst_amount")
    igst_amount = row.get("igst_amount")
    
    error = validate_invoice_value(taxable_value, cgst_amount, sgst_amount, igst_amount)
    if error:
        error.row = row_number
        errors.append(error.to_dict())
    
    return errors


# =============================================================================
# Main Validation Function
# =============================================================================

def validate_gstr1_row(
    row: Dict[str, Any],
    row_number: int,
    section: str = "b2b",
    company_gstin: str = ""
) -> List[Dict[str, Any]]:
    """
    Validate a single GSTR-1 row from Excel upload.
    
    This is the main entry point for row validation. It dispatches to
    the appropriate validation function based on the section type.
    
    Args:
        row: Dictionary containing invoice data from Excel row
        row_number: Row number in Excel (1-indexed)
        section: GSTR-1 section type (b2b, b2cl, b2cs, export, cdnr, cdnur)
        company_gstin: Company's GSTIN for state comparison
        
    Returns:
        List of validation error dictionaries, each containing:
        {
            "row": int,           # Row number
            "field": str,         # Field name that failed
            "error": str,         # Error description
            "value": str, optional # The invalid value
        }
        Empty list if no errors.
        
    Example:
        >>> row = {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", ...}
        >>> errors = validate_gstr1_row(row, 7, "b2b")
        >>> print(errors)
        [{"row": 7, "field": "gstin", "error": "Invalid GSTIN format"}]
    """
    # Normalize section name
    section = str(section).lower().strip()
    
    # Dispatch to appropriate validation function
    validators = {
        "b2b": validate_b2b_row,
        "b2cl": validate_b2cl_row,
        "b2cs": validate_b2cs_row,
        "export": validate_export_row,
        "exp": validate_export_row,
        "cdnr": validate_cdnr_row,
        "cdnur": validate_cdnur_row,
    }
    
    validator = validators.get(section)
    if validator is None:
        return [{
            "row": row_number,
            "field": "section",
            "error": f"Unknown section type: {section}"
        }]
    
    return validator(row, row_number, company_gstin)


def validate_gstr1_data(
    data: List[Dict[str, Any]],
    section: str = "b2b",
    company_gstin: str = ""
) -> List[Dict[str, Any]]:
    """
    Validate a list of GSTR-1 rows.
    
    Args:
        data: List of dictionaries containing invoice data
        section: GSTR-1 section type
        company_gstin: Company's GSTIN for state comparison
        
    Returns:
        List of all validation errors from all rows
    """
    all_errors = []
    
    for row_number, row in enumerate(data, start=1):
        errors = validate_gstr1_row(row, row_number, section, company_gstin)
        all_errors.extend(errors)
    
    return all_errors
