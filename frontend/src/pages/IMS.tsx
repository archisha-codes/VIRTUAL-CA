/**
 * IMS Page - Information Management System
 * 
 * Displays Inward and Outward supplies for GST compliance.
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ArrowRightLeft, 
  ArrowDownLeft, 
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table as TableComponent, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Types
interface SupplyRecord {
  id: string;
  gstin: string;
  tradeName: string;
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupply: string;
  taxableValue: number;
  rate: number;
  tax: number;
  type: 'B2B' | 'B2CL' | 'B2CS' | 'EXPORT';
}

export default function IMSPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'inward' | 'outward'>(
    location.pathname.includes('outward') ? 'outward' : 'inward'
  );

  // Mock data for demonstration - in production, fetch from API
  const inwardSupplies: SupplyRecord[] = [
    {
      id: '1',
      gstin: '27AAACC4142L1Z4',
      tradeName: 'ABC Corporation',
      invoiceNumber: 'INV/2026/001',
      invoiceDate: '2026-02-01',
      placeOfSupply: 'Maharashtra',
      taxableValue: 50000,
      rate: 18,
      tax: 9000,
      type: 'B2B'
    },
    {
      id: '2',
      gstin: '29AAACI3456L1Z8',
      tradeName: 'XYZ Industries',
      invoiceNumber: 'INV/2026/002',
      invoiceDate: '2026-02-05',
      placeOfSupply: 'Karnataka',
      taxableValue: 75000,
      rate: 18,
      tax: 13500,
      type: 'B2B'
    },
    {
      id: '3',
      gstin: '07AAACC4142L1Z4',
      tradeName: 'PQR Traders',
      invoiceNumber: 'INV/2026/003',
      invoiceDate: '2026-02-10',
      placeOfSupply: 'Delhi',
      taxableValue: 25000,
      rate: 12,
      tax: 3000,
      type: 'B2CL'
    }
  ];

  const outwardSupplies: SupplyRecord[] = [
    {
      id: '1',
      gstin: '27AAACD5678L1Z4',
      tradeName: 'Customer Alpha',
      invoiceNumber: 'SALE/2026/001',
      invoiceDate: '2026-02-02',
      placeOfSupply: 'Maharashtra',
      taxableValue: 100000,
      rate: 18,
      tax: 18000,
      type: 'B2B'
    },
    {
      id: '2',
      gstin: '27AAACD5678L1Z5',
      tradeName: 'Customer Beta',
      invoiceNumber: 'SALE/2026/002',
      invoiceDate: '2026-02-08',
      placeOfSupply: 'Maharashtra',
      taxableValue: 50000,
      rate: 18,
      tax: 9000,
      type: 'B2B'
    },
    {
      id: '3',
      gstin: '29AAACD5678L1Z8',
      tradeName: 'Customer Gamma',
      invoiceNumber: 'SALE/2026/003',
      invoiceDate: '2026-02-15',
      placeOfSupply: 'Karnataka',
      taxableValue: 80000,
      rate: 18,
      tax: 14400,
      type: 'B2CL'
    }
  ];

  const calculateSummary = (supplies: SupplyRecord[]) => {
    return {
      totalInvoices: supplies.length,
      totalTaxable: supplies.reduce((sum, s) => sum + s.taxableValue, 0),
      totalTax: supplies.reduce((sum, s) => sum + s.tax, 0),
      totalWithTax: supplies.reduce((sum, s) => sum + s.taxableValue + s.tax, 0)
    };
  };

  const inwardSummary = calculateSummary(inwardSupplies);
  const outwardSummary = calculateSummary(outwardSupplies);

  return (
    <DashboardLayout title="IMS - Supplies">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Inward</p>
                  <p className="text-2xl font-bold">{inwardSummary.totalInvoices}</p>
                </div>
                <ArrowDownLeft className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxable Value</p>
                  <p className="text-2xl font-bold">₹{inwardSummary.totalTaxable.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Outward</p>
                  <p className="text-2xl font-bold">{outwardSummary.totalInvoices}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxable Value</p>
                  <p className="text-2xl font-bold">₹{outwardSummary.totalTaxable.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* IMS Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Supply Details
            </CardTitle>
            <CardDescription>
              View detailed inward and outward supplies for the current tax period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'inward' | 'outward')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="inward" className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  Inward Supplies (ITC Available)
                </TabsTrigger>
                <TabsTrigger value="outward" className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Outward Supplies (Tax Liability)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inward" className="mt-6">
                {/* Inward Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">Total Taxable Value</p>
                    <p className="text-xl font-bold text-green-900">₹{inwardSummary.totalTaxable.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">Total Tax (ITC)</p>
                    <p className="text-xl font-bold text-blue-900">₹{inwardSummary.totalTax.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-800">Total Invoice Value</p>
                    <p className="text-xl font-bold text-purple-900">₹{inwardSummary.totalWithTax.toLocaleString()}</p>
                  </div>
                </div>

                {/* Inward Supplies Table */}
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Trade Name</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Place of Supply</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inwardSupplies.map((supply) => (
                      <TableRow key={supply.id}>
                        <TableCell className="font-mono text-sm">{supply.gstin}</TableCell>
                        <TableCell>{supply.tradeName}</TableCell>
                        <TableCell>{supply.invoiceNumber}</TableCell>
                        <TableCell>{supply.invoiceDate}</TableCell>
                        <TableCell>{supply.placeOfSupply}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{supply.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{supply.taxableValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{supply.rate}%</TableCell>
                        <TableCell className="text-right">₹{supply.tax.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>

              <TabsContent value="outward" className="mt-6">
                {/* Outward Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">Total Taxable Value</p>
                    <p className="text-xl font-bold text-green-900">₹{outwardSummary.totalTaxable.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">Total Tax Liability</p>
                    <p className="text-xl font-bold text-blue-900">₹{outwardSummary.totalTax.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-800">Total Invoice Value</p>
                    <p className="text-xl font-bold text-purple-900">₹{outwardSummary.totalWithTax.toLocaleString()}</p>
                  </div>
                </div>

                {/* Outward Supplies Table */}
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Trade Name</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Place of Supply</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outwardSupplies.map((supply) => (
                      <TableRow key={supply.id}>
                        <TableCell className="font-mono text-sm">{supply.gstin}</TableCell>
                        <TableCell>{supply.tradeName}</TableCell>
                        <TableCell>{supply.invoiceNumber}</TableCell>
                        <TableCell>{supply.invoiceDate}</TableCell>
                        <TableCell>{supply.placeOfSupply}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{supply.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{supply.taxableValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{supply.rate}%</TableCell>
                        <TableCell className="text-right">₹{supply.tax.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
