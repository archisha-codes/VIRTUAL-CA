/**
 * GSTR Data Transform Utilities
 * 
 * Transform functions to convert backend API responses to frontend UI format.
 * These functions handle the nested structure mapping.
 * 
 * NOTE: The backend returns B2B with this structure:
 * {
 *   ctin: "27GSTIN...",
 *   name: "Customer Name",
 *   invoices: [{ ino, idt, val, pos, items: [...] }]
 * }
 * 
 * NOT the previously expected structure with customer nested object.
 */

import type {
  BackendB2BInvoice,
  BackendB2CLInvoice,
  BackendB2CSEntry,
  BackendExportInvoice,
  BackendCDNREntry,
} from './api';

// ============================================
// B2B Transformations
// ============================================

export interface B2BInvoice {
  customerGstin: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: 'Y' | 'N';
  invoiceType: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  rate: number;
}

export interface B2BCustomer {
  customerGstin: string;
  customerName: string;
  invoices: B2BInvoice[];
  totalTaxableValue: number;
  totalTax: number;
}

// Backend B2B entry structure (actual from gstr1_data.py)
interface BackendB2BEntry {
  ctin?: string;
  name?: string;
  invoices?: Array<{
    ino?: string;
    idt?: string;
    val?: number;
    pos?: string;
    rch?: string;
    typ?: string;
    items?: Array<{
      txval?: number;
      iamt?: number;
      camt?: number;
      samt?: number;
      csamt?: number;
      rt?: number;
    }>;
  }>;
  // Also support legacy structure for backwards compatibility
  customer?: { gstin: string; name: string };
  invoice_no?: string;
  items?: Array<{
    taxable_value: number;
    igst_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    cess_amount: number;
    tax_rate: number;
  }>;
}

export function transformBackendB2BToFrontend(b2b: any[]): B2BCustomer[] {
  const customerMap = new Map<string, B2BCustomer>();
  
  if (!b2b || !Array.isArray(b2b)) {
    return [];
  }
  
  // Handle new structure: { ctin, name, invoices: [{ ino, idt, val, pos, items: [...] }] }
  b2b.forEach((entry) => {
    if (!entry) return;
    
    // Try new structure first (ctin + invoices array)
    if (entry.ctin && entry.invoices && Array.isArray(entry.invoices)) {
      const gstin = entry.ctin;
      const customerName = entry.name || 'Unknown';
      
      entry.invoices.forEach((inv: any) => {
        if (!inv) return;
        
        const invoiceData: B2BInvoice = {
          customerGstin: gstin,
          customerName: customerName,
          invoiceNumber: inv.ino || inv.invoice_no || '',
          invoiceDate: inv.idt || '',
          invoiceValue: inv.val || 0,
          placeOfSupply: inv.pos || '',
          reverseCharge: inv.rch === 'Y' ? 'Y' : 'N',
          invoiceType: inv.typ || 'Regular',
          taxableValue: (inv.items && inv.items[0] && inv.items[0].txval) || 0,
          igst: (inv.items && inv.items[0] && inv.items[0].iamt) || 0,
          cgst: (inv.items && inv.items[0] && inv.items[0].camt) || 0,
          sgst: (inv.items && inv.items[0] && inv.items[0].samt) || 0,
          cess: (inv.items && inv.items[0] && inv.items[0].csamt) || 0,
          rate: (inv.items && inv.items[0] && inv.items[0].rt) || 0,
        };
        
        const tax = invoiceData.igst + invoiceData.cgst + invoiceData.sgst;
        const existing = customerMap.get(gstin);
        
        if (existing) {
          existing.invoices.push(invoiceData);
          existing.totalTaxableValue += invoiceData.taxableValue;
          existing.totalTax += tax;
        } else {
          customerMap.set(gstin, {
            customerGstin: gstin,
            customerName,
            invoices: [invoiceData],
            totalTaxableValue: invoiceData.taxableValue,
            totalTax: tax,
          });
        }
      });
    }
    // Fallback: legacy structure { customer: { gstin, name }, items: [...] }
    else if (entry.customer?.gstin) {
      const gstin = entry.customer.gstin;
      const customerName = entry.customer.name || 'Unknown';
      
      const invoiceData: B2BInvoice = {
        customerGstin: gstin,
        customerName,
        invoiceNumber: entry.invoice_no || '',
        invoiceDate: '',
        invoiceValue: 0,
        placeOfSupply: '',
        reverseCharge: 'N',
        invoiceType: 'Regular',
        taxableValue: (entry.items && entry.items[0] && entry.items[0].taxable_value) || 0,
        igst: (entry.items && entry.items[0] && entry.items[0].igst_amount) || 0,
        cgst: (entry.items && entry.items[0] && entry.items[0].cgst_amount) || 0,
        sgst: (entry.items && entry.items[0] && entry.items[0].sgst_amount) || 0,
        cess: (entry.items && entry.items[0] && entry.items[0].cess_amount) || 0,
        rate: (entry.items && entry.items[0] && entry.items[0].tax_rate) || 0,
      };
      
      const tax = invoiceData.igst + invoiceData.cgst + invoiceData.sgst;
      const existing = customerMap.get(gstin);
      
      if (existing) {
        existing.invoices.push(invoiceData);
        existing.totalTaxableValue += invoiceData.taxableValue;
        existing.totalTax += tax;
      } else {
        customerMap.set(gstin, {
          customerGstin: gstin,
          customerName,
          invoices: [invoiceData],
          totalTaxableValue: invoiceData.taxableValue,
          totalTax: tax,
        });
      }
    }
  });
  
  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

// ============================================
// B2CL Transformations
// ============================================

export interface B2CLInvoice {
  placeOfSupply: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cess: number;
  rate: number;
}

// Use any to handle backend's actual structure (pos, ino, idt, val, items)
// instead of the legacy structure expected by API types
export function transformBackendB2CLToFrontend(b2cl: any[]): B2CLInvoice[] {
  return b2cl.map((invoice) => ({
    placeOfSupply: invoice.pos || invoice.place_of_supply || '',
    invoiceNumber: invoice.ino || invoice.invoice_no || '',
    invoiceDate: invoice.idt || invoice.invoice_date || '',
    invoiceValue: invoice.val || invoice.invoice_value || 0,
    taxableValue: invoice.items?.[0]?.txval || invoice.items?.[0]?.taxable_value || 0,
    igst: invoice.items?.[0]?.iamt || invoice.items?.[0]?.igst_amount || 0,
    cess: invoice.items?.[0]?.csamt || invoice.items?.[0]?.cess_amount || 0,
    rate: invoice.items?.[0]?.rt || invoice.items?.[0]?.tax_rate || 0,
  }));
}

// ============================================
// B2CS Transformations
// ============================================

export interface B2CSSummary {
  placeOfSupply: string;
  supplyType: 'INTRA' | 'INTER';
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  rate: number;
}

export function transformBackendB2CSToFrontend(b2cs: any[]): B2CSSummary[] {
  const summaryMap = new Map<string, B2CSSummary>();
  
  b2cs.forEach((entry) => {
    const pos = entry.pos || entry.place_of_supply || '';
    const rate = entry.rt || entry.items?.[0]?.tax_rate || 0;
    const key = `${pos}-${rate}`;
    
    const taxableValue = entry.txval || entry.items?.[0]?.taxable_value || 0;
    const igst = entry.iamt || entry.items?.[0]?.igst_amount || 0;
    const cgst = entry.camt || entry.items?.[0]?.cgst_amount || 0;
    const sgst = entry.samt || entry.items?.[0]?.sgst_amount || 0;
    const cess = entry.csamt || entry.items?.[0]?.cess_amount || 0;
    
    const supplyType = igst > 0 ? 'INTER' : 'INTRA';
    
    const existing = summaryMap.get(key);
    
    if (existing) {
      existing.taxableValue += taxableValue;
      existing.igst += igst;
      existing.cgst += cgst;
      existing.sgst += sgst;
      existing.cess += cess;
    } else {
      summaryMap.set(key, {
        placeOfSupply: pos,
        supplyType,
        taxableValue,
        igst,
        cgst,
        sgst,
        cess,
        rate,
      });
    }
  });
  
  return Array.from(summaryMap.values());
}

// ============================================
// Export Transformations
// ============================================

export interface ExportInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  taxableValue: number;
  igst: number;
  rate: number;
  shippingBill?: {
    billNo: string;
    billDate: string;
    portCode: string;
  };
}

export function transformBackendExportToFrontend(exports: any[]): ExportInvoice[] {
  return exports.map((invoice) => ({
    invoiceNumber: invoice.ino || invoice.invoice_no || '',
    invoiceDate: invoice.idt || invoice.invoice_date || '',
    invoiceValue: invoice.val || invoice.invoice_value || 0,
    placeOfSupply: invoice.pos || invoice.place_of_supply || '',
    taxableValue: invoice.items?.[0]?.txval || invoice.items?.[0]?.taxable_value || 0,
    igst: invoice.items?.[0]?.iamt || invoice.items?.[0]?.igst_amount || 0,
    rate: invoice.items?.[0]?.rt || invoice.items?.[0]?.tax_rate || 0,
    shippingBill: invoice.shipping_bill ? {
      billNo: invoice.shipping_bill.bill_no || invoice.sbno || '',
      billDate: invoice.shipping_bill.bill_date || invoice.sbdt || '',
      portCode: invoice.shipping_bill.port_code || invoice.sbpcode || '',
    } : undefined,
  }));
}

// ============================================
// CDN/R Transformations
// ============================================

export interface CDNRNote {
  customerGstin: string;
  customerName: string;
  noteNumber: string;
  noteDate: string;
  noteType: 'C' | 'D';
  noteValue: number;
  placeOfSupply: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  rate: number;
}

export interface CDNRCustomer {
  customerGstin: string;
  customerName: string;
  notes: CDNRNote[];
  totalTaxableValue: number;
  totalTax: number;
}

export function transformBackendCDNRToFrontend(cdnr: any[]): CDNRCustomer[] {
  const customerMap = new Map<string, CDNRCustomer>();
  
  cdnr.forEach((note) => {
    // Handle new structure: { ctin, name, notes: [...] }
    const gstin = note.ctin || note.customer?.gstin;
    const customerName = note.name || note.customer?.name || 'Unknown';
    
    if (!gstin) return;
    
    const existing = customerMap.get(gstin);
    
    // Handle notes array (new structure) or single note (legacy)
    const notes = note.notes || [note];
    
    notes.forEach((n: any) => {
      const noteData: CDNRNote = {
        customerGstin: gstin,
        customerName,
        noteNumber: n.ntty === 'C' ? n.onty : n.ntty === 'D' ? n.onty : n.invoice_no || '',
        noteDate: n.nt_dt || n.idt || '',
        noteType: (n.ntty === 'C' || n.typ === 'C') ? 'C' : 'D',
        noteValue: n.val || n.note_value || 0,
        placeOfSupply: n.pos || n.place_of_supply || '',
        taxableValue: n.items?.[0]?.txval || n.items?.[0]?.taxable_value || 0,
        igst: n.items?.[0]?.iamt || n.items?.[0]?.igst_amount || 0,
        cgst: n.items?.[0]?.camt || n.items?.[0]?.cgst_amount || 0,
        sgst: n.items?.[0]?.samt || n.items?.[0]?.sgst_amount || 0,
        cess: n.items?.[0]?.csamt || n.items?.[0]?.cess_amount || 0,
        rate: n.items?.[0]?.rt || n.items?.[0]?.tax_rate || 0,
      };
      
      const tax = noteData.igst + noteData.cgst + noteData.sgst;
      
      if (existing) {
        existing.notes.push(noteData);
        existing.totalTaxableValue += noteData.taxableValue;
        existing.totalTax += tax;
      } else {
        customerMap.set(gstin, {
          customerGstin: gstin,
          customerName,
          notes: [noteData],
          totalTaxableValue: noteData.taxableValue,
          totalTax: tax,
        });
      }
    });
  });
  
  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

// ============================================
// HSN Transformations
// ============================================

export interface HSNSummary {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export function calculateHSNFromB2B(b2b: B2BCustomer[]): HSNSummary[] {
  const hsnMap = new Map<string, HSNSummary>();
  
  b2b.forEach((customer) => {
    customer.invoices.forEach((invoice) => {
      const key = `HSN-${Math.floor(invoice.rate)}`;
      const existing = hsnMap.get(key);
      
      if (existing) {
        existing.totalQuantity += 1;
        existing.totalValue += invoice.invoiceValue;
        existing.taxableValue += invoice.taxableValue;
        existing.igst += invoice.igst;
        existing.cgst += invoice.cgst;
        existing.sgst += invoice.sgst;
      } else {
        hsnMap.set(key, {
          hsnCode: key.replace('HSN-', ''),
          description: `Rate ${invoice.rate}%`,
          uqc: 'NOS',
          totalQuantity: 1,
          totalValue: invoice.invoiceValue,
          taxableValue: invoice.taxableValue,
          igst: invoice.igst,
          cgst: invoice.cgst,
          sgst: invoice.sgst,
          cess: invoice.cess,
        });
      }
    });
  });
  
  return Array.from(hsnMap.values()).sort((a, b) =>
    a.hsnCode.localeCompare(b.hsnCode)
  );
}
