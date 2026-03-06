/**
 * Reports Page - Filing Tracker and GST Reports
 * 
 * Displays filing status and various GST reports.
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FileBarChart, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Calendar,
  Download,
  Eye,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table as TableComponent, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Filing status types
interface FilingRecord {
  id: string;
  period: string;
  dueDate: string;
  filedDate?: string;
  type: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'GSTR-9';
  status: 'filed' | 'pending' | 'overdue';
  taxAmount?: number;
  lateFee?: number;
}

export default function ReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'filing' | 'gst'>('filing');

  // Mock Filing Tracker Data
  const filingRecords: FilingRecord[] = [
    {
      id: '1',
      period: 'January 2026',
      dueDate: '2026-02-11',
      filedDate: '2026-02-08',
      type: 'GSTR-1',
      status: 'filed',
      taxAmount: 150000
    },
    {
      id: '2',
      period: 'January 2026',
      dueDate: '2026-02-20',
      filedDate: '2026-02-18',
      type: 'GSTR-3B',
      status: 'filed',
      taxAmount: 180000
    },
    {
      id: '3',
      period: 'February 2026',
      dueDate: '2026-03-11',
      filedDate: undefined,
      type: 'GSTR-1',
      status: 'pending'
    },
    {
      id: '4',
      period: 'February 2026',
      dueDate: '2026-03-20',
      filedDate: undefined,
      type: 'GSTR-3B',
      status: 'pending'
    },
    {
      id: '5',
      period: 'December 2025',
      dueDate: '2026-01-11',
      filedDate: '2026-01-10',
      type: 'GSTR-1',
      status: 'filed',
      taxAmount: 125000
    },
    {
      id: '6',
      period: 'December 2025',
      dueDate: '2026-01-20',
      filedDate: '2026-01-22',
      type: 'GSTR-3B',
      status: 'filed',
      taxAmount: 140000,
      lateFee: 500
    }
  ];

  // Summary stats
  const totalFiled = filingRecords.filter(f => f.status === 'filed').length;
  const totalPending = filingRecords.filter(f => f.status === 'pending').length;
  const totalTaxPaid = filingRecords.reduce((sum, f) => sum + (f.taxAmount || 0), 0);
  const totalLateFees = filingRecords.reduce((sum, f) => sum + (f.lateFee || 0), 0);

  // Filing Summary Cards
  const summaryCards = [
    {
      title: 'Filed Returns',
      value: totalFiled,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Pending Returns',
      value: totalPending,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Tax Paid',
      value: totalTaxPaid,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Late Fees',
      value: totalLateFees,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <DashboardLayout title="Reports">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">
                      {typeof card.value === 'number' && card.title.includes('Tax') 
                        ? `₹${card.value.toLocaleString()}`
                        : card.value
                      }
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reports Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              GST Reports
            </CardTitle>
            <CardDescription>
              Track your filing status and view detailed GST reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'filing' | 'gst')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="filing">
                  <Calendar className="h-4 w-4 mr-2" />
                  File Tracker
                </TabsTrigger>
                <TabsTrigger value="gst">
                  <FileBarChart className="h-4 w-4 mr-2" />
                  GSTR-2B Reconciliation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="filing" className="mt-6">
                {/* Filing Tracker Table */}
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Return Type</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Filed Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Tax Amount</TableHead>
                      <TableHead className="text-right">Late Fee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filingRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.period}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.type}</Badge>
                        </TableCell>
                        <TableCell>{record.dueDate}</TableCell>
                        <TableCell>{record.filedDate || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            record.status === 'filed' ? 'default' :
                            record.status === 'pending' ? 'secondary' :
                            'destructive'
                          }>
                            {record.status === 'filed' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {record.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {record.status === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.taxAmount ? `₹${record.taxAmount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.lateFee ? (
                            <span className="text-red-600">₹{record.lateFee.toLocaleString()}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.status === 'filed' ? (
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          ) : record.status === 'pending' ? (
                            <Button variant="outline" size="sm" onClick={() => {
                              if (record.type === 'GSTR-1') navigate('/gstr1');
                              else if (record.type === 'GSTR-3B') navigate('/gstr3b');
                            }}>
                              File Now
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </TabsContent>

              <TabsContent value="gst" className="mt-6">
                {/* GSTR-2B Reconciliation Section */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-6 text-center">
                        <TrendingDown className="h-8 w-8 mx-auto text-green-600 mb-2" />
                        <p className="font-medium">GSTR-2B vs Purchase Invoices</p>
                        <p className="text-sm text-muted-foreground">Reconcile your purchase data with GSTR-2B</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-6 text-center">
                        <TrendingUp className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                        <p className="font-medium">GSTR-1 vs GSTR-3B</p>
                        <p className="text-sm text-muted-foreground">Match outward supplies with tax liability</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-center mt-6">
                    <Button variant="outline">
                      See More
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
