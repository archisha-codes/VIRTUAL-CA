/**
 * GSTR-8 Page - Tax Collected at Source
 * 
 * Features:
 * - View TCS returns
 * - TCS liability calculation
 * - TCS credits for collectors
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShoppingCart, 
  Store, 
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

export default function GSTR8Page() {
  const { toast } = useToast();
  
  // State
  const [filters, setFilters] = useState<Filters>({
    gstin: '',
    returnPeriod: '022026',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gstr8Data, setGstr8Data] = useState<any>(null);
  
  // Sample data for demonstration
  const sampleData = {
    summary: {
      total_collections: 150,
      total_suppliers: 45,
      total_taxable_value: 5000000,
      total_tcs_amount: 35000,
      tcs_rate_0_5: { count: 120, taxable: 4000000, tcs: 20000 },
      tcs_rate_1: { count: 30, taxable: 1000000, tcs: 10000 },
    },
    supplier_summary: [
      { supplier_gstin: '29AABCU9603R1ZM', supplier_name: 'Seller A', invoice_count: 35, total_taxable_value: 1200000, total_tcs_amount: 6000 },
      { supplier_gstin: '27AABCU9603R1ZM', supplier_name: 'Seller B', invoice_count: 25, total_taxable_value: 800000, total_tcs_amount: 4000 },
      { supplier_gstin: '19AABCU9603R1ZM', supplier_name: 'Seller C', invoice_count: 20, total_taxable_value: 600000, total_tcs_amount: 3000 },
    ],
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGstr8Data(sampleData);
      toast({
        title: 'GSTR-8 Generated',
        description: `Processed ${sampleData.summary.total_collections} TCS collections`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate GSTR-8',
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
        description: 'GSTR-8 exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-8',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="GSTR-8">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GSTR-8: Tax Collected at Source</h1>
            <p className="text-gray-500 mt-1">
              Manage TCS collections from e-commerce operators
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Generate GSTR-8
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Tax Collected at Source (TCS)</p>
                <p className="text-sm text-blue-700 mt-1">
                  GSTR-8 is filed by e-commerce operators. TCS rates: 0.5% (intra-state), 1% (inter-state).
                  TCS collected is available as credit to the seller.
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
                <label className="text-sm font-medium">E-commerce Operator GSTIN</label>
                <Input 
                  placeholder="Enter Operator GSTIN"
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
        {gstr8Data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Collections</p>
                <p className="text-2xl font-bold">{gstr8Data.summary.total_collections}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Sellers</p>
                <p className="text-2xl font-bold">{gstr8Data.summary.total_suppliers}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Taxable Value</p>
                <p className="text-2xl font-bold">₹{gstr8Data.summary.total_taxable_value.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">TCS Amount</p>
                <p className="text-2xl font-bold">₹{gstr8Data.summary.total_tcs_amount.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Avg TCS Rate</p>
                <p className="text-2xl font-bold">
                  {((gstr8Data.summary.total_tcs_amount / gstr8Data.summary.total_taxable_value) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TCS by Rate */}
        {gstr8Data && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">TCS by Rate</CardTitle>
              <CardDescription>Breakdown of collections by TCS rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">0.5% (Intra-state)</p>
                  <p className="text-2xl font-bold mt-1">{gstr8Data.summary.tcs_rate_0_5.count}</p>
                  <p className="text-sm text-gray-500">Taxable: ₹{gstr8Data.summary.tcs_rate_0_5.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">TCS: ₹{gstr8Data.summary.tcs_rate_0_5.tcs.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">1% (Inter-state)</p>
                  <p className="text-2xl font-bold mt-1">{gstr8Data.summary.tcs_rate_1.count}</p>
                  <p className="text-sm text-gray-500">Taxable: ₹{gstr8Data.summary.tcs_rate_1.taxable.toLocaleString()}</p>
                  <p className="text-sm font-medium text-green-600">TCS: ₹{gstr8Data.summary.tcs_rate_1.tcs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supplier Summary Table */}
        {gstr8Data && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Seller-wise TCS Summary</CardTitle>
              <CardDescription>TCS collected from each seller</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Seller</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Invoices</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Taxable Value</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">TCS Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr8Data.supplier_summary.map((supplier: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{supplier.supplier_name}</div>
                              <div className="text-xs text-gray-500 font-mono">{supplier.supplier_gstin}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-sm text-right">{supplier.invoice_count}</td>
                        <td className="py-2 px-3 text-sm text-right">₹{supplier.total_taxable_value.toLocaleString()}</td>
                        <td className="py-2 px-3 text-sm text-right font-medium">₹{supplier.total_tcs_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Section */}
        {gstr8Data && (
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center">
                <FileDown className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium">Your GSTR-8 is ready</p>
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
