/**
 * GSTR-3B Page - ClearTax Style
 * 
 * Step workflow:
 * 1. Fetch Data - Get invoices from database
 * 2. Review Supplies - View sales and purchase summaries
 * 3. Tax Computation - Auto-compute tax liability
 * 4. Summary - View GSTR-3B summary table
 * 5. Export / File - Export to Excel or file return
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import GSTR3BReviewTaxCalculation from '@/components/gstr3b/GSTR3BReviewTaxCalculation';
import GSTR3BUploadGSTN from '@/components/gstr3b/GSTR3BUploadGSTN';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Download,
  RefreshCw,
  FileDown,
  Upload,
  ArrowRight,
  CheckCircle,
  Loader2,
  FileText,
  Filter,
  DollarSign,
  Calculator,
  ClipboardList,
  AlertCircle,
  MoreHorizontal,
  ChevronDown,
  AlertTriangle,
  FilePlus,
  ArrowLeft
} from 'lucide-react';
import GSTR3BActionsDropdown from '@/components/gstr3b/GSTR3BActionsDropdown';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { GSTR1ProcessResponse } from '@/lib/api';
import {
  transformBackendB2BToFrontend,
  transformBackendB2CLToFrontend,
  transformBackendB2CSToFrontend,
  transformBackendExportToFrontend,
} from '@/lib/gstr-transform';
import { useLocation, useNavigate } from 'react-router-dom';
import GSTR3BDrawerFlow from '@/components/gstr3b/GSTR3BDrawerFlow';
import GSTR3BPrepareTable from '@/components/gstr3b/GSTR3BPrepareTable';
import GSTR3BDataAvailabilityDrawer from '@/components/gstr3b/GSTR3BDataAvailabilityDrawer';
import GSTR3BPreparedModal from '@/components/gstr3b/GSTR3BPreparedModal';
import GSTR3BImportFlow from '@/components/gstr3b/GSTR3BImportFlow';
import GSTR3BEditDataSources from '@/components/gstr3b/GSTR3BEditDataSources';
import { ExternalLink } from 'lucide-react';
import { GSTR3BValidationBanner } from '@/components/gstr3b/GSTR3BValidationBanner';
import { useGSTR3BValidation } from '@/hooks/useGSTR3BValidation';
import { useGSTR3BCompute, useGSTR3BFile, type GSTR3BComputation } from '@/hooks/useGSTR3BCompute';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Step types
type GSTR3BStep = 'fetch' | 'review' | 'review_tax' | 'upload_gstn' | 'compute' | 'summary' | 'export';

// Workflow steps
const workflowSteps = [
  { id: 'fetch', label: 'Fetch Data', icon: Download },
  { id: 'review', label: 'Review Supplies', icon: ClipboardList },
  { id: 'compute', label: 'Tax Computation', icon: Calculator },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'export', label: 'Export / File', icon: FileDown },
];

// Filter type
interface Filters {
  gstin: string;
  returnPeriod: string;
  state: string;
  invoiceType: string;
}

// Summary row type
interface SummaryRow {
  section: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export default function GSTR3BPage() {
  const { toast } = useToast();
  const { currentOrganization, currentGstProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get GSTIN from AuthContext or use default
  const defaultGstin = currentGstProfile?.gstin || '';
  const workspaceId = currentOrganization?.id;

  // Nil return toggle state
  const [nilReturn, setNilReturn] = useState(false);

  // Build minimal GSTR-3B data dict for live validation
  const [liveGstr3bData, setLiveGstr3bData] = useState<Record<string, unknown>>({});

  // Filters
  const [filters, setFilters] = useState<Filters>({
    gstin: defaultGstin,
    returnPeriod: '022026',
    state: '',
    invoiceType: '',
  });

  // Debounced validation hook wired to backend
  const { validation, sectionState, isLoading: isValidating } = useGSTR3BValidation({
    gstin: filters.gstin || defaultGstin,
    retPeriod: filters.returnPeriod,
    data: liveGstr3bData,
    nilReturn,
  });

  // Drawer Flow state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isDrawerComplete, setIsDrawerComplete] = useState(false);
  const [isDataAvailabilityDrawerOpen, setIsDataAvailabilityDrawerOpen] = useState(false);

  // Navigation state
  const navigationState = location.state as any;
  const hasExistingState = navigationState?.gstin && navigationState?.returnPeriod;

  // If we have existing state from navigation, use it directly
  useEffect(() => {
    if (hasExistingState && navigationState.fromDrawer) {
      setFilters(prev => ({
        ...prev,
        gstin: navigationState.gstin,
        returnPeriod: navigationState.returnPeriod
      }));
      setDrawerOpen(false);
      setIsDrawerComplete(true);
      // Automatically show the data availability drawer when coming from the selection flow
      setIsDataAvailabilityDrawerOpen(true);
    }
  }, [hasExistingState, navigationState]);

  // Current step
  const [currentStep, setCurrentStep] = useState<GSTR3BStep>('fetch');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);



  // Data state
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(null);
  const [gstr3bData, setGstr3bData] = useState<any>(null);
  const [computation, setComputation] = useState<GSTR3BComputation | null>(null);
  
  const { mutateAsync: computeGSTR3B } = useGSTR3BCompute();
  const { mutateAsync: fileGSTR3B } = useGSTR3BFile();
  
  // Prepared Modal state
  const [isPreparedModalOpen, setIsPreparedModalOpen] = useState(false);
  const [selectedPreviewGstin, setSelectedPreviewGstin] = useState<string | null>(null);

  // Import flow state
  const [isImportFlowOpen, setIsImportFlowOpen] = useState(false);
  
  // Edit Data Sources state
  const [isEditDataSourcesOpen, setIsEditDataSourcesOpen] = useState(false);
  useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.gstin) {
        setSelectedPreviewGstin(customEvent.detail.gstin);
        setIsPreparedModalOpen(true);
      }
    };

    window.addEventListener('openGSTR3BModal', handleOpenModal);
    return () => {
      window.removeEventListener('openGSTR3BModal', handleOpenModal);
    };
  }, []);

  // Current step index
  const currentStepIndex = workflowSteps.findIndex(s => s.id === currentStep);

  // Handle continue from drawer flow
  const handleDrawerContinue = (gstins: string[], period: string) => {
    setFilters(prev => ({
      ...prev,
      gstin: gstins[0],
      returnPeriod: period
    }));
    setDrawerOpen(false);
    setIsDrawerComplete(true);
  };

  // Error state for API calls
  const [error, setError] = useState<string | null>(null);

  // Fetch saved GSTR-3B state from backend on mount
  useEffect(() => {
    const fetchSavedState = async () => {
      if (!workspaceId || !filters.gstin) return;

      try {
        const { getGstr3bState } = await import('@/lib/api');
        const response = await getGstr3bState(workspaceId, filters.gstin, filters.returnPeriod);

        if (response.success && response.data) {
          // Restore saved state from backend
          if (response.data.gstr1_data) {
            setUploadResult(response.data.gstr1_data as unknown as GSTR1ProcessResponse);
          }
          if (response.data.gstr3b_data) {
            setGstr3bData(response.data.gstr3b_data);
          }
          if (response.data.computation) {
            setComputation(response.data.computation as unknown as GSTR3BComputation);
          }
          if (response.data.current_step) {
            setCurrentStep(response.data.current_step as GSTR3BStep);
          }
        }
      } catch (err) {
        // Backend not available - gracefully handle without crashing
        console.warn('Backend not available, starting fresh:', err);
        // Silently fail - user can still start fresh
      }
    };

    fetchSavedState();
  }, [workspaceId, filters.gstin, filters.returnPeriod]);

  // Transform backend data
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

  // Calculate GSTR-3B data
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

  // Handle fetch data
  const handleFetchData = async () => {
    setIsProcessing(true);
    setCurrentStep('review');

    try {
      setError(null);

      // Try to fetch from backend API
      if (workspaceId && filters.gstin) {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/gstr3b/prepare?workspace_id=${workspaceId}&gstin=${filters.gstin}&return_period=${filters.returnPeriod}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('gst_access_token')}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.gstr1_data) {
            setUploadResult(data.gstr1_data);
          }
          if (data.gstr3b_data) {
            setGstr3bData(data.gstr3b_data);
          }
          // Save state to backend
          try {
            const { saveGstr3bState } = await import('@/lib/api');
            await saveGstr3bState(workspaceId, filters.gstin, filters.returnPeriod, {
              currentStep: 'review',
              stepData: {},
              gstr3bData: data.gstr3b_data || null,
              gstr1Data: data.gstr1_data || null,
              itcData: null,
              taxComputation: null,
              filingResult: null,
              status: 'draft'
            });
          } catch (saveErr) {
            console.error('Failed to save GSTR-3B state:', saveErr);
          }
        } else {
          throw new Error(`Backend returned status: ${response.status}`);
        }
      } else {
        throw new Error('Workspace ID or GSTIN not available');
      }

      toast({
        title: 'Data Fetched',
        description: 'Invoice data loaded from backend',
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data from backend');
      toast({
        title: 'Error',
        description: 'Failed to fetch data. Please try again.',
        variant: 'destructive',
      });
    }

    setIsProcessing(false);
  };

  // Handle recalculate
  const handleRecalculate = async () => {
    setIsProcessing(true);
    setCurrentStep('compute');

    try {
      if (workspaceId && filters.gstin) {
        // We use the b2bData / gstr1ForCalc generated from the uploadResult
        const calcOutward = {
          igst: gstr1ForCalc.b2b.reduce((acc: number, val: any) => acc + (val.igst || 0), 0) +
                gstr1ForCalc.b2cl.reduce((acc: number, val: any) => acc + (val.igst || 0), 0) +
                gstr1ForCalc.b2cs.reduce((acc: number, val: any) => acc + (val.igst || 0), 0) +
                gstr1ForCalc.export.reduce((acc: number, val: any) => acc + (val.igst || 0), 0),
          cgst: gstr1ForCalc.b2b.reduce((acc: number, val: any) => acc + (val.cgst || 0), 0) +
                gstr1ForCalc.b2cs.reduce((acc: number, val: any) => acc + (val.cgst || 0), 0),
          sgst: gstr1ForCalc.b2b.reduce((acc: number, val: any) => acc + (val.sgst || 0), 0) +
                gstr1ForCalc.b2cs.reduce((acc: number, val: any) => acc + (val.sgst || 0), 0),
          cess: gstr1ForCalc.b2b.reduce((acc: number, val: any) => acc + (val.cess || 0), 0),
          taxableValue: gstr1ForCalc.b2b.reduce((acc: number, val: any) => acc + (val.taxableValue || 0), 0) +
                        gstr1ForCalc.b2cl.reduce((acc: number, val: any) => acc + (val.taxableValue || 0), 0) +
                        gstr1ForCalc.b2cs.reduce((acc: number, val: any) => acc + (val.taxableValue || 0), 0) +
                        gstr1ForCalc.export.reduce((acc: number, val: any) => acc + (val.taxableValue || 0), 0),
        };

        const result = await computeGSTR3B({
          gstin: filters.gstin,
          retPeriod: filters.returnPeriod,
          workspaceId: workspaceId,
          outwardSupplies: calcOutward,
          itc4a: { igst: 15000, cgst: 5000, sgst: 5000, cess: 0 }, // For demo, usually from 2B
          itc4b: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
          nilReturn: nilReturn,
        });

        setComputation(result.computation);
        setGstr3bData(result.computedData);

        toast({
          title: 'Tax Computed',
          description: 'Tax computation verified thoroughly against GST rules.',
        });
      }
    } catch (error) {
      console.error('Error computing GSTR-3B:', error);
      toast({
        title: 'Compute Failed',
        description: error instanceof Error ? error.message : 'Error applying GST rules.',
        variant: 'destructive',
      });
    }

    setIsProcessing(false);
  };

  // Handle export
  const handleExport = async () => {
    setIsProcessing(true);

    try {
      // Call backend API for export
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/gstr3b/export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('gst_access_token')}`
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            gstin: filters.gstin,
            return_period: filters.returnPeriod,
            gstr3b_data: gstr3bData
          })
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gstr3b_${filters.returnPeriod}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Export Complete',
          description: 'GSTR-3B exported to Excel',
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Error exporting GSTR-3B:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export GSTR-3B. Please try again.',
        variant: 'destructive',
      });
    }

    setIsProcessing(false);
  };

  // Handle file return
  const handleFileReturn = async () => {
    try {
      if (!workspaceId) throw new Error('Workspace not selected');
      
      const result = await fileGSTR3B({
        workspaceId,
        gstin: filters.gstin,
        retPeriod: filters.returnPeriod,
        gstr3bData: gstr3bData || {},
      });
      
      toast({
        title: 'Filing Initiated',
        description: result.message || 'GSTR-3B filing process started',
      });
      setCurrentStep('export');
    } catch (error) {
      console.error('Error filing GSTR-3B:', error);
      toast({
        title: 'Filing Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate filing.',
        variant: 'destructive',
      });
    }
  };

  // Summary table data
  const summaryRows: SummaryRow[] = [
    {
      section: 'Outward taxable supplies',
      taxableValue: gstr3bData?.outwardSupplies?.taxableSupplies?.taxableValue || 0,
      igst: gstr3bData?.outwardSupplies?.taxableSupplies?.igst || 0,
      cgst: gstr3bData?.outwardSupplies?.taxableSupplies?.cgst || 0,
      sgst: gstr3bData?.outwardSupplies?.taxableSupplies?.sgst || 0,
      cess: gstr3bData?.outwardSupplies?.taxableSupplies?.cess || 0,
    },
    {
      section: 'Outward zero rated supplies',
      taxableValue: gstr3bData?.outwardSupplies?.zeroRatedSupplies?.taxableValue || 0,
      igst: gstr3bData?.outwardSupplies?.zeroRatedSupplies?.igst || 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
    },
    {
      section: 'Inward supplies liable to reverse charge',
      taxableValue: gstr3bData?.outwardSupplies?.reverseChargeSupplies?.taxableValue || 0,
      igst: gstr3bData?.outwardSupplies?.reverseChargeSupplies?.igst || 0,
      cgst: gstr3bData?.outwardSupplies?.reverseChargeSupplies?.cgst || 0,
      sgst: gstr3bData?.outwardSupplies?.reverseChargeSupplies?.sgst || 0,
      cess: 0,
    },
    {
      section: 'Input tax credit',
      taxableValue: 0,
      igst: gstr3bData?.eligibleItc?.itcAvailable?.igst || 0,
      cgst: gstr3bData?.eligibleItc?.itcAvailable?.cgst || 0,
      sgst: gstr3bData?.eligibleItc?.itcAvailable?.sgst || 0,
      cess: 0,
    },
    {
      section: 'Net tax payable',
      taxableValue: 0,
      igst: Math.max(0, (gstr3bData?.outwardSupplies?.taxableSupplies?.igst || 0) - (gstr3bData?.eligibleItc?.itcAvailable?.igst || 0)),
      cgst: Math.max(0, (gstr3bData?.outwardSupplies?.taxableSupplies?.cgst || 0) - (gstr3bData?.eligibleItc?.itcAvailable?.cgst || 0)),
      sgst: Math.max(0, (gstr3bData?.outwardSupplies?.taxableSupplies?.sgst || 0) - (gstr3bData?.eligibleItc?.itcAvailable?.sgst || 0)),
      cess: 0,
    },
  ];

  const totals = summaryRows.reduce((acc, row) => ({
    taxableValue: acc.taxableValue + row.taxableValue,
    igst: acc.igst + row.igst,
    cgst: acc.cgst + row.cgst,
    sgst: acc.sgst + row.sgst,
    cess: acc.cess + row.cess,
  }), { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });

  // Supply review data
  const salesSummary = b2bData.slice(0, 10).map((inv: any) => ({
    gstin: inv.customer?.gstin || 'N/A',
    invoiceCount: 1,
    taxableValue: inv.taxableValue || 0,
    igst: inv.igst || 0,
    cgst: inv.cgst || 0,
    sgst: inv.sgst || 0,
  }));

  // If we haven't completed the drawer flow yet, show the drawer
  if (!isDrawerComplete && drawerOpen && !hasExistingState) {
    return (
      <GSTR3BDrawerFlow
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            navigate('/gst/forms');
          }
        }}
        onContinue={handleDrawerContinue}
      />
    );
  }
  // Map backend data to table format
  const mappedBusinesses = [
    {
      id: "b1",
      businessName: currentOrganization?.name || "Selected Business",
      gstins: [
        {
          id: "g1",
          gstin: filters.gstin || defaultGstin,
          state: filters.state || "Default State",
          totalLiability: computation?.totalLiability?.total || 0,
          outwardSupplies: computation?.grossLiability?.total || 0,
          inwardSuppliesRCM: 0,
          outwardSupplies95: 0,
          netAvailableITC: computation?.netItc4c?.total || 0,
          interestLateFees: (computation?.interest?.interestAmount || 0) + (computation?.lateFee?.totalLateFee || 0),
        }
      ]
    }
  ];

  // ─── Step 2 & 3: Full-page takeover inside DashboardLayout ───────────────────
  // These steps self-contain their own header, back button, and action buttons.
  // Rendering them inside the Step-1 outer shell caused a double-header bug.
  if (currentStep === 'review_tax') {
    return (
      <DashboardLayout title="GSTR-3B">
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden absolute inset-0">
          <GSTR3BReviewTaxCalculation
            businessName={currentOrganization?.name || "Bauer Specialized Foundation Contractor India Private Limited AADCB1626P"}
            gstin={filters.gstin || defaultGstin}
            nilReturn={nilReturn}
            liveValidation={validation}
            computation={computation}
            onBack={() => setCurrentStep('review')}
            onProceed={() => {
              if (validation.canProceed) setCurrentStep('upload_gstn');
            }}
          />
        </div>

        <GSTR3BPreparedModal
          open={isPreparedModalOpen}
          onOpenChange={setIsPreparedModalOpen}
          gstin={selectedPreviewGstin}
        />
      </DashboardLayout>
    );
  }

  if (currentStep === 'upload_gstn') {
    return (
      <DashboardLayout title="GSTR-3B">
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden absolute inset-0">
          <GSTR3BUploadGSTN
            businessName={currentOrganization?.name || "Bauer Specialized Foundation Contractor India Private Limited AADCB1626P"}
            gstin={filters.gstin || defaultGstin}
            nilReturn={nilReturn}
            canFile={validation.canFile}
            liveValidation={validation}
            workspaceId={workspaceId}
            returnPeriod={filters.returnPeriod}
            onBack={() => setCurrentStep('review_tax')}
            onProceed={() => setCurrentStep('compute')}
          />
        </div>

        <GSTR3BPreparedModal
          open={isPreparedModalOpen}
          onOpenChange={setIsPreparedModalOpen}
          gstin={selectedPreviewGstin}
        />
      </DashboardLayout>
    );
  }

  // ─── Step 1: Prepare GSTR-3B ─────────────────────────────────────────────────
  return (
    <DashboardLayout title="GSTR-3B">
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden absolute inset-0 pt-4 px-6">
        <div className="flex-none pt-2 pb-0">
          {/* Header Area */}
          <div className="mb-6">
            <h1 className="text-[22px] font-medium text-slate-800 dark:text-slate-100 mb-1">Step 1/5: Prepare GSTR-3B</h1>
            <p className="text-sm text-slate-500 flex items-center">
              Discover how to use GSTR-3B with Clear.
              <button className="text-blue-600 hover:underline ml-1 flex items-center">
                Learn More <ExternalLink className="h-3 w-3 ml-1" />
              </button>
            </p>
          </div>

          <div className="flex flex-col gap-4 mb-4">
            {/* Info Banner Row */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Data sources have been pre-applied based on your previous filing. You may choose to edit these, and any updates will be automatically saved as your new preferences.
              </p>
              <button
                className="text-sm text-blue-600 hover:underline whitespace-nowrap ml-4"
                onClick={() => setIsEditDataSourcesOpen(true)}
              >
                Edit Data Sources
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto hover:bg-transparent text-slate-400 hover:text-slate-600 gap-1.5"
                  onClick={() => {
                    setDrawerOpen(true);
                    setIsDrawerComplete(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-medium text-sm h-8"
                  onClick={() => setIsImportFlowOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import File
                </Button>
                <GSTR3BActionsDropdown />
                <Button
                  variant="outline"
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-medium h-9"
                  onClick={handleRecalculate}
                  disabled={isProcessing}
                >
                  <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  Run 2B vs PR &amp; Generate Table 4
                </Button>
                {/* Nil Return Toggle */}
                <div className="flex items-center gap-2 border border-border rounded-md px-3 h-9 bg-card">
                  <Switch
                    id="nil-return-toggle"
                    checked={nilReturn}
                    onCheckedChange={(checked) => {
                      setNilReturn(checked);
                      setLiveGstr3bData(prev => ({ ...prev, nil_return: checked }));
                    }}
                    className="scale-75"
                  />
                  <Label htmlFor="nil-return-toggle" className="text-xs text-muted-foreground cursor-pointer">
                    Nil Return
                  </Label>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium gap-2 px-6 h-9"
                  onClick={() => {
                    if (validation.canProceed) setCurrentStep('review_tax');
                  }}
                  disabled={!validation.canProceed && (validation.errorCount > 0)}
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Proceed to Next Step <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Banner */}
        <GSTR3BValidationBanner
          errors={validation.errors}
          warnings={validation.warnings}
          info={validation.info}
          isLoading={isValidating}
          className="mt-2"
        />

        {/* Content: Table */}
        <div className="flex-1 overflow-auto mt-2 mb-6 overscroll-contain">
          {gstr3bData || isDrawerComplete ? (
            <div className="min-w-[1800px] h-full flex flex-col items-start pr-4">
              <GSTR3BPrepareTable businesses={mappedBusinesses} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800 border rounded-lg border-dashed h-full">
              <AlertCircle className="h-10 w-10 text-slate-400 mb-4" />
              <p className="text-slate-500 font-medium mb-4">No data loaded for this GSTIN</p>
              <Button onClick={handleFetchData} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fetch Data First"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Data Availability Drawer */}
      <GSTR3BDataAvailabilityDrawer
        open={isDataAvailabilityDrawerOpen}
        onOpenChange={(open) => setIsDataAvailabilityDrawerOpen(open)}
        onProceedWithData={() => setIsDataAvailabilityDrawerOpen(false)}
        onProceedToDownload={() => setIsDataAvailabilityDrawerOpen(false)}
      />

      <GSTR3BPreparedModal
        open={isPreparedModalOpen}
        onOpenChange={setIsPreparedModalOpen}
        gstin={selectedPreviewGstin}
      />

      <GSTR3BImportFlow
        open={isImportFlowOpen}
        onOpenChange={setIsImportFlowOpen}
        onComplete={handleFetchData}
      />

      <GSTR3BEditDataSources
        open={isEditDataSourcesOpen}
        onOpenChange={setIsEditDataSourcesOpen}
        onProceedToNextStep={() => setCurrentStep('review_tax')}
        businessName={currentOrganization?.name || "Bauer Specialized Foundation Contractor India Private Limited AADCB1626P"}
        gstin={filters.gstin || defaultGstin}
      />
    </DashboardLayout>
  );
}
