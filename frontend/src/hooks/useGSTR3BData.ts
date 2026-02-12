import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

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

function createEmptyTaxRow(): { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number } {
  return { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
}

function processOutwardSupplies(invoices: Invoice[]): OutwardSupplies {
  // Filter only sales invoices with passed validation
  const validInvoices = invoices.filter(
    inv => inv.validation_status === 'passed' && (inv as any).invoice_category !== 'purchase'
  );
  
  const taxableSupplies = createEmptyTaxRow();
  const zeroRatedSupplies = createEmptyTaxRow();
  const nilRatedSupplies = createEmptyTaxRow();
  const reverseChargeSupplies = createEmptyTaxRow();
  
  validInvoices.forEach(inv => {
    const isExport = inv.invoice_type === 'EXPORT';
    const taxableValue = inv.taxable_value || 0;
    const igst = inv.igst_amount || 0;
    const cgst = inv.cgst_amount || 0;
    const sgst = inv.sgst_amount || 0;
    
    if (isExport) {
      // Zero rated exports
      zeroRatedSupplies.taxableValue += taxableValue;
      zeroRatedSupplies.igst += igst;
    } else if (taxableValue > 0 && (igst > 0 || cgst > 0 || sgst > 0)) {
      // Regular taxable supplies
      taxableSupplies.taxableValue += taxableValue;
      taxableSupplies.igst += igst;
      taxableSupplies.cgst += cgst;
      taxableSupplies.sgst += sgst;
    }
  });

  return {
    taxableSupplies,
    zeroRatedSupplies,
    nilRatedSupplies,
    reverseChargeSupplies,
    nonGstSupplies: { taxableValue: 0 },
  };
}

function processInterStateSupplies(invoices: Invoice[]): InterStateSupplies {
  // Filter only sales invoices
  const b2clInvoices = invoices.filter(
    inv => inv.invoice_type === 'B2CL' && 
           inv.validation_status === 'passed' &&
           (inv as any).invoice_category !== 'purchase'
  );

  // Group by place of supply
  const unregGrouped = new Map<string, { taxableValue: number; igst: number }>();
  
  b2clInvoices.forEach(inv => {
    const pos = inv.place_of_supply || 'Unknown';
    const existing = unregGrouped.get(pos) || { taxableValue: 0, igst: 0 };
    existing.taxableValue += inv.taxable_value || 0;
    existing.igst += inv.igst_amount || 0;
    unregGrouped.set(pos, existing);
  });

  return {
    unreg: Array.from(unregGrouped.entries()).map(([placeOfSupply, data]) => ({
      placeOfSupply,
      ...data,
    })),
    compDealer: [],
    uin: [],
  };
}

function processEligibleITC(invoices: Invoice[]): EligibleITC {
  // Filter purchase invoices with passed validation
  const purchaseInvoices = invoices.filter(
    inv => (inv as any).invoice_category === 'purchase' && inv.validation_status === 'passed'
  );

  // Calculate ITC from purchase invoices
  const itcAvailable = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
  
  purchaseInvoices.forEach(inv => {
    itcAvailable.igst += inv.igst_amount || 0;
    itcAvailable.cgst += inv.cgst_amount || 0;
    itcAvailable.sgst += inv.sgst_amount || 0;
  });

  // For now, assume no ITC reversal or ineligible ITC
  // These would typically come from specific business rules
  const itcReversed = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
  const ineligibleItc = { igst: 0, cgst: 0, sgst: 0, cess: 0 };

  // Net ITC = Available - Reversed
  const netItc = {
    igst: itcAvailable.igst - itcReversed.igst,
    cgst: itcAvailable.cgst - itcReversed.cgst,
    sgst: itcAvailable.sgst - itcReversed.sgst,
    cess: itcAvailable.cess - itcReversed.cess,
  };

  return {
    itcAvailable,
    itcReversed,
    netItc,
    ineligibleItc,
  };
}

function calculateTaxPayable(outward: OutwardSupplies, itc: EligibleITC): GSTR3BData['taxPayable'] {
  const onOutward = {
    description: 'Tax on outward supplies',
    igst: outward.taxableSupplies.igst + outward.zeroRatedSupplies.igst,
    cgst: outward.taxableSupplies.cgst,
    sgst: outward.taxableSupplies.sgst,
    cess: outward.taxableSupplies.cess,
  };

  const onReverseCharge = {
    description: 'Tax on reverse charge',
    igst: outward.reverseChargeSupplies.igst,
    cgst: outward.reverseChargeSupplies.cgst,
    sgst: outward.reverseChargeSupplies.sgst,
    cess: outward.reverseChargeSupplies.cess,
  };

  // Net tax payable = Output tax - ITC
  const total = {
    description: 'Net tax payable',
    igst: Math.max(0, onOutward.igst + onReverseCharge.igst - itc.netItc.igst),
    cgst: Math.max(0, onOutward.cgst + onReverseCharge.cgst - itc.netItc.cgst),
    sgst: Math.max(0, onOutward.sgst + onReverseCharge.sgst - itc.netItc.sgst),
    cess: Math.max(0, onOutward.cess + onReverseCharge.cess - itc.netItc.cess),
  };

  return { onOutwardSupplies: onOutward, onReverseCharge, total };
}

export interface GSTR3BFilterOptions {
  uploadSessionId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useGSTR3BData(options?: GSTR3BFilterOptions) {
  const { user } = useAuth();
  const { uploadSessionId, startDate, endDate } = options || {};

  return useQuery({
    queryKey: ['gstr3b-data', user?.id, uploadSessionId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<GSTR3BData> => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id);

      if (uploadSessionId) {
        query = query.eq('upload_session_id', uploadSessionId);
      }

      if (startDate) {
        query = query.gte('invoice_date', startDate.toISOString().split('T')[0]);
      }

      if (endDate) {
        query = query.lte('invoice_date', endDate.toISOString().split('T')[0]);
      }

      const { data: invoices, error } = await query;

      if (error) throw error;

      const allInvoices = invoices || [];
      const validatedInvoices = allInvoices.filter(inv => inv.validation_status === 'passed');

      const outwardSupplies = processOutwardSupplies(allInvoices);
      const interStateSupplies = processInterStateSupplies(allInvoices);
      const eligibleItc = processEligibleITC(allInvoices);
      const taxPayable = calculateTaxPayable(outwardSupplies, eligibleItc);

      const totalTaxableValue = validatedInvoices.reduce((sum, inv) => sum + (inv.taxable_value || 0), 0);
      const totalTax = validatedInvoices.reduce(
        (sum, inv) => sum + (inv.igst_amount || 0) + (inv.cgst_amount || 0) + (inv.sgst_amount || 0),
        0
      );

      return {
        outwardSupplies,
        interStateSupplies,
        eligibleItc,
        taxPayable,
        summary: {
          totalInvoices: allInvoices.length,
          validatedInvoices: validatedInvoices.length,
          totalTaxableValue,
          totalTax,
        },
      };
    },
    enabled: !!user,
  });
}
