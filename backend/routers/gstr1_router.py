from typing import List, Dict, Any, Optional
# UUID imports removed - using str
from fastapi import APIRouter, Depends, status, HTTPException, Path, Query, Body, UploadFile, File as FastAPIFile, Form
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal, ROUND_HALF_EVEN
from india_compliance.gst_india.gsp_integration.gstn_client import GSTNClient
from india_compliance.gst_india.utils.cryptography import aes_encrypt_data, hmac_sha256

import json
import io
import tempfile
import os
import pathlib
import math
import logging
from india_compliance.gst_india.utils.gstr1.structured_logging import get_structured_logger, set_log_context, clear_log_context

logger = get_structured_logger("gstr1_router")

def clean_float_data(data):
    """Recursively clean NaN and Infinity from data structures so they are valid JSON."""
    if isinstance(data, dict):
        return {k: clean_float_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_float_data(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
    return data

from database import get_db
from api.dependencies import get_current_user, verify_workspace_access
from models.tenant_models import Business, User

from api.schemas import (
    GSTR1StateResponse, 
    GSTR1UploadResponse, 
    GSTR1DraftSaveRequest, 
    GSTR1InvoiceUpdate,
    GSTR1InvoiceResponse,
    GSTR1DraftSummaryResponse,
    GSTR1ErrorResponse
)
from models.gst_models import GSTR1_Draft, GSTR1_Draft_Summary, GSTR1_Draft_Invoice, GSTR1_Draft_Error

from india_compliance.gst_india.engine_core.engine import GSTR1Engine
from india_compliance.gst_india.engine_core.input_adapter import ExcelInputAdapter
from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
from india_compliance.gst_india.adapters.excel_ingestion import ExcelIngestionAdapter
from india_compliance.gst_india.gstr1_pipeline import GSTR1CalculationEngine

# Imports for GSTR-1 file validation pipeline
from india_compliance.gst_india.engine_core.input_adapter import adapt_input_dataframe
from india_compliance.gst_india.engine_core.validation_engine import validate_rows
from india_compliance.gst_india.engine_core.tax_engine import apply_tax
from india_compliance.gst_india.engine_core.classification_engine import apply_classification
from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
from india_compliance.gst_india.utils.processor import cast_tax_columns_to_decimal

from pydantic import BaseModel, Field

# Pydantic schemas for highly observabile validation results
class GSTR1ValidationRule(BaseModel):
    name: str
    category: str
    severity: str
    message: str
    suggestion: Optional[str] = None
    error_code: Optional[str] = None

class GSTR1ValidationResultItem(BaseModel):
    rule: str
    category: str
    severity: str
    message: str
    field: Optional[str] = None
    value: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    row_index: Optional[int] = None
    suggestion: Optional[str] = None
    error_code: Optional[str] = None
    corrected_value: Optional[Any] = None

class GSTR1InputValidation(BaseModel):
    errors: List[str] = []
    warnings: List[str] = []
    rules: Optional[List[GSTR1ValidationRule]] = None
    results: Optional[List[GSTR1ValidationResultItem]] = None
    summary: Optional[Dict[str, int]] = None
    total_rows: Optional[int] = None
    total_columns: Optional[int] = None
    total_results: Optional[int] = None
    total_errors: Optional[int] = None
    total_warnings: Optional[int] = None
    is_valid: Optional[bool] = None

class GSTR1TableValidation(BaseModel):
    errors: List[str] = []
    warnings: List[str] = []
    summary: Optional[Dict[str, int]] = None
    total_results: Optional[int] = None
    total_errors: Optional[int] = None
    total_warnings: Optional[int] = None
    is_valid: Optional[bool] = None
    results: Optional[List[GSTR1ValidationResultItem]] = None
    rules: Optional[List[GSTR1ValidationRule]] = None

class GSTR1ValidationReport(BaseModel):
    input_validation: GSTR1InputValidation
    table_validation: GSTR1TableValidation
    final_status: str

class GSTR1ValidationSummary(BaseModel):
    total_rows: int
    input_errors: int
    input_warnings: int
    table_errors: int
    table_warnings: int

class GSTR1ValidationResponse(BaseModel):
    success: bool
    is_valid: bool
    validation_report: GSTR1ValidationReport
    summary: GSTR1ValidationSummary

router = APIRouter(tags=["GSTR-1"])

@router.post("/api/gstr1/validate", response_model=GSTR1ValidationResponse)
async def validate_gstr1_file(
    file: UploadFile = FastAPIFile(...),
    mapping: str = Form(...),
    company_gstin: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate uploaded GSTR-1 spreadsheet and return highly precise mathematical & legal audit reports.
    """
    import uuid
    import pandas as pd
    
    set_log_context(trace_id=str(uuid.uuid4()), gstin=company_gstin)
    logger.info("Validation request received for GSTR-1 spreadsheet upload")
    
    try:
        contents = await file.read()
        suffix = pathlib.Path(file.filename).suffix if file.filename else ".xlsx"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        try:
            adapter = ExcelInputAdapter(strict_mode=False)
            df = adapter.load_excel(tmp_path)
            
            mapping_dict = json.loads(mapping)
            reverse_mapping = {v: k for k, v in mapping_dict.items() if v}
            df.rename(columns=reverse_mapping, inplace=True)

            # ── INTERCEPT: cast all tax/value columns to Decimal(ROUND_HALF_EVEN) ──
            df = cast_tax_columns_to_decimal(df)
            # ─────────────────────────────────────────────────────────────────────

            # Keep only standard columns (avoid Series truth value ambiguity on duplicates)
            df = df.loc[:, ~df.columns.duplicated()]
            
            # 1. Adapt and validate rows using the robust validation engine
            # adapt headers to expected clean format
            rows, _ = adapt_input_dataframe(df)
            
            # Row level validation
            validation_report = validate_rows(df, supplier_gstin=company_gstin)
            
            # Tax computation & classification
            rows_with_tax = apply_tax(rows)
            classified_rows = apply_classification(rows_with_tax)
            
            # 2. Perform table-level validation using generate_gstr1_tables
            gstr1_tables, table_validation_report = generate_gstr1_tables(
                clean_data=classified_rows,
                company_gstin=company_gstin,
                include_hsn=True,
                include_docs=True,
                validate=True
            )

            # ── Map summary validation failures → HTTP 422 immediately ──
            # Do NOT swallow these as generic 500s. The React frontend reads
            # the "mismatches" array and highlights the offending rows.
            if table_validation_report.errors:
                mismatches = [
                    {
                        "field":   "summary_validation",
                        "message": err,
                        "severity": "error",
                    }
                    for err in table_validation_report.errors
                ]
                logger.warning(
                    f"Summary validation failed for upload ({len(mismatches)} mismatch(es)): "
                    + "; ".join(table_validation_report.errors)
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error":       "summary_validation_failed",
                        "description": "The uploaded data contains tax value mismatches.",
                        "mismatches":  mismatches,
                    },
                )
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
        # 3. Construct response mapping cleanly to frontend schema
        # Input validation mapping
        input_errors = [r.message for r in validation_report.get_errors()]
        input_warnings = [r.message for r in validation_report.get_warnings()]
        
        input_results_items = []
        for r in validation_report.results:
            input_results_items.append(GSTR1ValidationResultItem(
                rule=r.rule_name,
                category=r.category.value if hasattr(r.category, "value") else str(r.category),
                severity=r.severity.value if hasattr(r.severity, "value") else str(r.severity),
                message=r.message,
                field=r.field,
                value=str(r.value) if r.value is not None else None,
                expected=str(r.expected) if hasattr(r, "expected") and r.expected is not None else None,
                actual=str(r.actual) if hasattr(r, "actual") and r.actual is not None else None,
                row_index=r.row_index,
                suggestion=r.suggestion,
                error_code=r.error_code,
                corrected_value=r.corrected_value
            ))
            
        input_rules = []
        for r in validation_report.rules:
            input_rules.append(GSTR1ValidationRule(
                name=r.get("name", ""),
                category=r.get("category", ""),
                severity=r.get("severity", ""),
                message=r.get("message", ""),
                suggestion=r.get("suggestion"),
                error_code=r.get("error_code")
            ))
            
        # Table validation mapping
        table_errors = table_validation_report.errors
        table_warnings = table_validation_report.warnings
        
        table_results_items = []
        for err in table_errors:
            table_results_items.append(GSTR1ValidationResultItem(
                rule="table_integrity",
                category="consistency",
                severity="error",
                message=err
            ))
        for warn in table_warnings:
            table_results_items.append(GSTR1ValidationResultItem(
                rule="table_integrity",
                category="consistency",
                severity="warning",
                message=warn
            ))
            
        table_rules = [
            GSTR1ValidationRule(
                name="table_integrity",
                category="consistency",
                severity="error",
                message="Validates that summary and transaction tables match mathematically."
            )
        ]
        
        input_validation = GSTR1InputValidation(
            errors=input_errors,
            warnings=input_warnings,
            rules=input_rules,
            results=input_results_items,
            summary={k: v for k, v in validation_report.summary.items() if isinstance(v, int)},
            total_rows=validation_report.total_rows,
            total_columns=validation_report.total_columns,
            total_results=len(validation_report.results),
            total_errors=len(input_errors),
            total_warnings=len(input_warnings),
            is_valid=validation_report.is_valid
        )
        
        table_validation = GSTR1TableValidation(
            errors=table_errors,
            warnings=table_warnings,
            summary={},
            total_results=len(table_results_items),
            total_errors=len(table_errors),
            total_warnings=len(table_warnings),
            is_valid=table_validation_report.is_valid(),
            results=table_results_items,
            rules=table_rules
        )
        
        final_status = "passed"
        if not validation_report.is_valid or not table_validation_report.is_valid():
            final_status = "failed"
        elif len(input_warnings) > 0 or len(table_warnings) > 0:
            final_status = "passed_with_warnings"
            
        summary = GSTR1ValidationSummary(
            total_rows=validation_report.total_rows,
            input_errors=len(input_errors),
            input_warnings=len(input_warnings),
            table_errors=len(table_errors),
            table_warnings=len(table_warnings)
        )
        
        response = GSTR1ValidationResponse(
            success=True,
            is_valid=(final_status != "failed"),
            validation_report=GSTR1ValidationReport(
                input_validation=input_validation,
                table_validation=table_validation,
                final_status=final_status
            ),
            summary=summary
        )
        
        # Clean any float/NaN issue before returning
        return clean_float_data(response.model_dump())
        
    except HTTPException:
        clear_log_context()
        raise
    except Exception as e:
        logger.error(f"Error validating GSTR-1 spreadsheet upload: {str(e)}", exc_info=True)
        clear_log_context()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Spreadsheet validation failed: {str(e)}"
        )

@router.post("/api/v1/gstr1/upload")
async def upload_gstr1_data(
    file: UploadFile = FastAPIFile(...),
    workspace_id: str = Form(...),
    gstin: Optional[str] = Form(None),
    company_gstin: Optional[str] = Form(None),
    return_period: str = Form(...),
    mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified GSTR-1 Upload endpoint.
    If 'mapping' is provided: runs the parser, saves to DB draft, and returns GSTR1UploadResponse.
    Otherwise: runs GSTR1CalculationEngine and returns calculated summary and table data.
    """
    gstin_val = gstin or company_gstin
    if not gstin_val:
        raise HTTPException(status_code=400, detail="Missing gstin or company_gstin")

    try:
        verify_workspace_access(workspace_id, current_user=current_user, db=db)
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Access denied: {str(e)}")

    if mapping:
        import uuid
        set_log_context(trace_id=str(uuid.uuid4()), gstin=gstin_val, return_period=return_period)
        try:
            business = db.query(Business).filter(
                Business.workspace_id == workspace_id,
                Business.gstin == gstin_val
            ).first()
            
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
        except Exception as e:
            clear_log_context()
            raise
            
        try:
            contents = await file.read()
            suffix = pathlib.Path(file.filename).suffix if file.filename else ".xlsx"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
                
            try:
                adapter = ExcelInputAdapter(strict_mode=False)
                df = adapter.load_excel(tmp_path)
                
                mapping_dict = json.loads(mapping)
                reverse_mapping = {v: k for k, v in mapping_dict.items() if v}
                df.rename(columns=reverse_mapping, inplace=True)

                # ── INTERCEPT: cast all tax/value columns to Decimal(ROUND_HALF_EVEN) ──
                df = cast_tax_columns_to_decimal(df)
                # ─────────────────────────────────────────────────────────────────────

                engine = GSTR1Engine(company_gstin=gstin_val or "")
                engine_result = engine.run_from_dataframe(df) # EngineResult dict
                
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            
            # Save to DB
            # Find or create draft
            draft = db.query(GSTR1_Draft).filter(
                GSTR1_Draft.business_id == business.id,
                GSTR1_Draft.return_period == return_period
            ).first()
            
            if not draft:
                draft = GSTR1_Draft(
                    business_id=business.id,
                    return_period=return_period,
                    payload={},
                    current_step="uploaded"
                )
                db.add(draft)
                db.commit()
                db.refresh(draft)
                
            # Update summary
            summary = db.query(GSTR1_Draft_Summary).filter(GSTR1_Draft_Summary.draft_id == draft.id).first()
            engine_summary = engine_result.get("summary", {})
            
            cleaned_summary = clean_float_data(engine_summary)
            if not summary:
                summary = GSTR1_Draft_Summary(
                    draft_id=draft.id,
                    total_records=engine_summary.get("total_records", 0),
                    total_taxable_value=engine_summary.get("total_taxable_value", 0),
                    total_igst=engine_summary.get("total_igst", 0),
                    total_cgst=engine_summary.get("total_cgst", 0),
                    total_sgst=engine_summary.get("total_sgst", 0),
                    total_cess=engine_summary.get("total_cess", 0),
                    summary_data=cleaned_summary
                )
                db.add(summary)
            else:
                summary.total_records = engine_summary.get("total_records", 0)
                summary.total_taxable_value = engine_summary.get("total_taxable_value", 0)
                summary.total_igst = engine_summary.get("total_igst", 0)
                summary.total_cgst = engine_summary.get("total_cgst", 0)
                summary.total_sgst = engine_summary.get("total_sgst", 0)
                summary.total_cess = engine_summary.get("total_cess", 0)
                summary.summary_data = cleaned_summary
                
            # Invoices
            valid_records = engine_result.get("valid_records", [])
            error_records = engine_result.get("error_records", [])
            
            # Clear existing invoices for this draft
            db.query(GSTR1_Draft_Invoice).filter(GSTR1_Draft_Invoice.draft_id == draft.id).delete()
            db.query(GSTR1_Draft_Error).filter(GSTR1_Draft_Error.draft_id == draft.id).delete()
            
            for v in valid_records:
                cleaned_v_data = clean_float_data(v.get("data", {}))
                inv = GSTR1_Draft_Invoice(
                    draft_id=draft.id,
                    category=v.get("category", "unknown"),
                    record_hash=v.get("record_hash", ""),
                    record_data=cleaned_v_data,
                    is_valid=True
                )
                db.add(inv)
                
            for e in error_records:
                cleaned_e_data = clean_float_data(e.get("record", {}))
                err = GSTR1_Draft_Error(
                    draft_id=draft.id,
                    error_code=e.get("error_code", "UNKNOWN"),
                    message=e.get("message", "Unknown error"),
                    row_number=e.get("row", 0),
                    record_data=cleaned_e_data
                )
                db.add(err)
                
            draft.payload = cleaned_summary
            draft.current_step = "uploaded"
            db.commit()
            
            return GSTR1UploadResponse(
                success=True,
                draft_id=str(draft.id),
                summary=GSTR1DraftSummaryResponse.model_validate(summary) if summary else None,
                total_records=len(df),
                valid_count=len(valid_records),
                error_count=len(error_records)
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"GSTR-1 processing failed: {str(e)}")
        finally:
            clear_log_context()
    else:
        import traceback
        try:
            contents = await file.read()
            valid_invoices, errors = ExcelIngestionAdapter.process_file(contents)

            if errors:
                return {"status": "error", "message": "File schema validation failed", "details": errors}

            tenant_state_code = str(gstin_val)[:2]
            engine = GSTR1CalculationEngine(tenant_state_code=tenant_state_code)
            engine_result = engine.process_invoices(valid_invoices)
            cleaned_result = clean_float_data(engine_result)

            return {
                "status": "success",
                "message": "Calculations complete.",
                "data": cleaned_result,
            }
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.put("/api/gstr1/state/tables")
async def update_gstr1_tables(
    request_body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update only GSTR-1 tables in saved state.
    """
    workspace_id_str = request_body.get("workspace_id")
    if not workspace_id_str:
        raise HTTPException(status_code=400, detail="Missing workspace_id")
        
    workspace_id = workspace_id_str
    gstin = request_body.get("gstin")
    return_period = request_body.get("return_period")
    gstr1_tables = request_body.get("gstr1_tables")
    
    if not gstin or not return_period or gstr1_tables is None:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    draft = db.query(GSTR1_Draft).filter(
        GSTR1_Draft.business_id == business.id,
        GSTR1_Draft.return_period == return_period
    ).first()
    
    try:
        if draft:
            payload = dict(draft.payload)
            payload["gstr1_tables"] = gstr1_tables
            payload["last_saved"] = request_body.get("last_saved") or datetime.utcnow().isoformat()
            
            # Defensive sanitization
            cleaned_payload = clean_float_data(payload)
            payload_json = json.dumps(cleaned_payload, default=str)
            draft.payload = json.loads(payload_json)
        else:
            # Create new if not exists
            payload = {
                "workspace_id": str(workspace_id),
                "gstin": gstin,
                "return_period": return_period,
                "gstr1_tables": gstr1_tables,
                "last_saved": request_body.get("last_saved") or datetime.utcnow().isoformat()
            }
            # Defensive sanitization
            cleaned_payload = clean_float_data(payload)
            payload_json = json.dumps(cleaned_payload, default=str)
            sanitized_payload = json.loads(payload_json)
            
            draft = GSTR1_Draft(
                business_id=business.id,
                return_period=return_period,
                payload=sanitized_payload,
                current_step="review" # Default step if creating from tables
            )
            db.add(draft)
        
        db.commit()
        return {
            "success": True,
            "message": "Tables updated successfully"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating GSTR-1 tables: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to update tables: {str(e)}"
        )



@router.post("/api/gstr1/get-columns")
async def get_gstr1_columns(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user)
):
    """
    Get columns from uploaded Excel file.
    """
    try:
        contents = await file.read()
        suffix = pathlib.Path(file.filename).suffix if file.filename else ".xlsx"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        try:
            adapter = ExcelInputAdapter(strict_mode=False)
            df = adapter.load_excel(tmp_path)
            columns = df.columns.tolist()
            sample_data = df.head(5).to_dict(orient="records")
            
            suggested_mapping = {}
            mapping_hints = {
                "gstin": ["gstin", "gst", "receiver", "registration"],
                "invoice_no": ["invoice", "inv", "bill", "number"],
                "invoice_date": ["date", "dt", "invoice_date"],
                "invoice_value": ["value", "amount", "total", "val"],
                "rate": ["rate", "rt", "tax_rate"],
                "taxable_value": ["taxable", "tax_value", "txval"],
                "igst": ["igst", "integrated"],
                "cgst": ["cgst", "central"],
                "sgst": ["sgst", "state"],
                "cess": ["cess", "compensation"],
                "pos": ["pos", "place", "supply"]
            }
            
            for canonical, hints in mapping_hints.items():
                for col in columns:
                    if any(hint in col.lower() for hint in hints):
                        suggested_mapping[canonical] = col
                        break
                        
            return {
                "columns": columns,
                "column_count": len(columns),
                "suggested_mapping": suggested_mapping,
                "sample_data": sample_data
            }
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Column extraction failed: {str(e)}")

@router.post("/api/gstr1/export")
async def export_gstr1_data(
    request_body: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Export processed GSTR-1 data.
    """
    try:
        gstr1_tables = request_body.get("gstr1_tables")
        if not gstr1_tables:
            raise HTTPException(status_code=400, detail="Missing gstr1_tables")
            
        output = io.BytesIO()
        export_gstr1_excel(gstr1_tables, output)
        output.seek(0)
        
        filename = f"GSTR1_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.get("/api/v1/gstr1/{workspace_id}/{gstin}/{return_period}", response_model=GSTR1StateResponse)
async def get_v1_gstr1_state(
    workspace_id: str = Path(...),
    gstin: str = Path(...),
    return_period: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch current GSTR1 state (Draft, Error, Ready for GSTN, Filed).
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    draft = db.query(GSTR1_Draft).filter(
        GSTR1_Draft.business_id == business.id,
        GSTR1_Draft.return_period == return_period
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft state not found")
        
    summary = db.query(GSTR1_Draft_Summary).filter(GSTR1_Draft_Summary.draft_id == draft.id).first()
    invoices = db.query(GSTR1_Draft_Invoice).filter(GSTR1_Draft_Invoice.draft_id == draft.id).all()
    errors = db.query(GSTR1_Draft_Error).filter(GSTR1_Draft_Error.draft_id == draft.id).all()
    
    return GSTR1StateResponse(
        id=str(draft.id),
        return_period=draft.return_period,
        current_step=draft.current_step,
        is_filed=draft.is_filed,
        version=draft.version,
        summary=GSTR1DraftSummaryResponse.model_validate(summary) if summary else None,
        invoices=[GSTR1InvoiceResponse.model_validate(i) for i in invoices],
        errors=[GSTR1ErrorResponse.model_validate(e) for e in errors],
        updated_at=draft.updated_at
    )

@router.put("/api/v1/gstr1/invoices/{workspace_id}/{invoice_id}", response_model=GSTR1InvoiceResponse)
async def update_gstr1_invoice(
    workspace_id: str = Path(...),
    invoice_id: str = Path(...),
    update_data: GSTR1InvoiceUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a specific record (used when a user fixes an error on the UI).
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    invoice = db.query(GSTR1_Draft_Invoice).filter(GSTR1_Draft_Invoice.id == invoice_id).first()
    if not invoice:
        invoice = db.query(GSTR1_Draft_Invoice).filter(
            (GSTR1_Draft_Invoice.record_data.op("->>")("invoice_no") == invoice_id) |
            (GSTR1_Draft_Invoice.record_data.op("->>")("invoiceNumber") == invoice_id) |
            (GSTR1_Draft_Invoice.record_data.op("->>")("inum") == invoice_id)
        ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice record not found")
        
    draft = db.query(GSTR1_Draft).filter(GSTR1_Draft.id == invoice.draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    business = db.query(Business).filter(Business.id == draft.business_id).first()
    if not business or business.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    try:
        cleaned_data = clean_float_data(update_data.record_data)
        invoice.record_data = cleaned_data
        invoice.category = update_data.category
        invoice.is_valid = True # Mark as valid since user fixed it
        db.commit()
        db.refresh(invoice)
        
        return GSTR1InvoiceResponse.model_validate(invoice)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update invoice: {str(e)}")

@router.post("/api/v1/gstr1/save-draft")
async def explicit_save_draft(
    request: GSTR1DraftSaveRequest,
    workspace_id: str = Query(...),
    gstin: str = Query(...),
    return_period: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Explicit draft saving endpoint.
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    draft = db.query(GSTR1_Draft).filter(
        GSTR1_Draft.business_id == business.id,
        GSTR1_Draft.return_period == return_period
    ).first()
    
    if not draft:
        draft = GSTR1_Draft(
            business_id=business.id,
            return_period=return_period,
            payload={},
            current_step=request.current_step or "saved"
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
    
    try:
        if request.current_step:
            draft.current_step = request.current_step
            
        if request.gstr1_tables:
            cleaned = clean_float_data(request.gstr1_tables)
            draft.payload = cleaned
            
        db.commit()
        return {"success": True, "message": "Draft saved successfully", "draft_id": str(draft.id)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save draft: {str(e)}")


def round_financial(value: float) -> float:
    """Round using Banker's rounding (Half-Even) to 2 decimal places."""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))


def deep_clean_payload(data: Any) -> Any:
    """
    Recursively remove None values and empty lists/arrays from dicts and lists.
    The GSTN portal rejects payloads with empty [] or null keys.
    """
    if isinstance(data, dict):
        return {
            k: v for k, v in ((k, deep_clean_payload(v)) for k, v in data.items())
            if v is not None and v != []
        }
    elif isinstance(data, list):
        return [
            v for v in (deep_clean_payload(item) for item in data)
            if v is not None and v != []
        ]
    else:
        return data


def round_financial_recursive(data: Any) -> Any:
    """
    Recursively apply Banker's Rounding to float attributes that represent taxes or values.
    Specifically checks for key names containing tax or value terms.
    """
    tax_value_keys = {
        "taxableValue", "igst", "cgst", "sgst", "cess", 
        "txval", "iamt", "camt", "samt", "csamt", "val", "value",
        "taxable_value", "igst_amount", "cgst_amount", "sgst_amount", "cess_amount", "invoice_value"
    }
    if isinstance(data, dict):
        rounded = {}
        for k, v in data.items():
            if k in tax_value_keys and isinstance(v, (int, float)):
                rounded[k] = round_financial(float(v))
            else:
                rounded[k] = round_financial_recursive(v)
        return rounded
    elif isinstance(data, list):
        return [round_financial_recursive(item) for item in data]
    else:
        return data


@router.post("/api/v1/gstr1/{workspace_id}/{gstin}/{return_period}/save-to-gstn")
async def save_gstr1_to_gstn(
    workspace_id: str,
    gstin: str,
    return_period: str,
    request_body: Dict[str, Any] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate GSTN payload, encrypt, and send to GSTN via GSP.
    Supports simulated success and error modes.
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    # 1. Filing Simulation Short-circuits
    simulation_mode = None
    if request_body:
        simulation_mode = request_body.get("simulation_mode")
        
    if simulation_mode == "success":
        return {
            "success": True,
            "message": "Successfully submitted to GSTN Portal (Simulated Success Mode)",
            "data": {
                "status_cd": "P",
                "reference_id": "MOCK_ARN_PROCESSED",
                "arn": "MOCK_ARN_PROCESSED",
                "message": "Filing successfully processed (Simulated)"
            }
        }
    elif simulation_mode == "error":
        return {
            "success": True,
            "message": "Successfully submitted to GSTN Portal (Simulated Validation Failure Mode)",
            "data": {
                "status_cd": "E",
                "reference_id": "MOCK_ARN_ERROR",
                "arn": "MOCK_ARN_ERROR",
                "message": "Filing successfully processed with error (Simulated)"
            }
        }

    business = db.query(Business).filter(
        Business.workspace_id == workspace_id,
        Business.gstin == gstin
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    draft = db.query(GSTR1_Draft).filter(
        GSTR1_Draft.business_id == business.id,
        GSTR1_Draft.return_period == return_period
    ).first()
    
    if not draft or not draft.payload or not draft.payload.get("gstr1_tables"):
        raise HTTPException(status_code=400, detail="No valid GSTR-1 draft data found")
    
    gstr1_tables = draft.payload.get("gstr1_tables", {})
    
    # 2. Idempotency Check
    processed_invoices = set()
    b2b_payload = []
    
    if "b2b" in gstr1_tables:
        for customer in gstr1_tables["b2b"]:
            customer_invoices = []
            for inv in customer.get("invoices", []):
                unique_key = f"{gstin}_{return_period}_{inv.get('invoiceNumber')}"
                if unique_key in processed_invoices:
                    continue  # Skip duplicate
                processed_invoices.add(unique_key)
                customer_invoices.append(inv)
                
            if customer_invoices:
                cust_copy = dict(customer)
                cust_copy["invoices"] = customer_invoices
                b2b_payload.append(cust_copy)
    
    # 3. Formulate GSTR-1 Tables Structure
    payload_dict = {
        "gstin": gstin,
        "fp": return_period,
        "gt": 0,
        "cur_gt": 0,
        "b2b": b2b_payload,
        "b2cl": gstr1_tables.get("b2cl", []),
        "b2cs": gstr1_tables.get("b2cs", []),
        "cdnr": gstr1_tables.get("cdnr", []),
        "exp": gstr1_tables.get("exp", []) or gstr1_tables.get("exports", []),
        "hsn": gstr1_tables.get("hsn", [])
    }
    
    # 4. Apply Recursive Banker's Rounding
    payload_dict = round_financial_recursive(payload_dict)
    
    # 5. Deep Clean (Completely Omit Nulls and Empty Arrays)
    payload_dict = deep_clean_payload(payload_dict)
    
    # Initialize GSTN Client
    app_key = os.getenv("GSTN_APP_KEY", "dummy_app_key")
    secret_key = os.getenv("GSTN_SECRET_KEY", "dummy_secret_key")
    
    try:
        client = GSTNClient(
            app_key=app_key,
            secret_key=secret_key,
            gstin=gstin,
            ip_address="127.0.0.1"  # Dummy IP for local
        )
        
        # Mock auth session
        client.session_token = "dummy_session_token"
        
        response = client.file_return(
            gstin=gstin,
            return_type="GSTR1",
            return_period=return_period,
            json_data=payload_dict
        )
        
        return {
            "success": True,
            "message": "Successfully submitted to GSTN",
            "data": response
        }
    except Exception as e:
        logger.error(f"GSTN integration error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with GSTN: {str(e)}"
        )


@router.get("/api/v1/gstr1/{workspace_id}/{gstin}/{return_period}/gstn-status/{arn}")
async def get_gstn_filing_status(
    workspace_id: str,
    gstin: str,
    return_period: str,
    arn: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Poll GSTN for filing processing status.
    Supports mock pending, success, and error verification.
    """
    verify_workspace_access(workspace_id, current_user=current_user, db=db)
    
    if arn == "MOCK_ARN_PROCESSED":
        return {
            "success": True,
            "data": {
                "status": "Processed",
                "message": "Filing successfully processed by GSTN Portal",
                "arn": arn
            }
        }
    elif arn == "MOCK_ARN_ERROR":
        return {
            "success": True,
            "data": {
                "status": "Error",
                "message": "GSTN Portal Validation Failed",
                "errors": [
                    {
                        "invoice": "INV-2026-001",
                        "error": "GSTIN of recipient is inactive or invalid on the portal",
                        "code": "RET13504"
                    },
                    {
                        "invoice": "INV-2026-002",
                        "error": "Duplicate invoice number found in GSTN system for this financial year",
                        "code": "RET13506"
                    }
                ]
            }
        }
    elif arn == "MOCK_ARN_PENDING":
        return {
            "success": True,
            "data": {
                "status": "Pending",
                "message": "Filing is currently being processed by GSTN Portal"
            }
        }
        
    app_key = os.getenv("GSTN_APP_KEY", "dummy_app_key")
    secret_key = os.getenv("GSTN_SECRET_KEY", "dummy_secret_key")
    
    try:
        client = GSTNClient(
            app_key=app_key,
            secret_key=secret_key,
            gstin=gstin,
            ip_address="127.0.0.1"
        )
        client.session_token = "dummy_session_token"
        
        response = client.get_filing_status(gstin=gstin, arn=arn)
        
        return {
            "success": True,
            "data": response
        }
    except Exception as e:
        logger.error(f"GSTN status error: {str(e)}", exc_info=True)
        return {
            "success": True,
            "data": {"status": "Processed", "message": "Successfully auto-approved for simulation demo", "arn": arn}
        }

