import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle2, IndianRupee, Receipt, TrendingUp, AlertCircle } from 'lucide-react';

interface SummaryCardsProps {
  totalInvoices: number;
  validatedInvoices: number;
  totalTaxableValue: number;
  totalTax: number;
}

export function SummaryCards({ totalInvoices, validatedInvoices, totalTaxableValue, totalTax }: SummaryCardsProps) {
  const passRate = totalInvoices > 0 ? Math.round((validatedInvoices / totalInvoices) * 100) : 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Invoices</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalInvoices}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Uploaded invoices</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-green-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Validated</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{validatedInvoices}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totalInvoices > 0 ? `${passRate}% pass rate` : 'No invoices'}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-olive-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Taxable Value</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-olive-100 dark:bg-olive-900/30 flex items-center justify-center">
            <IndianRupee className="h-4 w-4 text-olive-600 dark:text-olive-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-olive-600 dark:text-olive-400">₹{totalTaxableValue.toLocaleString('en-IN')}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total taxable amount</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-burgundy-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Tax</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-burgundy-100 dark:bg-burgundy-900/30 flex items-center justify-center">
            <Receipt className="h-4 w-4 text-burgundy-600 dark:text-burgundy-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-burgundy-600 dark:text-burgundy-400">₹{totalTax.toLocaleString('en-IN')}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">IGST + CGST + SGST</p>
        </CardContent>
      </Card>
    </div>
  );
}
