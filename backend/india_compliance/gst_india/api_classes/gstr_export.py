"""
FastAPI routes for GSTR-1 JSON and GSTR-3B Excel file downloads.
"""

import json
import io
import xlsxwriter
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from india_compliance.gst_india.utils.gstr3b.gstr3b_data import generate_gstr3b_summary


# Create router
router = APIRouter()


def get_filename(prefix: str, gstin: str, return_period: str, extension: str) -> str:
    """
    Generate a filename for the download.
    
    Format: GSTR-{type}_{gstin}_{return_period}_{timestamp}.{extension}
    
    Example: GSTR-1_07AAAAA1234A1ZA_032024_20240315.xlsx
    """
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"{prefix}_{gstin}_{return_period}_{timestamp}.{extension}"


# =============================================================================
# /download-gstr1-json Endpoint
# =============================================================================

@router.get("/download-gstr1-json")
async def download_gstr1_json(
    gstin: str = Query(..., description="GSTIN of the taxpayer"),
    return_period: str = Query(..., description="Return period in MM/YYYY format"),
    return_format: str = Query("json", description="Output format (json or json_download)"),
) -> StreamingResponse:
    """
    Download GSTR-1 data as a JSON file.
    
    This endpoint generates and returns a JSON file containing GSTR-1 data
    formatted according to the GST Portal specifications.
    
    Query Parameters:
        - gstin: 15-character GSTIN
        - return_period: Return period in MM/YYYY format (e.g., "03/2024")
        - return_format: Output format (json/json_download)
    
    Returns:
        StreamingResponse with JSON file download
        
    Headers:
        - Content-Type: application/json
        - Content-Disposition: attachment; filename="GSTR-1_{gstin}_{return_period}.json"
    
    Example:
        GET /download-gstr1-json?gstin=07AAAAA1234A1ZA&return_period=03/2024
    """
    # Validate GSTIN format
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN: must be 15 characters")
    
    # Validate return period format
    try:
        month, year = return_period.split('/')
        int(month)
        int(year)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid return period: must be in MM/YYYY format"
        )
    
    # =====================================================================
    # TODO: Replace with actual GSTR-1 data fetching logic
    # The following is placeholder data - replace with actual data retrieval
    # =====================================================================
    gstr1_data = {
        "gstin": gstin,
        "fp": return_period,
        "gt": 0.0,
        "cur_gt": 0.0,
        "b2b": [],
        "b2cl": [],
        "b2cs": [],
        "export": [],
        "cdnr": [],
        "cdnur": [],
        "nil_exempt": [],
        "hsn_summary": [],
    }
    
    # Generate JSON string
    json_str = json.dumps(gstr1_data, indent=2)
    
    # Create file-like object in memory
    file_obj = io.BytesIO(json_str.encode('utf-8'))
    
    # Generate filename
    filename = get_filename("GSTR-1", gstin, return_period.replace('/', ''), "json")
    
    # Create streaming response
    response = StreamingResponse(
        iter([file_obj.getvalue()]),
        media_type="application/json"
    )
    
    # Set headers for file download
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.headers["Content-Length"] = str(len(json_str))
    
    return response


# =============================================================================
# /download-gstr3b-excel Endpoint
# =============================================================================

@router.get("/download-gstr3b-excel")
async def download_gstr3b_excel(
    gstin: str = Query(..., description="GSTIN of the taxpayer"),
    return_period: str = Query(..., description="Return period in MM/YYYY format"),
    company_gstin: Optional[str] = Query(None, description="Company GSTIN for inter-state determination"),
) -> StreamingResponse:
    """
    Download GSTR-3B summary as an Excel file.
    
    This endpoint generates and returns an Excel file containing the GSTR-3B
    summary with all sections and tax breakdowns.
    
    Query Parameters:
        - gstin: 15-character GSTIN
        - return_period: Return period in MM/YYYY format (e.g., "03/2024")
        - company_gstin: Company's GSTIN (optional, uses gstin if not provided)
    
    Returns:
        StreamingResponse with Excel file download
        
    Headers:
        - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        - Content-Disposition: attachment; filename="GSTR-3B_{gstin}_{return_period}.xlsx"
    
    Example:
        GET /download-gstr3b-excel?gstin=07AAAAA1234A1ZA&return_period=03/2024
    """
    # Validate GSTIN format
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN: must be 15 characters")
    
    # Validate return period format
    try:
        month, year = return_period.split('/')
        int(month)
        int(year)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid return period: must be in MM/YYYY format"
        )
    
    # Use company_gstin if provided, otherwise use gstin
    if company_gstin is None:
        company_gstin = gstin
    
    # =====================================================================
    # Generate GSTR-3B Summary
    # TODO: Replace with actual GSTR-1 data fetching logic
    # The following is placeholder data - replace with actual data retrieval
    # =====================================================================
    gstr1_data = {
        "b2b": [
            {
                "place_of_supply": "07-Delhi",
                "reverse_charge": False,
                "items": [
                    {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                ]
            },
            {
                "place_of_supply": "27-Maharashtra",
                "reverse_charge": False,
                "items": [
                    {"taxable_value": 200000, "igst_amount": 36000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                ]
            },
        ],
        "b2cl": [
            {
                "place_of_supply": "27-Maharashtra",
                "items": [
                    {"taxable_value": 300000, "igst_amount": 54000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                ]
            }
        ],
        "b2cs": [
            {
                "place_of_supply": "07-Delhi",
                "items": [
                    {"taxable_value": 50000, "igst_amount": 0, "cgst_amount": 4500, "sgst_amount": 4500, "cess_amount": 0}
                ]
            },
            {
                "place_of_supply": "27-Maharashtra",
                "items": [
                    {"taxable_value": 30000, "igst_amount": 5400, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                ]
            }
        ],
        "export": [
            {
                "place_of_supply": "96-Other Countries",
                "items": [
                    {"taxable_value": 150000, "igst_amount": 27000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                ]
            }
        ],
        "cdnr": [
            {
                "place_of_supply": "07-Delhi",
                "items": [
                    {"taxable_value": 5000, "igst_amount": 0, "cgst_amount": 450, "sgst_amount": 450, "cess_amount": 0}
                ]
            }
        ],
        "cdnur": [
            {
                "place_of_supply": "27-Maharashtra",
                "items": [
                    {"taxable_value": 2500, "igst_amount": 450, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                ]
            }
        ],
    }
    
    # Generate GSTR-3B summary from GSTR-1 data
    summary = generate_gstr3b_summary(gstr1_data, company_gstin)
    
    # Create Excel file in memory
    output = io.BytesIO()
    
    # Create workbook and worksheet
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("GSTR-3B Summary")
    
    # Define formats
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#4472C4',
        'font_color': 'white',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
    })
    
    section_header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#ED7D31',
        'font_color': 'white',
        'border': 1,
        'align': 'left',
    })
    
    number_format = workbook.add_format({
        'border': 1,
        'num_format': '#,##0.00',
        'align': 'right',
    })
    
    text_format = workbook.add_format({
        'border': 1,
        'align': 'left',
    })
    
    # Set column widths
    worksheet.set_column('A:A', 35)  # Description
    worksheet.set_column('B:F', 15)  # Amount columns
    
    # Write title
    title_format = workbook.add_format({
        'bold': True,
        'font_size': 16,
        'align': 'center',
        'font_color': '#4472C4',
    })
    worksheet.merge_range('A1:F1', f'GSTR-3B Summary - {return_period}', title_format)
    
    # Write GSTIN info
    worksheet.merge_range('A2:F2', f'GSTIN: {gstin}', text_format)
    
    # Write section headers
    row = 4
    worksheet.write(row, 0, 'Section', section_header_format)
    worksheet.write(row, 1, 'Taxable Value', section_header_format)
    worksheet.write(row, 2, 'IGST', section_header_format)
    worksheet.write(row, 3, 'CGST', section_header_format)
    worksheet.write(row, 4, 'SGST', section_header_format)
    worksheet.write(row, 5, 'CESS', section_header_format)
    row += 1
    
    # Write section data
    for section_key, section_data in summary.items():
        description = section_data.get('description', section_key)
        worksheet.write(row, 0, description, text_format)
        worksheet.write(row, 1, section_data.get('taxable_value', 0), number_format)
        worksheet.write(row, 2, section_data.get('igst_amount', 0), number_format)
        worksheet.write(row, 3, section_data.get('cgst_amount', 0), number_format)
        worksheet.write(row, 4, section_data.get('sgst_amount', 0), number_format)
        worksheet.write(row, 5, section_data.get('cess_amount', 0), number_format)
        row += 1
    
    # Calculate totals
    row += 1
    worksheet.write(row, 0, 'Total Tax Liability', section_header_format)
    total_igst = sum(s.get('igst_amount', 0) for s in summary.values())
    total_cgst = sum(s.get('cgst_amount', 0) for s in summary.values())
    total_sgst = sum(s.get('sgst_amount', 0) for s in summary.values())
    total_cess = sum(s.get('cess_amount', 0) for s in summary.values())
    total_taxable = sum(s.get('taxable_value', 0) for s in summary.values())
    
    worksheet.write(row, 1, total_taxable, number_format)
    worksheet.write(row, 2, total_igst, number_format)
    worksheet.write(row, 3, total_cgst, number_format)
    worksheet.write(row, 4, total_sgst, number_format)
    worksheet.write(row, 5, total_cess, number_format)
    
    # Add footer with timestamp
    row += 3
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    worksheet.merge_range(f'A{row+1}:F{row+1}', f'Generated on: {timestamp}', text_format)
    
    # Close workbook
    workbook.close()
    
    # Seek to beginning
    output.seek(0)
    
    # Generate filename
    filename = get_filename("GSTR-3B", gstin, return_period.replace('/', ''), "xlsx")
    
    # Create streaming response
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    
    # Set headers for file download
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.headers["Content-Length"] = str(output.tell())
    
    return response


# =============================================================================
# Combined Export Endpoint
# =============================================================================

@router.get("/download-gstr-export")
async def download_gstr_export(
    gstin: str = Query(..., description="GSTIN of the taxpayer"),
    return_period: str = Query(..., description="Return period in MM/YYYY format"),
    export_type: str = Query("both", description="Export type: json, excel, or both"),
    company_gstin: Optional[str] = Query(None, description="Company GSTIN for inter-state determination"),
) -> Dict[str, Any]:
    """
    Combined endpoint for downloading GSTR exports.
    
    Returns URLs or data for GSTR-1 JSON and/or GSTR-3B Excel downloads.
    
    Query Parameters:
        - gstin: 15-character GSTIN
        - return_period: Return period in MM/YYYY format
        - export_type: 'json', 'excel', or 'both' (default: 'both')
        - company_gstin: Company's GSTIN (optional)
    
    Returns:
        JSON with download URLs and metadata
        
    Example Response:
        {
            "gstin": "07AAAAA1234A1ZA",
            "return_period": "03/2024",
            "json_url": "/download-gstr1-json?gstin=...&return_period=...",
            "excel_url": "/download-gstr3b-excel?gstin=...&return_period=..."
        }
    """
    # Validate inputs
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN: must be 15 characters")
    
    if company_gstin is None:
        company_gstin = gstin
    
    response_data = {
        "gstin": gstin,
        "return_period": return_period,
        "company_gstin": company_gstin,
    }
    
    base_url = "/download"
    
    if export_type in ["json", "both"]:
        response_data["json_url"] = f"{base_url}/gstr1-json?gstin={gstin}&return_period={return_period}"
    
    if export_type in ["excel", "both"]:
        response_data["excel_url"] = f"{base_url}/gstr3b-excel?gstin={gstin}&return_period={return_period}&company_gstin={company_gstin}"
    
    if export_type not in ["json", "excel", "both"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid export_type: must be 'json', 'excel', or 'both'"
        )
    
    return response_data
