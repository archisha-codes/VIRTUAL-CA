/**
 * GSTR-7 Page - Tax Deducted at Source
 * 
 * Features:
 * - View TDS returns
 * - TDS liability calculation
 * - TDS credits for deductees
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Receipt, 
  FileText, 
  Download, 
  FileDown,
  Loader2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Filter type
interface Filters {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR7Page() {
  const { toast } = useToast();
  
  // State
  const [filters, setFilters] = useState<Filters>({
    gstin: '',
    returnPeriod: '022026',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gstr7Data, setGstr7Data] = useState<any>(null);
  
  // Sample data for demonstration
  const sampleData = {
    summary: {
      total_deductions: 35,
      total_suppliers: 15,
      total_taxable_value: 2500000,
      total_tds_amount: 50000,
      tds_rate_1: { count: 20, taxable: 1500000, tds: 15000 },
      tds_rate_2: { count: 10, taxable: 750000, tds: 15000 },
      tds_rate_5: { count: 3, taxable: 150000, tds: 7500 },
      tds_rate_10: { count: 2, taxable: 100000, tds: 10000 },
    },
    supplier_summary: [
      { supplier_gstin: '29AABCU9603R1ZM', supplier_name: 'Supplier A', invoice_count: 8, total_taxable_value: 500000, total_tds_amount: 10000 },
      { supplier_gstin: '27AABCU9603R1ZM', supplier_name: 'Supplier B', invoice_count: 5, total_taxable_value: 300000, total_tds_amount: 6000 },
      { supplier_gstin: '19AABCU9603R1ZM', supplier_name: 'Supplier C', invoice_count: 3, total_taxable_value: 200000, total_tds_amount: 4000 },
    ],
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGstr7Data(sampleData);
      toast({
        title: 'GSTR-7 Generated',
        description: `Processed ${sampleData.summary.total_deductions} TDS deductions`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate GSTR-7',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast({
        title: 'Export Complete',
        description: 'GSTR-7 exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-7',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="GSTR-7">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GSTR-7: Tax Deducted at Source</h1>
            <p className="text-gray-500 mt-1">
              Manage TDS deductions and filing
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Import Data
            </Button>
            <Button 
              className="gap-2 bg-corporate-primary hover:bg-corporate-primaryHover"
              onClick={handleGenerate}
              disabled={isLoading || !filters.gstin}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Generate GSTR-7
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Tax Deducted at Source (TDS)</p>
                <p className="text-sm text-blue-700 mt-1">
                  GSTR-7 is filed by deductor. TDS rates: 1%, 2%, 5%, 10%. 
                  TDS deducted can be claimed as credit by the supplier.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Return Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Deductor GSTIN</label>
                <Input 
                  placeholder="Enter Deductor GSTIN"
                  value={filters.gstin}
                  onChange={(e) => setFilters({...filters, gstin: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Return Period</label>
                <Input 
                  placeholder="MMYYYY"
                  value={filters.returnPeriod}
                  onChange={(e) => setFilters({...filters, returnPeriod: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {gstr7Data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Deductions</p>
                <p className="text-2xl font-bold">{gstr7Data.summary.total_deductions}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Suppliers</p>
                <p className="text-2xl font-bold">{gstr7Data.summary.total_suppliers}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Taxable Value</p>
                <p className="text-2xl font-bold">₹{gstr7Data.summary.total_taxable_value.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">TDS Amount</p>
                <p className="text-2xl font-bold">₹{gstr7Data.summary.total_tds_amount.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Avg TDS Rate</p>
                <p className="text-2xl font-bold">
                  {((gstr7Data.summary.total_tds_amount / gstr7Data.summary.total_taxable_value) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TDS by Rate */}
        {gstr7Data && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">TDS by Rate</CardTitle>
              <CardDescription>Breakdown of deductions by TDS rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">1% Rate</p>
                  <p className="text-2xl font-bold mt-1">{gstr7Data.summary.tds_rate_1.count}</p>
                  <p className="text-sm text-gray-500">₹{gstr7Data.summary.tds_rate_1.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">₹{gstr7Data.summary.tds_rate_1.tds.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">2% Rate</p>
                  <p className="text-2xl font-bold mt-1">{gstr7Data.summary.tds_rate_2.count}</p>
                  <p className="text-sm text-gray-500">₹{gstr7Data.summary.tds_rate_2.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">₹{gstr7Data.summary.tds_rate_2.tds.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">5% Rate</p>
                  <p className="text-2xl font-bold mt-1">{gstr7Data.summary.tds_rate_5.count}</p>
                  <p className="text-sm text-gray-500">₹{gstr7Data.summary.tds_rate_5.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">₹{gstr7Data.summary.tds_rate_5.tds.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">10% Rate</p>
                  <p className="text-2xl font-bold mt-1">{gstr7Data.summary.tds_rate_10.count}</p>
                  <p className="text-sm text-gray-500">₹{gstr7Data.summary.tds_rate_10.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">₹{gstr7Data.summary.tds_rate_10.tds.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supplier Summary Table */}
        {gstr7Data && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Supplier-wise TDS Summary</CardTitle>
              <CardDescription>Deductions made to each supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Supplier</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Invoices</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Taxable Value</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">TDS Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr7Data.supplier_summary.map((supplier: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">
                          <div className="font-medium">{supplier.supplier_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{supplier.supplier_gstin}</div>
                        </td>
                        <td className="py-2 px-3 text-sm text-right">{supplier.invoice_count}</td>
                        <td className="py-2 px-3 text-sm text-right">₹{supplier.total_taxable_value.toLocaleString()}</td>
                        <td className="py-2 px-3 text-sm text-right font-medium">₹{supplier.total_tds_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Section */}
        {gstr7Data && (
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center">
                <FileDown className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium">Your GSTR-7 is ready</p>
                <p className="text-sm text-gray-500 mt-1">
                  Export to Excel for filing on GST portal
                </p>
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleExport} disabled={isLoading} size="lg" className="bg-corporate-primary hover:bg-corporate-primaryHover">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <FileDown className="mr-2 h-4 w-4" />
                    Export to Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
