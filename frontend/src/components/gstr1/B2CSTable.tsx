import { useState, useMemo } from 'react';
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
import { TablePagination } from '@/components/invoices/TablePagination';
import { 
  FileText, 
  MapPin, 
  IndianRupee, 
  TrendingUp,
  Search,
  Edit3,
  Save,
  X,
  Download
} from 'lucide-react';
import type { B2CSSummary } from '@/hooks/useGSTR1Data';

interface B2CSTableProps {
  data: B2CSSummary[];
  onDataChange?: (data: B2CSSummary[]) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function B2CSTable({ data, onDataChange }: B2CSTableProps) {
  const [filterState, setFilterState] = useState('');
  const [filterSupplyType, setFilterSupplyType] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<B2CSSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter data based on search
  const filteredData = useMemo(() => {
    return data.filter(record => {
      const matchesState = !filterState || 
        record.placeOfSupply?.toLowerCase().includes(filterState.toLowerCase());
      const matchesType = !filterSupplyType || 
        record.supplyType === filterSupplyType;
      return matchesState && matchesType;
    });
  }, [data, filterState, filterSupplyType]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  // Separate intra and inter state records
  const intraStateRecords = data.filter((r) => r.supplyType === 'INTRA');
  const interStateRecords = data.filter((r) => r.supplyType === 'INTER');

  const totalTaxableValue = data.reduce((sum, r) => sum + r.taxableValue, 0);
  const totalCGST = data.reduce((sum, r) => sum + r.cgst, 0);
  const totalSGST = data.reduce((sum, r) => sum + r.sgst, 0);
  const totalIGST = data.reduce((sum, r) => sum + r.igst, 0);
  const totalTax = totalCGST + totalSGST + totalIGST;

  const handleEdit = (record: B2CSSummary, index: number) => {
    setEditingRow(index);
    setEditedData({ ...record });
  };

  const handleSave = (originalIndex: number) => {
    if (editedData && onDataChange) {
      const newData = [...data];
      // Find the original index in the full data array
      const fullIndex = data.findIndex((r, i) => 
        r.placeOfSupply === filteredData[originalIndex]?.placeOfSupply &&
        r.supplyType === filteredData[originalIndex]?.supplyType &&
        r.rate === filteredData[originalIndex]?.rate &&
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Place of Supply', 'Supply Type', 'Rate', 'Taxable Value', 'CGST', 'SGST/UTGST', 'IGST', 'Cess'];
    const rows = data.map(rec => [
      rec.placeOfSupply || '',
      rec.supplyType,
      rec.rate.toString(),
      rec.taxableValue.toString(),
      rec.cgst.toString(),
      rec.sgst.toString(),
      rec.igst.toString(),
      rec.cess.toString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `b2cs_summary_${new Date().toISOString().split('T')[0]}.csv`;
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
          <h3 className="text-lg font-medium mb-2">No B2CS Records Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            B2CS includes sales to unregistered persons where invoice value is ₹2.5 lakh or less,
            or intra-state sales. Upload invoices matching these criteria to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const inputClass = "h-8 w-full text-sm";

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by State..."
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterSupplyType}
          onChange={(e) => setFilterSupplyType(e.target.value)}
          className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700"
        >
          <option value="">All Types</option>
          <option value="INTRA">Intra State</option>
          <option value="INTER">Inter State</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">
          Showing {filteredData.length} of {data.length} records
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Records</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data.length}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Intra: {intraStateRecords.length}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Inter: {interStateRecords.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">States Covered</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {new Set(data.map((r) => r.placeOfSupply)).size}
            </p>
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
              <span className="text-sm text-muted-foreground">Total Tax</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      {/* B2CS Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">B2CS - Small B2C Summary (State-wise)</CardTitle>
          <CardDescription>
            Consolidated summary of sales to unregistered persons (≤ ₹2.5 lakh or intra-state), grouped by state and tax rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Place of Supply</TableHead>
                  <TableHead>Supply Type</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST/UTGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Cess</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((record, index) => (
                  <TableRow key={`${record.placeOfSupply}-${record.supplyType}-${record.rate}-${index}`}>
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
                          <select
                            value={editedData.supplyType}
                            onChange={(e) => setEditedData({...editedData, supplyType: e.target.value as 'INTRA' | 'INTER'})}
                            className="h-8 w-full text-sm rounded-md border"
                          >
                            <option value="INTRA">INTRA</option>
                            <option value="INTER">INTER</option>
                          </select>
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
                            value={editedData.taxableValue} 
                            onChange={(e) => setEditedData({...editedData, taxableValue: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.cgst} 
                            onChange={(e) => setEditedData({...editedData, cgst: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.sgst} 
                            onChange={(e) => setEditedData({...editedData, sgst: parseFloat(e.target.value) || 0})}
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
                          <Badge variant="outline">{record.placeOfSupply}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.supplyType === 'INTRA' ? 'secondary' : 'default'}>
                            {record.supplyType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{record.rate}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.taxableValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.cgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.sgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.igst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.cess)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(record, index)}>
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
                  <TableCell className="text-right">{formatCurrency(totalTaxableValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalSGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalIGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.reduce((sum, r) => sum + r.cess, 0))}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No records match the filter criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
