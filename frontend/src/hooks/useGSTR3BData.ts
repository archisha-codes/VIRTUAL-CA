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
  getGstr3bState,
  saveGstr3bState,
  listGstr3bFilings,
  type GSTR3BWorkflowState,
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
 * Uses backend as single source of truth for GSTR-3B workflow state
 */
export function useGSTR3BData(workspaceId?: string, gstin?: string, returnPeriod?: string) {
  return useQuery({
    queryKey: ['gstr3b-data', workspaceId, gstin, returnPeriod],
    queryFn: async (): Promise<GSTR3BData | null> => {
      if (!workspaceId || !gstin || !returnPeriod) {
        return null;
      }
      
      try {
        const response = await getGstr3bState(workspaceId, gstin, returnPeriod);
        
        if (response.success && response.data?.gstr3b_data) {
          // Transform backend data to frontend format
          const backendData = response.data.gstr3b_data as unknown as {
            outwardSupplies?: {
              taxableSupplies?: { taxableValue?: number; igst?: number; cgst?: number; sgst?: number; cess?: number };
              zeroRatedSupplies?: { taxableValue?: number; igst?: number; cgst?: number; sgst?: number; cess?: number };
              reverseChargeSupplies?: { taxableValue?: number; igst?: number; cgst?: number; sgst?: number; cess?: number };
              total?: { igst?: number; cgst?: number; sgst?: number };
            };
            itcAvailable?: { igst?: number; cgst?: number; sgst?: number; cess?: number };
          };
          
          return {
            outwardSupplies: {
              taxableSupplies: {
                taxableValue: backendData.outwardSupplies?.taxableSupplies?.taxableValue || 0,
                igst: backendData.outwardSupplies?.taxableSupplies?.igst || 0,
                cgst: backendData.outwardSupplies?.taxableSupplies?.cgst || 0,
                sgst: backendData.outwardSupplies?.taxableSupplies?.sgst || 0,
                cess: backendData.outwardSupplies?.taxableSupplies?.cess || 0,
              },
              zeroRatedSupplies: {
                taxableValue: backendData.outwardSupplies?.zeroRatedSupplies?.taxableValue || 0,
                igst: backendData.outwardSupplies?.zeroRatedSupplies?.igst || 0,
                cgst: backendData.outwardSupplies?.zeroRatedSupplies?.cgst || 0,
                sgst: backendData.outwardSupplies?.zeroRatedSupplies?.sgst || 0,
                cess: backendData.outwardSupplies?.zeroRatedSupplies?.cess || 0,
              },
              nilRatedSupplies: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
              reverseChargeSupplies: {
                taxableValue: backendData.outwardSupplies?.reverseChargeSupplies?.taxableValue || 0,
                igst: backendData.outwardSupplies?.reverseChargeSupplies?.igst || 0,
                cgst: backendData.outwardSupplies?.reverseChargeSupplies?.cgst || 0,
                sgst: backendData.outwardSupplies?.reverseChargeSupplies?.sgst || 0,
                cess: backendData.outwardSupplies?.reverseChargeSupplies?.cess || 0,
              },
              nonGstSupplies: { taxableValue: 0 },
            },
            interStateSupplies: {
              unreg: [],
              compDealer: [],
              uin: [],
            },
            eligibleItc: {
              itcAvailable: {
                igst: backendData.itcAvailable?.igst || 0,
                cgst: backendData.itcAvailable?.cgst || 0,
                sgst: backendData.itcAvailable?.sgst || 0,
                cess: backendData.itcAvailable?.cess || 0,
              },
              itcReversed: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
              netItc: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
              ineligibleItc: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
            },
            taxPayable: {
              onOutwardSupplies: { description: 'Tax on outward supplies', igst: 0, cgst: 0, sgst: 0, cess: 0 },
              onReverseCharge: { description: 'Tax on reverse charge', igst: 0, cgst: 0, sgst: 0, cess: 0 },
              total: { description: 'Net tax payable', igst: 0, cgst: 0, sgst: 0, cess: 0 },
            },
            summary: {
              totalInvoices: 0,
              validatedInvoices: 0,
              totalTaxableValue: 0,
              totalTax: 0,
            },
          };
        }
        
        return null;
      } catch (error) {
        console.error('Failed to fetch GSTR-3B data from backend:', error);
        return null;
      }
    },
    enabled: !!(workspaceId && gstin && returnPeriod),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to save GSTR-3B state to backend
 */
export function useSaveGSTR3BState() {
  return useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      gstin: string;
      returnPeriod: string;
      state: {
        currentStep: string;
        stepData: Record<string, unknown>;
        gstr3bData: Record<string, unknown> | null;
        gstr1Data: Record<string, unknown> | null;
        itcData: Record<string, unknown> | null;
        taxComputation: Record<string, unknown> | null;
        filingResult: Record<string, unknown> | null;
        status: 'draft' | 'computed' | 'filed' | 'pending';
      };
    }) => {
      return saveGstr3bState(
        params.workspaceId,
        params.gstin,
        params.returnPeriod,
        params.state
      );
    },
  });
}

/**
 * Hook to list historical GSTR-3B filings
 */
export function useListGSTR3BFilings(workspaceId?: string, gstin?: string) {
  return useQuery({
    queryKey: ['gstr3b-filings', workspaceId, gstin],
    queryFn: async () => {
      if (!workspaceId) {
        return { success: false, data: [], total: 0 };
      }
      
      return listGstr3bFilings(workspaceId, gstin);
    },
    enabled: !!workspaceId,
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
    cess?: number;
    invoiceType: string;
  }> }>;
  b2cl: Array<{
    taxableValue: number;
    igst: number;
    cess?: number;
  }>;
  b2cs: Array<{
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess?: number;
  }>;
  export: Array<{
    taxableValue: number;
    igst: number;
  }>;
  cdnr?: Array<{
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess?: number;
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
  gstr1Data.b2b?.forEach((customer) => {
    customer.invoices?.forEach((invoice) => {
      const taxableValue = invoice.taxableValue ?? 0;
      const igst = invoice.igst ?? 0;
      const cgst = invoice.cgst ?? 0;
      const sgst = invoice.sgst ?? 0;
      const cess = invoice.cess ?? 0;
      
      if (invoice.invoiceType === 'EXPORT') {
        // Zero rated exports
        outwardSupplies.zeroRatedSupplies.taxableValue += taxableValue;
        outwardSupplies.zeroRatedSupplies.igst += igst;
        outwardSupplies.zeroRatedSupplies.cgst += cgst;
        outwardSupplies.zeroRatedSupplies.sgst += sgst;
        outwardSupplies.zeroRatedSupplies.cess += cess;
      } else {
        // Regular taxable supplies
        outwardSupplies.taxableSupplies.taxableValue += taxableValue;
        outwardSupplies.taxableSupplies.igst += igst;
        outwardSupplies.taxableSupplies.cgst += cgst;
        outwardSupplies.taxableSupplies.sgst += sgst;
        outwardSupplies.taxableSupplies.cess += cess;
      }
    });
  });

  // Process B2CL invoices (inter-state to unregistered)
  gstr1Data.b2cl?.forEach((invoice) => {
    outwardSupplies.taxableSupplies.taxableValue += invoice.taxableValue ?? 0;
    outwardSupplies.taxableSupplies.igst += invoice.igst ?? 0;
    outwardSupplies.taxableSupplies.cess += invoice.cess ?? 0;
  });

  // Process B2CS entries
  gstr1Data.b2cs?.forEach((entry) => {
    outwardSupplies.taxableSupplies.taxableValue += entry.taxableValue ?? 0;
    outwardSupplies.taxableSupplies.igst += entry.igst ?? 0;
    outwardSupplies.taxableSupplies.cgst += entry.cgst ?? 0;
    outwardSupplies.taxableSupplies.sgst += entry.sgst ?? 0;
    outwardSupplies.taxableSupplies.cess += entry.cess ?? 0;
  });

  // Process Export invoices
  gstr1Data.export?.forEach((invoice) => {
    outwardSupplies.zeroRatedSupplies.taxableValue += invoice.taxableValue ?? 0;
    outwardSupplies.zeroRatedSupplies.igst += invoice.igst ?? 0;
  });

  // Process CDN/R notes (credit/debit notes)
  gstr1Data.cdnr?.forEach((note) => {
    outwardSupplies.taxableSupplies.taxableValue += note.taxableValue ?? 0;
    outwardSupplies.taxableSupplies.igst += note.igst ?? 0;
    outwardSupplies.taxableSupplies.cgst += note.cgst ?? 0;
    outwardSupplies.taxableSupplies.sgst += note.sgst ?? 0;
    outwardSupplies.taxableSupplies.cess += note.cess ?? 0;
  });

  // Calculate tax payable with proper rounding
  const onOutward: TaxPayable = {
    description: 'Tax on outward supplies',
    igst: roundToTwo(outwardSupplies.taxableSupplies.igst + outwardSupplies.zeroRatedSupplies.igst),
    cgst: roundToTwo(outwardSupplies.taxableSupplies.cgst + outwardSupplies.zeroRatedSupplies.cgst),
    sgst: roundToTwo(outwardSupplies.taxableSupplies.sgst + outwardSupplies.zeroRatedSupplies.sgst),
    cess: roundToTwo(outwardSupplies.taxableSupplies.cess + outwardSupplies.zeroRatedSupplies.cess),
  };

  const onReverseCharge: TaxPayable = {
    description: 'Tax on reverse charge',
    igst: roundToTwo(outwardSupplies.reverseChargeSupplies.igst),
    cgst: roundToTwo(outwardSupplies.reverseChargeSupplies.cgst),
    sgst: roundToTwo(outwardSupplies.reverseChargeSupplies.sgst),
    cess: roundToTwo(outwardSupplies.reverseChargeSupplies.cess),
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
    igst: Math.max(0, roundToTwo(onOutward.igst + onReverseCharge.igst - eligibleItc.netItc.igst)),
    cgst: Math.max(0, roundToTwo(onOutward.cgst + onReverseCharge.cgst - eligibleItc.netItc.cgst)),
    sgst: Math.max(0, roundToTwo(onOutward.sgst + onReverseCharge.sgst - eligibleItc.netItc.sgst)),
    cess: Math.max(0, roundToTwo(onOutward.cess + onReverseCharge.cess - eligibleItc.netItc.cess)),
  };

  // Calculate totals with proper null coalescing
  const totalInvoices = 
    (gstr1Data.b2b?.reduce((sum, c) => sum + (c.invoices?.length ?? 0), 0) ?? 0) +
    (gstr1Data.b2cl?.length ?? 0) +
    (gstr1Data.b2cs?.length ?? 0) +
    (gstr1Data.export?.length ?? 0) +
    (gstr1Data.cdnr?.length ?? 0);

  const totalTaxableValue = 
    (gstr1Data.b2b?.reduce((sum, c) => sum + (c.invoices?.reduce((s, i) => s + (i.taxableValue ?? 0), 0) ?? 0), 0) ?? 0) +
    (gstr1Data.b2cl?.reduce((sum, i) => sum + (i.taxableValue ?? 0), 0) ?? 0) +
    (gstr1Data.b2cs?.reduce((sum, i) => sum + (i.taxableValue ?? 0), 0) ?? 0) +
    (gstr1Data.export?.reduce((sum, i) => sum + (i.taxableValue ?? 0), 0) ?? 0) +
    (gstr1Data.cdnr?.reduce((sum, i) => sum + (i.taxableValue ?? 0), 0) ?? 0);

  const totalTax = 
    (gstr1Data.b2b?.reduce((sum, c) => sum + (c.invoices?.reduce((s, i) => s + (i.igst ?? 0) + (i.cgst ?? 0) + (i.sgst ?? 0), 0) ?? 0), 0) ?? 0) +
    (gstr1Data.b2cl?.reduce((sum, i) => sum + (i.igst ?? 0), 0) ?? 0) +
    (gstr1Data.b2cs?.reduce((sum, i) => sum + (i.igst ?? 0) + (i.cgst ?? 0) + (i.sgst ?? 0), 0) ?? 0) +
    (gstr1Data.export?.reduce((sum, i) => sum + (i.igst ?? 0), 0) ?? 0) +
    (gstr1Data.cdnr?.reduce((sum, i) => sum + (i.igst ?? 0) + (i.cgst ?? 0) + (i.sgst ?? 0), 0) ?? 0);

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
      totalTaxableValue: roundToTwo(totalTaxableValue),
      totalTax: roundToTwo(totalTax),
    },
  };
}

// Helper function to round to 2 decimal places
function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
