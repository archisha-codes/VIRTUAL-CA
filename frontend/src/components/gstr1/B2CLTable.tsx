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
import type { B2CLInvoice } from '@/hooks/useGSTR1Data';
import { format } from 'date-fns';

interface B2CLTableProps {
  data: B2CLInvoice[];
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

export function B2CLTable({ data }: B2CLTableProps) {
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

  return (
    <div className="space-y-4">
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
          <CardTitle className="text-lg">B2CL - Large B2C Invoices (&gt; ₹2.5 Lakh)</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((invoice, index) => (
                  <TableRow key={`${invoice.invoiceNumber}-${index}`}>
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
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={4} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalTaxableValue)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totalIGST)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.reduce((sum, inv) => sum + inv.cess, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
