/**
 * GSTR-6 Page - Input Service Distributor Return
 * 
 * Features:
 * - View ISD returns
 * - ITC distribution to branches
 * - Monthly distribution summary
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowRightLeft, 
  Building2, 
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

export default function GSTR6Page() {
  const { toast } = useToast();
  
  // State
  const [filters, setFilters] = useState<Filters>({
    gstin: '',
    returnPeriod: '022026',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gstr6Data, setGstr6Data] = useState<any>(null);
  
  // Sample data for demonstration
  const sampleData = {
    summary: {
      total_invoices: 25,
      total_vendors: 8,
      total_branches: 4,
      total_taxable_value: 850000,
      total_igst: 76500,
      total_cgst: 42500,
      total_sgst: 42500,
      total_credit_distributed: 161500,
    },
    vendor_summary: [
      { vendor_gstin: '29AABCU9603R1ZM', vendor_name: 'Vendor A', invoice_count: 5, taxable_value: 250000, total_credit: 45000 },
      { vendor_gstin: '27AABCU9603R1ZM', vendor_name: 'Vendor B', invoice_count: 3, taxable_value: 150000, total_credit: 27000 },
    ],
    distribution: [
      { branch_gstin: '29AABCU9603R1ZM', branch_name: 'Branch Mumbai', total_credit: 40375 },
      { branch_gstin: '27AABCU9603R1ZM', branch_name: 'Branch Bangalore', total_credit: 40375 },
      { branch_gstin: '19AABCU9603R1ZM', branch_name: 'Branch Kolkata', total_credit: 40375 },
      { branch_gstin: '10AABCU9603R1ZM', branch_name: 'Branch Chennai', total_credit: 40375 },
    ],
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGstr6Data(sampleData);
      toast({
        title: 'GSTR-6 Generated',
        description: `Processed ${sampleData.summary.total_invoices} ISD invoices`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate GSTR-6',
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
        description: 'GSTR-6 exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-6',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="GSTR-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GSTR-6: Input Service Distributor</h1>
            <p className="text-gray-500 mt-1">
              Manage ISD returns and ITC distribution to branches
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Generate GSTR-6
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Input Service Distributor (ISD)</p>
                <p className="text-sm text-blue-700 mt-1">
                  GSTR-6 is filed by ISD to distribute ITC received from input services to branch offices.
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
                <label className="text-sm font-medium">ISD GSTIN</label>
                <Input 
                  placeholder="Enter ISD GSTIN"
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
        {gstr6Data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold">{gstr6Data.summary.total_invoices}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Vendors</p>
                <p className="text-2xl font-bold">{gstr6Data.summary.total_vendors}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Branches</p>
                <p className="text-2xl font-bold">{gstr6Data.summary.total_branches}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Taxable Value</p>
                <p className="text-2xl font-bold">₹{gstr6Data.summary.total_taxable_value.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">ITC Distributed</p>
                <p className="text-2xl font-bold">₹{gstr6Data.summary.total_credit_distributed.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Tables */}
        {gstr6Data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor Summary */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Input Service Providers</CardTitle>
                <CardDescription>Vendors from whom ISD received services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Vendor</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Invoices</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Taxable</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr6Data.vendor_summary.map((vendor: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm">
                            <div className="font-medium">{vendor.vendor_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{vendor.vendor_gstin}</div>
                          </td>
                          <td className="py-2 px-3 text-sm text-right">{vendor.invoice_count}</td>
                          <td className="py-2 px-3 text-sm text-right">₹{vendor.taxable_value.toLocaleString()}</td>
                          <td className="py-2 px-3 text-sm text-right font-medium">₹{vendor.total_credit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Branch Distribution */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">ITC Distribution</CardTitle>
                <CardDescription>Credit distributed to branches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Branch</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">GSTIN</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">ITC Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr6Data.distribution.map((branch: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              {branch.branch_name}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm font-mono text-gray-500">{branch.branch_gstin}</td>
                          <td className="py-2 px-3 text-sm text-right font-medium">₹{branch.total_credit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Export Section */}
        {gstr6Data && (
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center">
                <FileDown className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium">Your GSTR-6 is ready</p>
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
