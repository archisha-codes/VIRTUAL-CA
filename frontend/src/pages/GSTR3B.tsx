import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { useGSTR3BData } from '@/hooks/useGSTR3BData';
import { SummaryCards } from '@/components/gstr3b/SummaryCards';
import { OutwardSuppliesTable } from '@/components/gstr3b/OutwardSuppliesTable';
import { ITCTable } from '@/components/gstr3b/ITCTable';
import { TaxLiabilityTable } from '@/components/gstr3b/TaxLiabilityTable';
import { DateRangeFilter } from '@/components/gstr3b/DateRangeFilter';
import { ExportButtons } from '@/components/gstr3b/ExportButtons';
import { format } from 'date-fns';

export default function GSTR3BPage() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data, isLoading, error, refetch } = useGSTR3BData({ startDate, endDate });

  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <DashboardLayout title="GSTR-3B Summary">
      <div className="space-y-6 animate-fade-in">
        {/* Header Card */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>GSTR-3B Summary</CardTitle>
                <CardDescription>
                  Auto-calculated summary of your tax liability based on validated invoices
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons 
                  data={data} 
                  period={startDate ? format(startDate, 'MMyyyy') : undefined}
                  disabled={isLoading || !data || data.summary.totalInvoices === 0}
                />
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="pt-4 border-t mt-4">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Failed to load GSTR-3B data. Please try again.</span>
            </CardContent>
          </Card>
        ) : data?.summary.totalInvoices === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Invoice Data Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {startDate || endDate
                  ? 'No invoices found for the selected period. Try adjusting the date range.'
                  : 'Upload and validate your invoices first to generate the GSTR-3B summary. Go to the Upload section to get started.'}
              </p>
              {!startDate && !endDate && (
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/upload">Go to Upload</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <SummaryCards
              totalInvoices={data?.summary.totalInvoices || 0}
              validatedInvoices={data?.summary.validatedInvoices || 0}
              totalTaxableValue={data?.summary.totalTaxableValue || 0}
              totalTax={data?.summary.totalTax || 0}
            />

            {/* 3.1 Outward Supplies */}
            <OutwardSuppliesTable data={data!.outwardSupplies} />

            {/* 4. Eligible ITC */}
            <ITCTable data={data!.eligibleItc} />

            {/* 6. Tax Payable */}
            <TaxLiabilityTable data={data!.taxPayable} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
