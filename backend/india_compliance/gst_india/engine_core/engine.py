# engine_core/engine.py

from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field
import hashlib
import json

class RecordError(BaseModel):
    row: int = 0
    error_code: str
    message: str
    record: Dict[str, Any] = Field(default_factory=dict)

class ValidRecord(BaseModel):
    category: str
    record_hash: str
    data: Dict[str, Any]

class EngineResult(BaseModel):
    valid_records: List[ValidRecord] = Field(default_factory=list)
    error_records: List[RecordError] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)

def calculate_row_hash(row_dict: Dict[str, Any]) -> str:
    serialized = json.dumps(row_dict, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

import pandas as pd

from .input_adapter import adapt_input_dataframe
from .validation_engine import validate_rows
from .tax_engine import apply_tax
from .classification_engine import classify_transaction, apply_classification
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables


class GSTR1Engine:

    def __init__(self, company_gstin: str):
        self.company_gstin = company_gstin

    def run_from_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Full GST pipeline execution.
        """

        # 1️⃣ Adapt headers and unpack tuple (dataframe, mapping)
        rows, mapping = adapt_input_dataframe(df)

        # 2️⃣ Validate
        input_validation_report = validate_rows(rows)

        # 3️⃣ Compute tax
        rows = apply_tax(rows)

        # 4️⃣ Classification
        rows = apply_classification(rows)

        # 5️⃣ Generate GSTR-1 tables
        gstr1_tables, validation_report = generate_gstr1_tables(
            clean_data=rows,
            company_gstin=self.company_gstin,
            include_hsn=True,
            include_docs=True
        )

        if hasattr(validation_report, "to_dict"):
            gstr1_tables["validation_report"] = validation_report.to_dict()
        else:
            gstr1_tables["validation_report"] = {
                "errors": getattr(validation_report, "errors", []),
                "warnings": getattr(validation_report, "warnings", []),
                "final_status": getattr(validation_report, "final_status", "unknown"),
            }

        engine_result = EngineResult()
        
        categories = ["b2b", "b2cl", "b2cs", "exp", "cdnr", "cdnur", "nil_exempt"]
        processed_hashes = set()
        
        for category in categories:
            if category in gstr1_tables:
                items = gstr1_tables[category]
                if isinstance(items, list):
                    for item in items:
                        rec_hash = calculate_row_hash(item)
                        if rec_hash not in processed_hashes:
                            processed_hashes.add(rec_hash)
                            engine_result.valid_records.append(ValidRecord(category=category, record_hash=rec_hash, data=item))
                elif isinstance(items, dict):
                    # Some tables might be grouped by GSTIN
                    for key, item in items.items():
                        rec_hash = calculate_row_hash(item)
                        if rec_hash not in processed_hashes:
                            processed_hashes.add(rec_hash)
                            engine_result.valid_records.append(ValidRecord(category=category, record_hash=rec_hash, data=item))

        # Handle errors
        in_errors = getattr(input_validation_report, "errors", [])
        for err in in_errors:
            engine_result.error_records.append(RecordError(error_code="INPUT_ERROR", message=str(err)))
            
        gen_errors = getattr(validation_report, "errors", [])
        for err in gen_errors:
            engine_result.error_records.append(RecordError(error_code="GEN_ERROR", message=str(err)))

        engine_result.summary = gstr1_tables.get("summary", {})
        
        return engine_result.model_dump()

    def run_from_excel(self, file_path: str) -> Dict[str, Any]:
        df = pd.read_excel(file_path)
        # Handle duplicate columns that cause "The truth value of a Series is ambiguous"
        df = df.loc[:, ~df.columns.duplicated()]
        return self.run_from_dataframe(df)
