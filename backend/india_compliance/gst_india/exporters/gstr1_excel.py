# india_compliance/gst_india/exporters/gstr1_excel.py

"""
GSTR-1 Excel Exporter Module

Generates Excel workbook matching the GSTR-1 offline utility format v2.1.
Supports sheets: B2B, B2CL, B2CS, EXP, CDNR, CDNUR, HSN, Docs

Optimized for large files (10,000+ rows) with in-memory streaming.
"""

from io import BytesIO
from typing import Dict, Any, List
import xlsxwriter
import time


# Processing timeout threshold (seconds)
PROCESSING_TIMEOUT_THRESHOLD = 5

# Header row index (0-based) - GSTR-1 template has headers on row 4
HEADER_ROW = 3
# First data row index (0-based)
DATA_START_ROW = 4


# Column headers matching GSTR-1 offline utility format v2.1
# Updated to match actual template structure
B2B_COLUMNS = [
    "GSTIN/UIN of Recipient",
    "Receiver Name",
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Place Of Supply",
    "Reverse Charge",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Rate",
    "Taxable Value",
    "Integrated Tax",
    "Central Tax",
    "State/UT Tax",
    "Cess Amount",
]

B2CL_COLUMNS = [
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Place Of Supply",
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Integrated Tax",
    "Central Tax",
    "State/UT Tax",
    "Cess Amount",
    "E-Commerce GSTIN",
]

B2CS_COLUMNS = [
    "Type",
    "Place Of Supply",
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Integrated Tax",
    "Central Tax",
    "State/UT Tax",
    "Cess Amount",
    "E-Commerce GSTIN",
]

EXP_COLUMNS = [
    "Export Type",
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Port Code",
    "Shipping Bill Number",
    "Shipping Bill Date",
    "Taxable Value",
    "Rate",
    "Integrated Tax Amount",
    "Cess Amount",
]

CDNR_COLUMNS = [
    "GSTIN/UIN of Recipient",
    "Receiver Name",
    "Note Number",
    "Note Date",
    "Note Type",
    "Place Of Supply",
    "Reverse Charge",
    "Note Supply Type",
    "Note Value",
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Cess Amount",
]

CDNUR_COLUMNS = [
    "UR Type",
    "Note Number",
    "Note Date",
    "Note Type",
    "Place Of Supply",
    "Note Value",
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Cess Amount",
]

HSN_COLUMNS = [
    "HSN",
    "Description",
    "UQC",
    "Total Quantity",
    "Total Value",
    "Taxable Value",
    "Integrated Tax Amount",
    "Central Tax Amount",
    "State/UT Tax Amount",
    "Cess Amount",
    "Rate",
]

DOCS_COLUMNS = [
    "Nature of Document",
    "Sr No From",
    "Sr No To",
    "Total Number",
    "Total Cancelled",
    "Net Issue",
]


def format_currency(value):
    """Format value as float for currency."""
    if value is None:
        return 0.0
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return 0.0


def format_date(date_val):
    """Format date as DD/MM/YYYY string."""
    if not date_val:
        return ""
    
    from datetime import datetime
    
    if isinstance(date_val, datetime):
        return date_val.strftime("%d/%m/%Y")
    elif isinstance(date_val, str):
        try:
            parsed = datetime.fromisoformat(date_val.replace("/", "-").replace(" ", ""))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return date_val
    
    return ""


def get_cell_format(workbook):
    """Create standard cell formats for the workbook."""
    formats = {}
    
    # Header format: bold + gray fill
    formats["header"] = workbook.add_format({
        "bold": True,
        "bg_color": "#D3D3D3",  # Light gray
        "border": 1,
        "text_wrap": True,
        "align": "center",
        "valign": "vcenter",
    })
    
    # Currency format
    formats["currency"] = workbook.add_format({
        "num_format": "#,##0.00",
        "border": 1,
        "align": "right",
    })
    
    # INR currency format
    formats["currency_inr"] = workbook.add_format({
        "num_format": "#,##0.00",
        "border": 1,
        "align": "right",
    })
    
    # Integer format
    formats["integer"] = workbook.add_format({
        "num_format": "#,##0",
        "border": 1,
        "align": "right",
    })
    
    # Date format
    formats["date"] = workbook.add_format({
        "num_format": "dd/mm/yyyy",
        "border": 1,
        "align": "center",
    })
    
    # Text format (default)
    formats["text"] = workbook.add_format({
        "border": 1,
        "align": "left",
    })
    
    # Center text format
    formats["center_text"] = workbook.add_format({
        "border": 1,
        "align": "center",
    })
    
    # Percent format
    formats["percent"] = workbook.add_format({
        "num_format": "0%",
        "border": 1,
        "align": "center",
    })
    
    # Header for summary sheet - bold + blue fill
    formats["summary_header"] = workbook.add_format({
        "bold": True,
        "font_size": 14,
        "bg_color": "#4472C4",
        "font_color": "white",
        "border": 1,
        "text_wrap": True,
        "align": "center",
    })
    
    # Section header for summary - bold + light green fill
    formats["section_header"] = workbook.add_format({
        "bold": True,
        "font_size": 11,
        "bg_color": "#E2EFDA",  # Light green
        "border": 1,
        "align": "left",
    })
    
    # Summary label format
    formats["summary_label"] = workbook.add_format({
        "bold": True,
        "border": 1,
        "align": "left",
        "bg_color": "#F2F2F2",
    })
    
    # Summary value format (currency)
    formats["summary_value"] = workbook.add_format({
        "num_format": "#,##0.00",
        "border": 1,
        "align": "right",
        "bold": True,
    })
    
    # Summary value format (integer)
    formats["summary_value_int"] = workbook.add_format({
        "num_format": "#,##0",
        "border": 1,
        "align": "right",
        "bold": True,
    })
    
    return formats


def auto_fit_columns(worksheet, columns, data_rows=None, min_width=10, max_width=50):
    """Auto-fit columns based on header and data width."""
    for col_idx, col_name in enumerate(columns):
        # Start with header width
        max_width_col = len(str(col_name))
        
        # Check data rows if provided
        if data_rows:
            for row in data_rows:
                if col_idx < len(row):
                    cell_width = len(str(row[col_idx]))
                    max_width_col = max(max_width_col, cell_width)
        
        # Apply bounds
        final_width = max(min_width, min(max_width_col + 2, max_width))
        worksheet.set_column(col_idx, col_idx, final_width)


def write_b2b_sheet(workbook, worksheet, data, formats):
    """Write B2B sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(B2B_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for entity in data:
        ctin = entity.get("ctin", "")
        customer_name = entity.get("customer_name", "")
        invoices = entity.get("invoices", [])
        
        for invoice in invoices:
            col_idx = 0
            worksheet.write(row_idx, col_idx, ctin, formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, customer_name, formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, invoice.get("inum", ""), formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, format_date(invoice.get("idt")), formats["date"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, format_currency(invoice.get("val")), formats["currency"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, invoice.get("pos", ""), formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, invoice.get("rchrg", "N"), formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, "", formats["center_text"])  # diff_percent
            col_idx += 1
            worksheet.write(row_idx, col_idx, invoice.get("inv_typ", "Regular"), formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, "", formats["text"])  # E-Commerce GSTIN
            col_idx += 1
            
            # Get tax amounts from items - iterate over all items
            items = invoice.get("itms", [])
            if items:
                # Write first item details on the invoice row
                first_item = items[0]
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("rt", 0)), formats["currency"])  # Rate
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("txval", 0)), formats["currency"])  # Taxable Value
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("iamt", 0)), formats["currency"])  # Integrated Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("camt", 0)), formats["currency"])  # Central Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("samt", 0)), formats["currency"])  # State/UT Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("csamt", 0)), formats["currency"])  # Cess Amount
            else:
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Rate
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Taxable Value
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Integrated Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Central Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # State/UT Tax
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Cess Amount
            
            row_idx += 1
    
    auto_fit_columns(worksheet, B2B_COLUMNS)


def write_b2cl_sheet(workbook, worksheet, data, formats):
    """Write B2CL sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(B2CL_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for invoice in data:
        col_idx = 0
        worksheet.write(row_idx, col_idx, invoice.get("inum", ""), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_date(invoice.get("idt")), formats["date"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("val")), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, invoice.get("pos", ""), formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["center_text"])  # diff_percent
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("rt", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("txval", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("iamt", 0)), formats["currency"])  # IGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("camt", 0)), formats["currency"])  # CGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("samt", 0)), formats["currency"])  # SGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("csamt", 0)), formats["currency"])  # Cess
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["text"])  # E-Commerce GSTIN
        
        row_idx += 1
    
    auto_fit_columns(worksheet, B2CL_COLUMNS)


def write_b2cs_sheet(workbook, worksheet, data, formats):
    """Write B2CS sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(B2CS_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for entry in data:
        col_idx = 0
        worksheet.write(row_idx, col_idx, "OE", formats["center_text"])  # Type
        col_idx += 1
        worksheet.write(row_idx, col_idx, entry.get("pos", ""), formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["center_text"])  # diff_percent
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("rt", 0)), formats["currency"])  # Rate
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("txval", 0)), formats["currency"])  # Taxable
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("iamt", 0)), formats["currency"])  # IGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("camt", 0)), formats["currency"])  # CGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("samt", 0)), formats["currency"])  # SGST
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("csamt", 0)), formats["currency"])  # Cess
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["text"])  # E-Commerce GSTIN
        
        row_idx += 1
    
    auto_fit_columns(worksheet, B2CS_COLUMNS)


def write_exp_sheet(workbook, worksheet, data, formats):
    """Write EXP sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(EXP_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for invoice in data:
        col_idx = 0
        export_type = invoice.get("exp_typ", "")
        worksheet.write(row_idx, col_idx, "WPAY" if export_type == "WPAY" else "WOPAY", formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, invoice.get("inum", ""), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_date(invoice.get("idt")), formats["date"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("val")), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, invoice.get("sbpcode", ""), formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, invoice.get("sbnum", ""), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_date(invoice.get("sbdt")), formats["date"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("txval", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("rt", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("iamt", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(invoice.get("csamt", 0)), formats["currency"])
        
        row_idx += 1
    
    auto_fit_columns(worksheet, EXP_COLUMNS)


def write_cdnr_sheet(workbook, worksheet, data, formats):
    """Write CDNR sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(CDNR_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for entity in data:
        ctin = entity.get("ctin", "")
        customer_name = entity.get("customer_name", "")
        notes = entity.get("notes", [])
        
        for note in notes:
            col_idx = 0
            worksheet.write(row_idx, col_idx, ctin, formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, customer_name, formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, note.get("nt_num", ""), formats["text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, format_date(note.get("nt_dt")), formats["date"])
            col_idx += 1
            note_type = note.get("nt_ty", "")
            worksheet.write(row_idx, col_idx, "Credit Note" if note_type == "C" else "Debit Note", formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, note.get("pos", ""), formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, note.get("rchrg", "N"), formats["center_text"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, "", formats["center_text"])  # Note Supply Type
            col_idx += 1
            worksheet.write(row_idx, col_idx, format_currency(note.get("val")), formats["currency"])
            col_idx += 1
            worksheet.write(row_idx, col_idx, "", formats["center_text"])  # diff_percent
            col_idx += 1
            
            # Get tax amounts from items
            items = note.get("itms", [])
            if items:
                first_item = items[0]
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("rt", 0)), formats["currency"])  # Rate
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("txval", 0)), formats["currency"])  # Taxable
                col_idx += 1
                worksheet.write(row_idx, col_idx, format_currency(first_item.get("csamt", 0)), formats["currency"])  # Cess
            else:
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Rate
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Taxable
                col_idx += 1
                worksheet.write(row_idx, col_idx, 0, formats["currency"])  # Cess
            
            row_idx += 1
    
    auto_fit_columns(worksheet, CDNR_COLUMNS)


def write_cdnur_sheet(workbook, worksheet, data, formats):
    """Write CDNUR sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(CDNUR_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for note in data:
        col_idx = 0
        worksheet.write(row_idx, col_idx, note.get("typ", "R"), formats["center_text"])  # UR Type
        col_idx += 1
        worksheet.write(row_idx, col_idx, note.get("nt_num", ""), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_date(note.get("nt_dt")), formats["date"])
        col_idx += 1
        note_type = note.get("ntty", "")
        worksheet.write(row_idx, col_idx, "Credit Note" if note_type == "C" else "Debit Note", formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, note.get("pos", ""), formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(note.get("val")), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["center_text"])  # diff_percent
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(note.get("rt", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(note.get("txval", 0)), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(note.get("csamt", 0)), formats["currency"])
        
        row_idx += 1
    
    auto_fit_columns(worksheet, CDNUR_COLUMNS)


def write_hsn_sheet(workbook, worksheet, data, formats):
    """Write HSN sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(HSN_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    for entry in data:
        col_idx = 0
        worksheet.write(row_idx, col_idx, entry.get("hsn_code", entry.get("hsn_sc", "")), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, entry.get("description", entry.get("desc", "")), formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, entry.get("uom", entry.get("uqc", "")), formats["center_text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("quantity", entry.get("qty", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("total_value", entry.get("suppval", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("taxable_value", entry.get("txval", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("igst", entry.get("iamt", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("cgst", entry.get("camt", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("sgst", entry.get("samt", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("cess", entry.get("csamt", 0))), formats["currency"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, format_currency(entry.get("rate", entry.get("rt", 0))), formats["currency"])
        
        row_idx += 1
    
    auto_fit_columns(worksheet, HSN_COLUMNS)


def write_docs_sheet(workbook, worksheet, data, formats):
    """Write Docs sheet data matching offline utility format v2.1."""
    # Write headers on row 4 (index 3)
    for col_idx, header in enumerate(DOCS_COLUMNS):
        worksheet.write(HEADER_ROW, col_idx, header, formats["header"])
    
    # Write data starting from row 5 (index 4)
    row_idx = DATA_START_ROW
    doc_summary = data.get("document_summary", {})
    
    document_types = [
        "Invoices for outward supply",
        "Invoices for inward supply from unregistered person",
        "Debit Note",
        "Credit Note",
        "Delivery Challan for job work",
    ]
    
    for doc_type in document_types:
        col_idx = 0
        worksheet.write(row_idx, col_idx, doc_type, formats["text"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["center_text"])  # From
        col_idx += 1
        worksheet.write(row_idx, col_idx, "", formats["center_text"])  # To
        col_idx += 1
        count = doc_summary.get(doc_type, 0)
        worksheet.write(row_idx, col_idx, count, formats["integer"])
        col_idx += 1
        worksheet.write(row_idx, col_idx, 0, formats["integer"])  # Cancelled
        col_idx += 1
        worksheet.write(row_idx, col_idx, count, formats["integer"])  # Net Issue
        
        row_idx += 1
    
    auto_fit_columns(worksheet, DOCS_COLUMNS)


def write_summary_sheet(workbook, worksheet, return_period, taxpayer_gstin, taxpayer_name, gstr1_tables, formats):
    """Write comprehensive summary sheet with taxpayer info, section totals, and Excel formulas."""
    
    # Taxpayer Information Header
    worksheet.merge_range("A1:E1", "GSTR-1 Summary Report", formats["summary_header"])
    worksheet.merge_range("A2:E2", f"Return Period: {return_period}  |  GSTIN: {taxpayer_gstin}  |  {taxpayer_name}", formats["text"])
    
    # Get data from tables
    b2b_data = gstr1_tables.get("b2b", [])
    b2cl_data = gstr1_tables.get("b2cl", [])
    b2cs_data = gstr1_tables.get("b2cs", [])
    exp_data = gstr1_tables.get("exp", [])
    cdnr_data = gstr1_tables.get("cdnr", [])
    cdnur_data = gstr1_tables.get("cdnur", [])
    summary = gstr1_tables.get("summary", {})
    
    # Calculate counts
    b2b_count = sum(len(entity.get("invoices", [])) for entity in b2b_data)
    b2cl_count = len(b2cl_data)
    b2cs_count = len(b2cs_data)
    exp_count = len(exp_data)
    cdnr_count = sum(len(entity.get("notes", [])) for entity in cdnr_data)
    cdnur_count = len(cdnur_data)
    total_records = b2b_count + b2cl_count + b2cs_count + exp_count + cdnr_count + cdnur_count
    
    # Get tax totals from summary
    total_taxable = summary.get("total_taxable_value", 0)
    total_igst = summary.get("total_igst", 0)
    total_cgst = summary.get("total_cgst", 0)
    total_sgst = summary.get("total_sgst", 0)
    total_cess = summary.get("total_cess", 0)
    total_tax = total_igst + total_cgst + total_sgst + total_cess
    
    # Section 1: Document Counts Summary
    row_idx = 4
    worksheet.merge_range(f"A{row_idx}:F{row_idx}", "Document Counts by Section", formats["section_header"])
    row_idx += 1
    
    # Headers
    worksheet.write(row_idx, 0, "Section", formats["summary_label"])
    worksheet.write(row_idx, 1, "Count", formats["summary_label"])
    worksheet.write(row_idx, 2, "Excel Formula", formats["summary_label"])
    worksheet.write(row_idx, 3, "", formats["summary_label"])  # spacer
    worksheet.write(row_idx, 4, "Taxable Value", formats["summary_label"])
    worksheet.write(row_idx, 5, "Excel Formula", formats["summary_label"])
    row_idx += 1
    
    # B2B row
    worksheet.write(row_idx, 0, "B2B (Registered)", formats["text"])
    worksheet.write(row_idx, 1, b2b_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('B2B'!C:C)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write_formula(row_idx, 4, "=SUM('B2B'!L:L)", formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('B2B'!L:L)", formats["currency"])
    row_idx += 1
    
    # B2CL row
    b2cl_taxable = sum(i.get("txval", 0) for i in b2cl_data)
    worksheet.write(row_idx, 0, "B2CL (Export > 2.5L)", formats["text"])
    worksheet.write(row_idx, 1, b2cl_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('B2CL'!A:A)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, format_currency(b2cl_taxable), formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('B2CL'!G:G)", formats["currency"])
    row_idx += 1
    
    # B2CS row
    b2cs_taxable = sum(i.get("txval", 0) for i in b2cs_data)
    worksheet.write(row_idx, 0, "B2CS (Unregistered)", formats["text"])
    worksheet.write(row_idx, 1, b2cs_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('B2CS'!A:A)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, format_currency(b2cs_taxable), formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('B2CS'!E:E)", formats["currency"])
    row_idx += 1
    
    # EXP row
    exp_taxable = sum(i.get("txval", 0) for i in exp_data)
    worksheet.write(row_idx, 0, "Export", formats["text"])
    worksheet.write(row_idx, 1, exp_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('EXP'!B:B)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, format_currency(exp_taxable), formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('EXP'!I:I)", formats["currency"])
    row_idx += 1
    
    # CDNR row
    cdnr_taxable = sum(n.get("txval", 0) for e in cdnr_data for n in e.get("notes", []))
    worksheet.write(row_idx, 0, "CDNR (Registered CN/DN)", formats["text"])
    worksheet.write(row_idx, 1, cdnr_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('CDNR'!C:C)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, format_currency(cdnr_taxable), formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('CDNR'!L:L)", formats["currency"])
    row_idx += 1
    
    # CDNUR row
    cdnur_taxable = sum(n.get("txval", 0) for n in cdnur_data)
    worksheet.write(row_idx, 0, "CDNUR (Unregistered CN/DN)", formats["text"])
    worksheet.write(row_idx, 1, cdnur_count, formats["summary_value_int"])
    worksheet.write(row_idx, 2, "=COUNTA('CDNUR'!B:B)-1", formats["integer"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, format_currency(cdnur_taxable), formats["summary_value"])
    worksheet.write(row_idx, 5, "=SUM('CDNUR'!I:I)", formats["currency"])
    row_idx += 1
    
    # Total row
    total_taxable_all = total_taxable
    worksheet.write(row_idx, 0, "TOTAL", formats["summary_label"])
    worksheet.write_formula(row_idx, 1, f"=SUM(B{row_idx-6}:B{row_idx})", formats["summary_value_int"])
    worksheet.write(row_idx, 2, "", formats["text"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write_formula(row_idx, 4, f"=SUM(E{row_idx-6}:E{row_idx})", formats["summary_value"])
    row_idx += 2
    
    # Section 2: Tax Summary by Component
    worksheet.merge_range(f"A{row_idx}:F{row_idx}", "Tax Summary", formats["section_header"])
    row_idx += 1
    
    # Headers
    worksheet.write(row_idx, 0, "Tax Component", formats["summary_label"])
    worksheet.write(row_idx, 1, "Amount (INR)", formats["summary_label"])
    worksheet.write(row_idx, 2, "Excel Formula Reference", formats["summary_label"])
    worksheet.write(row_idx, 3, "", formats["summary_label"])
    worksheet.write(row_idx, 4, "Description", formats["summary_label"])
    worksheet.write(row_idx, 5, "", formats["summary_label"])
    row_idx += 1
    
    # IGST row
    worksheet.write(row_idx, 0, "IGST", formats["text"])
    worksheet.write(row_idx, 1, format_currency(total_igst), formats["summary_value"])
    worksheet.write(row_idx, 2, "=SUM('B2B'!M:M,'B2CL'!H:H,'B2CS'!F:F,'EXP'!K:K)+SUM('CDNUR'!J:J)", formats["currency"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, "Inter-state sales & exports", formats["text"])
    row_idx += 1
    
    # CGST row
    worksheet.write(row_idx, 0, "CGST", formats["text"])
    worksheet.write(row_idx, 1, format_currency(total_cgst), formats["summary_value"])
    worksheet.write(row_idx, 2, "=SUM('B2B'!N:N,'B2CL'!I:I,'B2CS'!G:G)", formats["currency"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, "Intra-state (Central share)", formats["text"])
    row_idx += 1
    
    # SGST row
    worksheet.write(row_idx, 0, "SGST/UTGST", formats["text"])
    worksheet.write(row_idx, 1, format_currency(total_sgst), formats["summary_value"])
    worksheet.write(row_idx, 2, "=SUM('B2B'!O:O,'B2CL'!J:J,'B2CS'!H:H)", formats["currency"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, "Intra-state (State/UT share)", formats["text"])
    row_idx += 1
    
    # Cess row
    worksheet.write(row_idx, 0, "Cess", formats["text"])
    worksheet.write(row_idx, 1, format_currency(total_cess), formats["summary_value"])
    worksheet.write(row_idx, 2, "=SUM('B2CL'!K:K,'B2CS'!I:I,'EXP'!L:L)+SUM('CDNR'!M:M,'CDNUR'!K:K)", formats["currency"])
    worksheet.write(row_idx, 3, "", formats["text"])
    worksheet.write(row_idx, 4, "Goods (GST exempt goods)", formats["text"])
    row_idx += 1
    
    # Total Tax row
    worksheet.write(row_idx, 0, "TOTAL TAX", formats["summary_label"])
    worksheet.write_formula(row_idx, 1, f"=B{row_idx-4}+B{row_idx-3}+B{row_idx-2}+B{row_idx-1}", formats["summary_value"])
    worksheet.write(row_idx, 2, "", formats["text"])
    row_idx += 2
    
    # Section 3: Grand Total
    worksheet.merge_range(f"A{row_idx}:C{row_idx}", "GRAND TOTAL (Taxable + Tax)", formats["summary_header"])
    worksheet.write_formula(row_idx, 4, f"=E{row_idx-2}+B{row_idx-1}", formats["summary_value"])
    
    # Set column widths
    worksheet.set_column("A:A", 28)
    worksheet.set_column("B:B", 16)
    worksheet.set_column("C:C", 55)
    worksheet.set_column("D:D", 3)
    worksheet.set_column("E:E", 18)
    worksheet.set_column("F:F", 45)


def export_gstr1_excel(
    clean_data,
    return_period,
    taxpayer_gstin,
    taxpayer_name,
    company_gstin=None,
    include_hsn=True,
    include_docs=False,
):
    """
    Generate GSTR-1 Excel workbook.

    Accepts:
    - Either clean_data list (raw invoices)
    - OR pre-generated gstr1_tables dictionary
    """

    from india_compliance.gst_india.gstr1_data import generate_gstr1_tables

    # Detect if input is already processed tables
    if isinstance(clean_data, dict) and "b2b" in clean_data:
        gstr1_tables = clean_data
    else:
        # generate_gstr1_tables returns a tuple (tables, validation_report)
        gstr1_tables, _ = generate_gstr1_tables(
            clean_data,
            company_gstin=company_gstin or taxpayer_gstin,
            include_hsn=include_hsn,
            include_docs=include_docs,
        )

    return export_gstr1_excel_direct(
        gstr1_tables,
        return_period,
        taxpayer_gstin,
        taxpayer_name,
        company_gstin=company_gstin or taxpayer_gstin,
        include_hsn=include_hsn,
        include_docs=include_docs,
    )

    """
    Generate GSTR-1 Excel workbook matching offline utility format v2.1.
    
    Memory-optimized for large datasets (10,000+ rows).
    
    Args:
        clean_data: List of validated invoice records
        return_period: Return period in MMYYYY format
        taxpayer_gstin: GSTIN of the taxpayer
        taxpayer_name: Name of the taxpayer
    
    Returns:
        bytes: Excel file content as bytes
    """
    from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
    
    start_time = time.time()
    
    # Generate GSTR-1 tables from clean data
    gstr1_tables = generate_gstr1_tables(
        clean_data,
        company_gstin=taxpayer_gstin,
        include_hsn=True,
        include_docs=True,
    )
    
    excel_bytes = export_gstr1_excel_direct(gstr1_tables, return_period, taxpayer_gstin, taxpayer_name)
    
    elapsed = time.time() - start_time
    if elapsed > PROCESSING_TIMEOUT_THRESHOLD:
        import logging
        logging.getLogger(__name__).warning(
            f"GSTR-1 Excel export took {elapsed:.2f}s for large dataset"
        )
    
    return excel_bytes


def export_gstr1_excel_direct(
    gstr1_tables,
    return_period,
    taxpayer_gstin,
    taxpayer_name,
    company_gstin=None,
    include_hsn=True,
    include_docs=False,
):
    """
    Generate GSTR-1 Excel workbook from pre-formatted GSTR-1 tables.
    
    Uses xlsxwriter with in_memory mode for large file support.
    
    Args:
        gstr1_tables: Pre-formatted GSTR-1 tables dictionary
        return_period: Return period in MMYYYY format
        taxpayer_gstin: GSTIN of the taxpayer
        taxpayer_name: Name of the taxpayer
    
    Returns:
        bytes: Excel file content as bytes
    """
    import logging
    logger = logging.getLogger(__name__)
    
    start_time = time.time()
    
    # Create workbook in memory with streaming support
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Create formats
    formats = get_cell_format(workbook)
    
    # Summary sheet (first)
    summary_sheet = workbook.add_worksheet("Summary")
    write_summary_sheet(
        workbook,
        summary_sheet,
        return_period,
        taxpayer_gstin,
        taxpayer_name,
        gstr1_tables,
        formats,
    )
    
    # B2B sheet
    b2b_sheet = workbook.add_worksheet("B2B")
    write_b2b_sheet(
        workbook,
        b2b_sheet,
        gstr1_tables.get("b2b", []),
        formats,
    )
    
    # B2CL sheet
    b2cl_sheet = workbook.add_worksheet("B2CL")
    write_b2cl_sheet(
        workbook,
        b2cl_sheet,
        gstr1_tables.get("b2cl", []),
        formats,
    )
    
    # B2CS sheet
    b2cs_sheet = workbook.add_worksheet("B2CS")
    write_b2cs_sheet(
        workbook,
        b2cs_sheet,
        gstr1_tables.get("b2cs", []),
        formats,
    )
    
    # EXP sheet
    exp_sheet = workbook.add_worksheet("EXP")
    write_exp_sheet(
        workbook,
        exp_sheet,
        gstr1_tables.get("exp", []),
        formats,
    )
    
    # CDNR sheet
    cdnr_sheet = workbook.add_worksheet("CDNR")
    write_cdnr_sheet(
        workbook,
        cdnr_sheet,
        gstr1_tables.get("cdnr", []),
        formats,
    )
    
    # CDNUR sheet
    cdnur_sheet = workbook.add_worksheet("CDNUR")
    write_cdnur_sheet(
        workbook,
        cdnur_sheet,
        gstr1_tables.get("cdnur", []),
        formats,
    )
    
    # HSN sheet
    hsn_sheet = workbook.add_worksheet("HSN")
    write_hsn_sheet(
        workbook,
        hsn_sheet,
        gstr1_tables.get("hsn", []),
        formats,
    )
    
    # Docs sheet
    docs_sheet = workbook.add_worksheet("Docs")
    write_docs_sheet(
        workbook,
        docs_sheet,
        gstr1_tables.get("docs", {}),
        formats,
    )
    
    # Close workbook and get bytes
    workbook.close()
    output.seek(0)
    
    elapsed = time.time() - start_time
    if elapsed > PROCESSING_TIMEOUT_THRESHOLD:
        logger.warning(
            f"GSTR-1 Excel export completed in {elapsed:.2f}s: "
            f"{len(gstr1_tables.get('b2b', []))} B2B, "
            f"{len(gstr1_tables.get('b2cl', []))} B2CL, "
            f"{len(gstr1_tables.get('b2cs', []))} B2CS"
        )
    else:
        logger.debug(f"GSTR-1 Excel export completed in {elapsed:.2f}s")
    
    return output.getvalue()
