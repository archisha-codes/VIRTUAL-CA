/**
 * GSTR-2B Page - Upload and Reconciliation
 * 
 * Users can download GSTR-2B JSON from GST portal and upload it
 * for reconciliation with purchase register.
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload as UploadIcon, 
  FileJson, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ArrowRightLeft,
  FileCheck,
  X
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table as TableComponent, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// Types for GSTR-2B data
interface GSTR2BInvoice {
  gstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  status: 'matched' | 'missing' | 'mismatch';
}

interface ReconciliationResult {
  total: number;
  matched: number;
  missing: number;
  mismatch: number;
}

// Types for parsing
interface GSTR2BSupplier {
  ctin?: string;
  inv?: GSTR2BInv[];
}

interface GSTR2BInv {
  inum?: string;
  idt?: string;
  txval?: string | number;
  igst?: string | number;
  cgst?: string | number;
  sgst?: string | number;
}

interface PurchaseInvoice {
  invoice_number?: string;
  customer_gstin?: string;
  igst_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
}

export default function GSTR2BPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gstr2bData, setGstr2bData] = useState<GSTR2BInvoice[]>([]);
  const [reconciliationResults, setReconciliationResults] = useState<ReconciliationResult | null>(null);
  const [step, setStep] = useState<'upload' | 'reconcile'>('upload');
  const { toast } = useToast();

  // Parse GSTR-2B JSON file
  const parseGSTR2B = async (file: File): Promise<GSTR2BInvoice[]> => {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const invoices: GSTR2BInvoice[] = [];
    
    // Handle different JSON structures
    if (data.b2b) {
      (data.b2b as GSTR2BSupplier[]).forEach((supplier) => {
        if (supplier.inv) {
          supplier.inv.forEach((inv) => {
            invoices.push({
              gstin: supplier.ctin ?? '',
              invoiceNumber: inv.inum ?? '',
              invoiceDate: inv.idt ?? '',
              taxableValue: parseFloat(String(inv.txval ?? '0')),
              igst: parseFloat(String(inv.igst ?? '0')),
              cgst: parseFloat(String(inv.cgst ?? '0')),
              sgst: parseFloat(String(inv.sgst ?? '0')),
              status: 'matched'
            });
          });
        }
      });
    }
    
    return invoices;
  };

  // Reconcile GSTR-2B with purchase register
  const reconcileData = useCallback(async () => {
    if (gstr2bData.length === 0) return;

    setIsProcessing(true);

    try {
      // Get purchase invoices from localStorage or mock data
      const storedPurchaseData = localStorage.getItem('purchase_invoices');
      const purchaseInvoices: PurchaseInvoice[] = storedPurchaseData ? JSON.parse(storedPurchaseData) : [];

      // Match purchases with GSTR-2B
      const results = gstr2bData.map(gstr2bInvoice => {
        const match = purchaseInvoices.find(
          (p) => 
            p.invoice_number === gstr2bInvoice.invoiceNumber && 
            p.customer_gstin === gstr2bInvoice.gstin
        );

        if (!match) {
          return { ...gstr2bInvoice, status: 'missing' as const };
        }

        // Check for tax mismatch
        const gstr2bTax = (gstr2bInvoice.igst ?? 0) + (gstr2bInvoice.cgst ?? 0) + (gstr2bInvoice.sgst ?? 0);
        const purchaseTax = (match.igst_amount ?? 0) + (match.cgst_amount ?? 0) + (match.sgst_amount ?? 0);
        const taxDiff = Math.abs(gstr2bTax - purchaseTax);

        if (taxDiff > 1) {
          return { ...gstr2bInvoice, status: 'mismatch' as const };
        }

        return { ...gstr2bInvoice, status: 'matched' as const };
      });

      // Calculate reconciliation summary
      const reconciliation: ReconciliationResult = {
        total: results.length,
        matched: results.filter(r => r.status === 'matched').length,
        missing: results.filter(r => r.status === 'missing').length,
        mismatch: results.filter(r => r.status === 'mismatch').length
      };

      setGstr2bData(results);
      setReconciliationResults(reconciliation);
      setStep('reconcile');

      toast({
        title: 'Reconciliation Complete',
        description: `Matched: ${reconciliation.matched}, Missing: ${reconciliation.missing}, Mismatch: ${reconciliation.mismatch}`,
      });
    } catch (error) {
      toast({
        title: 'Reconciliation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [gstr2bData, toast]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const parsed = await parseGSTR2B(uploadedFile);
      setGstr2bData(parsed);
      
      toast({
        title: 'GSTR-2B Uploaded',
        description: `Found ${parsed.length} invoices in the JSON file`,
      });
    } catch (error) {
      toast({
        title: 'Failed to parse file',
        description: 'Please ensure the JSON file is in correct GSTR-2B format',
        variant: 'destructive',
      });
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
  });

  const resetUpload = () => {
    setFile(null);
    setGstr2bData([]);
    setReconciliationResults(null);
    setStep('upload');
  };

  return (
    <DashboardLayout title="GSTR-2B Reconciliation">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              GSTR-2B Upload & Reconciliation
            </CardTitle>
            <CardDescription>
              Upload your GSTR-2B JSON file downloaded from the GST portal to reconcile with your purchase register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Download GSTR-2B JSON from GST Portal (My Returns {'>'} GSTR-2B)</li>
                <li>Upload the JSON file using the dropzone below</li>
                <li>System will automatically reconcile with your purchase register</li>
                <li>Review matched, missing, and mismatched invoices</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Upload Step */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload GSTR-2B JSON</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <input {...getInputProps()} />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Processing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileJson className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop GSTR-2B JSON file'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse from your computer
                      </p>
                    </div>
                    <Badge variant="secondary">.json</Badge>
                  </div>
                )}
              </div>

              {/* Uploaded File Info */}
              {file && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileJson className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{file.name}</span>
                    <Badge variant="outline">{gstr2bData.length} invoices</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetUpload}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Reconcile Button */}
              {gstr2bData.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={reconcileData} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Reconcile with Purchase Register
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Results */}
        {step === 'reconcile' && reconciliationResults && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{reconciliationResults.total}</p>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-500">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{reconciliationResults.matched}</p>
                    <p className="text-sm text-muted-foreground">Matched</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-500">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600">{reconciliationResults.missing}</p>
                    <p className="text-sm text-muted-foreground">Missing in 2B</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-500">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-600">{reconciliationResults.mismatch}</p>
                    <p className="text-sm text-muted-foreground">Tax Mismatch</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoice Table */}
            <Card>
              <CardHeader>
                <CardTitle>Reconciliation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all">All ({reconciliationResults.total})</TabsTrigger>
                    <TabsTrigger value="matched">Matched ({reconciliationResults.matched})</TabsTrigger>
                    <TabsTrigger value="missing">Missing ({reconciliationResults.missing})</TabsTrigger>
                    <TabsTrigger value="mismatch">Mismatch ({reconciliationResults.mismatch})</TabsTrigger>
                  </TabsList>
                  
                  {['all', 'matched', 'missing', 'mismatch'].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                      <TableComponent>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Invoice Number</TableHead>
                            <TableHead>Invoice Date</TableHead>
                            <TableHead className="text-right">Taxable Value</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr2bData
                            .filter(inv => tab === 'all' || inv.status === tab)
                            .map((inv, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Badge variant={
                                    inv.status === 'matched' ? 'default' :
                                    inv.status === 'missing' ? 'destructive' :
                                    'outline'
                                  }>
                                    {inv.status === 'matched' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {inv.status === 'missing' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {inv.status === 'mismatch' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{inv.gstin}</TableCell>
                                <TableCell>{inv.invoiceNumber}</TableCell>
                                <TableCell>{inv.invoiceDate}</TableCell>
                                <TableCell className="text-right">₹{inv.taxableValue.toLocaleString()}</TableCell>
                                <TableCell className="text-right">₹{inv.igst.toLocaleString()}</TableCell>
                                <TableCell className="text-right">₹{inv.cgst.toLocaleString()}</TableCell>
                                <TableCell className="text-right">₹{inv.sgst.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </TableComponent>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={resetUpload}>
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload New File
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
