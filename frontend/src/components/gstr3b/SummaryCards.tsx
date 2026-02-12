import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle2, IndianRupee, Receipt } from 'lucide-react';

interface SummaryCardsProps {
  totalInvoices: number;
  validatedInvoices: number;
  totalTaxableValue: number;
  totalTax: number;
}

export function SummaryCards({ totalInvoices, validatedInvoices, totalTaxableValue, totalTax }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalInvoices}</div>
          <p className="text-xs text-muted-foreground">Uploaded invoices</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Validated</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{validatedInvoices}</div>
          <p className="text-xs text-muted-foreground">
            {totalInvoices > 0 ? `${Math.round((validatedInvoices / totalInvoices) * 100)}% pass rate` : 'No invoices'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxable Value</CardTitle>
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{totalTaxableValue.toLocaleString('en-IN')}</div>
          <p className="text-xs text-muted-foreground">Total taxable amount</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
          <Receipt className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">₹{totalTax.toLocaleString('en-IN')}</div>
          <p className="text-xs text-muted-foreground">IGST + CGST + SGST</p>
        </CardContent>
      </Card>
    </div>
  );
}
