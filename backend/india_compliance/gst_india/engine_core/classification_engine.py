# VIRTUAL-CA-main/backend/india_compliance/gst_india/engine_core/classification_engine.py

import pandas as pd

def classify_transaction(row):
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

    # 4. B2C Large (Unregistered, Interstate, Value > 2.5 Lakhs)
    # GST rule for B2CL: Interstate supplies to unregistered persons where invoice value > Rs. 2,50,000
    if interstate and invoice_value > 250000:
        return "B2CL"

    # 5. B2C Small (Everything else)
    return "B2CS"


def apply_classification(df):
    if df.empty:
        df["gstr1_table"] = pd.Series(dtype=str)
        return df
        
    df["gstr1_table"] = df.apply(classify_transaction, axis=1)
    return df