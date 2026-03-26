/**
 * GSTR-3B Export Buttons - Backend Integration
 * 
 * This component handles exporting GSTR-3B data using the backend API.
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { 
  apiExportGSTR3BExcel, 
  downloadExcelFromResponse,
} from '@/lib/api';
import type { GSTR3BData } from '@/hooks/useGSTR3BData';

interface ExportButtonsProps {
  data: GSTR3BData | undefined;
  gstin?: string;
  period?: string;
  disabled?: boolean;
}

export function ExportButtons({ data, gstin = '', period = '', disabled = false }: ExportButtonsProps) {
  // Export to Excel using backend
  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      // PRIMARY: Use data prop as source of truth (from backend state)
      let dataToExport: Record<string, unknown> | null = null;
      
      if (data) {
        // Transform from data prop (canonical source)
        dataToExport = transformGSTR3BToCleanData(data) as unknown as Record<string, unknown>;
      }
      
      // FALLBACK: Only use localStorage cache if data prop is not available
      if (!dataToExport) {
        const stored = localStorage.getItem('gstr3b_data');
        if (stored) {
          try {
            dataToExport = JSON.parse(stored);
          } catch (e) {
            console.error('Failed to parse stored gstr3b_data:', e);
          }
        }
      }
      
      if (!dataToExport) throw new Error('No data available');
      
      return apiExportGSTR3BExcel(
        dataToExport,
        period || '',
        gstin || '',
        ''
      );
    },
    onSuccess: (blob) => {
      downloadExcelFromResponse(blob, 'gstr3b.xlsx');
      toast.success('GSTR-3B exported to Excel successfully');
    },
    onError: (error) => {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel. Please try again.');
    },
  });

  const handleExportExcel = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }
    exportExcelMutation.mutate();
  };

  const hasData = data && data.summary.totalInvoices > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !hasData}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel} disabled={exportExcelMutation.isPending}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Transform GSTR-3B data to clean_data format for backend export
 */
function transformGSTR3BToCleanData(data: GSTR3BData): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  
  // Add summary record
  records.push({
    category: 'summary',
    total_invoices: data.summary.totalInvoices,
    validated_invoices: data.summary.validatedInvoices,
    total_taxable_value: data.summary.totalTaxableValue,
    total_tax: data.summary.totalTax,
  });
  
  // Add outward supplies records
  records.push({
    category: 'outward_supplies',
    type: 'taxable',
    taxable_value: data.outwardSupplies.taxableSupplies.taxableValue,
    igst: data.outwardSupplies.taxableSupplies.igst,
    cgst: data.outwardSupplies.taxableSupplies.cgst,
    sgst: data.outwardSupplies.taxableSupplies.sgst,
    cess: data.outwardSupplies.taxableSupplies.cess,
  });
  
  records.push({
    category: 'outward_supplies',
    type: 'zero_rated',
    taxable_value: data.outwardSupplies.zeroRatedSupplies.taxableValue,
    igst: data.outwardSupplies.zeroRatedSupplies.igst,
    cgst: data.outwardSupplies.zeroRatedSupplies.cgst,
    sgst: data.outwardSupplies.zeroRatedSupplies.sgst,
    cess: data.outwardSupplies.zeroRatedSupplies.cess,
  });
  
  // Add ITC records
  records.push({
    category: 'itc',
    type: 'available',
    igst: data.eligibleItc.itcAvailable.igst,
    cgst: data.eligibleItc.itcAvailable.cgst,
    sgst: data.eligibleItc.itcAvailable.sgst,
    cess: data.eligibleItc.itcAvailable.cess,
  });
  
  records.push({
    category: 'itc',
    type: 'reversed',
    igst: data.eligibleItc.itcReversed.igst,
    cgst: data.eligibleItc.itcReversed.cgst,
    sgst: data.eligibleItc.itcReversed.sgst,
    cess: data.eligibleItc.itcReversed.cess,
  });
  
  // Add tax payable record
  records.push({
    category: 'tax_payable',
    type: 'total',
    igst: data.taxPayable.total.igst,
    cgst: data.taxPayable.total.cgst,
    sgst: data.taxPayable.total.sgst,
    cess: data.taxPayable.total.cess,
  });
  
  return records;
}
