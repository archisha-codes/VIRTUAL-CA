/**
 * Exempt Supplies Table Component
 * Section 5 - Details of Exempt, Nil-Rated, and Non-GST Supplies
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ExemptSuppliesProps {
  data: {
    nilRated: {
      interState: number;
      intraState: number;
    };
    exempt: {
      interState: number;
      intraState: number;
    };
    nonGst: {
      alcohol: number;
      petroleum: number;
      electricity: number;
      others: number;
    };
  };
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ExemptSuppliesTable({ data }: ExemptSuppliesProps) {
  // Calculate totals
  const totalNilRated = data.nilRated.interState + data.nilRated.intraState;
  const totalExempt = data.exempt.interState + data.exempt.intraState;
  const totalNonGst = data.nonGst.alcohol + data.nonGst.petroleum + data.nonGst.electricity + data.nonGst.others;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">5. Exempt / Nil Rated / Non-GST Supplies</CardTitle>
        <CardDescription>
          Details of exempt, nil-rated, and non-GST supplies for reverse charge and ITC reversal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50%]">Category</TableHead>
                <TableHead className="text-right">Inter-State (₹)</TableHead>
                <TableHead className="text-right">Intra-State (₹)</TableHead>
                <TableHead className="text-right">Total (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Nil Rated Supplies */}
              <TableRow className="bg-yellow-50">
                <TableCell colSpan={3} className="font-medium text-yellow-700">
                  Nil Rated Supplies
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Nil Rated Supplies</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nilRated.interState)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nilRated.intraState)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalNilRated)}</TableCell>
              </TableRow>

              {/* Exempt Supplies */}
              <TableRow className="bg-green-50">
                <TableCell colSpan={3} className="font-medium text-green-700">
                  Exempt Supplies
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Exempt Supplies</TableCell>
                <TableCell className="text-right">{formatCurrency(data.exempt.interState)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.exempt.intraState)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalExempt)}</TableCell>
              </TableRow>

              {/* Non-GST Supplies */}
              <TableRow className="bg-red-50">
                <TableCell colSpan={3} className="font-medium text-red-700">
                  Non-GST Supplies
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Alcoholic beverages</TableCell>
                <TableCell colSpan={2} className="text-right">{formatCurrency(data.nonGst.alcohol)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nonGst.alcohol)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Petroleum products</TableCell>
                <TableCell colSpan={2} className="text-right">{formatCurrency(data.nonGst.petroleum)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nonGst.petroleum)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Electricity</TableCell>
                <TableCell colSpan={2} className="text-right">{formatCurrency(data.nonGst.electricity)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nonGst.electricity)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Others</TableCell>
                <TableCell colSpan={2} className="text-right">{formatCurrency(data.nonGst.others)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.nonGst.others)}</TableCell>
              </TableRow>

              {/* Grand Total */}
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>Total Exempt / Nil Rated / Non-GST</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalNilRated + totalExempt + totalNonGst)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Note about ITC impact */}
        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h4 className="font-medium text-amber-800 mb-2">ITC Impact Note</h4>
          <p className="text-sm text-amber-700">
            Exempt supplies may require proportional ITC reversal under Section 17(2) and Rule 42/43 of CGST Rules.
            Nil-rated and exempt supplies are considered for calculating eligible ITC.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
