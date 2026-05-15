from typing import List, Dict, Any, Optional
# UUID imports removed - using str
from fastapi import APIRouter, Depends, status, HTTPException, Path, Query, Body, UploadFile, File as FastAPIFile, Form
from sqlalchemy.orm import Session
from datetime import datetime
import json
import io
import tempfile
import os
from pathlib import Path

from database import get_db
from api.dependencies import get_current_user, verify_workspace_access
from models.tenant_models import Business, User
from models.gst_models import GSTR1_Draft
from india_compliance.gst_india.engine_core.engine import GSTR1Engine
from india_compliance.gst_india.engine_core.input_adapter import ExcelInputAdapter
from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel

router = APIRouter(tags=["GSTR-1"])

@router.get("/api/gstr1/state")
async def get_gstr1_state(
    workspace_id: str = Query(...),
    gstin: str = Query(...),
    return_period: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get saved GSTR-1 workflow state from database.
    """
    await verify_workspace_access(workspace_id, db, current_user)
    
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
        return {"success": False, "message": "No saved state found"}
    
    return {
        "success": True,
        "data": {
            **draft.payload,
            "id": str(draft.id),
            "last_saved": draft.updated_at.isoformat()
        }
    }

@router.post("/api/gstr1/state")
async def save_gstr1_state(
    request_body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save GSTR-1 workflow state to database.
    """
    workspace_id_str = request_body.get("workspace_id")
    if not workspace_id_str:
        raise HTTPException(status_code=400, detail="Missing workspace_id")
    
    workspace_id = workspace_id_str
    gstin = request_body.get("gstin")
    return_period = request_body.get("return_period")
    
    if not gstin or not return_period:
        raise HTTPException(status_code=400, detail="Missing gstin or return_period")
        
    await verify_workspace_access(workspace_id, db, current_user)
    
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
    
    current_step = request_body.get("current_step") or request_body.get("currentStep")
    
    if draft:
        draft.payload = request_body
        draft.current_step = current_step
        draft.updated_at = datetime.utcnow()
    else:
        draft = GSTR1_Draft(
            business_id=business.id,
            return_period=return_period,
            payload=request_body,
            current_step=current_step
        )
        db.add(draft)
    
    db.commit()
    return {
        "success": True,
        "message": "State saved successfully"
    }

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
        
    await verify_workspace_access(workspace_id, db, current_user)
    
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
    
    if draft:
        payload = dict(draft.payload)
        payload["gstr1_tables"] = gstr1_tables
        payload["last_saved"] = request_body.get("last_saved") or datetime.utcnow().isoformat()
        draft.payload = payload
        draft.updated_at = datetime.utcnow()
    else:
        # Create new if not exists
        payload = {
            "workspace_id": str(workspace_id),
            "gstin": gstin,
            "return_period": return_period,
            "gstr1_tables": gstr1_tables,
            "last_saved": request_body.get("last_saved") or datetime.utcnow().isoformat()
        }
        draft = GSTR1_Draft(
            business_id=business.id,
            return_period=return_period,
            payload=payload,
            current_step="review" # Default step if creating from tables
        )
        db.add(draft)
    
    db.commit()
    return {
        "success": True,
        "message": "Tables updated successfully"
    }

@router.post("/api/gstr1/process")
async def process_gstr1(
    file: UploadFile = FastAPIFile(...),
    mapping: str = Form(...),
    workspace_id: str = Form(...),
    company_gstin: str = Form(...),
    return_period: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process Excel file for GSTR-1 generation.
    """
    await verify_workspace_access(workspace_id, db, current_user)
    
    try:
        # Step 1: Read Excel file
        contents = await file.read()
        suffix = Path(file.filename).suffix if file.filename else ".xlsx"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        try:
            adapter = ExcelInputAdapter(strict_mode=False)
            df = adapter.load_excel(tmp_path)
            
            # Step 2: Apply mapping
            mapping_dict = json.loads(mapping)
            reverse_mapping = {v: k for k, v in mapping_dict.items() if v}
            df.rename(columns=reverse_mapping, inplace=True)
            
            # Step 3: Run full GSTR1Engine pipeline
            engine = GSTR1Engine(company_gstin=company_gstin or "")
            gstr1_data = engine.run_from_dataframe(df)
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        
        # Extract validation reports
        input_validation_report = gstr1_data.pop("input_validation_report", {})
        table_validation_report = gstr1_data.pop("validation_report", {})
        
        all_errors = (
            input_validation_report.get("errors", []) + 
            table_validation_report.get("errors", [])
        )
        all_warnings = (
            input_validation_report.get("warnings", []) + 
            table_validation_report.get("warnings", [])
        )
        
        validation_report = {
            "errors": all_errors,
            "warnings": all_warnings,
            "final_status": "valid" if not all_errors else "invalid"
        }
        
        return {
            "success": True,
            "data": {
                "summary": gstr1_data.get("summary", {}),
                "b2b": gstr1_data.get("b2b", []),
                "b2cl": gstr1_data.get("b2cl", []),
                "b2cs": gstr1_data.get("b2cs", []),
                "exp": gstr1_data.get("exp", []),
                "cdnr": gstr1_data.get("cdnr", []),
                "cdnur": gstr1_data.get("cdnur", []),
                "hsn": gstr1_data.get("hsn", []),
            },
            "validation_report": validation_report,
            "total_records": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GSTR-1 processing failed: {str(e)}")

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
        suffix = Path(file.filename).suffix if file.filename else ".xlsx"
        
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
