/**
 * GSTR-1 Page - Dynamic Backend Integration
 * 
 * This page dynamically renders GSTR-1 tables based on backend data.
 * No hardcoded table definitions - automatically detects tables and columns.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { DateRangeFilter } from '@/components/gstr3b/DateRangeFilter';
import { ExportButtons } from '@/components/gstr1/ExportButtons';
import DynamicTable from '@/components/gstr1/DynamicTable';
import { format } from 'date-fns';
import type { GSTR1ProcessResponse } from '@/lib/api';
import '@/styles/gstr1.css';

export default function GSTR1Page() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const location = useLocation();
  
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

  // Get the raw backend data for dynamic rendering
  const gstr1Data = uploadResult?.data;
  
  // Debug: Log data structure to console
  console.log('GSTR1 Debug - uploadResult:', uploadResult);
  console.log('GSTR1 Debug - gstr1Data:', gstr1Data);
  
  // Define table display names for better readability
  const tableDisplayNames: Record<string, string> = {
    b2b: 'B2B - Business to Business',
    b2cl: 'B2CL - B2C Large',
    b2cs: 'B2CS - B2C Small',
    exp: 'Export',
    cdnr: 'CDNR - Credit/Debit Notes (Registered)',
    cdnur: 'CDNUR - Credit/Debit Notes (Unregistered)',
    hsn: 'HSN Summary',
    nil_exemp: 'Nil Exempted Supplies',
    at: 'Advance Tax',
    sup_ecom: 'Supplies through E-Commerce',
    amendments: 'Amendments',
    sez: 'SEZ Supplies',
  };
  
  // Dynamically get tables from backend data (excluding summary)
  const dynamicTables = gstr1Data ? Object.entries(gstr1Data)
    .filter(([key, value]) => 
      key !== 'summary' && 
      Array.isArray(value) && 
      (value as unknown[]).length > 0
    )
    .map(([tableName, tableData]) => ({
      name: tableName,
      displayName: tableDisplayNames[tableName] || tableName.toUpperCase(),
      data: tableData as Record<string, unknown>[],
    })) : [];
  
  // Get summary data
  const summaryData = gstr1Data?.summary;

  // Prepare data for export (use original transformed data if needed)
  const data = {
    b2b: gstr1Data?.b2b || [],
    b2cl: gstr1Data?.b2cl || [],
    b2cs: gstr1Data?.b2cs || [],
    export: gstr1Data?.exp || [],
    cdnr: gstr1Data?.cdnr || [],
    hsn: gstr1Data?.hsn || [],
    summary: summaryData,
  };

  // Loading and error states (for future async operations)
  const isLoading = false;
  const error = null;

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
                  Auto-generated GSTR-1 sections based on your validated invoice data from backend
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons
                  data={data as any}
                  period={startDate ? format(startDate, 'MMyyyy') : undefined}
                  disabled={isLoading || !data}
                />
                <Button variant="outline" size="sm" disabled={isLoading}>
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
            {!uploadResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm">Upload an Excel file to generate GSTR-1 tables</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => window.location.href = '/upload'}
                >
                  Go to Upload
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>Failed to load GSTR-1 data. Please try again.</span>
              </div>
            ) : (
              <div className="gstr-tables-container">
                {/* Summary Section */}
                {summaryData && (
                  <Card className="gstr-summary-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        GSTR-1 Summary
                      </CardTitle>
                      <CardDescription>
                        Overview of all transactions for the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="gstr-summary-grid">
                        {Object.entries(summaryData).map(([key, value]) => (
                          <div key={key} className="gstr-summary-item">
                            <span className="gstr-summary-label">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span className="gstr-summary-value">
                              {typeof value === 'number' 
                                ? value.toLocaleString('en-IN') 
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dynamic Tables Section */}
                {dynamicTables.length > 0 ? (
                  <div className="gstr-tables-list">
                    {dynamicTables.map((table) => (
                      <DynamicTable
                        key={table.name}
                        title={table.displayName}
                        data={table.data}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>No table data found</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
