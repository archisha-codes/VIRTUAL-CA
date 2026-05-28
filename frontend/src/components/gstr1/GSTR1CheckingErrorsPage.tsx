import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGstr1Store } from '@/store/gstr1Store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR1CheckingErrorsPage({ gstin, returnPeriod }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const schemaErrors = useGstr1Store((state) => state.schemaErrors);
  const clearSchemaErrors = useGstr1Store((state) => state.clearSchemaErrors);
  const setCurrentStep = useGstr1Store((state) => state.setCurrentStep);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const normalizedErrors = useMemo(() => {
    return (schemaErrors || []).map((error: any, index: number) => {
      const loc = Array.isArray(error?.loc) ? error.loc : Array.isArray(error?.errors?.[0]?.loc) ? error.errors[0].loc : [];
      const columnName = [...loc].reverse().find((part) => typeof part === 'string' && part !== 'body') || error?.field || 'Unknown';
      const rowNumber = error?.row ?? error?.row_number ?? error?.rowIndex ?? error?.errors?.[0]?.row ?? 'N/A';
      const message = error?.msg || error?.message || error?.errors?.[0]?.msg || 'Validation failed';
      const rawData = error?.raw_data || error?.rawData || error?.value || null;
      const rawSnippet = rawData
        ? (rawData.invoice_no || rawData.invoice_number || rawData.invoiceNumber || rawData.invoice || rawData.voucher_no || rawData.voucherNumber || JSON.stringify(rawData).slice(0, 80))
        : (error?.invoice_no || error?.invoice_number || error?.invoiceNumber || error?.raw_value || 'N/A');

      return {
        id: `${index}-${String(rowNumber)}-${String(columnName)}`,
        rowNumber,
        rawSnippet,
        columnName,
        message,
      };
    });
  }, [schemaErrors]);

  const totalPages = Math.max(1, Math.ceil(normalizedErrors.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const visibleErrors = normalizedErrors.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleResetAndReupload = () => {
    clearSchemaErrors();
    setCurrentStep('upload');
    toast({
      title: 'Ready for re-upload',
      description: 'Please select a new file and try again.',
    });
    navigate('/gst/gstr1/prepare', {
      state: {
        gstin,
        returnPeriod,
        fromDrawer: true,
        openImportDrawer: true,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium uppercase tracking-wide">Error Review</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Schema validation issues found</h1>
            <p className="text-sm text-slate-600">
              GSTIN {gstin} for return period {returnPeriod} has {normalizedErrors.length} row{normalizedErrors.length === 1 ? '' : 's'} with upload issues.
            </p>
          </div>

          <Button onClick={handleResetAndReupload} className="gap-2 self-start md:self-auto">
            <RotateCcw className="h-4 w-4" />
            Reset & Re-upload
          </Button>
        </div>

        {normalizedErrors.length === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <FileText className="h-5 w-5" />
                No schema errors
              </CardTitle>
              <CardDescription className="text-emerald-700">
                The uploaded file did not contain any schema validation errors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleResetAndReupload} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Upload
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Row-level errors</CardTitle>
                <CardDescription>
                  Review the exact column and payload values that failed schema validation.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {normalizedErrors.length} issue{normalizedErrors.length === 1 ? '' : 's'}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row Number</TableHead>
                      <TableHead>Raw Data Snippet</TableHead>
                      <TableHead>Column Name</TableHead>
                      <TableHead>Error Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleErrors.map((error) => (
                      <TableRow key={error.id}>
                        <TableCell className="font-medium">{String(error.rowNumber)}</TableCell>
                        <TableCell className="max-w-[260px] truncate font-mono text-xs text-slate-600">{String(error.rawSnippet)}</TableCell>
                        <TableCell className="font-medium text-slate-900">{String(error.columnName)}</TableCell>
                        <TableCell className="text-slate-700">{error.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
