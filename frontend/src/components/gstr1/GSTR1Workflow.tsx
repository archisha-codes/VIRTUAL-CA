/**
 * GSTR-1 Workflow Stepper Component
 * 
 * A professional, enterprise-grade step-by-step workflow for GSTR-1 filing
 * Similar to ClearGST workflow with 6 comprehensive steps:
 * 1. Upload/Import Data
 * 2. Classification & Categorization
 * 3. Validation
 * 4. Summary & Review
 * 5. File Return
 * 6. Post-Filing
 */

import React, { useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  ArrowRightLeft,
  Loader2,
  FileDown,
  RefreshCw,
  X,
  Shield,
  Tag,
  ClipboardCheck,
  FileText,
  Send,
  Download,
  Clock,
  Building2,
  Database,
  Server,
  History,
  ChevronRight,
  AlertTriangle,
  Info,
  Eye,
  Edit3,
  BarChart3,
  Package,
  Truck,
  Globe,
  CreditCard,
  RotateCcw,
  Sparkles,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import GSTR1FiltersDrawer, { type GSTR1Filters } from './GSTR1FiltersDrawer';
import GSTR1ImportDrawer from './GSTR1ImportDrawer';
import GSTR1ActionsDropdown from './GSTR1ActionsDropdown';
import { 
  parseExcelFile, 
  autoMapColumns, 
  FIELD_LABELS, 
  REQUIRED_FIELDS,
  processLargeExcelFile,
  type ColumnMapping,
  type ParsedExcel,
  type ExcelRow 
} from '@/lib/excel-parser';
import { processGSTR1Excel, apiExportGSTR1Excel, downloadExcelFromResponse, validateGSTR1, validateGSTR1File, saveGstr1State, getGstr1State, deleteGstr1State, type GSTR1ProcessResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Import table components for displaying all GSTR-1 tables
import { HSNTable } from './HSNTable';
import { B2BTable } from './B2BTable';
import { B2CSTable } from './B2CSTable';
import { CDNRTable } from './CDNRTable';
import { B2CLTable } from './B2CLTable';
import { ExportsTable } from './ExportsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import data transformation functions and types
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
  type HSNSummary
} from '@/hooks/useGSTR1Data';

import type {
  GSTR1ValidationResponse,
  GSTR1ValidationRule,
  GSTR1ValidationResultItem,
} from '@/lib/api';

// Import single source of truth pipeline
import {
  transformAllBackendData,
  calculateSummary,
  validateAllRows,
  filterBySection,
  type GSTR1Row,
  type GSTR1Summary
} from '@/lib/gstr1-pipeline';

// Step types
export type WorkflowStepId = 
  | 'upload'
  | 'classification'
  | 'validation'
  | 'summary'
  | 'file'
  | 'postfiling';

// Workflow step definition
export interface WorkflowStep {
  id: WorkflowStepId;
  title: string;
  description: string;
  icon: ReactNode;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

// Step definitions
export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'upload',
    title: 'Upload/Import Data',
    description: 'Upload Excel/JSON or import from ERP',
    icon: <Upload className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 'classification',
    title: 'Classification & Categorization',
    description: 'Auto-classify invoices and map HSN codes',
    icon: <Tag className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 'validation',
    title: 'Validation',
    description: 'Run comprehensive validation checks',
    icon: <ClipboardCheck className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 'summary',
    title: 'Summary & Review',
    description: 'Review data before filing',
    icon: <BarChart3 className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 'file',
    title: 'File Return',
    description: 'Generate and file GSTR-1',
    icon: <Send className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 'postfiling',
    title: 'Post-Filing',
    description: 'Download and view filing confirmation',
    icon: <Download className="h-5 w-5" />,
    status: 'pending'
  }
];

// Step index map
const STEP_INDEX: Record<WorkflowStepId, number> = {
  upload: 0,
  classification: 1,
  validation: 2,
  summary: 3,
  file: 4,
  postfiling: 5
};

// Validation result type
interface ValidationResult {
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  details: Array<{
    category: string;
    status: 'passed' | 'warning' | 'error';
    message: string;
    invoiceNo?: string;
    rule?: string;
    count?: number;
    rows?: number[];
  }>;
  validationReport?: GSTR1ValidationResponse['validation_report'];
}

type ValidationErrorItem = {
  invoice: string;
  error: string;
  rule?: string;
  field?: string;
  rowIndex?: number;
};

type ValidationSummaryState = {
  validationResult: ValidationResult;
  validationErrors: ValidationErrorItem[];
};

const humanizeValidationLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const normalizeValidationSeverity = (severity?: string): 'passed' | 'warning' | 'error' => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'error' || normalized === 'critical') {
    return 'error';
  }
  if (normalized === 'warning') {
    return 'warning';
  }
  return 'passed';
};

const getValidationResultKey = (result: GSTR1ValidationResultItem) =>
  result.rule || result.error_code || `${result.category || 'validation'}:${result.message || ''}`;

const matchesValidationRule = (rule: GSTR1ValidationRule, result: GSTR1ValidationResultItem) => {
  const resultRule = result.rule || '';
  const resultErrorCode = result.error_code || '';
  return resultRule === rule.name || resultErrorCode === rule.error_code || resultRule === rule.error_code;
};

const buildValidationSummary = (
  validationResponse: GSTR1ValidationResponse,
  fallbackTotalRows = 0
): ValidationSummaryState => {
  const inputValidation = validationResponse.validation_report?.input_validation || {};
  const tableValidation = validationResponse.validation_report?.table_validation || {};

  const rules = Array.isArray(inputValidation.rules) ? inputValidation.rules : [];
  const ruleResults = Array.isArray(inputValidation.results) ? inputValidation.results : [];

  const groupedResults = new Map<string, GSTR1ValidationResultItem[]>();
  ruleResults.forEach((result) => {
    const key = getValidationResultKey(result);
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }
    groupedResults.get(key)!.push(result);
  });

  const details: ValidationResult['details'] = [];
  const validationErrors: ValidationErrorItem[] = [];
  const consumedResultKeys = new Set<string>();

  const pushResultErrors = (results: GSTR1ValidationResultItem[]) => {
    results.forEach((result) => {
      const severity = normalizeValidationSeverity(result.severity);
      if (severity === 'error') {
        validationErrors.push({
          invoice: result.row_index !== undefined && result.row_index !== null
            ? `Row ${result.row_index + 1}`
            : humanizeValidationLabel(result.rule || result.error_code || result.category || 'Validation'),
          error: result.message || 'Validation error',
          rule: result.rule || result.error_code || undefined,
          field: result.field || undefined,
          rowIndex: result.row_index !== undefined && result.row_index !== null ? result.row_index + 1 : undefined,
        });
      }
    });
  };

  rules.forEach((rule) => {
    const matchedResults = ruleResults.filter((result) => matchesValidationRule(rule, result));
    matchedResults.forEach((result) => consumedResultKeys.add(getValidationResultKey(result)));

    const resultSeverity = matchedResults.some((result) => normalizeValidationSeverity(result.severity) === 'error')
      ? 'error'
      : matchedResults.some((result) => normalizeValidationSeverity(result.severity) === 'warning')
        ? 'warning'
        : 'passed';

    const rowIndices = Array.from(
      new Set(
        matchedResults
          .map((result) => result.row_index)
          .filter((rowIndex): rowIndex is number => rowIndex !== undefined && rowIndex !== null)
      )
    ).sort((left, right) => left - right);

    const issueCount = matchedResults.filter((result) => normalizeValidationSeverity(result.severity) !== 'passed').length;
    const primaryMessage = matchedResults[0]?.message || rule.message || 'No issues found';
    const summaryMessage = resultSeverity === 'passed'
      ? 'No issues found'
      : issueCount > 1
        ? `${primaryMessage} (${issueCount} issues across ${rowIndices.length || 1} rows)`
        : primaryMessage;

    details.push({
      category: humanizeValidationLabel(rule.name),
      status: resultSeverity,
      message: summaryMessage,
      invoiceNo: rowIndices.length > 0
        ? (rowIndices.length === 1
            ? `Row ${rowIndices[0] + 1}`
            : `Rows ${rowIndices.slice(0, 5).map((rowIndex) => rowIndex + 1).join(', ')}`)
        : undefined,
      rule: rule.name,
      count: matchedResults.length,
      rows: rowIndices.map((rowIndex) => rowIndex + 1),
    });

    pushResultErrors(matchedResults);
  });

  ruleResults.forEach((result) => {
    const resultKey = getValidationResultKey(result);
    if (consumedResultKeys.has(resultKey)) {
      return;
    }

    const severity = normalizeValidationSeverity(result.severity);
    const rowIndex = result.row_index !== undefined && result.row_index !== null ? result.row_index + 1 : undefined;

    details.push({
      category: humanizeValidationLabel(result.rule || result.error_code || result.category || 'Validation'),
      status: severity,
      message: result.message || 'Validation result',
      invoiceNo: rowIndex ? `Row ${rowIndex}` : undefined,
      rule: result.rule || result.error_code || undefined,
      count: 1,
      rows: rowIndex ? [rowIndex] : undefined,
    });

    if (severity === 'error') {
      validationErrors.push({
        invoice: rowIndex ? `Row ${rowIndex}` : humanizeValidationLabel(result.rule || result.error_code || result.category || 'Validation'),
        error: result.message || 'Validation error',
        rule: result.rule || result.error_code || undefined,
        field: result.field || undefined,
        rowIndex,
      });
    }
  });

  const tableErrorCount = Array.isArray(tableValidation.errors) ? tableValidation.errors.length : 0;
  const tableWarningCount = Array.isArray(tableValidation.warnings) ? tableValidation.warnings.length : 0;

  if (tableErrorCount > 0 || tableWarningCount > 0) {
    details.push({
      category: 'Table Consistency Checks',
      status: tableErrorCount > 0 ? 'error' : 'warning',
      message: tableErrorCount > 0
        ? `${tableErrorCount} table-level errors found`
        : `${tableWarningCount} table-level warnings found`,
      invoiceNo: 'Table validation',
      rule: 'table_validation',
      count: tableErrorCount + tableWarningCount,
    });

    (tableValidation.errors || []).forEach((errorMessage) => {
      validationErrors.push({
        invoice: 'Table',
        error: errorMessage,
        rule: 'table_validation',
      });
    });
  } else {
    details.push({
      category: 'Table Consistency Checks',
      status: 'passed',
      message: 'No table-level issues found',
      invoiceNo: 'Table validation',
      rule: 'table_validation',
      count: 0,
    });
  }

  const totalRows = validationResponse.summary?.total_rows ?? inputValidation.total_rows ?? fallbackTotalRows;
  const totalChecks = details.length;
  const passed = details.filter((detail) => detail.status === 'passed').length;
  const warnings = details.filter((detail) => detail.status === 'warning').length;
  const errors = details.filter((detail) => detail.status === 'error').length;

  return {
    validationResult: {
      total: totalChecks || totalRows || fallbackTotalRows,
      passed,
      warnings,
      errors,
      details,
      validationReport: validationResponse.validation_report,
    },
    validationErrors,
  };
};

// Classification result type
interface ClassificationResult {
  b2b: number;
  b2cl: number;
  b2cs: number;
  exports: number;
  cdnr: number;
  cnds: number;
  hsn: number;
  total: number;
}

// Filing result type
interface FilingResult {
  success: boolean;
  arn?: string;
  ackNumber?: string;
  filingId?: string;
  status?: string;
  filingDate?: string;
  jsonUrl?: string;
  message?: string;
}

// Workflow state interface
interface WorkflowState {
  currentStep: WorkflowStepId;
  stepData: Record<WorkflowStepId, any>;
  validationStatus: Record<WorkflowStepId, 'pending' | 'passed' | 'failed' | 'skipped'>;
  lastSaved: Date | null;
}

// Props for the workflow component
interface GSTR1WorkflowProps {
  gstin?: string;
  returnPeriod?: string;
  initialStep?: WorkflowStepId;
  onComplete?: (result: FilingResult) => void;
  onStepChange?: (step: WorkflowStepId) => void;
}

export default function GSTR1Workflow(props: GSTR1WorkflowProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentOrganization, currentGstProfile } = useAuth();
  
  // Get GSTIN and return period from AuthContext or props (props take precedence for backward compatibility)
  const gstin = props.gstin || currentGstProfile?.gstin || '';
  const returnPeriod = props.returnPeriod || '';
  const workspaceId = currentOrganization?.id;
  
  const { onComplete, onStepChange } = props;

  // Workflow state
  const [currentStepId, setCurrentStepId] = useState<WorkflowStepId>(props.initialStep || 'upload');
  const [stepData, setStepData] = useState<Record<WorkflowStepId, any>>({});
  const [validationStatus, setValidationStatus] = useState<Record<WorkflowStepId, 'pending' | 'passed' | 'failed' | 'skipped'>>({
    upload: 'pending',
    classification: 'pending',
    validation: 'pending',
    summary: 'pending',
    file: 'pending',
    postfiling: 'pending'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Backend loading and error states
  const [isLoadingFromBackend, setIsLoadingFromBackend] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: Upload state
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcel | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [uploadHistory, setUploadHistory] = useState<Array<{ filename: string; date: Date; status: string }>>([]);
  
  // Phase E2: Progress state for large file parsing
  const [parseProgress, setParseProgress] = useState<{ processed: number; total: number } | null>(null);
  const [isParsingLargeFile, setIsParsingLargeFile] = useState(false);

  // Step 2: Classification state
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  // Step 3: Validation state
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  
  // Filter state for validation errors
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [gstinFilter, setGstinFilter] = useState('');
  const [hsnFilter, setHsnFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Step 4: Summary state
  const [uploadResult, setUploadResult] = useState<GSTR1ProcessResponse | null>(null);
  const [activeSummaryTab, setActiveSummaryTab] = useState<string>('summary');
  
  // Table data state for editable tables (using transformed types)
  const [b2bData, setB2bData] = useState<any[]>([]);
  const [b2clData, setB2clData] = useState<any[]>([]);
  const [b2csData, setB2csData] = useState<any[]>([]);
  const [cdnrData, setCdnrData] = useState<any[]>([]);
  const [hsnData, setHsnData] = useState<any[]>([]);
  const [exportsData, setExportsData] = useState<any[]>([]);

  // SINGLE SOURCE OF TRUTH - All data transformed to unified format
  const [gstr1Data, setGstr1Data] = useState<GSTR1Row[]>([]);
  const [gstr1Summary, setGstr1Summary] = useState<GSTR1Summary | null>(null);
  const [validationErrorsMap, setValidationErrorsMap] = useState<Map<number, string[]>>(new Map());
  
  // Filters and Import drawer state
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<GSTR1Filters | null>(null);

  // Sync table data when uploadResult changes (transform backend data to frontend format)
  useEffect(() => {
    if (uploadResult?.data) {
      // Phase E4: Add defensive checks: data?.b2b && Array.isArray(data.b2b) before setting
      const data = uploadResult.data;
      
      // DEBUG: Log uploadResult in state
      console.log('[DEBUG] useEffect triggered, uploadResult.data exists:', true);
      console.log('[DEBUG] uploadResult.data keys:', Object.keys(data));
      
      // Transform backend data to frontend-friendly format with defensive checks
      const b2bData = data?.b2b && Array.isArray(data.b2b) ? data.b2b : [];
      const b2clData = data?.b2cl && Array.isArray(data.b2cl) ? data.b2cl : [];
      const b2csData = data?.b2cs && Array.isArray(data.b2cs) ? data.b2cs : [];
      const cdnrData = data?.cdnr && Array.isArray(data.cdnr) ? data.cdnr : [];
      const expData = data?.exp && Array.isArray(data.exp) ? data.exp : (data?.export && Array.isArray(data.export) ? data.export : []);
      const hsnData = data?.hsn && Array.isArray(data.hsn) ? data.hsn : [];
      
      const transformedB2B = transformBackendB2BToFrontend(b2bData);
      const transformedB2CL = transformBackendB2CLToFrontend(b2clData);
      const transformedB2CS = transformBackendB2CSToFrontend(b2csData);
      const transformedCDNR = transformBackendCDNRToFrontend(cdnrData);
      const transformedExport = transformBackendExportToFrontend(expData);
      
      // DEBUG: Log transformed data
      console.log('[DEBUG] transformedB2B length:', transformedB2B.length);
      console.log('[DEBUG] transformedB2CL length:', transformedB2CL.length);
      console.log('[DEBUG] transformedB2CS length:', transformedB2CS.length);
      console.log('[DEBUG] transformedCDNR length:', transformedCDNR.length);
      console.log('[DEBUG] transformedExport length:', transformedExport.length);
      
      setB2bData(transformedB2B);
      setB2clData(transformedB2CL);
      setB2csData(transformedB2CS);
      setCdnrData(transformedCDNR);
      setExportsData(transformedExport);
      
      // Handle HSN data - transform if available
      if (uploadResult.data.hsn && uploadResult.data.hsn.length > 0) {
        setHsnData(uploadResult.data.hsn.map((h: any) => ({
          hsnCode: h.hsn_code || '',
          description: h.description || '',
          uqc: h.uom || 'NOS',
          totalQuantity: h.quantity || 0,
          totalValue: h.total_value || 0,
          taxableValue: h.taxable_value || 0,
          igst: h.igst || 0,
          cgst: h.cgst || 0,
          sgst: h.sgst || 0,
          cess: h.cess || 0
        })));
      }

      // ============================================
      // SINGLE SOURCE OF TRUTH - Set unified data
      // ============================================
      // Transform all backend data to single source of truth
      const unifiedData = transformAllBackendData(uploadResult.data);
      setGstr1Data(unifiedData);
      
      // Calculate summary from unified data
      const summary = calculateSummary(unifiedData);
      setGstr1Summary(summary);
      
      // Validate all rows
      const errorsMap = validateAllRows(unifiedData);
      setValidationErrorsMap(errorsMap);
      
      console.log('[DEBUG] Single Source of Truth set:', {
        totalRows: unifiedData.length,
        summary,
        validationErrors: errorsMap.size
      });
    }
  }, [uploadResult]);

  // Step 5: Filing state
  const [filingResult, setFilingResult] = useState<FilingResult | null>(null);
  const [isFiling, setIsFiling] = useState(false);

  // Step 6: Post-filing state
  const [filingHistory, setFilingHistory] = useState<Array<{ period: string; arn: string; date: string; status: string }>>([]);

  // Current step index
  const currentStepIndex = STEP_INDEX[currentStepId];

  // Calculate progress
  const progress = ((currentStepIndex) / (WORKFLOW_STEPS.length - 1)) * 100;

  // Load saved state from backend on mount
  useEffect(() => {
    const loadStateFromBackend = async () => {
      if (!workspaceId || !gstin || !returnPeriod) {
        console.log('[GSTR1Workflow] Missing workspaceId, gstin, or returnPeriod, skipping backend load');
        return;
      }

      setIsLoadingFromBackend(true);
      setLoadError(null);

      try {
        console.log('[GSTR1Workflow] Loading state from backend:', { workspaceId, gstin, returnPeriod });
        const response = await getGstr1State(workspaceId, gstin, returnPeriod);
        
        if (response.success && response.data) {
          const savedState = response.data;
          const hydratedUploadResult = savedState.upload_result || (savedState.gstr1_tables
            ? {
                success: true,
                data: savedState.gstr1_tables,
                validation_report: {
                  errors: [],
                  warnings: [],
                  final_status: 'success',
                },
                total_records: (savedState.gstr1_tables?.summary?.total_invoices ?? 0),
              }
            : null);
          
          // Restore workflow state
          const restoredStep = props.initialStep || savedState.current_step;
          if (restoredStep) {
            setCurrentStepId(restoredStep as any);
          }
          if (savedState.step_data) {
            setStepData(savedState.step_data);
          }
          if (savedState.validation_status) {
            setValidationStatus(savedState.validation_status as any);
          }
          if (savedState.last_saved) {
            setLastSaved(new Date(savedState.last_saved));
          }

          // Restore GSTR-1 table data
          if (savedState.gstr1_tables) {
            const data = savedState.gstr1_tables as any;
            setB2bData(data.b2b || []);
            setB2clData(data.b2cl || []);
            setB2csData(data.b2cs || []);
            setCdnrData(data.cdnr || []);
            setHsnData(data.hsn || []);
            setExportsData(data.exp || data.export || []);
          }

          // Restore upload result
          if (hydratedUploadResult) {
            setUploadResult(hydratedUploadResult as any);

            if (props.initialStep === 'validation' && !savedState.validation_result) {
              await runValidationWithBackend(hydratedUploadResult as GSTR1ProcessResponse);
            }
          }

          // Restore classification result
          if (savedState.classification_result) {
            setClassificationResult(savedState.classification_result as any);
          }

          // Restore validation result
          if (savedState.validation_result) {
            setValidationResult(savedState.validation_result as any);
          }

          // Restore filing result
          if (savedState.filing_result) {
            setFilingResult(savedState.filing_result as any);
          }

          console.log('[GSTR1Workflow] Loaded state from backend successfully:', {
            currentStep: savedState.current_step,
            hasGstr1Tables: !!savedState.gstr1_tables,
          });
        } else {
          console.log('[GSTR1Workflow] No saved state found on backend');
        }
      } catch (error) {
        // Backend not available - gracefully handle without crashing
        console.warn('[GSTR1Workflow] Backend not available, showing empty state:', error);
        setLoadError(null); // Clear any load error - just means no saved state
        // Fall back to localStorage only for legacy migration (optional)
        console.log('[GSTR1Workflow] Attempting legacy localStorage migration...');
        const savedState = localStorage.getItem('gstr1_workflow_state');
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            if (parsed.currentStep) {
              setCurrentStepId(parsed.currentStep);
              setStepData(parsed.stepData || {});
              setValidationStatus(parsed.validationStatus || {});
              setLastSaved(parsed.lastSaved ? new Date(parsed.lastSaved) : null);
              console.log('[GSTR1Workflow] Migrated legacy state from localStorage');
            }
          } catch (e) {
            console.error('[GSTR1Workflow] Failed to migrate legacy state:', e);
          }
        }
      } finally {
        setIsLoadingFromBackend(false);
      }
    };

    loadStateFromBackend();
  }, [workspaceId, gstin, returnPeriod, props.initialStep]);

  // Save state to backend on change (debounced)
  useEffect(() => {
    const saveStateToBackend = async () => {
      if (!workspaceId || !gstin || !returnPeriod) {
        return;
      }

      // Don't save if we haven't loaded anything yet
      if (!uploadResult && Object.keys(stepData).length === 0) {
        return;
      }

      try {
        const gstr1Tables = uploadResult?.data ? {
          b2b: b2bData,
          b2cl: b2clData,
          b2cs: b2csData,
          cdnr: cdnrData,
          hsn: hsnData,
          exp: exportsData,
        } : null;

        await saveGstr1State(workspaceId, gstin, returnPeriod, {
          currentStep: currentStepId,
          stepData,
          validationStatus,
          gstr1Tables,
          uploadResult: uploadResult as any,
          classificationResult,
          validationResult,
          filingResult,
        });

        console.log('[GSTR1Workflow] State saved to backend');
      } catch (error) {
        console.error('[GSTR1Workflow] Failed to save state to backend:', error);
      }
    };

    // Debounce the save to avoid too many API calls
    const timeoutId = setTimeout(saveStateToBackend, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentStepId, stepData, validationStatus, uploadResult, classificationResult, validationResult, filingResult, workspaceId, gstin, returnPeriod, b2bData, b2clData, b2csData, cdnrData, hsnData, exportsData]);

  // Handle step change callback
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStepId);
    }
  }, [currentStepId, onStepChange]);

  // Update step status
  const updateStepStatus = (stepId: WorkflowStepId, status: 'pending' | 'passed' | 'failed' | 'skipped') => {
    setValidationStatus(prev => ({ ...prev, [stepId]: status }));
  };

  // Move to next step
  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WORKFLOW_STEPS.length) {
      const nextStepId = WORKFLOW_STEPS[nextIndex].id;
      setCurrentStepId(nextStepId);
      updateStepStatus(currentStepId, 'passed');
    }
  };

  // Move to previous step
  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStepId(WORKFLOW_STEPS[prevIndex].id);
    }
  };

  // Navigate to specific step (only if completed or current)
  const goToStep = (stepId: WorkflowStepId) => {
    const targetIndex = STEP_INDEX[stepId];
    if (targetIndex <= currentStepIndex || validationStatus[stepId] === 'passed') {
      setCurrentStepId(stepId);
    }
  };

  // Reset workflow
  const resetWorkflow = async () => {
    setCurrentStepId('upload');
    setStepData({});
    setValidationStatus({
      upload: 'pending',
      classification: 'pending',
      validation: 'pending',
      summary: 'pending',
      file: 'pending',
      postfiling: 'pending'
    });
    setFile(null);
    setParsedData(null);
    setColumnMapping({});
    setClassificationResult(null);
    setValidationResult(null);
    setUploadResult(null);
    setFilingResult(null);
    setB2bData([]);
    setB2clData([]);
    setB2csData([]);
    setCdnrData([]);
    setHsnData([]);
    setExportsData([]);
    setLastSaved(null);

    // Clear state from backend
    if (workspaceId && gstin && returnPeriod) {
      try {
        await deleteGstr1State(workspaceId, gstin, returnPeriod);
        console.log('[GSTR1Workflow] Cleared state from backend');
      } catch (error) {
        console.error('[GSTR1Workflow] Failed to clear state from backend:', error);
      }
    }

    toast({
      title: 'Workflow Reset',
      description: 'All progress has been cleared',
    });
  };

  const handleDeleteFromClear = () => {
    void resetWorkflow();
  };

  // ============================================
  // STEP 1: UPLOAD/IMPORT DATA
  // ============================================

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsLoading(true);

    // Phase E2: Check file size and use chunk parsing for large files (>= 1MB)
    const LARGE_FILE_THRESHOLD = 1024 * 1024; // 1MB
    const isLargeFile = uploadedFile.size >= LARGE_FILE_THRESHOLD;
    
    if (isLargeFile) {
      setIsParsingLargeFile(true);
      setParseProgress({ processed: 0, total: 0 });
    }

    try {
      let parsed: ParsedExcel;
      
      if (isLargeFile) {
        // Use chunk parsing for large files with progress indicator
        parsed = await processLargeExcelFile(uploadedFile, (processed, total) => {
          setParseProgress({ processed, total });
        });
      } else {
        // Use regular parsing for small files
        parsed = await parseExcelFile(uploadedFile);
      }
      
      setParsedData(parsed);
      
      const autoMapping = autoMapColumns(parsed.headers);
      setColumnMapping(autoMapping);
      
      setStepData(prev => ({ ...prev, upload: { file: uploadedFile.name, rows: parsed.rows.length } }));
      setLastSaved(new Date());
      
      // Add to upload history
      setUploadHistory(prev => [{
        filename: uploadedFile.name,
        date: new Date(),
        status: isLargeFile ? 'Large File Processed' : 'Success'
      }, ...prev].slice(0, 10));

      toast({
        title: 'File uploaded successfully',
        description: isLargeFile 
          ? `Found ${parsed.rows.length} rows (processed in chunks)`
          : `Found ${parsed.rows.length} rows, ${parsed.headers.length} columns`,
      });
    } catch (error) {
      toast({
        title: 'Failed to parse file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsParsingLargeFile(false);
      setParseProgress(null);
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

  // Handle mapping change
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? undefined : value,
    }));
  };

  const isMappingComplete = REQUIRED_FIELDS.every(field => columnMapping[field]);

  // ============================================
  // STEP 2: CLASSIFICATION & CATEGORIZATION
  // ============================================

  // Run classification - actually process the file through the backend
  const runClassification = async () => {
    if (!file || !isMappingComplete) return;

    setIsClassifying(true);
    setCurrentStepId('classification');

    try {
      // Build mapping dictionary
      const mappingDict: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([key, value]) => {
        if (value) mappingDict[key] = value;
      });

      // Actually process the file through the backend
      const result = await processGSTR1Excel(file, mappingDict, gstin, returnPeriod, workspaceId);
      
      // DEBUG: Log the result from processGSTR1Excel
      console.log('[DEBUG] processGSTR1Excel result:', result);
      console.log('[DEBUG] result.success:', result.success);
      console.log('[DEBUG] result.data keys:', result.data ? Object.keys(result.data) : 'no data');
      
      // Phase E1: If result.success is false, show toast with backend message and do not change table state
      if (!result.success) {
        // Extract error message from backend response
        const errorMessage = result.message || 
          result.validation_report?.errors?.[0] || 
          'Processing failed. Please check your file and try again.';
        
        toast({
          title: 'Processing Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // Do NOT change table state - keep existing data
        updateStepStatus('classification', 'failed');
        setIsClassifying(false);
        return;
      }
      
      setUploadResult(result);

      // CRITICAL: Immediately set per-table React state so UI updates right away
      if (result && result.success && result.data) {
        const tables = result.data;
        
        console.log('[DEBUG] Raw data from backend:');
        console.log('[DEBUG] b2b:', tables.b2b?.length || 0);
        console.log('[DEBUG] b2cl:', tables.b2cl?.length || 0);
        console.log('[DEBUG] b2cs:', tables.b2cs?.length || 0);
        
        // Transform and set each table state
        const transformedB2B = transformBackendB2BToFrontend(tables.b2b || []);
        const transformedB2CL = transformBackendB2CLToFrontend(tables.b2cl || []);
        const transformedB2CS = transformBackendB2CSToFrontend(tables.b2cs || []);
        const transformedCDNR = transformBackendCDNRToFrontend(tables.cdnr || []);
        const transformedExport = transformBackendExportToFrontend(tables.exp || tables.export || []);
        
        console.log('[DEBUG] Transformed data:');
        console.log('[DEBUG] b2b customers:', transformedB2B.length);
        console.log('[DEBUG] b2cl invoices:', transformedB2CL.length);
        console.log('[DEBUG] b2cs records:', transformedB2CS.length);
        
        // Set transformed data to state
        setB2bData(transformedB2B);
        setB2clData(transformedB2CL);
        setB2csData(transformedB2CS);
        setCdnrData(transformedCDNR);
        setExportsData(transformedExport);
        
        // Handle HSN data
        if (tables.hsn && tables.hsn.length > 0) {
          const transformedHSN = tables.hsn.map((h: any) => ({
            hsnCode: h.hsn_code || '',
            description: h.description || '',
            uqc: h.uom || 'NOS',
            totalQuantity: h.quantity || 0,
            totalValue: h.total_value || 0,
            taxableValue: h.taxable_value || 0,
            igst: h.igst || 0,
            cgst: h.cgst || 0,
            sgst: h.sgst || 0,
            cess: h.cess || 0
          }));
          setHsnData(transformedHSN);
          console.log('[DEBUG] hsn records:', transformedHSN.length);
        }
        
        // State is now saved to backend automatically via useEffect
        // No localStorage persistence needed - backend is the source of truth
        
        // Get classification counts
        const b2bCount = transformedB2B.reduce((sum: number, c: any) => sum + c.invoices.length, 0);
        const b2clCount = transformedB2CL.length;
        const b2csCount = transformedB2CS.length;
        const exportsCount = transformedExport.length;
        const cdnrCount = transformedCDNR.reduce((sum: number, c: any) => sum + c.notes.length, 0);
        const hsnCount = tables.hsn?.length || 0;
        
        const classificationData: ClassificationResult = {
          b2b: b2bCount,
          b2cl: b2clCount,
          b2cs: b2csCount,
          exports: exportsCount,
          cdnr: cdnrCount,
          cnds: 0,
          hsn: hsnCount,
          total: b2bCount + b2clCount + b2csCount + exportsCount + cdnrCount + hsnCount
        };

        setClassificationResult(classificationData);
        setStepData(prev => ({ ...prev, classification: classificationData, summary: result.data }));
        updateStepStatus('classification', 'passed');
        setLastSaved(new Date());

        toast({
          title: 'Classification Complete',
          description: `Processed ${classificationData.total} invoices across ${Object.keys(classificationData).length - 1} categories`,
        });

        // Auto-advance to validation
        setTimeout(() => {
          setCurrentStepId('validation');
        }, 1000);
      } else {
        throw new Error(result.validation_report?.errors?.[0] || 'Processing failed');
      }
    } catch (error) {
      updateStepStatus('classification', 'failed');
      toast({
        title: 'Classification Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsClassifying(false);
    }
  };

  // ============================================
  // STEP 3: VALIDATION
  // ============================================

  // Run validation - use backend validation engine
  const runValidation = async () => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      // Check if we have file and mapping
      if (!file || Object.keys(columnMapping).length === 0) {
        if (validationResult?.validationReport) {
          const rebuilt = buildValidationSummary(
            {
              success: true,
              is_valid: validationResult.errors === 0,
              validation_report: validationResult.validationReport,
              summary: {
                total_rows: validationResult.total,
                input_errors: validationResult.errors,
                input_warnings: validationResult.warnings,
                table_errors: 0,
                table_warnings: 0,
              },
            },
            validationResult.total,
          );

          setValidationResult(rebuilt.validationResult);
          setValidationErrors(rebuilt.validationErrors);
          setStepData(prev => ({ ...prev, validation: rebuilt.validationResult }));
          updateStepStatus('validation', rebuilt.validationResult.errors > 0 ? 'failed' : 'passed');
          return;
        }

        throw new Error('Please complete the upload and mapping steps first');
      }

      // Convert columnMapping to Record<string, string>
      const mappingRecord = Object.entries(columnMapping).reduce((acc, [key, value]) => {
        acc[key] = value || '';
        return acc;
      }, {} as Record<string, string>);

      console.log('[DEBUG] Running validation with:', {
        hasFile: !!file,
        mappingKeys: Object.keys(mappingRecord),
        gstin
      });

      // Call the new file-based validation API with structured engine
      const validationResponse = await validateGSTR1File(
        file,
        mappingRecord,
        gstin
      );

      console.log('[DEBUG] Validation response:', validationResponse);
      const built = buildValidationSummary(validationResponse, validationResponse.summary?.total_rows || 0);
      setValidationResult(built.validationResult);
      setValidationErrors(built.validationErrors);
      setStepData(prev => ({ ...prev, validation: built.validationResult }));
      updateStepStatus('validation', built.validationResult.errors > 0 ? 'failed' : 'passed');
      setLastSaved(new Date());

      toast({
        title: built.validationResult.errors > 0 ? 'Validation Found Issues' : 'Validation Passed',
        description: `${built.validationResult.passed} passed, ${built.validationResult.warnings} warnings, ${built.validationResult.errors} errors`,
        variant: built.validationResult.errors > 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      updateStepStatus('validation', 'failed');
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      console.error('[DEBUG] Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Compute filtered errors based on filters
  const filteredErrors = useMemo(() => {
    return validationErrors.filter(err => {
      // Invoice number filter
      if (invoiceFilter && !err.invoice.toLowerCase().includes(invoiceFilter.toLowerCase())) {
        return false;
      }
      // GSTIN filter (check if error message contains GSTIN-related info)
      if (gstinFilter && !err.error.toLowerCase().includes(gstinFilter.toLowerCase())) {
        return false;
      }
      // HSN filter
      if (hsnFilter && !err.error.toLowerCase().includes(hsnFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [validationErrors, invoiceFilter, gstinFilter, hsnFilter]);

  // Handle edit invoice
  const handleEditInvoice = (invoiceNo: string) => {
    toast({
      title: 'Edit Invoice',
      description: `Opening editor for invoice: ${invoiceNo}`,
    });
    // Navigate to the invoice in the table or open edit modal
    // For now, we'll just show a toast
  };

  // Handle delete invoice
  const handleDeleteInvoice = (invoiceNo: string) => {
    if (confirm(`Are you sure you want to delete invoice ${invoiceNo}?`)) {
      // Remove from validation errors
      setValidationErrors(prev => prev.filter(err => err.invoice !== invoiceNo));
      toast({
        title: 'Invoice Deleted',
        description: `Invoice ${invoiceNo} has been removed`,
      });
    }
  };
  
  // Handle filters apply
  const handleFiltersApply = (filters: GSTR1Filters) => {
    setActiveFilters(filters);
    toast({
      title: 'Filters Applied',
      description: `Filtered by ${filters.gstin !== 'all' ? filters.gstin : 'all GSTINs'}, ${filters.filingStatus === 'all' ? 'all statuses' : filters.filingStatus}, ${filters.sections.length} sections`,
    });
  };
  
  // Handle file import
  const handleFileImport = (file: File, mapping: Partial<ColumnMapping>) => {
    setFile(file);
    setColumnMapping(mapping as ColumnMapping);
    // Trigger classification automatically
    runClassification();
    toast({
      title: 'File Imported',
      description: `Processing ${file.name}...`,
    });
  };
  
  // Handle download PAN summary - Functional
  const handleDownloadPANSummary = async () => {
    if (!workspaceId || !gstin) {
      toast({
        title: 'Error',
        description: 'Missing workspace or GSTIN information',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const { downloadGSTR1PANSummary } = await import('@/lib/api');
      const blob = await downloadGSTR1PANSummary(workspaceId, gstin, returnPeriod);
      downloadExcelFromResponse(blob, `GSTR1_PAN_Summary_${gstin}_${returnPeriod}.xlsx`);
      toast({
        title: 'Download Started',
        description: 'Downloading PAN Summary for GSTR-1/IFF...',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download PAN summary',
        variant: 'destructive',
      });
    }
  };
  
  // Handle sync from GSTN - Functional
  const handleSyncFromGSTN = async () => {
    if (!workspaceId || !gstin) {
      toast({
        title: 'Error',
        description: 'Missing workspace or GSTIN information',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const { syncGSTR1FromGSTN } = await import('@/lib/api');
      const result = await syncGSTR1FromGSTN(workspaceId, gstin, returnPeriod);
      if (result.success) {
        toast({
          title: 'Sync Initiated',
          description: 'Syncing draft GSTR-1 from GSTN...',
        });
        // Refresh data after sync
        if (result.data) {
          setUploadResult({
            success: true,
            data: result.data,
            validation_report: {
              errors: [],
              warnings: [],
              final_status: 'success',
            },
            total_records: result.records_synced ?? 0,
          } as GSTR1ProcessResponse);
        }
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync from GSTN',
        variant: 'destructive',
      });
    }
  };
  
  // Handle select for NIL - Functional
  const handleSelectForNIL = async () => {
    if (!workspaceId || !gstin) {
      toast({
        title: 'Error',
        description: 'Missing workspace or GSTIN information',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { selectGSTR1ForNIL } = await import('@/lib/api');
      const result = await selectGSTR1ForNIL(workspaceId, gstin, returnPeriod);

      if (!result.success) {
        throw new Error(result.message || 'Failed to select for NIL');
      }

      toast({
        title: 'NIL Return Selected',
        description: 'Selected invoices marked for NIL returns',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to select for NIL returns',
        variant: 'destructive',
      });
    }
  };

  // Handle select summary source - Functional
  const handleSelectSource = async () => {
    if (!workspaceId || !gstin) {
      toast({
        title: 'Error',
        description: 'Missing workspace or GSTIN information',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { selectGSTR1SummarySource } = await import('@/lib/api');
      const source = uploadResult?.data ? 'uploaded' : 'manual';
      const result = await selectGSTR1SummarySource(workspaceId, gstin, returnPeriod, source);

      if (!result.success) {
        throw new Error(result.message || 'Failed to save summary source');
      }

      toast({
        title: 'Summary Source Saved',
        description: `Summary source set to ${result.source || source}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to select summary source',
        variant: 'destructive',
      });
    }
  };
  
  // Handle E-Invoice vs Sales Register Recon button
  const handleReconciliation = () => {
    navigate('/gstr1/reconciliation');
  };
  
  // Handle Validate and Upload
  const handleValidateAndUpload = async () => {
    if (!uploadResult?.data) {
      toast({
        title: 'No Data',
        description: 'Please import data first before validating',
        variant: 'destructive',
      });
      return;
    }
    
    setCurrentStepId('validation');
    await runValidation();
  };

  // Handle export single row
  const handleExportRow = (err: {invoice: string; error: string}) => {
    const exportData = {
      invoice: err.invoice,
      error: err.error,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error_${err.invoice}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export Complete',
      description: `Error for invoice ${err.invoice} has been exported`,
    });
  };

  // Proceed despite warnings
  const proceedWithWarnings = () => {
    updateStepStatus('validation', 'passed');
    setCurrentStepId('summary');
  };

  // ============================================
  // STEP 4: SUMMARY & REVIEW
  // ============================================

  // Generate GSTR-1
  const handleGenerateGSTR1 = async () => {
    if (!file || !isMappingComplete) return;

    setIsLoading(true);

    try {
      const mappingDict: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([key, value]) => {
        if (value) mappingDict[key] = value;
      });

      const result = await processGSTR1Excel(file, mappingDict, gstin, returnPeriod, workspaceId);
      
      // Phase E1: If result.success is false, show toast with backend message and do not change table state
      if (!result.success) {
        const errorMessage = result.message || 
          result.validation_report?.errors?.[0] || 
          'Processing failed. Please check your file and try again.';
        
        toast({
          title: 'Generation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // Do NOT change table state - keep existing data
        updateStepStatus('summary', 'failed');
        setIsLoading(false);
        return;
      }
      
      setUploadResult(result);
      
      if (result.success && result.data) {
        // Transform and store data
        const transformedB2B = transformBackendB2BToFrontend(result.data.b2b || []);
        const transformedB2CL = transformBackendB2CLToFrontend(result.data.b2cl || []);
        const transformedB2CS = transformBackendB2CSToFrontend(result.data.b2cs || []);
        const transformedCDNR = transformBackendCDNRToFrontend(result.data.cdnr || []);
        const transformedExport = transformBackendExportToFrontend(result.data.exp || []);
        
        // State is now saved to backend automatically via useEffect
        // No localStorage persistence needed - backend is the source of truth
        const transformedData = {
          b2b: transformedB2B,
          b2cl: transformedB2CL,
          b2cs: transformedB2CS,
          cdnr: transformedCDNR,
          exp: transformedExport,
          hsn: result.data.hsn || []
        };
        
        // Update state with transformed data
        setB2bData(transformedB2B);
        setB2clData(transformedB2CL);
        setB2csData(transformedB2CS);
        setCdnrData(transformedCDNR);
        setExportsData(transformedExport);
        if (result.data.hsn && result.data.hsn.length > 0) {
          setHsnData(result.data.hsn.map((h: any) => ({
            hsnCode: h.hsn_code || '',
            description: h.description || '',
            uqc: h.uom || 'NOS',
            totalQuantity: h.quantity || 0,
            totalValue: h.total_value || 0,
            taxableValue: h.taxable_value || 0,
            igst: h.igst || 0,
            cgst: h.cgst || 0,
            sgst: h.sgst || 0,
            cess: h.cess || 0
          })));
        }

        // Automatically run validation with backend results
        await runValidationWithBackend(result);
      }

      setStepData(prev => ({ ...prev, summary: result.data }));
      updateStepStatus('summary', 'passed');
      setLastSaved(new Date());
      
      toast({
        title: 'GSTR-1 Generated',
        description: `Processed ${result.total_records || 0} records`,
      });
    } catch (error) {
      updateStepStatus('summary', 'failed');
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Run validation with actual backend results
  const runValidationWithBackend = async (result: GSTR1ProcessResponse) => {
    try {
      await runValidation();

    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // ============================================
  // STEP 5: FILE RETURN
  // ============================================

  // File GSTR-1
  const fileGSTR1 = async () => {
    if (!uploadResult?.data) return;

    setIsFiling(true);

    try {
      // Call backend API to file GSTR-1
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/gstr1/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gst_access_token')}`
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          gstin: gstin,
          return_period: returnPeriod,
          gstr1_data: uploadResult.data
        })
      });

      if (!response.ok) {
        throw new Error('Filing failed');
      }

      const filingData = await response.json();

      const result: FilingResult = {
        success: filingData.success ?? true,
        arn: filingData.arn,
        ackNumber: filingData.ack_number,
        filingId: filingData.filing_id,
        status: filingData.status,
        filingDate: filingData.filing_date || new Date().toISOString(),
        message: filingData.message || 'GSTR-1 filed successfully'
      };

      setFilingResult(result);
      setStepData(prev => ({ ...prev, file: result }));
      updateStepStatus('file', 'passed');
      setLastSaved(new Date());

      // Add to filing history
      setFilingHistory(prev => [{
        period: returnPeriod,
        arn: result.arn!,
        date: result.filingDate!,
        status: 'Filed'
      }, ...prev]);

      toast({
        title: 'GSTR-1 Filed Successfully',
        description: `ARN: ${result.arn}`,
      });

      // Auto-advance to post-filing
      setTimeout(() => {
        setCurrentStepId('postfiling');
        if (onComplete) {
          onComplete(result);
        }
      }, 1000);
    } catch (error) {
      updateStepStatus('file', 'failed');
      toast({
        title: 'Filing Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsFiling(false);
    }
  };

  // Download JSON
  const handleDownloadJSON = () => {
    if (!uploadResult?.data) return;
    
    const jsonData = JSON.stringify(uploadResult.data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gstr1_${returnPeriod}_${gstin}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'JSON Downloaded',
      description: 'GSTR-1 JSON has been downloaded',
    });
  };

  // Export to Excel
  const handleExport = async () => {
    if (!uploadResult?.data) return;
    
    setIsLoading(true);
    
    try {
      const blob = await apiExportGSTR1Excel(
        uploadResult.data,
        returnPeriod,
        gstin,
        'Test Company'
      );
      
      downloadExcelFromResponse(blob, `gstr1_${returnPeriod}.xlsx`);
      
      toast({
        title: 'Export Complete',
        description: 'GSTR-1 exported to Excel successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  // Render step indicator
  const renderStepIndicator = () => {
    return (
      <div className="w-full">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const canNavigate = isCompleted || validationStatus[step.id] === 'passed';

            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => canNavigate && goToStep(step.id)}
                  disabled={!canNavigate}
                  className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all min-w-[80px] ${
                    isCurrent 
                      ? 'bg-corporate-primary text-white shadow-lg' 
                      : isCompleted 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : canNavigate
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    isCurrent 
                      ? 'bg-white/20' 
                      : isCompleted 
                        ? 'bg-green-500/20' 
                        : 'bg-slate-200 dark:bg-slate-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium whitespace-nowrap">{step.title}</p>
                  </div>
                </button>
                
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-1 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStepId) {
      case 'upload':
        return renderUploadStep();
      case 'classification':
        return renderClassificationStep();
      case 'validation':
        return renderValidationStep();
      case 'summary':
        return renderSummaryStep();
      case 'file':
        return renderFileStep();
      case 'postfiling':
        return renderPostFilingStep();
      default:
        return null;
    }
  };

  // ============================================
  // STEP RENDERERS
  // ============================================

  // Step 1: Upload/Import Data
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="p-6 text-center cursor-pointer hover:border-corporate-primary/50 transition-colors" onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
            <div className="h-12 w-12 rounded-full bg-corporate-primary/10 dark:bg-corporate-primary/20 flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="h-6 w-6 text-corporate-primary" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Upload Excel/JSON</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload .xlsx, .xls, or .json files</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="p-6 text-center cursor-pointer hover:border-corporate-primary/50 transition-colors">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Import from ERP</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Connect to Tally, SAP, or other ERPs</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="p-6 text-center cursor-pointer hover:border-corporate-primary/50 transition-colors">
            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
              <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Use Previous Data</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Import from previously uploaded files</p>
          </CardContent>
        </Card>
      </div>

      {/* Dropzone */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-corporate-primary bg-corporate-primary/5 dark:bg-corporate-primary/10' 
                : 'border-slate-300 dark:border-slate-600 hover:border-corporate-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-corporate-primary animate-spin" />
                <p className="text-slate-500 dark:text-slate-400">Processing file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-corporate-primary/10 dark:bg-corporate-primary/20 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-corporate-primary" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file here'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">or click to browse from your computer</p>
                </div>
                <Badge variant="secondary">.xlsx, .xls, .csv, .json</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      {parsedData && (
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Map Columns to GST Fields</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Match your file columns to required GST fields
                </CardDescription>
              </div>
              <Badge variant={isMappingComplete ? 'default' : 'destructive'}>
                {isMappingComplete ? 'Ready to Process' : 'Mapping Incomplete'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
                <div key={field} className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Select --</option>
                    {parsedData.headers.filter(h => h && h.trim()).map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Upload History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{item.filename}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {item.date.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 2: Classification & Categorization
  const renderClassificationStep = () => (
    <div className="space-y-6">
      {/* Classification Status */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Invoice Classification</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Auto-categorize invoices into GST return sections
              </CardDescription>
            </div>
            <Badge variant={classificationResult ? 'default' : 'secondary'}>
              {classificationResult ? 'Completed' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isClassifying ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 text-corporate-primary animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Classifying invoices...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This may take a few moments</p>
            </div>
          ) : classificationResult ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">B2B</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{classificationResult.b2b}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">Invoices</p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-900 dark:text-green-100">B2CL</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{classificationResult.b2cl}</p>
                <p className="text-sm text-green-600 dark:text-green-400">Invoices</p>
              </div>
              
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-900 dark:text-purple-100">B2CS</span>
                </div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{classificationResult.b2cs}</p>
                <p className="text-sm text-purple-600 dark:text-purple-400">Invoices</p>
              </div>
              
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <span className="font-medium text-orange-900 dark:text-orange-100">Exports</span>
                </div>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{classificationResult.exports}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">Invoices</p>
              </div>

              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-red-900 dark:text-red-100">CDNR</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{classificationResult.cdnr}</p>
                <p className="text-sm text-red-600 dark:text-red-400">Notes</p>
              </div>

              <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-medium text-cyan-900 dark:text-cyan-100">CNDS</span>
                </div>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{classificationResult.cnds}</p>
                <p className="text-sm text-cyan-600 dark:text-cyan-400">Notes</p>
              </div>

              <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium text-indigo-900 dark:text-indigo-100">HSN</span>
                </div>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{classificationResult.hsn}</p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Codes</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">Total</span>
                </div>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{classificationResult.total}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Records</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Upload data to begin classification</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classification Actions */}
      {!classificationResult && (
        <div className="flex justify-center">
          <Button 
            size="lg"
            onClick={runClassification}
            disabled={!file || !isMappingComplete}
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            <Tag className="mr-2 h-4 w-4" />
            Run Auto-Classification
          </Button>
        </div>
      )}
    </div>
  );

  // Step 3: Validation
  const renderValidationStep = () => (
    <div className="space-y-6">
      {/* Validation Summary */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Validation Results</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Comprehensive validation of your GSTR-1 data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input 
                  type="checkbox" 
                  checked={showWarnings}
                  onChange={(e) => setShowWarnings(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                Show Warnings
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isValidating ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 text-corporate-primary animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Running validation checks...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This may take a few moments</p>
            </div>
          ) : validationResult ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-center">
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{validationResult.total}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Checks</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{validationResult.passed}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Passed</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-center">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{validationResult.warnings}</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">Warnings</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{validationResult.errors}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Errors</p>
                </div>
              </div>

              {/* Validation Details */}
              <div className="space-y-2">
                {validationResult.details.map((detail, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      detail.status === 'passed' 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : detail.status === 'warning'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {detail.status === 'passed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      ) : detail.status === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{detail.category}</p>
                          <Badge variant={
                            detail.status === 'passed' ? 'default' : 
                            detail.status === 'warning' ? 'secondary' : 'destructive'
                          }>
                            {detail.status === 'passed' ? 'Passed' : 
                             detail.status === 'warning' ? 'Warning' : 'Error'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{detail.message}</p>
                        {detail.invoiceNo && (
                          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                            Invoice: {detail.invoiceNo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Validation Errors Table */}
              {validationErrors.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Validation Errors
                  </h4>
                  
                  {/* Filter Panel */}
                  <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Invoice Number
                        </label>
                        <Input
                          placeholder="Filter by invoice..."
                          value={invoiceFilter}
                          onChange={(e) => setInvoiceFilter(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          GSTIN
                        </label>
                        <Input
                          placeholder="Filter by GSTIN..."
                          value={gstinFilter}
                          onChange={(e) => setGstinFilter(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          HSN Code
                        </label>
                        <Input
                          placeholder="Filter by HSN..."
                          value={hsnFilter}
                          onChange={(e) => setHsnFilter(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Date Range
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full"
                            placeholder="From"
                          />
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full"
                            placeholder="To"
                          />
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setInvoiceFilter('');
                          setGstinFilter('');
                          setHsnFilter('');
                          setDateFrom('');
                          setDateTo('');
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            Invoice
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            Error
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredErrors.map((err, idx) => (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                            <td className="py-2 px-4 text-slate-900 dark:text-slate-100 font-mono">
                              {err.invoice}
                            </td>
                            <td className="py-2 px-4 text-red-600 dark:text-red-400">
                              {err.error}
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditInvoice(err.invoice)}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeleteInvoice(err.invoice)}
                                >
                                  Delete
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleExportRow(err)}
                                >
                                  Export
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {filteredErrors.length === 0 && (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                      No errors match the current filters
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Generate GSTR-1 to run validation</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Actions */}
      <div className="flex justify-center gap-4">
        {!validationResult && (
          <Button 
            size="lg"
            onClick={handleGenerateGSTR1}
            disabled={isLoading}
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Generate & Validate
          </Button>
        )}
        
        {validationResult && validationResult.errors > 0 && (
          <Button 
            size="lg"
            onClick={runValidation}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-Validate
          </Button>
        )}
        
        {validationResult && validationResult.errors === 0 && (
          <Button 
            size="lg"
            onClick={goToNextStep}
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            Continue to Summary
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        
        {validationResult && validationResult.errors > 0 && (
          <Button 
            size="lg"
            onClick={proceedWithWarnings}
            variant="outline"
          >
            Proceed Anyway
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Invoice Tables - Rendered after Validation (Step 3) */}
      {validationResult && uploadResult?.data && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-corporate-primary/10 dark:bg-corporate-primary/20 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-corporate-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Invoice Details
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View and edit categorized invoices
              </p>
            </div>
          </div>

          <Tabs defaultValue="b2b" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="b2b">B2B ({uploadResult.data.b2b?.length || 0})</TabsTrigger>
              <TabsTrigger value="b2cs">B2CS ({uploadResult.data.b2cs?.length || 0})</TabsTrigger>
              <TabsTrigger value="cdnr">CDN/R ({uploadResult.data.cdnr?.length || 0})</TabsTrigger>
              <TabsTrigger value="hsn">HSN ({uploadResult.data.hsn?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="b2b" className="mt-4">
              <B2BTable 
                data={b2bData.length > 0 ? b2bData : (uploadResult.data.b2b || [])} 
                onDataChange={setB2bData}
              />
            </TabsContent>

            <TabsContent value="b2cs" className="mt-4">
              <B2CSTable 
                data={b2csData.length > 0 ? b2csData : (uploadResult.data.b2cs || [])}
                onDataChange={setB2csData}
              />
            </TabsContent>

            <TabsContent value="cdnr" className="mt-4">
              <CDNRTable 
                data={cdnrData.length > 0 ? cdnrData : (uploadResult.data.cdnr || [])}
                onDataChange={setCdnrData}
              />
            </TabsContent>

            <TabsContent value="hsn" className="mt-4">
              <HSNTable 
                data={hsnData.length > 0 ? hsnData : (uploadResult.data.hsn || [])}
                onDataChange={setHsnData}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );

  // Step 4: Summary & Review
  const renderSummaryStep = () => (
    <div className="space-y-6">
      {/* Summary Cards - Using Single Source of Truth */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Documents</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {gstr1Summary?.total_docs || uploadResult?.data?.summary?.total_invoices || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Taxable Value</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ₹{(gstr1Summary?.total_taxable || uploadResult?.data?.summary?.total_taxable_value || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Tax</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ₹{(gstr1Summary?.total_tax || ((uploadResult?.data?.summary?.total_igst || 0) + (uploadResult?.data?.summary?.total_cgst || 0) + (uploadResult?.data?.summary?.total_sgst || 0))).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">B2B</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {gstr1Summary?.b2b_count || uploadResult?.data?.summary?.b2b_count || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">B2C</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {gstr1Summary?.b2c_count || uploadResult?.data?.summary?.exp_count || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different GSTR-1 tables */}
      {uploadResult?.data && (
        <Tabs value={activeSummaryTab} onValueChange={setActiveSummaryTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="b2b">B2B ({uploadResult.data.b2b?.length || 0})</TabsTrigger>
            <TabsTrigger value="b2cl">B2CL ({uploadResult.data.b2cl?.length || 0})</TabsTrigger>
            <TabsTrigger value="b2cs">B2CS ({uploadResult.data.b2cs?.length || 0})</TabsTrigger>
            <TabsTrigger value="exp">Exports ({uploadResult.data.exp?.length || uploadResult.data.export?.length || 0})</TabsTrigger>
            <TabsTrigger value="cdnr">CDN/R ({uploadResult.data.cdnr?.length || 0})</TabsTrigger>
            <TabsTrigger value="hsn">HSN ({uploadResult.data.hsn?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Summary Tab - Using Single Source of Truth */}
          <TabsContent value="summary" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100">GSTR-1 Summary</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      All data from single source of truth
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
                      <Download className="h-4 w-4" />
                      Download JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Single Source of Truth Summary Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GSTIN</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Invoice No</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Date</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Taxable Value</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">IGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">CGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">SGST</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1Data.length > 0 ? (
                        gstr1Data.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-4 font-mono text-sm text-slate-700 dark:text-slate-300">{row.gstin || '-'}</td>
                            <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{row.invoice_number || '-'}</td>
                            <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{row.invoice_date || '-'}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(row.taxable_value || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(row.igst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(row.cgst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(row.sgst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                              ₹{(row.total_tax || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        // Fallback to old data format
                        (uploadResult?.data?.b2b || []).slice(0, 15).map((inv: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-4 font-mono text-sm text-slate-700 dark:text-slate-300">{inv.customer?.gstin || '-'}</td>
                            <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{inv.invoice_no || '-'}</td>
                            <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{inv.invoice_date || '-'}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(inv.taxable_value || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(inv.igst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(inv.cgst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">₹{(inv.sgst || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                              ₹{((inv.igst || 0) + (inv.cgst || 0) + (inv.sgst || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                  Showing {Math.min(15, gstr1Data.length || (uploadResult?.data?.b2b?.length || 0))} of {gstr1Data.length || (uploadResult?.data?.b2b?.length || 0)} documents from single source of truth
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* B2B Tab */}
          <TabsContent value="b2b">
            {/* DEBUG: Log b2bData before rendering */}
            {console.log('[DEBUG] Rendering B2BTable, b2bData.length:', b2bData.length) || true}
            <B2BTable 
              data={b2bData.length > 0 ? b2bData : (uploadResult.data.b2b || [])} 
              onDataChange={setB2bData}
            />
          </TabsContent>

          {/* B2CL Tab */}
          <TabsContent value="b2cl">
            {console.log('[DEBUG] Rendering B2CLTable, b2clData.length:', b2clData.length) || true}
            <B2CLTable 
              data={b2clData.length > 0 ? b2clData : (uploadResult.data.b2cl || [])}
              onDataChange={setB2clData}
            />
          </TabsContent>

          {/* B2CS Tab */}
          <TabsContent value="b2cs">
            {console.log('[DEBUG] Rendering B2CSTable, b2csData.length:', b2csData.length) || true}
            <B2CSTable 
              data={b2csData.length > 0 ? b2csData : (uploadResult.data.b2cs || [])}
              onDataChange={setB2csData}
            />
          </TabsContent>

          {/* Exports Tab */}
          <TabsContent value="exp">
            {console.log('[DEBUG] Rendering ExportsTable, exportsData.length:', exportsData.length) || true}
            <ExportsTable 
              data={exportsData.length > 0 ? exportsData : (uploadResult.data.exp || [])}
              onDataChange={setExportsData}
            />
          </TabsContent>

          {/* CDN/R Tab */}
          <TabsContent value="cdnr">
            {console.log('[DEBUG] Rendering CDNRTable, cdnrData.length:', cdnrData.length) || true}
            <CDNRTable 
              data={cdnrData.length > 0 ? cdnrData : (uploadResult.data.cdnr || [])}
              onDataChange={setCdnrData}
            />
          </TabsContent>

          {/* HSN Tab */}
          <TabsContent value="hsn">
            {console.log('[DEBUG] Rendering HSNTable, hsnData.length:', hsnData.length) || true}
            <HSNTable 
              data={hsnData.length > 0 ? hsnData : (uploadResult.data.hsn || [])}
              onDataChange={setHsnData}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* E-Invoice Reconciliation Link */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900 dark:text-slate-100">E-Invoice vs Sales Register Reconciliation</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Compare your E-Invoice data with Sales Register for compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/gstr1/reconciliation')}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Open E-Invoice Reconciliation
          </Button>
        </CardContent>
      </Card>

      {/* Compare with Previous Period */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Compare with Previous Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-sm text-slate-500 dark:text-slate-400">Taxable Value</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">+15.2%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">vs previous period</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-sm text-slate-500 dark:text-slate-400">Invoice Count</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">+8.5%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">vs previous period</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-sm text-slate-500 dark:text-slate-400">Tax Liability</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">+12.3%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">vs previous period</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Step 5: File Return
  const renderFileStep = () => (
    <div className="space-y-6">
      {/* Filing Options */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-100">File GSTR-1</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Generate JSON and file via GSTN
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* GSTIN & Period Info */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">GSTIN</p>
              <p className="font-mono font-medium text-slate-900 dark:text-slate-100">{gstin}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Return Period</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{returnPeriod}</p>
            </div>
          </div>

          {/* Filing Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className="p-6 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-corporate-primary/50 cursor-pointer transition-colors"
              onClick={handleDownloadJSON}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">Preview JSON</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">View and download JSON before filing</p>
                </div>
              </div>
            </div>

            <div 
              className="p-6 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-corporate-primary/50 cursor-pointer transition-colors"
              onClick={handleExport}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FileDown className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">Export Excel</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Download Excel for your records</p>
                </div>
              </div>
            </div>
          </div>

          {/* File via GSP/GSTN */}
          {filingResult ? (
            <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900 dark:text-green-100">Filing In Progress</h3>
                  <p className="text-sm text-green-700 dark:text-green-400">{filingResult.message}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-corporate-primary/5 dark:bg-corporate-primary/10 border border-corporate-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-corporate-primary/20 flex items-center justify-center">
                    <Send className="h-6 w-6 text-corporate-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">File via GSTN</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Submit GSTR-1 to GSTN portal</p>
                  </div>
                </div>
                <Button 
                  size="lg"
                  onClick={fileGSTR1}
                  disabled={isFiling}
                  className="bg-corporate-primary hover:bg-corporate-primaryHover"
                >
                  {isFiling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Filing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      File Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Step 6: Post-Filing
  const renderPostFilingStep = () => (
    <div className="space-y-6">
      {/* Filing Confirmation */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">GSTR-1 Filed Successfully!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Your return has been submitted to GSTN</p>
          
          {filingResult && (
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm text-slate-500 dark:text-slate-400">ARN</p>
                <p className="font-mono font-medium text-slate-900 dark:text-slate-100">{filingResult.arn}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm text-slate-500 dark:text-slate-400">Filing Date</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {filingResult.filingDate ? new Date(filingResult.filingDate).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleDownloadJSON}>
              <Download className="mr-2 h-4 w-4" />
              Download JSON
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
            <Button onClick={resetWorkflow} className="bg-corporate-primary hover:bg-corporate-primaryHover">
              <Upload className="mr-2 h-4 w-4" />
              File Another Return
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filing History */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Filing History</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                View your previous GSTR-1 filings
              </CardDescription>
            </div>
            <History className="h-5 w-5 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent>
          {filingHistory.length > 0 ? (
            <div className="space-y-2">
              {filingHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Period: {item.period}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">ARN: {item.arn}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="default">{item.status}</Badge>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No previous filings</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  // Show loading spinner while fetching from backend
  if (isLoadingFromBackend) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-corporate-primary animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Loading your GSTR-1 workflow...
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fetching saved progress from server
          </p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (loadError && !uploadResult) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Failed to load workflow
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            {loadError}
          </p>
          <Button 
            onClick={() => {
              setLoadError(null);
              setIsLoadingFromBackend(true);
              // Trigger reload by resetting dependencies
            }}
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show empty state for new filings
  if (!uploadResult && !isLoadingFromBackend && currentStepId === 'upload') {
    // Continue with normal render - the upload step will be shown
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Step 1/3: Prepare GSTR-1</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                GSTIN: <span className="font-mono">{gstin}</span> | Period: <span className="font-mono">{returnPeriod}</span>
              </p>
            </div>
            
            {/* Action Bar - ClearTax Style */}
            <div className="flex items-center gap-2">
              {/* E-Invoice vs Sales Register Recon Button */}
              <Button 
                variant="outline" 
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleReconciliation}
              >
                <ArrowRightLeft className="h-4 w-4" />
                E-Invoice (GSTR-1) vs Sales Register (SR) Recon
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
                onDelete={handleDeleteFromClear}
              />
              
              {/* Validate and Upload Button */}
              <Button 
                className="gap-2 bg-corporate-primary hover:bg-corporate-primaryHover"
                onClick={handleValidateAndUpload}
              >
                <Shield className="h-4 w-4" />
                Validate and Upload
              </Button>
            </div>
          </div>
          
          {/* Second row with last saved and reset */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lastSaved && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  Last saved: {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={resetWorkflow}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Step Indicator */}
          {renderStepIndicator()}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Step Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-corporate-primary/10 dark:bg-corporate-primary/20 flex items-center justify-center">
              {WORKFLOW_STEPS[currentStepIndex].icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {WORKFLOW_STEPS[currentStepIndex].title}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {WORKFLOW_STEPS[currentStepIndex].description}
              </p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <div>
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={goToPreviousStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Step dots for mobile */}
            <div className="flex items-center gap-1 md:hidden">
              {WORKFLOW_STEPS.map((_, index) => (
                <div 
                  key={index}
                  className={`h-2 w-2 rounded-full ${
                    index === currentStepIndex 
                      ? 'bg-corporate-primary' 
                      : index < currentStepIndex 
                        ? 'bg-green-500' 
                        : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            {currentStepIndex < WORKFLOW_STEPS.length - 1 && currentStepId !== 'postfiling' && (
              <Button 
                onClick={goToNextStep}
                disabled={
                  (currentStepId === 'upload' && (!file || !isMappingComplete)) ||
                  (currentStepId === 'classification' && !classificationResult) ||
                  (currentStepId === 'validation' && !validationResult) ||
                  (currentStepId === 'summary' && !uploadResult)
                }
                className="bg-corporate-primary hover:bg-corporate-primaryHover"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Filters Drawer */}
      <GSTR1FiltersDrawer
        open={filtersDrawerOpen}
        onOpenChange={setFiltersDrawerOpen}
        onApply={handleFiltersApply}
        availableGstins={[]}
        initialFilters={activeFilters || undefined}
      />
      
      {/* Import Drawer */}
      <GSTR1ImportDrawer
        open={importDrawerOpen}
        onOpenChange={setImportDrawerOpen}
        onImport={handleFileImport}
      />
    </div>
  );
}
