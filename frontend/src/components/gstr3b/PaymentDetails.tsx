/**
 * Payment Details Table Component
 * Section 6 - Payment of Tax with interest/late fee
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentDetailsProps {
  data: {
    taxPayable: {
      outwardSupplies: { igst: number; cgst: number; sgst: number; cess: number };
      reverseCharge: { igst: number; cgst: number; sgst: number; cess: number };
    };
    itcUtilized: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    interest: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    lateFee: {
      cgst: number;
      sgst: number;
    };
    netPayable: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      total: number;
    };
  };
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentDetails({ data }: PaymentDetailsProps) {
  const totalTaxPayable = 
    data.taxPayable.outwardSupplies.igst + data.taxPayable.outwardSupplies.cgst + 
    data.taxPayable.outwardSupplies.sgst + data.taxPayable.outwardSupplies.cess +
    data.taxPayable.reverseCharge.igst + data.taxPayable.reverseCharge.cgst + 
    data.taxPayable.reverseCharge.sgst + data.taxPayable.reverseCharge.cess;

  const totalItcUsed = data.itcUtilized.igst + data.itcUtilized.cgst + data.itcUtilized.sgst + data.itcUtilized.cess;
  const totalInterest = data.interest.igst + data.interest.cgst + data.interest.sgst + data.interest.cess;
  const totalLateFee = data.lateFee.cgst + data.lateFee.sgst;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">6. Payment of Tax</CardTitle>
        <CardDescription>
          Tax liability after ITC utilization, interest, and late fee
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Tax Payable on Outward Supplies */}
              <TableRow className="bg-blue-50">
                <TableCell colSpan={5} className="font-medium text-blue-700">
                  (a) Tax Payable on Outward Supplies
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Outward taxable supplies</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.outwardSupplies.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.outwardSupplies.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.outwardSupplies.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.outwardSupplies.cess)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(data.taxPayable.outwardSupplies.igst + data.taxPayable.outwardSupplies.cgst + 
                    data.taxPayable.outwardSupplies.sgst + data.taxPayable.outwardSupplies.cess)}
                </TableCell>
              </TableRow>

              {/* Tax Payable on Reverse Charge */}
              <TableRow className="bg-orange-50">
                <TableCell colSpan={5} className="font-medium text-orange-700">
                  (b) Tax Payable on Reverse Charge (RCM)
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Inward supplies liable to RCM</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.reverseCharge.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.reverseCharge.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.reverseCharge.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.taxPayable.reverseCharge.cess)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(data.taxPayable.reverseCharge.igst + data.taxPayable.reverseCharge.cgst + 
                    data.taxPayable.reverseCharge.sgst + data.taxPayable.reverseCharge.cess)}
                </TableCell>
              </TableRow>

              {/* Subtotal Tax */}
              <TableRow className="bg-muted font-semibold">
                <TableCell>(a) + (b) Total Tax Payable</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.taxPayable.outwardSupplies.igst + data.taxPayable.reverseCharge.igst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.taxPayable.outwardSupplies.cgst + data.taxPayable.reverseCharge.cgst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.taxPayable.outwardSupplies.sgst + data.taxPayable.reverseCharge.sgst)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(data.taxPayable.outwardSupplies.cess + data.taxPayable.reverseCharge.cess)}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(totalTaxPayable)}</TableCell>
              </TableRow>

              {/* Less: ITC Utilized */}
              <TableRow className="bg-green-50">
                <TableCell colSpan={5} className="font-medium text-green-700">
                  (c) Less: Input Tax Credit Utilized
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">ITC Utilized</TableCell>
                <TableCell className="text-right text-green-600">-{formatCurrency(data.itcUtilized.igst)}</TableCell>
                <TableCell className="text-right text-green-600">-{formatCurrency(data.itcUtilized.cgst)}</TableCell>
                <TableCell className="text-right text-green-600">-{formatCurrency(data.itcUtilized.sgst)}</TableCell>
                <TableCell className="text-right text-green-600">-{formatCurrency(data.itcUtilized.cess)}</TableCell>
                <TableCell className="text-right text-green-600 font-medium">-{formatCurrency(totalItcUsed)}</TableCell>
              </TableRow>

              {/* Interest */}
              <TableRow className="bg-red-50">
                <TableCell colSpan={5} className="font-medium text-red-700">
                  (d) Interest
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Interest on late payment</TableCell>
                <TableCell className="text-right">{formatCurrency(data.interest.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.interest.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.interest.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.interest.cess)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalInterest)}</TableCell>
              </TableRow>

              {/* Late Fee */}
              <TableRow className="bg-yellow-50">
                <TableCell colSpan={5} className="font-medium text-yellow-700">
                  (e) Late Fee
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Late filing fee</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">{formatCurrency(data.lateFee.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.lateFee.sgst)}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totalLateFee)}</TableCell>
              </TableRow>

              {/* Net Payable */}
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>Net Tax Payable (a + b - c + d + e)</TableCell>
                <TableCell className="text-right">{formatCurrency(data.netPayable.igst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.netPayable.cgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.netPayable.sgst)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.netPayable.cess)}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(data.netPayable.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Payment Summary */}
        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Total Tax Payable</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(data.netPayable.total)}
            </span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <p>IGST: {formatCurrency(data.netPayable.igst)} + CGST: {formatCurrency(data.netPayable.cgst)} + SGST: {formatCurrency(data.netPayable.sgst)} + Cess: {formatCurrency(data.netPayable.cess)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
