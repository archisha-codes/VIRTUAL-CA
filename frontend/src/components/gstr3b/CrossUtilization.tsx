/**
 * Cross Utilization Table Component
 * Phase 5 - Display cross-utilization rules breakdown
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CrossUtilizationProps {
  data: {
    igstCreditUtilized: {
      for_igst: number;
      for_cgst: number;
      for_sgst: number;
    };
    cgstCreditUtilized: {
      for_cgst: number;
      for_igst: number;
    };
    sgstCreditUtilized: {
      for_sgst: number;
      for_igst: number;
    };
  };
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CrossUtilization({ data }: CrossUtilizationProps) {
  const totalIgstUsed = data.igstCreditUtilized.for_igst + data.igstCreditUtilized.for_cgst + data.igstCreditUtilized.for_sgst;
  const totalCgstUsed = data.cgstCreditUtilized.for_cgst + data.cgstCreditUtilized.for_igst;
  const totalSgstUsed = data.sgstCreditUtilized.for_sgst + data.sgstCreditUtilized.for_igst;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cross Utilization of ITC</CardTitle>
        <CardDescription>
          GST cross-utilization rules: IGST → CGST/SGST, CGST → IGST, SGST → IGST
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">ITC Source</TableHead>
                <TableHead className="text-right">Used for IGST</TableHead>
                <TableHead className="text-right">Used for CGST</TableHead>
                <TableHead className="text-right">Used for SGST</TableHead>
                <TableHead className="text-right">Total Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* IGST Credit Utilization */}
              <TableRow className="bg-blue-50">
                <TableCell colSpan={4} className="font-medium text-blue-700">
                  IGST Credit Utilized
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">→ IGST Payment</TableCell>
                <TableCell className="text-right">{formatCurrency(data.igstCreditUtilized.for_igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.igstCreditUtilized.for_cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.igstCreditUtilized.for_sgst)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalIgstUsed)}</TableCell>
              </TableRow>

              {/* CGST Credit Utilization */}
              <TableRow className="bg-green-50">
                <TableCell colSpan={4} className="font-medium text-green-700">
                  CGST Credit Utilized
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">→ CGST Payment</TableCell>
                <TableCell className="text-right">{formatCurrency(data.cgstCreditUtilized.for_igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.cgstCreditUtilized.for_cgst)}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalCgstUsed)}</TableCell>
              </TableRow>

              {/* SGST Credit Utilization */}
              <TableRow className="bg-purple-50">
                <TableCell colSpan={4} className="font-medium text-purple-700">
                  SGST Credit Utilized
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">→ SGST Payment</TableCell>
                <TableCell className="text-right">{formatCurrency(data.sgstCreditUtilized.for_igst)}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">{formatCurrency(data.sgstCreditUtilized.for_sgst)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalSgstUsed)}</TableCell>
              </TableRow>

              {/* Grand Total */}
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>Grand Total</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.igstCreditUtilized.for_igst + data.cgstCreditUtilized.for_igst + data.sgstCreditUtilized.for_igst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.igstCreditUtilized.for_cgst + data.cgstCreditUtilized.for_cgst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.igstCreditUtilized.for_sgst + data.sgstCreditUtilized.for_sgst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalIgstUsed + totalCgstUsed + totalSgstUsed)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Utilization Rules Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-2">IGST → CGST/SGST</h4>
            <p className="text-sm text-muted-foreground">
              IGST credit can be utilized for payment of CGST and SGST in any proportion.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-700 mb-2">CGST → IGST</h4>
            <p className="text-sm text-muted-foreground">
              CGST credit can be utilized only for IGST payment (not for SGST).
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-700 mb-2">SGST → IGST</h4>
            <p className="text-sm text-muted-foreground">
              SGST credit can be utilized only for IGST payment (not for CGST).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
