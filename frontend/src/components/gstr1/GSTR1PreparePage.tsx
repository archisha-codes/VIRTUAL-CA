/**
 * GSTR-1 Prepare Page Component
 * 
 * Enterprise SaaS-style prepare page for GSTR-1:
 * - Header with step indicator and action buttons
 * - Data table with expandable rows
 * - Filter drawer
 * - Import drawer
 * - Connected to backend APIs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Filter,
  Upload,
  Shield,
  ArrowRightLeft,
  MoreHorizontal,
  Clock,
  RefreshCw,
  Loader2,
  FileText,
  Download,
  Send,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import GSTR1PrepareTable, { type GSTR1BusinessData } from './GSTR1PrepareTable';
import GSTR1FiltersDrawer, { type GSTR1Filters } from './GSTR1FiltersDrawer';
import GSTR1ImportDrawer from './GSTR1ImportDrawer';
import GSTR1ActionsDropdown from './GSTR1ActionsDropdown';
import GSTR1SummaryDrawer from './GSTR1SummaryDrawer';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  processGSTR1Excel, 
  saveGstr1State, 
  getGstr1State,
  downloadGSTR1PANSummary,
  syncGSTR1FromGSTN,
  selectGSTR1ForNIL,
  type GSTR1ProcessResponse
} from '@/lib/api';
import { autoMapColumns, type ColumnMapping } from '@/lib/excel-parser';
import { useNavigate } from 'react-router-dom';

interface GSTR1PreparePageProps {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR1PreparePage({ gstin, returnPeriod }: GSTR1PreparePageProps) {
  const { toast } = useToast();
  const { currentOrganization } = useAuth();
  const navigate = useNavigate();
  const workspaceId = currentOrganization?.id;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  
  // Custom View Sections Drawer State
  const [summaryDrawerOpen, setsummaryDrawerOpen] = useState(false);
  const [selectedSummaryGstin, setselectedSummaryGstin] = useState('');
  const [selectedSummaryBusinessName, setselectedSummaryBusinessName] = useState('');
  const [activeFilters, setActiveFilters] = useState<GSTR1Filters | null>(null);
  const [businesses, setBusinesses] = useState<GSTR1BusinessData[]>([]);
  const [selectedGstins, setSelectedGstins] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(null);

  // Load data from backend
  const loadData = useCallback(async () => {
    if (!workspaceId || !gstin || !returnPeriod) {
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    try {
      // Try to load saved state from backend
      const response = await getGstr1State(workspaceId, gstin, returnPeriod);
      
      if (response.success && response.data) {
        // Data exists - transform to table format
        const savedState = response.data;
        
        if (savedState.gstr1_tables || savedState.upload_result) {
          const data = savedState.upload_result as unknown as GSTR1ProcessResponse;
          if (data?.data) {
            setUploadResult(data);
            
            // Transform to business data format
            const businessData = transformToBusinessData(data, gstin);
            setBusinesses(businessData);
          }
        }
        
        if (savedState.last_saved) {
          setLastSaved(new Date(savedState.last_saved));
        }
      } else {
        // No saved data - show empty state
        setBusinesses([]);
      }
    } catch (error) {
      // Backend not available - gracefully handle without crashing
      console.warn('Backend not available, showing empty state:', error);
      setBusinesses([]);
      setUploadResult(null);
    } finally {
      setIsLoadingData(false);
    }
  }, [workspaceId, gstin, returnPeriod]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Transform backend data to table format
  const transformToBusinessData = (data: GSTR1ProcessResponse, selectedGstin: string): GSTR1BusinessData[] => {
    const gstr1Data = data.data;
    
    // Calculate totals from all sections
    const b2bCount = gstr1Data.b2b?.length || 0;
    const b2clCount = gstr1Data.b2cl?.length || 0;
    const b2csCount = gstr1Data.b2cs?.length || 0;
    const expCount = gstr1Data.exp?.length || 0;
    const cdnrCount = gstr1Data.cdnr?.length || 0;
    
    // Calculate totals
    const calculateTotal = (arr: any[]) => {
      return arr.reduce((acc, item) => {
        const items = item.items || item.invoices || [item];
        return acc + items.reduce((sum: number, i: any) => {
          return sum + (i.taxable_value || i.txval || 0);
        }, 0);
      }, 0);
    };
    
    const calculateTax = (arr: any[], taxField: string) => {
      return arr.reduce((acc, item) => {
        const items = item.items || item.invoices || [item];
        return acc + items.reduce((sum: number, i: any) => {
          return sum + (i[taxField] || 0);
        }, 0);
      }, 0);
    };

    const b2bData = gstr1Data.b2b || [];
    const b2clData = gstr1Data.b2cl || [];
    const b2csData = gstr1Data.b2cs || [];
    const expData = gstr1Data.exp || [];
    const cdnrData = gstr1Data.cdnr || [];

    const totalDocs = b2bCount + b2clCount + b2csCount + expCount + cdnrCount;
    const taxableAmount = calculateTotal([...b2bData, ...b2clData, ...b2csData, ...expData]);
    const totalIgst = calculateTax([...b2bData, ...b2clData, ...expData], 'igst_amount') + 
                       calculateTax([...b2bData, ...b2clData, ...expData], 'iamt');
    const totalCgst = calculateTax([...b2bData, ...b2clData, ...b2csData], 'cgst_amount') + 
                       calculateTax([...b2bData, ...b2clData, ...b2csData], 'camt');
    const totalSgst = calculateTax([...b2bData, ...b2clData, ...b2csData], 'sgst_amount') + 
                       calculateTax([...b2bData, ...b2clData, ...b2csData], 'samt');
    const totalTax = totalIgst + totalCgst + totalSgst;

    // Create sections data
    const sections = [] as Array<{id: string; name: string; docCount: number; taxableAmount: number; tax: number}>;
    if (b2bCount > 0) sections.push({ id: 'b2b', name: 'B2B', docCount: b2bCount, taxableAmount: calculateTotal(b2bData), tax: calculateTax(b2bData, 'igst_amount') + calculateTax(b2bData, 'cgst_amount') });
    if (b2clCount > 0) sections.push({ id: 'b2cl', name: 'B2CL', docCount: b2clCount, taxableAmount: calculateTotal(b2clData), tax: calculateTax(b2clData, 'igst_amount') + calculateTax(b2clData, 'cgst_amount') });
    if (b2csCount > 0) sections.push({ id: 'b2cs', name: 'B2CS', docCount: b2csCount, taxableAmount: calculateTotal(b2csData), tax: calculateTax(b2csData, 'igst_amount') + calculateTax(b2csData, 'cgst_amount') });
    if (expCount > 0) sections.push({ id: 'exp', name: 'Export', docCount: expCount, taxableAmount: calculateTotal(expData), tax: calculateTax(expData, 'igst_amount') });
    if (cdnrCount > 0) sections.push({ id: 'cdnr', name: 'CDN/R', docCount: cdnrCount, taxableAmount: calculateTotal(cdnrData), tax: calculateTax(cdnrData, 'igst_amount') + calculateTax(cdnrData, 'cgst_amount') });

    return [{
      id: '1',
      businessName: selectedGstin,
      gstins: [{
        id: '1',
        gstin: selectedGstin,
        legalName: selectedGstin,
        state: 'State',
        status: 'pending',
        docCount: totalDocs,
        taxableAmount,
        totalTax,
        igst: totalIgst,
        cgst: totalCgst,
        sgst: totalSgst,
        cess: 0,
        sections
      }]
    }];
  };

  // Handle filters apply
  const handleFiltersApply = (filters: GSTR1Filters) => {
    setActiveFilters(filters);
    toast({
      title: 'Filters Applied',
      description: `Filtered by ${filters.gstin !== 'all' ? filters.gstin : 'all GSTINs'}, ${filters.filingStatus === 'all' ? 'all statuses' : filters.filingStatus}`,
    });
  };

  // Handle file import
  const handleFileImport = async (file: File, mapping: Partial<ColumnMapping>) => {
    setIsLoading(true);
    try {
      const mappingDict: Record<string, string> = {};
      Object.entries(mapping).forEach(([key, value]) => {
        if (value) mappingDict[key] = value;
      });

      const result = await processGSTR1Excel(file, mappingDict, gstin, returnPeriod, workspaceId);
      
      if (result.success && result.data) {
        setUploadResult(result);
        
        // Transform to table format
        const businessData = transformToBusinessData(result, gstin);
        setBusinesses(businessData);
        
        // Save to backend
        await saveGstr1State(workspaceId!, gstin, returnPeriod, {
          currentStep: 'upload',
          stepData: { file: file.name },
          validationStatus: {},
          gstr1Tables: result.data,
          uploadResult: result as unknown as Record<string, unknown>,
          classificationResult: null,
          validationResult: null,
          filingResult: null,
        });
        
        setLastSaved(new Date());
        
        toast({
          title: 'File Imported',
          description: `Processed ${result.total_records || 0} records successfully`,
        });
      } else {
        throw new Error(result.message || 'Processing failed');
      }
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle download PAN summary
  const handleDownloadPANSummary = async () => {
    if (!workspaceId) return;
    try {
      await downloadGSTR1PANSummary(workspaceId, gstin, returnPeriod);
      toast({
        title: 'Download Started',
        description: 'Downloading PAN Summary...',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download PAN summary',
        variant: 'destructive',
      });
    }
  };

  // Handle sync from GSTN
  const handleSyncFromGSTN = async () => {
    if (!workspaceId) return;
    try {
      const result = await syncGSTR1FromGSTN(workspaceId, gstin, returnPeriod);
      if (result.success) {
        toast({
          title: 'Sync Initiated',
          description: 'Syncing from GSTN...',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync from GSTN',
        variant: 'destructive',
      });
    }
  };

  // Handle select for NIL
  const handleSelectForNIL = async () => {
    if (!workspaceId) return;
    try {
      await selectGSTR1ForNIL(workspaceId, gstin, returnPeriod);
      toast({
        title: 'NIL Return Selected',
        description: 'Selected for NIL returns',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to select for NIL returns',
        variant: 'destructive',
      });
    }
  };

  // Handle select source
  const handleSelectSource = () => {
    toast({
      title: 'Select Summary Source',
      description: 'Opening summary source selection...',
    });
  };

  // Handle E-Invoice reconciliation
  const handleReconciliation = () => {
    navigate('/gstr1/reconciliation');
  };

  // Handle validate
  const handleValidate = () => {
    if (businesses.length === 0) {
      toast({
        title: 'No Data',
        description: 'Please import data first',
        variant: 'destructive',
      });
      return;
    }
    // Navigate to validation step in workflow
    navigate('/gst/gstr1/prepare', { 
      state: { 
        gstin, 
        returnPeriod, 
        fromDrawer: true,
        step: 'validation'
      } 
    });
  };

  // Handle view sections
  const handleViewSections = (gstinId: string) => {
    // Find the business name to pass to drawer
    let busName = '';
    for (const b of businesses) {
      if (b.gstins.some(g => g.gstin === gstinId)) {
        busName = b.businessName;
        break;
      }
    }
    setselectedSummaryGstin(gstinId);
    setselectedSummaryBusinessName(busName);
    setsummaryDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/gst/gstr1')}
                className="h-10 w-10 text-slate-500 hover:bg-slate-100 rounded-full shrink-0"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Step 1/3: Prepare GSTR-1
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  GSTIN: <span className="font-mono">{gstin}</span> | Period: <span className="font-mono">{returnPeriod}</span>
                </p>
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="flex items-center gap-2">
              {/* E-Invoice vs Sales Register Recon Button */}
              <Button 
                variant="outline" 
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleReconciliation}
              >
                <ArrowRightLeft className="h-4 w-4" />
                E-Invoice (GSTR-1) vs SR Recon
              </Button>
              
              {/* Filters Button */}
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setFiltersDrawerOpen(true)}
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              
              {/* Import File Button */}
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setImportDrawerOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Import File
              </Button>
              
              {/* Actions Dropdown */}
              <GSTR1ActionsDropdown 
                onDownloadPAN={handleDownloadPANSummary}
                onSyncGSTN={handleSyncFromGSTN}
                onSelectNIL={handleSelectForNIL}
                onSelectSource={handleSelectSource}
                onDelete={() => {}}
              />
              
              {/* Validate and Upload Button */}
              <Button 
                className="gap-2 bg-corporate-primary hover:bg-corporate-primaryHover"
                onClick={handleValidate}
              >
                <Shield className="h-4 w-4" />
                Validate and Upload
              </Button>
            </div>
          </div>
          
          {/* Second row with last saved */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lastSaved && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  Last saved: {lastSaved.toLocaleTimeString()}
                </div>
              )}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {businesses.length > 0 ? 'Data Loaded' : 'No Data'}
              </Badge>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Loading State */}
        {isLoadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-corporate-primary" />
            <span className="ml-2 text-slate-500">Loading data...</span>
          </div>
        ) : (
          /* Data Table */
          <GSTR1PrepareTable 
            businesses={businesses}
            onSelectionChange={setSelectedGstins}
            onViewSections={handleViewSections}
          />
        )}
      </div>
      
      {/* Filters Drawer */}
      <GSTR1FiltersDrawer
        open={filtersDrawerOpen}
        onOpenChange={setFiltersDrawerOpen}
        onApply={handleFiltersApply}
        availableGstins={[gstin]}
        initialFilters={activeFilters}
      />
      
      {/* Import Drawer */}
      <GSTR1ImportDrawer
        open={importDrawerOpen}
        onOpenChange={setImportDrawerOpen}
        onImport={handleFileImport}
      />
      {/* Drawers */}
      <GSTR1SummaryDrawer 
        open={summaryDrawerOpen}
        onOpenChange={setsummaryDrawerOpen}
        gstin={selectedSummaryGstin}
        businessName={selectedSummaryBusinessName}
        businesses={businesses}
        onSelectGstin={(gstin, businessName) => {
          setselectedSummaryGstin(gstin);
          setselectedSummaryBusinessName(businessName);
        }}
      />
    </div>
  );
}
