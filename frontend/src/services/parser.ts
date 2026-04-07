/**
 * GSTR-1 Parser Service
 * 
 * Template detection (Govt/Custom) and parsing for Excel files.
 * Handles different file formats and column mappings.
 */

import * as XLSX from 'xlsx';
import { parseExcelFile, autoMapColumns, FIELD_LABELS, REQUIRED_FIELDS, type ColumnMapping, type ParsedExcel } from '@/lib/excel-parser';

// ============================================
// Template Types
// ============================================

export type TemplateType = 'govt' | 'custom' | 'unknown';

export interface TemplateDetectionResult {
  templateType: TemplateType;
  confidence: number;
  detectedFields: string[];
  suggestedMapping: Partial<ColumnMapping>;
}

// Govt template column patterns (official GSTN format)
const GOVT_TEMPLATE_PATTERNS = {
  invoice_number: [/^invoice\s*no$/i, /^inv\s*no$/i, /^inum$/i],
  invoice_date: [/^invoice\s*date$/i, /^inv\s*date$/i, /^idt$/i],
  customer_name: [/^customer\s*name$/i, /^buyer\s*name$/i, /^name$/i],
  customer_gstin: [/^gstin$/i, /^customer\s*gstin$/i, /^buyer\s*gstin$/i, /^ctin$/i],
  place_of_supply: [/^pos$/i, /^place\s*of\s*supply$/i],
  hsn_code: [/^hsn$/i, /^hsn\s*code$/i, /^hsn\s*sc$/i],
  taxable_value: [/^taxable\s*value$/i, /^txval$/i],
  cgst_rate: [/^cgst\s*rate$/i, /^cgst\s*%/i],
  cgst_amount: [/^cgst\s*amt$/i, /^camt$/i],
  sgst_rate: [/^sgst\s*rate$/i, /^sgst\s*%/i],
  sgst_amount: [/^sgst\s*amt$/i, /^samt$/i],
  igst_rate: [/^igst\s*rate$/i, /^igst\s*%/i],
  igst_amount: [/^igst\s*amt$/i, /^iamt$/i],
  total_amount: [/^total\s*amt$/i, /^invoice\s*value$/i, /^val$/i],
};

// Custom template column patterns (common business formats)
const CUSTOM_TEMPLATE_PATTERNS = {
  invoice_number: [/invoice/i, /inv\s*#/i, /bill/i, /number/i],
  invoice_date: [/date/i, /dt/i],
  customer_name: [/customer/i, /party/i, /buyer/i, /client/i, /name/i],
  customer_gstin: [/gstin/i, /gst\s*no/i, /tax\s*id/i],
  place_of_supply: [/pos/i, /place/i, /state/i, /ship\s*to/i],
  hsn_code: [/hsn/i, /sac/i, /code/i],
  taxable_value: [/taxable/i, /base/i, /net/i, /subtotal/i],
  cgst_rate: [/cgst/i, /cgst\s*%/i],
  cgst_amount: [/cgst\s*amt/i],
  sgst_rate: [/sgst/i, /sgst\s*%/i],
  sgst_amount: [/sgst\s*amt/i],
  igst_rate: [/igst/i, /igst\s*%/i],
  igst_amount: [/igst\s*amt/i],
  total_amount: [/total/i, /gross/i, /grand\s*total/i, /amount/i],
};

// ============================================
// Invoice Data Types
// ============================================

export interface RawInvoice {
  invoice_number: string;
  invoice_date: string | null;
  customer_name: string;
  customer_gstin: string;
  place_of_supply: string;
  hsn_code: string;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_amount: number;
  // Additional fields
  [key: string]: string | number | null;
}

// ============================================
// Parser Service
// ============================================

/**
 * Detect template type from Excel headers
 */
export function detectTemplateType(headers: string[]): TemplateDetectionResult {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  let govtScore = 0;
  let customScore = 0;
  const detectedFields: string[] = [];

  // Check for govt template patterns
  for (const [field, patterns] of Object.entries(GOVT_TEMPLATE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerHeaders.some(h => pattern.test(h))) {
        govtScore += 1;
        detectedFields.push(field);
        break;
      }
    }
  }

  // Check for custom template patterns
  for (const [field, patterns] of Object.entries(CUSTOM_TEMPLATE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerHeaders.some(h => pattern.test(h))) {
        customScore += 1;
        break;
      }
    }
  }

  // Determine template type
  const totalScore = govtScore + customScore;
  const confidence = totalScore > 0 ? Math.max(govtScore, customScore) / totalScore : 0;
  
  let templateType: TemplateType;
  if (govtScore > customScore && govtScore >= 5) {
    templateType = 'govt';
  } else if (customScore > govtScore) {
    templateType = 'custom';
  } else {
    templateType = 'unknown';
  }

  // Generate suggested mapping
  const suggestedMapping = autoMapColumns(headers);

  return {
    templateType,
    confidence,
    detectedFields,
    suggestedMapping,
  };
}

/**
 * Parse Excel file with template detection
 */
export async function parseGSTR1ExcelFile(
  file: File,
  customMapping?: Partial<ColumnMapping>
): Promise<{
  parsedData: ParsedExcel;
  templateInfo: TemplateDetectionResult;
  invoices: RawInvoice[];
}> {
  // Parse the Excel file
  const parsedData = await parseExcelFile(file);
  
  // Detect template type
  const templateInfo = detectTemplateType(parsedData.headers);
  
  // Get column mapping (use custom if provided, otherwise use auto-detected)
  const mapping = customMapping || templateInfo.suggestedMapping;
  
  // Map rows to invoice format
  const invoices = mapRowsToInvoices(parsedData.rows, mapping);

  return {
    parsedData,
    templateInfo,
    invoices,
  };
}

/**
 * Map Excel rows to RawInvoice format
 */
export function mapRowsToInvoices(
  rows: Record<string, unknown>[],
  mapping: Partial<ColumnMapping>
): RawInvoice[] {
  return rows
    .map(row => mapRowToInvoice(row, mapping))
    .filter(inv => inv.invoice_number && inv.invoice_number.trim() !== '');
}

/**
 * Map a single row to RawInvoice format
 */
function mapRowToInvoice(
  row: Record<string, unknown>,
  mapping: Partial<ColumnMapping>
): RawInvoice {
  const getValue = (field: keyof ColumnMapping): unknown => {
    const columnName = mapping[field];
    if (!columnName) return null;
    return row[columnName] ?? null;
  };

  const parseNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[₹,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const parseDate = (value: unknown): string | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  };

  return {
    invoice_number: String(getValue('invoice_number') || ''),
    invoice_date: parseDate(getValue('invoice_date')),
    customer_name: String(getValue('customer_name') || ''),
    customer_gstin: String(getValue('customer_gstin') || '').toUpperCase(),
    place_of_supply: String(getValue('place_of_supply') || ''),
    hsn_code: String(getValue('hsn_code') || ''),
    taxable_value: parseNumber(getValue('taxable_value')),
    cgst_rate: parseNumber(getValue('cgst_rate')),
    cgst_amount: parseNumber(getValue('cgst_amount')),
    sgst_rate: parseNumber(getValue('sgst_rate')),
    sgst_amount: parseNumber(getValue('sgst_amount')),
    igst_rate: parseNumber(getValue('igst_rate')),
    igst_amount: parseNumber(getValue('igst_amount')),
    total_amount: parseNumber(getValue('total_amount')),
  };
}

/**
 * Validate parsed invoices
 */
export function validateInvoices(invoices: RawInvoice[]): {
  valid: RawInvoice[];
  invalid: Array<{ invoice: RawInvoice; errors: string[] }>;
} {
  const valid: RawInvoice[] = [];
  const invalid: Array<{ invoice: RawInvoice; errors: string[] }> = [];

  for (const invoice of invoices) {
    const errors: string[] = [];

    // Check required fields
    if (!invoice.invoice_number?.trim()) {
      errors.push('Invoice number is required');
    }
    if (!invoice.invoice_date) {
      errors.push('Invoice date is required');
    }
    if (!invoice.taxable_value || invoice.taxable_value <= 0) {
      errors.push('Taxable value must be greater than 0');
    }
    if (!invoice.total_amount || invoice.total_amount <= 0) {
      errors.push('Total amount must be greater than 0');
    }

    // Validate GSTIN format if provided
    if (invoice.customer_gstin && invoice.customer_gstin.length > 0) {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(invoice.customer_gstin)) {
        // Not a valid GSTIN format - could be unregistered (URP)
        if (invoice.customer_gstin.toUpperCase() !== 'URP') {
          // Could be a warning, not necessarily an error for B2CS
        }
      }
    }

    // Validate tax amounts
    const calculatedTotal = 
      invoice.taxable_value + 
      invoice.cgst_amount + 
      invoice.sgst_amount + 
      invoice.igst_amount;
    
    if (Math.abs(calculatedTotal - invoice.total_amount) > 1) {
      // Allow small rounding differences
      if (Math.abs(calculatedTotal - invoice.total_amount) > 2) {
        errors.push(`Tax amount mismatch: expected ~${calculatedTotal.toFixed(2)}, got ${invoice.total_amount}`);
      }
    }

    if (errors.length > 0) {
      invalid.push({ invoice, errors });
    } else {
      valid.push(invoice);
    }
  }

  return { valid, invalid };
}

/**
 * Get parsing statistics
 */
export function getParsingStats(invoices: RawInvoice[]): {
  total: number;
  withGstin: number;
  withoutGstin: number;
  interState: number;
  intraState: number;
  totalTaxableValue: number;
  totalTax: number;
} {
  let withGstin = 0;
  let withoutGstin = 0;
  let interState = 0;
  let intraState = 0;
  let totalTaxableValue = 0;
  let totalTax = 0;

  for (const inv of invoices) {
    if (inv.customer_gstin && inv.customer_gstin !== 'URP') {
      withGstin++;
    } else {
      withoutGstin++;
    }

    // Determine inter-state vs intra-state
    if (inv.igst_amount > 0) {
      interState++;
    } else {
      intraState++;
    }

    totalTaxableValue += inv.taxable_value;
    totalTax += inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
  }

  return {
    total: invoices.length,
    withGstin,
    withoutGstin,
    interState,
    intraState,
    totalTaxableValue,
    totalTax,
  };
}

export { type ColumnMapping, type ParsedExcel, FIELD_LABELS, REQUIRED_FIELDS };
