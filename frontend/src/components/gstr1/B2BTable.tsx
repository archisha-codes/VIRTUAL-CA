import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/invoices/TablePagination';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Edit3, 
  Trash2, 
  Search,
  Filter,
  Save,
  X,
  Download,
  Loader2
} from 'lucide-react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import type { B2BCustomer, B2BInvoice } from '@/hooks/useGSTR1Data';

interface B2BTableProps {
  data: B2BCustomer[];
  onDataChange?: (data: B2BCustomer[]) => void;
  onInvoiceUpdate?: (invoice: B2BInvoice, customerGstin: string) => void; // Phase E3: Optimistic UI callback
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Editable customer row component
function EditableCustomerRow({ 
  customer, 
  onUpdate,
  onDelete,
  onInvoiceUpdate // Phase E3: Pass through for optimistic UI
}: { 
  customer: B2BCustomer; 
  onUpdate: (customer: B2BCustomer) => void;
  onDelete: (customerGstin: string) => void;
  onInvoiceUpdate?: (invoice: B2BInvoice, customerGstin: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState(customer.customerName);
  const [customerGstin, setCustomerGstin] = useState(customer.customerGstin);

  const handleSaveCustomer = () => {
    onUpdate({
      ...customer,
      customerName,
      customerGstin
    });
    setEditingCustomer(false);
  };

  const handleCancelEdit = () => {
    setCustomerName(customer.customerName);
    setCustomerGstin(customer.customerGstin);
    setEditingCustomer(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </TableCell>
          {editingCustomer ? (
            <>
              <TableCell>
                <Input 
                  value={customerGstin} 
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  className="h-8 w-40 font-mono"
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell>
                <Input 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 w-48"
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </>
          ) : (
            <>
              <TableCell className="font-mono text-sm">{customer.customerGstin}</TableCell>
              <TableCell>{customer.customerName}</TableCell>
            </>
          )}
          <TableCell className="text-center">
            <Badge variant="secondary">{customer.invoices.length}</Badge>
          </TableCell>
          <TableCell className="text-right">{formatCurrency(customer.totalTaxableValue)}</TableCell>
          <TableCell className="text-right">{formatCurrency(customer.totalTax)}</TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {editingCustomer ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveCustomer();
                    }}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEdit();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(true);
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(customer.customerGstin);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <div className="bg-muted/30 p-4">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">Invoice Value</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.invoices.map((invoice, idx) => (
                    <EditableInvoiceRow 
                      key={idx} 
                      invoice={invoice} 
                      customerGstin={customer.customerGstin}
                      onInvoiceUpdate={onInvoiceUpdate}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Editable invoice row component with optimistic UI
function EditableInvoiceRow({ 
  invoice, 
  customerGstin,
  onInvoiceUpdate // Phase E3: Callback for optimistic UI
}: { 
  invoice: B2BInvoice;
  customerGstin: string;
  onInvoiceUpdate?: (invoice: B2BInvoice, customerGstin: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);
  const [isSaving, setIsSaving] = useState(false);

  // Sync editedInvoice when invoice prop changes
  useEffect(() => {
    setEditedInvoice(invoice);
  }, [invoice]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Phase E3: Optimistic UI - update state immediately
      onInvoiceUpdate?.(editedInvoice, customerGstin);
      
      // Simulate async persistence (in real app, this would be an API call)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In a real app, you would call an API here:
      // await apiUpdateInvoice(editedInvoice);
      
      console.log('Invoice saved successfully:', editedInvoice);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save invoice:', error);
      // Phase E3: Rollback on failure - restore original value
      setEditedInvoice(invoice);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "h-7 text-xs w-24";

  if (isEditing) {
    return (
      <TableRow className="text-sm">
        <TableCell>
          <Input 
            value={editedInvoice.invoiceNumber} 
            onChange={(e) => setEditedInvoice({...editedInvoice, invoiceNumber: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="date"
            value={editedInvoice.invoiceDate?.split('T')[0] || ''} 
            onChange={(e) => setEditedInvoice({...editedInvoice, invoiceDate: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <Input 
            value={editedInvoice.placeOfSupply || ''} 
            onChange={(e) => setEditedInvoice({...editedInvoice, placeOfSupply: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedInvoice.taxableValue} 
            onChange={(e) => setEditedInvoice({...editedInvoice, taxableValue: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedInvoice.igst} 
            onChange={(e) => setEditedInvoice({...editedInvoice, igst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedInvoice.cgst} 
            onChange={(e) => setEditedInvoice({...editedInvoice, cgst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedInvoice.sgst} 
            onChange={(e) => setEditedInvoice({...editedInvoice, sgst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrency(editedInvoice.invoiceValue)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 justify-center">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => setIsEditing(false)} disabled={isSaving}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="text-sm">
      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
      <TableCell>{invoice.placeOfSupply || '-'}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.taxableValue)}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.igst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.cgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.sgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.invoiceValue)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 justify-center">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditing(true)}>
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function B2BTable({ data, onDataChange, onInvoiceUpdate }: B2BTableProps) {
  const [filterGstin, setFilterGstin] = useState('');
  const [filterName, setFilterName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter data based on search
  const filteredData = useMemo(() => {
    return data.filter(customer => {
      const matchesGstin = !filterGstin || 
        customer.customerGstin.toLowerCase().includes(filterGstin.toLowerCase());
      const matchesName = !filterName || 
        customer.customerName.toLowerCase().includes(filterName.toLowerCase());
      return matchesGstin && matchesName;
    });
  }, [data, filterGstin, filterName]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleUpdateCustomer = (updatedCustomer: B2BCustomer) => {
    if (onDataChange) {
      const newData = data.map(c => 
        c.customerGstin === updatedCustomer.customerGstin ? updatedCustomer : c
      );
      onDataChange(newData);
    }
  };

  const handleDeleteCustomer = (customerGstin: string) => {
    if (onDataChange) {
      const newData = data.filter(c => c.customerGstin !== customerGstin);
      onDataChange(newData);
    }
  };

  // Phase E3: Handler for optimistic invoice updates
  const handleInvoiceUpdate = (updatedInvoice: B2BInvoice, customerGstin: string) => {
    if (onDataChange) {
      // Optimistically update the data immediately
      const newData = data.map(customer => {
        if (customer.customerGstin === customerGstin) {
          return {
            ...customer,
            invoices: customer.invoices.map(inv => 
              inv.invoiceNumber === updatedInvoice.invoiceNumber ? updatedInvoice : inv
            )
          };
        }
        return customer;
      });
      onDataChange(newData);
    }
    // Also call the external callback for async persistence
    onInvoiceUpdate?.(updatedInvoice, customerGstin);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Customer GSTIN', 'Customer Name', 'Invoice No', 'Date', 'Place of Supply', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Invoice Value'];
    const rows: string[][] = [];
    
    data.forEach(customer => {
      customer.invoices.forEach(inv => {
        rows.push([
          customer.customerGstin,
          customer.customerName,
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.placeOfSupply || '',
          inv.taxableValue.toString(),
          inv.igst.toString(),
          inv.cgst.toString(),
          inv.sgst.toString(),
          inv.invoiceValue.toString()
        ]);
      });
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `b2b_invoices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No B2B Invoices Found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          B2B invoices are sales to registered businesses (with valid GSTIN). 
          Upload invoices with customer GSTIN to see data here.
        </p>
      </div>
    );
  }

  const totalInvoices = data.reduce((sum, cust) => sum + cust.invoices.length, 0);
  const totalTaxableValue = data.reduce((sum, cust) => sum + cust.totalTaxableValue, 0);
  const totalTax = data.reduce((sum, cust) => sum + cust.totalTax, 0);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by GSTIN..."
            value={filterGstin}
            onChange={(e) => setFilterGstin(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by Customer Name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button 
          variant={showFilters ? "default" : "outline"} 
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">
          Showing {filteredData.length} of {data.length} customers
        </div>
      </div>

      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredData.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Unique Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Total Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalTaxableValue)}</div>
            <p className="text-xs text-muted-foreground">Taxable Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalTax)}</div>
            <p className="text-xs text-muted-foreground">Total Tax</p>
          </CardContent>
        </Card>
      </div>

      {/* B2B Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B2B Invoices - 4A, 4B, 6B, 6C</CardTitle>
          <CardDescription>
            Taxable outward supplies to registered persons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Customer GSTIN</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((customer) => (
                  <EditableCustomerRow 
                    key={customer.customerGstin} 
                    customer={customer}
                    onUpdate={handleUpdateCustomer}
                    onDelete={handleDeleteCustomer}
                    onInvoiceUpdate={handleInvoiceUpdate}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No customers match the filter criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
