# tax_engine.py

def compute_tax(row):
    taxable_value = round(float(row["taxable_value"]), 2)
    rate = float(row["gst_rate"])
    supplier_state = row["supplier_state_code"]
    pos = row["place_of_supply"]

    tax_amount = round(taxable_value * rate / 100, 2)

    if supplier_state == pos:
        cgst = round(tax_amount / 2, 2)
        sgst = round(tax_amount / 2, 2)
        igst = 0.00
    else:
        igst = tax_amount
        cgst = 0.00
        sgst = 0.00

    return cgst, sgst, igst


def apply_tax(df):
    df[["cgst", "sgst", "igst"]] = df.apply(
        lambda row: compute_tax(row), axis=1, result_type="expand"
    )

    df["invoice_value"] = round(
        df["taxable_value"] + df["cgst"] + df["sgst"] + df["igst"], 2
    )

    return df
