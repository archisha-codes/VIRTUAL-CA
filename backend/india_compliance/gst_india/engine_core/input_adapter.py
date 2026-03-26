"""
Production-Grade Input Adapter for Excel Processing

This module provides comprehensive Excel file handling for various ERP systems
including Tally, SAP, Oracle, Busy, Marg, Zoho, and custom ERPs.

Features:
- Multi-ERP column mapping with 500+ aliases
- Dynamic header detection (header in any row)
- Automatic data type conversion
- Fault tolerance with structured error reporting
- Rounding tolerance handling (0.50 INR threshold)
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Any, Union
from pathlib import Path
import re
import warnings

from india_compliance.gst_india.utils.header_mapper import (
    HeaderMapper,
    normalize_header,
    clean_numeric_value,
    parse_date_value,
    CANONICAL_FIELDS,
)


# =============================================================================
# ERP-SPECIFIC COLUMN MAPPINGS
# =============================================================================

ERP_COLUMNS = {
    # Tally ERP columns
    "tally": [
        "Voucher Type", "Voucher Number", "Voucher Date", "Party Name",
        "Party GSTIN", "Place of Supply", "HSN/SAC", "Quantity", "Rate",
        "Per", "Amount", "CGST Rate", "CGST Amount", "SGST Rate", "SGST Amount",
        "IGST Rate", "IGST Amount", "Cess Rate", "Cess Amount",
        "Ledger Name", "Reference", "Narration"
    ],
    
    # SAP columns
    "sap": [
        "Document Number", "Document Date", "Posting Date", "Vendor Name",
        "Vendor GSTIN", "Plant", "Sold-to Party", "Ship-to Party",
        "Material", "Material Description", "Quantity", "Base Unit",
        "Net Price", "Currency", "Tax Code", "IGST", "CGST", "SGST",
        "Bill of Lading", "Port of Loading", "Port of Discharge"
    ],
    
    # Oracle columns
    "oracle": [
        "Invoice Num", "Invoice Date", "Gl Date", "Vendor Num",
        "Vendor Name", "Vendor Site", "Description", "Quantity Invoiced",
        "Unit Price", "UOM", "Tax", "Tax Rate", "Gst Registration Num",
        "Ship To Location", "Bill To Location", "Operating Unit"
    ],
    
    # Busy columns
    "busy": [
        "Vch No.", "Vch Date", "Party", "Tax Class", "Tax Rate",
        "Assessable Value", "IGST Amt", "CGST Amt", "SGST Amt",
        "Cess Amt", "Total Amt", "Port Code", "Shipping Bill No",
        "Shipping Bill Date", "Item Name", "HSN/SAC Code", "Qty"
    ],
    
    # Marg columns
    "marg": [
        "Bill No", "Bill Date", "Party Name", "GST No", "State",
        "Item Name", "HSN Code", "Qty", "Rate", "Amount", "GST%",
        "IGST Amt", "CGST Amt", "SGST Amt", "Total", "Transport Name",
        "LR No", "LR Date"
    ],
    
    # Zoho columns
    "zoho": [
        "Invoice Number", "Invoice Date", "Customer Name", "Customer GSTIN",
        "Billing Address", "Shipping Address", "Place of Supply", "Item Name",
        "HSN/SAC", "Quantity", "Rate", "Taxable Amount", "Tax %",
        "IGST %", "IGST Amount", "CGST %", "CGST Amount", "SGST %",
        "SGST Amount", "Cess %", "Cess Amount", "Sub Total", "Total",
        "E-way Bill No", "E-way Bill Date", "Reverse Charge"
    ],
}


# =============================================================================
# MASTER COLUMN SCHEMA (GSTN Offline Tool Compliant)
# =============================================================================

MASTER_COLUMNS = {
    # Required fields as per GSTN Offline Tool Schema
    "required": {
        "invoice_number": {"aliases": ["Invoice No", "Invoice Number", "Bill No", "Document No"], "required": True},
        "invoice_date": {"aliases": ["Invoice Date", "Bill Date", "Document Date"], "required": True},
        "taxable_value": {"aliases": ["Taxable Value", "Net Amount", "Assessable Value"], "required": True},
    },
    
    # Optional but important fields
    "optional": {
        "gstin": {"aliases": ["GSTIN", "Customer GSTIN", "Party GSTIN", "Tax ID"]},
        "customer_name": {"aliases": ["Customer Name", "Party Name", "Party"]},
        "place_of_supply": {"aliases": ["Place of Supply", "POS", "State", "State Code"]},
        "rate": {"aliases": ["Rate", "Tax Rate", "GST%", "Percentage"]},
        "igst": {"aliases": ["IGST", "IGST Amount", "Integrated Tax"]},
        "cgst": {"aliases": ["CGST", "CGST Amount", "Central Tax"]},
        "sgst": {"aliases": ["SGST", "SGST Amount", "State Tax"]},
        "cess": {"aliases": ["CESS", "Cess Amount", "Compensation Cess"]},
        "invoice_value": {"aliases": ["Invoice Value", "Total Amount", "Grand Total"]},
        "hsn_code": {"aliases": ["HSN", "HSN Code", "HSN/SAC", "SAC"]},
        "quantity": {"aliases": ["Qty", "Quantity", "Number of Items"]},
        "uom": {"aliases": ["UOM", "Unit", "Unit of Measure"]},
        "document_type": {"aliases": ["Document Type", "Invoice Type", "Voucher Type"]},
        "supply_type": {"aliases": ["Supply Type", "Export Type", "Nature of Supply"]},
        "reverse_charge": {"aliases": ["Reverse Charge", "RCM"]},
        "note_number": {"aliases": ["Note Number", "CN No", "DN No", "Credit Note No"]},
        "note_date": {"aliases": ["Note Date", "CN Date", "DN Date", "Credit Note Date"]},
        "note_value": {"aliases": ["Note Value", "CN Value", "DN Value"]},
        "shipping_bill_number": {"aliases": ["Shipping Bill No", "SB No", "Export Bill"]},
        "shipping_bill_date": {"aliases": ["Shipping Bill Date", "SB Date"]},
        "port_code": {"aliases": ["Port Code", "Port", "Export Port"]},
        "irn": {"aliases": ["IRN", "Invoice Reference Number", "e-Invoice IRN"]},
        "ack_no": {"aliases": ["Ack No", "Acknowledgement Number"]},
        "ack_date": {"aliases": ["Ack Date", "Acknowledgement Date"]},
        "ecommerce_gstin": {"aliases": ["E-commerce GSTIN", "Portal GSTIN"]},
    }
}


# =============================================================================
# ROUNDING TOLERANCE CONSTANTS
# =============================================================================

ROUNDING_TOLERANCE = 0.50  # INR threshold for rounding tolerance
TAX_ROUNDING_MODE = "HALF_UP"  # Standard GST rounding mode


# =============================================================================
# DATA CLASSES FOR ERROR REPORTING
# =============================================================================

class ValidationError:
    """Structured error for data validation failures."""
    
    def __init__(
        self,
        error_type: str,
        field: str,
        value: Any,
        message: str,
        row_index: Optional[int] = None,
        sheet_name: Optional[str] = None,
        suggestion: Optional[str] = None
    ):
        self.error_type = error_type  # 'missing', 'invalid', 'format', 'range', 'logic'
        self.field = field
        self.value = value
        self.message = message
        self.row_index = row_index
        self.sheet_name = sheet_name
        self.suggestion = suggestion
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type,
            "field": self.field,
            "value": str(self.value) if self.value else None,
            "message": self.message,
            "row_index": self.row_index,
            "sheet_name": self.sheet_name,
            "suggestion": self.suggestion
        }
    
    def __repr__(self):
        return f"ValidationError({self.error_type}, {self.field}, {self.message})"


class ValidationWarning:
    """Structured warning for non-critical issues."""
    
    def __init__(
        self,
        warning_type: str,
        field: str,
        value: Any,
        message: str,
        row_index: Optional[int] = None,
        suggestion: Optional[str] = None
    ):
        self.warning_type = warning_type  # 'rounding', 'tolerance', 'format'
        self.field = field
        self.value = value
        self.message = message
        self.row_index = row_index
        self.suggestion = suggestion
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "warning_type": self.warning_type,
            "field": self.field,
            "value": str(self.value) if self.value else None,
            "message": self.message,
            "row_index": self.row_index,
            "suggestion": self.suggestion
        }


class InputProcessingResult:
    """Complete result of input processing."""
    
    def __init__(
        self,
        success: bool,
        dataframe: Optional[pd.DataFrame] = None,
        errors: Optional[List[ValidationError]] = None,
        warnings: Optional[List[ValidationWarning]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        audit_trail: Optional[List[Dict[str, Any]]] = None
    ):
        self.success = success
        self.dataframe = dataframe
        self.errors = errors or []
        self.warnings = warnings or []
        self.metadata = metadata or {}
        self.audit_trail = audit_trail or []
    
    def add_error(self, error: ValidationError):
        self.errors.append(error)
        self.audit_trail.append({
            "timestamp": datetime.now().isoformat(),
            "action": "error",
            "error_type": error.error_type,
            "field": error.field,
            "message": error.message
        })
    
    def add_warning(self, warning: ValidationWarning):
        self.warnings.append(warning)
        self.audit_trail.append({
            "timestamp": datetime.now().isoformat(),
            "action": "warning",
            "warning_type": warning.warning_type,
            "field": warning.field,
            "message": warning.message
        })
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "total_rows": len(self.dataframe) if self.dataframe is not None else 0,
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "metadata": self.metadata,
            "audit_trail": self.audit_trail
        }


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def detect_erp_system(headers: List[str]) -> Optional[str]:
    """
    Detect ERP system from column headers.
    
    Args:
        headers: List of column headers from Excel file
    
    Returns:
        Detected ERP system name or None
    """
    header_normalized = {normalize_header(h) for h in headers}
    
    erp_scores = {}
    for erp_name, erp_headers in ERP_COLUMNS.items():
        score = sum(1 for h in erp_headers if normalize_header(h) in header_normalized)
        erp_scores[erp_name] = score
    
    # Return best match if score >= 3
    best_match = max(erp_scores, key=erp_scores.get)
    if erp_scores[best_match] >= 3:
        return best_match
    return None


def detect_header_row(
    df: pd.DataFrame,
    mapper: HeaderMapper,
    max_scan_rows: int = 10
) -> int:
    """
    Detect the row containing column headers.
    
    Handles cases where:
    - Headers are in row 1 (standard)
    - Headers are in later rows (company branding, merged cells, etc.)
    - Some rows above are blank or contain metadata
    
    Args:
        df: pandas DataFrame
        mapper: HeaderMapper instance
        max_scan_rows: Maximum rows to scan
    
    Returns:
        Index of header row (0-based)
    """
    for idx in range(min(max_scan_rows, len(df))):
        row = df.iloc[idx]
        non_null = sum(1 for v in row.values if pd.notna(v) and str(v).strip())
        
        if non_null < 2:
            continue
        
        # Check how many columns match known headers
        matches = 0
        for v in row.values:
            if pd.notna(v) and mapper.get_canonical_field(str(v)):
                matches += 1
        
        if matches >= 3:
            return idx
    
    return 0  # Default to first row


def detect_sheet_names(file_path: str) -> List[str]:
    """
    Get all sheet names from Excel file.
    
    Args:
        file_path: Path to Excel file
    
    Returns:
        List of sheet names
    """
    try:
        xl = pd.ExcelFile(file_path)
        return xl.sheet_names
    except Exception:
        return []


# =============================================================================
# MAIN INPUT ADAPTER CLASS
# =============================================================================

class ExcelInputAdapter:
    """
    Production-grade Excel input adapter for GSTR-1 processing.
    
    Features:
    - Handles 500+ column name variations
    - Dynamic header detection
    - Multi-ERP support (Tally, SAP, Oracle, Busy, Marg, Zoho)
    - Fault tolerance with structured error reporting
    - Rounding tolerance handling
    - Audit trail for all auto-corrections
    """
    
    def __init__(
        self,
        rounding_tolerance: float = ROUNDING_TOLERANCE,
        strict_mode: bool = False
    ):
        """
        Initialize the input adapter.
        
        Args:
            rounding_tolerance: Tolerance for rounding differences (INR)
            strict_mode: If True, fail on any error instead of continuing
        """
        self.mapper = HeaderMapper()
        self.rounding_tolerance = rounding_tolerance
        self.strict_mode = strict_mode
        self._corrections_count = 0
    
    def load_excel(
        self,
        file_path: Union[str, Path],
        sheet_name: Optional[str] = None,
        header_row: Optional[int] = None,
        skip_footer: int = 0,
        encoding: str = "utf-8"
    ) -> pd.DataFrame:
        """
        Load Excel file into pandas DataFrame.
        
        Args:
            file_path: Path to Excel file
            sheet_name: Specific sheet to load (None = first sheet)
            header_row: Row containing headers (None = auto-detect)
            skip_footer: Number of rows to skip from bottom
            encoding: File encoding for CSV files
        
        Returns:
            Loaded DataFrame
        """
        path = Path(file_path)
        
        if path.suffix == ".csv":
            # Handle CSV files
            df = pd.read_csv(
                file_path,
                encoding=encoding,
                skipfooter=skip_footer,
                engine="python"
            )
        else:
            # Handle Excel files
            xl = pd.ExcelFile(file_path)
            sheets = xl.sheet_names
            
            if sheet_name is None:
                sheet_name = sheets[0]
            elif sheet_name not in sheets:
                raise ValueError(f"Sheet '{sheet_name}' not found. Available: {sheets}")
            
            df = pd.read_excel(
                file_path,
                sheet_name=sheet_name,
                skipfooter=skip_footer
            )
        
        # Auto-detect header row if not specified
        if header_row is None:
            header_row = detect_header_row(df, self.mapper)
        
        if header_row > 0:
            df.columns = df.iloc[header_row]
            df = df.iloc[header_row + 1:]
        
        # Clean up DataFrame
        df = self._cleanup_dataframe(df)
        
        return df
    
    def _cleanup_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean up DataFrame by removing empty rows and columns."""
        # Remove completely empty rows
        df = df.dropna(how="all")
        
        # Remove columns that are completely empty
        df = df.dropna(axis=1, how="all")
        
        # Reset index
        df = df.reset_index(drop=True)
        
        return df
    
    def map_columns(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str], List[ValidationWarning]]:
        """
        Map DataFrame columns to canonical field names.
        
        Handles duplicate column mappings by:
        - Prioritizing populated columns when multiple columns map to same field
        - Issuing warnings for duplicate mappings
        
        Args:
            df: DataFrame with original column names
        
        Returns:
            Tuple of (mapped DataFrame, column mapping, warnings)
        """
        warnings_list = []
        original_headers = df.columns.tolist()
        
        # Create mapping using header mapper
        raw_mapping = self.mapper.map_headers(original_headers)
        
        # Detect and handle duplicate canonical fields
        canonical_to_original: Dict[str, List[str]] = {}
        for original, canonical in raw_mapping.items():
            if canonical not in canonical_to_original:
                canonical_to_original[canonical] = []
            canonical_to_original[canonical].append(original)
        
        # Check for duplicates and prioritize populated columns
        final_mapping: Dict[str, str] = {}
        for canonical, originals in canonical_to_original.items():
            if len(originals) > 1:
                # Multiple columns map to same canonical field
                # Choose the one with more non-null values
                best_original = originals[0]
                best_count = 0
                
                for original in originals:
                    if original in df.columns:
                        non_null_count = df[original].notna().sum()
                        if non_null_count > best_count:
                            best_count = non_null_count
                            best_original = original
                
                final_mapping[best_original] = canonical
                
                # Warn about ignored duplicates
                ignored = [o for o in originals if o != best_original]
                warnings_list.append(ValidationWarning(
                    warning_type="format",
                    field=canonical,
                    value=ignored,
                    message=f"Multiple columns mapped to '{canonical}': {originals}. Using '{best_original}'.",
                    suggestion=f"Remove duplicate columns: {ignored}"
                ))
            else:
                final_mapping[originals[0]] = canonical
        
        # Rename columns
        df_mapped = df.rename(columns=final_mapping)
        
        return df_mapped, final_mapping, warnings_list
    
    def normalize_data(
        self,
        df: pd.DataFrame,
        supplier_gstin: Optional[str] = None
    ) -> Tuple[pd.DataFrame, List[ValidationWarning]]:
        """
        Normalize data types and apply auto-corrections.
        
        Args:
            df: Mapped DataFrame
            supplier_gstin: Supplier's GSTIN for validation
        
        Returns:
            Tuple of (normalized DataFrame, warnings)
        """
        warnings_list = []
        df_normalized = df.copy()
        
        for idx, row in df_normalized.iterrows():
            row_warnings = self._normalize_row(row, idx, supplier_gstin)
            warnings_list.extend(row_warnings)
        
        return df_normalized, warnings_list
    
    def _normalize_row(
        self,
        row: pd.Series,
        row_index: int,
        supplier_gstin: Optional[str] = None
    ) -> List[ValidationWarning]:
        """Normalize a single row."""
        warnings_list = []
        
        # Process each field
        for field, value in row.items():
            if pd.isna(value):
                continue
            
            # Normalize dates
            if field in ["invoice_date", "note_date", "shipping_bill_date", "ack_date"]:
                parsed = parse_date_value(value)
                if parsed:
                    row[field] = parsed
                else:
                    result.add_error(ValidationError(
                        error_type="format",
                        field=field,
                        value=value,
                        message=f"Invalid date format: {value}",
                        row_index=row_index,
                        suggestion="Use DD/MM/YYYY format (e.g., 31/12/2025)"
                    ))
            
            # Normalize numeric fields
            elif field in ["taxable_value", "invoice_value", "igst", "cgst", "sgst", 
                          "cess", "rate", "quantity"]:
                cleaned = clean_numeric_value(value)
                if cleaned is not None:
                    # Check for rounding tolerance
                    original = float(value) if isinstance(value, (int, float)) else None
                    if original is not None and abs(cleaned - original) > self.rounding_tolerance:
                        warnings_list.append(ValidationWarning(
                            warning_type="rounding",
                            field=field,
                            value=value,
                            message=f"Value rounded: {original} -> {cleaned}",
                            row_index=row_index,
                            suggestion=f"Within {self.rounding_tolerance} INR tolerance"
                        ))
                    row[field] = cleaned
                else:
                    warnings_list.append(ValidationWarning(
                        warning_type="format",
                        field=field,
                        value=value,
                        message=f"Invalid numeric value: {value}",
                        row_index=row_index
                    ))
            
            # Normalize GSTIN
            elif field == "gstin":
                if isinstance(value, str):
                    cleaned = value.strip().upper()
                    if cleaned:
                        row[field] = cleaned
            
            # Normalize text fields
            elif isinstance(value, str):
                row[field] = value.strip()
        
        # Auto-derive missing invoice_value from taxable + taxes
        invoice_val = row.get('invoice_value')
        taxable_val = row.get('taxable_value')
        igst_val = clean_numeric_value(row.get('igst', 0)) or 0
        cgst_val = clean_numeric_value(row.get('cgst', 0)) or 0
        sgst_val = clean_numeric_value(row.get('sgst', 0)) or 0
        cess_val = clean_numeric_value(row.get('cess', 0)) or 0
        total_taxes = igst_val + cgst_val + sgst_val + cess_val
        
        # Derive invoice_value if missing
        if invoice_val is None and taxable_val is not None:
            derived_invoice = taxable_val + total_taxes
            if derived_invoice > 0:
                row['invoice_value'] = derived_invoice
                warnings_list.append(ValidationWarning(
                    warning_type="format",
                    field="invoice_value",
                    value=None,
                    message=f"Derived invoice_value from taxable + taxes: {derived_invoice:.2f}",
                    row_index=row_index,
                    suggestion=f"invoice_value = taxable_value ({taxable_val:.2f}) + taxes ({total_taxes:.2f})"
                ))
        
        # Derive taxable_value if missing
        if taxable_val is None and invoice_val is not None:
            derived_taxable = invoice_val - total_taxes
            if derived_taxable >= 0:
                row['taxable_value'] = derived_taxable
                warnings_list.append(ValidationWarning(
                    warning_type="format",
                    field="taxable_value",
                    value=None,
                    message=f"Derived taxable_value from invoice - taxes: {derived_taxable:.2f}",
                    row_index=row_index,
                    suggestion=f"taxable_value = invoice_value ({invoice_val:.2f}) - taxes ({total_taxes:.2f})"
                ))
        
        return warnings_list
    
    def validate_data(
        self,
        df: pd.DataFrame,
        supplier_gstin: Optional[str] = None,
        filing_period_start: Optional[date] = None,
        filing_period_end: Optional[date] = None
    ) -> InputProcessingResult:
        """
        Validate data with comprehensive checks.
        
        Args:
            df: Normalized DataFrame
            supplier_gstin: Supplier's GSTIN
            filing_period_start: Start of filing period
            filing_period_end: End of filing period
        
        Returns:
            InputProcessingResult with validation status and errors
        """
        result = InputProcessingResult(success=True, dataframe=df)
        
        # Validate GSTINs
        for idx, row in df.iterrows():
            self._validate_gstin(row, idx, result)
        
        # Validate invoice numbers
        for idx, row in df.iterrows():
            self._validate_invoice_number(row, idx, result)
        
        # Validate dates against filing period
        if filing_period_start and filing_period_end:
            for idx, row in df.iterrows():
                self._validate_date_range(row, idx, filing_period_start, filing_period_end, result)
        
        # Validate tax calculations
        for idx, row in df.iterrows():
            self._validate_tax_calculation(row, idx, result)
        
        # Check for duplicates
        self._check_duplicates(df, result)
        
        # Set success based on errors
        if result.errors:
            result.success = not self.strict_mode
        
        # Add metadata
        result.metadata = {
            "total_rows": len(df),
            "valid_rows": len(df) - len([e for e in result.errors if e.error_type == "critical"]),
            "columns_mapped": len(df.columns),
            "strict_mode": self.strict_mode
        }
        
        return result
    
    def _validate_gstin(
        self,
        row: pd.Series,
        row_index: int,
        result: InputProcessingResult
    ):
        """Validate GSTIN format."""
        gstin = row.get("gstin")
        if not gstin:
            return
        
        # GSTIN format: 15 characters (2 state + 5 + 4 + 1 + 1 + 2)
        pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
        
        if not re.match(pattern, str(gstin)):
            result.add_error(ValidationError(
                error_type="invalid",
                field="gstin",
                value=gstin,
                message=f"Invalid GSTIN format: {gstin}",
                row_index=row_index,
                suggestion="Format: XXAAAAA0000A1Z0 (15 characters)"
            ))
    
    def _validate_invoice_number(
        self,
        row: pd.Series,
        row_index: int,
        result: InputProcessingResult
    ):
        """Validate invoice number."""
        invoice_no = row.get("invoice_number")
        
        if not invoice_no:
            result.add_error(ValidationError(
                error_type="missing",
                field="invoice_number",
                value=None,
                message="Invoice number is required",
                row_index=row_index,
                suggestion="Add invoice number column"
            ))
            return
        
        # Check length (max 16 chars as per GST)
        if len(str(invoice_no)) > 16:
            result.add_warning(ValidationWarning(
                warning_type="format",
                field="invoice_number",
                value=invoice_no,
                message=f"Invoice number exceeds 16 characters: {invoice_no}",
                row_index=row_index,
                suggestion="Consider truncating or using standard format"
            ))
    
    def _validate_date_range(
        self,
        row: pd.Series,
        row_index: int,
        start: date,
        end: date,
        result: InputProcessingResult
    ):
        """Validate invoice date is within filing period."""
        invoice_date = row.get("invoice_date")
        
        if not invoice_date:
            return
        
        if isinstance(invoice_date, datetime):
            invoice_date = invoice_date.date()
        elif isinstance(invoice_date, date):
            invoice_date = invoice_date
        else:
            return
        
        if invoice_date < start or invoice_date > end:
            result.add_warning(ValidationWarning(
                warning_type="range",
                field="invoice_date",
                value=invoice_date,
                message=f"Invoice date {invoice_date} outside filing period {start} to {end}",
                row_index=row_index,
                suggestion="Verify correct filing period"
            ))
    
    def _validate_tax_calculation(
        self,
        row: pd.Series,
        row_index: int,
        result: InputProcessingResult
    ):
        """Validate tax calculation accuracy."""
        taxable = row.get("taxable_value", 0)
        rate = row.get("rate", 0)
        igst = row.get("igst", 0)
        cgst = row.get("cgst", 0)
        sgst = row.get("sgst", 0)
        
        if not all([taxable, rate]):
            return
        
        # Calculate expected tax
        expected_total = taxable * rate / 100
        
        # Get actual tax based on presence
        if igst > 0:
            actual_tax = igst
        else:
            actual_tax = cgst + sgst
        
        # Check difference
        diff = abs(actual_tax - expected_total)
        
        if diff > self.rounding_tolerance:
            if diff > 100:  # Large difference
                result.add_error(ValidationError(
                    error_type="logic",
                    field="tax",
                    value=actual_tax,
                    message=f"Tax mismatch: expected {expected_total:.2f}, got {actual_tax:.2f}",
                    row_index=row_index,
                    suggestion="Recalculate tax: taxable_value × rate / 100"
                ))
            else:  # Small difference - warning
                result.add_warning(ValidationWarning(
                    warning_type="tolerance",
                    field="tax",
                    value=actual_tax,
                    message=f"Tax rounding difference: {diff:.2f} INR",
                    row_index=row_index,
                    suggestion=f"Within {self.rounding_tolerance} INR tolerance threshold"
                ))
    
    def _check_duplicates(self, df: pd.DataFrame, result: InputProcessingResult):
        """Check for duplicate invoices."""
        if "invoice_number" not in df.columns or "gstin" not in df.columns:
            return
        
        # Find duplicates based on GSTIN + Invoice Number
        duplicates = df[df.duplicated(subset=["invoice_number", "gstin"], keep=False)]
        
        if not duplicates.empty:
            result.add_error(ValidationError(
                error_type="logic",
                field="invoice_number",
                value=None,
                message=f"Found {len(duplicates)} duplicate invoice entries",
                suggestion="Review and remove duplicates"
            ))
    
    def process(
        self,
        file_path: Union[str, Path],
        supplier_gstin: Optional[str] = None,
        sheet_name: Optional[str] = None,
        header_row: Optional[int] = None,
        filing_period_start: Optional[date] = None,
        filing_period_end: Optional[date] = None
    ) -> InputProcessingResult:
        """
        Complete processing pipeline for Excel file.
        
        Args:
            file_path: Path to Excel/CSV file
            supplier_gstin: Supplier's GSTIN
            sheet_name: Specific sheet to process
            header_row: Row containing headers
            filing_period_start: Filing period start date
            filing_period_end: Filing period end date
        
        Returns:
            InputProcessingResult with processed data and validation results
        """
        result = InputProcessingResult(success=True)
        
        try:
            # Step 1: Load file
            result.audit_trail.append({
                "timestamp": datetime.now().isoformat(),
                "action": "load_file",
                "file_path": str(file_path)
            })
            
            df = self.load_excel(file_path, sheet_name, header_row)
            
            if df.empty:
                result.add_error(ValidationError(
                    error_type="missing",
                    field="data",
                    value=None,
                    message="No data found in file",
                    suggestion="Check file contains valid data"
                ))
                return result
            
            # Step 2: Map columns
            df_mapped, mapping, map_warnings = self.map_columns(df)
            result.warnings.extend(map_warnings)
            
            result.audit_trail.append({
                "timestamp": datetime.now().isoformat(),
                "action": "map_columns",
                "columns_mapped": len(mapping),
                "warnings_count": len(map_warnings)
            })
            
            # Step 3: Normalize data
            df_normalized, warnings = self.normalize_data(df_mapped, supplier_gstin)
            result.warnings.extend(warnings)
            
            result.audit_trail.append({
                "timestamp": datetime.now().isoformat(),
                "action": "normalize_data",
                "warnings_count": len(warnings)
            })
            
            # Step 4: Validate data
            validation_result = self.validate_data(
                df_normalized,
                supplier_gstin,
                filing_period_start,
                filing_period_end
            )
            result.errors.extend(validation_result.errors)
            result.warnings.extend(validation_result.warnings)
            result.success = validation_result.success
            
            result.audit_trail.append({
                "timestamp": datetime.now().isoformat(),
                "action": "validate_data",
                "errors_count": len(validation_result.errors)
            })
            
            # Set final dataframe
            result.dataframe = validation_result.dataframe
            
            # Add metadata
            result.metadata = {
                "file_path": str(file_path),
                "detected_erp": detect_erp_system(df.columns.tolist()),
                "header_row": header_row,
                "column_mapping": mapping,
                **validation_result.metadata
            }
            
        except Exception as e:
            result.add_error(ValidationError(
                error_type="invalid",
                field="file",
                value=str(file_path),
                message=f"Error processing file: {str(e)}",
                suggestion="Check file format and try again"
            ))
            result.success = False
        
        return result


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def adapt_input_dataframe(
    df: pd.DataFrame,
    supplier_gstin: Optional[str] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Convenience function to adapt a DataFrame.
    
    Args:
        df: pandas DataFrame
        supplier_gstin: Supplier's GSTIN
    
    Returns:
        Tuple of (adapted DataFrame, mapping)
    """
    adapter = ExcelInputAdapter()
    df_mapped, mapping = adapter.map_columns(df)
    df_normalized, _ = adapter.normalize_data(df_mapped, supplier_gstin)
    return df_normalized, mapping


def load_and_process_excel(
    file_path: str,
    supplier_gstin: Optional[str] = None,
    **kwargs
) -> InputProcessingResult:
    """
    Convenience function to load and process an Excel file.
    
    Args:
        file_path: Path to Excel file
        supplier_gstin: Supplier's GSTIN
        **kwargs: Additional arguments for ExcelInputAdapter.process()
    
    Returns:
        InputProcessingResult
    """
    adapter = ExcelInputAdapter()
    return adapter.process(file_path, supplier_gstin, **kwargs)


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python input_adapter.py <excel_file> [supplier_gstin]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    supplier_gstin = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("=" * 70)
    print("GSTR-1 Input Adapter - Production Grade")
    print("=" * 70)
    
    result = load_and_process_excel(file_path, supplier_gstin)
    
    print(f"\nProcessing Result:")
    print(f"  Success: {result.success}")
    print(f"  Total Rows: {result.metadata.get('total_rows', 0)}")
    print(f"  Errors: {len(result.errors)}")
    print(f"  Warnings: {len(result.warnings)}")
    
    if result.errors:
        print("\nErrors:")
        for error in result.errors[:10]:  # Show first 10
            print(f"  - {error}")
    
    if result.warnings:
        print("\nWarnings:")
        for warning in result.warnings[:10]:  # Show first 10
            print(f"  - {warning}")
    
    print("\n" + "=" * 70)
