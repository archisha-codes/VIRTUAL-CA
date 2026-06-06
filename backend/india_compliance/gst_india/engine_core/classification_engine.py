# VIRTUAL-CA-main/backend/india_compliance/gst_india/engine_core/classification_engine.py

import pandas as pd
from datetime import datetime

def parse_return_period(period_str: str) -> tuple[int, int]:
    """Parse a return period string like '07/2024' or '072024' into (month, year)."""
    if not period_str:
        return 1, 2000 # default fallback
    p = str(period_str).strip().replace('/', '').replace('-', '')
    if len(p) >= 6:
        try:
            return int(p[:2]), int(p[2:6])
        except ValueError:
            pass
    return 1, 2000

def classify_transaction(row, return_period=None):
    # Safely get GSTIN (checking both canonical and original aliases)
    gstin = str(row.get("gstin", "") or row.get("customer_gstin", "") or "").strip()
    
    # Safely handle invoice value
    inv_val = row.get("invoice_value", 0)
    if pd.isna(inv_val):
        invoice_value = 0
    else:
        try:
            invoice_value = float(inv_val)
        except (ValueError, TypeError):
            invoice_value = 0
            
    supplier_state = str(row.get("supplier_state_code", "")).strip()
    pos = str(row.get("place_of_supply", "")).strip()
    supply_type = str(row.get("supply_type", "")).lower()
    
    # Check for advances (Table 11A/11B)
    if "advance" in supply_type or row.get("is_advance"):
        if "adj" in supply_type or row.get("is_advance_adjustment"):
            return "TXP" # Table 11B
        return "ATA" # Table 11A

    # Check for ECO supplies (Table 14 / Table 15)
    if "eco" in supply_type or row.get("is_eco"):
        if "9(5)" in supply_type or row.get("is_sec_9_5"):
            return "ECO95" # Table 15
        return "ECO" # Table 14

    # Interstate logic
    interstate = supplier_state != pos if supplier_state and pos else False

    # 1. Export
    if "export" in supply_type or "sez" in supply_type or "deemed" in supply_type:
        return "EXP"

    # 2. Credit / Debit Note
    doc_type = str(row.get("document_type", "")).lower()
    is_note = invoice_value < 0 or "credit" in doc_type or "debit" in doc_type or "note" in doc_type
    
    if is_note:
        if gstin:
            return "CDNR"
        return "CDNUR"

    # 3. B2B (Registered)
    if gstin and len(gstin) >= 15:
        return "B2B"

    # 4. B2C Large (Unregistered, Interstate, Value > Threshold)
    b2cl_threshold = 250000
    if return_period:
        month, year = parse_return_period(return_period)
        if year > 2024 or (year == 2024 and month >= 8):
            b2cl_threshold = 100000

    if interstate and invoice_value > b2cl_threshold:
        return "B2CL"

    # 5. B2C Small (Everything else)
    return "B2CS"


def apply_classification(df, return_period=None):
    if df.empty:
        df["gstr1_table"] = pd.Series(dtype=str)
        return df
        
    df["gstr1_table"] = df.apply(lambda row: classify_transaction(row, return_period), axis=1)
    return df