"""
E-Waybill utilities for FastAPI.
All Frappe dependencies have been replaced with TODO placeholders and native Python equivalents.
"""
import json

from fastapi import HTTPException, status

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


class EWaybillData:
    """
    E-Waybill data generation class.
    TODO: This class needs to be adapted to work with dict-based documents instead of Frappe documents.
    """

    def __init__(self, doc, settings=None, for_json=False):
        """
        Initialize with a document (dict or custom object).
        TODO: Adapt to work with dict-based documents.
        """
        self.doc = doc
        self.settings = settings or {}
        self.for_json = for_json
        self.exclude_reverse_charge_tax = True
        self.item_list = []
        self.transaction_details = {}
        self.bill_to = {}
        self.bill_from = {}
        self.ship_to = {}
        self.ship_from = {}
        self.sandbox_mode = False

    def get_data(self, with_irn=False):
        """Get e-waybill data."""
        if with_irn:
            return self.get_data_with_irn()

        self.set_transaction_details()
        self.set_item_list()
        self.set_transporter_details()
        self.set_party_address_details()
        return self.get_transaction_data()

    def get_data_with_irn(self):
        """Get e-waybill data with IRN."""
        self.set_transporter_details()
        self.set_party_address_details()
        return {
            "Irn": self.doc.get("irn", ""),
            "Distance": self.transaction_details.get("distance", 0),
            "TransMode": str(self.transaction_details.get("mode_of_transport", "")),
            "TransId": self.transaction_details.get("gst_transporter_id", ""),
            "TransName": self.transaction_details.get("transporter_name", ""),
            "TransDocDt": self.transaction_details.get("lr_date", ""),
            "TransDocNo": self.transaction_details.get("lr_no", ""),
            "VehNo": self.transaction_details.get("vehicle_no", ""),
            "VehType": self.transaction_details.get("vehicle_type", ""),
        }

    def validate_transaction(self):
        """Validate transaction for e-waybill."""
        pass  # TODO: Implement validation

    def validate_settings(self):
        """Validate settings."""
        pass  # TODO: Implement

    def validate_doctype_for_e_waybill(self):
        """Validate document type for e-waybill."""
        pass  # TODO: Implement

    def set_transaction_details(self):
        """Set transaction details."""
        self.transaction_details.update({
            "sub_supply_desc": "",
            "main_hsn_code": "",
            "supply_type": "O",
            "sub_supply_type": 1,
            "document_type": "INV",
        })

    def set_item_list(self):
        """Set item list for e-waybill."""
        self.item_list = []
        for item_details in self.get_all_item_details():
            self.item_list.append(self.get_item_data(item_details))

    def set_transporter_details(self):
        """Set transporter details."""
        pass  # TODO: Implement

    def set_party_address_details(self):
        """Set party address details."""
        self.bill_to = self.doc.get("bill_to", {})
        self.bill_from = self.doc.get("bill_from", {})
        self.ship_to = self.doc.get("ship_to", {})
        self.ship_from = self.doc.get("ship_from", {})

    def get_all_item_details(self):
        """Get all item details from document."""
        return self.doc.get("items", [])

    def get_item_data(self, item_details):
        """Get item data for e-waybill."""
        return {
            "itemNo": item_details.get("item_no", 1),
            "productDesc": item_details.get("item_name", ""),
            "hsnCode": item_details.get("gst_hsn_code", ""),
            "qtyUnit": item_details.get("uom", ""),
            "quantity": item_details.get("qty", 0),
            "taxableAmount": item_details.get("taxable_value", 0),
            "sgstRate": item_details.get("sgst_rate", 0),
            "cgstRate": item_details.get("cgst_rate", 0),
            "igstRate": item_details.get("igst_rate", 0),
            "cessRate": item_details.get("cess_rate", 0),
            "cessNonAdvol": item_details.get("cess_non_advol_rate", 0),
        }

    def get_transaction_data(self):
        """Get complete transaction data for e-waybill."""
        data = {
            "userGstin": self.transaction_details.get("company_gstin", ""),
            "supplyType": self.transaction_details.get("supply_type", "O"),
            "subSupplyType": self.transaction_details.get("sub_supply_type", 1),
            "subSupplyDesc": self.transaction_details.get("sub_supply_desc", ""),
            "docType": self.transaction_details.get("document_type", "INV"),
            "docNo": self.transaction_details.get("name", ""),
            "docDate": self.transaction_details.get("date", ""),
            "transactionType": self.transaction_details.get("transaction_type", 1),
            "fromTrdName": self.bill_from.get("legal_name", ""),
            "fromGstin": self.bill_from.get("gstin", ""),
            "fromAddr1": self.ship_from.get("address_line1", ""),
            "fromAddr2": self.ship_from.get("address_line2", ""),
            "fromPlace": self.ship_from.get("city", ""),
            "fromPincode": self.ship_from.get("pincode", 0),
            "fromStateCode": self.bill_from.get("state_number", 0),
            "actFromStateCode": self.ship_from.get("state_number", 0),
            "toTrdName": self.bill_to.get("legal_name", ""),
            "toGstin": self.bill_to.get("gstin", ""),
            "toAddr1": self.ship_to.get("address_line1", ""),
            "toAddr2": self.ship_to.get("address_line2", ""),
            "toPlace": self.ship_to.get("city", ""),
            "toPincode": self.ship_to.get("pincode", 0),
            "toStateCode": self.transaction_details.get("pos_state_code", 0),
            "actToStateCode": self.ship_to.get("state_number", 0),
            "totalValue": self.transaction_details.get("total", 0),
            "cgstValue": self.transaction_details.get("total_cgst_amount", 0),
            "sgstValue": self.transaction_details.get("total_sgst_amount", 0),
            "igstValue": self.transaction_details.get("total_igst_amount", 0),
            "cessValue": self.transaction_details.get("total_cess_amount", 0),
            "cessNonAdvolValue": self.transaction_details.get("total_cess_non_advol_amount", 0),
            "otherValue": self.transaction_details.get("other_charges", 0),
            "totInvValue": self.transaction_details.get("grand_total", 0),
            "transMode": self.transaction_details.get("mode_of_transport", ""),
            "transDistance": self.transaction_details.get("distance", 0),
            "transporterName": self.transaction_details.get("transporter_name", ""),
            "transporterId": self.transaction_details.get("gst_transporter_id", ""),
            "transDocNo": self.transaction_details.get("lr_no", ""),
            "transDocDate": self.transaction_details.get("lr_date", ""),
            "vehicleNo": self.transaction_details.get("vehicle_no", ""),
            "vehicleType": self.transaction_details.get("vehicle_type", ""),
            "itemList": self.item_list,
            "mainHsnCode": self.transaction_details.get("main_hsn_code", ""),
        }

        if self.for_json:
            for key, value in {
                "transactionType": "transType",
                "actFromStateCode": "actualFromStateCode",
                "actToStateCode": "actualToStateCode",
                "otherValue": "OthValue",
                "cessNonAdvolValue": "TotNonAdvolVal",
            }.items():
                data[value] = data.pop(key)

        return data

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

STATE_NUMBERS = {
    "01": "01-Jammu and Kashmir",
    "02": "02-Himachal Pradesh",
    "03": "03-Punjab",
    "04": "04-Chandigarh",
    "05": "05-Uttarakhand",
    "06": "06-Haryana",
    "07": "07-Delhi",
    "08": "08-Rajasthan",
    "09": "09-Uttar Pradesh",
    "10": "10-Bihar",
    "11": "11-Sikkim",
    "12": "12-Arunachal Pradesh",
    "13": "13-Nagaland",
    "14": "14-Manipur",
    "15": "15-Mizoram",
    "16": "16-Tripura",
    "17": "17-Meghalaya",
    "18": "18-Assam",
    "19": "19-West Bengal",
    "20": "20-Jharkhand",
    "21": "21-Odisha",
    "22": "22-Chhattisgarh",
    "23": "23-Madhya Pradesh",
    "24": "24-Gujarat",
    "25": "25-Daman and Diu",
    "26": "26-Dadra and Nagar Haveli",
    "27": "27-Maharashtra",
    "28": "28-Andhra Pradesh",
    "29": "29-Karnataka",
    "30": "30-Goa",
    "31": "31-Lakshadweep",
    "32": "32-Kerala",
    "33": "33-Tamil Nadu",
    "34": "34-Puducherry",
    "35": "35-Andaman and Nicobar Islands",
    "36": "36-Telangana",
    "37": "37-Other Territory",
}

SUB_SUPPLY_TYPES = {
    "1": "Supply",
    "2": "Export",
    "3": "Job Work",
    "4": "For Own Use",
    "5": "Others",
    "6": "SKD/CKD",
    "7": "Sales Return",
    "8": "Others",
}

CONSIGNMENT_STATUS = {
    "In Movement": "1",
    "In Transit": "2",
}

TRANSIT_TYPES = {
    "Road": "R",
    "Rail": "R",
    "Air": "A",
    "Ship": "S",
}

EXTEND_VALIDITY_REASON_CODES = {
    "1": "Natural Calamity",
    "2": "Law and Order",
    "3": "Accident",
    "4": "Others",
}

UPDATE_VEHICLE_REASON_CODES = {
    "1": "Break Down",
    "2": "Transshipment",
    "3": "Others",
}

PERMITTED_DOCTYPES = [
    "Sales Invoice",
    "Purchase Invoice",
    "Delivery Note",
    "Purchase Receipt",
    "Stock Entry",
    "Subcontracting Receipt",
]

ADDRESS_FIELDS = {
    "Sales Invoice": {
        "bill_from": "company_address",
        "bill_to": "customer_address",
        "ship_from": "company_address",
        "ship_to": "shipping_address_name",
    },
    "Purchase Invoice": {
        "bill_from": "supplier_address",
        "bill_to": "company_address",
        "ship_from": "supplier_address",
        "ship_to": "shipping_address_name",
    },
}
