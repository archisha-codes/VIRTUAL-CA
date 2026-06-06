import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Globe, 
  IndianRupee, 
  TrendingUp,
  Search,
  Edit3,
  Save,
  X,
  Download
} from 'lucide-react';
import type { ExportInvoice } from '@/lib/gstr-transform';

interface ExportsTableProps {
  data: ExportInvoice[];
  onDataChange?: (data: ExportInvoice[]) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// Export CSV function
function exportToCSV(data: ExportInvoice[], filename: string) {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Invoice Value',
    'Place of Supply',
    'Taxable Value',
    'IGST',
    'Rate (%)',
    'Shipping Bill No',
    'Shipping Bill Date',
    'Port Code'
  ];
  
  const rows = data.map(inv => [
    inv.invoiceNumber,
    inv.invoiceDate,
    inv.invoiceValue,
    inv.placeOfSupply,
    inv.taxableValue,
    inv.igst,
    inv.rate,
    inv.shippingBill?.billNo || '',
    inv.shippingBill?.billDate || '',
    inv.shippingBill?.portCode || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportsTable({ data, onDataChange }: ExportsTableProps) {
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterState, setFilterState] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<ExportInvoice | null>(null);

  // Filter data based on search
  const filteredData = data.filter(invoice => {
    const matchesInvoice = !filterInvoice || 
      invoice.invoiceNumber?.toLowerCase().includes(filterInvoice.toLowerCase());
    const matchesState = !filterState || 
      invoice.placeOfSupply?.toLowerCase().includes(filterState.toLowerCase());
    return matchesInvoice && matchesState;
  });

  const handleEdit = (invoice: ExportInvoice, index: number) => {
    setEditingRow(index);
    setEditedData({ ...invoice });
  };

  const handleSave = (originalIndex: number) => {
    if (editedData && onDataChange) {
      const newData = [...data];
      const fullIndex = data.findIndex((inv, i) => 
        inv.invoiceNumber === filteredData[originalIndex]?.invoiceNumber && 
        i === filteredData.indexOf(filteredData[originalIndex])
      );
      if (fullIndex >= 0) {
        newData[fullIndex] = editedData;
        onDataChange(newData);
      }
    }
    setEditingRow(null);
    setEditedData(null);
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditedData(null);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Globe className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Export Invoices Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Exports include outward supplies to overseas customers (with or without payment).
            Upload export invoices to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalInvoiceValue = data.reduce((sum, inv) => sum + inv.invoiceValue, 0);
  const totalTaxableValue = data.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalIGST = data.reduce((sum, inv) => sum + inv.igst, 0);
  const exportsWithShipping = data.filter(inv => inv.shippingBill?.billNo).length;

  const inputClass = "h-8 w-full text-sm";

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by Invoice Number..."
            value={filterInvoice}
            onChange={(e) => setFilterInvoice(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by Place of Supply..."
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => exportToCSV(data, 'exports')}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">
          Showing {filteredData.length} of {data.length} invoices
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Invoices</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">With Shipping Bill</span>
            </div>
            <p className="text-2xl font-bold mt-1">{exportsWithShipping}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Invoice Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalInvoiceValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total IGST</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalIGST)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Exports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Invoices - 6A</CardTitle>
          <CardDescription>
            Exports of goods and/or services (with or without payment)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Place of Supply</TableHead>
                  <TableHead className="text-right">Invoice Value</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead>Shipping Bill No</TableHead>
                  <TableHead>Shipping Bill Date</TableHead>
                  <TableHead>Port Code</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((invoice, index) => (
                  <TableRow key={`${invoice.invoiceNumber}-${index}`}>
                    {editingRow === index && editedData ? (
                      <>
                        <TableCell>
                          <Input 
                            value={editedData.invoiceNumber || ''} 
                            onChange={(e) => setEditedData({...editedData, invoiceNumber: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date"
                            value={editedData.invoiceDate?.split('T')[0] || ''} 
                            onChange={(e) => setEditedData({...editedData, invoiceDate: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={editedData.placeOfSupply || ''} 
                            onChange={(e) => setEditedData({...editedData, placeOfSupply: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.invoiceValue} 
                            onChange={(e) => setEditedData({...editedData, invoiceValue: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.taxableValue} 
                            onChange={(e) => setEditedData({...editedData, taxableValue: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.rate} 
                            onChange={(e) => setEditedData({...editedData, rate: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.igst} 
                            onChange={(e) => setEditedData({...editedData, igst: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell colSpan={3}>
                          <div className="flex gap-2">
                            <Input 
                              value={editedData.shippingBill?.billNo || ''} 
                              onChange={(e) => setEditedData({
                                ...editedData, 
                                shippingBill: {...editedData.shippingBill, billNo: e.target.value}
                              })}
                              placeholder="Bill No"
                              className="h-8 text-sm"
                            />
                            <Input 
                              value={editedData.shippingBill?.portCode || ''} 
                              onChange={(e) => setEditedData({
                                ...editedData, 
                                shippingBill: {...editedData.shippingBill, portCode: e.target.value}
                              })}
                              placeholder="Port Code"
                              className="h-8 text-sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => handleSave(index)}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={handleCancel}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.placeOfSupply || 'Overseas'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.invoiceValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.taxableValue)}</TableCell>
                        <TableCell className="text-right">{invoice.rate}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.igst)}</TableCell>
                        <TableCell>{invoice.shippingBill?.billNo || '-'}</TableCell>
                        <TableCell>{invoice.shippingBill?.billDate ? formatDate(invoice.shippingBill.billDate) : '-'}</TableCell>
                        <TableCell>{invoice.shippingBill?.portCode || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(invoice, index)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalInvoiceValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalTaxableValue)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totalIGST)}</TableCell>
                  <TableCell colSpan={4}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No invoices match the filter criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
