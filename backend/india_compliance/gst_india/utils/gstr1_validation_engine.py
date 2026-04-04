"""
GSTR-1 Validation Engine

This module provides comprehensive validation for GSTR-1 invoice data against GST rules.

Validation Rules:
1. GSTIN Validation - GSTIN must be exactly 15 characters
2. Invoice Duplicate Validation - Check for duplicate invoice numbers in database
3. Tax Calculation Validation - Verify tax amount matches expected tax (tolerance: ±1 rupee)
4. HSN Validation - HSN code must be 4-8 digits
5. Date Validation - Invoice date cannot be greater than today
6. Place of Supply Validation - POS must be valid Indian state code
7. Negative Value Validation - Taxable value must be > 0
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
import re


# Valid Indian state codes for Place of Supply validation
VALID_STATE_CODES = {
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
    '31', '32', '33', '34', '35', '36', '97'  # 97 is for Other Territory
}

# State code to name mapping (for error messages)
STATE_CODES = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '97': 'Other Territory'
}


class InvoiceValidator:
    """
    Validator for GSTR-1 invoice data.
    
    Performs comprehensive validation against GST rules and regulations.
    """
    
    def __init__(self):
        self.errors: List[Dict[str, str]] = []
        self.warnings: List[Dict[str, str]] = []
    
    def reset(self):
        """Reset the validator state"""
        self.errors = []
        self.warnings = []
    
    def validate_gstin(self, gstin: Optional[str], invoice_no: str, field_name: str = 'customer_gstin') -> bool:
        """
        Validate GSTIN format.
        
        Rules:
        - GSTIN must be exactly 15 characters
        - Format: 2 digits (state code) + 10 characters (PAN) + 1 character (entity number) + 1 character (Z) + 1 character (checksum)
        """
        if not gstin:
            return True  # GSTIN is optional for B2CS invoices
        
        if len(gstin) != 15:
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': f'Invalid GSTIN: Must be exactly 15 characters, got {len(gstin)}',
                'error_code': 'GSTIN_LENGTH'
            })
            return False
        
        # Basic format validation
        # First 2 digits should be state code
        state_code = gstin[:2]
        if not state_code.isdigit() or state_code not in VALID_STATE_CODES:
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': f'Invalid GSTIN: Invalid state code "{state_code}"',
                'error_code': 'GSTIN_STATE_CODE'
            })
            return False
        
        # Characters 3-12 should be PAN (alphanumeric)
        pan = gstin[2:12]
        if not pan.isalnum():
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': 'Invalid GSTIN: PAN portion must be alphanumeric',
                'error_code': 'GSTIN_PAN'
            })
            return False
        
        # 13th character should be entity number (1-9)
        entity_num = gstin[12]
        if not entity_num.isdigit() or entity_num == '0':
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': 'Invalid GSTIN: Entity number must be 1-9',
                'error_code': 'GSTIN_ENTITY'
            })
            return False
        
        # 14th character should be Z
        if gstin[13] != 'Z':
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': 'Invalid GSTIN: 14th character must be Z',
                'error_code': 'GSTIN_Z'
            })
            return False
        
        # 15th character should be checksum (alphanumeric)
        if not gstin[14].isalnum():
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': 'Invalid GSTIN: Checksum must be alphanumeric',
                'error_code': 'GSTIN_CHECKSUM'
            })
            return False
        
        return True
    
    def validate_invoice_duplicate(self, invoice_no: str, existing_invoices: List[str]) -> bool:
        """
        Check for duplicate invoice numbers.
        
        Rules:
        - Invoice number should not already exist in the database
        """
        if invoice_no in existing_invoices:
            self.errors.append({
                'invoice': invoice_no,
                'field': 'invoice_no',
                'error': f'Duplicate invoice: Invoice number "{invoice_no}" already exists',
                'error_code': 'INVOICE_DUPLICATE'
            })
            return False
        return True
    
    def validate_tax_calculation(
        self,
        taxable_value: float,
        gst_rate: float,
        tax_amount: float,
        invoice_no: str,
        field_name: str = 'tax_amount'
    ) -> bool:
        """
        Validate tax calculation.
        
        Rules:
        - Expected tax = taxable_value × gst_rate / 100
        - Tolerance: ±1 rupee
        """
        if taxable_value is None or gst_rate is None or tax_amount is None:
            return True  # Skip if values are missing
        
        expected_tax = round(taxable_value * gst_rate / 100, 2)
        
        if abs(expected_tax - tax_amount) > 1:
            self.errors.append({
                'invoice': invoice_no,
                'field': field_name,
                'error': f'Tax mismatch: Expected ₹{expected_tax:.2f} (₹{taxable_value:.2f} × {gst_rate}%), but got ₹{tax_amount:.2f}',
                'error_code': 'TAX_MISMATCH'
            })
            return False
        return True
    
    def validate_hsn(self, hsn_code: Optional[str], invoice_no: str) -> bool:
        """
        Validate HSN code.
        
        Rules:
        - HSN code must be 4-8 digits
        """
        if not hsn_code:
            return True  # HSN is optional
        
        hsn_str = str(hsn_code).strip()
        
        if not hsn_str.isdigit():
            self.errors.append({
                'invoice': invoice_no,
                'field': 'hsn_code',
                'error': f'Invalid HSN: Must be numeric, got "{hsn_code}"',
                'error_code': 'HSN_FORMAT'
            })
            return False
        
        if len(hsn_str) < 4 or len(hsn_str) > 8:
            self.errors.append({
                'invoice': invoice_no,
                'field': 'hsn_code',
                'error': f'Invalid HSN: Must be 4-8 digits, got {len(hsn_str)} digits',
                'error_code': 'HSN_LENGTH'
            })
            return False
        
        return True
    
    def validate_date(self, invoice_date: str, invoice_no: str) -> bool:
        """
        Validate invoice date.
        
        Rules:
        - Invoice date cannot be greater than today
        """
        if not invoice_date:
            return True  # Date is optional
        
        try:
            # Try multiple date formats
            date_formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d%m%Y']
            parsed_date = None
            
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(str(invoice_date).strip(), fmt)
                    break
                except ValueError:
                    continue
            
            if parsed_date is None:
                self.warnings.append({
                    'invoice': invoice_no,
                    'field': 'invoice_date',
                    'error': f'Unable to parse date: "{invoice_date}"',
                    'error_code': 'DATE_PARSE'
                })
                return True  # Warning, not error
            
            today = datetime.now()
            
            # Compare dates only (ignore time)
            if parsed_date.date() > today.date():
                self.errors.append({
                    'invoice': invoice_no,
                    'field': 'invoice_date',
                    'error': f'Invalid date: Invoice date "{invoice_date}" cannot be greater than today',
                    'error_code': 'DATE_FUTURE'
                })
                return False
            
            return True
        except Exception as e:
            self.warnings.append({
                'invoice': invoice_no,
                'field': 'invoice_date',
                'error': f'Date validation error: {str(e)}',
                'error_code': 'DATE_ERROR'
            })
            return True
    
    def validate_place_of_supply(self, pos: Optional[str], invoice_no: str) -> bool:
        """
        Validate Place of Supply.
        
        Rules:
        - POS must be a valid Indian state code
        """
        if not pos:
            return True  # POS is optional
        
        pos_str = str(pos).strip()
        
        # Handle format like "27-Maharashtra" or just "27"
        if '-' in pos_str:
            pos_code = pos_str.split('-')[0]
        else:
            pos_code = pos_str
        
        if pos_code not in VALID_STATE_CODES:
            state_name = STATE_CODES.get(pos_code, 'Unknown')
            self.errors.append({
                'invoice': invoice_no,
                'field': 'place_of_supply',
                'error': f'Invalid POS: "{pos}" is not a valid state code. Valid codes are 01-36 and 97.',
                'error_code': 'POS_INVALID'
            })
            return False
        
        return True
    
    def validate_negative_values(self, taxable_value: float, invoice_no: str) -> bool:
        """
        Validate negative values.
        
        Rules:
        - Taxable value must be > 0
        """
        if taxable_value is None:
            return True  # Skip if value is missing
        
        if taxable_value <= 0:
            self.errors.append({
                'invoice': invoice_no,
                'field': 'taxable_value',
                'error': f'Invalid taxable value: Must be greater than 0, got {taxable_value}',
                'error_code': 'NEGATIVE_VALUE'
            })
            return False
        
        return True
    
    def validate_invoice(self, invoice: Dict[str, Any], existing_invoices: List[str]) -> None:
        """
        Validate a single invoice against all rules.
        
        Args:
            invoice: Invoice data dictionary
            existing_invoices: List of existing invoice numbers for duplicate check
        """
        # Get invoice number (try multiple field names)
        invoice_no = (
            invoice.get('invoice_no') or 
            invoice.get('invoice_number') or 
            invoice.get('inv_no') or
            'Unknown'
        )
        
        # 1. Validate customer GSTIN (for B2B invoices)
        customer_gstin = invoice.get('customer_gstin') or invoice.get('customer', {}).get('gstin')
        if customer_gstin:
            self.validate_gstin(customer_gstin, invoice_no, 'customer_gstin')
        
        # 2. Validate place of supply
        pos = invoice.get('place_of_supply') or invoice.get('pos')
        self.validate_place_of_supply(pos, invoice_no)
        
        # 3. Validate HSN code
        hsn_code = invoice.get('hsn_code') or invoice.get('hsn')
        self.validate_hsn(hsn_code, invoice_no)
        
        # 4. Validate invoice date
        invoice_date = invoice.get('invoice_date') or invoice.get('date')
        self.validate_date(invoice_date, invoice_no)
        
        # Get taxable value and tax amounts
        taxable_value = invoice.get('taxable_value') or invoice.get('txval')
        if taxable_value is not None:
            try:
                taxable_value = float(taxable_value)
                
                # 5. Validate negative values
                self.validate_negative_values(taxable_value, invoice_no)
                
                # 6. Validate tax calculation
                # Try to get tax rate from various fields
                gst_rate = (
                    invoice.get('gst_rate') or 
                    invoice.get('tax_rate') or 
                    invoice.get('rt') or
                    0
                )
                if isinstance(gst_rate, str):
                    gst_rate = float(gst_rate.replace('%', ''))
                else:
                    gst_rate = float(gst_rate) if gst_rate else 0
                
                # Calculate total tax from individual components
                igst = float(invoice.get('igst_amount') or invoice.get('iamt') or 0)
                cgst = float(invoice.get('cgst_amount') or invoice.get('camt') or 0)
                sgst = float(invoice.get('sgst_amount') or invoice.get('samt') or 0)
                total_tax = igst + cgst + sgst
                
                if gst_rate > 0 and total_tax > 0:
                    self.validate_tax_calculation(taxable_value, gst_rate, total_tax, invoice_no)
            except (ValueError, TypeError):
                pass  # Skip tax validation if values can't be converted
        
        # 7. Check for duplicate invoice number
        if invoice_no != 'Unknown':
            self.validate_invoice_duplicate(invoice_no, existing_invoices)


def validate_invoices(
    invoices: List[Dict[str, Any]],
    existing_invoice_nos: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Validate a list of invoices.
    
    Args:
        invoices: List of invoice dictionaries
        existing_invoice_nos: Optional list of existing invoice numbers for duplicate check
    
    Returns:
        Dictionary containing validation results with errors and warnings
    """
    validator = InvoiceValidator()
    
    if existing_invoice_nos is None:
        existing_invoice_nos = []
    
    # Collect all invoice numbers from the input for duplicate checking within the batch
    seen_invoice_nos = set()
    
    for invoice in invoices:
        invoice_no = (
            invoice.get('invoice_no') or 
            invoice.get('invoice_number') or 
            invoice.get('inv_no') or
            'Unknown'
        )
        
        # Check for duplicates within the batch
        if invoice_no != 'Unknown' and invoice_no in seen_invoice_nos:
            validator.errors.append({
                'invoice': invoice_no,
                'field': 'invoice_no',
                'error': f'Duplicate invoice in batch: Invoice number "{invoice_no}" appears multiple times',
                'error_code': 'INVOICE_DUPLICATE_BATCH'
            })
        seen_invoice_nos.add(invoice_no)
        
        # Validate the invoice
        validator.validate_invoice(invoice, existing_invoice_nos)
    
    return {
        'valid': len(validator.errors) == 0,
        'errors': validator.errors,
        'warnings': validator.warnings,
        'total_invoices': len(invoices),
        'total_errors': len(validator.errors),
        'total_warnings': len(validator.warnings)
    }
