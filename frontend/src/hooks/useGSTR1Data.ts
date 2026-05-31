/**
 * GSTR-1 Data Hook - Backend Integration
 * 
 * This hook fetches and processes GSTR-1 data from the backend API.
 * Backend performs all calculations - this is purely presentation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  uploadSalesExcel, 
  exportGSTR1Excel, 
  downloadExcelFromResponse,
  type BackendGSTR1Response,
  type BackendB2BInvoice,
  type BackendB2CLInvoice,
  type BackendB2CSEntry,
  type BackendExportInvoice,
  type BackendCDNREntry,
} from '@/lib/api';

// ============================================
// Type Definitions (Frontend-friendly)
// ============================================

// B2B Invoice structure for UI
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

// B2B grouped by customer GSTIN (matches backend structure)
export interface B2BCustomer {
  customerGstin: string;
  customerName: string;
  invoices: B2BInvoice[];
  totalTaxableValue: number;
  totalTax: number;
}

// B2CL Invoice (Large B2C > 2.5 lakh inter-state)
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

// B2CS Summary (state-wise for small B2C)
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

// Export Invoice
export interface ExportInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  rate: number;
  shippingBill?: {
    billNo: string;
    billDate: string;
    portCode: string;
  };
}

// CDN/R Note structure
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

// CDN/R grouped by customer GSTIN
export interface CDNRCustomer {
  customerGstin: string;
  customerName: string;
  notes: CDNRNote[];
  totalTaxableValue: number;
  totalTax: number;
}

// HSN Summary
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

export interface GSTR1Data {
  b2b: B2BCustomer[];
  b2cl: B2CLInvoice[];
  b2cs: B2CSSummary[];
  export: ExportInvoice[];
  cdnr: CDNRCustomer[];
  hsn: HSNSummary[];
  summary: {
    totalB2BInvoices: number;
    totalB2CLInvoices: number;
    totalB2CSRecords: number;
    totalExportInvoices: number;
    totalCDNRNotes: number;
    totalHSNCodes: number;
    totalTaxableValue: number;
    totalTax: number;
  };
  validationSummary?: {
    totalErrors: number;
    totalWarnings: number;
    isValid: boolean;
  };
}

export interface GSTR1FilterOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface UploadOptions {
  onSuccess?: (data: BackendGSTR1Response) => void;
  onError?: (error: Error) => void;
}

// ============================================
// Data Transformation Functions
// Transform backend data to frontend-friendly format
// ============================================

export function transformBackendB2BToFrontend(b2b: BackendB2BInvoice[]): B2BCustomer[] {
  // Group B2B invoices by customer GSTIN
  const customerMap = new Map<string, B2BCustomer>();
  
  b2b.forEach((invoice) => {
    const gstin = invoice.customer?.gstin || '';
    const existing = customerMap.get(gstin);
    
    // Backend returns GSTN format: txval, iamt, camt, samt, csamt, rt
    // We need to handle both formats for backwards compatibility
    const firstItem = invoice.items?.[0] || {};
    const taxableValue = firstItem.txval ?? firstItem.taxable_value ?? 0;
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0;
    const cgst = firstItem.camt ?? firstItem.cgst_amount ?? 0;
    const sgst = firstItem.samt ?? firstItem.sgst_amount ?? 0;
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0;
    const rate = firstItem.rt ?? firstItem.tax_rate ?? 0;
    
    const invoiceData: B2BInvoice = {
      customerGstin: gstin,
      customerName: invoice.customer?.name || 'Unknown',
      invoiceNumber: invoice.invoice_no || '',
      invoiceDate: invoice.invoice_date || '',
      invoiceValue: invoice.invoice_value || 0,
      placeOfSupply: invoice.place_of_supply || '',
      reverseCharge: invoice.reverse_charge ? 'Y' : 'N',
      invoiceType: invoice.invoice_type || 'Regular',
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      rate,
    };
    
    const tax = invoiceData.igst + invoiceData.cgst + invoiceData.sgst;
    
    if (existing) {
      existing.invoices.push(invoiceData);
      existing.totalTaxableValue += invoiceData.taxableValue;
      existing.totalTax += tax;
    } else {
      customerMap.set(gstin, {
        customerGstin: gstin,
        customerName: invoice.customer?.name || 'Unknown',
        invoices: [invoiceData],
        totalTaxableValue: invoiceData.taxableValue,
        totalTax: tax,
      });
    }
  });
  
  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

export function transformBackendB2CLToFrontend(b2cl: BackendB2CLInvoice[]): B2CLInvoice[] {
  return b2cl.map((invoice) => {
    // Backend returns GSTN format: txval, iamt, camt, samt, csamt, rt
    const firstItem = invoice.items?.[0] || {};
    const taxableValue = firstItem.txval ?? firstItem.taxable_value ?? 0;
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0;
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0;
    const rate = firstItem.rt ?? firstItem.tax_rate ?? 0;
    
    return {
      placeOfSupply: invoice.place_of_supply || '',
      invoiceNumber: invoice.invoice_no || '',
      invoiceDate: invoice.invoice_date || '',
      invoiceValue: invoice.invoice_value || 0,
      taxableValue,
      igst,
      cess,
      rate,
    };
  });
}

export function transformBackendB2CSToFrontend(b2cs: BackendB2CSEntry[]): B2CSSummary[] {
  // Group B2CS by place of supply and determine inter/intra state
  const summaryMap = new Map<string, B2CSSummary>();
  
  b2cs.forEach((entry) => {
    // Handle both flat format (pos, rt, txval, etc.) and nested format
    const pos = entry.pos || entry.place_of_supply || '';
    const rate = entry.rt ?? entry.items?.[0]?.tax_rate ?? 0;
    const key = `${pos}-${rate}`;
    
    const existing = summaryMap.get(key);
    
    // Handle both flat format and nested items format
    let taxableValue: number, igst: number, cgst: number, sgst: number, cess: number;
    
    if (entry.txval !== undefined) {
      // Flat format from backend
      taxableValue = entry.txval ?? 0;
      igst = entry.iamt ?? 0;
      cgst = entry.camt ?? 0;
      sgst = entry.samt ?? 0;
      cess = entry.csamt ?? 0;
    } else {
      // Nested items format
      const firstItem = entry.items?.[0] || {};
      taxableValue = firstItem.txval ?? firstItem.taxable_value ?? 0;
      igst = firstItem.iamt ?? firstItem.igst_amount ?? 0;
      cgst = firstItem.camt ?? firstItem.cgst_amount ?? 0;
      sgst = firstItem.samt ?? firstItem.sgst_amount ?? 0;
      cess = firstItem.csamt ?? firstItem.cess_amount ?? 0;
    }
    
    // Determine if inter-state (IGST > 0 means inter-state)
    const supplyType = igst > 0 ? 'INTER' : 'INTRA';
    
    if (existing) {
      existing.taxableValue += taxableValue;
      existing.igst += igst;
      existing.cgst += cgst;
      existing.sgst += sgst;
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

export function transformBackendExportToFrontend(exports: BackendExportInvoice[]): ExportInvoice[] {
  return exports.map((invoice) => {
    // Backend returns GSTN format: txval, iamt, rt
    const firstItem = invoice.items?.[0] || {};
    const taxableValue = firstItem.txval ?? firstItem.taxable_value ?? 0;
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0;
    const rate = firstItem.rt ?? firstItem.tax_rate ?? 0;
    
    return {
      invoiceNumber: invoice.invoice_no || '',
      invoiceDate: invoice.invoice_date || '',
      invoiceValue: invoice.invoice_value || 0,
      taxableValue,
      igst,
      rate,
      shippingBill: invoice.shipping_bill ? {
        billNo: invoice.shipping_bill.bill_no,
        billDate: invoice.shipping_bill.bill_date,
        portCode: invoice.shipping_bill.port_code,
      } : undefined,
    };
  });
}

export function transformBackendCDNRToFrontend(cdnr: BackendCDNREntry[]): CDNRCustomer[] {
  // Group CDN/R by customer GSTIN
  const customerMap = new Map<string, CDNRCustomer>();
  
  cdnr.forEach((note) => {
    const gstin = note.customer?.gstin || '';
    const existing = customerMap.get(gstin);
    
    // Backend returns GSTN format: txval, iamt, camt, samt, csamt, rt
    const firstItem = note.items?.[0] || {};
    const taxableValue = firstItem.txval ?? firstItem.taxable_value ?? 0;
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0;
    const cgst = firstItem.camt ?? firstItem.cgst_amount ?? 0;
    const sgst = firstItem.samt ?? firstItem.sgst_amount ?? 0;
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0;
    const rate = firstItem.rt ?? firstItem.tax_rate ?? 0;
    
    const noteData: CDNRNote = {
      customerGstin: gstin,
      customerName: note.customer?.name || 'Unknown',
      noteNumber: note.invoice_no || '',
      noteDate: note.invoice_date || '',
      noteType: note.invoice_type === 'C' ? 'C' : 'D',
      noteValue: note.invoice_value || 0,
      placeOfSupply: note.place_of_supply || '',
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      rate,
    };
    
    const tax = noteData.igst + noteData.cgst + noteData.sgst;
    
    if (existing) {
      existing.notes.push(noteData);
      existing.totalTaxableValue += noteData.taxableValue;
      existing.totalTax += tax;
    } else {
      customerMap.set(gstin, {
        customerGstin: gstin,
        customerName: note.customer?.name || 'Unknown',
        notes: [noteData],
        totalTaxableValue: noteData.taxableValue,
        totalTax: tax,
      });
    }
  });
  
  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

function transformBackendToFrontend(response: BackendGSTR1Response): GSTR1Data {
  const b2b = transformBackendB2BToFrontend(response.b2b);
  const b2cl = transformBackendB2CLToFrontend(response.b2cl);
  const b2cs = transformBackendB2CSToFrontend(response.b2cs);
  const exports = transformBackendExportToFrontend(response.export);
  const cdnr = transformBackendCDNRToFrontend(response.cdnr);
  
  // Calculate totals
  const totalB2BInvoices = b2b.reduce((sum, cust) => sum + cust.invoices.length, 0);
  const totalExportInvoices = exports.length;
  const totalCDNRNotes = cdnr.reduce((sum, cust) => sum + cust.notes.length, 0);
  
  const totalTaxableValue =
    b2b.reduce((sum, cust) => sum + cust.totalTaxableValue, 0) +
    b2cl.reduce((sum, inv) => sum + inv.taxableValue, 0) +
    b2cs.reduce((sum, s) => sum + s.taxableValue, 0) +
    exports.reduce((sum, inv) => sum + inv.taxableValue, 0);
  
  const totalTax =
    b2b.reduce((sum, cust) => sum + cust.totalTax, 0) +
    b2cl.reduce((sum, inv) => sum + inv.igst, 0) +
    b2cs.reduce((sum, s) => sum + s.igst + s.cgst + s.sgst, 0) +
    exports.reduce((sum, inv) => sum + inv.igst, 0);
  
  return {
    b2b,
    b2cl,
    b2cs,
    export: exports,
    cdnr,
    hsn: [], // HSN needs separate aggregation from backend
    summary: {
      totalB2BInvoices,
      totalB2CLInvoices: b2cl.length,
      totalB2CSRecords: b2cs.length,
      totalExportInvoices,
      totalCDNRNotes,
      totalHSNCodes: 0, // Will be populated if HSN data available
      totalTaxableValue,
      totalTax,
    },
    validationSummary: {
      totalErrors: response.validation_summary.total_errors,
      totalWarnings: response.validation_summary.total_warnings,
      isValid: response.validation_summary.is_valid,
    },
  };
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Upload Excel file and process GSTR-1 data
 */
export function useUploadGSTR1Excel(options?: UploadOptions) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await uploadSalesExcel(file);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate any cached queries
      queryClient.invalidateQueries({ queryKey: ['gstr1'] });
      options?.onSuccess?.(data as BackendGSTR1Response);
    },
    onError: (error) => {
      options?.onError?.(error as Error);
    },
  });
}

/**
 * Export GSTR-1 data as Excel
 */
export function useExportGSTR1Excel() {
  return useMutation({
    mutationFn: async (params: {
      cleanData: Record<string, unknown>[];
      returnPeriod: string;
      taxpayerGstin: string;
      taxpayerName: string;
    }) => {
      const blob = await exportGSTR1Excel({
        clean_data: params.cleanData,
        return_period: params.returnPeriod,
        taxpayer_gstin: params.taxpayerGstin,
        taxpayer_name: params.taxpayerName,
        include_hsn: true,
        include_docs: false,
      });
      return blob;
    },
    onSuccess: (blob) => {
      downloadExcelFromResponse(blob, 'gstr1.xlsx');
    },
  });
}

/**
 * Fetch GSTR-1 data from backend
 * Note: This requires the data to be stored in backend session/cache
 * For now, we use the upload response data directly
 */
export function useGSTR1Data() {
  return useQuery({
    queryKey: ['gstr1-processed'],
    queryFn: async (): Promise<GSTR1Data | null> => {
      // This would typically fetch from a cached session
      // For now, return null - data comes from upload response
      return null;
    },
    enabled: false, // Manual trigger only
  });
}

/**
 * Transform raw backend response to frontend format
 */
export function useProcessedGSTR1Data(backendResponse: BackendGSTR1Response | null) {
  return useQuery({
    queryKey: ['gstr1-transformed', backendResponse],
    queryFn: (): GSTR1Data | null => {
      if (!backendResponse) return null;
      return transformBackendToFrontend(backendResponse);
    },
    enabled: !!backendResponse,
  });
}

/**
 * Calculate HSN summary from B2B invoices
 * HSN data would ideally come from the backend
 */
export function calculateHSNFromInvoices(b2b: B2BCustomer[]): HSNSummary[] {
  const hsnMap = new Map<string, HSNSummary>();
  
  b2b.forEach((customer) => {
    customer.invoices.forEach((invoice) => {
      // This is a simplified HSN calculation
      // In production, HSN should come from invoice line items
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
          cess: 0,
        });
      }
    });
  });
  
  return Array.from(hsnMap.values()).sort((a, b) =>
    a.hsnCode.localeCompare(b.hsnCode)
  );
}
