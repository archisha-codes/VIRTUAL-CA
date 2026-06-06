"""
FastAPI-compatible utilities for GST India compliance module.

This module has been refactored to remove all Frappe/ERPNext dependencies
and work independently within a FastAPI environment.
"""

import copy
import functools
import io
import tarfile
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from dateutil import parser
from pytz import timezone
from titlecase import titlecase as _titlecase

# Import frappe replacement utilities
from india_compliance.gst_india.utils.frappe_replacements import (
    _dict,
    _,
    add_to_date,
    as_json,
    cache,
    cint,
    clear_document_cache,
    db,
    flags,
    format_date,
    generate_hash,
    getdate,
    local,
    now_datetime,
    parse_json,
    sbool,
    throw,
    ValidationError,
)

from india_compliance.exceptions import (
    GatewayTimeoutError,
    GSPServerError,
)
from india_compliance.gst_india.constants import (
    ABBREVIATIONS,
    E_INVOICE_MASTER_CODES_URL,
    GST_ACCOUNT_FIELDS,
    GST_INVOICE_NUMBER_FORMAT,
    GST_PARTY_TYPES,
    GSTIN_FORMATS,
    PAN_NUMBER,
    PINCODE_FORMAT,
    SALES_DOCTYPES,
    STATE_NUMBERS,
    STATE_PINCODE_MAPPING,
    TCS,
    TIMEZONE,
    UOM_MAP,
)


# =============================================================================
# Native Python Equivalents for Frappe Utilities
# =============================================================================

def to_dict(data) -> dict:
    """
    Convert data to a dictionary.
    Replaces frappe._dict()
    """
    return _dict(data)


def get_link_to_form(doctype: str, name: str) -> str:
    """
    Generate a link to a document form.
    Returns a simple HTML-style link or plain text for FastAPI.
    Replaces frappe.get_link_to_form()
    """
    # For FastAPI, return a simple representation
    return f"{doctype}/{name}"


def bold(text: str) -> str:
    """
    Wrap text in bold formatting.
    Replaces frappe.bold()
    """
    return f"**{text}**"


def _(text: str) -> str:
    """
    Translation function placeholder.
    Replaces frappe.translate() for i18n.
    In FastAPI, this just returns the text as-is.
    """
    return text


# =============================================================================
# Date and Time Utilities
# =============================================================================

def getdate(date=None) -> Optional[datetime.date]:
    """
    Convert value to date object.
    Replaces frappe.utils.getdate()
    """
    if date is None:
        return datetime.now().date()
    
    if isinstance(date, datetime):
        return date.date()
    if isinstance(date, datetime.date):
        return date
    
    try:
        return parser.parse(str(date)).date()
    except (ValueError, TypeError):
        return None


def get_datetime(dt=None) -> datetime:
    """
    Get datetime object.
    Replaces frappe.utils.get_datetime()
    """
    if dt is None:
        return datetime.now()
    if isinstance(dt, datetime):
        return dt
    try:
        return parser.parse(str(dt))
    except (ValueError, TypeError):
        return datetime.now()


def add_to_date(
    date: Optional[datetime] = None,
    years: int = 0,
    months: int = 0,
    days: int = 0,
    hours: int = 0,
    minutes: int = 0,
    seconds: int = 0,
) -> datetime:
    """
    Add time to a date.
    Replaces frappe.utils.add_to_date()
    """
    date = date or datetime.now()
    
    # Simple implementation for common cases
    if years or months:
        # Approximate calculation for months
        from dateutil.relativedelta import relativedelta
        date = date + relativedelta(years=years, months=months, days=days,
                                     hours=hours, minutes=minutes, seconds=seconds)
    else:
        date = date + timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
    
    return date


def get_last_day(date: datetime) -> datetime:
    """
    Get the last day of the month.
    Replaces frappe.utils.get_last_day()
    """
    if date.month == 12:
        return datetime(date.year, 12, 31)
    else:
        next_month = datetime(date.year, date.month + 1, 1)
        return next_month - timedelta(days=1)


def get_quarter_start(date: datetime) -> datetime:
    """
    Get the start of the quarter.
    Replaces frappe.utils.get_quarter_start()
    """
    quarter_month = ((date.month - 1) // 3) * 3 + 1
    return datetime(date.year, quarter_month, 1)


def get_system_timezone() -> str:
    """
    Get the system timezone.
    Replaces frappe.utils.get_system_timezone()
    """
    import tzlocal
    try:
        return tzlocal.get_localzone_name()
    except Exception:
        return "UTC"


def cint(value: Any) -> int:
    """
    Convert to integer.
    Replaces frappe.utils.cint()
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def cstr(value: Any) -> str:
    """
    Convert to string.
    Replaces frappe.utils.cstr()
    """
    if value is None:
        return ""
    return str(value)


def rounded(number: float, precision: int = 2) -> float:
    """
    Round a number.
    Replaces frappe.utils.rounded()
    """
    return round(number, precision)


def flt(value: float, precision: int = 2) -> float:
    """
    Convert to float with precision.
    Replaces frappe.utils.data.flt()
    """
    try:
        return round(float(value), precision)
    except (ValueError, TypeError):
        return 0.0


def format_date(date, format="dd/MM/yyyy") -> str:
    """
    Format date to string.
    Replaces frappe.utils.format_date()
    """
    if not date:
        return ""
    
    if isinstance(date, str):
        date = getdate(date)
    
    if isinstance(date, datetime.date):
        # Simple format mapping
        replacements = {
            "dd": str(date.day).zfill(2),
            "d": str(date.day),
            "MM": str(date.month).zfill(2),
            "M": str(date.month),
            "yyyy": str(date.year),
            "yy": str(date.year)[-2:],
        }
        result = format
        for key, value in replacements.items():
            result = result.replace(key.upper(), value)
        return result
    
    return str(date)


# =============================================================================
# Data File Path Utilities
# =============================================================================

def get_data_file_path(file_name: str) -> str:
    """
    Get the full path to a data file.
    Replaces frappe.get_app_path()
    """
    import os
    # Get the directory containing this module
    module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(module_dir, "data", file_name)


def get_file_path(file_id: str) -> str:
    """
    Get the file path for a file.
    Replaces frappe.utils.file_manager.get_file_path()
    """
    # TODO: Implement file storage abstraction for FastAPI
    raise NotImplementedError("File storage abstraction needed for FastAPI")


def get_file_json(path: str) -> dict:
    """
    Read JSON from a file.
    Replaces frappe.get_file_json()
    """
    import json
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =============================================================================
# Core Validation Functions (These are critical and should remain intact)
# =============================================================================

def get_state(state_number: str) -> Optional[str]:
    """Get state from State Number"""
    state_number = str(state_number).zfill(2)
    for state, code in STATE_NUMBERS.items():
        if code == state_number:
            return state
    return None


def validate_gstin(
    gstin: str,
    label: str = "GSTIN",
    *,
    is_tcs_gstin: bool = False,
    is_transporter_id: bool = False,
) -> Optional[str]:
    """
    Validate GSTIN with following checks:
    - Length should be 15
    - Validate GSTIN Check Digit (except for Unique Common Enrolment Number for Transporters)
    - Validate GSTIN of e-Commerce Operator (TCS) (Based on is_tcs_gstin)
    """
    if not gstin:
        return None

    gstin = gstin.upper().strip()

    if len(gstin) != 15:
        raise ValidationError(
            f"{label} {bold(gstin)} must have 15 characters",
            field=label
        )

    # eg: 29AAFCA7488L1Z0 invalid check digit for valid transporter id
    if not is_transporter_id:
        validate_gstin_check_digit(gstin, label)

    if is_tcs_gstin and not TCS.match(gstin):
        raise ValidationError(
            "Invalid format for e-Commerce Operator (TCS) GSTIN",
            field=label
        )

    return gstin


def validate_gstin_check_digit(gstin: str, label: str = "GSTIN") -> None:
    """
    Function to validate the check digit of the GSTIN.
    Replaces frappe-based validation with pure Python.
    """
    factor = 1
    total = 0
    code_point_chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    mod = len(code_point_chars)
    input_chars = gstin[:-1]
    for char in input_chars:
        digit = factor * code_point_chars.find(char)
        digit = (digit // mod) + (digit % mod)
        total += digit
        factor = 2 if factor == 1 else 1
    
    if gstin[-1] != code_point_chars[((mod - (total % mod)) % mod)]:
        raise ValidationError(
            f"Invalid {label}! The check digit validation has failed.",
            field=label
        )


def validate_gst_category(gst_category: str, gstin: str) -> None:
    """
    Validate GST Category with following checks:
    - GST Category for parties without GSTIN should be Unregistered or Overseas.
    - GSTIN should match with the regex pattern as per GST Category of the party.
    """
    if not gstin:
        if gst_category not in ("Unregistered", "Overseas"):
            categories_without_gstin = {"Unregistered", "Overseas"}
            raise ValidationError(
                "GST Category should be one of {}".format(
                    " or ".join(
                        bold(category) for category in categories_without_gstin
                    )
                ),
                field="gst_category"
            )
        return

    if gst_category == "Unregistered":
        raise ValidationError(
            "GST Category cannot be Unregistered for party with GSTIN",
            field="gst_category"
        )

    valid_gstin_format = GSTIN_FORMATS.get(gst_category)
    if valid_gstin_format and not valid_gstin_format.match(gstin):
        raise ValidationError(
            "The GSTIN you've entered doesn't match the format for GST Category"
            f" {bold(gst_category)}. Please ensure you've entered the correct GSTIN and GST Category.",
            field="gst_category"
        )


def is_valid_pan(pan: str) -> bool:
    """Check if PAN number is valid."""
    return PAN_NUMBER.match(pan) if pan else False


def validate_pincode(address) -> None:
    """
    Validate Pincode with following checks:
    - Pincode should be a 6-digit number and cannot start with 0.
    - First 3 digits of Pincode should match with State Mapping as per e-Invoice Master Codes.

    @param address: Address object to validate (must have pincode, country, state, name attributes)
    """
    if not hasattr(address, 'country') or address.country != "India" or not address.pincode:
        return

    if not PINCODE_FORMAT.match(address.pincode):
        raise ValidationError(
            f"Postal Code for Address {get_link_to_form('Address', address.name)} must be a 6-digit number and cannot start with 0",
            field="pincode"
        )

    if address.state not in STATE_PINCODE_MAPPING:
        return

    first_three_digits = cint(address.pincode[:3])
    pincode_range = STATE_PINCODE_MAPPING[address.state]

    if isinstance(pincode_range[0], int):
        pincode_range = (pincode_range,)

    for lower_limit, upper_limit in pincode_range:
        if lower_limit <= int(first_three_digits) <= upper_limit:
            return

    raise ValidationError(
        f"Postal Code {bold(address.pincode)} for address {address.name} is not associated with"
        f" {bold(address.state)}. Ensure the initial three digits of your postal code align"
        f" correctly with the state as per the <a href='{E_INVOICE_MASTER_CODES_URL}'>e-Invoice Master"
        " Codes</a>.",
        field="pincode"
    )


def guess_gst_category(
    gstin: Optional[str], country: Optional[str], gst_category: Optional[str] = None
) -> str:
    """Guess GST category based on GSTIN and country."""
    if not gstin:
        if country and country != "India":
            return "Overseas"

        if not country and gst_category == "Overseas":
            return "Overseas"

        return "Unregistered"

    if GSTIN_FORMATS["Tax Deductor"].match(gstin):
        return "Tax Deductor"

    if GSTIN_FORMATS["Tax Collector"].match(gstin):
        return "Tax Collector"

    if GSTIN_FORMATS["Registered Regular"].match(gstin):
        if gst_category in (
            "Registered Regular",
            "Registered Composition",
            "SEZ",
            "Deemed Export",
            "Input Service Distributor",
        ):
            return gst_category

        return "Registered Regular"

    if GSTIN_FORMATS["UIN Holders"].match(gstin):
        return "UIN Holders"

    if GSTIN_FORMATS["Overseas"].match(gstin):
        return "Overseas"

    # eg: e-Commerce Operator (TCS)
    return "Registered Regular"


# =============================================================================
# Transaction-related Utilities
# =============================================================================

def is_overseas_doc(doc) -> bool:
    """Check if document is overseas transaction."""
    return is_overseas_transaction(doc.doctype, doc.gst_category, doc.place_of_supply)


def is_overseas_transaction(doctype: str, gst_category: str, place_of_supply: str) -> bool:
    """Check if transaction is overseas."""
    if gst_category == "SEZ":
        return True

    if doctype in SALES_DOCTYPES or doctype == "Payment Entry":
        return is_foreign_transaction(gst_category, place_of_supply)

    return gst_category == "Overseas"


def is_foreign_doc(doc) -> bool:
    """Check if document is foreign transaction."""
    return is_foreign_transaction(doc.gst_category, doc.place_of_supply)


def is_foreign_transaction(gst_category: str, place_of_supply: str) -> bool:
    """Check if transaction is foreign."""
    return gst_category == "Overseas" and place_of_supply == "96-Other Countries"


# =============================================================================
# Date Range and Timespan Utilities
# =============================================================================

def get_timespan_date_range(timespan: str, company: Optional[str] = None) -> Optional[Tuple[datetime, datetime]]:
    """Get date range for a timespan."""
    # TODO: Implement fiscal year logic without Frappe
    # For now, return None and let callers handle it
    return None


def get_month_or_quarter_dict() -> Dict[str, Any]:
    """Get month or quarter dictionary."""
    return {
        "Jan - Mar": (1, 3),
        "Apr - Jun": (4, 6),
        "Jul - Sep": (7, 9),
        "Oct - Dec": (10, 12),
        "January": 1,
        "February": 2,
        "March": 3,
        "April": 4,
        "May": 5,
        "June": 6,
        "July": 7,
        "August": 8,
        "September": 9,
        "October": 10,
        "November": 11,
        "December": 12,
    }


MONTHS = list(get_month_or_quarter_dict().keys())[4:]


def get_period(month_or_quarter: str, year: Optional[str] = None) -> Any:
    """Get period as month number or tuple."""
    month_or_quarter_no = get_month_or_quarter_dict().get(month_or_quarter)

    if isinstance(month_or_quarter_no, int):
        month_or_quarter_no = (month_or_quarter_no, month_or_quarter_no)

    if year:
        return str(month_or_quarter_no[1]).zfill(2) + str(year)

    return month_or_quarter_no


# =============================================================================
# Place of Supply Utilities
# =============================================================================

def get_place_of_supply_options(*, as_list: bool = False) -> Any:
    """Get place of supply options."""
    options = []
    for state_name, state_number in STATE_NUMBERS.items():
        options.append(f"{state_number}-{state_name}")

    if as_list:
        return options

    return "\n".join(sorted(options))


# =============================================================================
# UOM Utilities
# =============================================================================

def get_full_gst_uom(uom: str, settings: Optional[dict] = None) -> str:
    """Get full GST UOM."""
    gst_uom = get_gst_uom(uom, settings=settings)
    return f"{gst_uom}-{UOM_MAP.get(uom)}"


def get_gst_uom(uom: str, settings: Optional[dict] = None) -> str:
    """Returns the GST UOM from ERPNext UOM."""
    if not uom:
        return "OTH"
    
    uom = uom.upper()
    
    if uom in UOM_MAP:
        return uom
    
    return next((k for k, v in UOM_MAP.items() if v == uom), "OTH")


# =============================================================================
# JSON and File Utilities
# =============================================================================

def get_json_from_file(path: str) -> dict:
    """Get JSON from file."""
    return to_dict(get_file_json(get_file_path(path) if not path.startswith("/") else path))


def tar_gz_bytes_to_data(tar_gz_bytes: bytes) -> Optional[str]:
    """
    Return first file in tar.gz ending with .json.
    """
    with tarfile.open(fileobj=io.BytesIO(tar_gz_bytes), mode="r:gz") as tar_gz_file:
        for filename in tar_gz_file.getnames():
            if not filename.endswith(".json"):
                continue

            file_in_tar = tar_gz_file.extractfile(filename)

            if not file_in_tar:
                continue

            data = file_in_tar.read().decode("utf-8")
            break

    return data


# =============================================================================
# String and List Utilities
# =============================================================================

def join_list_with_custom_separators(input: List, separator: str = ", ", last_separator: str = " or ") -> str:
    """Join list with custom separators."""
    if type(input) not in (list, tuple):
        return ""

    if not input:
        return ""

    if len(input) == 1:
        return cstr(input[0])

    return (
        separator.join(cstr(item) for item in input[:-1])
        + last_separator
        + cstr(input[-1])
    )


def titlecase(value: str) -> str:
    """Convert to titlecase."""
    return _titlecase(value, callback=get_titlecase_version)


def get_titlecase_version(word: str, all_caps: bool = False, **kwargs) -> Optional[str]:
    """Returns abbreviation if found, else None."""
    if not all_caps:
        word = word.upper()

    elif word.endswith("IDC"):
        # GIDC, MIDC, etc.
        # case maintained if word is already in all caps
        return word

    if word in ABBREVIATIONS:
        return word

    return None


# =============================================================================
# Dictionary Utilities
# =============================================================================

def merge_dicts(d1: dict, d2: dict) -> dict:
    """
    Merge two dictionaries recursively.
    Sample Input:
    -------------
    d1 = {
        'key1': 'value1',
        'key2': {'nested': 'value'},
        'key3': ['value1'],
        'key4': 'value4'
    }
    d2 = {
        'key1': 'value2',
        'key2': {'key': 'value3'},
        'key3': ['value2'],
        'key5': 'value5'
    }

    Sample Output:
    --------------
    {
        'key1': 'value2',
        'key2': {'nested': 'value', 'key': 'value3'},
        'key3': ['value1', 'value2'],
        'key4': 'value4',
        'key5': 'value5'
    }
    """
    for key in set(d1.keys()) | set(d2.keys()):
        if key in d2 and key in d1:
            if isinstance(d1[key], dict) and isinstance(d2[key], dict):
                merge_dicts(d1[key], d2[key])

            elif isinstance(d1[key], list) and isinstance(d2[key], list):
                d1[key] = d1[key] + d2[key]

            else:
                d1[key] = copy.deepcopy(d2[key])

        elif key in d2:
            d1[key] = copy.deepcopy(d2[key])

    return d1


# =============================================================================
# Datetime Parsing and Timezone Utilities
# =============================================================================

def parse_datetime(value: str, day_first: bool = False, throw: bool = True) -> Optional[datetime]:
    """Convert IST string to offset-naive system time."""
    if not value:
        return None

    try:
        parsed = parser.parse(value, dayfirst=day_first)
    except Exception as e:
        if not throw:
            return None
        raise e

    system_tz = get_system_timezone()

    if system_tz == TIMEZONE:
        return parsed.replace(tzinfo=None)

    # localize to india, convert to system, remove tzinfo
    return (
        timezone(TIMEZONE)
        .localize(parsed)
        .astimezone(timezone(system_tz))
        .replace(tzinfo=None)
    )


def as_ist(value: Optional[datetime] = None) -> datetime:
    """Convert system time to offset-naive IST time."""
    parsed = get_datetime(value)
    system_tz = get_system_timezone()

    if system_tz == TIMEZONE:
        return parsed

    # localize to system, convert to IST, remove tzinfo
    return (
        timezone(system_tz)
        .localize(parsed)
        .astimezone(timezone(TIMEZONE))
        .replace(tzinfo=None)
    )


# =============================================================================
# Invoice Validation Utilities
# =============================================================================

def validate_invoice_number(doc, throw: bool = True) -> bool:
    """Validate GST invoice number requirements."""
    is_valid_length = len(doc.name) <= 16
    is_valid_format = GST_INVOICE_NUMBER_FORMAT.match(doc.name)

    if not throw:
        return is_valid_length and is_valid_format

    if is_valid_length and is_valid_format:
        return True

    title = "Invalid GST Transaction Name"

    if not is_valid_length:
        message = (
            "Transaction Name must be 16 characters or fewer to meet GST requirements"
        )
    else:
        message = (
            "Transaction Name should start with an alphanumeric character and can"
            " only contain alphanumeric characters, dash (-) and slash (/) to meet GST requirements"
        )

    raise ValidationError(message, field="name")


def are_goods_supplied(doc) -> bool:
    """Check if goods are supplied in the document."""
    return any(
        item
        for item in doc.items
        if item.gst_hsn_code
        and not item.gst_hsn_code.startswith("99")
        and item.qty != 0
    )


def is_outward_stock_entry(doc) -> bool:
    """Check if stock entry is for outward supply."""
    if (
        doc.doctype == "Stock Entry"
        and doc.purpose in ["Material Transfer", "Material Issue"]
        and not doc.is_return
    ):
        return True
    return False


# =============================================================================
# GST Account Utilities (Database-dependent - marked as TODO)
# =============================================================================

def get_escaped_name(name: str) -> Optional[str]:
    """
    This function will replace % in account name with %% to escape it for PyPika
    """
    if not name:
        return None

    if "%" not in name:
        return name

    return name.replace("%", "%%")


def get_gst_accounts_by_type(company: str, account_type: str, throw: bool = True) -> dict:
    """
    Get GST accounts by type.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    For now, returns an empty dict or raises error.
    """
    if not company:
        raise ValidationError("Please set Company first", field="company")
    
    # TODO: Implement with FastAPI-compatible database access
    # This is a placeholder that should be replaced with actual database logic
    return {}


def get_escaped_gst_accounts(company: str, account_type: str, throw: bool = True) -> dict:
    """Get escaped GST accounts."""
    gst_accounts = get_gst_accounts_by_type(company, account_type, throw=throw)
    for tax_type in gst_accounts:
        gst_accounts[tax_type] = get_escaped_name(gst_accounts[tax_type])
    return gst_accounts


def get_all_gst_accounts(company: str) -> List[str]:
    """
    Get all GST accounts for a company.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    if not company:
        raise ValidationError("Please set Company first", field="company")
    
    # TODO: Implement with FastAPI-compatible database access
    return []


# =============================================================================
# HSN and Settings Utilities (Database-dependent)
# =============================================================================

def get_hsn_settings() -> Tuple[bool, Tuple[int, ...]]:
    """
    Get HSN code settings.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    # Return default values for now
    return True, (4, 6, 8)


# =============================================================================
# Country Code Validation (Database-dependent)
# =============================================================================

def get_validated_country_code(country: str) -> Optional[str]:
    """
    Validate country code.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    if country == "India":
        return None
    
    # TODO: Implement with FastAPI-compatible database access
    return None


# =============================================================================
# Party and Contact Utilities (Database-dependent)
# =============================================================================

def get_gstin_list(party: str, party_type: str = "Company", exclude_isd: bool = False) -> List[str]:
    """
    Returns a list the party's GSTINs.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return []


def get_party_for_gstin(gstin: str, party_type: str = "Supplier") -> Optional[str]:
    """
    Get party for a GSTIN.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return None


def get_party_contact_details(party: str, party_type: str = "Supplier") -> dict:
    """
    Get party contact details.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return {}


# =============================================================================
# Place of Supply Utilities (Database-dependent)
# =============================================================================

def get_place_of_supply(party_details, doctype: str) -> Optional[str]:
    """
    Get place of supply for a transaction.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return None


# =============================================================================
# API Settings Utilities (Database-dependent)
# =============================================================================

def is_production_api_enabled(settings: Optional[dict] = None) -> bool:
    """
    Check if production API is enabled.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return False


def is_api_enabled(settings: Optional[dict] = None) -> bool:
    """
    Check if API is enabled.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return False


def is_autofill_party_info_enabled() -> bool:
    """
    Check if autofill party info is enabled.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return False


def can_enable_api(settings: dict) -> bool:
    """
    Check if API can be enabled.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return False


# =============================================================================
# GST Account Map Utilities (Database-dependent)
# =============================================================================

def get_gst_account_by_item_tax_template(item_tax_template: str) -> List[str]:
    """
    Get GST account by item tax template.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return []


def get_gst_account_gst_tax_type_map() -> dict:
    """
    Returns gst_account by tax_type for all the companies.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return {}


# =============================================================================
# Company GSTIN Utilities (Database-dependent)
# =============================================================================

def get_company_gstin_number(company: str, address: Optional[str] = None, all_gstins: bool = False) -> str:
    """
    Get company's GSTIN number.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    raise ValidationError(
        f"Please set valid GSTIN No. in Company Address for company {bold(company)}",
        field="gstin"
    )


# =============================================================================
# Permission Checking Utilities (Database-dependent)
# =============================================================================

def has_permission_of_page(page_name: str, throw: bool = False) -> bool:
    """
    Check if user has permission to access a page.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    return True


# =============================================================================
# Duplicate Party Checking Utilities (Database-dependent)
# =============================================================================

def check_duplicate_party(field: str, value: str, party_type: str, party: Optional[str] = None) -> None:
    """
    Check duplicates based on PAN/GSTIN for the given party type.
    TODO: This requires database access - needs FastAPI-compatible replacement.
    """
    # TODO: Implement with FastAPI-compatible database access
    pass


# =============================================================================
# Document Loading Utilities (Frappe-specific - marked as TODO)
# =============================================================================

def load_doc(doctype: str, name: str, perm: str = "read"):
    """
    Get doc, check perms and run onload method.
    TODO: This requires Frappe document system - needs FastAPI-compatible replacement.
    """
    raise NotImplementedError(
        "Document loading requires Frappe. Use a custom ORM or in-memory data for FastAPI."
    )


def update_onload(doc: dict, key: str, value: Any) -> None:
    """Set or update onload key in doc."""
    onload = doc.get("__onload") or {}
    doc["__onload"] = onload
    
    if not onload.get(key):
        onload[key] = value
    else:
        onload[key].update(value)


def send_updated_doc(doc: dict, set_docinfo: bool = False) -> None:
    """Apply fieldlevel perms and send doc if called while handling a request."""
    # TODO: This is Frappe-specific - skip for FastAPI
    pass


# =============================================================================
# Notification Utilities (Frappe-specific - marked as TODO)
# =============================================================================

def create_notification(
    message_content: dict,
    document_type: str,
    document_name: Optional[str] = None,
    request_id: Optional[str] = None,
) -> None:
    """
    Create a notification.
    TODO: This requires Frappe notification system - needs FastAPI-compatible replacement.
    """
    pass


def disable_item_tax_template_notification() -> None:
    """Disable item tax template notification."""
    pass


def disable_new_gst_category_notification() -> None:
    """Disable new GST category notification."""
    pass


# =============================================================================
# Server Error Handling Utilities (Frappe-specific - marked as TODO)
# =============================================================================

def handle_server_errors(settings: dict, doc: dict, document_type: str, error: Exception) -> None:
    """
    Handle server errors.
    TODO: This requires Frappe-specific error handling - needs FastAPI-compatible replacement.
    """
    pass


# =============================================================================
# Database Query Placeholders (For FastAPI compatibility)
# =============================================================================

class FastAPIDatabasePlaceholder:
    """
    Placeholder for database queries in FastAPI.
    TODO: Replace with actual database implementation (SQLite, PostgreSQL, etc.)
    """
    
    @staticmethod
    def get_value(doctype: str, filters: Any, fieldname: str) -> Any:
        """
        Get a value from database.
        TODO: Implement with actual database.
        """
        raise NotImplementedError(
            f"Database query for {doctype}.{fieldname} not implemented. "
            "Please implement with a FastAPI-compatible database layer."
        )
    
    @staticmethod
    def get_all(doctype: str, filters: Optional[dict] = None, 
                fields: Optional[List[str]] = None, 
                pluck: Optional[str] = None,
                distinct: bool = False) -> List[dict]:
        """
        Get all records matching filters.
        TODO: Implement with actual database.
        """
        raise NotImplementedError(
            f"Database query for {doctype} not implemented. "
            "Please implement with a FastAPI-compatible database layer."
        )
    
    @staticmethod
    def set_value(doctype: str, name: str, field: str, value: Any) -> None:
        """
        Set a value in database.
        TODO: Implement with actual database.
        """
        raise NotImplementedError(
            f"Database update for {doctype}.{field} not implemented. "
            "Please implement with a FastAPI-compatible database layer."
        )
    
    @staticmethod
    def get_cached_value(doctype: str, name: str, fields: Any) -> Any:
        """
        Get cached value from database.
        TODO: Implement with actual database.
        """
        raise NotImplementedError(
            f"Cached database query for {doctype} not implemented. "
            "Please implement with a FastAPI-compatible database layer."
        )


# Create a module-level placeholder for db operations
db = FastAPIDatabasePlaceholder()


# =============================================================================
# Cache Placeholder (For FastAPI compatibility)
# =============================================================================

class FastAPICachePlaceholder:
    """
    Placeholder for cache operations in FastAPI.
    TODO: Replace with actual cache implementation (Redis, in-memory, etc.)
    """
    
    @staticmethod
    def get_value(key: str):
        """Get value from cache."""
        return None
    
    @staticmethod
    def set_value(key: str, value: Any, expires_in_sec: int = 0):
        """Set value in cache."""
        pass


# Create a module-level placeholder for cache operations
cache = FastAPICachePlaceholder()


# =============================================================================
# Enqueue Placeholder (For FastAPI compatibility)
# =============================================================================

class FastAPIEnqueuePlaceholder:
    """
    Placeholder for background job enqueue in FastAPI.
    TODO: Replace with actual job queue implementation (Celery, RQ, etc.)
    """
    
    @staticmethod
    def enqueue(func, **kwargs):
        """Enqueue a background job."""
        # For now, just call the function synchronously
        import threading
        thread = threading.Thread(target=func, kwargs=kwargs)
        thread.daemon = True
        thread.start()


# Create a module-level placeholder for enqueue operations
enqueue = FastAPIEnqueuePlaceholder.enqueue


# =============================================================================
# Log Error Placeholder (For FastAPI compatibility)
# =============================================================================

def log_error(title: str, message: str = "") -> None:
    """Log an error."""
    import logging
    logger = logging.getLogger("india_compliance")
    logger.error(f"{title}: {message}")


def clear_last_message() -> None:
    """Clear the last message."""
    pass


def get_traceback() -> str:
    """Get the traceback."""
    import traceback
    return traceback.format_exc()
