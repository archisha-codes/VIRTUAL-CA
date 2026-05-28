from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from india_compliance.gst_india.domain.gstr1_models import InvoiceRecord
from india_compliance.gst_india.utils.gstr1.structured_logging import get_structured_logger


logger = get_structured_logger("gstr1_pipeline")


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def _format_place_of_supply(place_of_supply: str) -> str:
    return str(place_of_supply or "").strip().upper()


def _extract_state_code(place_of_supply: str) -> str:
    normalized = _format_place_of_supply(place_of_supply)
    if not normalized:
      return ""
    prefix = normalized[:2]
    return prefix if prefix.isdigit() else ""


def _invoice_to_dict(invoice: InvoiceRecord, table_name: str) -> Dict[str, Any]:
    payload = invoice.model_dump()
    payload["table_name"] = table_name
    payload["invoice_date"] = invoice.invoice_date.isoformat()
    return payload


def _aggregate_hsn(invoices: Iterable[InvoiceRecord]) -> List[Dict[str, Any]]:
    hsn_groups: Dict[tuple[str, str], Dict[str, Any]] = {}

    for invoice in invoices:
        key = (str(invoice.hsn or "").strip(), str(invoice.uom or "").strip())
        current = hsn_groups.setdefault(
            key,
            {
                "hsn_code": invoice.hsn,
                "description": "",
                "uom": invoice.uom,
                "quantity": Decimal("0.00"),
                "total_value": Decimal("0.00"),
                "taxable_value": Decimal("0.00"),
                "igst": Decimal("0.00"),
                "cgst": Decimal("0.00"),
                "sgst": Decimal("0.00"),
                "cess": Decimal("0.00"),
                "rate": Decimal("0.00"),
            },
        )
        current["quantity"] += _to_decimal(invoice.quantity)
        current["total_value"] += _to_decimal(invoice.invoice_value)
        current["taxable_value"] += _to_decimal(invoice.taxable_value)
        current["igst"] += _to_decimal(invoice.igst)
        current["cgst"] += _to_decimal(invoice.cgst)
        current["sgst"] += _to_decimal(invoice.sgst)
        current["cess"] += _to_decimal(invoice.cess)
        current["rate"] = _to_decimal(invoice.gst_rate)

    return list(hsn_groups.values())


@dataclass
class GSTR1CalculationEngine:
    tenant_state_code: Optional[str] = None

    def _is_interstate(self, invoice: InvoiceRecord) -> bool:
        tenant_code = (self.tenant_state_code or "").strip()
        place_code = _extract_state_code(invoice.place_of_supply)
        if not tenant_code or not place_code:
            return False
        return tenant_code != place_code

    def _is_export(self, invoice: InvoiceRecord) -> bool:
        document_type = str(invoice.document_type or "").strip().lower()
        supply_type = str(invoice.supply_type or "").strip().lower()
        return any(token in document_type for token in ("export", "exp")) or "export" in supply_type

    def _is_credit_or_debit_note(self, invoice: InvoiceRecord) -> bool:
        document_type = str(invoice.document_type or "").strip().lower()
        return any(token in document_type for token in ("credit", "debit", "cdn", "cn", "dn"))

    def _is_registered(self, invoice: InvoiceRecord) -> bool:
        return bool(invoice.customer_gstin)

    def process_invoices(self, invoices: List[InvoiceRecord]) -> Dict[str, Any]:
        grouped_tables: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        total_taxable_value = Decimal("0.00")
        total_igst = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_cess = Decimal("0.00")

        for invoice in invoices:
            total_taxable_value += _to_decimal(invoice.taxable_value)
            total_igst += _to_decimal(invoice.igst)
            total_cgst += _to_decimal(invoice.cgst)
            total_sgst += _to_decimal(invoice.sgst)
            total_cess += _to_decimal(invoice.cess)

            if self._is_export(invoice):
                grouped_tables["exp"].append(_invoice_to_dict(invoice, "exp"))
                continue

            if self._is_credit_or_debit_note(invoice):
                if self._is_registered(invoice):
                    grouped_tables["cdnr"].append(_invoice_to_dict(invoice, "cdnr"))
                else:
                    grouped_tables["cdnur"].append(_invoice_to_dict(invoice, "cdnur"))
                continue

            if self._is_registered(invoice):
                grouped_tables["b2b"].append(_invoice_to_dict(invoice, "b2b"))
                continue

            if self._is_interstate(invoice) and _to_decimal(invoice.invoice_value) > Decimal("250000.00"):
                grouped_tables["b2cl"].append(_invoice_to_dict(invoice, "b2cl"))
            else:
                grouped_tables["b2cs"].append(_invoice_to_dict(invoice, "b2cs"))

        hsn_tables = _aggregate_hsn(invoices)

        return {
            "summary": {
                "total_taxable_value": total_taxable_value,
                "total_igst": total_igst,
                "total_cgst": total_cgst,
                "total_sgst": total_sgst,
                "total_cess": total_cess,
                "total_record_count": len(invoices),
            },
            "tables": {
                "b2b": grouped_tables.get("b2b", []),
                "b2cl": grouped_tables.get("b2cl", []),
                "b2cs": grouped_tables.get("b2cs", []),
                "cdnr": grouped_tables.get("cdnr", []),
                "cdnur": grouped_tables.get("cdnur", []),
                "exp": grouped_tables.get("exp", []),
                "hsn": hsn_tables,
            },
        }


def generate_gstr1_from_sales(
    sales_file_path: str,
    supplier_gstin: str,
    filing_month: int,
    output_file_path: str,
):
    logger.info(
        "Legacy pipeline wrapper invoked",
        {
            "event": "pipeline_compat_wrapper",
            "file_path": sales_file_path,
            "supplier_gstin": supplier_gstin,
            "filing_month": filing_month,
            "output_path": output_file_path,
        },
    )
    raise NotImplementedError(
        "The legacy file-based pipeline is no longer supported. Use GSTR1CalculationEngine with parsed invoices instead."
    )


__all__ = ["GSTR1CalculationEngine", "generate_gstr1_from_sales"]