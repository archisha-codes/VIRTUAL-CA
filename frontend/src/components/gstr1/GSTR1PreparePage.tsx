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
import { useNavigate } from 'react-router-dom';
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
import GSTR1DrawerFlow from './GSTR1DrawerFlow';
import { useToast } from '@/hooks/use-toast';
import { useActiveWorkspace, useActiveBusiness } from '@/store/tenantStore';
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
import { useTenantStore } from '@/store/tenantStore';


interface GSTR1PreparePageProps {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR1PreparePage({ gstin, returnPeriod }: GSTR1PreparePageProps) {
  const { toast } = useToast();
  const activeWorkspace = useActiveWorkspace();
  const { businesses: allWorkspaceBusinesses } = useTenantStore();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [otpDrawerOpen, setOtpDrawerOpen] = useState(false);

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
    const normalize = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

      // Remove all non-numeric characters except decimal point and minus sign
      const clean = String(val).replace(/[^\d.-]/g, '');
      const parsed = parseFloat(clean);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getVal = (obj: any, keys: string[]): number => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
          return normalize(obj[k]);
        }
      }
      return 0;
    };

    const calculateTotal = (arr: any[]) => {
      return arr.reduce((acc, item) => {
        const items = item.items || item.invoices || item.notes || [item];
        return acc + items.reduce((sum: number, i: any) => {
          return sum + getVal(i, ['taxable_value', 'txval', 'taxable_amount', 'taxableValue', 'taxableAmount']);
        }, 0);
      }, 0);
    };

    const calculateInvoiceValue = (arr: any[]) => {
      return arr.reduce((acc, item) => {
        const items = item.items || item.invoices || item.notes || [item];
        return acc + items.reduce((sum: number, i: any) => {
          return sum + getVal(i, ['total_amount', 'invoice_value', 'val', 'total_value', 'invoiceValue', 'totalAmount']);
        }, 0);
      }, 0);
    };

    const calculateTax = (arr: any[], taxField: 'igst' | 'cgst' | 'sgst' | 'cess') => {
      const fieldMap: Record<string, string[]> = {
        'igst': ['igst_amount', 'iamt', 'igst', 'integrated_tax'],
        'cgst': ['cgst_amount', 'camt', 'cgst', 'central_tax'],
        'sgst': ['sgst_amount', 'samt', 'sgst', 'state_tax'],
        'cess': ['cess_amount', 'csamt', 'cess']
      };
      const aliases = fieldMap[taxField];

      return arr.reduce((acc, item) => {
        const items = item.items || item.invoices || item.notes || [item];
        return acc + items.reduce((sum: number, i: any) => {
          return sum + getVal(i, aliases);
        }, 0);
      }, 0);
    };

    const b2bData = gstr1Data.b2b || [];
    const b2clData = gstr1Data.b2cl || [];
    const b2csData = gstr1Data.b2cs || [];
    const expData = gstr1Data.exp || [];
    const cdnrData = gstr1Data.cdnr || [];
    const cdnurData = gstr1Data.cdnur || [];

    const totalDocs = b2bCount + b2clCount + b2csCount + expCount + cdnrCount + (gstr1Data.cdnur?.length || 0);
    const taxableAmount = calculateTotal([...b2bData, ...b2clData, ...b2csData, ...expData, ...cdnrData, ...cdnurData]);
    const totalInvoiceValue = calculateInvoiceValue([...b2bData, ...b2clData, ...b2csData, ...expData, ...cdnrData, ...cdnurData]);
    const totalIgst = calculateTax([...b2bData, ...b2clData, ...expData, ...cdnrData, ...cdnurData], 'igst');
    const totalCgst = calculateTax([...b2bData, ...b2clData, ...b2csData, ...cdnrData, ...cdnurData], 'cgst');
    const totalSgst = calculateTax([...b2bData, ...b2clData, ...b2csData, ...cdnrData, ...cdnurData], 'sgst');
    const totalCess = calculateTax([...b2bData, ...b2clData, ...b2csData, ...expData, ...cdnrData, ...cdnurData], 'cess');
    const totalTax = totalIgst + totalCgst + totalSgst + totalCess;

    // Create sections data
    const sections = [] as Array<{ id: string; name: string; docCount: number; taxableAmount: number; tax: number }>;
    if (b2bCount > 0) sections.push({ id: 'b2b', name: 'B2B', docCount: b2bCount, taxableAmount: calculateTotal(b2bData), tax: calculateTax(b2bData, 'igst') + calculateTax(b2bData, 'cgst') + calculateTax(b2bData, 'sgst') + calculateTax(b2bData, 'cess') });
    if (b2clCount > 0) sections.push({ id: 'b2cl', name: 'B2CL', docCount: b2clCount, taxableAmount: calculateTotal(b2clData), tax: calculateTax(b2clData, 'igst') + calculateTax(b2clData, 'cess') });
    if (b2csCount > 0) sections.push({ id: 'b2cs', name: 'B2CS', docCount: b2csCount, taxableAmount: calculateTotal(b2csData), tax: calculateTax(b2csData, 'cgst') + calculateTax(b2csData, 'sgst') + calculateTax(b2csData, 'cess') });
    if (expCount > 0) sections.push({ id: 'exp', name: 'Export', docCount: expCount, taxableAmount: calculateTotal(expData), tax: calculateTax(expData, 'igst') + calculateTax(expData, 'cess') });
    if (cdnrCount > 0) sections.push({ id: 'cdnr', name: 'CDN/R', docCount: cdnrCount, taxableAmount: calculateTotal(cdnrData), tax: calculateTax(cdnrData, 'igst') + calculateTax(cdnrData, 'cgst') + calculateTax(cdnrData, 'sgst') + calculateTax(cdnrData, 'cess') });

    if (allWorkspaceBusinesses.length > 0) {
      return allWorkspaceBusinesses.map(biz => {
        const isSelected = biz.gstin === selectedGstin;
        return {
          id: biz.id,
          businessName: biz.legal_name,
          gstins: [{
            id: biz.id + "-gstin",
            gstin: biz.gstin,
            legalName: biz.legal_name,
            state: biz.trade_name || 'State',
            status: isSelected ? 'pending' : 'not_started',
            isConnected: isSelected ? (activeWorkspace?.gstins?.find(p => p.gstin === selectedGstin)?.status === 'active') : false,
            docCount: isSelected ? totalDocs : 0,
            taxableAmount: isSelected ? taxableAmount : 0,
            totalTax: isSelected ? totalTax : 0,
            totalInvoiceValue: isSelected ? totalInvoiceValue : 0,
            igst: isSelected ? totalIgst : 0,
            cgst: isSelected ? totalCgst : 0,
            sgst: isSelected ? totalSgst : 0,
            cess: isSelected ? totalCess : 0,
            sections: isSelected ? sections : []
          }]
        };
      });
    }

    return [{
      id: '1',
      businessName: selectedGstin,
      gstins: [{
        id: '1',
        gstin: selectedGstin,
        legalName: selectedGstin,
        state: 'State',
        status: 'pending',
        isConnected: activeWorkspace?.gstins?.find(p => p.gstin === selectedGstin)?.status === 'active',
        docCount: totalDocs,
        taxableAmount,
        totalTax,
        totalInvoiceValue,
        igst: totalIgst,
        cgst: totalCgst,
        sgst: totalSgst,
        cess: totalCess,
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
        throw new Error((result as any).error || result.message || 'Processing failed');
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
        description: 'Please upload data before validating.',
        variant: 'destructive',
      });
      return;
    }

    // Check if any selected GSTINs (or the main one) are not connected
    const unconnectedGstins = businesses.flatMap(b => b.gstins)
      .filter(g => (selectedGstins.length === 0 || selectedGstins.includes(g.gstin)) && !g.isConnected);

    if (unconnectedGstins.length > 0) {
      // Open the Connect GSTINs drawer
      setOtpDrawerOpen(true);
    } else {
      // Proceed to checking errors step
      toast({
        title: 'Validation Successful',
        description: 'All GSTINs connected. Moving to error checks...',
      });

      // In a real app, this would navigate to the next step
      // For now, we'll simulate the validation success
      setTimeout(() => {
        navigate('/gst/gstr1/prepare', {
          state: {
            gstin,
            returnPeriod,
            step: 'checking-errors',
            uploadResult
          }
        });
      }, 1000);
    }
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
                onDelete={() => { }}
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
        returnPeriod={returnPeriod}
      />

      {otpDrawerOpen && (
        <GSTR1DrawerFlow
          open={otpDrawerOpen}
          onOpenChange={setOtpDrawerOpen}
          initialDrawer="otp"
          initialGstins={[gstin]}
          initialPeriod={returnPeriod}
          onContinue={() => {
            setOtpDrawerOpen(false);
            // Navigate to checking errors step
            navigate('/gst/gstr1/prepare', {
              state: {
                gstin,
                returnPeriod,
                step: 'checking-errors'
              }
            });
          }}
        />
      )}
    </div>
  );
}
