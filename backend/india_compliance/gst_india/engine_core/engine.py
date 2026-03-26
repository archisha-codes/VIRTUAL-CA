# engine_core/engine.py

from typing import List, Dict, Any
import pandas as pd

from .input_adapter import adapt_input_dataframe
from .validation_engine import validate_rows
from .tax_engine import compute_tax
from .classification_engine import classify_transaction, apply_classification
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables


class GSTR1Engine:

    def __init__(self, company_gstin: str):
        self.company_gstin = company_gstin

    def run_from_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Full GST pipeline execution.
        """

        # 1️⃣ Adapt headers
        rows = adapt_input_dataframe(df)

        # 2️⃣ Validate
        validate_rows(rows)

        # 3️⃣ Compute tax
        rows = compute_tax(rows, self.company_gstin)

        # 4️⃣ Classification
        rows = apply_classification(rows)

        # 5️⃣ Generate GSTR-1 tables
        gstr1_tables = generate_gstr1_tables(
            clean_data=rows,
            company_gstin=self.company_gstin,
            include_hsn=True,
            include_docs=True
        )

        return gstr1_tables

    def run_from_excel(self, file_path: str) -> Dict[str, Any]:
        df = pd.read_excel(file_path)
        return self.run_from_dataframe(df)
