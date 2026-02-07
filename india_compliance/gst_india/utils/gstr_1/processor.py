"""
GSTR-1 Excel Processor

This module provides functionality to process Excel files containing sales data
and generate GSTR-1 compatible output with comprehensive validations.
"""

import io
import logging
import os
import re
from datetime import datetime, date
from typing import Any, Dict, List, Optional

import pandas as pd

from india_compliance.gst_india.utils.logger import get_logger
from india_compliance.gst_india.utils.gstr_1 import (
    GovExcelField,
    GovExcelSheetName,
    GovJsonKey,
)
logger = get_logger(__name__)


# GSTIN validation pattern
GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$")

# Valid state codes (first 2 digits of GSTIN)
VALID_STATE_CODES = {
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36", "37", "38", "96",
}

# State code mapping
STATE_CODES = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Ladakh",
    "38": "Other Territory",
    "96": "Other Countries",
}

# Valid tax rates
VALID_TAX_RATES = {0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28}

# Maximum invoice value
MAX_INVOICE_VALUE = 999999999.99


class GSTR1ValidationError(Exception):
    """Custom exception for GSTR-1 validation errors."""
    
    def __init__(self, message: str, row: int = None, field: str = None, value: Any = None, error_code: str = None):
        self.message = message
        self.row = row
        self.field = field
        self.value = value
        self.error_code = error_code
        super().__init__(message)
    
    def __str__(self):
        return f"Row {self.row}: {self.message}" if self.row else self.message
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "row": self.row,
            "field": self.field,
            "value": str(self.value) if self.value else None,
            "message": self.message,
            "error_code": self.error_code,
        }


class GSTR1Validator:
    """
    Comprehensive validator for GSTR-1 data.
    
    Validation rules based on GST law:
    - GSTIN must be 15 characters with valid format
    - Invoice date must be valid and within financial year
    - Tax amounts must match calculated values based on rate
    - IGST/CGST/SGST must be correct based on place of supply
    
    Error codes reference (GSTR1_Validations.xlsx):
    - GSTIN_XX: GSTIN validation errors
    - DATE_XX: Date validation errors
    - TAX_XX: Tax calculation errors
    - POS_XX: Place of supply errors
    - INV_XX: Invoice validation errors
    """
    
    def __init__(self, company_gstin: str = ""):
        self.company_gstin = company_gstin
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[str] = []
    
    def validate_gstin(self, gstin: str, row: int, field: str = "GSTIN") -> bool:
        """Validate GSTIN format (15 characters, alphanumeric).
        
        Error Codes: GSTIN_01 to GSTIN_04
        """
        if not gstin or pd.isna(gstin) or str(gstin).strip() == "":
            self._add_error(row, field, gstin, "GSTIN is required", "GSTIN_01")
            logger.warning(f"Row {row}: GSTIN is required")
            return False
        
        gstin = str(gstin).strip().upper()
        
        if len(gstin) != 15:
            self._add_error(row, field, gstin, "GSTIN must be exactly 15 characters", "GSTIN_02")
            logger.warning(f"Row {row}: GSTIN '{gstin}' must be exactly 15 characters (got {len(gstin)})")
            return False
        
        if not GSTIN_PATTERN.match(gstin):
            self._add_error(row, field, gstin, 
                "Invalid GSTIN format. Expected: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + Z + 1 digit (e.g., 07BZAAH6384P1ZH)",
                "GSTIN_03")
            logger.warning(f"Row {row}: Invalid GSTIN format: {gstin}")
            return False
        
        # Validate state code
        state_code = gstin[:2]
        if state_code not in VALID_STATE_CODES:
            self._add_error(row, field, gstin, f"Invalid state code in GSTIN: {state_code}. Valid codes: 01-38, 96", "GSTIN_04")
            logger.warning(f"Row {row}: Invalid state code '{state_code}' in GSTIN: {gstin}")
            return False
        
        # Validate checksum
        if not self._validate_gstin_checksum(gstin):
            self._add_error(row, field, gstin, "Invalid GSTIN checksum", "GSTIN_05")
            logger.warning(f"Row {row}: Invalid GSTIN checksum: {gstin}")
            return False
        
        logger.debug(f"Row {row}: GSTIN {gstin} validated successfully")
        return True
    
    def _validate_gstin_checksum(self, gstin: str) -> bool:
        """Validate GSTIN checksum digit."""
        try:
            # Convert letters to numbers (A=10, B=11, ..., Z=35)
            numeric = []
            for char in gstin[:-1]:
                if char.isdigit():
                    numeric.append(int(char))
                else:
                    numeric.append(ord(char.upper()) - ord('A') + 10)
            
            # Calculate check digit
            total = sum((numeric[i] * (i + 1)) for i in range(14))
            check_digit = total % 36
            
            # Convert check digit to character
            expected_check = str(check_digit) if check_digit < 10 else chr(ord('A') + check_digit - 10)
            
            return gstin[-1].upper() == expected_check
        except Exception:
            return True  # Skip checksum validation on error
    
    def validate_date(self, date_value: Any, row: int, field: str = "Invoice Date") -> Optional[datetime]:
        """Validate invoice date is within valid range.
        
        Error Codes: DATE_01 to DATE_04
        """
        if not date_value or pd.isna(date_value):
            self._add_error(row, field, date_value, "Invoice date is required", "DATE_01")
            return None
        
        try:
            if isinstance(date_value, datetime):
                parsed_date = date_value
            elif isinstance(date_value, date):
                parsed_date = datetime.combine(date_value, datetime.min.time())
            else:
                # Try parsing various date formats
                date_str = str(date_value).strip()
                for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%Y"]:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    self._add_error(row, field, date_value, 
                        f"Invalid date format: {date_value}. Expected formats: DD/MM/YYYY, YYYY-MM-DD", "DATE_02")
                    return None
            
            # Validate date is not in the future
            if parsed_date > datetime.now():
                self._add_error(row, field, date_value, 
                    "Invoice date cannot be in the future", "DATE_03")
                return None
            
            # Validate date is not too old (more than 2 years)
            two_years_ago = datetime.now().replace(year=datetime.now().year - 2)
            if parsed_date < two_years_ago:
                self._add_warning(f"Row {row}: Invoice date is more than 2 years old (legacy data)")
            
            return parsed_date
            
        except Exception as e:
            self._add_error(row, field, date_value, f"Invalid date: {str(e)}", "DATE_04")
            return None
    
    def validate_place_of_supply(self, pos: str, row: int, field: str = "Place of Supply") -> Optional[str]:
        """Validate place of supply is valid state code.
        
        Error Codes: POS_01, POS_02
        """
        if not pos or pd.isna(pos) or str(pos).strip() == "":
            self._add_error(row, field, pos, "Place of supply is required", "POS_01")
            return None
        
        pos = str(pos).strip()
        
        # Format should be "XX-State Name" or just "XX"
        if "-" in pos:
            state_code = pos.split("-")[0].strip()
        else:
            state_code = pos[:2] if len(pos) >= 2 else pos
        
        if state_code not in VALID_STATE_CODES:
            self._add_error(row, field, pos, 
                f"Invalid place of supply state code: {state_code}. Valid codes: 01-38, 96", "POS_02")
            return None
        
        return pos
    
    def validate_invoice_value(self, value: Any, row: int, field: str = "Invoice Value") -> Optional[float]:
        """Validate invoice value is positive and within limits.
        
        Error Codes: INV_01 to INV_04
        """
        if value is None or pd.isna(value):
            self._add_error(row, field, value, "Invoice value is required", "INV_01")
            return None
        
        try:
            float_value = float(value)
            if float_value <= 0:
                self._add_error(row, field, value, "Invoice value must be greater than zero", "INV_02")
                return None
            if float_value > MAX_INVOICE_VALUE:
                self._add_error(row, field, value, 
                    f"Invoice value exceeds maximum allowed: {MAX_INVOICE_VALUE}", "INV_03")
                return None
            return float_value
        except (ValueError, TypeError):
            self._add_error(row, field, value, "Invalid invoice value format", "INV_04")
            return None
    
    def validate_tax_rate(self, rate: Any, row: int, field: str = "Tax Rate") -> Optional[float]:
        """Validate tax rate is valid GST rate.
        
        Error Codes: TAX_01 to TAX_04
        """
        if rate is None or pd.isna(rate):
            self._add_error(row, field, rate, "Tax rate is required", "TAX_01")
            logger.warning(f"Row {row}: Tax rate is required")
            return None
        
        try:
            float_rate = float(rate)
            if float_rate < 0:
                self._add_error(row, field, rate, "Tax rate cannot be negative", "TAX_02")
                logger.warning(f"Row {row}: Negative tax rate {float_rate}%")
                return None
            if float_rate > 100:
                self._add_error(row, field, rate, "Tax rate cannot exceed 100%", "TAX_03")
                logger.warning(f"Row {row}: Tax rate {float_rate}% exceeds 100%")
                return None
            # Check if rate is standard GST rate (allow any rate for flexibility)
            if float_rate not in VALID_TAX_RATES and float_rate not in [2.5, 6, 9, 14, 15, 20, 25, 30, 35]:
                self._add_warning(f"Row {row}: Non-standard tax rate {float_rate}% (custom rate)")
                logger.info(f"Row {row}: Non-standard tax rate {float_rate}%")
            logger.debug(f"Row {row}: Tax rate {float_rate}% validated successfully")
            return float_rate
        except (ValueError, TypeError) as e:
            logger.error(f"Row {row}: Invalid tax rate format: {rate} - {str(e)}")
            logger.exception("Tax rate validation error traceback:")
            self._add_error(row, field, rate, "Invalid tax rate format", "TAX_04")
            return None
    
    def validate_amount(self, amount: Any, row: int, field: str = "Amount") -> Optional[float]:
        """Validate amount is non-negative.
        
        Error Codes: AMT_01, AMT_02
        """
        if amount is None or pd.isna(amount):
            return 0.0
        
        try:
            float_amount = float(amount)
            if float_amount < 0:
                self._add_error(row, field, amount, "Amount cannot be negative", "AMT_01")
                return None
            return float_amount
        except (ValueError, TypeError):
            self._add_error(row, field, amount, "Invalid amount format", "AMT_02")
            return None
    
    def validate_tax_amounts(
        self, 
        taxable_value: float, 
        tax_rate: float, 
        igst_amount: float, 
        cgst_amount: float, 
        sgst_amount: float, 
        cess_amount: float,
        row: int,
        place_of_supply: str,
    ) -> bool:
        """
        Validate that tax amounts match calculated values based on rate.
        
        Rules:
        - For inter-state: IGST = taxable_value * rate/100, CGST/SGST = 0
        - For intra-state: CGST + SGST = taxable_value * rate/100, IGST = 0
        - For exports: IGST = taxable_value * rate/100
        
        Error Codes: TAX_IGST_XX, TAX_CGST_XX, TAX_SGST_XX, TAX_INTRA_XX
        """
        if taxable_value <= 0:
            return True  # Skip validation for zero value
        
        tolerance = 1.0  # Allow small rounding differences (₹1)
        
        # Determine if inter-state
        is_inter_state = True
        if self.company_gstin and place_of_supply and len(place_of_supply) >= 2:
            company_state = self.company_gstin[:2]
            pos_code = place_of_supply.split("-")[0].strip() if "-" in place_of_supply else place_of_supply[:2]
            is_inter_state = company_state != pos_code
        elif place_of_supply == "96-Other Countries":
            is_inter_state = True
        
        if is_inter_state:
            # Inter-state: IGST should equal calculated value
            expected_igst = round(taxable_value * tax_rate / 100, 2)
            if abs(igst_amount - expected_igst) > tolerance:
                calculated = taxable_value * tax_rate / 100
                self._add_error(row, "IGST Amount", igst_amount,
                    f"IGST amount {igst_amount} does not match expected {expected_igst} (taxable: {taxable_value} × rate: {tax_rate}% = {calculated})",
                    "TAX_IGST_01")
                return False
            
            # CGST and SGST should be 0 for inter-state
            if cgst_amount > tolerance:
                self._add_error(row, "CGST Amount", cgst_amount,
                    f"CGST should be 0 for inter-state supply, found {cgst_amount}. Place of Supply: {place_of_supply}",
                    "TAX_CGST_01")
                return False
            if sgst_amount > tolerance:
                self._add_error(row, "SGST Amount", sgst_amount,
                    f"SGST should be 0 for inter-state supply, found {sgst_amount}. Place of Supply: {place_of_supply}",
                    "TAX_SGST_01")
                return False
        else:
            # Intra-state: CGST + SGST should equal calculated value
            expected_gst = taxable_value * tax_rate / 100
            actual_gst = cgst_amount + sgst_amount
            if abs(actual_gst - expected_gst) > tolerance:
                self._add_error(row, "CGST+SGST Amount", actual_gst,
                    f"CGST+SGST amount {actual_gst} does not match expected {expected_gst} (taxable: {taxable_value} × rate: {tax_rate}% = {expected_gst}). "
                    f"CGST: {cgst_amount}, SGST: {sgst_amount}",
                    "TAX_INTRA_01")
                return False
            
            # IGST should be 0 for intra-state
            if igst_amount > tolerance:
                self._add_error(row, "IGST Amount", igst_amount,
                    f"IGST should be 0 for intra-state supply, found {igst_amount}. Place of Supply: {place_of_supply}",
                    "TAX_IGST_02")
                return False
        
        return True
    
    def validate_invoice_number(self, invoice_no: Any, row: int, field: str = "Invoice Number") -> Optional[str]:
        """Validate invoice number format.
        
        Error Codes: INV_NO_01 to INV_NO_03
        """
        if not invoice_no or pd.isna(invoice_no) or str(invoice_no).strip() == "":
            self._add_error(row, field, invoice_no, "Invoice number is required", "INV_NO_01")
            return None
        
        invoice_str = str(invoice_no).strip()
        
        # Invoice number should be 1-16 characters
        if len(invoice_str) > 16:
            self._add_error(row, field, invoice_str, "Invoice number cannot exceed 16 characters", "INV_NO_02")
            return None
        
        # Check for invalid characters
        invalid_chars = set(invoice_str) - set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/_.")
        if invalid_chars:
            self._add_error(row, field, invoice_str, 
                f"Invoice number contains invalid characters: {invalid_chars}. Only alphanumeric and -/_/. are allowed",
                "INV_NO_03")
            return None
        
        return invoice_str
    
    def validate_reverse_charge(self, reverse_charge: Any, row: int) -> bool:
        """Validate reverse charge flag.
        
        Error Codes: RC_01
        """
        if reverse_charge is None or pd.isna(reverse_charge):
            return False
        
        rc_value = str(reverse_charge).strip().upper()
        if rc_value not in ["Y", "N"]:
            self._add_error(row, "Reverse Charge", reverse_charge,
                "Reverse charge must be 'Y' or 'N'", "RC_01")
            return False
        
        return rc_value == "Y"
    
    def validate_ecommerce_gstin(self, gstin: str, row: int) -> bool:
        """Validate e-commerce GSTIN if provided."""
        if not gstin or pd.isna(gstin) or str(gstin).strip() == "":
            return True  # Optional field
        
        return self.validate_gstin(gstin, row, "E-Commerce GSTIN")
    
    def _add_error(self, row: int, field: str, value: Any, message: str, error_code: str):
        """Add validation error to errors list."""
        self.errors.append({
            "row": row,
            "field": field,
            "value": str(value) if value else None,
            "message": message,
            "error_code": error_code,
        })
    
    def _add_warning(self, message: str):
        """Add warning to warnings list."""
        self.warnings.append(message)
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """Get summary of validation results."""
        return {
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "errors": self.errors,
            "warnings": self.warnings,
            "is_valid": len(self.errors) == 0,
        }
    
    def validate_sales_row(self, row: Dict[str, Any], row_num: int, company_gstin: str = "") -> List[Dict[str, Any]]:
        """
        Validate a single sales row before classification.
        
        Args:
            row: Dictionary containing sales row data
            row_num: Row number for error reporting
            company_gstin: Company's GSTIN for inter-state determination
            
        Returns:
            List of error dictionaries. Empty list means valid.
        """
        errors = []
        
        # Mandatory columns check
        mandatory_fields = {
            GovExcelField.GSTIN.value: "GSTIN",
            GovExcelField.INVOICE_NUMBER.value: "Invoice No",
            GovExcelField.INVOICE_DATE.value: "Invoice Date",
            GovExcelField.TAXABLE_VALUE.value: "Taxable Value",
        }
        
        # Check mandatory fields
        for field_key, field_name in mandatory_fields.items():
            value = row.get(field_key)
            if value is None or pd.isna(value) or str(value).strip() == "":
                errors.append({
                    "row": row_num,
                    "field": field_name,
                    "value": str(value) if value else None,
                    "message": f"{field_name} is required",
                    "error_code": f"MAND_{field_key}",
                })
        
        # If mandatory fields are missing, skip further validation
        if len(errors) >= len(mandatory_fields):
            return errors
        
        # Validate GSTIN format (15-digit pattern)
        gstin = str(row.get(GovExcelField.GSTIN.value, "")).strip()
        if gstin and gstin != "NA":
            if not self.validate_gstin(gstin, row_num, "GSTIN"):
                errors.append({
                    "row": row_num,
                    "field": "GSTIN",
                    "value": gstin,
                    "message": "Invalid GSTIN format. Must be 15 characters (e.g., 07BZAAH6384P1ZH)",
                    "error_code": "GSTIN_03",
                })
        
        # Validate Place of Supply (must match state codes)
        pos = row.get(GovExcelField.POS.value)
        if pos and not pd.isna(pos):
            pos_validated = self.validate_place_of_supply(pos, row_num)
            if not pos_validated:
                errors.append({
                    "row": row_num,
                    "field": "Place of Supply",
                    "value": str(pos),
                    "message": f"Invalid place of supply. Must be valid state code (e.g., 27-Maharashtra)",
                    "error_code": "POS_02",
                })
        
        # Validate Invoice Date (DD-MM-YYYY format, not future dated)
        invoice_date = row.get(GovExcelField.INVOICE_DATE.value)
        if invoice_date and not pd.isna(invoice_date):
            date_parsed = self.validate_date(invoice_date, row_num, "Invoice Date")
            if date_parsed and date_parsed > datetime.now():
                errors.append({
                    "row": row_num,
                    "field": "Invoice Date",
                    "value": str(invoice_date),
                    "message": "Invoice date cannot be in the future",
                    "error_code": "DATE_03",
                })
        
        # Validate Invoice Value (must be positive)
        invoice_value = row.get(GovExcelField.INVOICE_VALUE.value)
        if invoice_value is not None and not pd.isna(invoice_value):
            value_validated = self.validate_invoice_value(invoice_value, row_num)
            if value_validated is None:
                errors.append({
                    "row": row_num,
                    "field": "Invoice Value",
                    "value": str(invoice_value),
                    "message": "Invoice value must be greater than zero",
                    "error_code": "INV_02",
                })
        
        # Validate Tax Rate
        tax_rate = row.get(GovExcelField.TAX_RATE.value)
        if tax_rate is not None and not pd.isna(tax_rate):
            rate_validated = self.validate_tax_rate(tax_rate, row_num)
            if rate_validated is None:
                errors.append({
                    "row": row_num,
                    "field": "Tax Rate",
                    "value": str(tax_rate),
                    "message": "Invalid tax rate",
                    "error_code": "TAX_04",
                })
        
        # Validate Amount fields (Taxable Value, IGST, CGST, SGST, CESS)
        amount_fields = {
            GovExcelField.TAXABLE_VALUE.value: "Taxable Value",
            GovExcelField.IGST.value: "IGST Amount",
            GovExcelField.CGST.value: "CGST Amount",
            GovExcelField.SGST.value: "SGST Amount",
            GovExcelField.CESS.value: "CESS Amount",
        }
        
        for field_key, field_name in amount_fields.items():
            amount = row.get(field_key)
            if amount is not None and not pd.isna(amount):
                amount_validated = self.validate_amount(amount, row_num, field_name)
                if amount_validated is None:
                    errors.append({
                        "row": row_num,
                        "field": field_name,
                        "value": str(amount),
                        "message": f"Invalid {field_name.lower()} format",
                        "error_code": "AMT_02",
                    })
        
        # Validate Reverse Charge if present
        reverse_charge = row.get(GovExcelField.REVERSE_CHARGE.value)
        if reverse_charge is not None and not pd.isna(reverse_charge):
            if not self.validate_reverse_charge(reverse_charge, row_num):
                errors.append({
                    "row": row_num,
                    "field": "Reverse Charge",
                    "value": str(reverse_charge),
                    "message": "Reverse charge must be 'Y' or 'N'",
                    "error_code": "RC_01",
                })
        
        # Validate E-Commerce GSTIN if present
        ecommerce_gstin = row.get(GovExcelField.ECOMMERCE_GSTIN.value)
        if ecommerce_gstin and not pd.isna(ecommerce_gstin) and str(ecommerce_gstin).strip():
            if not self.validate_ecommerce_gstin(str(ecommerce_gstin).strip(), row_num):
                errors.append({
                    "row": row_num,
                    "field": "E-Commerce GSTIN",
                    "value": str(ecommerce_gstin),
                    "message": "Invalid E-Commerce GSTIN format",
                    "error_code": "GSTIN_03",
                })
        
        return errors


class GSTR1ExcelProcessor:
    """Processor for GSTR-1 Excel files with comprehensive validations."""
    
    def __init__(self, company_gstin: str = ""):
        self.validator = GSTR1Validator(company_gstin)
        self.errors: List[Dict[str, str]] = []
        self.warnings: List[str] = []
        self.company_gstin = company_gstin
    
    def validate_gstin(self, gstin: str) -> bool:
        """Validate GSTIN format."""
        if not gstin or pd.isna(gstin):
            return False
        gstin = str(gstin).strip().upper()
        return bool(GSTIN_PATTERN.match(gstin))
    
    def validate_date(self, date_value: Any) -> Optional[str]:
        """Validate and format date."""
        if not date_value or pd.isna(date_value):
            return None
        try:
            if isinstance(date_value, datetime):
                return date_value.strftime("%d/%m/%Y")
            # Try parsing various date formats
            for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"]:
                try:
                    parsed = datetime.strptime(str(date_value), fmt)
                    return parsed.strftime("%d/%m/%Y")
                except ValueError:
                    continue
            return str(date_value)
        except Exception:
            return str(date_value)
    
    def validate_tax_rate(self, rate: Any) -> float:
        """Validate and return tax rate."""
        if not rate or pd.isna(rate):
            return 0.0
        try:
            return float(rate)
        except (ValueError, TypeError):
            return 0.0
    
    def validate_amount(self, amount: Any) -> float:
        """Validate and return amount."""
        if not amount or pd.isna(amount):
            return 0.0
        try:
            return float(amount)
        except (ValueError, TypeError):
            return 0.0
    
    def classify_invoice(
        self, row: pd.Series, company_gstin: str = ""
    ) -> Dict[str, Any]:
        """Classify invoice into GSTR-1 categories."""
        customer_gstin = str(row.get(GovExcelField.CUST_GSTIN.value, "")).strip()
        place_of_supply = str(row.get(GovExcelField.POS.value, "")).strip()
        invoice_value = self.validate_amount(row.get(GovExcelField.INVOICE_VALUE.value, 0))
        
        is_inter_state = False
        if company_gstin and len(company_gstin) >= 2:
            company_state = company_gstin[:2]
            if place_of_supply and len(place_of_supply) >= 2:
                customer_state = place_of_supply[:2]
                is_inter_state = company_state != customer_state
            elif place_of_supply == "96-Other Countries":
                is_inter_state = True
        
        has_gstin = bool(customer_gstin) and customer_gstin != "NA"
        is_export = place_of_supply == "96-Other Countries"
        
        # Classify based on criteria
        if has_gstin and not is_export:
            if invoice_value > 250000 and is_inter_state:
                return {"category": "b2cl", "invoice_type": "R"}
            return {"category": "b2b", "invoice_type": "R"}
        elif is_export:
            return {"category": "exp", "invoice_type": "WPAY"}
        elif invoice_value > 250000 and is_inter_state:
            return {"category": "b2cl", "invoice_type": "R"}
        else:
            return {"category": "b2cs", "invoice_type": "OE"}
    
    def process_b2b_sheet(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process B2B invoices sheet with validations."""
        logger.debug(f"Starting B2B sheet processing: {len(df)} rows")
        invoices = []
        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel row number (1-indexed + header)
            customer_gstin = str(row.get(GovExcelField.CUST_GSTIN.value, "")).strip()
            
            # Skip rows without GSTIN
            if not customer_gstin or customer_gstin == "NA":
                continue
            
            # Validate GSTIN
            if not self.validator.validate_gstin(customer_gstin, row_num):
                continue
            
            # Validate invoice number
            invoice_no = self.validator.validate_invoice_number(
                row.get(GovExcelField.INVOICE_NUMBER.value), row_num
            )
            if not invoice_no:
                continue
            
            # Validate invoice date
            invoice_date = self.validator.validate_date(
                row.get(GovExcelField.INVOICE_DATE.value), row_num
            )
            if not invoice_date:
                continue
            
            # Validate invoice value
            invoice_value = self.validator.validate_invoice_value(
                row.get(GovExcelField.INVOICE_VALUE.value), row_num
            )
            if invoice_value is None:
                continue
            
            # Validate place of supply
            place_of_supply = self.validator.validate_place_of_supply(
                row.get(GovExcelField.POS.value), row_num
            )
            if not place_of_supply:
                continue
            
            # Validate tax rate
            tax_rate = self.validator.validate_tax_rate(
                row.get(GovExcelField.TAX_RATE.value), row_num
            )
            if tax_rate is None:
                continue
            
            # Get amounts
            taxable_value = self.validator.validate_amount(
                row.get(GovExcelField.TAXABLE_VALUE.value), row_num
            )
            igst_amount = self.validator.validate_amount(
                row.get(GovExcelField.IGST.value), row_num
            )
            cgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.CGST.value), row_num
            )
            sgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.SGST.value), row_num
            )
            cess_amount = self.validator.validate_amount(
                row.get(GovExcelField.CESS.value), row_num
            )
            
            # Validate tax amounts
            self.validator.validate_tax_amounts(
                taxable_value, tax_rate, igst_amount, cgst_amount, sgst_amount,
                cess_amount, row_num, place_of_supply
            )
            
            invoice = {
                "invoice_no": invoice_no,
                "invoice_date": invoice_date,
                "invoice_value": invoice_value,
                "place_of_supply": place_of_supply,
                "reverse_charge": self.validator.validate_reverse_charge(
                    row.get(GovExcelField.REVERSE_CHARGE.value), row_num
                ),
                "invoice_type": str(row.get(GovExcelField.INVOICE_TYPE.value, "Regular B2B")).strip(),
                "ecommerce_gstin": str(row.get(GovExcelField.ECOMMERCE_GSTIN.value, "")).strip(),
                "customer": {
                    "gstin": customer_gstin,
                    "name": str(row.get(GovExcelField.CUST_NAME.value, "")).strip(),
                },
                "items": [{
                    "taxable_value": taxable_value,
                    "igst_amount": igst_amount,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "cess_amount": cess_amount,
                    "tax_rate": tax_rate,
                }],
            }
            invoices.append(invoice)
        
        logger.debug(f"B2B sheet processing complete: {len(invoices)} valid invoices")
        # Collect errors and warnings
        self.errors.extend(self.validator.errors)
        self.warnings.extend(self.validator.warnings)
        return invoices
    
    def process_b2cs_sheet(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process B2C (Others) invoices sheet with validations."""
        logger.debug(f"Starting B2CS sheet processing: {len(df)} rows")
        invoices = []
        for idx, row in df.iterrows():
            row_num = idx + 2
            
            # Validate place of supply
            place_of_supply = self.validator.validate_place_of_supply(
                row.get(GovExcelField.POS.value), row_num
            )
            if not place_of_supply:
                continue
            
            # Validate invoice date
            invoice_date = self.validator.validate_date(
                row.get(GovExcelField.INVOICE_DATE.value), row_num
            )
            if not invoice_date:
                continue
            
            # Validate invoice value
            invoice_value = self.validator.validate_invoice_value(
                row.get(GovExcelField.INVOICE_VALUE.value), row_num
            )
            if invoice_value is None:
                continue
            
            # Validate tax rate
            tax_rate = self.validator.validate_tax_rate(
                row.get(GovExcelField.TAX_RATE.value), row_num
            )
            if tax_rate is None:
                continue
            
            # Get amounts
            taxable_value = self.validator.validate_amount(
                row.get(GovExcelField.TAXABLE_VALUE.value), row_num
            )
            igst_amount = self.validator.validate_amount(
                row.get(GovExcelField.IGST.value), row_num
            )
            cgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.CGST.value), row_num
            )
            sgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.SGST.value), row_num
            )
            cess_amount = self.validator.validate_amount(
                row.get(GovExcelField.CESS.value), row_num
            )
            
            # Validate tax amounts
            self.validator.validate_tax_amounts(
                taxable_value, tax_rate, igst_amount, cgst_amount, sgst_amount,
                cess_amount, row_num, place_of_supply
            )
            
            invoice = {
                "invoice_no": str(idx + 1).zfill(4),
                "invoice_date": invoice_date,
                "invoice_value": invoice_value,
                "place_of_supply": place_of_supply,
                "invoice_type": str(row.get(GovExcelField.INVOICE_TYPE.value, "OE")).strip(),
                "ecommerce_gstin": str(row.get(GovExcelField.ECOMMERCE_GSTIN.value, "")).strip(),
                "items": [{
                    "taxable_value": taxable_value,
                    "igst_amount": igst_amount,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "cess_amount": cess_amount,
                    "tax_rate": tax_rate,
                }],
            }
            invoices.append(invoice)
        
        logger.debug(f"B2CS sheet processing complete: {len(invoices)} valid invoices")
        self.errors.extend(self.validator.errors)
        self.warnings.extend(self.validator.warnings)
        return invoices
    
    def process_b2cl_sheet(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process B2C (Large) invoices sheet with validations."""
        logger.debug(f"Starting B2CL sheet processing: {len(df)} rows")
        invoices = []
        for idx, row in df.iterrows():
            row_num = idx + 2
            
            # Validate invoice number
            invoice_no = self.validator.validate_invoice_number(
                row.get(GovExcelField.INVOICE_NUMBER.value), row_num
            )
            if not invoice_no:
                continue
            
            # Validate invoice date
            invoice_date = self.validator.validate_date(
                row.get(GovExcelField.INVOICE_DATE.value), row_num
            )
            if not invoice_date:
                continue
            
            # Validate invoice value
            invoice_value = self.validator.validate_invoice_value(
                row.get(GovExcelField.INVOICE_VALUE.value), row_num
            )
            if invoice_value is None:
                continue
            
            # Validate place of supply
            place_of_supply = self.validator.validate_place_of_supply(
                row.get(GovExcelField.POS.value), row_num
            )
            if not place_of_supply:
                continue
            
            # Validate tax rate
            tax_rate = self.validator.validate_tax_rate(
                row.get(GovExcelField.TAX_RATE.value), row_num
            )
            if tax_rate is None:
                continue
            
            # Get amounts
            taxable_value = self.validator.validate_amount(
                row.get(GovExcelField.TAXABLE_VALUE.value), row_num
            )
            igst_amount = self.validator.validate_amount(
                row.get(GovExcelField.IGST.value), row_num
            )
            cgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.CGST.value), row_num
            )
            sgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.SGST.value), row_num
            )
            cess_amount = self.validator.validate_amount(
                row.get(GovExcelField.CESS.value), row_num
            )
            
            # Validate tax amounts
            self.validator.validate_tax_amounts(
                taxable_value, tax_rate, igst_amount, cgst_amount, sgst_amount,
                cess_amount, row_num, place_of_supply
            )
            
            customer_gstin = str(row.get(GovExcelField.CUST_GSTIN.value, "")).strip()
            invoice = {
                "invoice_no": invoice_no,
                "invoice_date": invoice_date,
                "invoice_value": invoice_value,
                "place_of_supply": place_of_supply,
                "invoice_type": str(row.get(GovExcelField.INVOICE_TYPE.value, "R")).strip(),
                "ecommerce_gstin": str(row.get(GovExcelField.ECOMMERCE_GSTIN.value, "")).strip(),
                "customer": {
                    "gstin": customer_gstin if customer_gstin and customer_gstin != "NA" else "",
                    "name": str(row.get(GovExcelField.CUST_NAME.value, "")).strip(),
                },
                "items": [{
                    "taxable_value": taxable_value,
                    "igst_amount": igst_amount,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "cess_amount": cess_amount,
                    "tax_rate": tax_rate,
                }],
                "shipping_bill": {
                    "bill_no": str(row.get(GovExcelField.SHIPPING_BILL_NO.value, "")).strip(),
                    "bill_date": self.validator.validate_date(
                        row.get(GovExcelField.SHIPPING_BILL_DATE.value), row_num
                    ),
                    "port_code": str(row.get(GovExcelField.PORT_CODE.value, "")).strip(),
                },
            }
            invoices.append(invoice)
        
        logger.debug(f"B2CL sheet processing complete: {len(invoices)} valid invoices")
        self.errors.extend(self.validator.errors)
        self.warnings.extend(self.validator.warnings)
        return invoices
    
    def process_export_sheet(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process Export invoices sheet with validations."""
        logger.debug(f"Starting Export sheet processing: {len(df)} rows")
        invoices = []
        for idx, row in df.iterrows():
            row_num = idx + 2
            
            # Validate invoice number
            invoice_no = self.validator.validate_invoice_number(
                row.get(GovExcelField.INVOICE_NUMBER.value), row_num
            )
            if not invoice_no:
                continue
            
            # Validate invoice date
            invoice_date = self.validator.validate_date(
                row.get(GovExcelField.INVOICE_DATE.value), row_num
            )
            if not invoice_date:
                continue
            
            # Validate invoice value
            invoice_value = self.validator.validate_invoice_value(
                row.get(GovExcelField.INVOICE_VALUE.value), row_num
            )
            if invoice_value is None:
                continue
            
            # Validate tax rate
            tax_rate = self.validator.validate_tax_rate(
                row.get(GovExcelField.TAX_RATE.value), row_num
            )
            if tax_rate is None:
                continue
            
            # Get amounts
            taxable_value = self.validator.validate_amount(
                row.get(GovExcelField.TAXABLE_VALUE.value), row_num
            )
            igst_amount = self.validator.validate_amount(
                row.get(GovExcelField.IGST.value), row_num
            )
            cgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.CGST.value), row_num
            )
            sgst_amount = self.validator.validate_amount(
                row.get(GovExcelField.SGST.value), row_num
            )
            cess_amount = self.validator.validate_amount(
                row.get(GovExcelField.CESS.value), row_num
            )
            
            # Validate tax amounts (exports are always inter-state)
            self.validator.validate_tax_amounts(
                taxable_value, tax_rate, igst_amount, cgst_amount, sgst_amount,
                cess_amount, row_num, "96-Other Countries"
            )
            
            invoice_type_val = str(row.get(GovExcelField.INVOICE_TYPE.value, "")).upper()
            invoice_type = "WPAY" if "WP" in invoice_type_val else "WOPAY"
            
            invoice = {
                "invoice_no": invoice_no,
                "invoice_date": invoice_date,
                "invoice_value": invoice_value,
                "place_of_supply": "96-Other Countries",
                "invoice_type": invoice_type,
                "ecommerce_gstin": "",
                "customer": {
                    "gstin": "",
                    "name": str(row.get(GovExcelField.CUST_NAME.value, "")).strip(),
                },
                "items": [{
                    "taxable_value": taxable_value,
                    "igst_amount": igst_amount,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "cess_amount": cess_amount,
                    "tax_rate": tax_rate,
                }],
                "shipping_bill": {
                    "bill_no": str(row.get(GovExcelField.SHIPPING_BILL_NO.value, "")).strip(),
                    "bill_date": self.validator.validate_date(
                        row.get(GovExcelField.SHIPPING_BILL_DATE.value), row_num
                    ),
                    "port_code": str(row.get(GovExcelField.PORT_CODE.value, "")).strip(),
                },
            }
            invoices.append(invoice)
        
        logger.debug(f"Export sheet processing complete: {len(invoices)} valid invoices")
        self.errors.extend(self.validator.errors)
        self.warnings.extend(self.validator.warnings)
        return invoices
    
    def calculate_summary(self, data: Dict[str, List]) -> Dict[str, Any]:
        """Calculate GSTR-1 summary from processed data."""
        summary = {
            "total_taxable_value": 0,
            "total_igst": 0,
            "total_cgst": 0,
            "total_sgst": 0,
            "total_cess": 0,
            "total_invoices": 0,
            "b2b_count": 0,
            "b2cl_count": 0,
            "b2cs_count": 0,
            "exp_count": 0,
            "cdnr_count": 0,
        }
        
        # Process B2B invoices
        for invoice in data.get("b2b", []):
            for item in invoice.get("items", []):
                summary["total_taxable_value"] += item["taxable_value"]
                summary["total_igst"] += item["igst_amount"]
                summary["total_cgst"] += item["cgst_amount"]
                summary["total_sgst"] += item["sgst_amount"]
                summary["total_cess"] += item["cess_amount"]
            summary["total_invoices"] += 1
            summary["b2b_count"] += 1
        
        # Process B2CL invoices
        for invoice in data.get("b2cl", []):
            for item in invoice.get("items", []):
                summary["total_taxable_value"] += item["taxable_value"]
                summary["total_igst"] += item["igst_amount"]
                summary["total_cgst"] += item["cgst_amount"]
                summary["total_sgst"] += item["sgst_amount"]
                summary["total_cess"] += item["cess_amount"]
            summary["total_invoices"] += 1
            summary["b2cl_count"] += 1
        
        # Process B2CS invoices
        for invoice in data.get("b2cs", []):
            for item in invoice.get("items", []):
                summary["total_taxable_value"] += item["taxable_value"]
                summary["total_igst"] += item["igst_amount"]
                summary["total_cgst"] += item["cgst_amount"]
                summary["total_sgst"] += item["sgst_amount"]
                summary["total_cess"] += item["cess_amount"]
            summary["total_invoices"] += 1
            summary["b2cs_count"] += 1
        
        # Process Export invoices
        for invoice in data.get("export", []):
            for item in invoice.get("items", []):
                summary["total_taxable_value"] += item["taxable_value"]
                summary["total_igst"] += item["igst_amount"]
                summary["total_cgst"] += item["cgst_amount"]
                summary["total_sgst"] += item["sgst_amount"]
                summary["total_cess"] += item["cess_amount"]
            summary["total_invoices"] += 1
            summary["exp_count"] += 1
        
        # Process CDNR invoices
        for invoice in data.get("cdnr", []):
            for item in invoice.get("items", []):
                summary["total_taxable_value"] += item["taxable_value"]
                summary["total_igst"] += item["igst_amount"]
                summary["total_cgst"] += item["cgst_amount"]
                summary["total_sgst"] += item["sgst_amount"]
                summary["total_cess"] += item["cess_amount"]
            summary["total_invoices"] += 1
            summary["cdnr_count"] += 1
        
        # Round values
        for key in summary:
            if isinstance(summary[key], float):
                summary[key] = round(summary[key], 2)
        
        return summary
    
    def process_excel(self, file_content: bytes) -> Dict[str, Any]:
        """
        Process Excel file and return GSTR-1 data with comprehensive validations.
        
        Args:
            file_content: Excel file content as bytes
            
        Returns:
            Dictionary containing GSTR-1 categorized data and summary with validation results
        """
        self.errors = []
        self.warnings = []
        self.validator.errors = []
        self.validator.warnings = []
        
        logger.info(f"Processing Excel file ({len(file_content)} bytes)")
        
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_content))
            logger.info(f"Excel file loaded successfully. Sheets: {excel_file.sheet_names}")
        except Exception as e:
            logger.error(f"Failed to read Excel file: {str(e)}")
            raise ValueError(f"Failed to read Excel file: {str(e)}")
        
        result = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
            "nil_exempt": [],
            "summary": {},
            "errors": [],
            "warnings": [],
            "validation_summary": {},
        }
        
        # Process B2B sheet
        if GovExcelSheetName.B2B.value in excel_file.sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=GovExcelSheetName.B2B.value)
                logger.info(f"Processing B2B sheet: {len(df)} rows")
                result["b2b"] = self.process_b2b_sheet(df)
                logger.info(f"Processed {len(result['b2b'])} valid B2B invoices")
            except Exception as e:
                logger.error(f"Failed to process B2B sheet: {str(e)}")
                self.warnings.append(f"Failed to process B2B sheet: {str(e)}")
        
        # Process B2CL sheet
        if GovExcelSheetName.B2CL.value in excel_file.sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=GovExcelSheetName.B2CL.value)
                logger.info(f"Processing B2CL sheet: {len(df)} rows")
                result["b2cl"] = self.process_b2cl_sheet(df)
                logger.info(f"Processed {len(result['b2cl'])} valid B2CL invoices")
            except Exception as e:
                logger.error(f"Failed to process B2CL sheet: {str(e)}")
                self.warnings.append(f"Failed to process B2CL sheet: {str(e)}")
        
        # Process B2CS sheet
        if GovExcelSheetName.B2CS.value in excel_file.sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=GovExcelSheetName.B2CS.value)
                logger.info(f"Processing B2CS sheet: {len(df)} rows")
                result["b2cs"] = self.process_b2cs_sheet(df)
                logger.info(f"Processed {len(result['b2cs'])} valid B2CS invoices")
            except Exception as e:
                logger.error(f"Failed to process B2CS sheet: {str(e)}")
                self.warnings.append(f"Failed to process B2CS sheet: {str(e)}")
        
        # Process Export sheet
        if GovExcelSheetName.EXP.value in excel_file.sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=GovExcelSheetName.EXP.value)
                logger.info(f"Processing Export sheet: {len(df)} rows")
                result["export"] = self.process_export_sheet(df)
                logger.info(f"Processed {len(result['export'])} valid Export invoices")
            except Exception as e:
                logger.error(f"Failed to process Export sheet: {str(e)}")
                self.warnings.append(f"Failed to process Export sheet: {str(e)}")
        
        # Calculate summary
        result["summary"] = self.calculate_summary(result)
        result["errors"] = self.errors
        result["warnings"] = self.warnings
        result["validation_summary"] = self.validator.get_validation_summary()
        
        # Log summary
        logger.info(f"Processing complete. Total invoices: {result['summary']['total_invoices']}")
        logger.info(f"Total taxable value: {result['summary']['total_taxable_value']}")
        logger.info(f"Validation errors: {result['validation_summary']['total_errors']}")
        logger.info(f"Validation warnings: {result['validation_summary']['total_warnings']}")
        
        return result
    
    def get_validation_report(self) -> Dict[str, Any]:
        """Get comprehensive validation report."""
        return {
            "errors": self.errors,
            "warnings": self.warnings,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "is_valid": len(self.errors) == 0,
        }


def process_gstr1_excel(file_content: bytes, company_gstin: str = "") -> Dict[str, Any]:
    """
    Process a GSTR-1 Excel file and return categorized data with validations.
    
    Args:
        file_content: Excel file content as bytes
        company_gstin: Company's GSTIN for inter-state/intra-state determination
        
    Returns:
        {
            "b2b": [...],
            "b2cl": [...],
            "b2cs": [...],
            "export": [...],
            "cdnr": [...],
            "cdnur": [...],
            "nil_exempt": [...],
            "summary": {
                "total_taxable_value": ...,
                "total_igst": ...,
                "total_cgst": ...,
                "total_sgst": ...,
                "total_cess": ...,
                "total_invoices": ...,
            },
            "errors": [...],
            "warnings": [...],
            "validation_summary": {
                "total_errors": ...,
                "total_warnings": ...,
                "is_valid": ...,
            }
        }
    """
    processor = GSTR1ExcelProcessor(company_gstin)
    return processor.process_excel(file_content)
