"""Compatibility façade for GSTR-1 Excel ingestion.

The legacy parser/validator lived here. Phase 1 moves ingestion to the new
domain model and adapter layer while keeping the public helper names stable for
existing callers.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional

try:
    import pandas as pd
except ImportError:  # pragma: no cover - pandas is available in the repo env
    pd = None

from india_compliance.gst_india.adapters.excel_ingestion import ExcelIngestionAdapter
from india_compliance.gst_india.utils.gstr_1.processor import process_gstr1_excel as _legacy_process_gstr1_excel


TAX_COLUMNS = ("taxable_value", "igst", "cgst", "sgst", "cess", "invoice_value", "qty", "rate")


def _coerce_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        if pd is not None and pd.isna(value):
            return Decimal("0.00")
        return Decimal(str(value))
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "").replace("₹", "").replace("%", "")
        if cleaned == "":
            return Decimal("0.00")
        value = cleaned
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0.00")


def cast_tax_columns_to_decimal(df: Any) -> Any:
    """Normalize financial columns to Decimal without introducing float math."""
    if pd is None or not isinstance(df, pd.DataFrame):
        return df

    for column in TAX_COLUMNS:
        if column in df.columns:
            df[column] = df[column].apply(_coerce_decimal)

    return df


def _payload_from_models(models: List[Any], errors: Iterable[Any]) -> Dict[str, Any]:
    error_list = list(errors)
    return {
        "records": models,
        "clean_data": models,
        "errors": [error.to_dict() if hasattr(error, "to_dict") else error for error in error_list],
        "validation_summary": {
            "total_errors": len(error_list),
            "total_warnings": 0,
            "is_valid": len(error_list) == 0,
        },
    }


def process_gstr1_excel(file_content: Any, skiprows: Optional[int] = None) -> Dict[str, Any]:
    """Compatibility wrapper around the legacy GSTR-1 Excel processor."""
    return _legacy_process_gstr1_excel(file_content)


def process_excel(file_content: Any, skiprows: Optional[int] = None) -> Dict[str, Any]:
    return process_gstr1_excel(file_content, skiprows=skiprows)


def process_multi_sheet_excel(file_content: bytes, return_period: str = "", company_gstin: str = "") -> Dict[str, Any]:
    return _legacy_process_gstr1_excel(file_content)


def ingest_gstr1_excel(file_content: Any) -> List[Any]:
    """Strict ingestion entrypoint that returns validated domain models."""
    adapter = ExcelIngestionAdapter()
    return adapter.ingest(file_content)


__all__ = [
    "TAX_COLUMNS",
    "cast_tax_columns_to_decimal",
    "ingest_gstr1_excel",
    "process_excel",
    "process_gstr1_excel",
    "process_multi_sheet_excel",
]