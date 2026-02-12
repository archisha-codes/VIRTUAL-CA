import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OutwardSupplies } from '@/hooks/useGSTR3BData';

interface OutwardSuppliesTableProps {
  data: OutwardSupplies;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OutwardSuppliesTable({ data }: OutwardSuppliesTableProps) {
  const rows = [
    { 
      label: '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', 
      ...data.taxableSupplies 
    },
    { 
      label: '(b) Outward taxable supplies (zero rated)', 
      ...data.zeroRatedSupplies 
    },
    { 
      label: '(c) Other outward supplies (Nil rated, exempted)', 
      ...data.nilRatedSupplies 
    },
    { 
      label: '(d) Inward supplies (liable to reverse charge)', 
      ...data.reverseChargeSupplies 
    },
    { 
      label: '(e) Non-GST outward supplies', 
      taxableValue: data.nonGstSupplies.taxableValue,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
    },
  ];

  const totals = rows.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      igst: acc.igst + row.igst,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      cess: acc.cess + row.cess,
    }),
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">3.1 Details of Outward Supplies and Inward Supplies liable to Reverse Charge</CardTitle>
        <CardDescription>Summary of all outward supplies made during the tax period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Nature of Supplies</TableHead>
                <TableHead className="text-right">Taxable Value</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST/UTGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-sm">{row.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.taxableValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cess)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.taxableValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.cess)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
