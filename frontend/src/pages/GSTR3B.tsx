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
  FilePlus
} from 'lucide-react';
import GSTR3BActionsDropdown from '@/components/gstr3b/GSTR3BActionsDropdown';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { GSTR1ProcessResponse, GSTR3BProcessResponse, apiExportGSTR3BExcel } from '@/lib/api';
import { 
  transformBackendB2BToFrontend, 
  transformBackendB2CLToFrontend, 
  transformBackendB2CSToFrontend,
  transformBackendExportToFrontend,
} from '@/lib/gstr-transform';
import { calculateGSTR3BFromGSTR1, type GSTR3BData } from '@/hooks/useGSTR3BData';
import { useLocation, useNavigate } from 'react-router-dom';
import GSTR3BDrawerFlow from '@/components/gstr3b/GSTR3BDrawerFlow';

// Step types
type GSTR3BStep = 'fetch' | 'review' | 'compute' | 'summary' | 'export';

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
  
  // Drawer Flow state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isDrawerComplete, setIsDrawerComplete] = useState(false);
  
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
    }
  }, [hasExistingState, navigationState]);
  
  // Current step
  const [currentStep, setCurrentStep] = useState<GSTR3BStep>('fetch');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<Filters>({
    gstin: defaultGstin,
    returnPeriod: '022026',
    state: '',
    invoiceType: '',
  });

  // Data state
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null);
  
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
            setGstr3bData(response.data.gstr3b_data as unknown as GSTR3BData);
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
      // Call backend API for GSTR-3B computation
      if (workspaceId && filters.gstin) {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/gstr3b/compute`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('gst_access_token')}`
            },
            body: JSON.stringify({
              workspace_id: workspaceId,
              gstin: filters.gstin,
              return_period: filters.returnPeriod
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          // Transform backend response to GSTR3BData format
          setGstr3bData({
            outwardSupplies: {
              total: { igst: data.output_tax?.igst || 0, cgst: data.output_tax?.cgst || 0, sgst: data.output_tax?.sgst || 0 },
              taxableValue: data.output_tax?.total || 0
            },
            itcAvailable: {
              igst: data.input_tax?.igst || 0,
              cgst: data.input_tax?.cgst || 0,
              sgst: data.input_tax?.sgst || 0
            }
          });
          toast({
            title: 'Tax Recalculated',
            description: 'Tax computation completed from backend',
          });
          setIsProcessing(false);
          return;
        }
      }
      
      // Fallback to local calculation
      if (uploadResult) {
        const data = calculateGSTR3BFromGSTR1(gstr1ForCalc);
        setGstr3bData(data);
      }
      
      toast({
        title: 'Tax Recalculated',
        description: 'Tax computation completed',
      });
    } catch (error) {
      console.error('Error computing GSTR-3B:', error);
      // Fallback to local calculation
      if (uploadResult) {
        const data = calculateGSTR3BFromGSTR1(gstr1ForCalc);
        setGstr3bData(data);
      }
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
      // Call backend API to file GSTR-3B
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/gstr3b/file`,
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
        const data = await response.json();
        toast({
          title: 'Filing Initiated',
          description: data.message || 'GSTR-3B filing process started',
        });
      } else {
        throw new Error('Filing failed');
      }
    } catch (error) {
      console.error('Error filing GSTR-3B:', error);
      toast({
        title: 'Filing Failed',
        description: 'Failed to initiate filing. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Summary table data
  const summaryRows: SummaryRow[] = [
    {
      section: 'Outward taxable supplies',
      taxableValue: gstr3bData?.outwardSupplies?.taxableValue || 0,
      igst: gstr3bData?.outwardSupplies?.total?.igst || 0,
      cgst: gstr3bData?.outwardSupplies?.total?.cgst || 0,
      sgst: gstr3bData?.outwardSupplies?.total?.sgst || 0,
      cess: 0,
    },
    {
      section: 'Outward zero rated supplies',
      taxableValue: gstr3bData?.outwardSupplies?.zeroRated?.taxableValue || 0,
      igst: gstr3bData?.outwardSupplies?.zeroRated?.igst || 0,
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
      igst: gstr3bData?.itcAvailable?.igst || 0,
      cgst: gstr3bData?.itcAvailable?.cgst || 0,
      sgst: gstr3bData?.itcAvailable?.sgst || 0,
      cess: 0,
    },
    {
      section: 'Net tax payable',
      taxableValue: 0,
      igst: Math.max(0, (gstr3bData?.outwardSupplies?.total?.igst || 0) - (gstr3bData?.itcAvailable?.igst || 0)),
      cgst: Math.max(0, (gstr3bData?.outwardSupplies?.total?.cgst || 0) - (gstr3bData?.itcAvailable?.cgst || 0)),
      sgst: Math.max(0, (gstr3bData?.outwardSupplies?.total?.sgst || 0) - (gstr3bData?.itcAvailable?.sgst || 0)),
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

  return (
    <DashboardLayout title="GSTR-3B">
      <div className="space-y-4">
        {/* ClearTax-style Top Alert Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Data sources have been pre-applied from your previous session
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                GSTR-1 data is being used for tax computation. You can modify data sources if needed.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Step 1/5: Prepare GSTR-3B</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              GSTIN: <span className="font-mono">{filters.gstin || 'N/A'}</span> | Period: <span className="font-mono">{filters.returnPeriod || 'N/A'}</span>
            </p>
          </div>
          <div className="flex gap-3">
            {/* Run 2B vs PR & Generate Table 4 Button */}
            <Button 
              variant="outline" 
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={handleRecalculate}
              disabled={!uploadResult || isProcessing}
            >
              <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
              Run 2B vs PR & Generate Table 4
            </Button>
            
            {/* Import File Button */}
            <Button 
              variant="outline" 
              className="gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {}}
            >
              <FilePlus className="h-4 w-4" />
              Import File
            </Button>
            
            {/* Actions Dropdown */}
            <GSTR3BActionsDropdown />
            
            {/* Proceed to Next Step Button */}
            <Button 
              className="gap-2 bg-corporate-primary hover:bg-corporate-primaryHover"
              onClick={() => {
                // Move to next step
                const nextStepIndex = currentStepIndex + 1;
                if (nextStepIndex < workflowSteps.length) {
                  setCurrentStep(workflowSteps[nextStepIndex].id as GSTR3BStep);
                }
              }}
              disabled={currentStepIndex >= workflowSteps.length - 1}
            >
              Proceed to Next Step
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Step Workflow */}
        <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {workflowSteps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => gstr3bData && setCurrentStep(step.id as GSTR3BStep)}
                      disabled={!gstr3bData && index > currentStepIndex}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        index <= currentStepIndex 
                          ? 'bg-corporate-primary text-white' 
                          : gstr3bData 
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600' 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                      {step.label}
                    </button>
                    {index < workflowSteps.length - 1 && (
                      <ArrowRight className="h-4 w-4 mx-2 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <div className="grid grid-cols-1 gap-4">
          {/* Step 1: Fetch Data */}
          {currentStep === 'fetch' && (
            <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Fetch Data</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Retrieve invoice data from your records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter Panel */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filters</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input 
                      placeholder="GSTIN" 
                      value={filters.gstin}
                      onChange={(e) => setFilters({...filters, gstin: e.target.value})}
                      className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    />
                    <Input 
                      placeholder="Return Period (MMYYYY)" 
                      value={filters.returnPeriod}
                      onChange={(e) => setFilters({...filters, returnPeriod: e.target.value})}
                      className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    />
                    <Input 
                      placeholder="State" 
                      value={filters.state}
                      onChange={(e) => setFilters({...filters, state: e.target.value})}
                      className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    />
                    <Input 
                      placeholder="Invoice Type" 
                      value={filters.invoiceType}
                      onChange={(e) => setFilters({...filters, invoiceType: e.target.value})}
                      className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-8">
                  <Download className="h-16 w-16 text-corporate-primary mb-4" />
                  <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Ready to fetch data</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                    Click the button below to fetch invoices for GSTR-3B
                  </p>
                  <Button 
                    onClick={handleFetchData} 
                    disabled={isProcessing}
                    size="lg"
                    className="bg-corporate-primary hover:bg-corporate-primaryHover"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Fetch Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Review Supplies */}
          {currentStep === 'review' && (
            <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Review Supplies</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">View sales and purchase summaries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GSTIN</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Invoice Count</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Taxable Value</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">IGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">CGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesSummary.length > 0 ? (
                        salesSummary.map((inv: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-4 font-mono text-sm text-slate-700 dark:text-slate-300">{inv.gstin}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">{inv.invoiceCount}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{inv.taxableValue.toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{inv.igst.toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{inv.cgst.toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{inv.sgst.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            No invoice data available. Please upload invoices first.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {salesSummary.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium">
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">Total</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{salesSummary.reduce((a: any, b: any) => a + b.invoiceCount, 0)}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{salesSummary.reduce((a: any, b: any) => a + b.taxableValue, 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{salesSummary.reduce((a: any, b: any) => a + b.igst, 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{salesSummary.reduce((a: any, b: any) => a + b.cgst, 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{salesSummary.reduce((a: any, b: any) => a + b.sgst, 0).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Tax Computation */}
          {currentStep === 'compute' && (
            <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Tax Computation</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Automatic tax calculation based on invoice data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 text-corporate-primary animate-spin mb-4" />
                    <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Computing tax...</p>
                  </div>
                ) : gstr3bData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                      <CardContent className="py-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Outward Tax</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          ₹{((gstr3bData.outwardSupplies?.total?.igst || 0) + 
                             (gstr3bData.outwardSupplies?.total?.cgst || 0) + 
                             (gstr3bData.outwardSupplies?.total?.sgst || 0)).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                      <CardContent className="py-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">ITC Available</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ₹{((gstr3bData.itcAvailable?.igst || 0) + 
                             (gstr3bData.itcAvailable?.cgst || 0) + 
                             (gstr3bData.itcAvailable?.sgst || 0)).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                      <CardContent className="py-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Net Tax Payable</p>
                        <p className="text-2xl font-bold text-corporate-primary">
                          ₹{Math.max(0, 
                            ((gstr3bData.outwardSupplies?.total?.igst || 0) + 
                             (gstr3bData.outwardSupplies?.total?.cgst || 0) + 
                             (gstr3bData.outwardSupplies?.total?.sgst || 0)) -
                            ((gstr3bData.itcAvailable?.igst || 0) + 
                             (gstr3bData.itcAvailable?.cgst || 0) + 
                             (gstr3bData.itcAvailable?.sgst || 0))
                          ).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mb-4" />
                    <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No data to compute</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Please fetch data first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Summary */}
          {currentStep === 'summary' && (
            <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">GSTR-3B Summary</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Complete tax summary before filing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Section</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Taxable Value</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">IGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">CGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">SGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">CESS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{row.section}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{row.taxableValue.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{row.igst.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{row.cgst.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{row.sgst.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{row.cess.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-700 font-bold">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">Total</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{totals.taxableValue.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{totals.igst.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{totals.cgst.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{totals.sgst.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">₹{totals.cess.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Export / File */}
          {currentStep === 'export' && (
            <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Export / File GSTR-3B</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Export your return or file directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-corporate-primary cursor-pointer transition-colors bg-white dark:bg-slate-800">
                    <CardContent className="py-8 flex flex-col items-center">
                      <FileDown className="h-12 w-12 text-corporate-primary mb-3" />
                      <p className="font-medium text-slate-900 dark:text-slate-100">Export to Excel</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Download GSTR-3B in Excel format</p>
                      <Button 
                        className="mt-4 bg-corporate-primary hover:bg-corporate-primaryHover"
                        onClick={handleExport}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Export Excel
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-dashed border-green-200 dark:border-green-800 hover:border-green-400 cursor-pointer transition-colors bg-white dark:bg-slate-800">
                    <CardContent className="py-8 flex flex-col items-center">
                      <Upload className="h-12 w-12 text-green-600 dark:text-green-400 mb-3" />
                      <p className="font-medium text-slate-900 dark:text-slate-100">File Return</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Submit GSTR-3B on GST portal</p>
                      <Button 
                        className="mt-4 bg-green-600 hover:bg-green-700"
                        onClick={handleFileReturn}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        File Now
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
