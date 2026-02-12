import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Construction, RefreshCw, AlertCircle } from 'lucide-react';
import { useGSTR1Data } from '@/hooks/useGSTR1Data';
import { B2BTable } from '@/components/gstr1/B2BTable';
import { B2CLTable } from '@/components/gstr1/B2CLTable';
import { B2CSTable } from '@/components/gstr1/B2CSTable';
import { CDNRTable } from '@/components/gstr1/CDNRTable';
import { HSNTable } from '@/components/gstr1/HSNTable';
import { DateRangeFilter } from '@/components/gstr3b/DateRangeFilter';
import { ExportButtons } from '@/components/gstr1/ExportButtons';
import { format } from 'date-fns';

export default function GSTR1Page() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data, isLoading, error, refetch } = useGSTR1Data({ startDate, endDate });

  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <DashboardLayout title="GSTR-1 Tables">
      <div className="space-y-6 animate-fade-in">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>GSTR-1 Report Generation</CardTitle>
                <CardDescription>
                  Auto-generated GSTR-1 sections based on your validated invoice data
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons
                  data={data}
                  period={startDate ? format(startDate, 'MMyyyy') : undefined}
                  disabled={isLoading || !data}
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
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>Failed to load GSTR-1 data. Please try again.</span>
              </div>
            ) : (
              <Tabs defaultValue="b2b" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="b2b" className="relative">
                    B2B
                    {data && data.summary.totalB2BInvoices > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {data.summary.totalB2BInvoices}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="b2cl">
                    B2CL
                    {data && data.summary.totalB2CLInvoices > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {data.summary.totalB2CLInvoices}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="b2cs">
                    B2CS
                    {data && data.summary.totalB2CSRecords > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {data.summary.totalB2CSRecords}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                  <TabsTrigger value="cdn">
                    CDN/R
                    {data && data.summary.totalCDNRNotes > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {data.summary.totalCDNRNotes}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="hsn">
                    HSN
                    {data && data.summary.totalHSNCodes > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {data.summary.totalHSNCodes}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="b2b" className="mt-6">
                  <B2BTable data={data?.b2b || []} />
                </TabsContent>

                <TabsContent value="b2cl" className="mt-6">
                  <B2CLTable data={data?.b2cl || []} />
                </TabsContent>

                <TabsContent value="b2cs" className="mt-6">
                  <B2CSTable data={data?.b2cs || []} />
                </TabsContent>

                <TabsContent value="export" className="mt-6">
                  <div className="text-center py-12">
                    <Construction className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
                    <p className="text-muted-foreground">
                      Export invoices with/without payment will be generated here
                    </p>
                    <Badge variant="outline" className="mt-4">Under Development</Badge>
                  </div>
                </TabsContent>

                <TabsContent value="cdn" className="mt-6">
                  <CDNRTable data={data?.cdnr || []} />
                </TabsContent>

                <TabsContent value="hsn" className="mt-6">
                  <HSNTable data={data?.hsn || []} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
