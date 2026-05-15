import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TablePagination } from '@/components/invoices/TablePagination';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveWorkspace } from '@/store/tenantStore';
import { getAuthHeaders } from '@/lib/api';
import { CheckCircle, AlertTriangle, XCircle, Search, FileText, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  customer_gstin: string | null;
  place_of_supply: string | null;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  invoice_type: string;
  validation_status: string;
  validation_errors: { field: string; message: string; severity: string }[];
}

const statusConfig = {
  passed: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10', label: 'Passed' },
  warning: { icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Warning' },
  failed: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Failed' },
  pending: { icon: Info, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Pending' },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const { user } = useAuth();
  const activeWorkspace = useActiveWorkspace();

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchInvoices();
    } else {
      setInvoices([]);
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  const fetchInvoices = async () => {
    if (!activeWorkspace?.id) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/invoices?workspace_id=${activeWorkspace.id}&category=sales`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data || []);
      } else {
        console.error('Failed to fetch invoices:', response.status);
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        (inv.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (inv.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (inv.customer_gstin?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || inv.validation_status === statusFilter;
      const matchesType = typeFilter === 'all' || inv.invoice_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [invoices, searchTerm, statusFilter, typeFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, pageSize]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  const stats = {
    total: invoices.length,
    passed: invoices.filter(i => i.validation_status === 'passed').length,
    warning: invoices.filter(i => i.validation_status === 'warning').length,
    failed: invoices.filter(i => i.validation_status === 'failed').length,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <DashboardLayout title="Invoice Preview">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Passed</p>
                  <p className="text-2xl font-bold text-success">{stats.passed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-success/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-2xl font-bold text-warning">{stats.warning}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Invoice List</CardTitle>
            <CardDescription>
              Review and validate your uploaded invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, customer name, or GSTIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2CL">B2CL</SelectItem>
                  <SelectItem value="B2CS">B2CS</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {invoices.length === 0 
                    ? 'No invoices uploaded yet. Go to Upload page to get started.'
                    : 'No invoices match your filters.'}
                </p>
                {invoices.length === 0 && (
                  <Button className="mt-4" onClick={() => window.location.href = '/upload'}>
                    Upload Invoices
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((invoice) => {
                      const status = statusConfig[invoice.validation_status as keyof typeof statusConfig] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      const totalTax = invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount;

                      return (
                        <TableRow key={invoice.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </div>
                              </TooltipTrigger>
                              {invoice.validation_errors && invoice.validation_errors.length > 0 && (
                                <TooltipContent className="max-w-xs">
                                  <ul className="text-xs space-y-1">
                                    {invoice.validation_errors.map((err, idx) => (
                                      <li key={idx} className="flex items-start gap-1">
                                        <span className={err.severity === 'error' ? 'text-destructive' : 'text-warning'}>•</span>
                                        {err.message}
                                      </li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            {invoice.invoice_date 
                              ? format(new Date(invoice.invoice_date), 'dd MMM yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {invoice.customer_name || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {invoice.customer_gstin || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{invoice.invoice_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(invoice.taxable_value)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(totalTax)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(invoice.total_amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredInvoices.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
