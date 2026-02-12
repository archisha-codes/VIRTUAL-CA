export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  status: 'passed' | 'warning' | 'failed';
  errors: ValidationError[];
}

// GSTIN format: 2 digits (state code) + 10 chars (PAN) + 1 digit + 1 char + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// State codes for Indian states
const VALID_STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '97', '99'
];

export function validateGSTIN(gstin: string | null | undefined): ValidationError | null {
  if (!gstin || gstin.trim() === '') {
    return { field: 'customer_gstin', message: 'GSTIN is missing', severity: 'warning' };
  }

  const cleanGstin = gstin.toUpperCase().trim();

  if (!GSTIN_REGEX.test(cleanGstin)) {
    return { field: 'customer_gstin', message: 'Invalid GSTIN format', severity: 'error' };
  }

  const stateCode = cleanGstin.substring(0, 2);
  if (!VALID_STATE_CODES.includes(stateCode)) {
    return { field: 'customer_gstin', message: 'Invalid state code in GSTIN', severity: 'error' };
  }

  return null;
}

export function validatePlaceOfSupply(pos: string | null | undefined): ValidationError | null {
  if (!pos || pos.trim() === '') {
    return { field: 'place_of_supply', message: 'Place of supply is missing', severity: 'error' };
  }
  return null;
}

export function validateTaxCalculation(
  taxableValue: number,
  cgst: number,
  sgst: number,
  igst: number,
  total: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  const calculatedTotal = taxableValue + cgst + sgst + igst;
  const tolerance = 1; // ₹1 tolerance for rounding

  if (Math.abs(calculatedTotal - total) > tolerance) {
    errors.push({
      field: 'total_amount',
      message: `Total mismatch: Expected ₹${calculatedTotal.toFixed(2)}, got ₹${total.toFixed(2)}`,
      severity: 'error',
    });
  }

  // Check if both IGST and CGST/SGST are applied (should be mutually exclusive)
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    errors.push({
      field: 'tax_type',
      message: 'Both IGST and CGST/SGST cannot be applied together',
      severity: 'error',
    });
  }

  // Check if CGST equals SGST
  if (cgst > 0 && sgst > 0 && Math.abs(cgst - sgst) > tolerance) {
    errors.push({
      field: 'cgst_sgst',
      message: 'CGST and SGST amounts should be equal',
      severity: 'warning',
    });
  }

  return errors;
}

export function validateInvoiceNumber(invoiceNo: string | null | undefined): ValidationError | null {
  if (!invoiceNo || invoiceNo.trim() === '') {
    return { field: 'invoice_number', message: 'Invoice number is missing', severity: 'error' };
  }

  if (invoiceNo.length > 16) {
    return { field: 'invoice_number', message: 'Invoice number exceeds 16 characters', severity: 'warning' };
  }

  return null;
}

export function validateInvoiceDate(date: Date | string | null | undefined): ValidationError | null {
  if (!date) {
    return { field: 'invoice_date', message: 'Invoice date is missing', severity: 'error' };
  }

  const invoiceDate = new Date(date);
  const today = new Date();
  
  if (invoiceDate > today) {
    return { field: 'invoice_date', message: 'Invoice date cannot be in the future', severity: 'error' };
  }

  return null;
}

export function validateInvoice(invoice: {
  invoice_number?: string | null;
  invoice_date?: string | Date | null;
  customer_gstin?: string | null;
  place_of_supply?: string | null;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate invoice number
  const invoiceNoError = validateInvoiceNumber(invoice.invoice_number);
  if (invoiceNoError) errors.push(invoiceNoError);

  // Validate invoice date
  const dateError = validateInvoiceDate(invoice.invoice_date);
  if (dateError) errors.push(dateError);

  // Validate GSTIN
  const gstinError = validateGSTIN(invoice.customer_gstin);
  if (gstinError) errors.push(gstinError);

  // Validate Place of Supply
  const posError = validatePlaceOfSupply(invoice.place_of_supply);
  if (posError) errors.push(posError);

  // Validate tax calculations
  const taxErrors = validateTaxCalculation(
    invoice.taxable_value || 0,
    invoice.cgst_amount || 0,
    invoice.sgst_amount || 0,
    invoice.igst_amount || 0,
    invoice.total_amount || 0
  );
  errors.push(...taxErrors);

  // Determine overall status
  const hasErrors = errors.some(e => e.severity === 'error');
  const hasWarnings = errors.some(e => e.severity === 'warning');

  return {
    status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'passed',
    errors,
  };
}

export function validatePurchaseInvoice(invoice: {
  invoice_number?: string | null;
  invoice_date?: string | Date | null;
  supplier_gstin?: string | null;
  place_of_supply?: string | null;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate invoice number
  const invoiceNoError = validateInvoiceNumber(invoice.invoice_number);
  if (invoiceNoError) errors.push(invoiceNoError);

  // Validate invoice date
  const dateError = validateInvoiceDate(invoice.invoice_date);
  if (dateError) errors.push(dateError);

  // Validate Supplier GSTIN (required for ITC)
  if (!invoice.supplier_gstin || invoice.supplier_gstin.trim() === '') {
    errors.push({ 
      field: 'supplier_gstin', 
      message: 'Supplier GSTIN is required for ITC claims', 
      severity: 'error' 
    });
  } else {
    const gstinError = validateGSTIN(invoice.supplier_gstin);
    if (gstinError) {
      errors.push({ ...gstinError, field: 'supplier_gstin' });
    }
  }

  // Validate tax calculations
  const taxErrors = validateTaxCalculation(
    invoice.taxable_value || 0,
    invoice.cgst_amount || 0,
    invoice.sgst_amount || 0,
    invoice.igst_amount || 0,
    invoice.total_amount || 0
  );
  errors.push(...taxErrors);

  // Determine overall status
  const hasErrors = errors.some(e => e.severity === 'error');
  const hasWarnings = errors.some(e => e.severity === 'warning');

  return {
    status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'passed',
    errors,
  };
}

export function determineInvoiceType(
  customerGstin: string | null | undefined,
  placeOfSupply: string | null | undefined,
  sellerStateCode: string,
  totalValue: number,
  isExport: boolean = false
): string {
  if (isExport) return 'EXPORT';

  // B2B: Has valid GSTIN
  if (customerGstin && GSTIN_REGEX.test(customerGstin.toUpperCase())) {
    return 'B2B';
  }

  // B2CL: No GSTIN, inter-state, value > 2.5 lakh
  if (!customerGstin || customerGstin.trim() === '') {
    const posStateCode = placeOfSupply?.substring(0, 2);
    const isInterState = posStateCode && posStateCode !== sellerStateCode;
    
    if (isInterState && totalValue > 250000) {
      return 'B2CL';
    }
    return 'B2CS';
  }

  return 'B2CS';
}
