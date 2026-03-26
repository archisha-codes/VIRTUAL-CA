"""
FastAPI-compatible taxes controller utilities.

This module has been refactored to remove all Frappe/ERPNext dependencies
and work independently within a FastAPI environment.
"""

import json
from typing import Any, Dict, List, Optional

from india_compliance.exceptions import ValidationError
from india_compliance.gst_india.overrides.transaction import (
    ItemGSTDetails,
    ItemGSTTreatment,
)
from india_compliance.gst_india.utils import get_all_gst_accounts, to_dict


class CustomItemGSTDetails(ItemGSTDetails):
    """
    Support use of Item wise tax rates in Taxes and Charges table
    """

    @staticmethod
    def tax_amount_field():
        return "tax_amount"

    @staticmethod
    def tax_details_field():
        return "item_wise_tax_rates"

    def get_item_tax_rate(self, item, tax_row):
        """
        Get item tax rate from item tax template
        """
        item_tax_rates = self.get_tax_details(tax_row)
        return item_tax_rates.get(item.name)

    def set_temp_item_wise_tax_detail_object(self):
        self.doc._item_wise_tax_details = []
        item_map = {item.name: item for item in self.doc.items}

        for row in self.doc.taxes:
            if not row.gst_tax_type:
                continue

            item_wise_tax_rates = self.get_tax_details(row)
            for item_name, rate in item_wise_tax_rates.items():
                item = item_map.get(item_name)
                if not item:
                    continue

                self.doc._item_wise_tax_details.append(
                    to_dict(
                        {
                            "item": item,
                            "tax": row,
                            "rate": rate,
                        }
                    )
                )

    def build_item_wise_tax_detail_from_data(self):
        """
        Build item_wise_tax_details structure from JSON for patch/get operations.
        This mimics the child table structure expected by base class get_item_name_wise_tax_details()
        """
        self.doc.item_wise_tax_details = []

        for row in self.doc.taxes:
            if not row.gst_tax_type:
                continue

            item_wise_tax_rates = self.get_tax_details(row)
            for item_name, rate in item_wise_tax_rates.items():
                self.doc.item_wise_tax_details.append(
                    to_dict(
                        {
                            "item_row": item_name,
                            "tax_row": row.name,
                            "rate": rate,
                        }
                    )
                )


def update_gst_details(doc, method=None):
    # TODO: add item tax template validation post exclude from GST
    # This requires ItemGSTTreatment class which may have Frappe dependencies
    # For now, skip in FastAPI mode
    pass


def set_item_wise_tax_rates(doc: Dict, item_name: Optional[str] = None, tax_name: Optional[str] = None) -> None:
    """
    Set item-wise tax rates in a document.
    TODO: This function may require Frappe-specific JSON parsing.
    """
    if isinstance(doc, str):
        doc = json.loads(doc, object_hook=to_dict)
    
    # Process the document
    controller = CustomTaxController(doc)
    controller.set_item_wise_tax_rates(item_name, tax_name)
    
    # Return the updated doc
    return doc


class CustomTaxController:
    """
    FastAPI-compatible tax controller for calculating taxes on documents.
    
    example_field_map = {
        "amount": "amount",
        "base_grand_total": "base_grand_total",
        "total_taxes": "total_taxes",
    }
    """

    def __init__(self, doc: Dict, field_map: Optional[Dict] = None):
        self.doc = to_dict(doc)
        self.field_map = field_map or {}

    def set_taxes_and_totals(self):
        self.set_item_wise_tax_rates()
        self.update_item_taxable_value()
        self.update_tax_amount()
        self.update_base_grand_total()

    def set_item_wise_tax_rates(self, item_name: Optional[str] = None, tax_name: Optional[str] = None):
        """
        Update item wise tax rates in taxes table
        """
        items, taxes = self.get_rows_to_update(item_name, tax_name)
        tax_accounts = {tax.get("account_head") for tax in taxes}
        if not tax_accounts:
            return

        tax_templates = {item.get("item_tax_template") for item in items}
        item_tax_map = self.get_item_tax_map(tax_templates, tax_accounts)

        for tax in taxes:
            if tax.get("charge_type") == "Actual":
                if not tax.get("item_wise_tax_rates"):
                    tax["item_wise_tax_rates"] = "{}"

                continue

            item_wise_tax_rates = (
                json.loads(tax.get("item_wise_tax_rates", "{}")) if tax.get("item_wise_tax_rates") else {}
            )

            for item in items:
                key = f"{item.get('item_tax_template')},{tax.get('account_head')}"
                item_wise_tax_rates[item.get("name")] = item_tax_map.get(key, tax.get("rate"))

            tax["item_wise_tax_rates"] = json.dumps(item_wise_tax_rates)

        return taxes

    def update_item_taxable_value(self):
        """Update taxable value for items."""
        for item in self.doc.get("items", []):
            item["taxable_value"] = self.get_value("amount", item)

    def update_tax_amount(self):
        """Update tax amounts."""
        total_taxes = 0
        total_taxable_value = self.calculate_total_taxable_value()
        
        # TODO: Get round off accounts without Frappe
        # round_off_accounts = fetch_round_off_accounts(self.doc.company, [])
        round_off_accounts = set()

        for tax in self.doc.get("taxes", []):
            if tax.get("charge_type") == "Actual":
                continue

            tax["tax_amount"] = self.get_tax_amount(
                tax.get("item_wise_tax_rates"), tax.get("charge_type")
            )

            if tax.get("account_head") in round_off_accounts:
                tax["tax_amount"] = round(tax["tax_amount"], 0)

            total_taxes += tax.get("tax_amount", 0)
            tax["base_total"] = total_taxes + total_taxable_value

        setattr(self.doc, self.get_fieldname("total_taxes"), total_taxes)

    def update_base_grand_total(self):
        """Update base grand total."""
        total = self.calculate_total_taxable_value() + self.get_value("total_taxes")
        setattr(self.doc, self.get_fieldname("base_grand_total"), total)

    @staticmethod
    def get_item_tax_map(tax_templates: List, tax_accounts: set) -> Dict:
        """
        Parameters:
            tax_templates (list): List of item tax templates used in the items
            tax_accounts (list): List of tax accounts used in the taxes

        Returns:
            dict: A map of item_tax_template, tax_account and tax_rate

        Sample Output:
            {
                'GST 18%,IGST - TC': 18.0
                'GST 28%,IGST - TC': 28.0
            }
        """
        if isinstance(tax_templates, str):
            try:
                tax_templates = json.loads(tax_templates)
            except json.JSONDecodeError:
                tax_templates = []
        
        if isinstance(tax_accounts, str):
            try:
                tax_accounts = set(json.loads(tax_accounts))
            except json.JSONDecodeError:
                tax_accounts = set()

        if not tax_templates:
            return {}

        # TODO: Get item tax template details without Frappe
        # tax_rates = frappe.get_all(
        #     "Item Tax Template Detail",
        #     fields=("parent", "tax_type", "tax_rate"),
        #     filters={
        #         "parent": ("in", tax_templates),
        #         "tax_type": ("in", list(tax_accounts)),
        #     },
        # )
        
        # Return empty dict for now
        return {}

    def get_rows_to_update(self, item_name: Optional[str] = None, tax_name: Optional[str] = None):
        """
        Returns items and taxes to update based on item_name and tax_name passed.
        If item_name and tax_name are not passed, all items and taxes are returned.
        """
        items = (
            [item for item in self.doc.get("items", []) if item.get("name") == item_name]
            if item_name
            else self.doc.get("items", [])
        )
        taxes = (
            [tax for tax in self.doc.get("taxes", []) if tax.get("name") == tax_name]
            if tax_name
            else self.doc.get("taxes", [])
        )

        return items, taxes

    def get_tax_amount(self, item_wise_tax_rates: Any, charge_type: str) -> float:
        """Calculate tax amount."""
        if isinstance(item_wise_tax_rates, str):
            item_wise_tax_rates = json.loads(item_wise_tax_rates)

        tax_amount = 0
        for item in self.doc.get("items", []):
            multiplier = (
                item.get("qty", 0)
                if charge_type == "On Item Quantity"
                else item.get("taxable_value", 0) / 100
            )
            tax_amount += flt(item_wise_tax_rates.get(item.get("name", ""), 0)) * multiplier

        return tax_amount

    def calculate_total_taxable_value(self) -> float:
        """Calculate total taxable value."""
        return sum([item.get("taxable_value", 0) for item in self.doc.get("items", [])])

    def get_value(self, field: str, doc: Optional[Dict] = None, default: float = 0) -> Any:
        """Get value from document."""
        doc = doc or self.doc

        if field in self.field_map:
            return doc.get(self.field_map.get(field), default)

        return doc.get(field, default)

    def get_fieldname(self, field: str) -> str:
        """Get field name from field map."""
        return self.field_map.get(field, field)


def validate_taxes(doc: Dict) -> None:
    """Validate tax entries in a document."""
    # TODO: Get GST accounts without Frappe
    # gst_accounts = get_all_gst_accounts(doc.company)
    gst_accounts = []
    
    for tax in doc.get("taxes", []):
        if not tax.get("tax_amount"):
            continue

        if tax.get("account_head") not in gst_accounts:
            raise ValidationError(
                f"Row #{tax.get('idx', 0)}: Only GST accounts are allowed in {doc.get('doctype', 'Document')}.",
                field="taxes"
            )


def flt(value: float, precision: int = 2) -> float:
    """Convert to float with precision."""
    try:
        return round(float(value), precision)
    except (ValueError, TypeError):
        return 0.0
