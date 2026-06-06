/**
 * GSTR-1 Classifier Service
 * 
 * Invoice classification for GST return sections:
 * - B2B: Business to Business (registered recipients)
 * - B2CL: Business to Consumer Large (inter-state > ₹2.5 lakh)
 * - B2CS: Business to Consumer Small (others)
 * - Exports: Export invoices
 * - CDNR: Credit/Debit Notes (Registered)
 * - CNDS: Credit/Debit Notes (Unregistered)
 */

import type { RawInvoice } from './parser';

// ============================================
// Classification Types
// ============================================

export type InvoiceCategory = 'b2b' | 'b2cl' | 'b2cs' | 'export' | 'cdnr' | 'cnds' | 'exempted' | 'nilrated';

export interface ClassifiedInvoice {
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
  category: InvoiceCategory;
  subCategory?: string;
  isInterState: boolean;
  stateCode: string;
  reverseCharge: boolean;
}

// Classification result
export interface ClassificationResult {
  b2b: ClassifiedInvoice[];
  b2cl: ClassifiedInvoice[];
  b2cs: ClassifiedInvoice[];
  export: ClassifiedInvoice[];
  cdnr: ClassifiedInvoice[];
  cnds: ClassifiedInvoice[];
  exempted: ClassifiedInvoice[];
  nilrated: ClassifiedInvoice[];
  summary: {
    total: number;
    b2bCount: number;
    b2clCount: number;
    b2csCount: number;
    exportCount: number;
    cdnrCount: number;
    cndsCount: number;
    exemptedCount: number;
    nilratedCount: number;
    totalTaxableValue: number;
    totalTax: number;
  };
}

// State codes for Indian states/UTs
const STATE_CODES: Record<string, string> = {
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
  '37': ' Ladakh',
  '38': 'Other Territory',
};

// GSTIN pattern for validation
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

// ============================================
// Classifier Service
// ============================================

/**
 * Classify a single invoice
 */
export function classifyInvoice(invoice: RawInvoice, taxpayerGstin: string): ClassifiedInvoice {
  const gstin = invoice.customer_gstin?.toUpperCase() || '';
  const isRegistered = GSTIN_REGEX.test(gstin) || gstin === 'URP';
  const isInterState = invoice.igst_amount > 0 || !isSameState(taxpayerGstin, gstin);
  const stateCode = extractStateCode(gstin, taxpayerGstin);
  const invoiceValue = invoice.total_amount;
  
  // Determine category based on conditions
  let category: InvoiceCategory;
  
  // Check if it's a credit/debit note (usually has negative values or special naming)
  if (isCreditDebitNote(invoice)) {
    category = isRegistered ? 'cdnr' : 'cnds';
  }
  // Check for exports
  else if (isExport(invoice)) {
    category = 'export';
  }
  // B2B: Registered business customers
  else if (isRegistered && gstin !== 'URP') {
    category = 'b2b';
  }
  // B2CL: Inter-state B2C with value > ₹2.5 lakh
  else if (isInterState && invoiceValue > 250000) {
    category = 'b2cl';
  }
  // B2CS: All other B2C (including intra-state small value)
  else {
    category = 'b2cs';
  }

  return {
    ...invoice,
    category,
    isInterState,
    stateCode,
    reverseCharge: false, // Could be enhanced to detect reverse charge
  };
}

/**
 * Classify multiple invoices
 */
export function classifyInvoices(
  invoices: RawInvoice[],
  taxpayerGstin: string = ''
): ClassificationResult {
  const classifiedInvoices = invoices.map(inv => classifyInvoice(inv, taxpayerGstin));
  
  const result: ClassificationResult = {
    b2b: [],
    b2cl: [],
    b2cs: [],
    export: [],
    cdnr: [],
    cnds: [],
    exempted: [],
    nilrated: [],
    summary: {
      total: 0,
      b2bCount: 0,
      b2clCount: 0,
      b2csCount: 0,
      exportCount: 0,
      cdnrCount: 0,
      cndsCount: 0,
      exemptedCount: 0,
      nilratedCount: 0,
      totalTaxableValue: 0,
      totalTax: 0,
    },
  };

  // Group invoices by category
  for (const inv of classifiedInvoices) {
    switch (inv.category) {
      case 'b2b':
        result.b2b.push(inv);
        result.summary.b2bCount++;
        break;
      case 'b2cl':
        result.b2cl.push(inv);
        result.summary.b2clCount++;
        break;
      case 'b2cs':
        result.b2cs.push(inv);
        result.summary.b2csCount++;
        break;
      case 'export':
        result.export.push(inv);
        result.summary.exportCount++;
        break;
      case 'cdnr':
        result.cdnr.push(inv);
        result.summary.cdnrCount++;
        break;
      case 'cnds':
        result.cnds.push(inv);
        result.summary.cndsCount++;
        break;
      case 'exempted':
        result.exempted.push(inv);
        result.summary.exemptedCount++;
        break;
      case 'nilrated':
        result.nilrated.push(inv);
        result.summary.nilratedCount++;
        break;
    }

    result.summary.total++;
    result.summary.totalTaxableValue += inv.taxable_value;
    result.summary.totalTax += inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
  }

  return result;
}

/**
 * Check if invoice is a credit/debit note
 */
function isCreditDebitNote(invoice: RawInvoice): boolean {
  const invNo = invoice.invoice_number?.toLowerCase() || '';
  const customerName = invoice.customer_name?.toLowerCase() || '';
  
  // Check for common credit/debit note patterns
  const patterns = [
    /credit\s*note/i,
    /debit\s*note/i,
    /c\.?n\.?/i,
    /d\.?n\.?/i,
    /cr\s*note/i,
    /dr\s*note/i,
    /return\s*note/i,
    /adjustment/i,
  ];

  // Also check for negative values (common in credit notes)
  const hasNegativeValues = 
    invoice.taxable_value < 0 ||
    invoice.total_amount < 0 ||
    invoice.cgst_amount < 0 ||
    invoice.sgst_amount < 0 ||
    invoice.igst_amount < 0;

  return patterns.some(p => p.test(invNo) || p.test(customerName)) || hasNegativeValues;
}

/**
 * Check if invoice is an export
 */
function isExport(invoice: RawInvoice): boolean {
  const pos = invoice.place_of_supply?.toLowerCase() || '';
  const customerGstin = invoice.customer_gstin?.toLowerCase() || '';
  
  // Check for export place of supply
  const exportPlaces = ['96', 'other territory', 'out of india'];
  
  // Check if place of supply indicates export
  if (exportPlaces.some(p => pos.includes(p))) {
    return true;
  }
  
  // Check if customer GSTIN is empty or URP for export (common in exports to unregistered parties)
  if (!customerGstin || customerGstin === 'urp') {
    // Could be export if POS starts with 96 or is foreign
    if (pos.startsWith('96') || pos.toLowerCase().includes('other')) {
      return true;
    }
  }
  
  // Check for shipping bill number (common in export invoices)
  // This would require additional field detection
  
  return false;
}

/**
 * Extract state code from GSTIN
 */
function extractStateCode(customerGstin: string, taxpayerGstin: string): string {
  // Try to extract from customer GSTIN first
  if (customerGstin && customerGstin.length >= 2) {
    const code = customerGstin.substring(0, 2);
    if (/^\d{2}$/.test(code)) {
      return code;
    }
  }
  
  // Fall back to taxpayer GSTIN
  if (taxpayerGstin && taxpayerGstin.length >= 2) {
    const code = taxpayerGstin.substring(0, 2);
    if (/^\d{2}$/.test(code)) {
      return code;
    }
  }
  
  return '';
}

/**
 * Check if two GSTINs are from the same state
 */
function isSameState(taxpayerGstin: string, customerGstin: string): boolean {
  const taxpayerState = extractStateCode(customerGstin, taxpayerGstin);
  const customerState = customerGstin.substring(0, 2);
  
  return taxpayerState === customerState;
}

/**
 * Get state name from state code
 */
export function getStateName(stateCode: string): string {
  return STATE_CODES[stateCode] || `State ${stateCode}`;
}

/**
 * Calculate summary statistics for a category
 */
export function calculateCategorySummary(invoices: ClassifiedInvoice[]): {
  count: number;
  totalTaxableValue: number;
  totalTax: number;
  totalIGST: number;
  totalCGST: number;
  totalSGST: number;
  interStateCount: number;
  intraStateCount: number;
} {
  return invoices.reduce(
    (acc, inv) => {
      acc.count++;
      acc.totalTaxableValue += inv.taxable_value;
      acc.totalTax += inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
      acc.totalIGST += inv.igst_amount;
      acc.totalCGST += inv.cgst_amount;
      acc.totalSGST += inv.sgst_amount;
      
      if (inv.isInterState) {
        acc.interStateCount++;
      } else {
        acc.intraStateCount++;
      }
      
      return acc;
    },
    {
      count: 0,
      totalTaxableValue: 0,
      totalTax: 0,
      totalIGST: 0,
      totalCGST: 0,
      totalSGST: 0,
      interStateCount: 0,
      intraStateCount: 0,
    }
  );
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: InvoiceCategory): string {
  const names: Record<InvoiceCategory, string> = {
    b2b: 'B2B - Business to Business',
    b2cl: 'B2CL - B2C Large',
    b2cs: 'B2CS - B2C Small',
    export: 'Exports',
    cdnr: 'CDNR - Credit/Debit Notes (Registered)',
    cnds: 'CNDS - Credit/Debit Notes (Unregistered)',
    exempted: 'Exempted Supplies',
    nilrated: 'Nil-Rated Supplies',
  };
  
  return names[category] || category.toUpperCase();
}

/**
 * Reclassify invoices based on manual category changes
 */
export function reclassifyInvoice(
  invoice: ClassifiedInvoice,
  newCategory: InvoiceCategory
): ClassifiedInvoice {
  return {
    ...invoice,
    category: newCategory,
    isInterState: newCategory === 'b2cl' || newCategory === 'export',
  };
}
