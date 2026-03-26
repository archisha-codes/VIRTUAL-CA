/**
 * GSTR-1 Reconciliation Page
 * 
 * E-Invoice vs Sales Register Reconciliation
 * 
 * Features:
 * - Summary Tab: matched, mismatched, missing, totals
 * - Customer View Tab: GSTIN, Customer Name, Counts
 * - Document View Tab: Invoice No, GSTIN, Date, Values, Status, Remarks
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileX,
  FileCheck,
  ArrowRightLeft,
  Users,
  FileText,
  BarChart3,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import { 
  createGSTR1Reconciliation, 
  getGSTR1Reconciliation, 
  listGSTR1Reconciliations,
  GSTR1ReconciliationSummary,
  GSTR1CustomerView,
  GSTR1DocumentView,
  ReconInvoice
} from '@/lib/api';

// Sample data for demonstration
const SAMPLE_EINVOICE_DATA: ReconInvoice[] = [
  { invoice_number: 'INV001', gstin: '27AABCU9603R1ZM', customer_name: 'Acme Corp', taxable_value: 100000, igst: 18000, cgst: 0, sgst: 0 },
  { invoice_number: 'INV002', gstin: '29AABCT1234N1Z5', customer_name: 'Tech Solutions', taxable_value: 50000, igst: 9000, cgst: 0, sgst: 0 },
  { invoice_number: 'INV003', gstin: '07AAEPG5678C1ZY', customer_name: 'Global Traders', taxable_value: 75000, igst: 13500, cgst: 0, sgst: 0 },
  { invoice_number: 'INV004', gstin: '33AADCS9012M1ZN', customer_name: 'Skyline Enterprises', taxable_value: 120000, igst: 21600, cgst: 0, sgst: 0 },
  { invoice_number: 'INV005', gstin: '24AAICP4567Q1ZP', customer_name: 'Prime Logistics', taxable_value: 25000, igst: 4500, cgst: 0, sgst: 0 },
  { invoice_number: 'INV006', gstin: '27AABCU9603R1ZM', customer_name: 'Acme Corp', taxable_value: 80000, igst: 14400, cgst: 0, sgst: 0 },
];

const SAMPLE_SALES_DATA: ReconInvoice[] = [
  { invoice_number: 'INV001', gstin: '27AABCU9603R1ZM', customer_name: 'Acme Corp', taxable_value: 100000, igst: 18000, cgst: 0, sgst: 0 },
  { invoice_number: 'INV002', gstin: '29AABCT1234N1Z5', customer_name: 'Tech Solutions', taxable_value: 50000, igst: 9000, cgst: 0, sgst: 0 },
  { invoice_number: 'INV003', gstin: '07AAEPG5678C1ZY', customer_name: 'Global Traders', taxable_value: 75000, igst: 13500, cgst: 0, sgst: 0 },
  { invoice_number: 'INV004', gstin: '33AADCS9012M1ZN', customer_name: 'Skyline Enterprises', taxable_value: 118000, igst: 21240, cgst: 0, sgst: 0 }, // Mismatch!
  { invoice_number: 'INV005', gstin: '24AAICP4567Q1ZP', customer_name: 'Prime Logistics', taxable_value: 25000, igst: 4500, cgst: 0, sgst: 0 },
  { invoice_number: 'INV007', gstin: '27AABCU9603R1ZM', customer_name: 'Acme Corp', taxable_value: 60000, igst: 10800, cgst: 0, sgst: 0 }, // Missing in E-Invoice!
];

export default function GSTR1ReconciliationPage() {
  const [searchParams] = useSearchParams();
  
  // State
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  
  // Data state
  const [summary, setSummary] = useState<GSTR1ReconciliationSummary | null>(null);
  const [customerView, setCustomerView] = useState<GSTR1CustomerView[]>([]);
  const [documentView, setDocumentView] = useState<GSTR1DocumentView[]>([]);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Get GSTIN and period from URL params
  const gstin = searchParams.get('gstin') || '';
  const returnPeriod = searchParams.get('period') || '';
  
  // Load saved reconciliation on mount
  useEffect(() => {
    loadReconciliations();
  }, []);
  
  const loadReconciliations = async () => {
    setLoading(true);
    try {
      const response = await listGSTR1Reconciliations(gstin || undefined, returnPeriod || undefined, 1);
      if (response.success && response.data && response.data.length > 0) {
        const latestReport = response.data[0];
        await loadReport(latestReport.id);
      }
    } catch (error) {
      console.error('Error loading reconciliations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadReport = async (reportId: string) => {
    setLoading(true);
    try {
      const response = await getGSTR1Reconciliation(reportId);
      if (response.success && response.data) {
        setSummary(response.data.summary);
        setCustomerView(response.data.customer_view);
        setDocumentView(response.data.document_view);
        setCurrentReportId(reportId);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const runReconciliation = async () => {
    setReconciling(true);
    try {
      // Use sample data for demonstration
      // In production, this would come from uploaded files or database
      const response = await createGSTR1Reconciliation({
        gstin,
        return_period: returnPeriod,
        einvoice_data: SAMPLE_EINVOICE_DATA,
        sales_register_data: SAMPLE_SALES_DATA
      });
      
      if (response.success && response.data) {
        setSummary(response.data.summary);
        setCustomerView(response.data.customer_view);
        setDocumentView(response.data.document_view);
        setCurrentReportId(response.report_id);
      }
    } catch (error) {
      console.error('Error running reconciliation:', error);
    } finally {
      setReconciling(false);
    }
  };
  
  // Filter document view
  const filteredDocuments = documentView.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Matched</Badge>;
      case 'mismatch':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Mismatch</Badge>;
      case 'missing_in_sales':
        return <Badge className="bg-orange-100 text-orange-800"><FileX className="w-3 h-3 mr-1" /> Missing in Sales</Badge>;
      case 'missing_in_einvoice':
        return <Badge className="bg-yellow-100 text-yellow-800"><FileX className="w-3 h-3 mr-1" /> Missing in E-Invoice</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6" />
            GSTR-1 Reconciliation
          </h1>
          <p className="text-muted-foreground">
            E-Invoice vs Sales Register Reconciliation
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={runReconciliation} 
            disabled={reconciling}
            className="gap-2"
          >
            {reconciling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {reconciling ? 'Reconciling...' : 'Run Reconciliation'}
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number, GSTIN, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="mismatch">Mismatch</SelectItem>
            <SelectItem value="missing_in_sales">Missing in Sales</SelectItem>
            <SelectItem value="missing_in_einvoice">Missing in E-Invoice</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Main Content */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-2">
            <Users className="w-4 h-4" />
            Customer View
          </TabsTrigger>
          <TabsTrigger value="document" className="gap-2">
            <FileText className="w-4 h-4" />
            Document View
          </TabsTrigger>
        </TabsList>
        
        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Matched</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      {summary.matched_count}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(summary.matched_total)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Mismatched</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      {summary.mismatch_count}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(summary.mismatch_total)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Missing in Sales</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <FileX className="w-5 h-5 text-orange-600" />
                      {summary.missing_in_sales_count}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(summary.missing_in_sales_total)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Missing in E-Invoice</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      {summary.missing_in_einvoice_count}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(summary.missing_in_einvoice_total)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Progress Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Match Rate</span>
                      <span>
                        {summary.total_einvoice_count > 0 
                          ? Math.round((summary.matched_count / summary.total_einvoice_count) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={
                        summary.total_einvoice_count > 0 
                          ? (summary.matched_count / summary.total_einvoice_count) * 100
                          : 0
                      } 
                      className="h-2"
                    />
                  </div>
                  
                  {/* Totals Table */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total E-Invoices</p>
                      <p className="text-xl font-bold">{summary.total_einvoice_count}</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Sales</p>
                      <p className="text-xl font-bold">{summary.total_sales_count}</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">E-Invoice Value</p>
                      <p className="text-xl font-bold">{formatCurrency(summary.total_einvoice_taxable)}</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Sales Value</p>
                      <p className="text-xl font-bold">{formatCurrency(summary.total_sales_taxable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No reconciliation data available
                </p>
                <Button onClick={runReconciliation} disabled={reconciling}>
                  {reconciling ? 'Running...' : 'Run Reconciliation'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Customer View Tab */}
        <TabsContent value="customer" className="space-y-4">
          {customerView.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Customer-wise Reconciliation</CardTitle>
                <CardDescription>
                  View reconciliation results grouped by customer GSTIN
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead className="text-right">Matched</TableHead>
                      <TableHead className="text-right">Mismatched</TableHead>
                      <TableHead className="text-right">Missing (Sales)</TableHead>
                      <TableHead className="text-right">Missing (E-Invoice)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerView.map((customer) => (
                      <TableRow key={customer.gstin}>
                        <TableCell className="font-mono text-xs">
                          {customer.gstin}
                        </TableCell>
                        <TableCell>{customer.customer_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {customer.matched_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {customer.mismatched_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-orange-50 text-orange-700">
                            {customer.missing_in_sales_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            {customer.missing_in_einvoice_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {customer.total_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No customer data available. Run reconciliation first.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Document View Tab */}
        <TabsContent value="document" className="space-y-4">
          {filteredDocuments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Document-wise Reconciliation</CardTitle>
                <CardDescription>
                  Detailed view of each invoice with reconciliation status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          {doc.invoice_number}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {doc.gstin || '-'}
                        </TableCell>
                        <TableCell>{doc.customer_name || '-'}</TableCell>
                        <TableCell>{doc.invoice_date || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(doc.taxable_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(doc.igst)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(doc.status)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No documents found. Run reconciliation first or adjust filters.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
