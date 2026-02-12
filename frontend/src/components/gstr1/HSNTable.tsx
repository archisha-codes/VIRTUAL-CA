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
import { FileText, Hash, IndianRupee, TrendingUp } from 'lucide-react';
import type { HSNSummary } from '@/hooks/useGSTR1Data';

interface HSNTableProps {
  data: HSNSummary[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function HSNTable({ data }: HSNTableProps) {
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

  return (
    <div className="space-y-4">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((hsn) => (
                  <TableRow key={hsn.hsnCode}>
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
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
