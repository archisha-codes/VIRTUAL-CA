/**
 * GSTR-1 Page - Backend Integration
 * 
 * This page displays GSTR-1 tables using data processed by the backend.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Construction, RefreshCw, AlertCircle } from 'lucide-react';
import { DateRangeFilter } from '@/components/gstr3b/DateRangeFilter';
import { ExportButtons } from '@/components/gstr1/ExportButtons';
import { format } from 'date-fns';
import type { GSTR1ProcessResponse } from '@/lib/api';
import { 
  transformBackendB2BToFrontend, 
  transformBackendB2CLToFrontend, 
  transformBackendB2CSToFrontend,
  transformBackendExportToFrontend,
  transformBackendCDNRToFrontend,
  type B2BCustomer,
  type B2CLInvoice,
  type B2CSSummary,
  type ExportInvoice,
  type CDNRCustomer,
} from '@/lib/gstr-transform';

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

  // Transform backend data to frontend format
  // Note: uploadResult.data contains the actual GSTR1 tables
  const gstr1Data = uploadResult?.data;
  
  // Debug: Log data structure to console
  console.log('GSTR1 Debug - uploadResult:', uploadResult);
  console.log('GSTR1 Debug - gstr1Data:', gstr1Data);
  console.log('GSTR1 Debug - b2b:', gstr1Data?.b2b);
  
  // Safely transform with defensive checks - cast to any to handle backend structure
  const b2bData: B2BCustomer[] = (gstr1Data?.b2b && Array.isArray(gstr1Data.b2b) && gstr1Data.b2b.length > 0) 
    ? transformBackendB2BToFrontend(gstr1Data.b2b as any)
    : [];
  
  const b2clData: B2CLInvoice[] = (gstr1Data?.b2cl && Array.isArray(gstr1Data.b2cl) && gstr1Data.b2cl.length > 0) 
    ? transformBackendB2CLToFrontend(gstr1Data.b2cl as any)
    : [];
  
  const b2csData: B2CSSummary[] = (gstr1Data?.b2cs && Array.isArray(gstr1Data.b2cs) && gstr1Data.b2cs.length > 0) 
    ? transformBackendB2CSToFrontend(gstr1Data.b2cs as any)
    : [];
  
  const exportData: ExportInvoice[] = (gstr1Data?.exp && Array.isArray(gstr1Data.exp) && gstr1Data.exp.length > 0) 
    ? transformBackendExportToFrontend(gstr1Data.exp as any)
    : [];
  
  const cdnrData: CDNRCustomer[] = (gstr1Data?.cdnr && Array.isArray(gstr1Data.cdnr) && gstr1Data.cdnr.length > 0) 
    ? transformBackendCDNRToFrontend(gstr1Data.cdnr as any)
    : [];

  // Get summary from the data
  const summaryData = gstr1Data?.summary;

  // Calculate summary
  const totalB2BInvoices = b2bData.reduce((sum, cust) => sum + cust.invoices.length, 0);
  const totalB2CLInvoices = b2clData.length;
  const totalB2CSRecords = b2csData.length;
  const totalExportInvoices = exportData.length;
  const totalCDNRNotes = cdnrData.reduce((sum, cust) => sum + cust.notes.length, 0);

  const totalTaxableValue = 
    b2bData.reduce((sum, cust) => sum + cust.totalTaxableValue, 0) +
    b2clData.reduce((sum, inv) => sum + inv.taxableValue, 0) +
    b2csData.reduce((sum, s) => sum + s.taxableValue, 0);

  const totalTax = 
    b2bData.reduce((sum, cust) => sum + cust.totalTax, 0) +
    b2clData.reduce((sum, inv) => sum + inv.igst, 0) +
    b2csData.reduce((sum, s) => sum + s.igst + s.cgst + s.sgst, 0);

  const summary = {
    totalB2BInvoices,
    totalB2CLInvoices,
    totalB2CSRecords,
    totalExportInvoices,
    totalCDNRNotes,
    totalHSNCodes: 0,
    totalTaxableValue,
    totalTax,
  };

  const data = {
    b2b: b2bData,
    b2cl: b2clData,
    b2cs: b2csData,
    export: exportData,
    cdnr: cdnrData,
    hsn: [],
    summary,
  };

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
                  data={data}
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
              <Tabs defaultValue="b2b" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="b2b" className="relative">
                    B2B
                    {summary.totalB2BInvoices > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalB2BInvoices}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="b2cl">
                    B2CL
                    {summary.totalB2CLInvoices > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalB2CLInvoices}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="b2cs">
                    B2CS
                    {summary.totalB2CSRecords > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalB2CSRecords}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="export">
                    Export
                    {summary.totalExportInvoices > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalExportInvoices}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="cdn">
                    CDN/R
                    {summary.totalCDNRNotes > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalCDNRNotes}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="hsn">
                    HSN
                    {summary.totalHSNCodes > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                        {summary.totalHSNCodes}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="b2b" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>B2B Invoices</CardTitle>
                      <CardDescription>
                        Invoices issued to registered taxpayers (GSTIN available)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {b2bData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No B2B invoices found
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {b2bData.map((customer) => (
                            <div key={customer.customerGstin} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-4">
                                <div>
                                  <p className="font-medium">{customer.customerName}</p>
                                  <p className="text-sm text-muted-foreground">{customer.customerGstin}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">₹{customer.totalTaxableValue.toLocaleString()}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Tax: ₹{customer.totalTax.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Invoice No</th>
                                    <th className="text-left py-2">Date</th>
                                    <th className="text-right py-2">Value</th>
                                    <th className="text-right py-2">Taxable</th>
                                    <th className="text-right py-2">IGST</th>
                                    <th className="text-right py-2">CGST</th>
                                    <th className="text-right py-2">SGST</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {customer.invoices.map((inv, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2">{inv.invoiceNumber}</td>
                                      <td className="py-2">{inv.invoiceDate}</td>
                                      <td className="py-2 text-right">₹{inv.invoiceValue.toLocaleString()}</td>
                                      <td className="py-2 text-right">₹{inv.taxableValue.toLocaleString()}</td>
                                      <td className="py-2 text-right">₹{inv.igst.toLocaleString()}</td>
                                      <td className="py-2 text-right">₹{inv.cgst.toLocaleString()}</td>
                                      <td className="py-2 text-right">₹{inv.sgst.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="b2cl" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>B2CL Invoices</CardTitle>
                      <CardDescription>
                        Invoices issued to unregistered persons with value greater than 2.5 lakh (Inter-state)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {b2clData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No B2CL invoices found
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Place of Supply</th>
                              <th className="text-left py-2">Invoice No</th>
                              <th className="text-left py-2">Date</th>
                              <th className="text-right py-2">Value</th>
                              <th className="text-right py-2">Taxable</th>
                              <th className="text-right py-2">IGST</th>
                              <th className="text-right py-2">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b2clData.map((inv, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2">{inv.placeOfSupply}</td>
                                <td className="py-2">{inv.invoiceNumber}</td>
                                <td className="py-2">{inv.invoiceDate}</td>
                                <td className="py-2 text-right">₹{inv.invoiceValue.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{inv.taxableValue.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{inv.igst.toLocaleString()}</td>
                                <td className="py-2 text-right">{inv.rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="b2cs" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>B2CS Summary</CardTitle>
                      <CardDescription>
                        Consolidated details of supplies to unregistered persons (State-wise)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {b2csData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No B2CS entries found
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Place of Supply</th>
                              <th className="text-left py-2">Type</th>
                              <th className="text-right py-2">Taxable Value</th>
                              <th className="text-right py-2">IGST</th>
                              <th className="text-right py-2">CGST</th>
                              <th className="text-right py-2">SGST</th>
                              <th className="text-right py-2">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b2csData.map((entry, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2">{entry.placeOfSupply}</td>
                                <td className="py-2">{entry.supplyType}</td>
                                <td className="py-2 text-right">₹{entry.taxableValue.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{entry.igst.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{entry.cgst.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{entry.sgst.toLocaleString()}</td>
                                <td className="py-2 text-right">{entry.rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="export" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Export Invoices</CardTitle>
                      <CardDescription>
                        Invoices for exports (with/without payment of tax)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {exportData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No export invoices found
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Invoice No</th>
                              <th className="text-left py-2">Date</th>
                              <th className="text-right py-2">Value</th>
                              <th className="text-right py-2">Taxable</th>
                              <th className="text-right py-2">IGST</th>
                              <th className="text-right py-2">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exportData.map((inv, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2">{inv.invoiceNumber}</td>
                                <td className="py-2">{inv.invoiceDate}</td>
                                <td className="py-2 text-right">₹{inv.invoiceValue.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{inv.taxableValue.toLocaleString()}</td>
                                <td className="py-2 text-right">₹{inv.igst.toLocaleString()}</td>
                                <td className="py-2 text-right">{inv.rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cdn" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Credit/Debit Notes (Registered)</CardTitle>
                      <CardDescription>
                        Credit/Debit notes issued to registered taxpayers
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cdnrData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No CDN/R notes found
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {cdnrData.map((customer) => (
                            <div key={customer.customerGstin} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-4">
                                <div>
                                  <p className="font-medium">{customer.customerName}</p>
                                  <p className="text-sm text-muted-foreground">{customer.customerGstin}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">₹{customer.totalTaxableValue.toLocaleString()}</p>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Note No</th>
                                    <th className="text-left py-2">Date</th>
                                    <th className="text-left py-2">Type</th>
                                    <th className="text-right py-2">Value</th>
                                    <th className="text-right py-2">Taxable</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {customer.notes.map((note, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2">{note.noteNumber}</td>
                                      <td className="py-2">{note.noteDate}</td>
                                      <td className="py-2">
                                        <Badge variant={note.noteType === 'C' ? 'default' : 'secondary'}>
                                          {note.noteType === 'C' ? 'Credit' : 'Debit'}
                                        </Badge>
                                      </td>
                                      <td className="py-2 text-right">₹{note.noteValue.toLocaleString()}</td>
                                      <td className="py-2 text-right">₹{note.taxableValue.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="hsn" className="mt-6">
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Construction className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">HSN Summary</h3>
                      <p className="text-muted-foreground">
                        HSN summary would be generated from backend processing
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
