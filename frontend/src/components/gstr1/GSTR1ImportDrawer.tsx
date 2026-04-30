/**
 * GSTR-1 Import File Drawer Component
 * 
 * ClearTax-style import drawer for uploading sales register:
 * - Drag & drop upload box
 * - Template download cards (Virtual CA Sales Template, GSTR-1 Govt. Template)
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  X, 
  FileCheck,
  Loader2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerFooter,
  DrawerClose
} from '@/components/ui/drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { parseExcelFile, autoMapColumns, type ColumnMapping } from '@/lib/excel-parser';

// Props
interface GSTR1ImportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File, mapping: Partial<ColumnMapping>) => void;
}

export default function GSTR1ImportDrawer({ 
  open, 
  onOpenChange, 
  onImport 
}: GSTR1ImportDrawerProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  
  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;
    
    setIsLoading(true);
    try {
      const parsed = await parseExcelFile(uploadedFile);
      setFile(uploadedFile);
      setParsedHeaders(parsed.headers);
      
      toast({
        title: 'File uploaded',
        description: `Found ${parsed.rows.length} rows in ${uploadedFile.name}`,
      });
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Failed to parse file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });
  
  // Handle import
  const handleImport = () => {
    if (!file) return;
    
    const mapping = autoMapColumns(parsedHeaders) as ColumnMapping;
    onImport(file, mapping);
    onOpenChange(false);
    
    // Reset state
    setFile(null);
    setParsedHeaders([]);
  };
  
  // Handle clear
  const handleClear = () => {
    setFile(null);
    setParsedHeaders([]);
  };
  
  // Handle template download
  const handleDownloadTemplate = (templateType: 'cleartax' | 'govt') => {
    // Create a link element to trigger download
    const link = document.createElement('a');
    if (templateType === 'cleartax') {
      link.href = '/VirtualCA_Template.xlsx';
      link.download = 'VirtualCA_Template.xlsx';
      toast({
        title: 'Download Started',
        description: 'Downloading Virtual CA Sales Template...',
      });
    } else {
      link.href = '/Govt_Template.xlsx';
      link.download = 'Govt_Template.xlsx';
      toast({
        title: 'Download Started',
        description: 'Downloading GSTR-1 Govt. Template...',
      });
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Sales Register
          </DrawerTitle>
          <DrawerDescription>
            Upload your sales register Excel file to import data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Upload Box */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-corporate-primary bg-corporate-primary/5' 
                : 'border-slate-300 dark:border-slate-600 hover:border-corporate-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-corporate-primary animate-spin" />
                <p className="text-slate-500">Processing file...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <FileCheck className="h-10 w-10 text-green-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                  <p className="text-sm text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Badge variant="secondary">
                  {parsedHeaders.length} columns detected
                </Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-corporate-primary/10 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-corporate-primary" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file here'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    or click to browse from your computer
                  </p>
                </div>
                <Badge variant="secondary">.xlsx, .xls, .csv</Badge>
              </div>
            )}
          </div>
          
          {/* Template Download Cards */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Download Templates
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Virtual CA Template */}
              <Card 
                className="cursor-pointer hover:border-corporate-primary/50 transition-colors"
                onClick={() => handleDownloadTemplate('cleartax')}
              >
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium">Virtual CA Template</p>
                  <Button variant="ghost" size="sm" className="mt-2">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>
              
              {/* Govt Template */}
              <Card 
                className="cursor-pointer hover:border-corporate-primary/50 transition-colors"
                onClick={() => handleDownloadTemplate('govt')}
              >
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium">Government Template</p>
                  <Button variant="ghost" size="sm" className="mt-2">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <DrawerFooter className="flex-row justify-between gap-2">
          {file && (
            <Button variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
          <div className="flex-1" />
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
          <Button 
            onClick={handleImport} 
            disabled={!file}
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            Import
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
