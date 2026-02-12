import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TablePagination } from '@/components/invoices/TablePagination';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, AlertTriangle, XCircle, Search, Loader2, Info, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  supplier_name: string | null;
  supplier_gstin: string | null;
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

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .eq('invoice_category', 'purchase')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const typedInvoices = data.map(inv => ({
        ...inv,
        taxable_value: inv.taxable_value ?? 0,
        cgst_amount: inv.cgst_amount ?? 0,
        sgst_amount: inv.sgst_amount ?? 0,
        igst_amount: inv.igst_amount ?? 0,
        total_amount: inv.total_amount ?? 0,
        invoice_type: inv.invoice_type ?? 'B2B',
        validation_status: inv.validation_status ?? 'pending',
        validation_errors: (inv.validation_errors as unknown as PurchaseInvoice['validation_errors']) || [],
      }));
      setInvoices(typedInvoices);
    }
    setLoading(false);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.supplier_gstin?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || inv.validation_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, pageSize]);

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

  const totals = {
    taxable: invoices.reduce((sum, inv) => sum + inv.taxable_value, 0),
    igst: invoices.reduce((sum, inv) => sum + inv.igst_amount, 0),
    cgst: invoices.reduce((sum, inv) => sum + inv.cgst_amount, 0),
    sgst: invoices.reduce((sum, inv) => sum + inv.sgst_amount, 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <DashboardLayout title="Purchase Invoices">
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
                <ShoppingCart className="h-8 w-8 text-primary/20" />
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

        {/* ITC Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Taxable Value</p>
              <p className="text-xl font-bold">{formatCurrency(totals.taxable)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total IGST (ITC)</p>
              <p className="text-xl font-bold">{formatCurrency(totals.igst)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total CGST (ITC)</p>
              <p className="text-xl font-bold">{formatCurrency(totals.cgst)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total SGST (ITC)</p>
              <p className="text-xl font-bold">{formatCurrency(totals.sgst)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Purchase Invoice List</CardTitle>
            <CardDescription>
              Review your uploaded purchase invoices for ITC claims
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, supplier name, or GSTIN..."
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
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {invoices.length === 0 
                    ? 'No purchase invoices uploaded yet. Go to Upload page to get started.'
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
                      <TableHead>Supplier</TableHead>
                      <TableHead>Supplier GSTIN</TableHead>
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
                              {invoice.validation_errors.length > 0 && (
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
                            {invoice.supplier_name || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {invoice.supplier_gstin || '-'}
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
