import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import type { GSTR3BData } from '@/hooks/useGSTR3BData';
import {
  exportGSTR3BToExcel,
  exportGSTR3BToJson,
  downloadExcel,
  downloadJson,
} from '@/lib/gstr-export';

interface ExportButtonsProps {
  data: GSTR3BData | undefined;
  gstin?: string;
  period?: string;
  disabled?: boolean;
}

export function ExportButtons({ data, gstin = '', period = '', disabled = false }: ExportButtonsProps) {
  const handleExportExcel = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }

    try {
      const workbook = exportGSTR3BToExcel(data, gstin, period);
      const filename = `GSTR3B_${period || 'report'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcel(workbook, filename);
      toast.success('GSTR-3B exported to Excel successfully');
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
      const jsonString = exportGSTR3BToJson(data, gstin, period);
      const filename = `GSTR3B_${period || 'report'}_${new Date().toISOString().split('T')[0]}.json`;
      downloadJson(jsonString, filename);
      toast.success('GSTR-3B exported to JSON successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to JSON');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !data}>
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
