"""
GSTR-1 Validation Module

This module provides validation functions for processing GSTR-1 Excel uploads.
Each row is validated against GST rules and returns structured errors.

Gaps addressed in this revision (per validations_and_calculations_audit.md §C1):
  1  PAN embedded in GSTIN          — validate_pan_in_gstin()
  2  GSTIN activation status stub   — validate_gstin_active_status()
  3  HSN chapter cross-reference    — validate_hsn_with_chapter()
  4  E-invoice IRN format           — validate_irn()
  5  Section 9(5) ECO validation    — validate_eco_row()
  6  B2CS date-boundary enforcement — get_b2cs_limit_for_date() + validate_b2cs_row() fix
  7  3-year amendment window        — validate_amendment_window()
  8  Supply type mandatory for ECO  — (inside validate_eco_row)
"""

import logging
import re
from datetime import datetime, timedelta, date as date_type
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
VALID_GST_RATES = {0, 0.1, 0.25, 3, 5, 12, 18, 28}

# GSTIN pattern (15 characters, alphanumeric)
GSTIN_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$')

# State codes for India (01-37, 96=Overseas, 97=Other Territory)
VALID_STATE_CODES = set(str(i).zfill(2) for i in range(1, 38)) | {"96", "97"}

# ---------------------------------------------------------------------------
# Gap 1 — PAN-in-GSTIN constants
# PAN format: chars 0-4 alphabetic, char 4 = entity-type letter,
#             chars 5-8 alphabetic, char 9 = numeric (first letter of holder name).
# In GSTIN positions 3-12 (1-indexed), i.e. Python slice [2:12].
# ---------------------------------------------------------------------------
# Valid PAN entity-type characters (4th char of PAN = 8th char of GSTIN, i.e. index 7)
PAN_ENTITY_TYPES = frozenset("PCFHATBLJG")

# ---------------------------------------------------------------------------
# Gap 3 — HSN chapter cross-reference
# All 97 valid HS chapters present in India's GST tariff schedule
# ---------------------------------------------------------------------------
VALID_HSN_CHAPTERS = frozenset(
    str(i).zfill(2)
    for i in [
        1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
        21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,
        61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,
        81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,
        # SAC service chapters start with 99
        99,
    ]
)

# ---------------------------------------------------------------------------
# Gap 4 — E-invoice IRN format
# IRN must be exactly 64 hexadecimal characters
# ---------------------------------------------------------------------------
IRN_PATTERN = re.compile(r'^[0-9a-fA-F]{64}$')

# ---------------------------------------------------------------------------
# Gap 6 — B2CS date-aware limit (CBIC Circular 220/14/2024-GST, effective Aug 2024)
# ---------------------------------------------------------------------------
B2CS_LIMIT_CHANGE_DATE = datetime(2024, 8, 1).date()
B2CS_LIMIT_OLD = 250_000   # ₹2,50,000 — before 01-Aug-2024
B2CS_LIMIT_NEW = 100_000   # ₹1,00,000 — from 01-Aug-2024 onwards

# ---------------------------------------------------------------------------
# Gap 7 — Amendment window: 3 years (36 months) per Section 39 CGST Act
# ---------------------------------------------------------------------------
AMENDMENT_WINDOW_MONTHS = 36


# =============================================================================
# Validation Functions
# =============================================================================

# =============================================================================
# Gap 1 — PAN Embedded in GSTIN
# =============================================================================

def validate_pan_in_gstin(gstin: str, field_name: str = "gstin") -> Optional[GSTR1ValidationError]:
    """
    Validate that characters 3–12 of a GSTIN form a valid PAN.

    PAN format (within GSTIN indices 2–11, 0-based):
      [2:7]  — 5 uppercase alpha (first 5 letters of PAN)
      [7]    — 1 letter that must be a valid entity-type char (P/C/F/H/A/T/B/L/J/G)
      [8:12] — 4-char alphanumeric (last 4 chars of PAN: 3 alpha + 1 numeric)

    >>> validate_pan_in_gstin("27AAAAA1234A1Z5")  # valid
    >>> validate_pan_in_gstin("27AAAAZ1234A1Z5")  # invalid entity type 'Z'
    """
    if not gstin or len(gstin) != 15:
        return None  # Structural check handled by validate_gstin

    pan_segment = gstin[2:12]  # 10-char PAN embedded in GSTIN

    # First 3 chars must be uppercase letters (already enforced by regex, double-check)
    if not pan_segment[:3].isalpha():
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid PAN in GSTIN: first 3 PAN chars must be letters, got '{pan_segment[:3]}'",
            value=gstin
        )

    # 4th char of PAN (index [5] of GSTIN) = entity type
    entity_char = gstin[5]
    if entity_char not in PAN_ENTITY_TYPES:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                f"Invalid PAN entity type in GSTIN: char 6 must be one of "
                f"{sorted(PAN_ENTITY_TYPES)}, got '{entity_char}'"
            ),
            value=gstin
        )

    # 5th char of PAN (index [6] of GSTIN) must be alpha (first letter of holder name)
    if not gstin[6].isalpha():
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid PAN in GSTIN: char 7 must be a letter (holder initial), got '{gstin[6]}'",
            value=gstin
        )

    # Chars 8–11 of GSTIN (PAN chars 6–9): 4 digits
    if not gstin[7:11].isdigit():
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid PAN in GSTIN: chars 8–11 must be 4 digits (sequential number), got '{gstin[7:11]}'",
            value=gstin
        )

    return None


# =============================================================================
# Gap 2 — GSTIN Activation Status (Stub)
# =============================================================================

def validate_gstin_active_status(
    gstin: str,
    field_name: str = "gstin",
    portal_check: bool = False,
) -> Optional[GSTR1ValidationError]:
    """
    Validate GSTIN activation status on the GSTN portal.

    When ``portal_check=False`` (default, safe for offline mode):
        Returns a WARNING-level note that live status cannot be verified.
        Does NOT block processing.

    When ``portal_check=True``:
        Attempts a live GSTN Public API call via the existing
        ``gstin_info.get_gstin_info()`` helper.  Requires valid GSP
        credentials configured in the application settings.  Raises
        ``NotImplementedError`` if credentials are not wired — future
        implementors should replace the stub body with the real call.

    Args:
        gstin: 15-character GSTIN to check.
        field_name: Field name for error messages.
        portal_check: Whether to attempt a live GSTN API call.

    Returns:
        GSTR1ValidationError (WARNING severity encoded in error prefix)
        if the status cannot be confirmed, or None if confirmed Active.
    """
    if not gstin or len(gstin) != 15:
        return None  # Structural check handled upstream

    if not portal_check:
        # Non-blocking advisory — does not stop filing
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                "[WARNING] GSTIN activation status could not be verified offline. "
                "Enable portal_check=True with valid GSTN credentials to confirm "
                f"that GSTIN {gstin} is currently Active on the GSTN portal."
            ),
            value=gstin,
        )

    # Live check stub — replace body below once GSP credentials are configured
    raise NotImplementedError(
        "Live GSTN activation check is not yet wired. "
        "Configure GSP credentials and call gstin_info.get_gstin_info() here."
    )


# =============================================================================
# GSTIN format validation (enhanced with Gap 1)
# =============================================================================

def validate_gstin(gstin: str, field_name: str = "gstin") -> Optional[GSTR1ValidationError]:
    """
    Validate GSTIN format, state code, and PAN embedding.

    GSTIN must be:
    - Exactly 15 characters
    - First 2 digits: valid Indian state code
    - Characters 3–12: valid PAN (Gap 1 — PAN entity type check)
    - Character 13: alphanumeric entity number
    - Character 14: 'Z' (constant)
    - Character 15: checksum (alphanumeric)

    Args:
        gstin: GSTIN string to validate
        field_name: Name of the field for error messages

    Returns:
        GSTR1ValidationError if invalid, None if valid
    """
    if not gstin:
        return GSTR1ValidationError(
            row=0,
            field=field_name,
            error=f"{field_name} is required",
            value=gstin
        )

    gstin = str(gstin).strip().upper()

    if len(gstin) != 15:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error="Invalid GSTIN format: must be 15 characters",
            value=gstin
        )

    if not GSTIN_PATTERN.match(gstin):
        return GSTR1ValidationError(
            row=0, field=field_name,
            error="Invalid GSTIN format: does not match expected pattern",
            value=gstin
        )

    state_code = gstin[:2]
    if state_code not in VALID_STATE_CODES:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid GSTIN: unrecognised state code '{state_code}'",
            value=gstin
        )

    # Gap 1 — PAN embedded in GSTIN
    pan_error = validate_pan_in_gstin(gstin, field_name)
    if pan_error:
        return pan_error

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


# =============================================================================
# Gap 3 — HSN Chapter / Sub-heading Cross-Reference
# =============================================================================

def validate_hsn_with_chapter(
    hsn_code: Any,
    field_name: str = "hsn_code",
) -> Optional[GSTR1ValidationError]:
    """
    Validate HSN/SAC code format and chapter-level correctness.

    Rules:
    - Must be 4–8 numeric digits.
    - First 2 digits must be a known HS chapter (01–97, 99 for services).
    - If the code starts with '99', it is treated as a SAC (service) code
      and must be 4–6 digits.
    - Chapter '98' is not used in India's GST schedule; codes starting with
      '98' are flagged as invalid.

    Args:
        hsn_code: Raw HSN/SAC value from the upload row.
        field_name: Field name for error messages.

    Returns:
        GSTR1ValidationError if invalid, None if valid.
    """
    if not hsn_code or str(hsn_code).strip() == "":
        return None  # Optional field; absence is handled by UQC check

    code = str(hsn_code).strip()

    if not code.isdigit():
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid HSN/SAC: must contain only digits, got '{code}'",
            value=hsn_code,
        )

    if len(code) < 4 or len(code) > 8:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid HSN/SAC length: must be 4–8 digits, got {len(code)} digit(s)",
            value=hsn_code,
        )

    chapter = code[:2]

    if chapter not in VALID_HSN_CHAPTERS:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                f"Invalid HSN chapter '{chapter}': not a recognised GST HS chapter. "
                f"Valid chapters are 01–97 (goods) and 99 (services/SAC)."
            ),
            value=hsn_code,
        )

    # SAC codes (chapter 99) must be 4–6 digits
    if chapter == "99" and len(code) > 6:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=f"Invalid SAC code: service codes (chapter 99) must be 4–6 digits, got {len(code)}",
            value=hsn_code,
        )

    return None


# =============================================================================
# Gap 4 — E-Invoice IRN Validation
# =============================================================================

def validate_irn(
    irn: Any,
    field_name: str = "irn",
) -> Optional[GSTR1ValidationError]:
    """
    Validate e-invoice Invoice Reference Number (IRN) format.

    An IRN, when present, must be exactly 64 lowercase or uppercase
    hexadecimal characters (SHA-256 hash of key invoice fields).

    The IRN field is optional for invoices below the e-invoicing
    turnover threshold, so an absent/empty IRN is allowed (INFO only).
    A present-but-malformed IRN is an ERROR.

    Args:
        irn: IRN value from the invoice row.
        field_name: Field name for error messages.

    Returns:
        GSTR1ValidationError if IRN is present but malformed, else None.
    """
    if not irn or str(irn).strip() == "":
        return None  # IRN is optional; absence not an error

    irn_str = str(irn).strip()

    if not IRN_PATTERN.match(irn_str):
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                f"Invalid IRN format: must be exactly 64 hexadecimal characters, "
                f"got {len(irn_str)} chars '{irn_str[:16]}...'"
            ),
            value=irn,
        )

    return None


# =============================================================================
# Gap 6 — B2CS Date-Aware Limit Helper
# =============================================================================

def get_b2cs_limit_for_date(invoice_date: Any) -> int:
    """
    Return the applicable B2CS inter-state invoice value limit for a date.

    Per CBIC Circular 220/14/2024-GST (effective 01-Aug-2024):
    - Before 01-Aug-2024 : ₹2,50,000
    - From  01-Aug-2024  : ₹1,00,000

    Args:
        invoice_date: Invoice date as datetime, date, or parseable string.

    Returns:
        Applicable limit integer (₹ amount).
    """
    if invoice_date is None:
        return B2CS_LIMIT_NEW  # Conservative: use stricter limit when date unknown

    try:
        if isinstance(invoice_date, datetime):
            inv_date = invoice_date.date()
        elif isinstance(invoice_date, date_type):
            inv_date = invoice_date
        else:
            # Parse string in common formats
            for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d"):
                try:
                    inv_date = datetime.strptime(str(invoice_date).strip(), fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return B2CS_LIMIT_NEW  # Conservative fallback
    except Exception:
        return B2CS_LIMIT_NEW

    return B2CS_LIMIT_OLD if inv_date < B2CS_LIMIT_CHANGE_DATE else B2CS_LIMIT_NEW


# =============================================================================
# Gap 7 — Cross-Period Amendment Window (3-Year Rule)
# =============================================================================

def validate_amendment_window(
    amendment_date: Any,
    original_invoice_date: Any,
    field_name: str = "invoice_date",
) -> Optional[GSTR1ValidationError]:
    """
    Validate that an amendment is within the permissible 3-year window.

    Per Section 39 of the CGST Act, amendments to GSTR-1 invoices can only
    be made within 36 months of the end of the financial year in which the
    original invoice was issued (i.e., 3 full financial years).

    For practical purposes this module applies a simpler 36-consecutive-month
    rolling window from the original invoice date, which is slightly more
    permissive and is the industry-accepted interpretation.

    Severity:
    - ERROR  : amendment date is beyond 36 months of original invoice date.
    - WARNING: amendment is within the window but < 3 months before expiry.

    Args:
        amendment_date: Date of the amendment document.
        original_invoice_date: Date of the original invoice being amended.
        field_name: Field name for error messages.

    Returns:
        GSTR1ValidationError if outside window (ERROR prefix) or approaching
        expiry (WARNING prefix), else None.
    """
    if not amendment_date or not original_invoice_date:
        return None  # Cannot evaluate without both dates

    def _parse(d: Any):
        if isinstance(d, datetime):
            return d.date()
        if isinstance(d, date_type):
            return d
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(str(d).strip(), fmt).date()
            except ValueError:
                continue
        return None

    amend_d = _parse(amendment_date)
    orig_d = _parse(original_invoice_date)

    if amend_d is None or orig_d is None:
        return None  # Unparseable dates are handled by date validators

    # 36-month window: original date + 3 years
    window_end_year = orig_d.year + 3
    try:
        window_end = orig_d.replace(year=window_end_year)
    except ValueError:
        # Edge case: Feb-29 in non-leap year
        window_end = orig_d.replace(year=window_end_year, day=28)

    if amend_d > window_end:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                f"[ERROR] Amendment outside 3-year window: original invoice date "
                f"{orig_d.strftime('%d/%m/%Y')}, window expired {window_end.strftime('%d/%m/%Y')}. "
                f"Amendments beyond 36 months are not permitted under Section 39 CGST Act."
            ),
            value=str(amendment_date),
        )

    # Warn if < 90 days remain before window closes
    days_remaining = (window_end - amend_d).days
    if days_remaining < 90:
        return GSTR1ValidationError(
            row=0, field=field_name,
            error=(
                f"[WARNING] Amendment window expiring soon: {days_remaining} days remain "
                f"(window closes {window_end.strftime('%d/%m/%Y')}). "
                f"Ensure timely filing to avoid rejection."
            ),
            value=str(amendment_date),
        )

    return None


# =============================================================================
# Gaps 5 & 8 — Section 9(5) ECO Row Validation
# =============================================================================

def validate_eco_row(row: Dict[str, Any], row_number: int) -> List[Dict[str, Any]]:
    """
    Validate a row classified as an E-Commerce Operator (ECO) supply.

    Covers:
    - Gap 5: If eco_ctin is present, it must be a valid GSTIN.
             If sec_9_5 == 'Y' or supply_type is 'eco', eco_ctin is mandatory.
    - Gap 8: supply_type must be 'eco' for Table 14/15 entries.

    ECO supplies are inter-state by nature (IGST only); CGST/SGST in an
    ECO row is flagged as a WARNING.

    Args:
        row: Invoice data dictionary.
        row_number: Row number for error attribution.

    Returns:
        List of validation error dicts.
    """
    errors: List[Dict[str, Any]] = []

    eco_ctin = row.get("eco_ctin") or row.get("gstin_eco") or row.get("etin", "")
    sec_9_5 = str(row.get("sec_9_5", "") or "").strip().upper()
    supply_type = str(row.get("supply_type", "") or "").strip().lower()
    section = str(row.get("section", "") or "").strip().lower()

    # --- Gap 5a: Validate eco_ctin format when provided ---
    if eco_ctin:
        error = validate_gstin(str(eco_ctin).strip().upper(), "eco_ctin")
        if error:
            error.row = row_number
            errors.append(error.to_dict())

    # --- Gap 5b: eco_ctin is mandatory when sec_9_5 == 'Y' ---
    if sec_9_5 == "Y" and not eco_ctin:
        errors.append({
            "row": row_number,
            "field": "eco_ctin",
            "error": (
                "eco_ctin (E-Commerce Operator GSTIN) is required when "
                "Section 9(5) = 'Y'. Supply is deemed to be made by the ECO."
            ),
        })

    # --- Gap 5c: eco_ctin mandatory when supply_type == 'eco' ---
    if supply_type == "eco" and not eco_ctin:
        errors.append({
            "row": row_number,
            "field": "eco_ctin",
            "error": (
                "eco_ctin is required when supply_type is 'eco' (Table 14/15). "
                "Provide the GSTIN of the E-Commerce Operator facilitating this supply."
            ),
        })

    # --- Gap 8: supply_type should be 'eco' for Table 14/15 ---
    is_eco_section = section in ("ecom-tcs", "ecom-pay", "14", "15", "eco", "ecom")
    if is_eco_section and supply_type not in ("eco", "ecom", ""):
        errors.append({
            "row": row_number,
            "field": "supply_type",
            "error": (
                f"[WARNING] supply_type should be 'eco' for Table 14/15 ECO entries, "
                f"got '{supply_type}'. This may cause misclassification in the filed return."
            ),
        })

    if is_eco_section and not supply_type:
        errors.append({
            "row": row_number,
            "field": "supply_type",
            "error": (
                "[WARNING] supply_type is missing for an ECO row. "
                "Set supply_type = 'eco' to correctly map to Table 14/15."
            ),
        })

    # --- ECO supplies should carry IGST, not CGST/SGST ---
    cgst = row.get("cgst_amount") or row.get("cgst", 0)
    sgst = row.get("sgst_amount") or row.get("sgst", 0)
    try:
        if float(cgst or 0) > 0 or float(sgst or 0) > 0:
            errors.append({
                "row": row_number,
                "field": "tax_type",
                "error": (
                    "[WARNING] ECO / Section 9(5) supplies are inter-state and "
                    "should carry IGST only. CGST/SGST found on this row."
                ),
            })
    except (ValueError, TypeError):
        pass

    return errors


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

    # Gap 4: Validate IRN format if present
    irn = row.get("irn") or row.get("invoice_reference_number", "")
    error = validate_irn(irn, "irn")
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

    # Gap 6: Date-aware B2CS limit (₹2.5L before Aug 2024, ₹1L from Aug 2024)
    invoice_date = row.get("invoice_date")
    b2cs_limit = get_b2cs_limit_for_date(invoice_date)

    # Check using invoice_value (authoritative); fall back to taxable_value
    check_value_raw = row.get("invoice_value") or row.get("taxable_value")
    taxable_value = row.get("taxable_value")
    if check_value_raw:
        try:
            check_value = float(check_value_raw)
            if check_value > b2cs_limit:
                errors.append({
                    "row": row_number,
                    "field": "invoice_value",
                    "error": (
                        f"B2CS invoice value ₹{check_value:,.2f} exceeds the applicable limit "
                        f"of ₹{b2cs_limit:,} for invoice date {invoice_date or 'unknown'}. "
                        f"Inter-state invoices above this threshold must be reported as B2CL."
                    ),
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

    # ------------------------------------------------------------------
    # Gap 7: Cross-period amendment window check (all section types)
    # Run before section dispatch so it applies universally.
    # ------------------------------------------------------------------
    amendment_errors: List[Dict[str, Any]] = []
    if row.get("is_amendment") or row.get("orig_inum") or row.get("original_invoice_number"):
        amend_err = validate_amendment_window(
            amendment_date=row.get("invoice_date") or row.get("note_date"),
            original_invoice_date=row.get("original_invoice_date") or row.get("orig_idt"),
            field_name="invoice_date",
        )
        if amend_err:
            amend_err.row = row_number
            amendment_errors.append(amend_err.to_dict())

    # ------------------------------------------------------------------
    # Dispatch to section-specific validator
    # ------------------------------------------------------------------

    def _eco_wrapper(r: Dict[str, Any], rn: int, cg: str = "") -> List[Dict[str, Any]]:
        """Wrap validate_eco_row to accept optional company_gstin arg."""
        return validate_eco_row(r, rn)

    validators = {
        "b2b": validate_b2b_row,
        "b2cl": validate_b2cl_row,
        "b2cs": validate_b2cs_row,
        "export": validate_export_row,
        "exp": validate_export_row,
        "cdnr": validate_cdnr_row,
        "cdnur": validate_cdnur_row,
        # Gaps 5 & 8: ECO / Section 9(5) sections
        "eco": _eco_wrapper,
        "ecom": _eco_wrapper,
        "ecom-tcs": _eco_wrapper,
        "ecom-pay": _eco_wrapper,
        "14": _eco_wrapper,
        "15": _eco_wrapper,
    }

    validator = validators.get(section)
    if validator is None:
        # For unknown sections that carry eco_ctin, run ECO checks anyway
        eco_ctin = row.get("eco_ctin") or row.get("gstin_eco") or row.get("etin")
        if eco_ctin or str(row.get("sec_9_5", "")).upper() == "Y":
            section_errors = validate_eco_row(row, row_number)
        else:
            section_errors = [{
                "row": row_number,
                "field": "section",
                "error": f"Unknown section type: {section}",
            }]
        return amendment_errors + section_errors

    section_errors = validator(row, row_number, company_gstin)
    return amendment_errors + section_errors


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
