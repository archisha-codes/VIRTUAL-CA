"""
FastAPI endpoint for uploading and processing GSTR-1 Excel files.

This module provides endpoints for uploading and validating GSTR-1 Excel files
with structured error reporting and logging.
"""

import logging
import traceback
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from india_compliance.gst_india.utils.gstr1.gstr1_validations import (
    validate_gstr1_row,
    validate_gstr1_data,
)


# Set up logger for this module
logger = logging.getLogger("gstr_upload")
logger.setLevel(logging.DEBUG)


# Create router
router = APIRouter()


def determine_section(row: Dict[str, Any]) -> str:
    """
    Determine the GSTR-1 section based on row data.
    
    Args:
        row: Row data from Excel
        
    Returns:
        Section name: 'b2b', 'b2cl', 'b2cs', 'export', 'cdnr', or 'cdnur'
    """
    # Check for explicit section indicator
    if "section" in row:
        section = str(row["section"]).lower()
        if section in ["b2b", "b2cl", "b2cs", "export", "cdnr", "cdnur"]:
            return section
    
    # Infer section from data
    gstin = row.get("gstin") or row.get("recipient_gstin") or row.get("buyer_gstin")
    place_of_supply = row.get("place_of_supply", "")
    invoice_type = row.get("invoice_type", "").lower()
    note_type = row.get("note_type", "").lower() if row.get("note_type") else ""
    
    # Check for credit/debit notes first
    if note_type in ["credit note", "debit note", "c", "d", "cn", "dn"]:
        if gstin:
            return "cdnr"  # Registered
        else:
            return "cdnur"  # Unregistered
    
    # Check for exports
    if place_of_supply and "96" in str(place_of_supply):
        return "export"
    
    # Check for B2B (has GSTIN and not export)
    if gstin:
        return "b2b"
    
    # Check for invoice type indicator
    if "invoice_type" in row:
        if "b2cl" in invoice_type or "large" in invoice_type:
            return "b2cl"
        elif "b2cs" in invoice_type or "small" in invoice_type:
            return "b2cs"
    
    # Default to B2CS for supplies without GSTIN
    return "b2cs"


def process_excel_file(file: UploadFile) -> List[Dict[str, Any]]:
    """
    Process uploaded Excel file and convert to list of dictionaries.
    
    Args:
        file: Uploaded Excel file
        
    Returns:
        List of row dictionaries
        
    Raises:
        Exception: If file reading fails
    """
    logger.info(f"Processing Excel file: {file.filename}")
    
    try:
        # Read Excel file
        df = pd.read_excel(file.file)
        logger.info(f"Read {len(df)} rows from Excel file")
        
        # Clean column names (strip whitespace, lowercase)
        df.columns = [str(col).strip() for col in df.columns]
        
        # Convert to records
        records = df.to_dict(orient="records")
        logger.debug(f"Converted {len(records)} rows to dictionaries")
        
        return records
    
    except Exception as e:
        logger.error(f"Failed to process Excel file: {str(e)}")
        raise


def validate_row(
    row: Dict[str, Any],
    row_number: int,
    section: str,
    company_gstin: str = ""
) -> List[Dict[str, Any]]:
    """
    Validate a single row and return errors if any.
    
    Args:
        row: Row data
        row_number: Row number (1-indexed, including header)
        section: GSTR-1 section
        company_gstin: Company GSTIN
        
    Returns:
        List of error dictionaries
    """
    return validate_gstr1_row(row, row_number, section, company_gstin)


@router.post("/upload-sales-excel")
async def upload_sales_excel(
    file: UploadFile = File(...),
    company_gstin: Optional[str] = None,
    return_period: Optional[str] = None,
) -> JSONResponse:
    """
    Upload and process GSTR-1 sales Excel file.
    
    This endpoint:
    1. Reads the uploaded Excel file
    2. Validates each row independently
    3. Returns structured errors if any validation fails
    4. Returns summary on success
    
    Args:
        file: Excel file upload (.xlsx or .xls)
        company_gstin: Company's GSTIN (optional)
        return_period: Return period in MM/YYYY format (optional)
        
    Returns:
        - 400: If validation errors exist, returns {"errors": [...]}]
        - 200: If successful, returns summary
        
    Error Format:
        {
            "errors": [
                {"row": 2, "field": "taxable_value", "error": "Missing taxable value"},
                {"row": 5, "field": "gst_rate", "error": "Invalid GST rate"}
            ]
        }
        
    Success Format:
        {
            "message": "File processed successfully",
            "summary": {
                "total_rows": 100,
                "valid_rows": 98,
                "error_count": 2,
                "sections": {
                    "b2b": 50,
                    "b2cl": 10,
                    "b2cs": 35,
                    "export": 5
                }
            }
        }
    """
    logger.info(f"Received file upload request: {file.filename}")
    
    # Validate file extension
    filename = file.filename.lower()
    if not filename.endswith(('.xlsx', '.xls')):
        logger.warning(f"Invalid file format uploaded: {file.filename}")
        raise HTTPException(
            status_code=400,
            detail={"errors": [{
                "row": 0,
                "field": "file",
                "error": "Invalid file format. Only .xlsx and .xls files are supported"
            }]}
        )
    
    try:
        # Process Excel file
        rows = process_excel_file(file)
        
    except Exception as e:
        logger.error(f"Failed to process Excel file: {str(e)}")
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=400,
            detail={"errors": [{
                "row": 0,
                "field": "file",
                "error": f"Failed to read Excel file: {str(e)}"
            }]}
        )
    
    # Validate each row independently
    all_errors: List[Dict[str, Any]] = []
    section_counts: Dict[str, int] = {}
    skipped_rows = 0
    
    logger.info(f"Validating {len(rows)} rows...")
    
    # Start from row 2 (row 1 is header)
    for row_index, row in enumerate(rows):
        row_number = row_index + 2  # Account for header row
        
        # Clean row data - remove NaN values
        cleaned_row = {k: v for k, v in row.items() if pd.notna(v)}
        
        # Skip empty rows
        if not cleaned_row:
            logger.debug(f"Skipping empty row {row_number}")
            skipped_rows += 1
            continue
        
        # Determine section for this row
        section = determine_section(cleaned_row)
        
        # Track section counts
        section_counts[section] = section_counts.get(section, 0) + 1
        
        # Validate row
        errors = validate_row(cleaned_row, row_number, section, company_gstin or "")
        all_errors.extend(errors)
    
    logger.info(f"Validation complete: {len(rows)} rows processed, {skipped_rows} skipped, {len(all_errors)} errors found")
    
    # Return errors if any exist
    if all_errors:
        # Sort errors by row number
        all_errors.sort(key=lambda x: x.get("row", 0))
        
        # Limit errors to first 100 to avoid large responses
        if len(all_errors) > 100:
            logger.warning(f"Truncating errors from {len(all_errors)} to 100")
            all_errors = all_errors[:100]
            all_errors.append({
                "row": "...",
                "field": "summary",
                "error": f"Additional validation errors truncated. Please fix the first 100 and re-upload."
            })
        
        # Log validation failures
        for error in all_errors[:10]:  # Log first 10 errors
            logger.warning(f"Validation error at row {error['row']}: {error['field']} - {error['error']}")
        
        return JSONResponse(
            status_code=400,
            content={"errors": all_errors}
        )
    
    # Return success with summary
    valid_rows = len(rows) - skipped_rows
    
    logger.info(f"File processed successfully: {valid_rows} valid rows")
    
    return JSONResponse(
        status_code=200,
        content={
            "message": "File processed successfully",
            "summary": {
                "total_rows": len(rows),
                "valid_rows": valid_rows,
                "error_count": len(all_errors),
                "sections": section_counts,
                "return_period": return_period,
                "company_gstin": company_gstin,
            }
        }
    )


@router.post("/upload-validate-only")
async def upload_validate_only(
    file: UploadFile = File(...),
    company_gstin: Optional[str] = None,
) -> JSONResponse:
    """
    Upload and validate GSTR-1 Excel file without processing.
    
    Similar to /upload-sales-excel but only returns validation errors.
    Does not return success summary.
    
    Args:
        file: Excel file upload
        company_gstin: Company's GSTIN (optional)
        
    Returns:
        - 400: With {"errors": [...]} if validation fails
        - 200: {"message": "All rows valid"} if no errors
    """
    logger.info(f"Received validation-only request: {file.filename}")
    
    # Validate file extension
    filename = file.filename.lower()
    if not filename.endswith(('.xlsx', '.xls')):
        logger.warning(f"Invalid file format: {file.filename}")
        raise HTTPException(
            status_code=400,
            detail={"errors": [{
                "row": 0,
                "field": "file",
                "error": "Invalid file format"
            }]}
        )
    
    try:
        rows = process_excel_file(file)
    except Exception as e:
        logger.error(f"Failed to process file: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={"errors": [{
                "row": 0,
                "field": "file",
                "error": str(e)
            }]}
        )
    
    all_errors: List[Dict[str, Any]] = []
    
    for row_index, row in enumerate(rows):
        row_number = row_index + 2
        cleaned_row = {k: v for k, v in row.items() if pd.notna(v)}
        
        if not cleaned_row:
            continue
        
        section = determine_section(cleaned_row)
        errors = validate_row(cleaned_row, row_number, section, company_gstin or "")
        all_errors.extend(errors)
    
    if all_errors:
        all_errors.sort(key=lambda x: x.get("row", 0))
        logger.warning(f"Validation failed: {len(all_errors)} errors found")
        return JSONResponse(
            status_code=400,
            content={"errors": all_errors}
        )
    
    logger.info(f"Validation passed: {len(rows)} rows valid")
    
    return JSONResponse(
        status_code=200,
        content={"message": "All rows valid", "total_rows": len(rows)}
    )


@router.post("/validate-rows")
async def validate_rows(
    rows: List[Dict[str, Any]],
    company_gstin: Optional[str] = None,
    section_hint: Optional[str] = None,
) -> JSONResponse:
    """
    Validate a list of row data without file upload.
    
    Useful for previewing validation before full upload.
    
    Args:
        rows: List of row dictionaries
        company_gstin: Company's GSTIN (optional)
        section_hint: Suggested section for all rows (optional)
        
    Returns:
        Validation errors or success message
    """
    logger.info(f"Validating {len(rows)} rows (direct input)")
    
    all_errors: List[Dict[str, Any]] = []
    
    for row_index, row in enumerate(rows):
        row_number = row_index + 1
        section = section_hint or determine_section(row)
        errors = validate_row(row, row_number, section, company_gstin or "")
        all_errors.extend(errors)
    
    if all_errors:
        all_errors.sort(key=lambda x: x.get("row", 0))
        logger.warning(f"Validation failed: {len(all_errors)} errors found")
        return JSONResponse(
            status_code=400,
            content={"errors": all_errors}
        )
    
    logger.info(f"Validation passed: {len(rows)} rows valid")
    
    return JSONResponse(
        status_code=200,
        content={"message": "All rows valid", "total_rows": len(rows)}
    )
