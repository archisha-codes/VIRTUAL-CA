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
  MapPin, 
  IndianRupee, 
  TrendingUp,
  Search,
  Edit3,
  Trash2,
  Save,
  X,
  Download
} from 'lucide-react';
import type { B2CLInvoice } from '@/hooks/useGSTR1Data';
import { format } from 'date-fns';

interface B2CLTableProps {
  data: B2CLInvoice[];
  onDataChange?: (data: B2CLInvoice[]) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy');
  } catch {
    return dateString;
  }
}

export function B2CLTable({ data, onDataChange }: B2CLTableProps) {
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterState, setFilterState] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<B2CLInvoice | null>(null);

  // Filter data based on search
  const filteredData = data.filter(invoice => {
    const matchesInvoice = !filterInvoice || 
      invoice.invoiceNumber?.toLowerCase().includes(filterInvoice.toLowerCase());
    const matchesState = !filterState || 
      invoice.placeOfSupply?.toLowerCase().includes(filterState.toLowerCase());
    return matchesInvoice && matchesState;
  });

  const handleEdit = (invoice: B2CLInvoice, index: number) => {
    setEditingRow(index);
    setEditedData({ ...invoice });
  };

  const handleSave = (originalIndex: number) => {
    if (editedData && onDataChange) {
      const newData = [...data];
      const originalDataIndex = data.findIndex((inv, i) => 
        inv.invoiceNumber === filteredData[originalIndex]?.invoiceNumber && i === filteredData.indexOf(filteredData[originalIndex])
      );
      if (originalDataIndex >= 0) {
        newData[originalDataIndex] = editedData;
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

  const handleDelete = (index: number) => {
    if (onDataChange) {
      const newData = [...data];
      const originalDataIndex = data.findIndex((inv, i) => 
        inv.invoiceNumber === filteredData[index]?.invoiceNumber && i === filteredData.indexOf(filteredData[index])
      );
      if (originalDataIndex >= 0) {
        newData.splice(originalDataIndex, 1);
        onDataChange(newData);
      }
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Place of Supply', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Taxable Value', 'Rate', 'IGST', 'Cess'];
    const rows = data.map(inv => [
      inv.placeOfSupply || '',
      inv.invoiceNumber || '',
      inv.invoiceDate || '',
      inv.invoiceValue.toString(),
      inv.taxableValue.toString(),
      inv.rate.toString(),
      inv.igst.toString(),
      inv.cess.toString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `b2cl_invoices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No B2CL Invoices Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            B2CL includes inter-state sales to unregistered persons where invoice value exceeds ₹2.5 lakh.
            Upload invoices matching these criteria to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by place of supply for summary
  const posSummary = data.reduce((acc, inv) => {
    const pos = inv.placeOfSupply || 'Unknown';
    if (!acc[pos]) {
      acc[pos] = { count: 0, taxableValue: 0, igst: 0 };
    }
    acc[pos].count++;
    acc[pos].taxableValue += inv.taxableValue;
    acc[pos].igst += inv.igst;
    return acc;
  }, {} as Record<string, { count: number; taxableValue: number; igst: number }>);

  const totalTaxableValue = data.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalIGST = data.reduce((sum, inv) => sum + inv.igst, 0);
  const uniqueStates = Object.keys(posSummary).length;

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
            placeholder="Filter by State..."
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
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
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">States Covered</span>
            </div>
            <p className="text-2xl font-bold mt-1">{uniqueStates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Taxable Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalTaxableValue)}</p>
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

      {/* B2CL Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">B2CL - Large B2C Invoices ({'>'} ₹2.5 Lakh)</CardTitle>
          <CardDescription>
            Inter-state sales to unregistered persons where invoice value exceeds ₹2,50,000
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Place of Supply</TableHead>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead className="text-right">Invoice Value</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Cess</TableHead>
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
                            value={editedData.placeOfSupply || ''} 
                            onChange={(e) => setEditedData({...editedData, placeOfSupply: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
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
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.cess} 
                            onChange={(e) => setEditedData({...editedData, cess: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
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
                        <TableCell>
                          <Badge variant="outline">{invoice.placeOfSupply || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.invoiceValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.taxableValue)}</TableCell>
                        <TableCell className="text-right">{invoice.rate}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.igst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.cess)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(invoice, index)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDelete(index)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={4} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalTaxableValue)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totalIGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.reduce((sum, inv) => sum + inv.cess, 0))}</TableCell>
                  <TableCell></TableCell>
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
