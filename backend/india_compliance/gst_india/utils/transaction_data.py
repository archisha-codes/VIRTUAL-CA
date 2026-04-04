"""
FastAPI-compatible transaction data utilities.

This module has been refactored to remove all Frappe/ERPNext dependencies
and work independently within a FastAPI environment.
"""

import re
from typing import Any, Dict, List, Optional

from india_compliance.exceptions import ValidationError
from india_compliance.gst_india.constants import (
    E_INVOICE_MASTER_CODES_URL,
    GST_REFUND_TAX_TYPES,
    GST_TAX_RATES,
    GST_TAX_TYPES,
    TAXABLE_GST_TREATMENTS,
)
from india_compliance.gst_india.constants.e_waybill import (
    TRANSPORT_MODES,
    VEHICLE_TYPES,
)
from india_compliance.gst_india.utils import (
    bold,
    cint,
    format_date,
    get_gst_uom,
    get_validated_country_code,
    getdate,
    rounded,
    to_dict,
    validate_invoice_number,
    validate_pincode,
)


REGEX_MAP = {
    1: re.compile(r"[^A-Za-z0-9]"),
    2: re.compile(r"[^A-Za-z0-9\-\/. ]"),
    3: re.compile(r"[^A-Za-z0-9@#\-\/,&.(*) ]"),
}


class GSTTransactionData:
    """FastAPI-compatible transaction data processor."""
    
    DATE_FORMAT = "dd/MM/yyyy"

    def __init__(self, doc: Dict):
        self.doc = to_dict(doc)
        # TODO: Get settings from FastAPI-compatible source
        # self.settings = frappe.get_cached_doc("GST Settings")
        self.settings = {}
        self.sandbox_mode = self.settings.get("sandbox_mode", False)
        self.transaction_details = to_dict()
        
        self.party_name_field = "customer_name"
        self.is_purchase_rcm = False

        if self.doc.get("doctype") in (
            "Purchase Invoice",
            "Purchase Receipt",
            "Subcontracting Receipt",
            "Stock Entry",
        ):
            self.party_name_field = "supplier_name"
            if self.doc.get("is_reverse_charge") == 1:
                # for with reverse charge in purchase, do not compute taxes
                self.is_purchase_rcm = True

        self.party_name = self.doc.get(self.party_name_field)

    def set_transaction_details(self):
        rounding_adjustment = self.rounded(
            self.doc.get("base_rounding_adjustment") or 0
        )

        if self.doc.get("is_return"):
            rounding_adjustment = -rounding_adjustment

        grand_total_fieldname = (
            "base_grand_total"
            if self.doc.get("disable_rounded_total", 1)
            else "base_rounded_total"
        )

        total = 0
        total_taxable_value = 0
        tax_total_keys = tuple(f"total_{tax}_amount" for tax in GST_TAX_TYPES)

        # Initialize all tax totals to 0
        self.transaction_details.update({key: 0 for key in tax_total_keys})

        for row in self.doc.get("items", []):
            total += row.get("taxable_value", 0)

            if row.get("gst_treatment") in TAXABLE_GST_TREATMENTS:
                total_taxable_value += row.get("taxable_value", 0)

            if self.is_purchase_rcm:
                continue

            # eg: Skip reverse charge tax for e-Waybill
            if self.doc.get("is_reverse_charge") and getattr(
                self, "exclude_reverse_charge_tax", False
            ):
                continue

            for tax_key in tax_total_keys:
                self.transaction_details[tax_key] += abs(row.get(tax_key[6:], 0))

        pos_state_code = self.doc.get("place_of_supply", "").split("-")[0]

        self.transaction_details.update(
            {
                "company_name": self.sanitize_value(self.doc.get("company", "")),
                "party_name": self.sanitize_value(
                    self.party_name
                    or ""  # TODO: frappe.db.get_value(self.doc.doctype, self.party_name, self.party_name_field)
                ),
                "date": format_date(self.doc.get("posting_date"), self.DATE_FORMAT),
                "total": abs(self.rounded(total)),
                "total_taxable_value": abs(self.rounded(total_taxable_value)),
                "total_non_taxable_value": abs(
                    self.rounded(total - total_taxable_value)
                ),
                "rounding_adjustment": rounding_adjustment,
                "grand_total": abs(self.rounded(self.doc.get(grand_total_fieldname))),
                "grand_total_in_foreign_currency": (
                    abs(self.rounded(self.doc.get("grand_total", 0)))
                    if self.doc.get("currency", "INR") != "INR"
                    else ""
                ),
                "discount_amount": (
                    abs(self.rounded(self.doc.get("base_discount_amount", 0)))
                    if self.doc.get("is_cash_or_non_trade_discount")
                    else 0
                ),
                "company_gstin": self.doc.get("company_gstin"),
                "name": self.doc.get("name"),
                "other_charges": 0,
                "pos_state_code": pos_state_code,
            }
        )

        # Round tax totals
        for tax_key in tax_total_keys:
            self.transaction_details[tax_key] = self.rounded(
                self.transaction_details[tax_key]
            )

        self.update_transaction_details()
        self.update_discount_and_other_charges(tax_total_keys)

    def update_transaction_details(self):
        # to be overridden
        pass

    def update_totals_for_refund(self):
        for row in self.doc.get("taxes", []):
            if row.get("gst_tax_type") not in GST_REFUND_TAX_TYPES:
                continue

            self.transaction_details["grand_total"] -= (
                row.get("base_tax_amount_after_discount_amount", 0)
            )

        # Ensure that grand total is rounded as it may be updated above
        self.transaction_details["grand_total"] = self.rounded(
            self.transaction_details["grand_total"]
        )

    def update_discount_and_other_charges(self, tax_total_keys):
        self.update_totals_for_refund()  # Ensure grand total is correct for refund

        # Other Charges
        current_total = 0

        if self.doc.get("is_reverse_charge"):
            # Not adding taxes for rcm
            tax_total_keys = tuple()

        for key in ("total", "rounding_adjustment", *tax_total_keys):
            current_total += self.transaction_details.get(key, 0)

        current_total -= self.transaction_details.get("discount_amount", 0)
        other_charges = self.transaction_details.get("grand_total", 0) - current_total

        if 0 > other_charges > -0.1:
            # other charges cannot be negative
            # handle cases where user has higher precision than 2
            self.transaction_details["rounding_adjustment"] = self.rounded(
                self.transaction_details.get("rounding_adjustment", 0) + other_charges
            )

        elif other_charges > 0:
            self.transaction_details["other_charges"] = self.rounded(other_charges)

        else:
            self.transaction_details["discount_amount"] = self.rounded(
                abs(other_charges) + self.transaction_details.get("discount_amount", 0)
            )

    def validate_mode_of_transport(self, throw=True) -> bool:
        """Validate mode of transport."""
        def _throw(error):
            if throw:
                raise ValidationError(str(error), field="mode_of_transport")

        mode_of_transport = self.doc.get("mode_of_transport")
        if not mode_of_transport:
            return _throw(
                "Either GST Transporter ID or Mode of Transport is required to"
                " generate e-Waybill"
            )

        if mode_of_transport == "Road" and not self.doc.get("vehicle_no"):
            return _throw(
                "Vehicle Number is required to generate e-Waybill for supply via"
                " Road"
            )
        if mode_of_transport == "Ship" and not (self.doc.get("vehicle_no") and self.doc.get("lr_no")):
            return _throw(
                "Vehicle Number and L/R No is required to generate e-Waybill for"
                " supply via Ship"
            )
        if mode_of_transport in ("Rail", "Air") and not self.doc.get("lr_no"):
            return _throw(
                "L/R No. is required to generate e-Waybill for supply via Rail"
                " or Air"
            )

        return True

    def set_transporter_details(self):
        self.transaction_details["distance"] = (
            self.doc.get("distance", 0) if self.doc.get("distance") and self.doc.get("distance") < 4000 else 0
        )

        if self.validate_mode_of_transport(False):
            self.transaction_details.update(
                {
                    "mode_of_transport": TRANSPORT_MODES.get(
                        self.doc.get("mode_of_transport")
                    ),
                    "vehicle_type": VEHICLE_TYPES.get(self.doc.get("gst_vehicle_type")) or "R",
                    "vehicle_no": self.sanitize_value(self.doc.get("vehicle_no", ""), regex=1),
                    "lr_no": self.sanitize_value(
                        self.doc.get("lr_no", ""), regex=2, max_length=15
                    ),
                    "lr_date": (
                        format_date(self.doc.get("lr_date"), self.DATE_FORMAT)
                        if self.doc.get("lr_no")
                        else ""
                    ),
                    "gst_transporter_id": self.doc.get("gst_transporter_id") or "",
                    "transporter_name": (
                        self.sanitize_value(
                            self.doc.get("transporter_name", ""), regex=3, max_length=25
                        )
                        if self.doc.get("transporter_name")
                        else ""
                    ),
                }
            )

        #  Part A Only
        elif self.doc.get("gst_transporter_id"):
            for_json = getattr(self, "for_json", False)
            self.transaction_details.update(
                {
                    "mode_of_transport": 1 if for_json else "",
                    "vehicle_type": "R" if for_json else "",
                    "vehicle_no": "",
                    "lr_no": "",
                    "lr_date": "",
                    "gst_transporter_id": self.doc.get("gst_transporter_id"),
                    "transporter_name": self.doc.get("transporter_name") or "",
                }
            )

    def validate_transaction(self):
        """Validate transaction data."""
        if self.doc.get("docstatus", 0) > 1:
            raise ValidationError(
                "Cannot generate e-Waybill or e-Invoice for a cancelled transaction",
                field="docstatus"
            )

        validate_invoice_number(self.doc)
        posting_date = getdate(self.doc.get("posting_date"))

        if posting_date and posting_date > getdate():
            raise ValidationError(
                "Posting Date cannot be greater than Today's Date",
                field="posting_date"
            )

        # compare posting date and lr date, only if lr no is set
        if (
            self.doc.get("lr_no")
            and self.doc.get("lr_date")
            and posting_date > getdate(self.doc.get("lr_date"))
        ):
            raise ValidationError(
                "Posting Date cannot be greater than LR Date",
                field="lr_date"
            )

        # TODO: Validate HSN codes without Frappe
        # _validate_hsn_codes(
        #     self.doc,
        #     valid_hsn_length=[4, 6, 8],
        #     message=_(
        #         "Since HSN/SAC Code is mandatory for generating e-Waybill/e-Invoices.<br>"
        #     ),
        # )

    def get_all_item_details(self) -> List[Dict]:
        """Get all item details."""
        all_item_details = []

        # progressive error of item tax amounts
        self.rounding_errors = {f"{tax}_rounding_error": 0 for tax in GST_TAX_TYPES}

        items = self.doc.get("items", [])
        if self.doc.get("group_same_items"):
            items = self.group_same_items()

        for row in items:
            item_details = to_dict(
                {
                    "item_no": row.get("idx", 0),
                    "qty": abs(self.rounded(row.get("qty", 0), 3)),
                    "taxable_value": abs(self.rounded(row.get("taxable_value", 0))),
                    "hsn_code": row.get("gst_hsn_code"),
                    "item_name": self.sanitize_value(
                        row.get("item_name", ""), regex=3, max_length=300
                    ),
                    "uom": get_gst_uom(row.get("uom") or row.get("stock_uom"), self.settings),
                    "gst_treatment": row.get("gst_treatment"),
                }
            )
            self.update_item_tax_details(item_details, row)
            self.update_item_details(item_details, row)
            all_item_details.append(item_details)

        return all_item_details

    def group_same_items(self) -> List[Dict]:
        """Group same items together."""
        validate_unique_hsn_and_uom(self.doc)
        grouped_items = {}
        idx = 1

        for row in self.doc.get("items", []):
            item_code = row.get("item_code")
            if not item_code:
                continue
                
            item = grouped_items.setdefault(
                item_code,
                to_dict(
                    {
                        **row,
                        "idx": 0,
                        "qty": 0.00,
                        "taxable_value": 0.00,
                        **{f"{tax}_amount": 0.00 for tax in GST_TAX_TYPES},
                    },
                ),
            )

            if not item.get("idx"):
                item["idx"] = idx
                idx += 1

            item["qty"] += row.get("qty", 0)
            item["taxable_value"] += row.get("taxable_value", 0)

            for tax in GST_TAX_TYPES:
                item[f"{tax}_amount"] += row.get(f"{tax}_amount", 0)

        return list(grouped_items.values())

    def set_item_list(self):
        """Set item list."""
        self.item_list = []

        for item_details in self.get_all_item_details():
            self.item_list.append(self.get_item_data(item_details))

    def update_item_details(self, item_details: Dict, item: Dict) -> None:
        # to be overridden
        pass

    def update_item_tax_details(self, item_details: Dict, item: Dict) -> None:
        """Update item tax details."""
        for tax in GST_TAX_TYPES:
            tax_amount = self.get_progressive_item_tax_amount(
                item.get(f"{tax}_amount", 0), tax
            )

            item_details.update(
                {
                    f"{tax}_amount": tax_amount,
                    f"{tax}_rate": item.get(f"{tax}_rate"),
                }
            )

        tax_rate = sum(
            self.rounded(item_details.get(f"{tax}_rate", 0), 3)
            for tax in GST_TAX_TYPES[:3]
        )

        validate_gst_tax_rate(tax_rate, item)

        item_details.update(
            {
                "tax_rate": tax_rate,
                "total_value": abs(
                    self.rounded(
                        item_details.get("taxable_value", 0)
                        + sum(
                            self.rounded(item_details.get(f"{tax}_amount", 0))
                            for tax in GST_TAX_TYPES
                        )
                    ),
                ),
            }
        )

    def get_progressive_item_tax_amount(self, amount: float, tax_type: str) -> float:
        """
        Helper function to calculate progressive tax amount for an item to remove
        rounding errors.
        """
        error_field = f"{tax_type}_rounding_error"
        error_amount = self.rounding_errors.get(error_field, 0)

        response = self.rounded(amount + error_amount)
        self.rounding_errors[error_field] = amount + error_amount - response

        return abs(response)

    def get_address_details(self, address_name: str, validate_gstin: bool = False) -> Dict:
        """
        Get address details.
        TODO: This requires database access - implement with FastAPI-compatible database.
        """
        # TODO: Implement with FastAPI-compatible database access
        # address = frappe.get_cached_value(
        #     "Address",
        #     address_name,
        #     (
        #         "name",
        #         "address_title",
        #         "address_line1",
        #         "address_line2",
        #         "city",
        #         "pincode",
        #         "country",
        #         "gstin",
        #         "gst_state_number",
        #     ),
        #     as_dict=True,
        # )
        
        # Return empty dict for now
        return {}

    def check_missing_address_fields(self, address: Dict, validate_gstin: bool = False) -> None:
        """Check for missing address fields."""
        fieldnames = [
            "address_title",
            "address_line1",
            "city",
            "pincode",
            "gst_state_number",
        ]

        if validate_gstin:
            fieldnames.append("gstin")

        for fieldname in fieldnames:
            if address.get(fieldname):
                continue

            # TODO: Get field label without Frappe
            # raise ValidationError(
            #     "{0} is missing in Address {1}. Please update it and try again.".format(
            #         bold(frappe.get_meta("Address").get_label(fieldname)),
            #         bold(address.get("name")),
            #     ),
            #     title="Missing Address Details",
            # )
            raise ValidationError(
                f"{fieldname} is missing in Address {address.get('name', '')}. Please update it and try again.",
                field=fieldname
            )

        validate_pincode(address)

    def get_item_data(self, item_details: Dict) -> Dict:
        """Get item data - to be overridden."""
        pass

    def set_address_gstin_map(self):
        """Set address GSTIN map."""
        address_gstin_field_map = {
            "customer_address": "billing_address_gstin",
            "company_address": "company_gstin",
            "supplier_address": "supplier_gstin",
            "billing_address": "company_gstin",
            "bill_from_address": "bill_from_gstin",
            "bill_to_address": "bill_to_gstin",
        }

        self.address_gstin_map = {
            self.doc.get(address): self.doc.get(gstin)
            for address, gstin in address_gstin_field_map.items()
        }

    @staticmethod
    def sanitize_data(d: Any) -> Any:
        """Adapted from https://stackoverflow.com/a/27974027/4767738"""

        def _is_truthy(v):
            return v or v == 0

        if isinstance(d, dict):
            return {
                k: v
                for k, v in (
                    (k, GSTTransactionData.sanitize_data(v)) for k, v in d.items()
                )
                if _is_truthy(v)
            }

        if isinstance(d, list):
            return [
                v for v in map(GSTTransactionData.sanitize_data, d) if _is_truthy(v)
            ]

        return d

    @staticmethod
    def rounded(value: float, precision: int = 2) -> float:
        """Round a number."""
        return rounded(value, precision)

    @staticmethod
    def sanitize_value(
        value: str,
        regex: Optional[int] = None,
        min_length: int = 3,
        max_length: int = 100,
        truncate: bool = True,
        *,
        fieldname: Optional[str] = None,
        reference_doctype: Optional[str] = None,
        reference_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Sanitize value to make it suitable for GST JSON sent for e-Waybill and e-Invoice.

        If fieldname, reference doctype and reference name are present,
        error will be thrown for invalid values instead of sanitizing them.

        Parameters:
        ----------
        @param value: Value to be sanitized
        @param regex: Regex Key (from REGEX_MAP) to substitute unacceptable characters
        @param min_length (default: 3): Minimum length of the value that is acceptable
        @param max_length (default: 100): Maximum length of the value that is acceptable
        @param truncate (default: True): Truncate the value if it exceeds max_length
        @param fieldname: Fieldname for which the value is being sanitized
        @param reference_doctype: DocType of the document that contains the field
        @param reference_name: Name of the document that contains the field

        Returns:
        ----------
        @return: Sanitized value

        """

        def _throw(message: str, **format_args):
            if not (fieldname and reference_doctype and reference_name):
                return

            # TODO: Get field label without Frappe
            # message = message.format(
            #     field=_(frappe.get_meta(reference_doctype).get_label(fieldname)),
            #     **format_args,
            # )

            raise ValidationError(
                f"{reference_doctype} {reference_name}: {message}",
                field=fieldname
            )

        if not value or len(value) < min_length:
            return _throw(
                "{field} must be at least {min_length} characters long",
                min_length=min_length,
            )

        original_value = value

        if regex:
            value = re.sub(REGEX_MAP[regex], "", value)

        if len(value) < min_length:
            if not original_value.isascii():
                return _throw("{field} must only consist of ASCII characters")

            return _throw(
                "{field} consists of invalid characters: {invalid_chars}",
                invalid_chars=bold(
                    "".join(set(original_value).difference(value))
                ),
            )

        if not truncate and len(value) > max_length:
            return None

        return value[:max_length]


def validate_unique_hsn_and_uom(doc: Dict) -> None:
    """
    Raise an exception if
    - Group same items is checked and
    - Same item code has different HSN code or UOM
    """
    if not doc.get("group_same_items"):
        return

    def _throw(label: str, value: Any, item_idx: int, item_code: str):
        raise ValidationError(
            f"Row #{item_idx}: {label}: {value} is different for Item: {item_code}. Grouping of items is not possible.",
            field=label
        )

    def _validate_unique(item_wise_values: Dict, field_value: Any, label: str, item_code: str, item_idx: int):
        values_set = item_wise_values.setdefault(item_code, set())
        values_set.add(field_value)

        if len(values_set) > 1:
            _throw(label, field_value, item_idx, item_code)

    item_wise_uom = {}
    item_wise_hsn = {}

    for item in doc.get("items", []):
        item_code = item.get("item_code")
        item_idx = item.get("idx", 0)
        
        _validate_unique(
            item_wise_uom, 
            item.get("uom") or item.get("stock_uom"), 
            "UOM", 
            item_code, 
            item_idx
        )
        _validate_unique(
            item_wise_hsn, 
            item.get("gst_hsn_code"), 
            "HSN Code", 
            item_code, 
            item_idx
        )


def validate_gst_tax_rate(tax_rate: float, item: Dict) -> None:
    """Validate GST tax rate."""
    if tax_rate not in GST_TAX_RATES:
        # TODO: Get field labels without Frappe
        # raise ValidationError(
        #     _(
        #         "Row #{0}: GST tax rate {1} for Item {2} is not permitted for"
        #         " generating e-Invoice as it doesn't adhere to the e-Invoice"
        #         " Masters.<br><br> Check valid tax rates <a href='{3}'>here</a>."
        #     ).format(
        #         item.idx,
        #         bold(f"{tax_rate}%"),
        #         item.item_code,
        #         E_INVOICE_MASTER_CODES_URL,
        #     ),
        #     title=_("Invalid Tax Rate"),
        # )
        raise ValidationError(
            f"Row #{item.get('idx', 0)}: GST tax rate {tax_rate}% for Item {item.get('item_code', '')} is not permitted for generating e-Invoice.",
            field="tax_rate"
        )
