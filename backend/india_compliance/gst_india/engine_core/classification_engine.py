# classification_engine.py

def classify_transaction(row):
    gstin = row["customer_gstin"]
    invoice_value = row["invoice_value"]
    supplier_state = row["supplier_state_code"]
    pos = row["place_of_supply"]
    supply_type = str(row.get("supply_type", "")).lower()
    reverse_charge = str(row.get("reverse_charge", "")).lower()

    interstate = supplier_state != pos

    # Export
    if "export" in supply_type:
        return "EXP"

    # Credit / Debit Note
    if invoice_value < 0:
        if gstin:
            return "CDNR"
        return "CDNUR"

    # B2B
    if gstin:
        return "B2B"

    # B2C
    if interstate and invoice_value > 100000:
        return "B2CL"

    return "B2CS"


def apply_classification(df):
    df["gstr1_table"] = df.apply(classify_transaction, axis=1)
    return df
