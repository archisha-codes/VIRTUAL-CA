import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, FileSpreadsheet, FileJson, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useGSTR3BData } from '@/hooks/useGSTR3BData';
import {
  exportGSTR3BToExcel,
  exportGSTR3BToJson,
  downloadExcel,
  downloadJson,
} from '@/lib/gstr-export';

export default function DownloadsPage() {
  const { data: gstr3bData, isLoading } = useGSTR3BData();

  const handleGSTR3BExcel = () => {
    if (!gstr3bData) {
      toast.error('No GSTR-3B data available to export');
      return;
    }
    try {
      const workbook = exportGSTR3BToExcel(gstr3bData, '', '');
      const filename = `GSTR3B_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcel(workbook, filename);
      toast.success('GSTR-3B exported to Excel successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const handleGSTR3BJson = () => {
    if (!gstr3bData) {
      toast.error('No GSTR-3B data available to export');
      return;
    }
    try {
      const jsonString = exportGSTR3BToJson(gstr3bData, '', '');
      const filename = `GSTR3B_${new Date().toISOString().split('T')[0]}.json`;
      downloadJson(jsonString, filename);
      toast.success('GSTR-3B exported to JSON successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to JSON');
    }
  };

  const hasGSTR3BData = gstr3bData && gstr3bData.summary.totalInvoices > 0;

  return (
    <DashboardLayout title="Downloads">
      <div className="space-y-6 animate-fade-in">
        {/* GSTR-3B Downloads */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>GSTR-3B Reports</CardTitle>
            <CardDescription>
              Download your GSTR-3B summary report in Excel or Government JSON format
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading data...
              </div>
            ) : !hasGSTR3BData ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-3">
                  No invoice data available. Upload and validate your invoices first.
                </p>
                <Button variant="outline" asChild>
                  <a href="/upload">Go to Upload</a>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border hover:border-primary/50 transition-colors cursor-pointer" onClick={handleGSTR3BExcel}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileSpreadsheet className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">GSTR-3B Excel</h3>
                        <p className="text-sm text-muted-foreground">
                          Download as .xlsx workbook
                        </p>
                      </div>
                      <FileDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border hover:border-primary/50 transition-colors cursor-pointer" onClick={handleGSTR3BJson}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileJson className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">GSTR-3B JSON</h3>
                        <p className="text-sm text-muted-foreground">
                          Government portal compatible
                        </p>
                      </div>
                      <FileDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GSTR-1 Downloads - Coming Soon */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>GSTR-1 Reports</CardTitle>
            <CardDescription>
              Download your GSTR-1 report with B2B, B2CL, B2CS, and HSN summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card className="border-dashed opacity-60">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">GSTR-1 Excel</h3>
                      <p className="text-sm text-muted-foreground">
                        Download as .xlsx workbook
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed opacity-60">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileJson className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">GSTR-1 JSON</h3>
                      <p className="text-sm text-muted-foreground">
                        Government portal compatible
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="text-center py-4">
              <Badge variant="outline">Coming in Phase 2</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                GSTR-1 exports will be available once B2B, B2CL, B2CS, and HSN tables are generated.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
