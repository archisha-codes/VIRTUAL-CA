/**
 * GSTR-1 Engine Service
 * 
 * Table generation for GSTR-1 return sections:
 * - B2B: Business to Business invoices
 * - B2CL: B2C Large invoices (>₹2.5 lakh inter-state)
 * - B2CS: B2C Small consolidated
 * - CDNR: Credit/Debit Notes (Registered)
 * - CNDS: Credit/Debit Notes (Unregistered)
 * - HSN: HSN-wise summary
 * - DOCS: Document-wise summary
 */

import type { ClassifiedInvoice, ClassificationResult } from './classifier';

// ============================================
// GSTR1 Table Types
// ============================================

// B2B Table Types (grouped by GSTIN)
export interface GSTR1B2BCustomer {
  gstin: string;
  customerName: string;
  invoices: GSTR1B2BInvoice[];
  totalTaxableValue: number;
  totalTax: number;
}

export interface GSTR1B2BInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: 'Y' | 'N';
  invoiceType: 'R' | 'SE' | 'DE' | 'OE';
  items: GSTR1Item[];
}

export interface GSTR1Item {
  itemNumber: number;
  hsnCode: string;
  quantity: number;
  unitCode: string;
  taxableValue: number;
  igstRate: number;
  igstAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  cessRate: number;
  cessAmount: number;
}

// B2CL Table Types
export interface GSTR1B2CLInvoice {
  placeOfSupply: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  items: GSTR1Item[];
}

export interface GSTR1B2CLSummary {
  placeOfSupply: string;
  totalInvoiceCount: number;
  totalTaxableValue: number;
  totalIGST: number;
  totalCess: number;
}

// B2CS Table Types (consolidated by state and rate)
export interface GSTR1B2CSEntry {
  placeOfSupply: string;
  supplyType: 'INTRA' | 'INTER';
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  ecommerceGstin?: string;
}

// CDN/R Table Types
export interface GSTR1CDNRCustomer {
  gstin: string;
  customerName: string;
  notes: GSTR1CDNRNote[];
  totalTaxableValue: number;
  totalTax: number;
}

export interface GSTR1CDNRNote {
  noteType: 'C' | 'D';
  noteNumber: string;
  noteDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  noteValue: number;
  placeOfSupply: string;
  items: GSTR1Item[];
}

// HSN Table Types
export interface GSTR1HSNEntry {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

// DOCS Table Types
export interface GSTR1DOCSEntry {
  documentType: string;
  serialNumber: string;
  fromDate: string;
  toDate: string;
  totalNumber: number;
  totalCancelled: number;
  netIssued: number;
}

// Complete GSTR1 Data Structure
export interface GSTR1Tables {
  b2b: GSTR1B2BCustomer[];
  b2cl: GSTR1B2CLInvoice[];
  b2clSummary: GSTR1B2CLSummary[];
  b2cs: GSTR1B2CSEntry[];
  cdnr: GSTR1CDNRCustomer[];
  cnds: GSTR1CDNRCustomer[];
  hsn: GSTR1HSNEntry[];
  docs: GSTR1DOCSEntry[];
  summary: GSTR1Summary;
}

export interface GSTR1Summary {
  totalInvoices: number;
  totalTaxableValue: number;
  totalTax: number;
  b2bCount: number;
  b2clCount: number;
  b2csCount: number;
  exportCount: number;
  cdnrCount: number;
  cndsCount: number;
  hsnCount: number;
}

// ============================================
// GSTR1 Engine Service
// ============================================

/**
 * Generate all GSTR-1 tables from classified invoices
 */
export function generateGSTR1Tables(classification: ClassificationResult): GSTR1Tables {
  return {
    b2b: generateB2BTable(classification.b2b),
    b2cl: generateB2CLTable(classification.b2cl),
    b2clSummary: generateB2CLSummary(classification.b2cl),
    b2cs: generateB2CSTable(classification.b2cs),
    cdnr: generateCDNRTable(classification.cdnr),
    cnds: generateCDNRTable(classification.cnds),
    hsn: generateHSNTable([...classification.b2b, ...classification.b2cl, ...classification.b2cs]),
    docs: generateDOCSTable(classification),
    summary: generateSummary(classification),
  };
}

/**
 * Generate B2B table (grouped by customer GSTIN)
 */
function generateB2BTable(invoices: ClassifiedInvoice[]): GSTR1B2BCustomer[] {
  const customerMap = new Map<string, GSTR1B2BCustomer>();

  for (const inv of invoices) {
    const gstin = inv.customer_gstin || 'Unknown';
    const existing = customerMap.get(gstin);

    const b2bInvoice: GSTR1B2BInvoice = {
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date || '',
      invoiceValue: inv.total_amount,
      placeOfSupply: inv.place_of_supply,
      reverseCharge: inv.reverseCharge ? 'Y' : 'N',
      invoiceType: 'R', // Regular
      items: [
        {
          itemNumber: 1,
          hsnCode: inv.hsn_code,
          quantity: 1,
          unitCode: 'NOS',
          taxableValue: inv.taxable_value,
          igstRate: inv.igst_rate,
          igstAmount: inv.igst_amount,
          cgstRate: inv.cgst_rate,
          cgstAmount: inv.cgst_amount,
          sgstRate: inv.sgst_rate,
          sgstAmount: inv.sgst_amount,
          cessRate: 0,
          cessAmount: 0,
        },
      ],
    };

    const tax = inv.igst_amount + inv.cgst_amount + inv.sgst_amount;

    if (existing) {
      existing.invoices.push(b2bInvoice);
      existing.totalTaxableValue += inv.taxable_value;
      existing.totalTax += tax;
    } else {
      customerMap.set(gstin, {
        gstin,
        customerName: inv.customer_name || 'Unknown Customer',
        invoices: [b2bInvoice],
        totalTaxableValue: inv.taxable_value,
        totalTax: tax,
      });
    }
  }

  return Array.from(customerMap.values()).sort((a, b) => 
    a.gstin.localeCompare(b.gstin)
  );
}

/**
 * Generate B2CL table (individual invoices, no grouping)
 */
function generateB2CLTable(invoices: ClassifiedInvoice[]): GSTR1B2CLInvoice[] {
  return invoices.map(inv => ({
    placeOfSupply: inv.place_of_supply,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date || '',
    invoiceValue: inv.total_amount,
    items: [
      {
        itemNumber: 1,
        hsnCode: inv.hsn_code,
        quantity: 1,
        unitCode: 'NOS',
        taxableValue: inv.taxable_value,
        igstRate: inv.igst_rate,
        igstAmount: inv.igst_amount,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        cessRate: 0,
        cessAmount: 0,
      },
    ],
  }));
}

/**
 * Generate B2CL summary (aggregated by place of supply)
 */
function generateB2CLSummary(invoices: ClassifiedInvoice[]): GSTR1B2CLSummary[] {
  const summaryMap = new Map<string, GSTR1B2CLSummary>();

  for (const inv of invoices) {
    const pos = inv.place_of_supply;
    const existing = summaryMap.get(pos);

    if (existing) {
      existing.totalInvoiceCount++;
      existing.totalTaxableValue += inv.taxable_value;
      existing.totalIGST += inv.igst_amount;
    } else {
      summaryMap.set(pos, {
        placeOfSupply: pos,
        totalInvoiceCount: 1,
        totalTaxableValue: inv.taxable_value,
        totalIGST: inv.igst_amount,
        totalCess: 0,
      });
    }
  }

  return Array.from(summaryMap.values());
}

/**
 * Generate B2CS table (consolidated by state and rate)
 */
function generateB2CSTable(invoices: ClassifiedInvoice[]): GSTR1B2CSEntry[] {
  const entryMap = new Map<string, GSTR1B2CSEntry>();

  for (const inv of invoices) {
    const pos = inv.place_of_supply || inv.stateCode;
    const rate = inv.igst_rate || inv.cgst_rate || inv.sgst_rate || 0;
    const key = `${pos}-${rate}`;

    const existing = entryMap.get(key);

    if (existing) {
      existing.taxableValue += inv.taxable_value;
      existing.igstAmount += inv.igst_amount;
      existing.cgstAmount += inv.cgst_amount;
      existing.sgstAmount += inv.sgst_amount;
    } else {
      entryMap.set(key, {
        placeOfSupply: pos,
        supplyType: inv.isInterState ? 'INTER' : 'INTRA',
        rate,
        taxableValue: inv.taxable_value,
        igstAmount: inv.igst_amount,
        cgstAmount: inv.cgst_amount,
        sgstAmount: inv.sgst_amount,
        cessAmount: 0,
      });
    }
  }

  return Array.from(entryMap.values());
}

/**
 * Generate CDN/R table (grouped by customer GSTIN)
 */
function generateCDNRTable(notes: ClassifiedInvoice[]): GSTR1CDNRCustomer[] {
  const customerMap = new Map<string, GSTR1CDNRCustomer>();

  for (const note of notes) {
    const gstin = note.customer_gstin || 'URP';
    const existing = customerMap.get(gstin);

    const cdnrNote: GSTR1CDNRNote = {
      noteType: note.total_amount < 0 ? 'C' : 'D',
      noteNumber: note.invoice_number,
      noteDate: note.invoice_date || '',
      invoiceNumber: note.invoice_number,
      invoiceDate: note.invoice_date || '',
      noteValue: Math.abs(note.total_amount),
      placeOfSupply: note.place_of_supply,
      items: [
        {
          itemNumber: 1,
          hsnCode: note.hsn_code,
          quantity: 1,
          unitCode: 'NOS',
          taxableValue: Math.abs(note.taxable_value),
          igstRate: note.igst_rate,
          igstAmount: Math.abs(note.igst_amount),
          cgstRate: note.cgst_rate,
          cgstAmount: Math.abs(note.cgst_amount),
          sgstRate: note.sgst_rate,
          sgstAmount: Math.abs(note.sgst_amount),
          cessRate: 0,
          cessAmount: 0,
        },
      ],
    };

    const tax = Math.abs(note.igst_amount + note.cgst_amount + note.sgst_amount);

    if (existing) {
      existing.notes.push(cdnrNote);
      existing.totalTaxableValue += Math.abs(note.taxable_value);
      existing.totalTax += tax;
    } else {
      customerMap.set(gstin, {
        gstin,
        customerName: note.customer_name || 'Unknown',
        notes: [cdnrNote],
        totalTaxableValue: Math.abs(note.taxable_value),
        totalTax: tax,
      });
    }
  }

  return Array.from(customerMap.values());
}

/**
 * Generate HSN table (aggregated by HSN code)
 */
function generateHSNTable(invoices: ClassifiedInvoice[]): GSTR1HSNEntry[] {
  const hsnMap = new Map<string, GSTR1HSNEntry>();

  for (const inv of invoices) {
    const hsn = inv.hsn_code || '00000000';
    const existing = hsnMap.get(hsn);

    if (existing) {
      existing.totalQuantity += 1;
      existing.totalValue += inv.total_amount;
      existing.taxableValue += inv.taxable_value;
      existing.igstAmount += inv.igst_amount;
      existing.cgstAmount += inv.cgst_amount;
      existing.sgstAmount += inv.sgst_amount;
    } else {
      hsnMap.set(hsn, {
        hsnCode: hsn,
        description: `HSN Code ${hsn}`,
        uqc: 'NOS',
        totalQuantity: 1,
        totalValue: inv.total_amount,
        taxableValue: inv.taxable_value,
        igstAmount: inv.igst_amount,
        cgstAmount: inv.cgst_amount,
        sgstAmount: inv.sgst_amount,
        cessAmount: 0,
      });
    }
  }

  return Array.from(hsnMap.values());
}

/**
 * Generate DOCS table (document-wise summary)
 */
function generateDOCSTable(classification: ClassificationResult): GSTR1DOCSEntry[] {
  const docs: GSTR1DOCSEntry[] = [];
  let serialNo = 1;

  // Invoice - B2B
  if (classification.b2b.length > 0) {
    docs.push({
      documentType: 'Invoice',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: classification.b2b.length,
      totalCancelled: 0,
      netIssued: classification.b2b.length,
    });
  }

  // Invoice - B2CL
  if (classification.b2cl.length > 0) {
    docs.push({
      documentType: 'Invoice',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: classification.b2cl.length,
      totalCancelled: 0,
      netIssued: classification.b2cl.length,
    });
  }

  // Invoice - B2CS (consolidated, no individual invoices)
  if (classification.b2cs.length > 0) {
    docs.push({
      documentType: 'Invoice',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: classification.b2cs.length,
      totalCancelled: 0,
      netIssued: classification.b2cs.length,
    });
  }

  // Credit Note
  const creditNoteCount = classification.cdnr.length;
  if (creditNoteCount > 0) {
    docs.push({
      documentType: 'Credit Note',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: creditNoteCount,
      totalCancelled: 0,
      netIssued: creditNoteCount,
    });
  }

  // Debit Note
  const debitNoteCount = classification.cnds.length;
  if (debitNoteCount > 0) {
    docs.push({
      documentType: 'Debit Note',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: debitNoteCount,
      totalCancelled: 0,
      netIssued: debitNoteCount,
    });
  }

  // Export Invoice
  if (classification.export.length > 0) {
    docs.push({
      documentType: 'Export Invoice',
      serialNumber: String(serialNo++),
      fromDate: '',
      toDate: '',
      totalNumber: classification.export.length,
      totalCancelled: 0,
      netIssued: classification.export.length,
    });
  }

  return docs;
}

/**
 * Generate overall summary
 */
function generateSummary(classification: ClassificationResult): GSTR1Summary {
  return {
    totalInvoices: classification.summary.total,
    totalTaxableValue: classification.summary.totalTaxableValue,
    totalTax: classification.summary.totalTax,
    b2bCount: classification.b2b.length,
    b2clCount: classification.b2cl.length,
    b2csCount: classification.b2cs.length,
    exportCount: classification.export.length,
    cdnrCount: classification.cdnr.length,
    cndsCount: classification.cnds.length,
    hsnCount: 0, // Will be updated after HSN generation
  };
}

/**
 * Convert GSTR1 tables to backend format (JSON payload)
 */
export function toBackendFormat(tables: GSTR1Tables, gstin: string, period: string): object {
  return {
    gstin,
    fp: period,
    b2b: tables.b2b.map(customer => ({
      ctin: customer.gstin,
      name: customer.customerName,
      inv: customer.invoices.map(inv => ({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.invoiceValue,
        pos: inv.placeOfSupply,
        rchrg: inv.reverseCharge,
        typ: inv.invoiceType,
        itms: inv.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: item.taxableValue,
            iamt: item.igstAmount,
            camt: item.cgstAmount,
            samt: item.sgstAmount,
            csamt: item.cessAmount,
            rt: item.igstRate || item.cgstRate || item.sgstRate,
          },
        })),
      })),
    })),
    b2cl: tables.b2cl.map(inv => ({
      pos: inv.placeOfSupply,
      inv: [{
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.invoiceValue,
        itms: inv.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: item.taxableValue,
            iamt: item.igstAmount,
            csamt: item.cessAmount,
            rt: item.igstRate,
          },
        })),
      }],
    })),
    b2cs: tables.b2cs.map(entry => ({
      pos: entry.placeOfSupply,
      typ: entry.supplyType === 'INTER' ? 'INTER' : 'INTRA',
      txval: entry.taxableValue,
      iamt: entry.igstAmount,
      camt: entry.cgstAmount,
      samt: entry.sgstAmount,
      csamt: entry.cessAmount,
      rt: entry.rate,
    })),
    cdnr: tables.cdnr.map(customer => ({
      ctin: customer.gstin,
      nt: customer.notes.map(note => ({
        nty: note.noteType,
        nt_num: note.noteNumber,
        nt_dt: note.noteDate,
        inum: note.invoiceNumber,
        idt: note.invoiceDate,
        val: note.noteValue,
        pos: note.placeOfSupply,
        itms: note.items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            hsn: item.hsnCode,
            qty: item.quantity,
            unit: item.unitCode,
            txval: item.taxableValue,
            iamt: item.igstAmount,
            camt: item.cgstAmount,
            samt: item.sgstAmount,
            csamt: item.cessAmount,
            rt: item.igstRate || item.cgstRate,
          },
        })),
      })),
    })),
    hsn: {
      data: tables.hsn.map(hsn => ({
        hsn_sc: hsn.hsnCode,
        desc: hsn.description,
        uqc: hsn.uqc,
        qty: hsn.totalQuantity,
        val: hsn.totalValue,
        txval: hsn.taxableValue,
        iamt: hsn.igstAmount,
        camt: hsn.cgstAmount,
        samt: hsn.sgstAmount,
        csamt: hsn.cessAmount,
      })),
    },
  };
}
