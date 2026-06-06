/**
 * Inter-State Supplies Table Component
 * Section 3.2 - Inter-State Supplies to Unregistered Persons
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InterStateData {
  stateCode: string;
  stateName: string;
  taxableValue: number;
  igst: number;
}

interface InterStateTableProps {
  data: InterStateData[];
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InterStateTable({ data }: InterStateTableProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3.2 Inter-State Supplies to Unregistered Persons</CardTitle>
          <CardDescription>State-wise breakdown of B2C inter-state supplies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No inter-state supplies data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      igst: acc.igst + row.igst,
    }),
    { taxableValue: 0, igst: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">3.2 Inter-State Supplies to Unregistered Persons</CardTitle>
        <CardDescription>State-wise breakdown of B2C inter-state supplies (B2CL)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>State Code</TableHead>
                <TableHead>State Name</TableHead>
                <TableHead className="text-right">Taxable Value</TableHead>
                <TableHead className="text-right">IGST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.stateCode}</TableCell>
                  <TableCell>{row.stateName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.taxableValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.taxableValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
