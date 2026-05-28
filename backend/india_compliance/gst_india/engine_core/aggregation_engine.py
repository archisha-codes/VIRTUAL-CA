# aggregation_engine.py

import pandas as pd
from typing import Dict, List, Optional, Any


def preprocess_for_gstr1(df):
    """
    Main preprocessing function for GSTR-1 data.
    Properly separates invoices by type: B2B, B2CL, B2CS, EXPORT, CDNR.
    """
    # Ensure transaction_type column exists
    if 'transaction_type' not in df.columns:
        return {
            "full_data": df,
            "b2b_data": pd.DataFrame(),
            "b2cl_data": pd.DataFrame(),
            "b2cs_data": pd.DataFrame(),
            "export_data": pd.DataFrame(),
            "cdnr_data": pd.DataFrame(),
            "hsn_summary": pd.DataFrame(),
        }
    
    # Filter by transaction type
    b2b_data = df[df["transaction_type"].str.contains("B2B", na=False)]
    b2cl_data = df[df["transaction_type"] == "B2CL"]
    b2cs_data = df[df["transaction_type"] == "B2CS"]
    export_data = df[df["transaction_type"].str.contains("EXPORT", na=False)]
    cdnr_data = df[df["transaction_type"].str.contains("CDN", na=False)]
    
    # Generate summaries
    b2cs_summary = aggregate_b2cs(b2cs_data)
    hsn_summary = aggregate_hsn(df)
    
    return {
        "full_data": df,
        "b2b_data": b2b_data,
        "b2cl_data": b2cl_data,
        "b2cs_data": b2cs_data,
        "export_data": export_data,
        "cdnr_data": cdnr_data,
        "b2cs_summary": b2cs_summary,
        "hsn_summary": hsn_summary,
    }


def aggregate_b2cs(df):
    """Aggregate B2CS (B2C Small) data by place of supply and GST rate."""
    if df.empty:
        return pd.DataFrame()

    grouped = (
        df.groupby(["place_of_supply", "rate"])
        .agg(
            {
                "taxable_value": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "igst": "sum",
                "cess": "sum",
            }
        )
        .reset_index()
    )

    return grouped


def aggregate_b2b(df):
    """Aggregate B2B data by customer GSTIN."""
    if df.empty:
        return pd.DataFrame()
    
    grouped = (
        df.groupby(["gstin", "customer_name"])
        .agg(
            {
                "invoice_number": "count",
                "taxable_value": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "igst": "sum",
                "cess": "sum",
            }
        )
        .reset_index()
    )
    
    return grouped


def aggregate_b2cl(df):
    """Aggregate B2CL (B2C Large) data by place of supply."""
    if df.empty:
        return pd.DataFrame()
    
    grouped = (
        df.groupby(["place_of_supply", "rate"])
        .agg(
            {
                "invoice_number": "count",
                "taxable_value": "sum",
                "igst": "sum",
                "cess": "sum",
            }
        )
        .reset_index()
    )
    
    return grouped


def aggregate_hsn(df):
    """Aggregate data by HSN code."""
    if df.empty:
        return pd.DataFrame()
    
    # Ensure hsn_code has no NaNs/empty before groupby
    if 'hsn_code' in df.columns:
        df['hsn_code'] = df['hsn_code'].fillna('999999-MISSING')
        df.loc[df['hsn_code'].astype(str).str.strip() == '', 'hsn_code'] = '999999-MISSING'
        df.loc[df['hsn_code'].astype(str).str.lower() == 'nan', 'hsn_code'] = '999999-MISSING'
    else:
        df['hsn_code'] = '999999-MISSING'

    # Ensure quantity has no NaNs
    if 'quantity' in df.columns:
        df['quantity'] = df['quantity'].fillna(0.0)
    
    grouped = (
        df.groupby("hsn_code", dropna=False)
        .agg(
            {
                "quantity": "sum",
                "taxable_value": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "igst": "sum",
                "cess": "sum",
            }
        )
        .reset_index()
    )

    return grouped

def calculate_tax_totals(df) -> Dict[str, float]:
    """Calculate total tax amounts (IGST, CGST, SGST, CESS).

    Uses ``float()`` via explicit conversion so that both ``Decimal`` and
    ``float`` column dtypes are handled without raising a ``TypeError``
    (``unsupported operand type(s) for +: 'decimal.Decimal' and 'float'``).
    """
    if df.empty:
        return {
            "total_igst": 0.0,
            "total_cgst": 0.0,
            "total_sgst": 0.0,
            "total_cess": 0.0,
            "total_tax": 0.0,
        }

    def _safe_sum(col: str) -> float:
        """Sum a column that may contain Decimal, float, or int values."""
        if col not in df.columns:
            return 0.0
        # pandas .sum() on object/Decimal columns returns a Decimal; cast to float.
        try:
            raw = df[col].apply(lambda v: float(v) if v is not None else 0.0).sum()
        except (TypeError, ValueError):
            raw = 0.0
        return float(raw) if raw is not None else 0.0

    total_igst = _safe_sum("igst")
    total_cgst = _safe_sum("cgst")
    total_sgst = _safe_sum("sgst")
    total_cess = _safe_sum("cess")

    return {
        "total_igst": round(total_igst, 2),
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_cess": round(total_cess, 2),
        "total_tax": round(total_igst + total_cgst + total_sgst + total_cess, 2),
    }
