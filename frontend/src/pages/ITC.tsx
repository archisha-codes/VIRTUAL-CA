/**
 * ITC Page - Input Tax Credit Ledger
 * 
 * Manages ITC claims and displays credit ledger details.
 */

import { useState } from 'react';
import { 
  Files, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck,
  ArrowRightLeft
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table as TableComponent, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types for ITC Ledger
interface ITCLedgerEntry {
  id: string;
  date: string;
  description: string;
  gstin: string;
  invoiceNumber: string;
  itcAvailable: number;
  itcClaimed: number;
  itcReversed: number;
  type: 'B2B' | 'B2CL' | 'IMPORT' | 'ITC_ON_SELF';
  status: 'claimed' | 'pending' | 'reversed';
}

export default function ITCPage() {
  const [activeTab, setActiveTab] = useState('ledger');

  // Mock ITC Ledger data
  const itcLedger: ITCLedgerEntry[] = [
    {
      id: '1',
      date: '2026-02-01',
      description: 'B2B Inward Supply',
      gstin: '27AAACC4142L1Z4',
      invoiceNumber: 'INV/2026/001',
      itcAvailable: 9000,
      itcClaimed: 9000,
      itcReversed: 0,
      type: 'B2B',
      status: 'claimed'
    },
    {
      id: '2',
      date: '2026-02-05',
      description: 'B2B Inward Supply',
      gstin: '29AAACI3456L1Z8',
      invoiceNumber: 'INV/2026/002',
      itcAvailable: 13500,
      itcClaimed: 13500,
      itcReversed: 0,
      type: 'B2B',
      status: 'claimed'
    },
    {
      id: '3',
      date: '2026-02-10',
      description: 'Import of Goods',
      gstin: 'IMPORT001',
      invoiceNumber: 'IMP/2026/001',
      itcAvailable: 25000,
      itcClaimed: 0,
      itcReversed: 0,
      type: 'IMPORT',
      status: 'pending'
    },
    {
      id: '4',
      date: '2026-02-15',
      description: 'B2CL Inward Supply',
      gstin: '07AAACC4142L1Z4',
      invoiceNumber: 'INV/2026/003',
      itcAvailable: 3000,
      itcClaimed: 0,
      itcReversed: 0,
      type: 'B2CL',
      status: 'pending'
    },
    {
      id: '5',
      date: '2026-01-20',
      description: 'ITC Reversal - Rule 42',
      gstin: '27AAACC4142L1Z4',
      invoiceNumber: 'REV/2026/001',
      itcAvailable: 0,
      itcClaimed: 0,
      itcReversed: 500,
      type: 'B2B',
      status: 'reversed'
    }
  ];

  // Calculate ITC Summary
  const totalITCAvailable = itcLedger.reduce((sum, e) => sum + e.itcAvailable, 0);
  const totalITCClaimed = itcLedger.reduce((sum, e) => sum + e.itcClaimed, 0);
  const totalITCReversed = itcLedger.reduce((sum, e) => sum + e.itcReversed, 0);
  const pendingITC = totalITCAvailable - totalITCClaimed;
  const netITC = totalITCClaimed - totalITCReversed;

  // Summary cards data
  const summaryCards = [
    {
      title: 'Total ITC Available',
      value: totalITCAvailable,
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'ITC Claimed',
      value: totalITCClaimed,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'ITC Pending',
      value: pendingITC,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'ITC Reversed',
      value: totalITCReversed,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <DashboardLayout title="ITC - Input Tax Credit">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">₹{card.value.toLocaleString()}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Net ITC Card */}
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-medium">Net ITC Available for Utilization</p>
                <p className="text-3xl font-bold text-primary">₹{netITC.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* ITC Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Files className="h-5 w-5" />
              ITC Ledger Details
            </CardTitle>
            <CardDescription>
              Track all Input Tax Credit available, claimed, and reversed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ledger">Credit Ledger</TabsTrigger>
                <TabsTrigger value="available">ITC Available</TabsTrigger>
                <TabsTrigger value="reversal">ITC Reversal</TabsTrigger>
              </TabsList>

              <TabsContent value="ledger" className="mt-6">
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">ITC Available</TableHead>
                      <TableHead className="text-right">ITC Claimed</TableHead>
                      <TableHead className="text-right">ITC Reversed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itcLedger.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.gstin}</TableCell>
                        <TableCell>{entry.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            entry.status === 'claimed' ? 'default' :
                            entry.status === 'pending' ? 'secondary' :
                            'destructive'
                          }>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{entry.itcAvailable.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₹{entry.itcClaimed.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₹{entry.itcReversed.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>

              <TabsContent value="available" className="mt-6">
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">ITC Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itcLedger.filter(e => e.itcAvailable > 0).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.gstin}</TableCell>
                        <TableCell>{entry.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{entry.itcAvailable.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>

              <TabsContent value="reversal" className="mt-6">
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">ITC Reversed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itcLedger.filter(e => e.itcReversed > 0).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.gstin}</TableCell>
                        <TableCell>{entry.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-red-600">₹{entry.itcReversed.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ITC Rules Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              ITC Rules & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">ITC Available Under Section 16(1)</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Tax invoice for supply of goods/services</li>
                  <li>• Receipt of goods/services</li>
                  <li>• Payment made to supplier</li>
                  <li>• File GSTR-3B return</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-900 mb-2">ITC Not Available Under Section 16(2)</h4>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Motor vehicles (unless used for specified services)</li>
                  <li>• Food & beverages, health services</li>
                  <li>• Works contract (unless for immovable property)</li>
                  <li>• Goods/services used for personal purposes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
