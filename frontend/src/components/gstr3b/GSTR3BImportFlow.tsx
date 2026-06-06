import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  X, 
  FileCheck,
  Loader2,
  FileText,
  Trash2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { useActiveWorkspace } from '@/store/tenantStore';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

// Steps for the import flow
type ImportStep = 'INITIAL' | 'UPLOAD' | 'FILE_DETAILS' | 'PROCESSING';

interface GSTR3BImportFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function GSTR3BImportFlow({ open, onOpenChange, onComplete }: GSTR3BImportFlowProps) {
  const { toast } = useToast();
  const activeWorkspace = useActiveWorkspace();
  
  // State
  const [currentStep, setCurrentStep] = useState<ImportStep>('INITIAL');
  const [docType, setDocType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  
  // Reset state when closed
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCurrentStep('INITIAL');
        setDocType('');
        setFile(null);
        setTemplateType('');
      }, 300);
    }
  }, [open]);

  // Step 1: Initial Type Selection
  const handleNextFromInitial = () => {
    if (!docType) {
      toast({ title: 'Please select a document type', variant: 'destructive' });
      return;
    }
    setCurrentStep('UPLOAD');
  };

  // Step 2: Dropzone & Upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;
    
    setIsUploading(true);
    // Real processing would happen here
    setFile(uploadedFile);
    setIsUploading(false);
    setCurrentStep('FILE_DETAILS');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = (type: 'virtualca' | 'govt') => {
    const link = document.createElement('a');
    if (type === 'virtualca') {
      link.href = '/VirtualCA_Template.xlsx';
      link.download = 'VirtualCA_Template.xlsx';
      toast({
        title: 'Download Started',
        description: 'Downloading Virtual CA Template...',
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

  // Step 3 & 4: File Details and Processing
  const handleCheckFile = () => {
    if (!templateType) {
      toast({ title: 'Please select a template type', variant: 'destructive' });
      return;
    }
    setCurrentStep('PROCESSING');
  };

  React.useEffect(() => {
    if (currentStep === 'PROCESSING') {
      // Real ingestion would happen here
      if (onComplete) onComplete();
      onOpenChange(false);
    }
  }, [currentStep, onComplete, onOpenChange]);

  // Renders
  const renderInitial = () => (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex justify-between items-center text-lg font-medium text-slate-800">
          <span>Import File</span>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4" /></Button>
          </DialogClose>
        </DialogTitle>
        <DialogDescription className="hidden">Select the type of document to import</DialogDescription>
      </DialogHeader>
      
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-32 h-32 bg-blue-50 rounded-full mb-6 flex items-center justify-center relative">
          <img src="https://assets1.cleartax-cdn.com/cleartax-gst/cleartax-gst-assets/import-files.svg" alt="Import illustration" className="w-24 h-24" onError={(e) => e.currentTarget.style.display='none'} />
          <div className="absolute flex h-full w-full items-center justify-center">
             <Upload className="h-12 w-12 text-blue-500" />
          </div>
        </div>
        
        <h3 className="text-xl text-center font-medium text-slate-800 mb-2 max-w-sm">
          Import a purchase register, sales register or a prepared GSTR-3B summary
        </h3>
        <p className="text-sm text-slate-500 mb-8 text-center max-w-md">
          You can also do this later after checking prefilled GSTR-3B
        </p>

        <div className="w-full max-w-sm mx-auto space-y-2">
          <label className="text-sm font-medium text-slate-700">Document type of importing file</label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-full h-11">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">Purchase register</SelectItem>
              <SelectItem value="sales">Sales register</SelectItem>
              <SelectItem value="gstr3b">GSTR-3B summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t bg-slate-50">
        <Button 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white h-11"
          onClick={handleNextFromInitial}
        >
          Import File &rarr;
        </Button>
      </DialogFooter>
    </>
  );

  const renderUpload = () => (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentStep('INITIAL')}>
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <DialogTitle className="text-lg font-medium text-slate-800">
               Upload {docType === 'purchase' ? 'Purchase register' : docType === 'sales' ? 'Sales register' : 'GSTR-3B summary'}
             </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4" /></Button>
          </DialogClose>
        </div>
        <DialogDescription className="hidden">Upload file via drag and drop</DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        <div
          {...getRootProps()}
          className={`bg-white border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50/50' 
              : 'border-blue-200 hover:border-blue-400'
          }`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">Processing file...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded flex items-center justify-center">
                 <FileText className="h-8 w-8 text-blue-500" />
                 <span className="absolute text-[10px] font-bold text-white bg-blue-500 px-1 rounded-sm -mr-6 mt-4">+</span>
              </div>
              <div>
                <p className="font-semibold text-blue-600 text-[15px]">Select a file to import</p>
                <p className="text-sm text-slate-500 mt-1">or drag and drop your file in this box</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
          <p className="text-sm font-medium text-slate-800">Don't have a file to import?</p>
          <div className="space-y-3">
            <div 
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleDownloadTemplate('virtualca')}
            >
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Download className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Virtual CA Template</span>
            </div>
            
            <div 
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleDownloadTemplate('govt')}
            >
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Download className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">GSTR-1 Govt. Template</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderFileDetails = () => (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setFile(null); setCurrentStep('UPLOAD'); }}>
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <DialogTitle className="text-lg font-medium text-slate-800">File details</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4" /></Button>
          </DialogClose>
        </div>
        <DialogDescription className="hidden">Review file details before importing</DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 1. File selected */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-slate-700">1. File selected for import</label>
          <div className="flex items-center justify-between border rounded-md p-3 bg-white">
            <span className="text-sm text-slate-600">{file?.name || 'document.xlsx'}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => { setFile(null); setCurrentStep('UPLOAD'); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 2. Business */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-slate-700">2. Business (PAN/GSTIN)</label>
          <Select defaultValue="active">
            <SelectTrigger className="w-full text-left truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active" className="truncate max-w-[350px]">
                {activeWorkspace?.name || 'Workspace'}: GSTIN - {activeWorkspace?.gstins?.[0]?.gstin || 'No GSTIN'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 3. Return Period */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-slate-700">3. Return period</label>
          <div className="flex items-center border rounded-md p-3 bg-white h-10 relative">
             <span className="text-sm text-slate-600">Mar 2026 &rarr; Mar 2026</span>
             <Calendar className="h-4 w-4 text-blue-500 absolute right-3" />
          </div>
        </div>

        {/* 4. Template */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-slate-700">4. Template to be used</label>
          <p className="text-[11px] text-slate-500">We check your file for required columns based on the template you select.</p>
          <Select value={templateType} onValueChange={setTemplateType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cleartax">Cleartax template</SelectItem>
              <SelectItem value="gstr1">gstr-1 govt template</SelectItem>
              <SelectItem value="gstr1a">gstr-1A govt template</SelectItem>
              <SelectItem value="custom">create custom template</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t bg-slate-50">
        <Button 
          className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 shadow-sm"
          onClick={handleCheckFile}
        >
          Check file for errors & duplicates &rarr;
        </Button>
      </DialogFooter>
    </>
  );

  const renderProcessing = () => (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-medium text-slate-800">Checking file for errors & duplicates</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4" /></Button>
          </DialogClose>
        </div>
        <DialogDescription className="hidden">Processing your import file</DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        
        {/* Animated Document Icon with Checkmarks */}
        <div className="relative mt-4 mb-6">
           <div className="h-20 w-16 bg-blue-500 rounded-md shadow-sm relative flex justify-center pt-2">
              <div className="h-10 w-12 bg-white/20 rounded-sm"></div>
           </div>
           {/* Animated left check */}
           <div className="absolute -left-6 top-6 h-8 w-8 bg-white border rounded-full flex items-center justify-center shadow-sm">
             <CheckCircle2 className="h-5 w-5 text-green-500" />
           </div>
           {/* Animated right progress line */}
           <div className="absolute -right-8 top-6 h-8 w-12 bg-white border rounded shadow-sm opacity-50"></div>
        </div>

        <p className="text-sm text-slate-700 font-medium mb-8">Please wait. This may take a few minutes.</p>

        {/* File Details Box */}
        <div className="w-full border rounded-lg overflow-hidden mb-6">
          <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500 tracking-wider">
            FILE DETAILS
          </div>
          <div className="bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700 font-medium">{file?.name || 'document.xlsx'}</span>
              </div>
              <span className="text-xs text-slate-500">{(file?.size ? (file.size / 1024).toFixed(0) : 5)} KB</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-sm border flex items-center justify-center">
                 <Building2 className="h-3 w-3 text-slate-400" />
              </div>
              <span className="text-sm text-slate-600 truncate flex-1">
                {activeWorkspace?.name || 'Workspace'} GSTIN - {activeWorkspace?.gstins?.[0]?.gstin || 'No GSTIN'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-600">Mar 2026 - Mar 2026</span>
            </div>

            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-600">{templateType === 'cleartax' ? 'Cleartax Template' : templateType === 'gstr1' ? 'GSTR-1 Govt. Template' : 'GSTR-1A Govt. Template'}</span>
            </div>
          </div>
        </div>

        {/* Success / Progress Message */}
        <div className="w-full rounded-lg border border-green-200 bg-white p-4 flex gap-3 shadow-sm">
           <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
           <div>
             <p className="font-semibold text-slate-800 text-[14px]">Your file is being processed...</p>
             <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
               Hurray! Your file has been uploaded successfully and is currently being processed. We will let you know when the ingestion is complete.
             </p>
           </div>
        </div>

      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`h-[100dvh] p-0 gap-0 overflow-hidden sm:max-w-md w-full bg-white transition-all duration-300 absolute right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right`}>
        {currentStep === 'INITIAL' && renderInitial()}
        {currentStep === 'UPLOAD' && renderUpload()}
        {currentStep === 'FILE_DETAILS' && renderFileDetails()}
        {currentStep === 'PROCESSING' && renderProcessing()}
      </DialogContent>
    </Dialog>
  );
}
