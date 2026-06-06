import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GSTR3BData } from '@/hooks/useGSTR3BData';

interface TaxLiabilityTableProps {
  data: GSTR3BData['taxPayable'];
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TaxLiabilityTable({ data }: TaxLiabilityTableProps) {
  // ISSUE 5: Clear labeling for tax payable
  const rows = [
    { 
      label: '(a) Tax payable on outward supplies',
      description: 'Output tax on sales',
      ...data.onOutwardSupplies,
    },
    { 
      label: '(b) Tax payable on reverse charge (RCM)',
      description: 'Reverse Charge Mechanism liability',
      ...data.onReverseCharge,
    },
  ];

  const grandTotal = {
    igst: data.total.igst,
    cgst: data.total.cgst,
    sgst: data.total.sgst,
    cess: data.total.cess,
  };

  const totalPayable = grandTotal.igst + grandTotal.cgst + grandTotal.sgst + grandTotal.cess;

  return (
    <Card className="border-primary/20">
      <CardHeader className="bg-primary/5">
        <CardTitle className="text-lg">6. Payment of Tax</CardTitle>
        <CardDescription>Tax liability after adjusting Input Tax Credit</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST/UTGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-sm">
                    {row.label}
                    {row.description && (
                      <p className="text-xs text-muted-foreground font-normal">{row.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cess)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell>Net Tax Payable</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotal.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotal.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotal.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotal.cess)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Total Tax Payable</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(totalPayable)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            IGST: {formatCurrency(grandTotal.igst)} + CGST: {formatCurrency(grandTotal.cgst)} + SGST: {formatCurrency(grandTotal.sgst)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
