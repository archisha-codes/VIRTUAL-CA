/**
 * GSTR-4 Page - Composition Dealer Return
 * 
 * Features:
 * - View composition dealer returns
 * - Composition tax calculation
 * - Export functionality
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Calculator, 
  Download, 
  FileDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Filter type
interface Filters {
  gstin: string;
  returnPeriod: string;
  compositionType: string;
}

// Composition types
const compositionTypes = [
  { value: 'regular', label: 'Regular Composition' },
  { value: 'casual', label: 'Casual Composition' },
  { value: 'nrth', label: 'NRTP Composition' },
];

export default function GSTR4Page() {
  const { toast } = useToast();
  
  // State
  const [filters, setFilters] = useState<Filters>({
    gstin: '',
    returnPeriod: '022026',
    compositionType: 'regular',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gstr4Data, setGstr4Data] = useState<any>(null);
  
  // Sample data for demonstration
  const sampleData = {
    summary: {
      total_invoices: 45,
      b2b_count: 12,
      b2c_count: 30,
      export_count: 3,
      total_taxable_value: 1250000,
      total_composition_tax: 31250,
      igst: 0,
      cgst: 15625,
      sgst: 15625,
    },
    b2b: [
      { invoice_number: 'INV-001', customer_gstin: '29AABCU9603R1ZM', taxable_value: 50000, composition_tax: 1250 },
      { invoice_number: 'INV-002', customer_gstin: '27AABCU9603R1ZM', taxable_value: 75000, composition_tax: 1875 },
    ],
    b2c: [
      { invoice_number: 'INV-C-001', customer_name: 'Retail Customer 1', taxable_value: 10000, composition_tax: 250 },
      { invoice_number: 'INV-C-002', customer_name: 'Retail Customer 2', taxable_value: 15000, composition_tax: 375 },
    ],
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGstr4Data(sampleData);
      toast({
        title: 'GSTR-4 Generated',
        description: `Processed ${sampleData.summary.total_invoices} invoices`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate GSTR-4',
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
        description: 'GSTR-4 exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-4',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="GSTR-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GSTR-4: Composition Dealer Return</h1>
            <p className="text-gray-500 mt-1">
              Prepare and file returns for composition scheme dealers
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Generate GSTR-4
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Composition Scheme Returns</p>
                <p className="text-sm text-blue-700 mt-1">
                  GSTR-4 is filed by composition dealers. Tax is calculated at reduced rates:
                  0.5% (manufacturer), 1% (e-commerce), 2.5% (intra-state), 3% (inter-state).
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GSTIN</label>
                <Input 
                  placeholder="Enter GSTIN"
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Composition Type</label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                  value={filters.compositionType}
                  onChange={(e) => setFilters({...filters, compositionType: e.target.value})}
                >
                  {compositionTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {gstr4Data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold">{gstr4Data.summary.total_invoices}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Taxable Value</p>
                <p className="text-2xl font-bold">₹{gstr4Data.summary.total_taxable_value.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Composition Tax</p>
                <p className="text-2xl font-bold">₹{gstr4Data.summary.total_composition_tax.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">B2B Invoices</p>
                <p className="text-2xl font-bold">{gstr4Data.summary.b2b_count}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">B2C Invoices</p>
                <p className="text-2xl font-bold">{gstr4Data.summary.b2c_count}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Tables */}
        {gstr4Data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* B2B Table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">B2B Supplies (Registered)</CardTitle>
                <CardDescription>Invoices to registered taxpayers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Invoice</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">GSTIN</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Taxable</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr4Data.b2b.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm">{item.invoice_number}</td>
                          <td className="py-2 px-3 text-sm font-mono">{item.customer_gstin}</td>
                          <td className="py-2 px-3 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                          <td className="py-2 px-3 text-sm text-right">₹{item.composition_tax.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* B2C Table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">B2C Supplies (Unregistered)</CardTitle>
                <CardDescription>Invoices to unregistered consumers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Invoice</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Customer</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Taxable</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr4Data.b2c.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm">{item.invoice_number}</td>
                          <td className="py-2 px-3 text-sm">{item.customer_name}</td>
                          <td className="py-2 px-3 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                          <td className="py-2 px-3 text-sm text-right">₹{item.composition_tax.toLocaleString()}</td>
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
        {gstr4Data && (
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center">
                <FileDown className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium">Your GSTR-4 is ready</p>
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
