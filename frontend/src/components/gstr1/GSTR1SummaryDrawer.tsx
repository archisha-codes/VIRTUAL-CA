import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Inbox,
  FileText,
  Filter,
  Upload,
  Calendar,
  Search,
  ChevronLeft,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { getGstr1State, processGSTR1Excel, saveGstr1State } from '@/lib/api';
import { parseExcelFile, autoMapColumns, REQUIRED_FIELDS, type ColumnMapping } from '@/lib/excel-parser';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DOCUMENT_TYPE_OPTIONS, 
  CANCELLED_OPTIONS, 
  TAX_RATE_PERCENTAGE_OPTIONS, 
  COMPOSITION_UIN_OPTIONS, 
  SECTION_9_5_OPTIONS, 
  TYPE_OF_EXPORT_OPTIONS, 
  STATE_OPTIONS, 
  SHIPPING_PORT_CODES 
} from './gstr1-form-options';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface GSTR1SummaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string;
  businessName?: string;
  businesses?: any[];
  onSelectGstin?: (gstin: string, businessName: string) => void;
  returnPeriod?: string;
}

class DrawerErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-white text-red-600 font-mono text-sm max-w-[800px] whitespace-pre-wrap">
          <h2 className="font-bold mb-2">Drawer Crashed:</h2>
          {this.state.error && this.state.error.toString()}
        </div>
      );
    }
    return this.props.children;
  }
}

const getInitialDateRange = (period?: string): DateRange | undefined => {
  if (!period || !/^\d{6}$/.test(period)) {
    return undefined;
  }

  const month = Number(period.slice(0, 2));
  const year = Number(period.slice(2));

  if (Number.isNaN(month) || Number.isNaN(year) || month < 1 || month > 12) {
    return undefined;
  }

  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 0),
  };
};

const normalizeNumericValue = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/[,₹\s]/g, '').trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRowValue = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const buildSummaryRecord = (row: Record<string, unknown>) => {
  const docCount = normalizeNumericValue(getRowValue(row, ['# Docs', '# Rows', 'Doc Count', 'docCount', 'doc_count', 'Count'])) || 1;
  const taxableAmount = normalizeNumericValue(getRowValue(row, ['Taxable Amount(₹)', 'Taxable Amount', 'Taxable Value(₹)', 'Taxable Value', 'taxableAmount', 'taxable_value', 'txval', 'taxable', 'amount']));
  const igst = normalizeNumericValue(getRowValue(row, ['IGST (₹)', 'IGST', 'igst', 'iamt', 'IGST Amount']));
  const cgst = normalizeNumericValue(getRowValue(row, ['CGST (₹)', 'CGST', 'cgst', 'camt', 'CGST Amount']));
  const sgst = normalizeNumericValue(getRowValue(row, ['SGST (₹)', 'SGST', 'sgst', 'samt', 'SGST Amount']));
  const cess = normalizeNumericValue(getRowValue(row, ['CESS (₹)', 'CESS', 'cess', 'csamt', 'CESS Amount']));
  const totalTax = normalizeNumericValue(getRowValue(row, ['Total Tax(₹)', 'Total Tax', 'totalTax', 'total_tax'])) || (igst + cgst + sgst);
  const totalAmount = normalizeNumericValue(getRowValue(row, ['Total Amount(₹)', 'Total Amount', 'totalAmount', 'total_amount'])) || (taxableAmount + totalTax);

  return {
    docCount: String(docCount),
    totalAmount: totalAmount.toFixed(2),
    taxableAmount: taxableAmount.toFixed(2),
    totalTax: totalTax.toFixed(2),
    igst: igst.toFixed(2),
    cgst: cgst.toFixed(2),
    sgst: sgst.toFixed(2),
    cess: cess.toFixed(2),
    doc_count: docCount,
    total_amount: totalAmount,
    taxable_value: taxableAmount,
    total_tax: totalTax,
    txval: taxableAmount,
    iamt: igst,
    camt: cgst,
    samt: sgst,
    csamt: cess,
  };
};

const SECTION_PATTERNS: Array<{ key: string; patterns: RegExp[] }> = [
  { key: 'b2b', patterns: [/\bb2b\b/i] },
  { key: 'b2cl', patterns: [/\bb2cl\b/i] },
  { key: 'b2cs', patterns: [/\bb2cs\b/i, /b2c small/i] },
  { key: 'exp', patterns: [/export/i] },
  { key: 'cdnr', patterns: [/credit debit note.*registered/i, /\bcdnr\b/i, /9b/i] },
  { key: 'cdnur', patterns: [/credit debit note.*unregistered/i, /\bcdnur\b/i] },
  { key: 'sup-reg', patterns: [/registered recipients/i, /supplies to registered recipients/i, /9\(5\)/i] },
  { key: 'nil', patterns: [/nil rated supplies/i, /nil rated/i, /exempted/i, /non gst supply/i] },
  { key: 'nil-exe', patterns: [/exempted/i] },
  { key: 'nil-nil', patterns: [/nil rated/i] },
  { key: 'nil-non', patterns: [/non gst/i] },
  { key: 'adv', patterns: [/tax liabilities.*advance received/i, /advance received/i] },
  { key: 'adv-adv', patterns: [/tax liabilities.*advance received/i, /advance received/i] },
  { key: 'adv-adj', patterns: [/adjustment of advances/i] },
  { key: 'adj', patterns: [/adjustment of advances/i] },
  { key: 'hsn', patterns: [/hsn summary/i, /hsn/i] },
  { key: 'hsn-b2b', patterns: [/hsn.*b2b/i] },
  { key: 'hsn-b2c', patterns: [/hsn.*b2c/i] },
  { key: 'doc', patterns: [/document series summary/i, /document series/i] },
  { key: 'ecom', patterns: [/e-?commerce/i] },
  { key: 'ecom-tcs', patterns: [/collect tax u\/s 52/i, /tcs/i] },
  { key: 'ecom-pay', patterns: [/pay tax u\/s 9\(5\)/i] },
  { key: 'sup-unreg', patterns: [/unregistered recipients/i, /supplies to unregistered recipients/i] },
  { key: 'sup-unreg-reg', patterns: [/registered to unregistered/i] },
  { key: 'sup-unreg-unreg', patterns: [/unregistered to unregistered/i] },
];

const detectSectionKeys = (label: string): string[] => {
  const normalizedLabel = label.toLowerCase();
  return SECTION_PATTERNS
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(normalizedLabel)))
    .map(({ key }) => key);
};

const buildSummaryTablesFromRows = (rows: Record<string, unknown>[]) => {
  const tables: Record<string, Record<string, unknown>[]> = {};

  rows.forEach((row) => {
    const label = String(
      getRowValue(row, ['Section Type', 'Section', 'Description', 'Type', 'Name', 'name', 'type']) || ''
    ).trim();

    if (!label) {
      return;
    }

    const sectionKeys = detectSectionKeys(label);
    if (sectionKeys.length === 0) {
      return;
    }

    const record = buildSummaryRecord(row);
    sectionKeys.forEach((key) => {
      if (!tables[key]) {
        tables[key] = [];
      }
      tables[key].push(record);
    });
  });

  return Object.keys(tables).length > 0 ? tables : null;
};

// Table structures based on requirements
const groupedInvoicesItems = [
  { id: 'b2b', name: 'B2B (4A, 4B, 6B, 6C)', type: 'item' },
  { id: 'b2cl', name: 'B2CL (5A)', type: 'item' },
  { id: 'exp', name: 'Export Invoices (6A)', type: 'item' },
  { id: 'cdnr', name: 'Credit Debit Note - Registered (9B)', type: 'item' },
  { id: 'cdnur', name: 'Credit Debit Note - Unregistered (9B)', type: 'item' },
  { id: 'sup-reg', name: 'Supplies to registered recipients u/s 9(5) (15)', type: 'item' }
];

const summariesItems = [
  { id: 'b2cs', name: 'B2C Small (others) (7)', type: 'item' },
  {
    id: 'nil',
    name: 'Nil Rated Supplies (8A, 8B, 8C, 8D)',
    type: 'group',
    children: [
      { id: 'nil-exe', name: 'NIL_RATED (EXEMPTED)', type: 'child' },
      { id: 'nil-nil', name: 'NIL_RATED (NIL_RATED)', type: 'child' },
      { id: 'nil-non', name: 'NIL_RATED (NON_GST_SUPPLY)', type: 'child' }
    ]
  },
  {
    id: 'adv',
    name: 'Tax Liabilities - Advance Received (11A(1), 11A(2))',
    type: 'group',
    children: [
      { id: 'adv-adv', name: 'Tax Liabilities - Advance Received (11A(1), 11A(2))', type: 'child' },
      { id: 'adv-adj', name: 'Adjustment of Advances (11B(1), 11B(2))', type: 'child' }
    ]
  },
  { id: 'adj', name: 'Adjustment of Advances (11B(1), 11B(2))', type: 'item' },
  {
    id: 'hsn',
    name: 'HSN Summary of Outward Supplies (12)',
    type: 'group',
    children: [
      { id: 'hsn-b2b', name: 'HSN (B2B)', type: 'child' },
      { id: 'hsn-b2c', name: 'HSN (B2C)', type: 'child' }
    ]
  },
  { id: 'doc', name: 'Document Series Summary', type: 'item' },
  {
    id: 'ecom',
    name: 'Supplies made through E-commerce operator (14)',
    type: 'group',
    children: [
      { id: 'ecom-tcs', name: 'Liable to collect tax u/s 52 (TCS) (14(1))', type: 'child' },
      { id: 'ecom-pay', name: 'Liable to pay tax u/s 9(5) (14(2))', type: 'child' }
    ]
  },
  {
    id: 'sup-unreg',
    name: 'Supplies to unregistered recipients u/s 9(5) (15)',
    type: 'group',
    children: [
      { id: 'sup-unreg-reg', name: 'Registered to unregistered', type: 'child' },
      { id: 'sup-unreg-unreg', name: 'Unregistered to unregistered', type: 'child' }
    ]
  }
];

const amendmentsItems = [
  { id: 'amend-b2b', name: 'B2B Amendments (9A)', type: 'item' },
  { id: 'amend-b2cla', name: 'B2C Large Amendments (9A)', type: 'item' },
  { id: 'amend-exp', name: 'Export Invoices Amendments (9A)', type: 'item' },
  { id: 'amend-cdnr', name: 'CDN Registered Amendments (9C)', type: 'item' },
  { id: 'amend-cdnur', name: 'CDN Unregistered Amendments (9C)', type: 'item' },
  { id: 'amend-sup-reg', name: 'Supplies to registered recipients u/s 9(5) (15) amendments', type: 'item' },
  { id: 'amend-b2cs', name: 'B2C Small (others) Amendments (10)', type: 'item' },
  { id: 'amend-adv', name: 'Tax Liabilities - Advance Received Amendments (11A)', type: 'item' },
  { id: 'amend-adj', name: 'Adjustment of Advances Amendments (11B)', type: 'item' },
  {
    id: 'amend-ecom',
    name: 'Supplies made through E-commerce operator (14) amendments',
    type: 'group',
    children: [
      { id: 'a-ecom-tcs', name: '-Liable to collect tax u/s 52 (TCS) (14(1)) amendments', type: 'child' },
      { id: 'a-ecom-pay', name: 'Liable to pay tax u/s 9(5) (14(2)) amendments', type: 'child' }
    ]
  },
  {
    id: 'amend-sup-unreg',
    name: 'Supplies to unregistered recipients u/s 9(5) (15) amendments',
    type: 'group',
    children: [
      { id: 'a-sup-reg-unreg', name: '- Registered to unregistered amendments', type: 'child' },
      { id: 'a-sup-unreg-unreg', name: 'Unregistered to unregistered amendments', type: 'child' }
    ]
  }
];

export default function GSTR1SummaryDrawer({
  open,
  onOpenChange,
  gstin,
  businessName,
  businesses = [],
  onSelectGstin,
  returnPeriod = ''
}: GSTR1SummaryDrawerProps) {
  const { currentOrganization } = useAuth();
  const workspaceId = currentOrganization?.id || '';
  // Summary data from workflow state
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [expandedAmendments, setExpandedAmendments] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'summary' | 'documents' | 'edit-summary' | 'document-details'>('summary');
  const [currentSectionView, setCurrentSectionView] = useState<string>('');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeDetailsSection, setActiveDetailsSection] = useState('doc-details');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [editedDoc, setEditedDoc] = useState<any>(null);

  useEffect(() => {
    if (selectedDocument) {
      setEditedDoc({ ...selectedDocument });
    }
  }, [selectedDocument]);

  const handleFieldChange = (field: string, value: any) => {
    setEditedDoc(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    setEditedDoc(prev => {
      const itms = [...(prev.itms || prev.items || prev.line_items || [])];
      if (itms[index]) {
        itms[index] = { ...itms[index], [field]: value };
      }
      return { ...prev, itms };
    });
  };

  const addNewLineItem = () => {
    setEditedDoc(prev => {
      const currentItems = prev.itms || prev.items || prev.line_items || [];
      const newItem = {
        item_desc: '',
        hsn_sc: '',
        qty: 0,
        uom: 'NA',
        rt: 0,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        unit_price: 0,
        discount: 0,
        gst_rate: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
        cess_rate: 0,
        adj_amt: 0,
        pre_gst: 'N',
        cdn_reason: '',
        nil_rated: 'Select an option',
        erp_profit_center: '',
        vouc_num: '',
        vouc_dt: '',
        vouc_created_dt: '',
        vouc_modified_dt: '',
        vouc_created_by: '',
        erp_rev_gl: '',
        erp_tax_code: '',
        erp_vouc_type: '',
        out_sgst_gl: '',
        out_cgst_gl: '',
        out_igst_gl: '',
        out_cess_gl: '',
        item_mat_code: ''
      };
      return { ...prev, itms: [...currentItems, newItem] };
    });
  };
  
  // Upload Drawer Multi-Step State
  const [uploadStep, setUploadStep] = useState<'select' | 'details' | 'checking' | 'error'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'virtualca' | 'gov'>('virtualca');
  
  // Editable Summary Table State
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filters State
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange(returnPeriod));

  const toggleDoc = (s: string) => setSelectedDocs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleSection = (s: string) => setSelectedSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const selectedTemplateLabel = selectedTemplate === 'gov' ? 'GSTR-1 Govt. Template' : 'Virtual CA Template';

  const { toast } = useToast();

  function handleSaveEditedDoc() {
    if (editedDoc) {
      setSelectedDocument({ ...editedDoc });
      setIsEditMode(false);
      toast({
        title: "Changes Saved",
        description: "Document details have been updated successfully.",
      });
    }
  }

  // Load summary data when drawer opens or GSTIN changes
  useEffect(() => {
    setDateRange(getInitialDateRange(returnPeriod));
  }, [returnPeriod]);

  useEffect(() => {
    if (open && gstin && workspaceId) {
      loadSummaryData();
    }
  }, [open, gstin, workspaceId, returnPeriod]);

  // Scroll tracking for sidebar active section - MUST be at component level (Rules of Hooks)
  useEffect(() => {
    if (viewMode !== 'document-details') return;

    const container = document.getElementById('scroll-container');
    if (!container) return;

    const sectionIds = ['doc-details', 'line-items', 'cust-details', 'sell-details', 'exp-details', 'amend-details', 'others'];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveDetailsSection(entry.target.id);
          }
        });
      },
      {
        root: container,
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      }
    );

    // Small timeout to let sections render before observing
    const timer = setTimeout(() => {
      sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [viewMode]);

  const loadSummaryData = async () => {
    setIsLoadingData(true);
    setSummaryData(null);
    try {
      const response = await getGstr1State(workspaceId, gstin, returnPeriod);
      if (response.success && response.data) {
        const state = response.data;
        const uploadResult = state.upload_result || (state.gstr1_tables
          ? {
              success: true,
              data: state.gstr1_tables,
            }
          : null);

        if (uploadResult) {
          setSummaryData(uploadResult);
        }
      }
    } catch (error) {
      console.error('Failed to load summary data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadStep('details');
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setUploadStep('checking');
    setIsUploading(true);

    try {
      const parsed = await parseExcelFile(selectedFile);
      const importedRows = parsed.rows.slice(0, 25).map((row, index) => {
        const entries = Object.entries(row as Record<string, unknown>);
        const firstTextValue = entries.find(([, value]) => typeof value === 'string' && value.trim())?.[1];
        const numericValues = entries
          .map(([, value]) => Number(value))
          .filter((value) => Number.isFinite(value));

        const formatAmount = (value: unknown) => {
          const numericValue = Number(value);
          return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00';
        };

        return {
          id: `${Date.now()}-${index}`,
          type: String(firstTextValue || row.type || row.section || row.document_type || `Imported row ${index + 1}`),
          val1: formatAmount(numericValues[0] ?? row.nil_rated ?? row.taxable_value ?? row.txval),
          val2: formatAmount(numericValues[1] ?? row.exempted ?? row.cgst ?? row.camt),
          val3: formatAmount(numericValues[2] ?? row.non_gst ?? row.sgst ?? row.samt),
        };
      });

      setSummaryRows(importedRows);

      const summaryWorkbookTables = buildSummaryTablesFromRows(parsed.rows as Record<string, unknown>[]);
      const mapping = autoMapColumns(parsed.headers);
      const mappingDict: Record<string, string> = {};
      Object.entries(mapping).forEach(([key, value]) => {
        if (value) {
          mappingDict[key] = value;
        }
      });

      const canProcessRawFile = REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));

      if (canProcessRawFile && workspaceId && gstin && returnPeriod) {
        try {
          const result = await processGSTR1Excel(selectedFile, mappingDict, gstin, returnPeriod, workspaceId);

          if (result.success && result.data) {
            setSummaryData(result);
            await saveGstr1State(workspaceId, gstin, returnPeriod, {
              currentStep: 'imported',
              stepData: {
                file: selectedFile.name,
                template: selectedTemplate,
                import_mode: 'gstr1-processor',
              },
              validationStatus: {},
              gstr1Tables: result.data,
              uploadResult: result as unknown as Record<string, unknown>,
              classificationResult: null,
              validationResult: (result as any).validation_report ?? null,
              filingResult: null,
            });

            setIsFilterApplied(true);
            setUploadDrawerOpen(false);
            setUploadStep('select');
            toast({
              title: 'File Imported Successfully',
              description: `Imported ${selectedFile.name} into the summary workspace.`,
            });
            return;
          }
        } catch (processError) {
          console.warn('GSTR-1 processing failed, falling back to workbook summary parsing:', processError);
        }
      }

      if (summaryWorkbookTables) {
        const syntheticSummary = { success: true, data: summaryWorkbookTables };
        setSummaryData(syntheticSummary);

        if (workspaceId && gstin && returnPeriod) {
          await saveGstr1State(workspaceId, gstin, returnPeriod, {
            currentStep: 'imported',
            stepData: {
              file: selectedFile.name,
              template: selectedTemplate,
              import_mode: 'summary-workbook',
            },
            validationStatus: {},
            gstr1Tables: summaryWorkbookTables,
            uploadResult: syntheticSummary as unknown as Record<string, unknown>,
            classificationResult: null,
            validationResult: null,
            filingResult: null,
          });
        }

        setIsFilterApplied(true);
        setUploadDrawerOpen(false);
        setUploadStep('select');
        toast({
          title: 'File Imported Successfully',
          description: `Imported ${selectedFile.name} into the summary workspace.`,
        });
        return;
      }

      setIsFilterApplied(importedRows.length > 0);
      setUploadDrawerOpen(false);
      setUploadStep('select');
      toast({
        title: 'File Imported Successfully',
        description: `Imported ${selectedFile.name} into the summary workspace.`,
      });
    } catch (error) {
      setUploadStep('error');
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Failed to import summary file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyFilters = () => {
    setIsFilterApplied(true);
    setDatePopoverOpen(false);
    toast({
      title: 'Filters Applied',
      description: `Filtering by ${selectedDocs.length} types and ${selectedSections.length} sections.`,
    });
  };

  const handleResetFilters = () => {
    setSelectedDocs([]);
    setSelectedSections([]);
    setDateRange(undefined);
    setIsFilterApplied(false);
    toast({
      title: 'Filters Reset',
      description: 'All document filters have been cleared.',
    });
  };

  // Filter Accordion State
  const [isDateExpanded, setIsDateExpanded] = useState(true);
  const [isTypeExpanded, setIsTypeExpanded] = useState(true);
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);

  const toggleSummaryGroup = (groupId: string) => {
    setExpandedSummaries(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleAmendmentGroup = (groupId: string) => {
    setExpandedAmendments(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const expandAll = (items: any[], setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setExpanded(prev => {
      const next = new Set(prev);
      items.forEach(item => {
        if (item.type === 'group') next.add(item.id);
      });
      return next;
    });
  };

  const collapseAll = (setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setExpanded(new Set());
  };

  const isAllExpanded = (items: any[], expandedSet: Set<string>) => {
    const groupItems = items.filter(i => i.type === 'group');
    if (groupItems.length === 0) return false;
    return groupItems.every(i => expandedSet.has(i.id));
  };

  const [currentSectionId, setCurrentSectionId] = useState<string>('');

  const handleViewSection = (sectionId: string, sectionName: string, sectionGroup: string) => {
    setCurrentSectionId(sectionId);
    setCurrentSectionView(sectionName);
    if (sectionGroup === 'summaries' || sectionGroup === 'amendments') {
      setViewMode('edit-summary');
    } else {
      setViewMode('documents');
    }
  };

  // Helper function to get row data for a section
  const getRowData = (itemId: string) => {
    if (!summaryData) {
      return {
        docCount: '0',
        totalAmount: '0.00',
        taxableAmount: '0.00',
        totalTax: '0.00',
        igst: '0.00',
        cgst: '0.00',
        sgst: '0.00',
        cess: '0.00'
      };
    }

    // Handle both nested and flat response structures
    const data = (summaryData as any).data || summaryData;
    const formatNumber = (num: number | undefined) => (num || 0).toFixed(2);

    const asItems = (value: any) => {
      if (!value) {
        return [];
      }

      if (Array.isArray(value)) {
        return value;
      }

      return [value];
    };

    const calculateInvoiceSectionData = (records: any[]) => {
      if (!records || records.length === 0) {
        return {
          docCount: '0',
          totalAmount: '0.00',
          taxableAmount: '0.00',
          totalTax: '0.00',
          igst: '0.00',
          cgst: '0.00',
          sgst: '0.00',
          cess: '0.00'
        };
      }

      const totals = records.reduce((acc, record) => {
        const lineItems = asItems(record.itms || record.items || record.line_items || record.invoice_items);
        const sourceItems = lineItems.length > 0 ? lineItems : [record];

        const recordTaxable = sourceItems.reduce(
          (sum, sourceItem) => sum + normalizeNumericValue(
            getRowValue(sourceItem, [
              'txval',
              'taxable_value',
              'taxableValue',
              'taxableAmount',
              'taxable',
              'amount',
            ])
          ),
          0
        );
        const recordIgst = sourceItems.reduce(
          (sum, sourceItem) => sum + normalizeNumericValue(getRowValue(sourceItem, ['iamt', 'igst', 'igst_amount'])),
          0
        );
        const recordCgst = sourceItems.reduce(
          (sum, sourceItem) => sum + normalizeNumericValue(getRowValue(sourceItem, ['camt', 'cgst', 'cgst_amount'])),
          0
        );
        const recordSgst = sourceItems.reduce(
          (sum, sourceItem) => sum + normalizeNumericValue(getRowValue(sourceItem, ['samt', 'sgst', 'sgst_amount'])),
          0
        );
        const recordCess = sourceItems.reduce(
          (sum, sourceItem) => sum + normalizeNumericValue(getRowValue(sourceItem, ['csamt', 'cess', 'cess_amount'])),
          0
        );

        const explicitTotal = normalizeNumericValue(
          getRowValue(record, [
            'val',
            'totalAmount',
            'total_amount',
            'amount',
            'invoiceValue',
            'invoice_value',
            'noteValue',
            'note_value',
          ])
        );
        const recordTotal = explicitTotal || (recordTaxable + recordIgst + recordCgst + recordSgst + recordCess);

        acc.docCount += 1;
        acc.totalAmount += recordTotal;
        acc.taxableAmount += recordTaxable;
        acc.totalTax += recordIgst + recordCgst + recordSgst + recordCess;
        acc.igst += recordIgst;
        acc.cgst += recordCgst;
        acc.sgst += recordSgst;
        acc.cess += recordCess;
        return acc;
      }, {
        docCount: 0,
        totalAmount: 0,
        taxableAmount: 0,
        totalTax: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      });

      return {
        docCount: String(totals.docCount),
        totalAmount: formatNumber(totals.totalAmount),
        taxableAmount: formatNumber(totals.taxableAmount),
        totalTax: formatNumber(totals.totalTax),
        igst: formatNumber(totals.igst),
        cgst: formatNumber(totals.cgst),
        sgst: formatNumber(totals.sgst),
        cess: formatNumber(totals.cess),
      };
    };

    // Helper to sum amounts from an array of invoices
    const sumAmounts = (items: any[], fields: string[]) => {
      return items.reduce((acc, item) => {
        const value = normalizeNumericValue(getRowValue(item, fields));
        return acc + value;
      }, 0);
    };

    // Helper to calculate from items array
    const calculateSectionData = (items: any[]) => {
      if (!items || items.length === 0) {
        return {
          docCount: '0',
          totalAmount: '0.00',
          taxableAmount: '0.00',
          totalTax: '0.00',
          igst: '0.00',
          cgst: '0.00',
          sgst: '0.00',
          cess: '0.00'
        };
      }

      const firstItem = items[0] || {};
      if (items.some((item) => Array.isArray(item?.invoices))) {
        return calculateInvoiceSectionData(items.flatMap((item) => asItems(item.invoices)));
      }

      if (items.some((item) => Array.isArray(item?.notes))) {
        return calculateInvoiceSectionData(items.flatMap((item) => asItems(item.notes)));
      }

      // Sum from items - support multiple field name formats
      // Calculate docCount: sum up docCount if available, otherwise use items.length
      const totalDocs = items.reduce((sum, item) => {
          const count = normalizeNumericValue(getRowValue(item, ['docCount', 'doc_count', 'count', 'total_documents', 'totalDocuments']));
          return sum + (count || 1);
      }, 0);

      const taxable = sumAmounts(items, ['txval', 'taxable_value', 'taxableValue', 'taxableAmount', 'taxable']);
      const igst = sumAmounts(items, ['iamt', 'igst_amount', 'igst']);
      const cgst = sumAmounts(items, ['camt', 'cgst_amount', 'cgst']);
      const sgst = sumAmounts(items, ['samt', 'sgst_amount', 'sgst']);
      const cess = sumAmounts(items, ['csamt', 'cess_amount', 'cess']);
      
      const explicitTotal = sumAmounts(items, ['val', 'totalAmount', 'total_amount', 'amount', 'invoiceValue', 'invoice_value', 'noteValue', 'note_value']);
      
      const totalTax = igst + cgst + sgst + cess;
      // Total amount = explicit total if provided, otherwise derived
      const totalAmount = explicitTotal || (taxable + totalTax);

      return {
        docCount: totalDocs.toString(),
        totalAmount: formatNumber(totalAmount),
        taxableAmount: formatNumber(taxable),
        totalTax: formatNumber(totalTax),
        igst: formatNumber(igst),
        cgst: formatNumber(cgst),
        sgst: formatNumber(sgst),
        cess: formatNumber(cess)
      };
    };

    // Map item IDs to their data arrays
    const dataMap: Record<string, any> = {
      'b2b': calculateSectionData(asItems(data.b2b)),
      'b2cl': calculateSectionData(asItems(data.b2cl)),
      'b2cs': calculateSectionData(asItems(data.b2cs)),
      'exp': calculateSectionData(asItems(data.exp)),
      'cdnr': calculateSectionData(asItems(data.cdnr)),
      'cdnur': calculateSectionData(asItems(data.cdnur)),
      'sup-reg': calculateSectionData(asItems(data['sup-reg'] || data.sup_reg || data.supReg)),
      'nil': calculateSectionData(asItems(data.nil || data.nil_exemp)),
      'nil-exe': calculateSectionData(asItems(data['nil-exe'] || data.nil_exe || data.nil_exempted)),
      'nil-nil': calculateSectionData(asItems(data['nil-nil'] || data.nil_nil || data.nil_rated)),
      'nil-non': calculateSectionData(asItems(data['nil-non'] || data.nil_non || data.non_gst)),
      'adv': calculateSectionData(asItems(data.adv || data.at)),
      'adv-adv': calculateSectionData(asItems(data['adv-adv'] || data.adv_adv || data.at)),
      'adv-adj': calculateSectionData(asItems(data['adv-adj'] || data.adv_adj || data.txpd || data.adj)),
      'adj': calculateSectionData(asItems(data.adj || data.txpd)),
      'hsn': calculateSectionData(asItems(data.hsn)),
      'hsn-b2b': calculateSectionData(asItems(data['hsn-b2b'] || data.hsn_b2b)),
      'hsn-b2c': calculateSectionData(asItems(data['hsn-b2c'] || data.hsn_b2c)),
      'doc': calculateSectionData(asItems(data.doc || data.docs || data.doc_issue)),
      'ecom': calculateSectionData(asItems(data.ecom || data.sup_ecom)),
      'ecom-tcs': calculateSectionData(asItems(data['ecom-tcs'] || data.ecom_tcs)),
      'ecom-pay': calculateSectionData(asItems(data['ecom-pay'] || data.ecom_pay)),
      'sup-unreg': calculateSectionData(asItems(data['sup-unreg'] || data.sup_unreg)),
      'sup-unreg-reg': calculateSectionData(asItems(data['sup-unreg-reg'] || data.sup_unreg_reg)),
      'sup-unreg-unreg': calculateSectionData(asItems(data['sup-unreg-unreg'] || data.sup_unreg_unreg)),
    };

    return dataMap[itemId] || {
      docCount: '0',
      totalAmount: '0.00',
      taxableAmount: '0.00',
      totalTax: '0.00',
      igst: '0.00',
      cgst: '0.00',
      sgst: '0.00',
      cess: '0.00'
    };
  };

  const formatVal = (val: string | undefined): string => {
    if (!val || val === '0' || val === '0.00' || val === '0.0') return '-';
    return val;
  };

  const renderRow = (
    item: any,
    depth = 0,
    expandedSet: Set<string>,
    toggleFn: (id: string) => void
  ) => {
    const isGroup = item.type === 'group';
    const isExpanded = expandedSet.has(item.id);
    const bgColor = depth > 0 ? 'bg-slate-50/50' : 'bg-white';
    const data = getRowData(item.id);

    return (
      <React.Fragment key={item.id}>
        <tr className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${bgColor}`}>
          <td className={`py-3 px-4 text-sm text-slate-700 flex items-center gap-1 ${depth > 0 ? 'pl-8' : ''}`}>
            {isGroup && (
              <button
                onClick={() => toggleFn(item.id)}
                className="p-0.5 hover:bg-slate-200 rounded border border-slate-300 bg-white"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            <span className={depth > 0 ? "text-slate-600" : "font-medium"}>{item.name}</span>
          </td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.docCount) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.totalAmount) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.taxableAmount) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.totalTax) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.igst) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.cgst) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.sgst) : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? formatVal(data.cess) : ''}</td>
          <td className="py-3 px-4 text-sm text-center">
            <button
              onClick={() => handleViewSection(item.id, item.name, toggleFn === toggleAmendmentGroup ? 'amendments' : (toggleFn === toggleSummaryGroup ? 'summaries' : 'grouped'))}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              View
            </button>
          </td>
        </tr>
        {isGroup && isExpanded && item.children?.map((child: any) => renderRow(child, depth + 1, expandedSet, toggleFn))}
      </React.Fragment>
    );
  };

  const filteredBusinesses = businesses?.filter(b =>
    String(b.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (Array.isArray(b.gstins) && b.gstins.some((g: any) => String(g.gstin || '').toLowerCase().includes(searchQuery.toLowerCase())))
  ) || [];

  const renderMainSummary = () => (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Grouped Invoices Section */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <h2 className="text-lg font-medium text-slate-800">Grouped Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-semibold">
                  <th className="py-3 px-4">Section Type</th>
                  <th className="py-3 px-4 text-center"># Docs</th>
                  <th className="py-3 px-4 text-center">Total Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Taxable Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Total Tax(₹)</th>
                  <th className="py-3 px-4 text-center">IGST (₹)</th>
                  <th className="py-3 px-4 text-center">CGST (₹)</th>
                  <th className="py-3 px-4 text-center">SGST (₹)</th>
                  <th className="py-3 px-4 text-center">CESS (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedInvoicesItems.map(item => renderRow(item, 0, new Set(), () => { }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summaries Section */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-slate-800">Summaries</h2>
              <button
                onClick={() => {
                  if (isAllExpanded(summariesItems, expandedSummaries)) {
                    collapseAll(setExpandedSummaries);
                  } else {
                    expandAll(summariesItems, setExpandedSummaries);
                  }
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {isAllExpanded(summariesItems, expandedSummaries) ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-semibold">
                  <th className="py-3 px-4">Section Type</th>
                  <th className="py-3 px-4 text-center"># Rows</th>
                  <th className="py-3 px-4 text-center">Total Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Taxable Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Total Tax(₹)</th>
                  <th className="py-3 px-4 text-center">IGST (₹)</th>
                  <th className="py-3 px-4 text-center">CGST (₹)</th>
                  <th className="py-3 px-4 text-center">SGST (₹)</th>
                  <th className="py-3 px-4 text-center">CESS (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {summariesItems.map(item => renderRow(item, 0, expandedSummaries, toggleSummaryGroup))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Amendments Section */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-slate-800">Amendments</h2>
              <button
                onClick={() => {
                  if (isAllExpanded(amendmentsItems, expandedAmendments)) {
                    collapseAll(setExpandedAmendments);
                  } else {
                    expandAll(amendmentsItems, setExpandedAmendments);
                  }
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {isAllExpanded(amendmentsItems, expandedAmendments) ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
            <Button variant="ghost" asChild className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
              <a href="/amendment.pdf" target="_blank" download="amendment.pdf">
                <Download className="mr-2 h-4 w-4" /> Download Amendment Guide
              </a>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-semibold">
                  <th className="py-3 px-4">Section Type</th>
                  <th className="py-3 px-4 text-center"># Docs / Rows</th>
                  <th className="py-3 px-4 text-center">Total Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Taxable Amount(₹)</th>
                  <th className="py-3 px-4 text-center">Total Tax(₹)</th>
                  <th className="py-3 px-4 text-center">IGST (₹)</th>
                  <th className="py-3 px-4 text-center">CGST (₹)</th>
                  <th className="py-3 px-4 text-center">SGST (₹)</th>
                  <th className="py-3 px-4 text-center">CESS (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {amendmentsItems.map(item => renderRow(item, 0, expandedAmendments, toggleAmendmentGroup))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );

  const getFullHeaderTitle = () => {
    if (viewMode === 'documents') return `Documents View`;
    if (viewMode === 'document-details') return `Document Details - ${selectedDocument?.inum || selectedDocument?.nt_num || 'New Document'}`;
    if (viewMode === 'edit-summary') {
      const stateName = businesses.find(b => Array.isArray(b.gstins) && b.gstins.some((g: any) => g.gstin === gstin))?.gstins?.find((g: any) => g.gstin === gstin)?.state || 'State';
      return `${currentSectionView} - ${stateName} ${gstin}`;
    }
    return 'GSTIN Summary';
  };

  const renderEditSummaryView = () => {
    if (summaryRows.length === 0 && !isFilterApplied) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative">
          <div className="flex flex-col items-center justify-center -mt-20">
            <div className="w-40 h-32 mb-4 relative flex items-center justify-center opacity-70">
              <Inbox className="h-16 w-16 text-slate-300" />
            </div>
            <h3 className="text-[17px] font-bold text-blue-600 mb-1.5">Add a new row or Import existing summary</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
              No summaries found. Start creating a new summary by adding a new row or import existing summary
            </p>
            <div className="flex items-center gap-3">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium px-5 border-0"
                onClick={() => {
                  setSummaryRows([{ id: Date.now().toString(), type: 'Inter-State supplies to registered persons', val1: '0.00', val2: '0.00', val3: '0.00' }]);
                  setIsFilterApplied(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add new row
              </Button>
              <Button 
                variant="outline"
                className="bg-white hover:bg-slate-50 text-blue-600 shadow-sm font-medium px-5 border border-slate-300"
                onClick={() => {
                  setSelectedTemplate('virtualca');
                  setUploadDrawerOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            </div>
          </div>
        </div>
      );
    }

    const updateRow = (id: string, field: string, value: string) => {
      setSummaryRows(summaryRows.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    return (
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
          <div className="p-3 border-b flex justify-between items-center bg-white border-slate-200">
             <div className="flex items-center gap-2">
                {/* empty left side */}
             </div>
             <div className="flex items-center gap-3">
                 <Button variant="outline" className="h-8 text-xs text-blue-600 border-blue-200">
                   <FileText className="mr-1.5 h-3 w-3" /> Actions
                 </Button>
                 <Button className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-5">
                   Save
                 </Button>
             </div>
          </div>
          <div className="flex items-center justify-end px-4 py-2 bg-white">
            <div className="flex items-center gap-2">
               <span className="text-xs text-slate-600 font-medium">Switch back to old table</span>
               <div className="w-8 h-4 bg-blue-600 rounded-full flex items-center justify-end px-0.5 cursor-pointer">
                 <div className="w-3 h-3 bg-white rounded-full"></div>
               </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white border-t border-slate-200">
             <table className="w-full text-left border-collapse border-b border-slate-200">
               <thead>
                 <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                   <th className="py-3 px-4 w-16 text-center border-r border-slate-200 font-medium">Errors</th>
                   <th className="py-3 px-4 border-r border-slate-200 font-medium whitespace-nowrap">Description</th>
                   <th className="py-3 px-4 border-r border-slate-200 font-medium whitespace-nowrap">Nil Rated Supplies</th>
                   <th className="py-3 px-4 border-r border-slate-200 font-medium whitespace-nowrap">Exempted(other than nil rated/non-GST)</th>
                   <th className="py-3 px-4 border-r border-slate-200 font-medium whitespace-nowrap">Non-GST Supplies</th>
                   <th className="py-3 px-4 font-medium whitespace-nowrap">Return Type</th>
                 </tr>
               </thead>
               <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50 group transition-colors">
                       <td className="py-2.5 px-4 text-center border-r border-slate-200">
                          <div className="flex items-center justify-center">
                            <div className="h-5 w-5 rounded-full border border-emerald-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          </div>
                       </td>
                       <td className="py-2.5 px-0 border-r border-slate-200 relative">
                         <input type="text" className="w-full h-full absolute inset-0 bg-transparent outline-none focus:ring-1 focus:ring-blue-400 px-4 text-xs font-medium text-slate-700" placeholder="" />
                       </td>
                       <td className="py-2.5 px-0 border-r border-slate-200 relative group-hover:bg-slate-50">
                         <input type="text" value={row.val1} onChange={e => updateRow(row.id, 'val1', e.target.value)} className="w-full h-full absolute inset-0 text-left bg-transparent outline-none focus:ring-1 focus:ring-blue-400 px-4 text-xs font-medium" />
                       </td>
                       <td className="py-2.5 px-0 border-r border-slate-200 relative group-hover:bg-slate-50">
                         <input type="text" value={row.val2} onChange={e => updateRow(row.id, 'val2', e.target.value)} className="w-full h-full absolute inset-0 text-left bg-transparent outline-none focus:ring-1 focus:ring-blue-400 px-4 text-xs font-medium" />
                       </td>
                       <td className="py-2.5 px-0 border-r border-slate-200 relative group-hover:bg-slate-50">
                         <input type="text" value={row.val3} onChange={e => updateRow(row.id, 'val3', e.target.value)} className="w-full h-full absolute inset-0 text-left bg-transparent outline-none focus:ring-1 focus:ring-blue-400 px-4 text-xs font-medium" />
                       </td>
                       <td className="py-2.5 px-0 relative group-hover:bg-slate-50">
                         <input type="text" className="w-full h-full absolute inset-0 text-left bg-transparent outline-none focus:ring-1 focus:ring-blue-400 px-4 text-xs font-medium" placeholder="" />
                       </td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </div>
          <div className="p-3 border-t border-slate-200 flex justify-between items-center bg-white shadow-sm mt-auto">
             <Button variant="outline" className="h-8 text-xs text-slate-600" onClick={() => scrollToSection('next')}>Next <ChevronRight className="ml-1 h-3 w-3" /></Button>
          </div>
      </div>
    );
  };

  const renderDocumentDetailsView = () => {
    const doc = isEditMode ? (editedDoc || selectedDocument || {}) : (selectedDocument || {});
    const items = doc.itms || doc.items || doc.line_items || doc.invoice_items || [];
    
    const sidebarItems = [
      { id: 'doc-details', label: 'Document Details' },
      { id: 'line-items', label: 'Line details' },
      { id: 'cust-details', label: 'Customer Details' },
      { id: 'sell-details', label: 'Seller Details' },
      { id: 'exp-details', label: 'Export Details' },
      { id: 'amend-details', label: 'Amendment Details' },
      { id: 'others', label: 'Others' },
    ];

    const scrollToSection = (id: string) => {
      setActiveDetailsSection(id);
      const element = document.getElementById(id);
      const container = document.getElementById('scroll-container');
      if (element && container) {
        container.scrollTo({ 
          top: element.offsetTop - 10, 
          behavior: 'smooth' 
        });
      }
    };

    // Note: Scroll tracking useEffect has been moved to component level to follow React Rules of Hooks.

    const renderField = (label: string, fieldKey: string, options: { 
      type?: 'text' | 'select' | 'date', 
      options?: string[], 
      className?: string,
      readOnly?: boolean,
      placeholder?: string
    } = {}) => {
      const val = doc[fieldKey] || (isEditMode ? '' : '-');
      
      if (!isEditMode || options.readOnly) {
        return (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
            <div className={`h-10 px-3 flex items-center bg-slate-100/80 border border-slate-200 rounded text-sm text-slate-800 ${options.className || ''}`}>
              {val || '-'}
            </div>
          </div>
        );
      }

      if (options.type === 'select' && options.options) {
        return (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
            <Select value={String(doc[fieldKey] || '')} onValueChange={(v) => handleFieldChange(fieldKey, v)}>
              <SelectTrigger className="h-10 bg-white border-slate-200 text-sm focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className={options.options.length > 10 ? "h-60" : ""}>
                  {options.options.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
        );
      }

      if (options.type === 'date') {
        return (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
            <div className="relative">
              <Input 
                type="text" 
                value={val === '-' ? '' : val} 
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                placeholder="DD-MM-YYYY"
                className="h-10 bg-white border-slate-200 text-sm pr-10 focus-visible:ring-1 focus-visible:ring-blue-500"
              />
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
          <Input 
            value={val === '-' ? '' : val} 
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            className="h-10 bg-white border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-300"
            placeholder={options.placeholder || "Enter a value"}
          />
        </div>
      );
    };

    return (
      <div className="flex-1 flex overflow-hidden bg-slate-50 font-sans">
        {/* Sidebar Navigation */}
        <div className="w-[220px] border-r border-slate-200 bg-white shrink-0 py-6 font-sans flex flex-col overflow-y-auto custom-scrollbar">
          <div className="px-6 mb-4">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-2">
              <span className="text-blue-500">⬇️</span>
              Jump to a section in the table
            </span>
          </div>
          <div className="flex flex-col px-3 gap-1.5">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`relative px-4 py-3 text-left text-[13px] font-semibold cursor-pointer transition-all duration-300 rounded-lg group ${
                  activeDetailsSection === item.id 
                    ? 'text-blue-700 bg-blue-50/80 font-bold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                {activeDetailsSection === item.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2/3 bg-blue-600 rounded-r-md transition-all"></div>
                )}
                <div className="flex items-center justify-between group-hover:pr-2 transition-all">
                  {item.label}
                  {activeDetailsSection === item.id && (
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)] transition-all"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative font-sans">
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-sm">
             <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-slate-700">Document Number : <span className="text-slate-900 font-extrabold">{doc.inum || doc.nt_num || '-'}</span></span>
                <div className="flex items-center gap-2 ml-4">
                   <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-100 font-bold px-2 py-0.5">IRN Status : GENERATED</Badge>
                   <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-400 border-slate-200 font-bold px-2 py-0.5">EWB Status : NOT GENERATED</Badge>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-6 rounded shadow-sm transition-all hover:shadow-md" onClick={handleSaveEditedDoc}>
                   Save
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setViewMode('documents')} className="h-8 w-8 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="h-5 w-5" /></Button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-mt-20 scroll-pt-10 scroll-smooth relative custom-scrollbar bg-white" id="scroll-container">
            <div className="w-full space-y-0 pb-[30vh]">
              {/* Document Details Section */}
              <div id="doc-details" className="pt-8">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Document Details</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('Document Type Code', 'inv_typ', { type: 'select', options: DOCUMENT_TYPE_OPTIONS })}
                  {renderField('Document Number', 'inum', { readOnly: true })}
                  {renderField('Document Date', 'idt', { type: 'date' })}
                  {renderField('State Place of Supply', 'pos', { type: 'select', options: STATE_OPTIONS })}
                  
                  {renderField('Return Filing Month', 'period', { type: 'text', readOnly: true })}
                  {renderField('Total Document Value', 'val', { type: 'text' })}
                  {renderField('Is this a Bill of Supply', 'is_bill_supply', { type: 'select', options: ['Select an option', 'Y', 'N'] })}
                  {renderField('Is Reverse Charge Applicable?', 'rchrg', { type: 'select', options: ['N', 'Y'] })}
                  
                  {renderField('Is this document cancelled?', 'is_cancelled', { type: 'select', options: CANCELLED_OPTIONS })}
                  {renderField('Applicable % of Tax Rate', 'diff_rt', { type: 'select', options: TAX_RATE_PERCENTAGE_OPTIONS })}
                  {renderField('Linked Invoice Number (filled in case of CDN)', 'link_inum')}
                  {renderField('Linked Invoice Date (filled in case of CDN)', 'link_idt', { type: 'date' })}

                  {renderField('Linked Customer Billing GSTIN (filled in case of CDN)', 'link_ctin')}
                  {renderField('Is the customer a Composition dealer or UIN registered', 'customer_type', { type: 'select', options: COMPOSITION_UIN_OPTIONS })}
                  {renderField('Date of linked advance receipt', 'date_adv_receipt', { type: 'date' })}
                  {renderField('Voucher number of linked advance receipt', 'voucher_adv_receipt')}
                </div>
              </div>

              {/* Line details Section */}
              <div id="line-items" className="pt-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Line details</h2>
                </div>
                <div className="px-10">
                  <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm custom-scrollbar mb-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="py-3 px-4 w-10 text-center border-r border-slate-200"><Checkbox className="border-slate-300" /></th>
                          <th className="py-3 px-4 w-16 border-r border-slate-200 text-center">Errors</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[200px] bg-blue-600 text-white font-extrabold uppercase tracking-widest">Item Description</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Is the item a GOOD (G) or SERVICE (S)</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">HSN or SAC code</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">Item Quantity</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Item Unit of Measurement</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">Item Price</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">Item Discount Amount</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[120px]">Item Taxable Value</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[80px]">GST Rate</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[80px]">CGST rate</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[80px]">SGST Rate</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[80px]">IGST Rate</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">CGST Amount</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">SGST Amount</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">IGST Amount</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[80px]">CESS Rate</th>
                          <th className="py-3 px-4 text-right border-r border-slate-200 min-w-[100px]">CESS Amount</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[200px]">Adjustment Amount of the Linked ...</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Is this note for a Pre-GST Invoice</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Reason for issuing CDN</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[180px]">Is this a NIL Rated /Exempt/Non GST</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">ERP Profit Center</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Voucher Number</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Voucher Date</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Voucher Created Date</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Voucher Modified Date</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">Voucher Created By</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">ERP Revenue GL Code</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[120px]">ERP Tax Code</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">ERP Voucher Type</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Output SGST GL Code</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Output CGST GL Code</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Output IGST GL Code</th>
                          <th className="py-3 px-4 border-r border-slate-200 min-w-[150px]">Output CESS GL Code</th>
                          <th className="py-3 px-4 min-w-[150px]">Item Material Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? items.map((item: any, idx: number) => {
                          const itm = item.itm_det || item;
                          return (
                            <tr key={idx} className="border-b border-slate-100 text-[11px] text-slate-700 hover:bg-slate-50/50 transition-colors whitespace-nowrap">
                              <td className="py-2.5 px-4 text-center border-r border-slate-100/50"><Checkbox className="border-slate-300" /></td>
                              <td className="py-2.5 px-4 text-center border-r border-slate-100/50"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.item_desc || ''} onChange={(e) => handleLineItemChange(idx, 'item_desc', e.target.value)} /> : (itm.item_desc || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? (
                                  <Select value={itm.is_service ? 'SERVICE' : 'GOOD'} onValueChange={(v) => handleLineItemChange(idx, 'is_service', v === 'SERVICE')}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="GOOD">GOOD</SelectItem><SelectItem value="SERVICE">SERVICE</SelectItem></SelectContent>
                                  </Select>
                                ) : (itm.is_service ? 'SERVICE' : 'GOOD')}
                              </td>
                              <td className="py-2.5 px-4 font-mono border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.hsn_sc || ''} onChange={(e) => handleLineItemChange(idx, 'hsn_sc', e.target.value)} /> : (itm.hsn_sc || '-')}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.qty || 0} onChange={(e) => handleLineItemChange(idx, 'qty', e.target.value)} /> : (itm.qty || '0.0')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? (
                                  <Select value={itm.uom || 'NA'} onValueChange={(v) => handleLineItemChange(idx, 'uom', v)}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="NA">NA</SelectItem><SelectItem value="PCS">PCS</SelectItem><SelectItem value="KGS">KGS</SelectItem></SelectContent>
                                  </Select>
                                ) : (itm.uom || 'NA')}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.unit_price || 0} onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value)} /> : normalizeNumericValue(itm.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.discount || 0} onChange={(e) => handleLineItemChange(idx, 'discount', e.target.value)} /> : normalizeNumericValue(itm.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50 font-semibold">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.txval || 0} onChange={(e) => handleLineItemChange(idx, 'txval', e.target.value)} /> : normalizeNumericValue(itm.txval).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.gst_rate || 0} onChange={(e) => handleLineItemChange(idx, 'gst_rate', e.target.value)} /> : `${itm.gst_rate || 0}%`}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.cgst_rate || 0} onChange={(e) => handleLineItemChange(idx, 'cgst_rate', e.target.value)} /> : `${itm.cgst_rate || 0}%`}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.sgst_rate || 0} onChange={(e) => handleLineItemChange(idx, 'sgst_rate', e.target.value)} /> : `${itm.sgst_rate || 0}%`}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.igst_rate || 0} onChange={(e) => handleLineItemChange(idx, 'igst_rate', e.target.value)} /> : `${itm.igst_rate || 0}%`}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.camt || 0} onChange={(e) => handleLineItemChange(idx, 'camt', e.target.value)} /> : normalizeNumericValue(itm.camt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.samt || 0} onChange={(e) => handleLineItemChange(idx, 'samt', e.target.value)} /> : normalizeNumericValue(itm.samt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.iamt || 0} onChange={(e) => handleLineItemChange(idx, 'iamt', e.target.value)} /> : normalizeNumericValue(itm.iamt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50">
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.cess_rate || 0} onChange={(e) => handleLineItemChange(idx, 'cess_rate', e.target.value)} /> : `${itm.cess_rate || 0}%`}
                              </td>
                              <td className="py-2.5 px-4 text-right border-r border-slate-100/50" >
                                {isEditMode ? <Input type="number" className="h-7 text-xs text-right w-full" value={itm.csamt || 0} onChange={(e) => handleLineItemChange(idx, 'csamt', e.target.value)} /> : normalizeNumericValue(itm.csamt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.adj_amt || ''} onChange={(e) => handleLineItemChange(idx, 'adj_amt', e.target.value)} /> : (itm.adj_amt || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? (
                                  <Select value={itm.pre_gst || 'N'} onValueChange={(v) => handleLineItemChange(idx, 'pre_gst', v)}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Y">Y</SelectItem><SelectItem value="N">N</SelectItem></SelectContent>
                                  </Select>
                                ) : (itm.pre_gst || 'N')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.cdn_reason || ''} onChange={(e) => handleLineItemChange(idx, 'cdn_reason', e.target.value)} /> : (itm.cdn_reason || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? (
                                  <Select value={itm.nil_rated || 'Select an option'} onValueChange={(v) => handleLineItemChange(idx, 'nil_rated', v)}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Select an option">Select an option</SelectItem>
                                      <SelectItem value="NIL_RATED">NIL Rated</SelectItem>
                                      <SelectItem value="EXEMPT">Exempt</SelectItem>
                                      <SelectItem value="NON_GST">Non GST</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (itm.nil_rated || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.erp_profit_center || ''} onChange={(e) => handleLineItemChange(idx, 'erp_profit_center', e.target.value)} /> : (itm.erp_profit_center || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.vouc_num || ''} onChange={(e) => handleLineItemChange(idx, 'vouc_num', e.target.value)} /> : (itm.vouc_num || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.vouc_dt || ''} onChange={(e) => handleLineItemChange(idx, 'vouc_dt', e.target.value)} /> : (itm.vouc_dt || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.vouc_created_dt || ''} onChange={(e) => handleLineItemChange(idx, 'vouc_created_dt', e.target.value)} /> : (itm.vouc_created_dt || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.vouc_modified_dt || ''} onChange={(e) => handleLineItemChange(idx, 'vouc_modified_dt', e.target.value)} /> : (itm.vouc_modified_dt || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.vouc_created_by || ''} onChange={(e) => handleLineItemChange(idx, 'vouc_created_by', e.target.value)} /> : (itm.vouc_created_by || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.erp_rev_gl || ''} onChange={(e) => handleLineItemChange(idx, 'erp_rev_gl', e.target.value)} /> : (itm.erp_rev_gl || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.erp_tax_code || ''} onChange={(e) => handleLineItemChange(idx, 'erp_tax_code', e.target.value)} /> : (itm.erp_tax_code || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.erp_vouc_type || ''} onChange={(e) => handleLineItemChange(idx, 'erp_vouc_type', e.target.value)} /> : (itm.erp_vouc_type || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.out_sgst_gl || ''} onChange={(e) => handleLineItemChange(idx, 'out_sgst_gl', e.target.value)} /> : (itm.out_sgst_gl || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.out_cgst_gl || ''} onChange={(e) => handleLineItemChange(idx, 'out_cgst_gl', e.target.value)} /> : (itm.out_cgst_gl || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.out_igst_gl || ''} onChange={(e) => handleLineItemChange(idx, 'out_igst_gl', e.target.value)} /> : (itm.out_igst_gl || '-')}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-100/50">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.out_cess_gl || ''} onChange={(e) => handleLineItemChange(idx, 'out_cess_gl', e.target.value)} /> : (itm.out_cess_gl || '-')}
                              </td>
                              <td className="py-2.5 px-4">
                                {isEditMode ? <Input className="h-7 text-xs w-full" value={itm.item_mat_code || ''} onChange={(e) => handleLineItemChange(idx, 'item_mat_code', e.target.value)} /> : (itm.item_mat_code || '-')}
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan={36} className="py-10 text-center text-slate-400 italic">No line items added</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {isEditMode && (
                    <div className="flex items-center gap-3 mt-3">
                      <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 border-blue-200 bg-white gap-1.5 shadow-none" onClick={addNewLineItem}>
                        <Plus className="h-3.5 w-3.5" /> Add new line item
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs text-slate-400 border-slate-200 bg-white gap-1.5 shadow-none opacity-50 cursor-not-allowed">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-6">
                      <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" className="h-9 px-3 text-xs text-slate-500 border-slate-200 gap-2"><ChevronLeft className="h-4 w-4" /> Previous</Button>
                         <div className="h-9 w-9 bg-blue-600 text-white rounded-md flex items-center justify-center text-[13px] font-extrabold shadow-md transform hover:scale-105 transition-transform cursor-pointer">1</div>
                         <Button variant="outline" size="sm" className="h-9 px-3 text-xs text-slate-400 border-slate-100 bg-slate-50 gap-2 cursor-not-allowed">Next <ChevronRight className="h-4 w-4" /></Button>
                      </div>
                  </div>
                </div>
              </div>

              {/* Customer Details Section */}
              <div id="cust-details" className="pt-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Customer Details</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('Recipient Billing Name', 'customer_name')}
                  {renderField('Recipient Billing GSTIN', 'ctin')}
                  {renderField('Recipient Billing Address', 'customer_address')}
                  {renderField('Recipient Billing State', 'pos', { type: 'select', options: STATE_OPTIONS })}
                  {renderField('Recipient Billing City', 'customer_city')}
                </div>
              </div>

              {/* Seller Details Section */}
              <div id="sell-details" className="pt-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Seller Details</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('My GSTIN', 'business_gstin', { readOnly: true })}
                  {renderField('Branch Name', 'branch', { readOnly: true })}
                  {renderField('Supplier Name', 'business_name', { readOnly: true })}
                </div>
              </div>

              {/* Export Details Section */}
              <div id="exp-details" className="pt-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Export Details</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('Type of Export', 'exp_typ', { type: 'select', options: TYPE_OF_EXPORT_OPTIONS })}
                  {renderField('Shipping Bill Port Code', 'sbpcode', { type: 'select', options: SHIPPING_PORT_CODES })}
                  {renderField('Shipping Bill Number', 'sbnum')}
                  {renderField('Shipping Bill Date', 'sbdt', { type: 'date' })}
                </div>
              </div>

              {/* Amendment Details Section */}
              <div id="amend-details" className="pt-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Amendment Details</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('Original Document Date (in case of amendment)', 'orig_idt', { type: 'date' })}
                  {renderField('Original Document Number (in case of amendment)', 'orig_inum')}
                  {renderField('Original Customer Billing GSTIN (in case of amendment)', 'orig_ctin')}
                  {renderField('Original GSTIN of Ecommerce Marketplace', 'orig_gstin_eco')}
                  {renderField('Original Return Filing Month', 'orig_period', { type: 'text', placeholder: 'MMM YYYY' })}
                </div>
              </div>

              {/* Others Section */}
              <div id="others" className="pt-12 pb-12">
                <div className="bg-slate-50/50 px-6 py-2.5 mb-6 border-y border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Others</h2>
                </div>
                <div className="grid grid-cols-4 gap-x-6 gap-y-8 px-10">
                  {renderField('Has GST/IDT TDS been deducted', 'tds_deducted', { type: 'select', options: ['N', 'Y'] })}
                  {renderField('GSTIN of Ecommerce Marketplace', 'gstin_eco')}
                  {renderField('Section 9(5)', 'sec_9_5', { type: 'select', options: SECTION_9_5_OPTIONS })}
                  {renderField('E-Com Supplier GSTIN', 'eco_ctin')}
                  
                  {renderField('ERP Company Code', 'erp_comp_code')}
                  {renderField('ERP Plant Code', 'erp_plant_code')}
                  {renderField('Customer Code', 'cust_code')}
                  {renderField('ERP Business Place', 'erp_biz_place')}
                  {renderField('ERP Source System', 'erp_source')}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border-t border-slate-100 p-5 flex justify-end items-center gap-4 shrink-0 z-40 font-sans shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
            {isEditMode ? (
              <>
                <Button variant="ghost" className="h-10 font-bold text-slate-500 hover:text-slate-700 px-6 transition-colors" onClick={() => setIsEditMode(false)}>Discard changes</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-8 font-bold shadow-lg shadow-blue-200/50 transition-all hover:-translate-y-0.5 active:translate-y-0" onClick={handleSaveEditedDoc}>Save changes</Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="h-10 font-bold text-slate-600 border-slate-200 px-8 bg-white hover:bg-slate-50 transition-all rounded-md" onClick={() => setViewMode('documents')}>Close</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-8 font-bold shadow-lg shadow-blue-200/50 transition-all hover:-translate-y-0.5 active:translate-y-0 rounded-md" onClick={() => setIsEditMode(true)}>Edit document</Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };


  const renderDocumentsView = () => {
    if (!summaryData) return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500">Loading documents...</p>
      </div>
    );

    const data = (summaryData as any).data || summaryData;
    let sectionData: any[] = [];
    
    // Map section IDs to data
    if (currentSectionId === 'b2b') sectionData = data.b2b?.flatMap((c: any) => c.invoices?.map((i: any) => ({ ...i, ctin: c.ctin, customer_name: c.customer_name }))) || [];
    else if (currentSectionId === 'b2cl') sectionData = data.b2cl || [];
    else if (currentSectionId === 'b2cs') sectionData = data.b2cs || [];
    else if (currentSectionId === 'exp') sectionData = data.exp || [];
    else if (currentSectionId === 'cdnr') sectionData = data.cdnr?.flatMap((c: any) => c.notes?.map((n: any) => ({ ...n, ctin: c.ctin, customer_name: c.customer_name }))) || [];
    else if (currentSectionId === 'cdnur') sectionData = data.cdnur || [];

    // Summary calculations for the header
    const stats = sectionData.reduce((acc, row) => {
      acc.docs += 1;
      acc.taxable += normalizeNumericValue(getRowValue(row, ['txval', 'taxable_value', 'taxable_amount']));
      acc.igst += normalizeNumericValue(getRowValue(row, ['iamt', 'igst', 'igst_amount']));
      acc.cgst += normalizeNumericValue(getRowValue(row, ['camt', 'cgst', 'cgst_amount']));
      acc.sgst += normalizeNumericValue(getRowValue(row, ['samt', 'sgst', 'sgst_amount']));
      acc.cess += normalizeNumericValue(getRowValue(row, ['csamt', 'cess', 'cess_amount']));
      acc.total += normalizeNumericValue(getRowValue(row, ['val', 'invoice_value', 'total_amount', 'total_value']));
      return acc;
    }, { docs: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 });

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 font-sans">
        {/* Summary Cards Header like Image 3 */}
        <div className="grid grid-cols-7 gap-3 px-6 py-4 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-10 shadow-sm">
          {[
            { label: 'Total Docs', value: stats.docs, color: 'text-slate-500' },
            { label: 'Document Value', value: `₹ ${stats.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-blue-600' },
            { label: 'Taxable Amount', value: `₹ ${stats.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-slate-800' },
            { label: 'IGST', value: `₹ ${stats.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-slate-800' },
            { label: 'CGST', value: `₹ ${stats.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-slate-800' },
            { label: 'SGST', value: `₹ ${stats.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-slate-800' },
            { label: 'Cess', value: `₹ ${stats.cess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-slate-800' },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-3 border-r last:border-r-0 border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <span className={`text-[15px] font-bold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Filters and Actions Bar like Image 3 */}
        <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-blue-600 border-blue-200 bg-white shadow-none">
                <Filter className="h-3.5 w-3.5" /> Filters {isFilterApplied ? "(3 applied)" : ""}
              </Button>
              {isFilterApplied && (
                <div className="flex gap-1">
                   <Badge variant="outline" className="h-7 bg-white text-slate-500 border-slate-200 font-medium px-2 py-0 shadow-none">Section Name : 1 filter <X className="ml-1 h-3 w-3 cursor-pointer" /></Badge>
                   <Badge variant="outline" className="h-7 bg-white text-slate-500 border-slate-200 font-medium px-2 py-0 shadow-none">Sta... <X className="ml-1 h-3 w-3 cursor-pointer" /></Badge>
                </div>
              )}
           </div>
           <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">1 - {sectionData.length} of {sectionData.length}</span>
              <div className="flex items-center gap-1 mr-2">
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-400"><ChevronLeft className="h-4 w-4" /></Button>
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-400"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 border-blue-200 bg-blue-50/10 font-bold border-dashed shadow-none">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download (doc level report)
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 border-blue-200 bg-white font-bold shadow-none">
                  Actions <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              </Button>
           </div>
        </div>

        {/* Documents Table like Image 3 */}
        <div className="flex-1 overflow-auto bg-white">
           <table className="w-full text-left border-collapse min-w-[1200px]">
             <thead>
               <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-slate-50 z-10">
                 <th className="py-3 px-4 w-12 text-center border-r border-slate-200"><Checkbox className="border-slate-300" /></th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Document Number</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Document Type Code</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Section Name</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">SubSection Name</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Type of Export</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Document Date</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Recipient Billing GSTIN</th>
                 <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Recipient Billing Name</th>
                 <th className="py-3 px-4 whitespace-nowrap">Place of Supply</th>
               </tr>
             </thead>
             <tbody>
               {sectionData.length > 0 ? sectionData.map((row, idx) => {
                 const inum = getRowValue(row, ['inum', 'nt_num', 'invoice_number', 'document_number']);
                 const idt = getRowValue(row, ['idt', 'nt_dt', 'invoice_date', 'document_date']);
                 const ctin = getRowValue(row, ['ctin', 'customer_gstin', 'gstin']);
                 const custName = getRowValue(row, ['customer_name', 'name']);
                 const pos = getRowValue(row, ['pos', 'place_of_supply']);
                 
                 return (
                   <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs text-slate-600">
                     <td className="py-3 px-4 text-center border-r border-slate-100/50"><Checkbox className="border-slate-300" /></td>
                     <td className="py-3 px-4 font-bold text-blue-600 cursor-pointer hover:underline border-r border-slate-100/50" onClick={() => { setSelectedDocument(row); setViewMode('document-details'); }}>{inum || '-'}</td>
                     <td className="py-3 px-4 border-r border-slate-100/50">{getRowValue(row, ['inv_typ', 'nt_typ', 'document_type']) || (ctin ? 'INVOICE' : 'B2CS')}</td>
                     <td className="py-3 px-4 uppercase font-bold border-r border-slate-100/50">{currentSectionId.toUpperCase()}</td>
                     <td className="py-3 px-4 uppercase text-slate-400 font-medium border-r border-slate-100/50">REGULAR</td>
                     <td className="py-3 px-4 border-r border-slate-100/50">-</td>
                     <td className="py-3 px-4 border-r border-slate-100/50">{idt || '-'}</td>
                     <td className="py-3 px-4 font-mono border-r border-slate-100/50">{ctin || '-'}</td>
                     <td className="py-3 px-4 truncate max-w-[150px] border-r border-slate-100/50">{custName || '-'}</td>
                     <td className="py-3 px-4">{pos || '-'}</td>
                   </tr>
                 );
               }) : (
                 <tr><td colSpan={10} className="py-12 text-center text-slate-400 italic">No data found in this section</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] w-full mt-0 rounded-t-xl overflow-hidden flex flex-col bg-white">
        <DrawerTitle className="sr-only">GSTIN Summary</DrawerTitle>
        <DrawerDescription className="sr-only">Review and process return data for the selected period.</DrawerDescription>
        <DrawerErrorBoundary>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-6">
              {viewMode !== 'summary' && (
                <Button variant="ghost" size="icon" onClick={() => setViewMode('summary')} className="h-8 w-8 -ml-2 mr-2 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer shrink-0">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-xl font-bold text-slate-800">
                {getFullHeaderTitle()}
              </h1>

              {viewMode === 'summary' && (
                <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                  <PopoverTrigger asChild>
                    <button className="bg-white border hover:bg-slate-50 border-slate-200 rounded-md px-3 py-1.5 flex items-center gap-2 shadow-sm cursor-pointer outline-none transition-colors">
                      <span className="font-semibold text-slate-800 max-w-[150px] truncate">{businessName || 'Select business'}</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500">GSTIN: {gstin}</span>
                      <Building2 className="text-blue-500 h-4 w-4 ml-1" />
                      <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <div className="p-3 border-b border-slate-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search business"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-2">
                      {filteredBusinesses.map((b, idx) => (
                        <div key={idx} className="mb-2">
                          <div className="px-4 py-1.5 flex items-center justify-between bg-slate-50 border-y border-slate-100 mb-1">
                            <span className="font-medium text-slate-700 text-sm flex items-center gap-1.5">
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                              {b.businessName}
                            </span>
                            <span className="text-xs text-slate-500">PAN: {b.gstins?.[0]?.gstin?.substring(2, 12) || 'N/A'}</span>
                          </div>
                          {Array.isArray(b.gstins) && b.gstins.map((g: any) => (
                            <div
                              key={g.gstin}
                              className={`px-6 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-100 ${g.gstin === gstin ? 'bg-blue-50/50' : ''}`}
                              onClick={() => {
                                onSelectGstin?.(g.gstin, b.businessName || 'Selected business');
                                setSelectorOpen(false);
                              }}
                            >
                              <Badge variant="outline" className="text-[10px] w-6 flex items-center justify-center p-0 rounded-full h-6 border-slate-300 text-blue-600 bg-white">
                                {g.state?.substring(0, 2).toUpperCase() || ''}
                              </Badge>
                              <div className="flex items-center gap-2 flex-1">
                                <span className="font-medium text-slate-800">{g.state}</span>
                                <span className="text-slate-500 font-mono text-sm">{g.gstin}</span>
                              </div>
                              <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium shadow-none px-2 py-0 h-5">
                                Regular
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>

          {viewMode === 'summary' ? renderMainSummary() : 
           viewMode === 'edit-summary' ? renderEditSummaryView() : 
           viewMode === 'document-details' ? renderDocumentDetailsView() : 
           renderDocumentsView()}

          {uploadDrawerOpen && (
            <div className="absolute top-0 right-0 w-[420px] h-full bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.1)] border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200 font-sans">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm z-10">
                <div className="flex items-center gap-3">
                  {uploadStep === 'details' && (
                    <ChevronLeft className="h-5 w-5 text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => setUploadStep('select')} />
                  )}
                  <h2 className="text-[17px] font-semibold text-slate-800">
                    {uploadStep === 'select' ? 'Upload Sales register' : 
                     uploadStep === 'details' ? 'File details' : 
                     uploadStep === 'checking' ? 'Checking file for errors & duplicates' : 
                     'File Summary'}
                  </h2>
                </div>
                <X className="h-5 w-5 text-slate-500 cursor-pointer hover:text-red-500" onClick={() => { setUploadDrawerOpen(false); setUploadStep('select'); setSelectedFile(null); setIsUploading(false); }} />
              </div>

              <div className="flex-1 overflow-y-auto bg-white flex flex-col">
                {uploadStep === 'select' && (
                  <div className="p-6">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      onChange={handleFileUpload}
                      accept=".xls,.xlsx,.csv"
                    />
                    <div 
                      className="border border-dashed border-blue-300 bg-blue-50/50 rounded-xl p-10 flex flex-col items-center justify-center mb-10 cursor-pointer hover:bg-blue-50 transition-colors relative"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-14 h-14 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-blue-500" />
                      </div>
                      <p className="text-blue-600 font-semibold text-base mb-1.5">Select a file to import</p>
                      <p className="text-slate-400 text-[13px]">or drag and drop your file in this box</p>
                    </div>
                    
                    <h3 className="text-[13px] font-semibold text-slate-500 mb-3 uppercase tracking-wider">Don't have a file to import?</h3>
                    <div className="space-y-3">
                      <div 
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = '/virtual_CA_template.xlsx';
                            link.download = 'virtual_CA_template.xlsx';
                            link.click();
                        }}
                        className="border border-slate-200 rounded-lg p-3.5 flex items-center justify-between hover:border-emerald-400 cursor-pointer transition-colors group bg-white shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <Download className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="text-sm font-semibold text-slate-700">Virtual CA Template</span>
                        </div>
                      </div>
                      <div 
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = '/amendment.pdf';
                          link.download = 'gstr1_template.pdf';
                            link.click();
                        }}
                        className="border border-slate-200 rounded-lg p-3.5 flex items-center justify-between hover:border-emerald-400 cursor-pointer transition-colors group bg-white shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <Download className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="text-sm font-semibold text-slate-700">GSTR-1 Govt. Template</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {uploadStep === 'details' && (
                  <div className="p-6 flex flex-col h-full relative">
                    <div className="space-y-6 flex-1">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">1. File selected for import</p>
                        <div className="flex items-center justify-between border border-slate-200 rounded-lg p-3 bg-white">
                          <span className="text-sm text-slate-800 font-medium truncate">{selectedFile?.name || 'No file selected'}</span>
                          <Trash2 className="h-4 w-4 text-slate-400 cursor-pointer hover:text-red-500" onClick={() => { setSelectedFile(null); setUploadStep('select'); }} />
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">2. Business (PAN/GSTIN)</p>
                        <Select defaultValue={gstin}>
                          <SelectTrigger className="w-full h-11 border-slate-200 text-sm">
                            <SelectValue placeholder="Select Business" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={gstin}>{businessName || 'Selected business'}: GSTIN - {gstin}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">3. Return period</p>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex items-center justify-between border border-slate-200 rounded-lg p-3 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                              <span className="text-sm text-slate-800">
                                {dateRange?.from ? (
                                  dateRange.to ? (
                                    `${format(dateRange.from, 'LLL yyyy')} → ${format(dateRange.to, 'LLL yyyy')}`
                                  ) : (
                                    format(dateRange.from, 'LLL yyyy')
                                  )
                                ) : (
                                  'Select Return Period'
                                )}
                              </span>
                              <Calendar className="h-4 w-4 text-blue-500" />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4" align="start">
                            <div className="flex justify-center">
                              <CalendarPicker
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                initialFocus
                                numberOfMonths={2}
                                className="border-0"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">4. Template to be used</p>
                        <p className="text-xs text-slate-500 mb-3">We check your file for required columns based on the template you select.</p>
                        <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value as 'virtualca' | 'gov')}>
                          <SelectTrigger className="w-full h-11 border-slate-200 text-sm">
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="virtualca">Virtual CA Template</SelectItem>
                            <SelectItem value="gov">GSTR-1 Govt. Template</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] mt-auto">
                      <Button
                        onClick={handleProcessFile}
                        disabled={!selectedFile || isUploading}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isUploading ? 'Checking file...' : 'Check file for errors & duplicates'} <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {uploadStep === 'checking' && (
                  <div className="p-8 flex flex-col items-center flex-1">
                    <div className="flex flex-col items-center justify-center py-12">
                       <div className="w-24 h-24 relative mb-6">
                         <div className="absolute inset-0 border-[6px] border-slate-100 rounded-full"></div>
                         <div className="absolute inset-0 border-[6px] border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                           <FileText className="h-8 w-8 text-blue-500" />
                         </div>
                       </div>
                       <p className="text-[17px] font-semibold text-slate-800">Please wait. This may take a few minutes.</p>
                    </div>

                    <div className="w-full border border-slate-200 rounded-lg overflow-hidden mt-2">
                       <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                         FILE DETAILS
                       </div>
                       <div className="p-4 space-y-3">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2 text-sm text-slate-700"><FileText className="h-4 w-4 text-slate-400" /> <span className="font-medium">{selectedFile?.name || 'No file selected'}</span></div>
                           <span className="text-xs text-slate-500">{selectedFile?.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700">
                           <Inbox className="h-4 w-4 text-slate-400" /> 
                           <span className="truncate">{businessName || 'Selected business'}: GSTIN - {gstin}</span>
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700">
                           <Calendar className="h-4 w-4 text-slate-400" /> 
                           {dateRange?.from ? `${format(dateRange.from, 'LLL yyyy')} - ${format(dateRange.to || dateRange.from, 'LLL yyyy')}` : returnPeriod || 'Select return period'}
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700"><Download className="h-4 w-4 text-slate-400" /> {selectedTemplateLabel}</div>
                       </div>
                    </div>

                    <div className="w-full border border-emerald-200 rounded-lg p-4 mt-4 bg-white flex items-start gap-3">
                       <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                       <div>
                         <p className="text-sm font-bold text-emerald-700 mb-1">Your file is being processed...</p>
                         <p className="text-xs text-emerald-600 leading-relaxed">Hurray! Your file has been uploaded successfully and is currently being processed. We will let you know when the ingestion is complete.</p>
                       </div>
                    </div>
                  </div>
                )}

                {uploadStep === 'error' && (
                  <div className="p-8 flex flex-col items-center justify-center flex-1">
                    <div className="w-28 h-28 mb-4">
                       <div className="bg-amber-100 text-amber-600 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-2">
                         <AlertCircle className="h-10 w-10 text-amber-500" />
                       </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Some mandatory Headers are missing.</h3>
                    <p className="text-base text-slate-600 text-center mb-6">Column mandatory header(s) are missing</p>
                    
                    <div className="text-sm text-slate-700 mb-8 w-full">
                      <p className="mb-2">Add them to your file and import again</p>
                      <ul className="list-decimal pl-5 space-y-1 font-medium">
                        <li>Item Taxable Amount</li>
                      </ul>
                    </div>

                    <Button onClick={() => setUploadStep('select')} className="bg-blue-600 hover:bg-blue-700 text-white w-40 mb-6">
                      Upload file
                    </Button>

                    <div className="text-center text-xs text-slate-400 space-y-1">
                      <p>Error occurred on: {new Date().toLocaleString()}</p>
                      <p>Error ID: 2fd1c959-d241-4d40-9268-26fefe04c783</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerErrorBoundary>
      </DrawerContent>
    </Drawer>
  );
}
