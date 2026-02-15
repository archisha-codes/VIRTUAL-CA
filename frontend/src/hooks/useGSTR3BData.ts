/**
 * GSTR-3B Data Hook - Backend Integration
 * 
 * This hook fetches and processes GSTR-3B data from the backend API.
 * Backend performs all calculations - this is purely presentation.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  exportGSTR3BExcel, 
  downloadExcelFromResponse,
  type GSTR3BExportRequest,
} from '@/lib/api';

// ============================================
// Type Definitions (Frontend-friendly)
// ============================================

export interface OutwardSupplies {
  // 3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)
  taxableSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 3.1(b) Outward taxable supplies (zero rated)
  zeroRatedSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 3.1(c) Other outward supplies (nil rated, exempted)
  nilRatedSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 3.1(d) Inward supplies (liable to reverse charge)
  reverseChargeSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 3.1(e) Non-GST outward supplies
  nonGstSupplies: {
    taxableValue: number;
  };
}

export interface InterStateSupplies {
  // 3.2 Supplies to unregistered persons
  unreg: {
    placeOfSupply: string;
    taxableValue: number;
    igst: number;
  }[];
  // Supplies to composition dealers
  compDealer: {
    placeOfSupply: string;
    taxableValue: number;
    igst: number;
  }[];
  // Supplies to UIN holders
  uin: {
    placeOfSupply: string;
    taxableValue: number;
    igst: number;
  }[];
}

export interface EligibleITC {
  // 4(A) ITC Available
  itcAvailable: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 4(B) ITC Reversed
  itcReversed: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 4(C) Net ITC Available
  netItc: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 4(D) Ineligible ITC
  ineligibleItc: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
}

export interface TaxPayable {
  description: string;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface GSTR3BData {
  outwardSupplies: OutwardSupplies;
  interStateSupplies: InterStateSupplies;
  eligibleItc: EligibleITC;
  taxPayable: {
    onOutwardSupplies: TaxPayable;
    onReverseCharge: TaxPayable;
    total: TaxPayable;
  };
  summary: {
    totalInvoices: number;
    validatedInvoices: number;
    totalTaxableValue: number;
    totalTax: number;
  };
}

export interface GSTR3BFilterOptions {
  uploadSessionId?: string;
  startDate?: Date;
  endDate?: Date;
}

// ============================================
// Helper Functions
// ============================================

function createEmptyTaxRow(): { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number } {
  return { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Export GSTR-3B data as Excel using backend
 */
export function useExportGSTR3BExcel() {
  return useMutation({
    mutationFn: async (params: {
      cleanData: Record<string, unknown>[];
      returnPeriod: string;
      taxpayerGstin: string;
      taxpayerName: string;
    }) => {
      const request: GSTR3BExportRequest = {
        clean_data: params.cleanData,
        return_period: params.returnPeriod,
        taxpayer_gstin: params.taxpayerGstin,
        taxpayer_name: params.taxpayerName,
      };
      
      const blob = await exportGSTR3BExcel(request);
      return blob;
    },
    onSuccess: (blob) => {
      downloadExcelFromResponse(blob, 'gstr3b.xlsx');
    },
  });
}

/**
 * Fetch GSTR-3B data from backend
 * Note: This requires the data to be stored in backend session/cache
 */
export function useGSTR3BData() {
  return useQuery({
    queryKey: ['gstr3b-processed'],
    queryFn: async (): Promise<GSTR3BData | null> => {
      // This would typically fetch from a cached session
      // For now, return null - data comes from upload response
      return null;
    },
    enabled: false, // Manual trigger only
  });
}

/**
 * Calculate GSTR-3B summary from processed GSTR-1 data
 * This transforms the GSTR-1 data into GSTR-3B format
 */
export function calculateGSTR3BFromGSTR1(gstr1Data: {
  b2b: Array<{ invoices: Array<{
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    invoiceType: string;
  }> }>;
  b2cl: Array<{
    taxableValue: number;
    igst: number;
  }>;
  b2cs: Array<{
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
  }>;
  export: Array<{
    taxableValue: number;
    igst: number;
  }>;
}): GSTR3BData {
  const outwardSupplies: OutwardSupplies = {
    taxableSupplies: createEmptyTaxRow(),
    zeroRatedSupplies: createEmptyTaxRow(),
    nilRatedSupplies: createEmptyTaxRow(),
    reverseChargeSupplies: createEmptyTaxRow(),
    nonGstSupplies: { taxableValue: 0 },
  };

  const interStateSupplies: InterStateSupplies = {
    unreg: [],
    compDealer: [],
    uin: [],
  };

  // Process B2B invoices
  gstr1Data.b2b.forEach((customer) => {
    customer.invoices.forEach((invoice) => {
      const taxableValue = invoice.taxableValue;
      const igst = invoice.igst;
      const cgst = invoice.cgst;
      const sgst = invoice.sgst;
      
      if (invoice.invoiceType === 'EXPORT') {
        // Zero rated exports
        outwardSupplies.zeroRatedSupplies.taxableValue += taxableValue;
        outwardSupplies.zeroRatedSupplies.igst += igst;
      } else {
        // Regular taxable supplies
        outwardSupplies.taxableSupplies.taxableValue += taxableValue;
        outwardSupplies.taxableSupplies.igst += igst;
        outwardSupplies.taxableSupplies.cgst += cgst;
        outwardSupplies.taxableSupplies.sgst += sgst;
      }
    });
  });

  // Process B2CL invoices (inter-state to unregistered)
  gstr1Data.b2cl.forEach((invoice) => {
    outwardSupplies.taxableSupplies.taxableValue += invoice.taxableValue;
    outwardSupplies.taxableSupplies.igst += invoice.igst;
  });

  // Process B2CS entries
  gstr1Data.b2cs.forEach((entry) => {
    outwardSupplies.taxableSupplies.taxableValue += entry.taxableValue;
    outwardSupplies.taxableSupplies.igst += entry.igst;
    outwardSupplies.taxableSupplies.cgst += entry.cgst;
    outwardSupplies.taxableSupplies.sgst += entry.sgst;
  });

  // Process Export invoices
  gstr1Data.export.forEach((invoice) => {
    outwardSupplies.zeroRatedSupplies.taxableValue += invoice.taxableValue;
    outwardSupplies.zeroRatedSupplies.igst += invoice.igst;
  });

  // Calculate tax payable
  const onOutward: TaxPayable = {
    description: 'Tax on outward supplies',
    igst: outwardSupplies.taxableSupplies.igst + outwardSupplies.zeroRatedSupplies.igst,
    cgst: outwardSupplies.taxableSupplies.cgst,
    sgst: outwardSupplies.taxableSupplies.sgst,
    cess: outwardSupplies.taxableSupplies.cess,
  };

  const onReverseCharge: TaxPayable = {
    description: 'Tax on reverse charge',
    igst: outwardSupplies.reverseChargeSupplies.igst,
    cgst: outwardSupplies.reverseChargeSupplies.cgst,
    sgst: outwardSupplies.reverseChargeSupplies.sgst,
    cess: outwardSupplies.reverseChargeSupplies.cess,
  };

  // ITC calculation (simplified - would need purchase data)
  const eligibleItc: EligibleITC = {
    itcAvailable: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    itcReversed: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    netItc: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    ineligibleItc: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
  };

  const totalTaxPayable = {
    description: 'Net tax payable',
    igst: Math.max(0, onOutward.igst + onReverseCharge.igst - eligibleItc.netItc.igst),
    cgst: Math.max(0, onOutward.cgst + onReverseCharge.cgst - eligibleItc.netItc.cgst),
    sgst: Math.max(0, onOutward.sgst + onReverseCharge.sgst - eligibleItc.netItc.sgst),
    cess: Math.max(0, onOutward.cess + onReverseCharge.cess - eligibleItc.netItc.cess),
  };

  // Calculate totals
  const totalInvoices = 
    gstr1Data.b2b.reduce((sum, c) => sum + c.invoices.length, 0) +
    gstr1Data.b2cl.length +
    gstr1Data.b2cs.length +
    gstr1Data.export.length;

  const totalTaxableValue = 
    gstr1Data.b2b.reduce((sum, c) => sum + c.invoices.reduce((s, i) => s + i.taxableValue, 0), 0) +
    gstr1Data.b2cl.reduce((sum, i) => sum + i.taxableValue, 0) +
    gstr1Data.b2cs.reduce((sum, i) => sum + i.taxableValue, 0) +
    gstr1Data.export.reduce((sum, i) => sum + i.taxableValue, 0);

  const totalTax = 
    gstr1Data.b2b.reduce((sum, c) => sum + c.invoices.reduce((s, i) => s + i.igst + i.cgst + i.sgst, 0), 0) +
    gstr1Data.b2cl.reduce((sum, i) => sum + i.igst, 0) +
    gstr1Data.b2cs.reduce((sum, i) => sum + i.igst + i.cgst + i.sgst, 0) +
    gstr1Data.export.reduce((sum, i) => sum + i.igst, 0);

  return {
    outwardSupplies,
    interStateSupplies,
    eligibleItc,
    taxPayable: {
      onOutwardSupplies: onOutward,
      onReverseCharge,
      total: totalTaxPayable,
    },
    summary: {
      totalInvoices,
      validatedInvoices: totalInvoices,
      totalTaxableValue,
      totalTax,
    },
  };
}
