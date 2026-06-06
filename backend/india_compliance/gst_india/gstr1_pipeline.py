# gstr1_pipeline.py

from gst_india.preprocessing.input_adapter import load_sales_excel
from gst_india.preprocessing.validation_engine import run_validations
from gst_india.preprocessing.tax_engine import apply_tax
from gst_india.preprocessing.classification_engine import apply_classification
from gst_india.preprocessing.aggregation_engine import preprocess_for_gstr1

from gst_india.gstr1_data import GSTR1Data
from gst_india.exporters.gstr1_excel import export_gstr1_excel


def generate_gstr1_from_sales(
    sales_file_path: str,
    supplier_gstin: str,
    filing_month: int,
    output_file_path: str,
):

    # Step 1 — Load & Normalize
    df = load_sales_excel(sales_file_path, supplier_gstin)

    # Step 2 — Validation
    errors = run_validations(df, filing_month)
    if errors:
        raise Exception(f"Validation Errors Found: {errors}")

    # Step 3 — Tax Calculation
    df = apply_tax(df)

    # Step 4 — Classification
    df = apply_classification(df)

    # Step 5 — Aggregation
    processed_data = preprocess_for_gstr1(df)

    # Step 6 — Feed to existing GST engine
    gstr1_obj = GSTR1Data(processed_data["full_data"])

    # Step 7 — Export Excel
    export_gstr1_excel(gstr1_obj, output_file_path)

    return "GSTR1 Generated Successfully"
