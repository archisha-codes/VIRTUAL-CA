/**
 * Upload Page - Backend Integration
 * 
 * This page handles Excel file uploads and sends them to the backend API
 * for GSTR-1 processing instead of processing locally and storing in Supabase.
 */

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, ShoppingCart, Receipt } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { 
  parseExcelFile, 
  autoMapColumns, 
  mapRowToInvoice,
  FIELD_LABELS, 
  REQUIRED_FIELDS,
  PURCHASE_FIELD_LABELS,
  PURCHASE_REQUIRED_FIELDS,
  type ColumnMapping,
  type ParsedExcel 
} from '@/lib/excel-parser';
import { getExcelColumns, processGSTR1Excel, type GSTR1ProcessResponse } from '@/lib/api';

type InvoiceCategory = 'sales' | 'purchase';

export default function UploadPage() {
  const [invoiceCategory, setInvoiceCategory] = useState<InvoiceCategory>('sales');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcel | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'result'>('upload');
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load previous upload result from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('gstr1_upload_result');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.success && parsed.data) {
          setUploadResult(parsed);
          setStep('result');
        }
      } catch (e) {
        console.error('Failed to parse stored upload result:', e);
      }
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const parsed = await parseExcelFile(uploadedFile);
      setParsedData(parsed);
      
      // Auto-map columns
      const autoMapping = autoMapColumns(parsed.headers);
      setColumnMapping(autoMapping);
      
      setStep('mapping');
      toast({
        title: 'File parsed successfully',
        description: `Found ${parsed.rows.length} rows and ${parsed.headers.length} columns.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to parse file',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? undefined : value,
    }));
  };

  const requiredFields = invoiceCategory === 'sales' ? REQUIRED_FIELDS : PURCHASE_REQUIRED_FIELDS;
  const fieldLabels = invoiceCategory === 'sales' ? FIELD_LABELS : PURCHASE_FIELD_LABELS;
  const isMappingComplete = requiredFields.every(field => columnMapping[field]);

  const handleProcessInvoices = async () => {
    if (!file || !isMappingComplete) return;

    setStep('processing');
    setIsProcessing(true);

    try {
      // Convert column mapping to Record<string, string> for backend
      const mappingDict: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([key, value]) => {
        if (value) {
          mappingDict[key] = value;
        }
      });

      // Use the new process endpoint that accepts column mapping
      const result = await processGSTR1Excel(
        file,
        mappingDict
      );
      
      setUploadResult(result);
      
      // Persist GSTR-1 tables to localStorage for navigation
      if (result.success && result.data) {
        localStorage.setItem('gstr1_tables', JSON.stringify(result.data));
        localStorage.setItem('gstr1_upload_result', JSON.stringify(result));
      }
      
      setStep('result');
      
      const errorCount = result.validation_report?.errors?.length || 0;
      if (errorCount > 0) {
        toast({
          title: 'Upload completed with errors',
          description: `Processed ${result.total_records || 0} records with ${errorCount} validation errors.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Upload complete!',
          description: `Successfully processed ${result.total_records || 0} records.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to process file',
        variant: 'destructive',
      });
      setStep('mapping');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setParsedData(null);
    setColumnMapping({});
    setStep('upload');
    setUploadResult(null);
  };

  const handleViewGSTR1 = () => {
    navigate('/gstr1', { state: { uploadResult } });
  };

  const handleViewGSTR3B = () => {
    navigate('/gstr3b', { state: { uploadResult } });
  };

  return (
    <DashboardLayout title="Upload & Mapping">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Upload Step */}
        {step === 'upload' && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Invoice Data
              </CardTitle>
              <CardDescription>
                Upload your Excel file containing invoice data. We support .xlsx and .xls formats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invoice Category Tabs */}
              <Tabs value={invoiceCategory} onValueChange={(v) => setInvoiceCategory(v as InvoiceCategory)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sales" className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Sales Invoices
                  </TabsTrigger>
                  <TabsTrigger value="purchase" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Purchase Invoices
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sales" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Upload sales invoices to generate GSTR-1 and calculate outward tax liability for GSTR-3B.
                  </p>
                </TabsContent>
                <TabsContent value="purchase" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Upload purchase invoices to calculate Input Tax Credit (ITC) for GSTR-3B Section 4.
                  </p>
                </TabsContent>
              </Tabs>

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
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file here'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse from your computer
                      </p>
                    </div>
                    <Badge variant="secondary">.xlsx, .xls</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && parsedData && (
          <>
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    {file?.name}
                    <Badge variant={invoiceCategory === 'sales' ? 'default' : 'secondary'}>
                      {invoiceCategory === 'sales' ? 'Sales' : 'Purchase'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {parsedData.rows.length} rows • {parsedData.headers.length} columns
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={resetUpload}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>
                  Map your Excel columns to the required GST fields. Required fields are marked with *
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.keys(fieldLabels) as (keyof ColumnMapping)[]).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1">
                        {fieldLabels[field]}
                        {requiredFields.includes(field) && (
                          <span className="text-destructive">*</span>
                        )}
                        {columnMapping[field] && (
                          <CheckCircle className="h-3 w-3 text-success ml-1" />
                        )}
                      </label>
                      <Select
                        value={columnMapping[field] || 'none'}
                        onValueChange={(value) => handleMappingChange(field, value)}
                      >
                        <SelectTrigger className={!columnMapping[field] && requiredFields.includes(field) ? 'border-destructive/50' : ''}>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Not mapped --</SelectItem>
                          {parsedData.headers.filter(h => h && h.trim()).map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {!isMappingComplete && (
                      <>
                        <AlertCircle className="h-4 w-4 text-warning" />
                        Please map all required fields
                      </>
                    )}
                  </div>
                  <Button 
                    onClick={handleProcessInvoices} 
                    disabled={!isMappingComplete || isProcessing}
                  >
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Process Invoices
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <Card className="shadow-card">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Processing your invoices...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a moment depending on the number of records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result Step */}
        {step === 'result' && uploadResult && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Upload Complete
              </CardTitle>
              <CardDescription>
                Your invoice data has been processed successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{uploadResult.total_records || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">₹{(uploadResult.data?.summary?.total_taxable_value || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Taxable Value</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{uploadResult.data?.summary?.b2b_count || 0}</p>
                  <p className="text-sm text-muted-foreground">B2B Invoices</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{uploadResult.data?.summary?.b2cl_count || 0}</p>
                  <p className="text-sm text-muted-foreground">B2CL Invoices</p>
                </div>
              </div>

              {/* Validation Errors */}
              {uploadResult.validation_report?.errors && uploadResult.validation_report.errors.length > 0 && (
                <div className="p-4 border border-warning rounded-lg bg-warning/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <p className="font-medium">Validation Errors ({uploadResult.validation_report.errors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {uploadResult.validation_report.errors.slice(0, 10).map((err, idx) => (
                      <p key={idx} className="text-sm text-muted-foreground">
                        {err}
                      </p>
                    ))}
                    {uploadResult.validation_report.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {uploadResult.validation_report.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button onClick={handleViewGSTR1}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  View GSTR-1 Tables
                </Button>
                <Button variant="outline" onClick={handleViewGSTR3B}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  View GSTR-3B Summary
                </Button>
                <Button variant="ghost" onClick={resetUpload}>
                  Upload Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
