import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

// B2B Invoice structure for GSTR-1
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

// B2B grouped by customer GSTIN
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
  cdnr: CDNRCustomer[];
  hsn: HSNSummary[];
  summary: {
    totalB2BInvoices: number;
    totalB2CLInvoices: number;
    totalB2CSRecords: number;
    totalCDNRNotes: number;
    totalHSNCodes: number;
    totalTaxableValue: number;
    totalTax: number;
  };
}

export interface GSTR1FilterOptions {
  startDate?: Date;
  endDate?: Date;
}

function processB2BInvoices(invoices: Invoice[]): B2BCustomer[] {
  // Filter B2B invoices: sales, validated, with customer GSTIN
  const b2bInvoices = invoices.filter(
    (inv) =>
      inv.invoice_category === 'sales' &&
      inv.validation_status === 'passed' &&
      inv.customer_gstin &&
      inv.customer_gstin.length === 15
  );

  // Group by customer GSTIN
  const customerMap = new Map<string, B2BCustomer>();

  b2bInvoices.forEach((inv) => {
    const gstin = inv.customer_gstin!;
    const existing = customerMap.get(gstin);

    const invoiceData: B2BInvoice = {
      customerGstin: gstin,
      customerName: inv.customer_name || 'Unknown',
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      invoiceValue: inv.total_amount || 0,
      placeOfSupply: inv.place_of_supply || '',
      reverseCharge: 'N',
      invoiceType: inv.invoice_type || 'R',
      taxableValue: inv.taxable_value || 0,
      igst: inv.igst_amount || 0,
      cgst: inv.cgst_amount || 0,
      sgst: inv.sgst_amount || 0,
      cess: 0,
      rate: inv.igst_rate || inv.cgst_rate! * 2 || 0,
    };

    if (existing) {
      existing.invoices.push(invoiceData);
      existing.totalTaxableValue += invoiceData.taxableValue;
      existing.totalTax += invoiceData.igst + invoiceData.cgst + invoiceData.sgst;
    } else {
      customerMap.set(gstin, {
        customerGstin: gstin,
        customerName: inv.customer_name || 'Unknown',
        invoices: [invoiceData],
        totalTaxableValue: invoiceData.taxableValue,
        totalTax: invoiceData.igst + invoiceData.cgst + invoiceData.sgst,
      });
    }
  });

  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

function processB2CLInvoices(invoices: Invoice[]): B2CLInvoice[] {
  // B2CL: Sales to unregistered persons, inter-state, > 2.5 lakh
  const b2clInvoices = invoices.filter(
    (inv) =>
      inv.invoice_category === 'sales' &&
      inv.validation_status === 'passed' &&
      !inv.customer_gstin &&
      (inv.total_amount || 0) > 250000 &&
      (inv.igst_amount || 0) > 0 // Inter-state (IGST)
  );

  return b2clInvoices.map((inv) => ({
    placeOfSupply: inv.place_of_supply || '',
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    invoiceValue: inv.total_amount || 0,
    taxableValue: inv.taxable_value || 0,
    igst: inv.igst_amount || 0,
    cess: 0,
    rate: inv.igst_rate || 0,
  }));
}

function processB2CS(invoices: Invoice[]): B2CSSummary[] {
  // B2CS: Sales to unregistered persons, <= 2.5 lakh OR intra-state
  const b2csInvoices = invoices.filter(
    (inv) =>
      inv.invoice_category === 'sales' &&
      inv.validation_status === 'passed' &&
      !inv.customer_gstin &&
      ((inv.total_amount || 0) <= 250000 || (inv.cgst_amount || 0) > 0)
  );

  // Group by place of supply and rate
  const summaryMap = new Map<string, B2CSSummary>();

  b2csInvoices.forEach((inv) => {
    const pos = inv.place_of_supply || 'Unknown';
    const isInterState = (inv.igst_amount || 0) > 0;
    const rate = inv.igst_rate || inv.cgst_rate! * 2 || 0;
    const key = `${pos}-${isInterState ? 'INTER' : 'INTRA'}-${rate}`;

    const existing = summaryMap.get(key);

    if (existing) {
      existing.taxableValue += inv.taxable_value || 0;
      existing.igst += inv.igst_amount || 0;
      existing.cgst += inv.cgst_amount || 0;
      existing.sgst += inv.sgst_amount || 0;
    } else {
      summaryMap.set(key, {
        placeOfSupply: pos,
        supplyType: isInterState ? 'INTER' : 'INTRA',
        taxableValue: inv.taxable_value || 0,
        igst: inv.igst_amount || 0,
        cgst: inv.cgst_amount || 0,
        sgst: inv.sgst_amount || 0,
        cess: 0,
        rate,
      });
    }
  });

  return Array.from(summaryMap.values());
}

function processHSN(invoices: Invoice[]): HSNSummary[] {
  // Group by HSN code
  const hsnMap = new Map<string, HSNSummary>();

  const validInvoices = invoices.filter(
    (inv) =>
      inv.invoice_category === 'sales' &&
      inv.validation_status === 'passed' &&
      inv.hsn_code
  );

  validInvoices.forEach((inv) => {
    const hsn = inv.hsn_code!;
    const existing = hsnMap.get(hsn);

    if (existing) {
      existing.totalQuantity += 1;
      existing.totalValue += inv.total_amount || 0;
      existing.taxableValue += inv.taxable_value || 0;
      existing.igst += inv.igst_amount || 0;
      existing.cgst += inv.cgst_amount || 0;
      existing.sgst += inv.sgst_amount || 0;
    } else {
      hsnMap.set(hsn, {
        hsnCode: hsn,
        description: '',
        uqc: 'NOS',
        totalQuantity: 1,
        totalValue: inv.total_amount || 0,
        taxableValue: inv.taxable_value || 0,
        igst: inv.igst_amount || 0,
        cgst: inv.cgst_amount || 0,
        sgst: inv.sgst_amount || 0,
        cess: 0,
      });
    }
  });

  return Array.from(hsnMap.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
}

function processCDNR(invoices: Invoice[]): CDNRCustomer[] {
  // CDN/R: Credit/Debit notes to registered persons
  const cdnrInvoices = invoices.filter(
    (inv) =>
      inv.invoice_category === 'sales' &&
      inv.validation_status === 'passed' &&
      inv.customer_gstin &&
      inv.customer_gstin.length === 15 &&
      inv.invoice_type &&
      (inv.invoice_type === 'CDN' || inv.invoice_type === 'CDR')
  );

  const customerMap = new Map<string, CDNRCustomer>();

  cdnrInvoices.forEach((inv) => {
    const gstin = inv.customer_gstin!;
    const noteType: 'C' | 'D' = inv.invoice_type === 'CDN' ? 'C' : 'D';

    const noteData: CDNRNote = {
      customerGstin: gstin,
      customerName: inv.customer_name || 'Unknown',
      noteNumber: inv.invoice_number,
      noteDate: inv.invoice_date,
      noteType,
      noteValue: inv.total_amount || 0,
      placeOfSupply: inv.place_of_supply || '',
      taxableValue: inv.taxable_value || 0,
      igst: inv.igst_amount || 0,
      cgst: inv.cgst_amount || 0,
      sgst: inv.sgst_amount || 0,
      cess: 0,
      rate: inv.igst_rate || inv.cgst_rate! * 2 || 0,
    };

    const existing = customerMap.get(gstin);
    if (existing) {
      existing.notes.push(noteData);
      existing.totalTaxableValue += noteData.taxableValue;
      existing.totalTax += noteData.igst + noteData.cgst + noteData.sgst;
    } else {
      customerMap.set(gstin, {
        customerGstin: gstin,
        customerName: inv.customer_name || 'Unknown',
        notes: [noteData],
        totalTaxableValue: noteData.taxableValue,
        totalTax: noteData.igst + noteData.cgst + noteData.sgst,
      });
    }
  });

  return Array.from(customerMap.values()).sort((a, b) =>
    a.customerGstin.localeCompare(b.customerGstin)
  );
}

export function useGSTR1Data(options?: GSTR1FilterOptions) {
  const { user } = useAuth();
  const { startDate, endDate } = options || {};

  return useQuery({
    queryKey: ['gstr1-data', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<GSTR1Data> => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('invoice_category', 'sales');

      if (startDate) {
        query = query.gte('invoice_date', startDate.toISOString().split('T')[0]);
      }

      if (endDate) {
        query = query.lte('invoice_date', endDate.toISOString().split('T')[0]);
      }

      const { data: invoices, error } = await query;

      if (error) throw error;

      const allInvoices = invoices || [];

      const b2b = processB2BInvoices(allInvoices);
      const b2cl = processB2CLInvoices(allInvoices);
      const b2cs = processB2CS(allInvoices);
      const cdnr = processCDNR(allInvoices);
      const hsn = processHSN(allInvoices);

      const totalB2BInvoices = b2b.reduce((sum, cust) => sum + cust.invoices.length, 0);
      const totalCDNRNotes = cdnr.reduce((sum, cust) => sum + cust.notes.length, 0);
      const totalTaxableValue =
        b2b.reduce((sum, cust) => sum + cust.totalTaxableValue, 0) +
        b2cl.reduce((sum, inv) => sum + inv.taxableValue, 0) +
        b2cs.reduce((sum, s) => sum + s.taxableValue, 0);

      const totalTax =
        b2b.reduce((sum, cust) => sum + cust.totalTax, 0) +
        b2cl.reduce((sum, inv) => sum + inv.igst, 0) +
        b2cs.reduce((sum, s) => sum + s.igst + s.cgst + s.sgst, 0);

      return {
        b2b,
        b2cl,
        b2cs,
        cdnr,
        hsn,
        summary: {
          totalB2BInvoices,
          totalB2CLInvoices: b2cl.length,
          totalB2CSRecords: b2cs.length,
          totalCDNRNotes,
          totalHSNCodes: hsn.length,
          totalTaxableValue,
          totalTax,
        },
      };
    },
    enabled: !!user,
  });
}
