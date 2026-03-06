/**
 * Export Buttons - Backend Integration
 * 
 * This component handles exporting GSTR-1 data using the backend API.
 * It sends data to the backend which generates the Excel file.
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
  apiExportGSTR1Excel, 
  exportErrorsCSV,
  downloadBlob,
  downloadExcelFromResponse,
} from '@/lib/api';
import type { B2BCustomer, B2CLInvoice, B2CSSummary, ExportInvoice, CDNRCustomer, HSNSummary } from '@/lib/gstr-transform';

interface GSTR1Data {
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
}

interface ExportButtonsProps {
  data: GSTR1Data | undefined;
  gstin?: string;
  period?: string;
  disabled?: boolean;
  errors?: Array<{ row?: number; error?: string }>;
}

/**
 * Transform frontend data to backend clean_data format
 * This converts the nested structure to a flat array of records
 */
function transformToBackendFormat(data: GSTR1Data): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  
  // Process B2B invoices
  data.b2b.forEach((customer) => {
    customer.invoices.forEach((invoice) => {
      records.push({
        category: 'b2b',
        customer_gstin: invoice.customerGstin,
        customer_name: invoice.customerName,
        invoice_number: invoice.invoiceNumber,
        invoice_date: invoice.invoiceDate,
        invoice_value: invoice.invoiceValue,
        place_of_supply: invoice.placeOfSupply,
        reverse_charge: invoice.reverseCharge,
        invoice_type: invoice.invoiceType,
        taxable_value: invoice.taxableValue,
        igst_amount: invoice.igst,
        cgst_amount: invoice.cgst,
        sgst_amount: invoice.sgst,
        cess_amount: invoice.cess,
        tax_rate: invoice.rate,
      });
    });
  });
  
  // Process B2CL invoices
  data.b2cl.forEach((invoice) => {
    records.push({
      category: 'b2cl',
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      invoice_value: invoice.invoiceValue,
      place_of_supply: invoice.placeOfSupply,
      taxable_value: invoice.taxableValue,
      igst_amount: invoice.igst,
      cess_amount: invoice.cess,
      tax_rate: invoice.rate,
    });
  });
  
  // Process B2CS entries
  data.b2cs.forEach((entry) => {
    records.push({
      category: 'b2cs',
      place_of_supply: entry.placeOfSupply,
      supply_type: entry.supplyType,
      taxable_value: entry.taxableValue,
      igst_amount: entry.igst,
      cgst_amount: entry.cgst,
      sgst_amount: entry.sgst,
      cess_amount: entry.cess,
      tax_rate: entry.rate,
    });
  });
  
  // Process Export invoices
  data.export.forEach((invoice) => {
    records.push({
      category: 'export',
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      invoice_value: invoice.invoiceValue,
      place_of_supply: invoice.placeOfSupply,
      taxable_value: invoice.taxableValue,
      igst_amount: invoice.igst,
      tax_rate: invoice.rate,
      shipping_bill_no: invoice.shippingBill?.billNo,
      shipping_bill_date: invoice.shippingBill?.billDate,
      port_code: invoice.shippingBill?.portCode,
    });
  });
  
  // Process CDN/R notes
  data.cdnr.forEach((customer) => {
    customer.notes.forEach((note) => {
      records.push({
        category: 'cdnr',
        customer_gstin: note.customerGstin,
        customer_name: note.customerName,
        note_number: note.noteNumber,
        note_date: note.noteDate,
        note_type: note.noteType,
        note_value: note.noteValue,
        place_of_supply: note.placeOfSupply,
        taxable_value: note.taxableValue,
        igst_amount: note.igst,
        cgst_amount: note.cgst,
        sgst_amount: note.sgst,
        cess_amount: note.cess,
        tax_rate: note.rate,
      });
    });
  });
  
  return records;
}

export function ExportButtons({ data, gstin = '', period = '', disabled = false, errors = [] }: ExportButtonsProps) {
  // Export to Excel using backend
  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      // Try to get original gstr1_tables from localStorage
      let gstr1Tables = null;
      const stored = localStorage.getItem('gstr1_tables');
      if (stored) {
        try {
          gstr1Tables = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored gstr1_tables:', e);
        }
      }
      
      // If we have original tables, use them; otherwise transform from data prop
      const tablesToExport = gstr1Tables || (data ? transformToBackendFormat(data) : null);
      
      if (!tablesToExport) throw new Error('No data available');
      
      return apiExportGSTR1Excel(
        tablesToExport as Record<string, unknown>,
        period || '',
        gstin || '',
        '',
        undefined,
        undefined
      );
    },
    onSuccess: (blob) => {
      downloadExcelFromResponse(blob, 'gstr1.xlsx');
      toast.success('GSTR-1 exported to Excel successfully');
    },
    onError: (error) => {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel. Please try again.');
    },
  });

  // Export errors to CSV using backend
  const exportErrorsMutation = useMutation({
    mutationFn: async () => {
      if (errors.length === 0) throw new Error('No errors to export');
      
      return exportErrorsCSV(errors);
    },
    onSuccess: (blob) => {
      downloadBlob(blob, 'validation_errors.csv');
      toast.success('Validation errors exported to CSV');
    },
    onError: (error) => {
      console.error('Export errors error:', error);
      toast.error('Failed to export errors. Please try again.');
    },
  });

  const handleExportExcel = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }
    exportExcelMutation.mutate();
  };

  const handleExportErrors = () => {
    if (errors.length === 0) {
      toast.info('No validation errors to export');
      return;
    }
    exportErrorsMutation.mutate();
  };

  const hasData = data && data.summary && (
    (data.summary.totalB2BInvoices || 0) + 
    (data.summary.totalB2CLInvoices || 0) + 
    (data.summary.totalB2CSRecords || 0) +
    (data.summary.totalExportInvoices || 0) +
    (data.summary.totalCDNRNotes || 0) > 0
  );

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
        {errors.length > 0 && (
          <DropdownMenuItem onClick={handleExportErrors} disabled={exportErrorsMutation.isPending}>
            <FileJson className="h-4 w-4 mr-2" />
            Export Errors ({errors.length})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
