"""
FastAPI-compatible Jinja utilities for GST India.

This module has been refactored to remove all Frappe/ERPNext dependencies
and work independently within a FastAPI environment.
"""

import base64
import json
from datetime import datetime
from io import BytesIO

import pyqrcode
from barcode import Code128
from barcode.writer import ImageWriter

from india_compliance.gst_india.constants.e_waybill import (
    DOCUMENT_TYPES,
    SUB_SUPPLY_TYPES,
    SUPPLY_TYPES,
    TRANSPORT_MODES,
    TRANSPORT_TYPES,
)
from india_compliance.gst_india.utils import as_ist, flt, scrub, to_dict


E_INVOICE_ITEM_FIELDS = {
    "SlNo": "Sr.",
    "PrdDesc": "Product Description",
    "HsnCd": "HSN Code",
    "Qty": "Qty",
    "Unit": "UOM",
    "UnitPrice": "Rate",
    "Discount": "Discount",
    "AssAmt": "Taxable Amount",
    "GstRt": "Tax Rate",
    "CesRt": "Cess Rate",
    "TotItemVal": "Total",
}

E_INVOICE_AMOUNT_FIELDS = {
    "AssVal": "Taxable Value",
    "CgstVal": "CGST",
    "SgstVal": "SGST",
    "IgstVal": "IGST",
    "CesVal": "CESS",
    "Discount": "Discount",
    "OthChrg": "Other Charges",
    "RndOffAmt": "Round Off",
    "TotInvVal": "Total Value",
}


def add_spacing(string: str, interval: int) -> str:
    """
    Add spaces to string at specified intervals
    (https://stackoverflow.com/a/65979478/4767738)
    """

    string = str(string)
    return " ".join(string[i : i + interval] for i in range(0, len(string), interval))


def get_supply_type(code: int) -> str:
    """Get supply type from code."""
    return SUPPLY_TYPES.get(code, "")


def get_sub_supply_type(code: int) -> Optional[str]:
    """Get sub supply type from code."""
    code = int(code)

    for sub_supply_type, _code in SUB_SUPPLY_TYPES.items():
        if _code == code:
            return sub_supply_type

    return None


def get_transport_mode(code: int) -> Optional[str]:
    """Get transport mode from code."""
    code = int(code)

    for transport_mode, _code in TRANSPORT_MODES.items():
        if _code == code:
            return transport_mode

    return None


def get_transport_type(code: int) -> str:
    """Get transport type from code."""
    return TRANSPORT_TYPES.get(int(code), "")


def get_e_waybill_document_type(short_document_type: str) -> Optional[str]:
    """Get full document type from short code."""
    for full_document_type, document_type in DOCUMENT_TYPES.items():
        if short_document_type == document_type:
            return full_document_type

    return None


def get_e_waybill_qr_code(e_waybill: str, gstin: str, ewaybill_date: datetime) -> str:
    """Generate e-Waybill QR code."""
    e_waybill_date = as_ist(ewaybill_date)
    qr_text = "/".join(
        (
            str(e_waybill),
            gstin,
            datetime.strftime(e_waybill_date, "%d-%m-%Y %H:%M:%S"),
        )
    )
    return get_qr_code(qr_text)


def get_qr_code(qr_text: str, scale: int = 5) -> str:
    """Generate QR code as base64 string."""
    return pyqrcode.create(qr_text).png_as_base64_str(scale=scale, quiet_zone=1)


def get_ewaybill_barcode(ewaybill: str) -> str:
    """Generate e-Waybill barcode."""
    stream = BytesIO()
    Code128(str(ewaybill), writer=ImageWriter()).write(
        stream,
        {
            "module_width": 0.5,
            "module_height": 16.0,
            "text_distance": 6,
            "font_size": 12,
        },
    )
    barcode_base64 = base64.b64encode(stream.getbuffer()).decode()
    stream.close()

    return barcode_base64


def get_non_zero_fields(data: list, fields: list) -> set:
    """Returns a list of fields with non-zero values"""

    if isinstance(data, dict):
        data = [data]

    non_zero_fields = set()

    for row in data:
        for field in fields:
            if field not in non_zero_fields and row.get(field, 0) != 0:
                non_zero_fields.add(field)

    return non_zero_fields


def get_fields_to_display(data: list, field_map: dict, mandatory_fields: Optional[set] = None) -> dict:
    """Get fields to display."""
    fields_to_display = get_non_zero_fields(data, field_map)
    if mandatory_fields:
        fields_to_display.update(mandatory_fields)

    return {
        field: label for field, label in field_map.items() if field in fields_to_display
    }


def get_e_invoice_item_fields(data: dict) -> dict:
    """Get e-invoice item fields."""
    return get_fields_to_display(data, E_INVOICE_ITEM_FIELDS, {"GstRt"})


def get_e_invoice_amount_fields(data: dict, doc: dict) -> dict:
    """Get e-invoice amount fields."""
    mandatory_fields = set()
    if is_inter_state_supply(doc):
        mandatory_fields.add("IgstVal")
    else:
        mandatory_fields.update(("CgstVal", "SgstVal"))

    return get_fields_to_display(data, E_INVOICE_AMOUNT_FIELDS, mandatory_fields)


def get_gst_breakup(doc: dict) -> str:
    """Get GST breakup data as JSON string."""
    gst_breakup_data = GSTBreakup(doc).get()
    return json.dumps(gst_breakup_data)


class GSTBreakup:
    """
    Returns GST breakup data for the given document
    Output could contain HSN/SAC wise breakup or Item wise breakup as per the GST Settings

    example output:
    [
        {
            "HSN/SAC": "1234",
            "Taxable Amount": 1000,
            "CGST": {
                "tax_rate": 9,
                "tax_amount": 90
            },
            "SGST": {
                "tax_rate": 9,
                "tax_amount": 90
            }
        }
    ]
    """

    CESS_HEADERS = ["CESS", "CESS Non Advol"]

    def __init__(self, doc: dict):
        self.doc = to_dict(doc)
        self.tax_headers = ["IGST"] if is_inter_state_supply(doc) else ["CGST", "SGST"]
        # TODO: Get precision without Frappe
        # self.precision = doc.precision("tax_amount", "taxes")
        self.precision = 2

        if self.has_non_zero_cess():
            self.tax_headers += self.CESS_HEADERS

        self.needs_hsn_wise_breakup = self.is_hsn_wise_breakup_needed()

    def has_non_zero_cess(self) -> bool:
        """Check if there are non-zero cess amounts."""
        if not self.doc.get("items"):
            return False

        return any(
            any(
                getattr(item, f"{scrub(tax_type)}_amount", 0) != 0
                for tax_type in self.CESS_HEADERS
            )
            for item in self.doc.get("items", [])
        )

    def get(self) -> list:
        """Get GST breakup data."""
        self.gst_breakup_data = {}

        for item in self.doc.get("items", []):
            gst_breakup_row = self.get_default_item_tax_row(item)
            gst_breakup_row["Taxable Amount"] += flt(item.get("taxable_value", 0), self.precision)

            for tax_type in self.tax_headers:
                _tax_type = scrub(tax_type)
                tax_details = gst_breakup_row.setdefault(
                    _tax_type,
                    {
                        "tax_rate": flt(item.get(f"{_tax_type}_rate", 0)),
                        "tax_amount": 0,
                    },
                )

                tax_details["tax_amount"] += flt(
                    item.get(f"{_tax_type}_amount", 0), self.precision
                )

        return list(self.gst_breakup_data.values())

    def get_default_item_tax_row(self, item: dict) -> dict:
        """Get default item tax row."""
        if self.needs_hsn_wise_breakup:
            hsn_code = item.get("gst_hsn_code")
            tax_rates = [item.get("cgst_rate", 0), item.get("sgst_rate", 0), item.get("igst_rate", 0)]
            tax_rate = next((rate for rate in tax_rates if rate != 0), 0)

            return self.gst_breakup_data.setdefault(
                (hsn_code, tax_rate), {"HSN/SAC": hsn_code, "Taxable Amount": 0}
            )

        else:
            item_code = item.get("item_code") or item.get("item_name")
            return self.gst_breakup_data.setdefault(
                item_code, {"Item": item_code, "Taxable Amount": 0}
            )

    def is_hsn_wise_breakup_needed(self) -> bool:
        """Check if HSN-wise breakup is needed."""
        # TODO: Check without Frappe
        # if not frappe.get_meta(self.doc.doctype + " Item").has_field("gst_hsn_code"):
        #     return False

        # if not frappe.get_cached_value("GST Settings", None, "hsn_wise_tax_breakup"):
        #     return False

        return True


def is_inter_state_supply(doc: dict) -> bool:
    """Check if supply is inter-state."""
    # This is a placeholder - the actual implementation depends on the document type
    # and place of supply vs company GSTIN
    company_gstin = doc.get("company_gstin", "")
    place_of_supply = doc.get("place_of_supply", "")
    
    if not company_gstin or not place_of_supply:
        return False
    
    if len(company_gstin) >= 2 and len(place_of_supply) >= 2:
        return company_gstin[:2] != place_of_supply.split("-")[0]
    
    return False


def scrub(text: str) -> str:
    """
    Convert text to snake_case.
    Replaces frappe.scrub()
    """
    if not text:
        return ""
    
    # Convert to lowercase and replace spaces/special chars with underscores
    import re
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', text)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def flt(value: float, precision: int = 2) -> float:
    """Convert to float with precision."""
    try:
        return round(float(value), precision)
    except (ValueError, TypeError):
        return 0.0
