/**
 * GSTR-3B Page - Backend Integration
 * 
 * This page displays GSTR-3B summary using data processed by the backend.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, FileText, FileSpreadsheet } from 'lucide-react';
import { SummaryCards } from '@/components/gstr3b/SummaryCards';
import { OutwardSuppliesTable } from '@/components/gstr3b/OutwardSuppliesTable';
import { ITCTable } from '@/components/gstr3b/ITCTable';
import { TaxLiabilityTable } from '@/components/gstr3b/TaxLiabilityTable';
import { DateRangeFilter } from '@/components/gstr3b/DateRangeFilter';
import { ExportButtons } from '@/components/gstr3b/ExportButtons';
import { ReconciliationTable } from '@/components/gstr3b/ReconciliationTable';
import { format } from 'date-fns';
import type { GSTR1ProcessResponse, processGSTR3B, GSTR3BProcessResponse } from '@/lib/api';
import { calculateGSTR3BFromGSTR1, type GSTR3BData } from '@/hooks/useGSTR3BData';
import { 
  transformBackendB2BToFrontend, 
  transformBackendB2CLToFrontend, 
  transformBackendB2CSToFrontend,
  transformBackendExportToFrontend,
} from '@/lib/gstr-transform';

export default function GSTR3BPage() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BProcessResponse | null>(null);
  
  // Get upload result from navigation state OR localStorage
  const uploadResultFromState = location.state?.uploadResult as GSTR1ProcessResponse | null;
  
  // Try to get from localStorage if not in state
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(uploadResultFromState);
  
  useEffect(() => {
    // If we have data in state, use it
    if (uploadResultFromState) {
      setUploadResult(uploadResultFromState);
    } else {
      // Try to load from localStorage
      const stored = localStorage.getItem('gstr1_upload_result');
      if (stored) {
        try {
          setUploadResult(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored GSTR1 data:', e);
        }
      }
    }
  }, [uploadResultFromState]);

  // Transform backend data to frontend format
  // Note: uploadResult.data contains the actual GSTR1 tables
  const gstr1Data = uploadResult?.data;
  
  const b2bData = gstr1Data?.b2b && Array.isArray(gstr1Data.b2b) && gstr1Data.b2b.length > 0
    ? transformBackendB2BToFrontend(gstr1Data.b2b as any)
    : [];
  
  const b2clData = gstr1Data?.b2cl && Array.isArray(gstr1Data.b2cl) && gstr1Data.b2cl.length > 0
    ? transformBackendB2CLToFrontend(gstr1Data.b2cl as any)
    : [];
  
  const b2csData = gstr1Data?.b2cs && Array.isArray(gstr1Data.b2cs) && gstr1Data.b2cs.length > 0
    ? transformBackendB2CSToFrontend(gstr1Data.b2cs as any)
    : [];
  
  const exportData = gstr1Data?.exp && Array.isArray(gstr1Data.exp) && gstr1Data.exp.length > 0
    ? transformBackendExportToFrontend(gstr1Data.exp as any)
    : [];

  // Calculate GSTR-3B data from GSTR-1 data
  const gstr1ForCalc = {
    b2b: b2bData,
    b2cl: b2clData.map(inv => ({
      taxableValue: inv.taxableValue,
      igst: inv.igst,
    })),
    b2cs: b2csData.map(entry => ({
      taxableValue: entry.taxableValue,
      igst: entry.igst,
      cgst: entry.cgst,
      sgst: entry.sgst,
    })),
    export: exportData.map(inv => ({
      taxableValue: inv.taxableValue,
      igst: inv.igst,
    })),
  };

  const data: GSTR3BData | null = uploadResult 
    ? calculateGSTR3BFromGSTR1(gstr1ForCalc)
    : null;

  // Process GSTR-3B with reconciliation when upload result is available
  useEffect(() => {
    const processGSTR3BData = async () => {
      if (!uploadResult || !gstr1Data) return;
      
      setIsProcessing(true);
      try {
        // Import dynamically to avoid circular dependencies
        const { processGSTR3B } = await import('@/lib/api');
        
        // Send the original GSTR1 tables (not transformed data)
        const result = await processGSTR3B(
          gstr1Data as Record<string, unknown>,
          null // No purchases file for now
        );
        
        setGstr3bData(result);
        
        // Store GSTR-3B data in localStorage for export
        localStorage.setItem('gstr3b_data', JSON.stringify(result));
      } catch (error) {
        console.error('Error processing GSTR-3B:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    
    processGSTR3BData();
  }, [uploadResult, gstr1Data]);

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
                  Auto-calculated summary of your tax liability based on validated invoices from backend
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons 
                  data={data || undefined} 
                  period={startDate ? format(startDate, 'MMyyyy') : undefined}
                  disabled={isProcessing || !data || data.summary.totalInvoices === 0}
                />
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} disabled={isProcessing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
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

        {!uploadResult ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Invoice Data Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Upload and validate your invoices first to generate the GSTR-3B summary. 
                Go to the Upload section to get started.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <a href="/upload">Go to Upload</a>
              </Button>
            </CardContent>
          </Card>
        ) : isProcessing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : data?.summary.totalInvoices === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Validated Invoices</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No validated invoices found. Please upload and validate your invoices first.
              </p>
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

            {/* ITC Reconciliation */}
            {gstr3bData && (
              <ReconciliationTable data={gstr3bData.reconciliation} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
