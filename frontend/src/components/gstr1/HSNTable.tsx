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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablePagination } from '@/components/invoices/TablePagination';
import { 
  FileText, 
  Hash, 
  IndianRupee, 
  TrendingUp,
  Search,
  Edit3,
  Save,
  X,
  Download
} from 'lucide-react';
import type { HSNSummary } from '@/hooks/useGSTR1Data';

// Common HSN codes for dropdown
const COMMON_HSN_CODES = [
  '0101', '0102', '0103', '0104', '0105', '0106', // Live animals
  '0201', '0202', '0203', '0204', '0205', '0206', // Meat
  '0301', '0302', '0303', '0304', '0305', // Fish
  '0401', '0402', '0403', '0404', '0405', '0406', // Dairy
  '0901', '0902', '0903', '0904', '0905', '0906', '0907', '0908', '0909', '0910', // Coffee, Tea, Spices
  '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', // Cereals
  '1701', '1702', '1703', '1704', // Sugar
  '1901', '1902', '1903', '1904', '1905', // Preparations of cereals
  '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', // Preparations of vegetables
  '2101', '2102', '2103', '2104', '2105', '2106', // Food preparations
  '2201', '2202', '2203', '2204', '2205', '2206', '2207', '2208', '2209', // Beverages
  '2401', '2402', '2403', // Tobacco
  '3001', '3002', '3003', '3004', '3005', '3006', // Pharmaceuticals
  '3301', '3302', '3303', '3304', '3305', '3306', '3307', // Perfumery
  '3401', '3402', '3403', '3404', '3405', '3406', '3407', // Soap, waxes
  '4201', '4202', '4203', // Leather articles
  '4401', '4402', '4403', '4404', '4405', '4406', '4407', '4408', '4409', // Wood
  '4801', '4802', '4803', '4804', '4805', '4806', '4807', '4808', '4809', '4810', '4811', '4812', '4813', // Paper
  '5201', '5202', '5203', '5204', '5205', '5206', '5207', '5208', '5209', '5210', '5211', '5212', // Cotton
  '6101', '6102', '6103', '6104', '6105', '6106', '6107', '6108', '6109', '6110', '6111', '6112', // Knitted garments
  '6201', '6202', '6203', '6204', '6205', '6206', '6207', '6208', '6209', '6210', '6211', '6212', '6213', '6214', '6215', '6216', '6217', // Woven garments
  '6301', '6302', '6303', '6304', '6305', '6306', '6307', '6308', '6309', '6310', // Made-up articles
  '6401', '6402', '6403', '6404', '6405', '6406', // Footwear
  '6901', '6902', '6903', '6904', '6905', '6906', '6907', '6908', '6909', '6910', '6911', '6912', '6913', '6914', // Ceramics
  '7001', '7002', '7003', '7004', '7005', '7006', '7007', '7008', '7009', '7010', '7011', '7012', '7013', '7014', '7015', '7016', '7017', '7018', '7019', '7020', // Glass
  '7101', '7102', '7103', '7112', '7113', '7114', '7115', '7116', '7117', '7118', // Precious stones
  '7201', '7202', '7203', '7204', '7205', '7206', '7207', '7208', '7209', '7210', '7211', '7212', '7213', '7214', '7215', '7216', '7217', '7218', '7219', '7220', '7221', '7222', '7223', '7224', '7225', '7226', '7227', '7228', '7229', // Iron and steel
  '7301', '7302', '7303', '7304', '7305', '7306', '7307', '7308', '7309', '7310', '7311', '7312', '7313', '7314', '7315', '7316', '7317', '7318', '7319', '7320', '7321', '7322', '7323', '7324', '7325', '7326', // Articles of iron or steel
  '8401', '8402', '8403', '8404', '8405', '8406', '8407', '8408', '8409', '8410', '8411', '8412', '8413', '8414', '8415', '8416', '8417', '8418', '8419', '8420', '8421', '8422', '8423', '8424', '8425', '8426', '8427', '8428', '8429', '8430', '8431', '8432', '8433', '8434', '8435', '8436', '8437', '8438', '8439', '8440', '8441', '8442', '8443', '8444', '8445', '8446', '8447', '8448', '8449', '8450', '8451', '8452', '8453', '8454', '8455', '8456', '8457', '8458', '8459', '8460', '8461', '8462', '8463', '8464', '8465', '8466', '8467', '8468', '8469', '8470', '8471', '8472', '8473', '8474', '8475', '8476', '8477', '8478', '8479', '8480', '8481', '8482', '8483', '8484', '8485', '8486', '8487', // Machinery
  '8501', '8502', '8503', '8504', '8505', '8506', '8507', '8508', '8509', '8510', '8511', '8512', '8513', '8514', '8515', '8516', '8517', '8518', '8519', '8520', '8521', '8522', '8523', '8524', '8525', '8526', '8527', '8528', '8529', '8530', '8531', '8532', '8533', '8534', '8535', '8536', '8537', '8538', '8539', '8540', '8541', '8542', '8543', '8544', '8545', '8546', '8547', '8548', // Electrical machinery
  '8701', '8702', '8703', '8704', '8705', '8706', '8707', '8708', '8709', '8710', '8711', '8712', '8713', '8714', '8715', '8716', // Vehicles
  '9001', '9002', '9003', '9004', '9005', '9006', '9007', '9008', '9009', '9010', '9011', '9012', '9013', '9014', '9015', '9016', '9017', '9018', '9019', '9020', '9021', '9022', '9023', '9024', '9025', '9026', '9027', '9028', '9029', '9030', '9031', '9032', '9033', // Optical instruments
  '9401', '9402', '9403', '9404', '9405', '9406', // Furniture
  '9501', '9502', '9503', '9504', '9505', '9506', '9507', '9508', // Toys
  '9601', '9602', '9603', '9604', '9605', '9606', '9607', '9608', // Miscellaneous manufactured articles
];

interface HSNTableProps {
  data: HSNSummary[];
  onDataChange?: (data: HSNSummary[]) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function HSNTable({ data, onDataChange }: HSNTableProps) {
  const [filterHsn, setFilterHsn] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<HSNSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter data based on search
  const filteredData = useMemo(() => {
    return data.filter(hsn => 
      !filterHsn || hsn.hsnCode.toLowerCase().includes(filterHsn.toLowerCase())
    );
  }, [data, filterHsn]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleEdit = (hsn: HSNSummary) => {
    setEditingRow(hsn.hsnCode);
    setEditedData({ ...hsn });
  };

  const handleSave = () => {
    if (editedData && onDataChange) {
      const newData = data.map(h => 
        h.hsnCode === editedData.hsnCode ? editedData : h
      );
      onDataChange(newData);
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
    const headers = ['HSN/SAC', 'Description', 'UQC', 'Quantity', 'Total Value', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'];
    const rows = data.map(hsn => [
      hsn.hsnCode,
      hsn.description || '',
      hsn.uqc,
      hsn.totalQuantity.toString(),
      hsn.totalValue.toString(),
      hsn.taxableValue.toString(),
      hsn.igst.toString(),
      hsn.cgst.toString(),
      hsn.sgst.toString(),
      hsn.cess.toString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hsn_summary_${new Date().toISOString().split('T')[0]}.csv`;
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
          <h3 className="text-lg font-medium mb-2">No HSN Data Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            HSN summary is generated from validated invoices that have HSN codes.
            Upload invoices with HSN codes to see the summary here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalQuantity = data.reduce((sum, h) => sum + h.totalQuantity, 0);
  const totalValue = data.reduce((sum, h) => sum + h.totalValue, 0);
  const totalTaxableValue = data.reduce((sum, h) => sum + h.taxableValue, 0);
  const totalIGST = data.reduce((sum, h) => sum + h.igst, 0);
  const totalCGST = data.reduce((sum, h) => sum + h.cgst, 0);
  const totalSGST = data.reduce((sum, h) => sum + h.sgst, 0);
  const totalCess = data.reduce((sum, h) => sum + h.cess, 0);
  const totalTax = totalIGST + totalCGST + totalSGST + totalCess;

  const inputClass = "h-8 w-full text-sm";

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by HSN Code..."
            value={filterHsn}
            onChange={(e) => setFilterHsn(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">
          Showing {filteredData.length} of {data.length} HSN codes
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
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Unique HSN Codes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Quantity</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalQuantity.toLocaleString('en-IN')}</p>
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

      {/* HSN Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">HSN-wise Summary of Outward Supplies</CardTitle>
          <CardDescription>
            Consolidated HSN/SAC-wise summary of all validated sales invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UQC</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Cess</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((hsn) => (
                  <TableRow key={hsn.hsnCode}>
                    {editingRow === hsn.hsnCode && editedData ? (
                      <>
                        <TableCell>
                          <Select 
                            value={editedData.hsnCode} 
                            onValueChange={(value) => setEditedData({...editedData, hsnCode: value})}
                          >
                            <SelectTrigger className={inputClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_HSN_CODES.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={editedData.description || ''} 
                            onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={editedData.uqc} 
                            onChange={(e) => setEditedData({...editedData, uqc: e.target.value})}
                            className={inputClass}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={editedData.totalQuantity} 
                            onChange={(e) => setEditedData({...editedData, totalQuantity: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(editedData.totalValue)}
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
                            value={editedData.igst} 
                            onChange={(e) => setEditedData({...editedData, igst: parseFloat(e.target.value) || 0})}
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
                            value={editedData.cess} 
                            onChange={(e) => setEditedData({...editedData, cess: parseFloat(e.target.value) || 0})}
                            className={`${inputClass} text-right`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={handleSave}>
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
                          <Badge variant="outline" className="font-mono">
                            {hsn.hsnCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {hsn.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{hsn.uqc}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{hsn.totalQuantity.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.totalValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.taxableValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.igst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.cgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.sgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsn.cess)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(hsn)}>
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
                  <TableCell className="text-right">{totalQuantity.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalTaxableValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalIGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalSGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCess)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No HSN codes match the filter criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
