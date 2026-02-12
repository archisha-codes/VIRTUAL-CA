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
import { FileText, MapPin, IndianRupee, TrendingUp } from 'lucide-react';
import type { B2CSSummary } from '@/hooks/useGSTR1Data';

interface B2CSTableProps {
  data: B2CSSummary[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function B2CSTable({ data }: B2CSTableProps) {
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

  // Separate intra and inter state records
  const intraStateRecords = data.filter((r) => r.supplyType === 'INTRA');
  const interStateRecords = data.filter((r) => r.supplyType === 'INTER');

  const totalTaxableValue = data.reduce((sum, r) => sum + r.taxableValue, 0);
  const totalCGST = data.reduce((sum, r) => sum + r.cgst, 0);
  const totalSGST = data.reduce((sum, r) => sum + r.sgst, 0);
  const totalIGST = data.reduce((sum, r) => sum + r.igst, 0);
  const totalTax = totalCGST + totalSGST + totalIGST;

  return (
    <div className="space-y-4">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((record, index) => (
                  <TableRow key={`${record.placeOfSupply}-${record.supplyType}-${record.rate}-${index}`}>
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
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
