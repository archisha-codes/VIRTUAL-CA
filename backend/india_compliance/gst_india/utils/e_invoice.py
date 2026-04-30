"""
E-Invoice utilities for FastAPI.
All Frappe dependencies have been replaced with TODO placeholders and native Python equivalents.
"""
import json

from fastapi import HTTPException, status

# TODO: Replace with actual implementation when database schema is available
# These imports reference Frappe-specific modules


# Native Python date formatting (replacement for frappe.utils.format_date)
def format_date(date, format_str="dd-mm-yyyy"):
    """
    Native Python replacement for frappe.utils.format_date.
    """
    if isinstance(date, str):
        return date
    from datetime import datetime
    return date.strftime(format_str.replace("dd", "%d").replace("mm", "%m").replace("yyyy", "%Y"))


# Replaced frappe._dict() with native dict
def to_dict(*args, **kwargs):
    """Convert arguments to a dictionary."""
    if len(args) == 1 and not kwargs:
        return dict(args[0]) if hasattr(args[0], '__iter__') else {}
    return dict(*args, **kwargs)


class EInvoiceData:
    """
    E-Invoice data generation class.
    TODO: This class needs to be adapted to work with dict-based documents instead of Frappe documents.
    """

    def __init__(self, doc, settings=None):
        """
        Initialize with a document (dict or custom object).
        TODO: Adapt to work with dict-based documents.
        """
        self.doc = doc
        self.settings = settings or {}
        self.item_list = []
        self.transaction_details = {}
        self.billing_address = {}
        self.company_address = {}
        self.shipping_address = None
        self.dispatch_address = None
        self.sandbox_mode = False

    DATE_FORMAT = "dd/mm/yyyy"

    def get_data(self):
        """Get e-invoice data."""
        self.set_transaction_details()
        self.set_item_list()
        self.update_other_charges()
        self.set_transporter_details()
        self.set_party_address_details()
        return self.sanitize_data(self.get_invoice_data())

    def set_item_list(self):
        """Set item list for e-invoice."""
        self.item_list = []
        for item_details in self.get_all_item_details():
            if item_details.get("gst_treatment") not in ["Taxable"]:
                continue
            self.item_list.append(self.get_item_data(item_details))

    def update_other_charges(self):
        """Update other charges."""
        self.transaction_details["other_charges"] = (
            self.transaction_details.get("other_charges", 0)
            + self.transaction_details.get("total_non_taxable_value", 0)
        )

    def validate_transaction(self):
        """Validate transaction for e-invoice."""
        pass  # TODO: Implement validation

    def set_transaction_details(self):
        """Set transaction details."""
        self.transaction_details.update({
            "tax_scheme": "GST",
            "supply_type": "Regular",
            "reverse_charge": "N",
            "invoice_type": "INV",
        })

    def set_transporter_details(self):
        """Set transporter details."""
        pass  # TODO: Implement

    def set_party_address_details(self):
        """Set party address details."""
        self.billing_address = self.doc.get("billing_address", {})
        self.company_address = self.doc.get("company_address", {})

    def get_all_item_details(self):
        """Get all item details from document."""
        return self.doc.get("items", [])

    def get_item_data(self, item_details):
        """Get item data for e-invoice."""
        return {
            "SlNo": str(item_details.get("item_no", 1)),
            "PrdDesc": item_details.get("item_name", ""),
            "IsServc": "Y" if item_details.get("gst_hsn_code", "").startswith("99") else "N",
            "HsnCd": item_details.get("gst_hsn_code", ""),
            "Unit": item_details.get("uom", ""),
            "Qty": item_details.get("qty", 0),
            "UnitPrice": item_details.get("unit_rate", 0),
            "TotAmt": item_details.get("taxable_value", 0),
            "AssAmt": item_details.get("taxable_value", 0),
            "GstRt": item_details.get("tax_rate", 0),
            "IgstAmt": item_details.get("igst_amount", 0),
            "CgstAmt": item_details.get("cgst_amount", 0),
            "SgstAmt": item_details.get("sgst_amount", 0),
            "CesAmt": item_details.get("cess_amount", 0),
            "TotItemVal": item_details.get("total_value", 0),
        }

    def get_invoice_data(self):
        """Get complete invoice data for e-invoice."""
        invoice_data = {
            "Version": "1.1",
            "TranDtls": {
                "TaxSch": self.transaction_details.get("tax_scheme", "GST"),
                "SupTyp": self.transaction_details.get("supply_type", "Regular"),
                "RegRev": self.transaction_details.get("reverse_charge", "N"),
                "EcmGstin": self.transaction_details.get("ecommerce_gstin", ""),
            },
            "DocDtls": {
                "Typ": self.transaction_details.get("invoice_type", "INV"),
                "No": self.transaction_details.get("name", ""),
                "Dt": self.transaction_details.get("date", ""),
            },
            "SellerDtls": {
                "Gstin": self.company_address.get("gstin", ""),
                "LglNm": self.company_address.get("legal_name", ""),
                "TrdNm": self.company_address.get("legal_name", ""),
                "Loc": self.company_address.get("city", ""),
                "Pin": self.company_address.get("pincode", 0),
                "Stcd": self.company_address.get("state_number", ""),
            },
            "BuyerDtls": {
                "Gstin": self.billing_address.get("gstin", ""),
                "LglNm": self.billing_address.get("legal_name", ""),
                "TrdNm": self.billing_address.get("legal_name", ""),
                "Loc": self.billing_address.get("city", ""),
                "Pin": self.billing_address.get("pincode", 0),
                "Stcd": self.billing_address.get("state_number", ""),
                "Pos": self.transaction_details.get("pos_state_code", ""),
            },
            "ItemList": self.item_list,
            "ValDtls": {
                "AssVal": self.transaction_details.get("total_taxable_value", 0),
                "CgstVal": self.transaction_details.get("total_cgst_amount", 0),
                "SgstVal": self.transaction_details.get("total_sgst_amount", 0),
                "IgstVal": self.transaction_details.get("total_igst_amount", 0),
                "CesVal": self.transaction_details.get("total_cess_amount", 0),
                "Discount": self.transaction_details.get("discount_amount", 0),
                "RndOffAmt": self.transaction_details.get("rounding_adjustment", 0),
                "OthChrg": self.transaction_details.get("other_charges", 0),
                "TotInvVal": self.transaction_details.get("grand_total", 0),
            },
        }
        return invoice_data

    def sanitize_data(self, data):
        """Sanitize data for JSON serialization."""
        return data

    def rounded(self, value, precision=2):
        """Round value."""
        return round(value, precision)


# Placeholder functions for Frappe enqueue
def enqueue(*args, **kwargs):
    """
    TODO: Replace with actual background task queue (e.g., Celery, RQ).
    """
    print(f"enqueue: {args}, {kwargs}")


# Placeholder functions for Frappe database operations
def get_cached_doc(doctype, name=None):
    """
    TODO: Replace with actual database retrieval when schema is available.
    """
    return {}


def get_all(doctype, filters=None, fields=None, pluck=None):
    """
    TODO: Replace with actual database query when schema is available.
    """
    return []


def set_value(doctype, filters, values):
    """
    TODO: Replace with actual database update when schema is available.
    """
    print(f"set_value: doctype={doctype}, filters={filters}, values={values}")


def has_permission(doctype, perm_type="read", throw=False):
    """
    TODO: Replace with proper authentication/authorization in FastAPI.
    """
    if throw:
        raise HTTPException(status_code=403, detail="Permission denied")
    return True


def throw(message, title="Error"):
    """
    TODO: Replace with FastAPI HTTPException.
    """
    raise HTTPException(status_code=400, detail=f"{title}: {message}")


def get_value(doctype, filters, field):
    """
    TODO: Replace with actual database query when schema is available.
    """
    return None


def parse_json(data):
    """
    Parse JSON data (native Python replacement).
    """
    if isinstance(data, str):
        return json.loads(data)
    return data or {}


def log_error(title, message=None):
    """
    TODO: Replace with proper logging in FastAPI.
    """
    print(f"ERROR: {title} - {message}")


def msgprint(message, indicator=None, alert=False):
    """
    TODO: Replace with proper response handling in FastAPI.
    """
    print(f"msgprint: {message}")


def get_traceback():
    """
    TODO: Replace with proper exception handling in FastAPI.
    """
    return "Traceback not available"


def as_json(data, indent=None):
    """
    Native Python JSON serialization (replacement for frappe.as_json).
    """
    return json.dumps(data, indent=indent)


# OTC (Open Template Class) handler decorator placeholder
def otp_handler(func):
    """
    TODO: Implement OTP handler for FastAPI authentication.
    """
    return func


# Constants (replaced imports from Frappe modules)
CANCEL_REASON_CODES = {
    "1": "Duplicate Invoice",
    "2": "Data Entry Mistake",
    "3": "Order Cancelled",
    "4": "Others",
}

ITEM_LIMIT = 1000

TAXABLE_GST_TREATMENTS = ["Taxable"]
