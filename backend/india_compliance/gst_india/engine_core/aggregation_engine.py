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
    
    grouped = (
        df.groupby("hsn_code")
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
    """Calculate total tax amounts (IGST, CGST, SGST, CESS)."""
    if df.empty:
        return {
            "total_igst": 0.0,
            "total_cgst": 0.0,
            "total_sgst": 0.0,
            "total_cess": 0.0,
            "total_tax": 0.0,
        }
    
    total_igst = float(df["igst"].sum() or 0)
    total_cgst = float(df["cgst"].sum() or 0)
    total_sgst = float(df["sgst"].sum() or 0)
    total_cess = float(df["cess"].sum() or 0)
    
    return {
        "total_igst": round(total_igst, 2),
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_cess": round(total_cess, 2),
        "total_tax": round(total_igst + total_cgst + total_sgst + total_cess, 2),
    }
