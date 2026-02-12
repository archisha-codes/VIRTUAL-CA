# aggregation_engine.py

import pandas as pd


def aggregate_b2cs(df):
    b2cs = df[df["gstr1_table"] == "B2CS"]

    grouped = (
        b2cs.groupby(["place_of_supply", "gst_rate"])
        .agg(
            {
                "taxable_value": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "igst": "sum",
            }
        )
        .reset_index()
    )

    return grouped


def aggregate_hsn(df):
    grouped = (
        df.groupby("hsn")
        .agg(
            {
                "qty": "sum",
                "taxable_value": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "igst": "sum",
            }
        )
        .reset_index()
    )

    return grouped


def preprocess_for_gstr1(df):
    b2cs_summary = aggregate_b2cs(df)
    hsn_summary = aggregate_hsn(df)

    return {
        "full_data": df,
        "b2cs_summary": b2cs_summary,
        "hsn_summary": hsn_summary,
    }
