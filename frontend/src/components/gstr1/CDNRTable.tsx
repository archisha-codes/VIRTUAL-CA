import { useState, useMemo } from 'react';
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
  Save,
  X,
  Download
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CDNRCustomer, CDNRNote } from '@/hooks/useGSTR1Data';

interface CDNRTableProps {
  data: CDNRCustomer[];
  onDataChange?: (data: CDNRCustomer[]) => void;
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
  onDelete 
}: { 
  customer: CDNRCustomer; 
  onUpdate: (customer: CDNRCustomer) => void;
  onDelete: (customerGstin: string) => void;
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
            <Badge variant="secondary">{customer.notes.length}</Badge>
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
                    <TableHead>Note No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">Note Value</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.notes.map((note, idx) => (
                    <EditableNoteRow 
                      key={idx} 
                      note={note}
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

// Editable note row component
function EditableNoteRow({ note }: { note: CDNRNote }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState(note);

  const handleSave = () => {
    console.log('Saving note:', editedNote);
    setIsEditing(false);
  };

  const inputClass = "h-7 text-xs w-24";

  if (isEditing) {
    return (
      <TableRow className="text-sm">
        <TableCell>
          <Input 
            value={editedNote.noteNumber} 
            onChange={(e) => setEditedNote({...editedNote, noteNumber: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="date"
            value={editedNote.noteDate?.split('T')[0] || ''} 
            onChange={(e) => setEditedNote({...editedNote, noteDate: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <select
            value={editedNote.noteType}
            onChange={(e) => setEditedNote({...editedNote, noteType: e.target.value as 'C' | 'D'})}
            className="h-7 w-20 text-xs rounded-md border"
          >
            <option value="C">Credit</option>
            <option value="D">Debit</option>
          </select>
        </TableCell>
        <TableCell>
          <Input 
            value={editedNote.placeOfSupply || ''} 
            onChange={(e) => setEditedNote({...editedNote, placeOfSupply: e.target.value})}
            className={inputClass}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedNote.taxableValue} 
            onChange={(e) => setEditedNote({...editedNote, taxableValue: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedNote.igst} 
            onChange={(e) => setEditedNote({...editedNote, igst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedNote.cgst} 
            onChange={(e) => setEditedNote({...editedNote, cgst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editedNote.sgst} 
            onChange={(e) => setEditedNote({...editedNote, sgst: parseFloat(e.target.value) || 0})}
            className={`${inputClass} text-right`}
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrency(editedNote.noteValue)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 justify-center">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handleSave}>
              <Save className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => setIsEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="text-sm">
      <TableCell className="font-medium">{note.noteNumber}</TableCell>
      <TableCell>{formatDate(note.noteDate)}</TableCell>
      <TableCell>
        <Badge variant={note.noteType === 'C' ? 'default' : 'destructive'} className="text-xs">
          {note.noteType === 'C' ? 'Credit' : 'Debit'}
        </Badge>
      </TableCell>
      <TableCell>{note.placeOfSupply || '-'}</TableCell>
      <TableCell className="text-right">{formatCurrency(note.taxableValue)}</TableCell>
      <TableCell className="text-right">{formatCurrency(note.igst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(note.cgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(note.sgst)}</TableCell>
      <TableCell className="text-right">{formatCurrency(note.noteValue)}</TableCell>
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

export function CDNRTable({ data, onDataChange }: CDNRTableProps) {
  const [filterGstin, setFilterGstin] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter data based on search
  const filteredData = useMemo(() => {
    return data.filter(customer => {
      const matchesGstin = !filterGstin || 
        customer.customerGstin.toLowerCase().includes(filterGstin.toLowerCase());
      const matchesName = !filterName || 
        customer.customerName.toLowerCase().includes(filterName.toLowerCase());
      const matchesType = !filterType || 
        customer.notes.some(n => n.noteType === filterType);
      return matchesGstin && matchesName && matchesType;
    });
  }, [data, filterGstin, filterName, filterType]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleUpdateCustomer = (updatedCustomer: CDNRCustomer) => {
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Customer GSTIN', 'Customer Name', 'Note No', 'Date', 'Type', 'Place of Supply', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Note Value'];
    const rows: string[][] = [];
    
    data.forEach(customer => {
      customer.notes.forEach(note => {
        rows.push([
          customer.customerGstin,
          customer.customerName,
          note.noteNumber,
          note.noteDate,
          note.noteType === 'C' ? 'Credit' : 'Debit',
          note.placeOfSupply || '',
          note.taxableValue.toString(),
          note.igst.toString(),
          note.cgst.toString(),
          note.sgst.toString(),
          note.noteValue.toString()
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
    link.download = `cdnr_notes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Credit/Debit Notes Found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          CDN/R includes credit and debit notes issued to registered persons.
          Upload invoices with type 'Credit Note' or 'Debit Note' to see data here.
        </p>
      </div>
    );
  }

  const totalNotes = data.reduce((sum, cust) => sum + cust.notes.length, 0);
  const totalTaxableValue = data.reduce((sum, cust) => sum + cust.totalTaxableValue, 0);
  const totalTax = data.reduce((sum, cust) => sum + cust.totalTax, 0);
  const creditNotes = data.reduce((sum, cust) => sum + cust.notes.filter(n => n.noteType === 'C').length, 0);
  const debitNotes = totalNotes - creditNotes;

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
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700"
        >
          <option value="">All Types</option>
          <option value="C">Credit Notes</option>
          <option value="D">Debit Notes</option>
        </select>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Unique Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalNotes}</div>
            <p className="text-xs text-muted-foreground">Total Notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{creditNotes} / {debitNotes}</div>
            <p className="text-xs text-muted-foreground">Credit / Debit</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CDN/R - 9B Credit/Debit Notes (Registered)</CardTitle>
          <CardDescription>
            Credit and debit notes issued to registered persons
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
                  <TableHead className="text-center">Notes</TableHead>
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
