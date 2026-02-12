import { useState, useCallback } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
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
import { validateInvoice, determineInvoiceType, validatePurchaseInvoice } from '@/lib/validation';
import { Loader2 } from 'lucide-react';

type InvoiceCategory = 'sales' | 'purchase';

export default function UploadPage() {
  const [invoiceCategory, setInvoiceCategory] = useState<InvoiceCategory>('sales');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcel | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing'>('upload');
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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
    if (!parsedData || !user || !isMappingComplete) return;

    setStep('processing');
    setIsProcessing(true);

    try {
      // Create upload session
      const { data: session, error: sessionError } = await supabase
        .from('upload_sessions')
        .insert({
          user_id: user.id,
          file_name: file?.name || 'Unknown',
          row_count: parsedData.rows.length,
          status: 'processing',
          column_mappings: columnMapping,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Get seller state code from profile GSTIN
      const sellerStateCode = profile?.gstin?.substring(0, 2) || '27'; // Default to MH

      // Process and validate each invoice
      const invoices = parsedData.rows.map(row => {
        const mapped = mapRowToInvoice(row, columnMapping as ColumnMapping);
        
        // Use different validation for purchase vs sales
        const validation = invoiceCategory === 'purchase' 
          ? validatePurchaseInvoice({
              ...mapped,
              supplier_gstin: mapped.customer_gstin, // Map customer_gstin to supplier_gstin for purchases
            })
          : validateInvoice(mapped);
        
        // Only determine invoice type for sales invoices
        const invoiceType = invoiceCategory === 'sales' 
          ? determineInvoiceType(
              mapped.customer_gstin,
              mapped.place_of_supply,
              sellerStateCode,
              mapped.total_amount
            )
          : 'PURCHASE';

        return {
          upload_session_id: session.id,
          user_id: user.id,
          invoice_number: mapped.invoice_number,
          invoice_date: mapped.invoice_date,
          customer_name: invoiceCategory === 'sales' ? mapped.customer_name : null,
          customer_gstin: invoiceCategory === 'sales' ? mapped.customer_gstin : null,
          supplier_name: invoiceCategory === 'purchase' ? mapped.customer_name : null,
          supplier_gstin: invoiceCategory === 'purchase' ? mapped.customer_gstin : null,
          place_of_supply: mapped.place_of_supply,
          hsn_code: mapped.hsn_code,
          taxable_value: mapped.taxable_value,
          cgst_rate: mapped.cgst_rate,
          cgst_amount: mapped.cgst_amount,
          sgst_rate: mapped.sgst_rate,
          sgst_amount: mapped.sgst_amount,
          igst_rate: mapped.igst_rate,
          igst_amount: mapped.igst_amount,
          total_amount: mapped.total_amount,
          invoice_type: invoiceType,
          invoice_category: invoiceCategory,
          validation_status: validation.status,
          validation_errors: JSON.parse(JSON.stringify(validation.errors)),
          raw_data: JSON.parse(JSON.stringify(mapped.raw_data)),
        };
      });

      // Insert invoices in batches
      const batchSize = 100;
      for (let i = 0; i < invoices.length; i += batchSize) {
        const batch = invoices.slice(i, i + batchSize);
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert(batch);

        if (invoiceError) throw invoiceError;
      }

      // Update session status
      await supabase
        .from('upload_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      const categoryLabel = invoiceCategory === 'sales' ? 'sales' : 'purchase';
      toast({
        title: 'Upload complete!',
        description: `Successfully processed ${invoices.length} ${categoryLabel} invoices.`,
      });

      // Navigate to invoice preview
      navigate('/invoices');
    } catch (error) {
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process invoices',
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
                          {parsedData.headers.map((header) => (
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
      </div>
    </DashboardLayout>
  );
}
