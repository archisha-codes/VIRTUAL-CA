# Copyright (c) 2024, Resilient Tech and contributors
# For license information, please see license.txt
import re
from itertools import combinations

from india_compliance.gst_india.constants import GST_REFUND_TAX_TYPES
from india_compliance.gst_india.utils import (
    get_escaped_name,
    get_full_gst_uom,
    validate_invoice_number,
)
from india_compliance.gst_india.utils.gstr_1 import (
    CATEGORY_SUB_CATEGORY_MAPPING,
    HSN_BIFURCATION_FROM,
    GSTR1_B2B_InvoiceType,
    GSTR1_Category,
    GSTR1_SubCategory,
    get_b2c_limit,
    getdate,
)

# Native Python equivalents for Frappe utilities
def flt(value, precision=2):
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    return round(float(value), precision)


def cint(value):
    """Convert value to integer."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


CATEGORY_CONDITIONS = {
    GSTR1_Category.B2B.value: {
        "category": "is_b2b_invoice",
        "sub_category": "set_for_b2b",
    },
    GSTR1_Category.B2CL.value: {
        "category": "is_b2cl_invoice",
        "sub_category": "set_for_b2cl",
    },
    GSTR1_Category.EXP.value: {
        "category": "is_export_invoice",
        "sub_category": "set_for_exports",
    },
    GSTR1_Category.B2CS.value: {
        "category": "is_b2cs_invoice",
        "sub_category": "set_for_b2cs",
    },
    GSTR1_Category.NIL_EXEMPT.value: {
        "category": "is_nil_rated_exempted_non_gst_invoice",
        "sub_category": "set_for_nil_exp_non_gst",
    },
    GSTR1_Category.CDNR.value: {
        "category": "is_cdnr_invoice",
        "sub_category": "set_for_cdnr",
    },
    GSTR1_Category.CDNUR.value: {
        "category": "is_cdnur_invoice",
        "sub_category": "set_for_cdnur",
    },
    GSTR1_Category.SUPECOM.value: {
        "category": "is_ecommerce_sales_invoice",
        "sub_category": "set_for_ecommerce_supply_type",
    },
}


class GSTR1Query:
    """
    TODO: This class uses frappe.qb (PyPika-based query builder).
    Replace with SQLAlchemy or raw SQL queries when database schema is available.
    """
    
    def __init__(
        self, filters=None, additional_si_columns=None, additional_si_item_columns=None
    ):
        # TODO: Replace with SQLAlchemy table definitions
        # self.si = frappe.qb.DocType("Sales Invoice")
        # self.si_item = frappe.qb.DocType("Sales Invoice Item")
        # self.si_taxes = frappe.qb.DocType("Sales Taxes and Charges")
        self.si = None
        self.si_item = None
        self.si_taxes = None
        self.filters = dict(filters or {})
        self.additional_si_columns = additional_si_columns or []
        self.additional_si_item_columns = additional_si_item_columns or []

    def get_base_query(self):
        """
        TODO: This method builds complex queries using frappe.qb.
        Replace with actual SQL query when database schema is available.
        """
        # Placeholder - returns a query-like object for compatibility
        # In FastAPI implementation, this should return SQLAlchemy query or raw SQL
        return None

    def get_query_with_common_filters(self, query):
        """
        TODO: Apply common filters to the query.
        Replace with actual query builder when database schema is available.
        """
        if self.filters.company:
            pass  # query = query.where(self.si.company == self.filters.company)
        if self.filters.company_gstin:
            pass  # query = query.where(self.si.company_gstin == self.filters.company_gstin)
        if self.filters.from_date:
            pass  # query = query.where(Date(self.si.posting_date) >= getdate(self.filters.from_date))
        if self.filters.to_date:
            pass  # query = query.where(Date(self.si.posting_date) <= getdate(self.filters.to_date))
        return query

    def get_taxes_query(self):
        """TODO: Return taxes subquery using SQLAlchemy."""
        return None

    def select_totals(self, query, si_doc, key):
        """TODO: Select invoice totals from the query."""
        return query


def cache_invoice_condition(func):
    def wrapped(self, invoice):
        if (cond := self.invoice_conditions.get(func.__name__)) is not None:
            return cond

        cond = func(self, invoice)
        self.invoice_conditions[func.__name__] = cond
        return cond

    return wrapped


class GSTR1Conditions:
    @cache_invoice_condition
    def is_nil_rated(self, invoice):
        return invoice.get("gst_treatment") == "Nil-Rated"

    @cache_invoice_condition
    def is_exempted(self, invoice):
        return invoice.get("gst_treatment") == "Exempted"

    @cache_invoice_condition
    def is_non_gst(self, invoice):
        return invoice.get("gst_treatment") == "Non-GST"

    @cache_invoice_condition
    def is_nil_rated_exempted_or_non_gst(self, invoice):
        return not self.is_export(invoice) and (
            self.is_nil_rated(invoice)
            or self.is_exempted(invoice)
            or self.is_non_gst(invoice)
        )

    @cache_invoice_condition
    def is_cn_dn(self, invoice):
        return invoice.get("is_return") or invoice.get("is_debit_note")

    @cache_invoice_condition
    def has_gstin_and_is_not_export(self, invoice):
        return invoice.get("billing_address_gstin") and not self.is_export(invoice)

    @cache_invoice_condition
    def is_export(self, invoice):
        return (
            invoice.get("place_of_supply") == "96-Other Countries"
            and invoice.get("gst_category") == "Overseas"
        )

    @cache_invoice_condition
    def is_inter_state(self, invoice):
        # if pos is not available default to False
        if not invoice.get("place_of_supply"):
            return False

        return invoice.get("company_gstin", "")[:2] != invoice.get("place_of_supply", "")[:2]

    @cache_invoice_condition
    def is_b2cl_cn_dn(self, invoice):
        invoice_total = (
            max(abs(invoice.get("invoice_total", 0)), abs(invoice.get("returned_invoice_total", 0)))
            if invoice.get("return_against")
            else invoice.get("invoice_total", 0)
        )

        return (
            abs(invoice_total) > get_b2c_limit(invoice.get("posting_date"))
        ) and self.is_inter_state(invoice)

    @cache_invoice_condition
    def is_b2cl_inv(self, invoice):
        return abs(invoice.get("invoice_total", 0)) > get_b2c_limit(
            invoice.get("posting_date")
        ) and self.is_inter_state(invoice)


class GSTR1CategoryConditions(GSTR1Conditions):
    def is_nil_rated_exempted_non_gst_invoice(self, invoice):
        return (
            self.is_nil_rated(invoice)
            or self.is_exempted(invoice)
            or self.is_non_gst(invoice)
        )

    def is_b2b_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and not self.is_cn_dn(invoice)
            and self.has_gstin_and_is_not_export(invoice)
        )

    def is_export_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and not self.is_cn_dn(invoice)
            and self.is_export(invoice)
        )

    def is_b2cl_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and not self.is_cn_dn(invoice)
            and not self.has_gstin_and_is_not_export(invoice)
            and not self.is_export(invoice)
            and self.is_b2cl_inv(invoice)
        )

    def is_b2cs_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and not self.has_gstin_and_is_not_export(invoice)
            and not self.is_export(invoice)
            and (not self.is_b2cl_cn_dn(invoice) or not self.is_b2cl_inv(invoice))
        )

    def is_cdnr_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and self.is_cn_dn(invoice)
            and self.has_gstin_and_is_not_export(invoice)
        )

    def is_cdnur_invoice(self, invoice):
        return (
            not self.is_nil_rated_exempted_or_non_gst(invoice)
            and self.is_cn_dn(invoice)
            and not self.has_gstin_and_is_not_export(invoice)
            and (self.is_export(invoice) or self.is_b2cl_cn_dn(invoice))
        )

    def is_ecommerce_sales_invoice(self, invoice):
        return bool(invoice.get("ecommerce_gstin"))


class GSTR1Subcategory(GSTR1CategoryConditions):
    def set_for_b2b(self, invoice):
        self._set_invoice_type_for_b2b_and_cdnr(invoice)

    def set_for_b2cl(self, invoice):
        # NO INVOICE VALUE
        invoice["invoice_sub_category"] = GSTR1_SubCategory.B2CL.value

    def set_for_exports(self, invoice):
        if invoice.get("is_export_with_gst"):
            invoice["invoice_sub_category"] = GSTR1_SubCategory.EXPWP.value
            invoice["invoice_type"] = "WPAY"

        else:
            invoice["invoice_sub_category"] = GSTR1_SubCategory.EXPWOP.value
            invoice["invoice_type"] = "WOPAY"

    def set_for_b2cs(self, invoice):
        # NO INVOICE VALUE
        invoice["invoice_sub_category"] = GSTR1_SubCategory.B2CS.value

    def set_for_nil_exp_non_gst(self, invoice):
        # INVOICE TYPE
        is_registered = self.has_gstin_and_is_not_export(invoice)
        is_interstate = self.is_inter_state(invoice)

        gst_registration = "registered" if is_registered else "unregistered"
        supply_type = "Inter-State" if is_interstate else "Intra-State"

        invoice["invoice_type"] = f"{supply_type} supplies to {gst_registration} persons"
        invoice["invoice_sub_category"] = GSTR1_SubCategory.NIL_EXEMPT.value

    def set_for_cdnr(self, invoice):
        self._set_invoice_type_for_b2b_and_cdnr(invoice)
        invoice["invoice_sub_category"] = GSTR1_SubCategory.CDNR.value

    def set_for_cdnur(self, invoice):
        invoice["invoice_sub_category"] = GSTR1_SubCategory.CDNUR.value
        if self.is_export(invoice):
            if invoice.get("is_export_with_gst"):
                invoice["invoice_type"] = "EXPWP"
                return

            invoice["invoice_type"] = "EXPWOP"
            return

        invoice["invoice_type"] = "B2CL"
        return

    def set_for_ecommerce_supply_type(self, invoice):
        if invoice.get("is_reverse_charge"):
            invoice["ecommerce_supply_type"] = GSTR1_SubCategory.SUPECOM_9_5.value
            return

        invoice["ecommerce_supply_type"] = GSTR1_SubCategory.SUPECOM_52.value

    def _set_invoice_type_for_b2b_and_cdnr(self, invoice):
        if invoice.get("gst_category") == "Deemed Export":
            invoice["invoice_type"] = GSTR1_B2B_InvoiceType.DE.value
            invoice["invoice_sub_category"] = GSTR1_SubCategory.DE.value

        elif invoice.get("gst_category") == "SEZ":
            if invoice.get("is_export_with_gst"):
                invoice["invoice_type"] = GSTR1_B2B_InvoiceType.SEWP.value
                invoice["invoice_sub_category"] = GSTR1_SubCategory.SEZWP.value

            else:
                invoice["invoice_type"] = GSTR1_B2B_InvoiceType.SEWOP.value
                invoice["invoice_sub_category"] = GSTR1_SubCategory.SEZWOP.value

        elif invoice.get("is_reverse_charge"):
            invoice["invoice_type"] = GSTR1_B2B_InvoiceType.R.value
            invoice["invoice_sub_category"] = GSTR1_SubCategory.B2B_REVERSE_CHARGE.value

        else:
            invoice["invoice_type"] = GSTR1_B2B_InvoiceType.R.value
            invoice["invoice_sub_category"] = GSTR1_SubCategory.B2B_REGULAR.value

    def set_hsn_sub_category(self, invoice, bifurcate_hsn):
        if not bifurcate_hsn:
            invoice["hsn_sub_category"] = GSTR1_SubCategory.HSN.value

        elif invoice.get("gst_category") in ("Unregistered", "Overseas"):
            invoice["hsn_sub_category"] = GSTR1_SubCategory.HSN_B2C.value

        else:
            invoice["hsn_sub_category"] = GSTR1_SubCategory.HSN_B2B.value


class GSTR1Invoices(GSTR1Query, GSTR1Subcategory):
    AMOUNT_FIELDS = {
        "taxable_value": 0,
        "igst_amount": 0,
        "cgst_amount": 0,
        "sgst_amount": 0,
        "total_cess_amount": 0,
    }

    def process_invoices(self, invoices, bifurcate_hsn=None):
        """
        TODO: This method uses frappe.get_cached_doc for GST Settings.
        Replace with database lookup when schema is available.
        """
        # settings = frappe.get_cached_doc("GST Settings")
        # TODO: Replace with actual settings lookup
        settings = {}
        identified_uom = {}

        if bifurcate_hsn is None:
            bifurcate_hsn = self.is_hsn_bifurcation_needed()

        for invoice in invoices:
            self.invoice_conditions = {}
            self.assign_categories(invoice)
            self.set_hsn_sub_category(invoice, bifurcate_hsn)

            if invoice.get("gst_hsn_code") and invoice["gst_hsn_code"].startswith("99"):
                invoice["uom"] = "OTH-OTHERS"
                invoice["qty"] = 0
                continue

            uom = invoice.get("uom", "")
            if uom in identified_uom:
                invoice["uom"] = identified_uom[uom]
            else:
                gst_uom = get_full_gst_uom(uom, settings)
                identified_uom[uom] = gst_uom
                invoice["uom"] = gst_uom

    def assign_categories(self, invoice):
        if not invoice.get("invoice_sub_category"):
            self.set_invoice_category(invoice)
            self.set_invoice_sub_category_and_type(invoice)

        if invoice.get("ecommerce_gstin") and not invoice.get("ecommerce_supply_type"):
            self.set_for_ecommerce_supply_type(invoice)

    def set_invoice_category(self, invoice):
        for category, functions in CATEGORY_CONDITIONS.items():
            if getattr(self, functions["category"], None)(invoice):
                invoice["invoice_category"] = category
                return

    def set_invoice_sub_category_and_type(self, invoice):
        category = invoice.get("invoice_category")
        if not category:
            return
        function = CATEGORY_CONDITIONS[category]["sub_category"]
        getattr(self, function, None)(invoice)

    def get_invoices_for_item_wise_summary(self):
        """
        TODO: This method uses frappe.qb for query building.
        Replace with SQLAlchemy or raw SQL when database schema is available.
        """
        # query = self.get_base_query()
        # return query.run(as_dict=True)
        return []  # Placeholder

    def get_invoices_for_hsn_wise_summary(self):
        """TODO: Replace with SQL query."""
        return []

    def get_filtered_invoices(
        self, invoices, invoice_category=None, invoice_sub_category=None
    ):
        filtered_invoices = []
        functions = CATEGORY_CONDITIONS.get(invoice_category)
        if not functions:
            return filtered_invoices
            
        condition = getattr(self, functions["category"], None)

        for invoice in invoices:
            self.invoice_conditions = {}
            if not condition(invoice):
                continue

            invoice["invoice_category"] = invoice_category
            self.set_invoice_sub_category_and_type(invoice)

            if not invoice_sub_category:
                filtered_invoices.append(invoice)

            elif invoice_sub_category == invoice.get("invoice_sub_category"):
                filtered_invoices.append(invoice)

            elif invoice_sub_category == invoice.get("ecommerce_supply_type"):
                filtered_invoices.append(invoice)

        self.process_invoices(invoices)

        return filtered_invoices

    def get_overview(self):
        """
        TODO: This method uses frappe.get_cached_value for GST Settings.
        Replace with database lookup when schema is available.
        """
        # is_ecommerce_sales_enabled = frappe.get_cached_value(
        #     "GST Settings", None, "enable_sales_through_ecommerce_operators"
        # )
        is_ecommerce_sales_enabled = False  # Placeholder
        
        final_summary = []
        sub_category_summary = self.get_sub_category_summary()

        IGNORED_CATEGORIES = {
            GSTR1_Category.AT,
            GSTR1_Category.TXP,
            GSTR1_Category.DOC_ISSUE,
            GSTR1_Category.HSN,
        }

        if not is_ecommerce_sales_enabled:
            IGNORED_CATEGORIES.add(GSTR1_Category.SUPECOM)

        for category, sub_categories in CATEGORY_SUB_CATEGORY_MAPPING.items():
            if category in IGNORED_CATEGORIES:
                continue

            category_summary = {
                "description": category.value,
                "no_of_records": 0,
                "indent": 0,
                **self.AMOUNT_FIELDS,
            }
            final_summary.append(category_summary)

            for sub_category in sub_categories:
                sub_category_row = sub_category_summary.get(sub_category.value, {})
                category_summary["no_of_records"] += sub_category_row.get("no_of_records", 0)

                for key in self.AMOUNT_FIELDS:
                    category_summary[key] += sub_category_row.get(key, 0)

                final_summary.append(sub_category_row)

        self.update_overlaping_invoice_summary(sub_category_summary, final_summary)

        return final_summary

    def get_sub_category_summary(self):
        invoices = self.get_invoices_for_item_wise_summary()
        self.process_invoices(invoices)

        summary = {}

        for category in GSTR1_SubCategory:
            category_value = category.value
            summary[category_value] = {
                "description": category_value,
                "no_of_records": 0,
                "indent": 1,
                "unique_records": set(),
                **self.AMOUNT_FIELDS,
            }

        def _update_summary_row(row, sub_category_field="invoice_sub_category"):
            summary_row = summary.get(row.get(sub_category_field, row.get("invoice_category")))
            if not summary_row:
                return

            for key in self.AMOUNT_FIELDS:
                summary_row[key] += row.get(key, 0)

            summary_row["unique_records"].add(row.get("invoice_no"))

        for row in invoices:
            _update_summary_row(row)

            if row.get("ecommerce_gstin"):
                _update_summary_row(row, "ecommerce_supply_type")

        for summary_row in summary.values():
            summary_row["no_of_records"] = len(summary_row["unique_records"])

        return summary

    def update_overlaping_invoice_summary(self, sub_category_summary, final_summary):
        nil_exempt = GSTR1_SubCategory.NIL_EXEMPT.value
        supecom_52 = GSTR1_SubCategory.SUPECOM_52.value
        supecom_9_5 = GSTR1_SubCategory.SUPECOM_9_5.value

        # Get Unique Taxable Invoices
        unique_invoices = set()
        for category, row in sub_category_summary.items():
            if category in (nil_exempt, supecom_52, supecom_9_5):
                continue

            unique_invoices.update(row.get("unique_records", set()))

        # Get Overlaping Invoices
        invoice_sets = [
            sub_category_summary.get(nil_exempt, {}).get("unique_records", set()),
            {
                *sub_category_summary.get(supecom_52, {}).get("unique_records", set()),
                *sub_category_summary.get(supecom_9_5, {}).get("unique_records", set()),
            },
            unique_invoices,
        ]

        overlaping_invoices = []

        for set1, set2 in combinations(invoice_sets, 2):
            overlaping_invoices.extend(set1.intersection(set2))

        # Update Summary
        if overlaping_invoices:
            final_summary.append(
                {
                    "description": "Overlaping Invoices in Nil-Rated/Exempt/Non-GST and E-commerce Sales",
                    "no_of_records": -len(overlaping_invoices),
                }
            )

    def is_hsn_bifurcation_needed(self):
        # From GSTR-1
        if self.filters.get("month_or_quarter"):
            from_date = getdate(
                f"01-{self.filters.month_or_quarter}-{self.filters.year}"
            )
        else:
            from_date = getdate(self.filters.get("from_date"))

        return from_date >= HSN_BIFURCATION_FROM


class GSTR1DocumentIssuedSummary:
    """
    TODO: This class uses frappe.qb for query building.
    Replace with SQLAlchemy or raw SQL when database schema is available.
    """
    
    def __init__(self, filters):
        self.filters = filters
        # TODO: Replace with SQLAlchemy table definitions
        # self.sales_invoice = frappe.qb.DocType("Sales Invoice")
        # self.sales_invoice_item = frappe.qb.DocType("Sales Invoice Item")
        # self.purchase_invoice = frappe.qb.DocType("Purchase Invoice")
        # self.stock_entry = frappe.qb.DocType("Stock Entry")
        # self.subcontracting_receipt = frappe.qb.DocType("Subcontracting Receipt")
        self.sales_invoice = None
        self.sales_invoice_item = None
        self.purchase_invoice = None
        self.stock_entry = None
        self.subcontracting_receipt = None
        self.queries = {
            "Sales Invoice": self.get_query_for_sales_invoice,
            "Purchase Invoice": self.get_query_for_purchase_invoice,
            "Stock Entry": self.get_query_for_stock_entry,
            "Subcontracting Receipt": self.get_query_for_subcontracting_receipt,
        }

    def get_data(self) -> list:
        return self.get_document_summary()

    def get_document_summary(self):
        """TODO: Replace with actual database queries."""
        return []

    def build_query(self, doctype, party_gstin_field, company_gstin_field="company_gstin", 
                    address_field=None, additional_selects=None, additional_conditions=None):
        """TODO: Build query using SQLAlchemy."""
        return None

    def get_query_for_sales_invoice(self):
        """TODO: Return SQLAlchemy query for sales invoices."""
        return None

    def get_query_for_purchase_invoice(self):
        """TODO: Return SQLAlchemy query for purchase invoices."""
        return None

    def get_query_for_stock_entry(self):
        """TODO: Return SQLAlchemy query for stock entries."""
        return None

    def get_query_for_subcontracting_receipt(self):
        """TODO: Return SQLAlchemy query for subcontracting receipts."""
        return None

    def seperate_data_by_naming_series(self, data, nature_of_document):
        if not data:
            return []

        slice_indices = []
        summarized_data = []

        for i in range(1, len(data)):
            if self.is_same_naming_series(data[i - 1].get("name", ""), data[i].get("name", "")):
                continue
            slice_indices.append(i)

        document_series_list = [
            data[i:j] for i, j in zip([0] + slice_indices, slice_indices + [None])
        ]

        for series in document_series_list:
            draft_count = sum(1 for doc in series if doc.get("docstatus") == 0)
            total_submitted_count = sum(1 for doc in series if doc.get("docstatus") == 1)
            cancelled_count = sum(1 for doc in series if doc.get("docstatus") == 2)

            summarized_data.append(
                {
                    "naming_series": (series[0].get("naming_series") or "").replace(".", ""),
                    "nature_of_document": nature_of_document,
                    "from_serial_no": series[0].get("name"),
                    "to_serial_no": series[-1].get("name"),
                    "total_submitted": total_submitted_count,
                    "cancelled": cancelled_count,
                    "total_draft": draft_count,
                    "total_issued": draft_count + total_submitted_count + cancelled_count,
                }
            )

        return summarized_data

    def is_same_naming_series(self, name_1, name_2):
        """
        Checks if two document names belong to the same naming series.
        """
        alphabet_pattern = re.compile(r"[A-Za-z]+")
        number_pattern = re.compile(r"\d+")

        a_0 = "".join(alphabet_pattern.findall(name_1))
        n_0 = "".join(number_pattern.findall(name_1))

        a_1 = "".join(alphabet_pattern.findall(name_2))
        n_1 = "".join(number_pattern.findall(name_2))

        if a_1 != a_0:
            return False

        if len(n_0) != len(n_1):
            return False

        suffix_length = 0

        for i in range(len(n_0) - 1, 0, -1):
            if n_0[i] == n_1[i]:
                suffix_length += 1
            else:
                break

        if suffix_length:
            n_0, n_1 = n_0[:-suffix_length], n_1[:-suffix_length]

        return cint(n_1) - cint(n_0) == 1

    def seperate_data_by_nature_of_document(self, data, doctype):
        nature_of_document = {
            "Excluded from Report (Invalid Invoice Number)": [],
            "Excluded from Report (Same GSTIN Billing)": [],
            "Excluded from Report (Is Opening Entry)": [],
            "Invoices for outward supply": [],
            "Debit Note": [],
            "Credit Note": [],
            "Invoices for inward supply from unregistered person": [],
            "Delivery Challan for job work": [],
        }

        for doc in data:
            if not validate_invoice_number(doc, throw=False):
                nature_of_document["Excluded from Report (Invalid Invoice Number)"].append(doc)

            elif doc.get("is_opening") == "Yes":
                nature_of_document["Excluded from Report (Is Opening Entry)"].append(doc)
            elif doc.get("same_gstin_billing"):
                nature_of_document["Excluded from Report (Same GSTIN Billing)"].append(doc)
            elif doctype == "Purchase Invoice":
                nature_of_document["Invoices for inward supply from unregistered person"].append(doc)
            elif doctype == "Stock Entry" or doctype == "Subcontracting Receipt":
                nature_of_document["Delivery Challan for job work"].append(doc)
            # for Sales Invoice
            elif doc.get("is_return"):
                nature_of_document["Credit Note"].append(doc)
            elif doc.get("is_debit_note"):
                nature_of_document["Debit Note"].append(doc)
            else:
                nature_of_document["Invoices for outward supply"].append(doc)

        return nature_of_document

    def handle_amended_docs(self, data):
        """Move amended docs like SINV-00001-1 to the end of the list"""
        data_dict = {doc.get("name"): doc for doc in data}
        amended_dict = {}

        for doc in data:
            if (
                doc.get("amended_from")
                and len(doc.get("amended_from", "")) != len(doc.get("name", ""))
                or doc.get("amended_from") in amended_dict
            ):
                amended_dict[doc.get("name")] = doc
                data_dict.pop(doc.get("name"))

        data_dict.update(amended_dict)

        return list(data_dict.values())


class GSTR11A11BData:
    """
    TODO: This class uses frappe.qb for query building.
    Replace with SQLAlchemy or raw SQL when database schema is available.
    """
    
    def __init__(self, filters, gst_accounts):
        self.filters = filters
        # TODO: Replace with SQLAlchemy table definitions
        # self.pe = frappe.qb.DocType("Payment Entry")
        # self.pe_ref = frappe.qb.DocType("Payment Entry Reference")
        # self.gl_entry = frappe.qb.DocType("GL Entry")
        self.pe = None
        self.pe_ref = None
        self.gl_entry = None
        self.gst_accounts = gst_accounts

    def get_data(self):
        """TODO: Replace with actual database queries."""
        return {}

    def get_11A_query(self):
        """TODO: Return SQLAlchemy query for advances."""
        return None

    def get_11B_query(self):
        """TODO: Return SQLAlchemy query for adjustments."""
        return None

    def get_query(self, type_of_business):
        """TODO: Build query using SQLAlchemy."""
        return None

    def get_conditions(self):
        """TODO: Return conditions list for query."""
        return []

    def process_data(self, records):
        data = {}
        for entry in records:
            taxable_value = flt(entry.get("taxable_value"), 2)
            tax_rate = (
                round(((entry.get("tax_amount", 0) / taxable_value) * 100))
                if taxable_value
                else 0
            )

            data.setdefault((entry.get("place_of_supply"), tax_rate), [0.0, 0.0])

            key = (entry.get("place_of_supply"), tax_rate)
            data[key][0] += taxable_value
            data[key][1] += flt(entry.get("cess_amount"), 2)

        return data
