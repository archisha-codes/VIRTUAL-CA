import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import type { GSTR1Data } from '@/hooks/useGSTR1Data';
import type { GSTR1Data as ExportGSTR1Data } from '@/lib/gstr-export';
import {
  exportGSTR1ToExcel,
  exportGSTR1ToJson,
  downloadExcel,
  downloadJson,
} from '@/lib/gstr-export';

interface ExportButtonsProps {
  data: GSTR1Data | undefined;
  gstin?: string;
  period?: string;
  disabled?: boolean;
}

function transformToExportFormat(data: GSTR1Data): ExportGSTR1Data {
  // Transform the hook's data format to the export format
  const b2b = data.b2b.flatMap((customer) =>
    customer.invoices.map((inv) => ({
      customerGstin: inv.customerGstin,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      invoiceValue: inv.invoiceValue,
      placeOfSupply: inv.placeOfSupply,
      reverseCharge: inv.reverseCharge,
      taxableValue: inv.taxableValue,
      igst: inv.igst,
      cgst: inv.cgst,
      sgst: inv.sgst,
      cess: inv.cess,
    }))
  );

  const b2cl = data.b2cl.map((inv) => ({
    placeOfSupply: inv.placeOfSupply,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    invoiceValue: inv.invoiceValue,
    taxableValue: inv.taxableValue,
    igst: inv.igst,
    cess: inv.cess,
  }));

  const b2cs = data.b2cs.map((s) => ({
    placeOfSupply: s.placeOfSupply,
    taxableValue: s.taxableValue,
    cgst: s.cgst,
    sgst: s.sgst,
    cess: s.cess,
  }));

  const hsn = data.hsn.map((h) => ({
    hsnCode: h.hsnCode,
    description: h.description,
    uqc: h.uqc,
    quantity: h.totalQuantity,
    taxableValue: h.taxableValue,
    igst: h.igst,
    cgst: h.cgst,
    sgst: h.sgst,
    cess: h.cess,
  }));

  return { b2b, b2cl, b2cs, hsn };
}

export function ExportButtons({ data, gstin = '', period = '', disabled = false }: ExportButtonsProps) {
  const handleExportExcel = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }

    try {
      const exportData = transformToExportFormat(data);
      const workbook = exportGSTR1ToExcel(exportData, gstin, period);
      const filename = `GSTR1_${period || 'report'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcel(workbook, filename);
      toast.success('GSTR-1 exported to Excel successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const handleExportJson = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }

    try {
      const exportData = transformToExportFormat(data);
      const jsonString = exportGSTR1ToJson(exportData, gstin, period);
      const filename = `GSTR1_${period || 'report'}_${new Date().toISOString().split('T')[0]}.json`;
      downloadJson(jsonString, filename);
      toast.success('GSTR-1 exported to JSON successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to JSON');
    }
  };

  const hasData = data && data.summary.totalB2BInvoices + data.summary.totalB2CLInvoices + data.summary.totalB2CSRecords > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !hasData}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON (Government Format)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
