"""
FastAPI-compatible GSTIN information utilities.

This module has been refactored to remove all Frappe/ERPNext dependencies
and work independently within a FastAPI environment.
"""

import json
from datetime import timedelta
from string import whitespace
from typing import Any, Dict, Optional

from pytika import Order

from india_compliance.exceptions import GSPServerError, ValidationError
from india_compliance.gst_india.api_classes.base import BASE_URL
from india_compliance.gst_india.api_classes.nic.e_invoice import EInvoiceAPI
from india_compliance.gst_india.api_classes.nic.e_waybill import EWaybillAPI
from india_compliance.gst_india.api_classes.public import PublicAPI
from india_compliance.gst_india.api_classes.taxpayer_base import otp_handler
from india_compliance.gst_india.api_classes.taxpayer_returns import GSTR1API
from india_compliance.gst_india.utils import (
    as_ist,
    parse_datetime,
    titlecase,
    to_dict,
    validate_gstin,
)

# Import from our refactored utils module
from india_compliance.gst_india.utils import (
    cache,
    db,
    enqueue,
    get_traceback,
    log_error,
)


GST_CATEGORIES = {
    "Regular": "Registered Regular",
    "Input Service Distributor (ISD)": "Input Service Distributor",
    "Composition": "Registered Composition",
    "Tax Deductor": "Tax Deductor",
    "Tax Collector (Electronic Commerce Operator)": "Tax Collector",
    "SEZ Unit": "SEZ",
    "SEZ Developer": "SEZ",
    "United Nation Body": "UIN Holders",
    "Consulate or Embassy of Foreign Country": "UIN Holders",
    "URP": "Unregistered",
}

# order of address keys is important
KEYS_TO_SANITIZE = ("dst", "stcd", "pncd", "bno", "flno", "bnm", "st", "loc", "city")
KEYS_TO_FILTER_DUPLICATES = frozenset(("dst", "bnm", "st", "loc", "city"))
CHARACTERS_TO_STRIP = f"{whitespace},"


def get_gstin_info(gstin: str, *, doc: Optional[Dict] = None, throw_error: bool = True) -> Dict[str, Any]:
    """
    Get GSTIN information.
    
    This is the main entry point that should be called from FastAPI endpoints.
    
    Args:
        gstin: The GSTIN to fetch information for
        doc: Optional document context
        throw_error: Whether to throw error on failure
        
    Returns:
        Dictionary containing GSTIN information
    """
    if doc and isinstance(doc, str):
        doc = json.loads(doc, object_hook=to_dict)
    
    # Validate GSTIN format
    gstin = validate_gstin(gstin)
    if not gstin:
        if throw_error:
            raise ValidationError("Invalid GSTIN format", field="gstin")
        return {}
    
    return _get_gstin_info(gstin, doc=doc, throw_error=throw_error)


def _get_gstin_info(gstin: str, *, doc: Optional[Dict] = None, throw_error: bool = True) -> Dict[str, Any]:
    """Internal function to get GSTIN info."""
    gstin = validate_gstin(gstin)
    response = get_archived_gstin_info(gstin)

    if not response:
        try:
            if cache.get_value("gst_server_error"):
                return {}

            response = PublicAPI(doc).get_gstin_info(gstin)
            
            # Enqueue background job to update GSTIN status
            enqueue(
                "india_compliance.gst_india.doctype.gstin.gstin.create_or_update_gstin_status",
                queue="long",
                response=get_formatted_response_for_status(response),
            )

        except Exception as exc:
            if isinstance(exc, GSPServerError):
                cache.set_value("gst_server_error", True, expires_in_sec=60)

            if throw_error:
                raise exc

            log_error(title="Failed to Fetch GSTIN Info", message=str(exc))
            return {}

    business_name = (
        response.tradeNam
        if response.ctb in ["Proprietorship", "Hindu Undivided Family"]
        else response.lgnm
    )

    gstin_info = to_dict(
        {
            "gstin": response.gstin,
            "business_name": titlecase(business_name or ""),
            "gst_category": GST_CATEGORIES.get(response.dty, ""),
            "status": response.sts,
        }
    )

    if permanent_address := response.get("pradr"):
        # permanent address will be at the first position
        all_addresses = [permanent_address, *response.get("adadr", [])]
        gstin_info["all_addresses"] = list(map(_get_address, all_addresses))
        gstin_info["permanent_address"] = gstin_info["all_addresses"][0]

    return gstin_info


def get_archived_gstin_info(gstin: str) -> Optional[Dict[str, Any]]:
    """
    Use Integration Requests to get the GSTIN info if available.
    TODO: This requires database access - implement with FastAPI-compatible database.
    """
    # TODO: Implement with FastAPI-compatible database access
    # For now, return None to trigger API call
    return None


def _get_address(address: Dict) -> Dict[str, Any]:
    """:param address: dict of address with a key of 'addr' and 'ntr'"""
    address = address.get("addr", {})
    address_lines = _extract_address_lines(address)
    return {
        "address_line1": address_lines[0],
        "address_line2": address_lines[1],
        "city": titlecase(address.get("dst")),
        "state": titlecase(address.get("stcd")),
        "pincode": address.get("pncd"),
        "country": "India",
    }


def _extract_address_lines(address: Dict) -> tuple:
    """merge and divide address into exactly two lines"""
    unique_values = set()

    for key in KEYS_TO_SANITIZE:
        value = address.get(key, "").strip(CHARACTERS_TO_STRIP)

        if key not in KEYS_TO_FILTER_DUPLICATES:
            address[key] = value
            continue

        if value not in unique_values:
            address[key] = value
            unique_values.add(value)
            continue

        address[key] = ""

    address_line1 = ", ".join(
        titlecase(value)
        for key in ("bno", "flno", "bnm")
        if (value := address.get(key))
    )

    address_line2 = ", ".join(
        titlecase(value) for key in ("loc", "city") if (value := address.get(key))
    )

    if not (street := address.get("st")):
        return address_line1, address_line2

    street = titlecase(street)
    if len(address_line1) > len(address_line2):
        address_line2 = f"{street}, {address_line2}"
    else:
        address_line1 = f"{address_line1}, {street}"

    return address_line1, address_line2


def fetch_gstin_status(
    *, gstin: Optional[str] = None, doc: Optional[Dict] = None, throw: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Fetch GSTIN status from E-Invoice API or Public API.

    Uses Public API if credentials are not available or its a user initiated request.

    :param gstin: GSTIN to fetch status for
    :param throw: Raise exception if error occurs (used for user initiated requests)
    """
    gstin = validate_gstin(gstin)

    try:
        if not throw and cache.get_value("gst_server_error"):
            return None

        # TODO: Get GST settings from FastAPI-compatible source
        # gst_settings = frappe.get_cached_doc("GST Settings", None)
        # company_gstin = gst_settings.get_gstin_with_credentials(service="e-Invoice")
        
        company_gstin = None

        if throw or not company_gstin:
            response = PublicAPI(doc).get_gstin_info(gstin)
            return get_formatted_response_for_status(response)

        doc = doc or to_dict()
        doc.company_gstin = company_gstin
        response = EInvoiceAPI.create(doc=doc).get_gstin_info(gstin)
        return to_dict(
            {
                "gstin": gstin,
                "registration_date": parse_datetime(response.DtReg, throw=False),
                "cancelled_date": parse_datetime(response.DtDReg, throw=False),
                "status": response.Status,
                "is_blocked": response.BlkStatus,
            }
        )

    except Exception as e:
        if throw:
            raise e

        if isinstance(e, GSPServerError):
            cache.set_value("gst_server_error", True, expires_in_sec=60)

        log_error(
            title="Error fetching GSTIN status",
            message=get_traceback(),
        )


def get_formatted_response_for_status(response) -> Dict[str, Any]:
    """
    Format response from Public API.
    """
    return to_dict(
        {
            "gstin": response.gstin,
            "registration_date": parse_datetime(
                response.rgdt, day_first=True, throw=False
            ),
            "cancelled_date": parse_datetime(
                response.cxdt, day_first=True, throw=False
            ),
            "status": response.sts,
        }
    )


def fetch_transporter_id_status(transporter_id: str, doc: Optional[Dict] = None, throw: bool = True) -> Optional[Dict[str, Any]]:
    """
    Fetch Transporter ID status from E-Waybill API.

    :param transporter_id: GSTIN of the transporter
    :param throw: Raise exception if error occurs (used for user initiated requests)
    """
    # TODO: Get GST settings from FastAPI-compatible source
    # if not frappe.get_cached_value("GST Settings", None, "enable_e_waybill"):
    #     return
    
    gst_settings = None  # TODO: Get from FastAPI-compatible source
    doc = doc or to_dict()
    doc.company_gstin = None  # TODO: Get from gst_settings.get_gstin_with_credentials(service="e-Waybill")

    if not doc.company_gstin:
        return None

    try:
        # fetched using first credentials
        response = EWaybillAPI.create(doc=doc).get_transporter_details(transporter_id)

    except Exception as e:
        if throw:
            raise e

        log_error(
            title="Error fetching Transporter ID status",
            message=get_traceback(),
        )
        return None

    return to_dict(
        {
            "gstin": transporter_id,
            "transporter_id_status": "Active" if response.transin else "Invalid",
        }
    )


# ####### SAMPLE DATA for GST_CATEGORIES ########
# "Composition"                             36AASFP8573D2ZN
# "Input Service Distributor (ISD)"         29AABCF8078M2ZW     Flipkart
# "Tax Deductor"                            06DELI09652G1DA 09ALDN00287A1DD 27AAFT56212B1DO 19AAACI1681G1DV
# "SEZ Developer"                           27AAJCS5738D1Z6
# "United Nation Body"                      0717UNO00157UNO 0717UNO00211UN2 2117UNO00002UNF 3317USA00002UNE
# "Consulate or Embassy of Foreign Country" 0717UNO00154UNU
# "Tax Collector (e-Commerce Operator)"     29AABCF8078M1C8 27AAECG3736E1C2 29AAFCB7707D1C1

# ###### CANNOT BE A PART OF GSTR1 ######
# "Non Resident Online Services Provider"   9917SGP29001OST      Google

# "Non Resident Taxable Person"
# "Government Department ID"


####################################################################################################
#### GSTIN RETURNS INFO ##########################################################################
####################################################################################################


def get_gstr_1_return_status(company: str, gstin: str, period: str, year_increment: int = 0) -> str:
    """Returns Returns-info for the given period"""
    fy = get_fy(period, year_increment=year_increment)
    e_filed_list = update_gstr_returns_info(company, gstin, fy)

    for info in e_filed_list:
        if info["rtntype"] == "GSTR1" and info["ret_prd"] == period:
            return info["status"]

    # late filing possibility (limitation: only checks for the next FY: good enough)
    if not year_increment and get_previous_period_fy() != fy:
        get_gstr_1_return_status(company, gstin, period, year_increment=1)

    return "Not Filed"


def update_gstr_returns_info(company: str, gstin: str, fy: Optional[str] = None) -> Optional[list]:
    """Update GSTR returns info."""
    # TODO: Implement with FastAPI-compatible database access
    # if frappe.flags.in_test:
    #     return
    
    if not fy:
        fy = get_previous_period_fy()

    response = PublicAPI().get_returns_info(gstin, fy)
    if not response:
        return None

    e_filed_list = response.get("EFiledlist") or []

    # TODO: Implement with FastAPI-compatible database access
    # from india_compliance.gst_india.doctype.gst_return_log.gst_return_log import (
    #     process_gstr_returns_info,
    # )
    # frappe.enqueue(
    #     process_gstr_returns_info,
    #     company=company,
    #     gstin=gstin,
    #     e_filed_list=e_filed_list,
    #     enqueue_after_commit=True,
    # )

    return e_filed_list


def get_latest_3b_filed_period(company: str, company_gstin: str) -> Optional[str]:
    """
    Get the latest GSTR3B filed period for a company.
    TODO: This requires database access - implement with FastAPI-compatible database.
    """
    # TODO: Implement with FastAPI-compatible database access
    # Uses frappe.qb.DocType("GST Return Log") - needs SQLAlchemy or similar
    return None


####################################################################################################
#### GSTIN FILING PREFERENCE ######################################################################
####################################################################################################


def get_and_update_filing_preference(gstin: str, period: str) -> Dict[str, Any]:
    """
    Get and update filing preference for a GSTIN.
    TODO: This requires database access - implement with FastAPI-compatible database.
    """
    # TODO: Implement with FastAPI-compatible database access
    # Requires frappe.has_permission and database queries
    return {}


def fetch_filing_preference(gstin: str, fy: str) -> Dict[str, Any]:
    """
    Fetch filing preference from API.
    TODO: Add caching for FastAPI.
    """
    api = GSTR1API(company_gstin=gstin)
    response = api.fetch_filing_preference(fy=fy)

    return response


def create_or_update_logs_for_year(gstin: str, period: str, response: Dict) -> None:
    """
    Create or update logs for year.
    TODO: This requires database access - implement with FastAPI-compatible database.
    """
    # TODO: Implement with FastAPI-compatible database access
    pass


def get_filing_preference(period: str, response: list) -> Optional[str]:
    """Get filing preference from response."""
    # This is a pure function that doesn't require Frappe
    quarter = get_financial_quarter(cint(period[:2]))
    for data in response:
        if data.get("quarter") == f"Q{quarter}":
            return "Quarterly" if data.get("preference") == "Q" else "Monthly"

    return None


####################################################################################################
#### GSTIN UTILITIES ###############################################################################
####################################################################################################


def get_fy(period: str, year_increment: int = 0) -> str:
    """Get financial year from period."""
    month, year = period[:2], period[2:]
    year = str(int(year) + year_increment)

    # For the month of March, it's filed in the next FY
    if int(month) < 3:
        return f"{int(year) - 1}-{year[-2:]}"
    else:
        return f"{year}-{int(year[-2:]) + 1}"


def get_previous_period_fy() -> str:
    """Get previous period's financial year."""
    # Best possible scenario is that the return was filed in the previous period.
    # TODO: Replace frappe.utils.now_datetime() with FastAPI-compatible equivalent
    from datetime import datetime
    period = datetime.now().replace(month=datetime.now().month - 1).strftime("%m%Y")
    return get_fy(period)


def get_logs_for_year(gstin: str, period: str) -> list:
    """Get logs for year."""
    year = cint(period[2:])
    month = cint(period[:2])
    logs = []

    if month <= 3:
        year -= 1

    for return_type in ["GSTR1", "GSTR3B"]:
        for current_month in range(1, 13):
            current_year = year if current_month >= 4 else year + 1
            logs.append(f"{return_type}-{current_month:02d}{current_year}-{gstin}")

    return logs


def get_financial_quarter(month: int) -> int:
    """Get financial quarter from month."""
    if month in [4, 5, 6]:
        return 1  # April, May, June
    elif month in [7, 8, 9]:
        return 2  # July, August, September
    elif month in [10, 11, 12]:
        return 3  # October, November, December
    elif month in [1, 2, 3]:
        return 4  # January, February, March
    else:
        raise ValueError("Month must be between 1 and 12")


# Helper function for integer conversion (from utils module)
def cint(value) -> int:
    """Convert to integer."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0
