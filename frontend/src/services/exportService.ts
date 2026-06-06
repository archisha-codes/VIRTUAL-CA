/**
 * GSTR-1 Export Service
 * 
 * Export GSTR-1 data to JSON and Excel formats.
 * Handles both government format and custom format exports.
 */

import * as XLSX from 'xlsx';
import type { GSTR1Tables, GSTR1B2BCustomer, GSTR1B2CLInvoice, GSTR1B2CSEntry, GSTR1CDNRCustomer, GSTR1HSNEntry, GSTR1DOCSEntry, GSTR1Item } from './gstr1Engine';

// ============================================
// Export Types
// ============================================

export type ExportFormat = 'json' | 'excel' | 'both';

export interface ExportOptions {
  format: ExportFormat;
  includeB2B: boolean;
  includeB2CL: boolean;
  includeB2CS: boolean;
  includeCDNR: boolean;
  includeCNDS: boolean;
  includeHSN: boolean;
  includeDOCS: boolean;
  templateType: 'govt' | 'custom';
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'excel',
  includeB2B: true,
  includeB2CL: true,
  includeB2CS: true,
  includeCDNR: true,
  includeCNDS: true,
  includeHSN: true,
  includeDOCS: true,
  templateType: 'govt',
};

// ============================================
// JSON Export
// ============================================

/**
 * Export GSTR-1 data to JSON format (Government format)
 */
export function exportGSTR1ToJson(
  tables: GSTR1Tables,
  gstin: string,
  period: string
): string {
  const jsonData = buildJsonPayload(tables, gstin, period);
  return JSON.stringify(jsonData, null, 2);
}

/**
 * Build JSON payload in government format
 */
function buildJsonPayload(tables: GSTR1Tables, gstin: string, period: string): object {
  const payload: Record<string, unknown> = {
    gstin,
    fp: period,
    gt: 0,
    cur_gt: 0,
    b2b: [] as Record<string, unknown>[],
    b2cl: [] as Record<string, unknown>[],
    b2cs: [] as Record<string, unknown>[],
    cdnr: [] as Record<string, unknown>[],
    cnds: [] as Record<string, unknown>[],
    exp: [] as Record<string, unknown>[],
    exemp: [] as Record<string, unknown>[],
    nil_exemp: [] as Record<string, unknown>[],
    hsn: { data: [] as Record<string, unknown>[] },
    docs: { data: [] as Record<string, unknown>[] },
  };

  // B2B invoices
  if (tables.b2b.length > 0) {
    payload.b2b = tables.b2b.map(customer => ({
      ctin: customer.gstin,
      inv: customer.invoices.map(inv => ({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.invoiceValue,
        pos: inv.placeOfSupply,
        rchrg: inv.reverseCharge,
        inv_typ: inv.invoiceType,
        itms: inv.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: roundToTwo(item.taxableValue),
            iamt: roundToTwo(item.igstAmount),
            camt: roundToTwo(item.cgstAmount),
            samt: roundToTwo(item.sgstAmount),
            csamt: roundToTwo(item.cessAmount),
            rt: roundToTwo(item.igstRate || item.cgstRate || item.sgstRate),
          },
        })),
      })),
    }));
  }

  // B2CL invoices
  if (tables.b2cl.length > 0) {
    payload.b2cl = tables.b2cl.map(inv => ({
      pos: inv.placeOfSupply,
      inv: [{
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: roundToTwo(inv.invoiceValue),
        itms: inv.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: roundToTwo(item.taxableValue),
            iamt: roundToTwo(item.igstAmount),
            csamt: roundToTwo(item.cessAmount),
            rt: roundToTwo(item.igstRate),
          },
        })),
      }],
    }));
  }

  // B2CS entries
  if (tables.b2cs.length > 0) {
    payload.b2cs = tables.b2cs.map(entry => ({
      pos: entry.placeOfSupply,
      typ: entry.supplyType === 'INTER' ? 'INTER' : 'INTRA',
      txval: roundToTwo(entry.taxableValue),
      iamt: roundToTwo(entry.igstAmount),
      camt: roundToTwo(entry.cgstAmount),
      samt: roundToTwo(entry.sgstAmount),
      csamt: roundToTwo(entry.cessAmount),
      rt: roundToTwo(entry.rate),
    }));
  }

  // CDN/R - Registered
  if (tables.cdnr.length > 0) {
    payload.cdnr = tables.cdnr.map(customer => ({
      ctin: customer.gstin,
      nt: customer.notes.map(note => ({
        nty: note.noteType,
        nt_num: note.noteNumber,
        nt_dt: note.noteDate,
        inum: note.invoiceNumber,
        idt: note.invoiceDate,
        val: roundToTwo(note.noteValue),
        pos: note.placeOfSupply,
        itms: note.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: roundToTwo(item.taxableValue),
            iamt: roundToTwo(item.igstAmount),
            camt: roundToTwo(item.cgstAmount),
            samt: roundToTwo(item.sgstAmount),
            csamt: roundToTwo(item.cessAmount),
            rt: roundToTwo(item.igstRate || item.cgstRate),
          },
        })),
      })),
    }));
  }

  // CDN/S - Unregistered
  if (tables.cnds.length > 0) {
    payload.cnds = tables.cnds.map(customer => ({
      nt: customer.notes.map(note => ({
        nty: note.noteType,
        nt_num: note.noteNumber,
        nt_dt: note.noteDate,
        inum: note.invoiceNumber,
        idt: note.invoiceDate,
        val: roundToTwo(note.noteValue),
        pos: note.placeOfSupply,
        itms: note.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: roundToTwo(item.taxableValue),
            iamt: roundToTwo(item.igstAmount),
            camt: roundToTwo(item.cgstAmount),
            samt: roundToTwo(item.sgstAmount),
            csamt: roundToTwo(item.cessAmount),
            rt: roundToTwo(item.igstRate || item.cgstRate),
          },
        })),
      })),
    }));
  }

  // HSN Summary
  if (tables.hsn.length > 0) {
    const hsnData = tables.hsn.map(hsn => ({
      hsn_sc: hsn.hsnCode,
      desc: hsn.description,
      uqc: hsn.uqc,
      qty: hsn.totalQuantity,
      val: roundToTwo(hsn.totalValue),
      txval: roundToTwo(hsn.taxableValue),
      iamt: roundToTwo(hsn.igstAmount),
      camt: roundToTwo(hsn.cgstAmount),
      samt: roundToTwo(hsn.sgstAmount),
      csamt: roundToTwo(hsn.cessAmount),
    }));
    (payload.hsn as Record<string, unknown>).data = hsnData;
  }

  // DOCS
  if (tables.docs.length > 0) {
    const docsData = tables.docs.map(doc => ({
      doc_num: doc.serialNumber,
      doc_typ: doc.documentType,
      from_dt: doc.fromDate,
      to_dt: doc.toDate,
      tot_num: doc.totalNumber,
      tot_cancelled: doc.totalCancelled,
      net_issued: doc.netIssued,
    }));
    (payload.docs as Record<string, unknown>).data = docsData;
  }

  return payload;
}

// ============================================
// Excel Export
// ============================================

/**
 * Export GSTR-1 data to Excel format
 */
export function exportGSTR1ToExcel(
  tables: GSTR1Tables,
  gstin: string,
  period: string,
  options: Partial<ExportOptions> = {}
): XLSX.WorkBook {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const workbook = XLSX.utils.book_new();

  // Add summary sheet first
  addSummarySheet(workbook, tables, gstin, period);

  // B2B Sheet
  if (opts.includeB2B && tables.b2b.length > 0) {
    addB2BSheet(workbook, tables.b2b);
  }

  // B2CL Sheet
  if (opts.includeB2CL && tables.b2cl.length > 0) {
    addB2CLSheet(workbook, tables.b2cl);
  }

  // B2CS Sheet
  if (opts.includeB2CS && tables.b2cs.length > 0) {
    addB2CSSheet(workbook, tables.b2cs);
  }

  // CDN/R Sheet
  if (opts.includeCDNR && tables.cdnr.length > 0) {
    addCDNRSheet(workbook, tables.cdnr);
  }

  // HSN Sheet
  if (opts.includeHSN && tables.hsn.length > 0) {
    addHSNSheet(workbook, tables.hsn);
  }

  // DOCS Sheet
  if (opts.includeDOCS && tables.docs.length > 0) {
    addDOCSSheet(workbook, tables.docs);
  }

  return workbook;
}

/**
 * Add summary sheet to workbook
 */
function addSummarySheet(workbook: XLSX.WorkBook, tables: GSTR1Tables, gstin: string, period: string): void {
  const data = [
    ['GSTR-1 Summary'],
    ['GSTIN', gstin],
    ['Return Period', formatPeriod(period)],
    [''],
    ['Category', 'Count', 'Taxable Value', 'Tax Amount'],
    ['B2B Invoices', tables.summary.b2bCount, tables.b2b.reduce((sum, c) => sum + c.totalTaxableValue, 0), tables.b2b.reduce((sum, c) => sum + c.totalTax, 0)],
    ['B2CL Invoices', tables.summary.b2clCount, tables.b2cl.reduce((sum, inv) => sum + inv.invoiceValue, 0), tables.b2cl.reduce((sum, inv) => sum + inv.items.reduce((s, i) => s + i.igstAmount, 0), 0)],
    ['B2CS Entries', tables.summary.b2csCount, tables.b2cs.reduce((sum, e) => sum + e.taxableValue, 0), tables.b2cs.reduce((sum, e) => sum + e.igstAmount + e.cgstAmount + e.sgstAmount, 0)],
    ['CDN/R Notes', tables.summary.cdnrCount, tables.cdnr.reduce((sum, c) => sum + c.totalTaxableValue, 0), tables.cdnr.reduce((sum, c) => sum + c.totalTax, 0)],
    ['HSN Codes', tables.summary.hsnCount, tables.hsn.reduce((sum, h) => sum + h.taxableValue, 0), tables.hsn.reduce((sum, h) => sum + h.igstAmount + h.cgstAmount + h.sgstAmount, 0)],
    [''],
    ['Total Invoices', tables.summary.totalInvoices],
    ['Total Taxable Value', tables.summary.totalTaxableValue],
    ['Total Tax', tables.summary.totalTax],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Summary');
}

/**
 * Add B2B sheet to workbook
 */
function addB2BSheet(workbook: XLSX.WorkBook, b2b: GSTR1B2BCustomer[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 B2B Invoices (Business to Business)'],
    [''],
    ['Customer GSTIN', 'Customer Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
  ];

  for (const customer of b2b) {
    for (const inv of customer.invoices) {
      const item = inv.items[0] as GSTR1Item | undefined;
      data.push([
        customer.gstin,
        customer.customerName,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.invoiceValue,
        inv.placeOfSupply,
        inv.reverseCharge,
        item.taxableValue || 0,
        item.igstAmount || 0,
        item.cgstAmount || 0,
        item.sgstAmount || 0,
        item.cessAmount || 0,
      ]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'B2B');
}

/**
 * Add B2CL sheet to workbook
 */
function addB2CLSheet(workbook: XLSX.WorkBook, b2cl: GSTR1B2CLInvoice[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 B2CL Invoices (B2C Large - Inter State >₹2.5 Lakh)'],
    [''],
    ['Place of Supply', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Taxable Value', 'IGST', 'Cess'],
  ];

  for (const inv of b2cl) {
    const item = inv.items[0] as GSTR1Item | undefined;
    data.push([
      inv.placeOfSupply,
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.invoiceValue,
      item.taxableValue || 0,
      item.igstAmount || 0,
      item.cessAmount || 0,
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'B2CL');
}

/**
 * Add B2CS sheet to workbook
 */
function addB2CSSheet(workbook: XLSX.WorkBook, b2cs: GSTR1B2CSEntry[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 B2CS Summary (B2C Small - State Wise)'],
    [''],
    ['Place of Supply', 'Supply Type', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
  ];

  for (const entry of b2cs) {
    data.push([
      entry.placeOfSupply,
      entry.supplyType,
      entry.rate,
      entry.taxableValue,
      entry.igstAmount,
      entry.cgstAmount,
      entry.sgstAmount,
      entry.cessAmount,
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'B2CS');
}

/**
 * Add CDN/R sheet to workbook
 */
function addCDNRSheet(workbook: XLSX.WorkBook, cdnr: GSTR1CDNRCustomer[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 Credit/Debit Notes (Registered)'],
    [''],
    ['Customer GSTIN', 'Customer Name', 'Note Type', 'Note Number', 'Note Date', 'Invoice Number', 'Invoice Date', 'Note Value', 'Taxable Value', 'IGST', 'CGST', 'SGST'],
  ];

  for (const customer of cdnr) {
    for (const note of customer.notes) {
      const item = note.items[0] as GSTR1Item | undefined;
      data.push([
        customer.gstin,
        customer.customerName,
        note.noteType === 'C' ? 'Credit Note' : 'Debit Note',
        note.noteNumber,
        note.noteDate,
        note.invoiceNumber,
        note.invoiceDate,
        note.noteValue,
        item.taxableValue || 0,
        item.igstAmount || 0,
        item.cgstAmount || 0,
        item.sgstAmount || 0,
      ]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'CDNR');
}

/**
 * Add HSN sheet to workbook
 */
function addHSNSheet(workbook: XLSX.WorkBook, hsn: GSTR1HSNEntry[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 HSN Summary'],
    [''],
    ['HSN Code', 'Description', 'UQC', 'Quantity', 'Total Value', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
  ];

  for (const entry of hsn) {
    data.push([
      entry.hsnCode,
      entry.description,
      entry.uqc,
      entry.totalQuantity,
      entry.totalValue,
      entry.taxableValue,
      entry.igstAmount,
      entry.cgstAmount,
      entry.sgstAmount,
      entry.cessAmount,
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'HSN');
}

/**
 * Add DOCS sheet to workbook
 */
function addDOCSSheet(workbook: XLSX.WorkBook, docs: GSTR1DOCSEntry[]): void {
  const data: (string | number)[][] = [
    ['GSTR-1 Document Summary'],
    [''],
    ['Document Type', 'Serial Number', 'From Date', 'To Date', 'Total Number', 'Total Cancelled', 'Net Issued'],
  ];

  for (const doc of docs) {
    data.push([
      doc.documentType,
      doc.serialNumber,
      doc.fromDate,
      doc.toDate,
      doc.totalNumber,
      doc.totalCancelled,
      doc.netIssued,
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'DOCS');
}

// ============================================
// Download Utilities
// ============================================

/**
 * Download JSON file
 */
export function downloadJson(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Download Excel file
 */
export function downloadExcel(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Round number to 2 decimal places
 */
function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Format return period (MMYYYY -> MMM-YYYY)
 */
function formatPeriod(period: string): string {
  if (period.length !== 6) return period;
  const month = parseInt(period.substring(0, 2));
  const year = period.substring(2);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]}-${year}`;
}

/**
 * Export GSTR-1 with both formats
 */
export function exportGSTR1(
  tables: GSTR1Tables,
  gstin: string,
  period: string,
  options: Partial<ExportOptions> = {}
): { json: string; excel: XLSX.WorkBook } {
  return {
    json: exportGSTR1ToJson(tables, gstin, period),
    excel: exportGSTR1ToExcel(tables, gstin, period, options),
  };
}
