/**
 * GSTR-9 Page - Annual Return
 * 
 * Features:
 * - Annual summary of monthly returns
 * - Consolidated inward/outward supplies
 * - ITC reconciliation
 * - Audit details
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileStack, 
  FileText, 
  Download, 
  FileDown,
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Filter type
interface Filters {
  gstin: string;
  financialYear: string;
}

export default function GSTR9Page() {
  const { toast } = useToast();
  
  // State
  const [filters, setFilters] = useState<Filters>({
    gstin: '',
    financialYear: '2023-24',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gstr9Data, setGstr9Data] = useState<any>(null);
  
  // Sample data for demonstration
  const sampleData = {
    summary: {
      total_outward_taxable: 15000000,
      total_tax_liability: 2250000,
      total_itc_availed: 1800000,
      total_itc_reversed: 150000,
      net_tax_payable: 600000,
      late_fee: 0,
    },
    outward_supplies: {
      b2b: { count: 500, taxable: 8000000 },
      b2cl: { count: 300, taxable: 3000000 },
      b2cs: { count: 1000, taxable: 2500000 },
      exports: { count: 200, taxable: 1500000 },
    },
    inward_supplies: {
      from_registered: { taxable: 6000000, itc: 900000 },
      from_unregistered: { taxable: 2000000, itc: 180000 },
      imports: { taxable: 3000000, itc: 540000 },
    },
    itc: {
      total_itc_availed: { igst: 800000, cgst: 500000, sgst: 500000, cess: 0 },
      itc_reversed: { igst: 60000, cgst: 45000, sgst: 45000, cess: 0 },
      net_itc_available: { igst: 740000, cgst: 455000, sgst: 455000, cess: 0 },
    },
    tax_liability: { igst: 1000000, cgst: 625000, sgst: 625000, cess: 0 },
    audit_required: false,
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setGstr9Data(sampleData);
      toast({
        title: 'GSTR-9 Generated',
        description: 'Annual return for FY 2023-24',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate GSTR-9',
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
        description: 'GSTR-9 exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-9',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="GSTR-9">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GSTR-9: Annual Return</h1>
            <p className="text-gray-500 mt-1">
              Consolidated annual return for the financial year
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Import Monthly Data
            </Button>
            <Button 
              className="gap-2 bg-corporate-primary hover:bg-corporate-primaryHover"
              onClick={handleGenerate}
              disabled={isLoading || !filters.gstin}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
              Generate GSTR-9
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Annual Return (GSTR-9)</p>
                <p className="text-sm text-blue-700 mt-1">
                  GSTR-9 consolidates all monthly returns (GSTR-1, GSTR-3B) for the financial year.
                  Due by 31st December of the next FY. Audit required if turnover {'>'} ₹2 crore.
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
                <label className="text-sm font-medium">GSTIN</label>
                <Input 
                  placeholder="Enter GSTIN"
                  value={filters.gstin}
                  onChange={(e) => setFilters({...filters, gstin: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Financial Year</label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                  value={filters.financialYear}
                  onChange={(e) => setFilters({...filters, financialYear: e.target.value})}
                >
                  <option value="2023-24">2023-24</option>
                  <option value="2022-23">2022-23</option>
                  <option value="2021-22">2021-22</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {gstr9Data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Outward Taxable</p>
                <p className="text-2xl font-bold">₹{gstr9Data.summary.total_outward_taxable.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Tax Liability</p>
                <p className="text-2xl font-bold">₹{gstr9Data.summary.total_tax_liability.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">ITC Availed</p>
                <p className="text-2xl font-bold">₹{gstr9Data.summary.total_itc_availed.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">ITC Reversed</p>
                <p className="text-2xl font-bold">₹{gstr9Data.summary.total_itc_reversed.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm bg-green-50">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Net Tax Payable</p>
                <p className="text-2xl font-bold text-green-700">₹{gstr9Data.summary.net_tax_payable.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Details */}
        {gstr9Data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Outward Supplies */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Outward Supplies</CardTitle>
                <CardDescription>Consolidated from GSTR-1</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">B2B</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{gstr9Data.outward_supplies.b2b.count}</p>
                      <p className="text-sm text-gray-500">₹{gstr9Data.outward_supplies.b2b.taxable.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">B2CL</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{gstr9Data.outward_supplies.b2cl.count}</p>
                      <p className="text-sm text-gray-500">₹{gstr9Data.outward_supplies.b2cl.taxable.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">B2CS</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{gstr9Data.outward_supplies.b2cs.count}</p>
                      <p className="text-sm text-gray-500">₹{gstr9Data.outward_supplies.b2cs.taxable.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Exports</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{gstr9Data.outward_supplies.exports.count}</p>
                      <p className="text-sm text-gray-500">₹{gstr9Data.outward_supplies.exports.taxable.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ITC Summary */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Input Tax Credit</CardTitle>
                <CardDescription>From GSTR-3B and GSTR-2B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">ITC Availed</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-green-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">IGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.total_itc_availed.igst.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">CGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.total_itc_availed.cgst.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">SGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.total_itc_availed.sgst.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">CESS</p>
                        <p className="font-bold">₹{gstr9Data.itc.total_itc_availed.cess.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">ITC Reversed</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-red-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">IGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.itc_reversed.igst.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">CGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.itc_reversed.cgst.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">SGST</p>
                        <p className="font-bold">₹{gstr9Data.itc.itc_reversed.sgst.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">CESS</p>
                        <p className="font-bold">₹{gstr9Data.itc.itc_reversed.cess.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tax Liability */}
        {gstr9Data && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Tax Liability Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">IGST</p>
                  <p className="text-xl font-bold">₹{gstr9Data.tax_liability.igst.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">CGST</p>
                  <p className="text-xl font-bold">₹{gstr9Data.tax_liability.cgst.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">SGST</p>
                  <p className="text-xl font-bold">₹{gstr9Data.tax_liability.sgst.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">CESS</p>
                  <p className="text-xl font-bold">₹{gstr9Data.tax_liability.cess.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit Warning */}
        {gstr9Data && gstr9Data.audit_required && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">Audit Required</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Turnover exceeds ₹2 crore. Tax audit report from CA/CMA required.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Section */}
        {gstr9Data && (
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center">
                <FileDown className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium">Your GSTR-9 is ready</p>
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
