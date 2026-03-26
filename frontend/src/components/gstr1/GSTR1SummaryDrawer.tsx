import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerClose
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  Inbox,
  FileText,
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface GSTR1SummaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string;
  businessName?: string;
  businesses?: any[];
  onSelectGstin?: (gstin: string, businessName: string) => void;
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
  onSelectGstin
}: GSTR1SummaryDrawerProps) {
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [expandedAmendments, setExpandedAmendments] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'summary' | 'documents' | 'edit-summary'>('summary');
  const [currentSectionView, setCurrentSectionView] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
  // Upload Drawer Multi-Step State
  const [uploadStep, setUploadStep] = useState<'select' | 'details' | 'checking' | 'error'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Editable Summary Table State
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filters State
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 2, 1),
    to: new Date(2026, 2, 26),
  });

  const toggleDoc = (s: string) => setSelectedDocs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleSection = (s: string) => setSelectedSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadStep('details');
    }
  };

  const handleProcessFile = () => {
    setUploadStep('checking');
    
    // Simulate API processing delay
    setTimeout(() => {
      // For demonstration, mock failure if filename contains "error" or just randomly
      const shouldFail = selectedFile?.name.toLowerCase().includes('error');
      
      if (shouldFail) {
        setUploadStep('error');
      } else {
        setUploadDrawerOpen(false);
        setUploadStep('select');
        toast({
          title: 'File Imported Successfully',
          description: `Imported ${selectedFile?.name} to local workspace.`,
        });
        // Populate editable table natively
        setSummaryRows([
          { id: '1', type: 'Inter-State supplies to registered persons', val1: '0.00', val2: '0.00', val3: '0.00' },
          { id: '2', type: 'Inter-State supplies to unregistered persons', val1: '2500.00', val2: '0.00', val3: '0.00' }
        ]);
        setIsFilterApplied(true);
      }
    }, 2000);
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

  const handleViewSection = (sectionName: string, sectionGroup: string) => {
    setCurrentSectionView(sectionName);
    if (sectionGroup === 'summaries' || sectionGroup === 'amendments') {
      setViewMode('edit-summary');
    } else {
      setViewMode('documents');
    }
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
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center text-slate-700">{!isGroup ? '0.00' : ''}</td>
          <td className="py-3 px-4 text-sm text-center">
            <button
              onClick={() => handleViewSection(item.name, toggleFn === toggleAmendmentGroup ? 'amendments' : (toggleFn === toggleSummaryGroup ? 'summaries' : 'grouped'))}
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
    b.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.gstins.some((g: any) => g.gstin.toLowerCase().includes(searchQuery.toLowerCase()))
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
    if (viewMode === 'edit-summary') {
      const stateName = businesses.find(b => b.gstins.some((g: any) => g.gstin === gstin))?.gstins.find((g: any) => g.gstin === gstin)?.state || 'State';
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
                onClick={() => setUploadDrawerOpen(true)}
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
             <Button variant="outline" className="h-8 text-xs text-slate-500 opacity-50"><ChevronLeft className="mr-1 h-3 w-3" /> Previous</Button>
             <div className="flex items-center justify-center bg-blue-600 text-white rounded-full w-6 h-6 text-xs font-medium shadow-sm">1</div>
             <Button variant="outline" className="h-8 text-xs text-slate-600">Next <ChevronRight className="ml-1 h-3 w-3" /></Button>
          </div>
      </div>
    );
  };

  const renderDocumentsView = () => {
    if (!isFilterApplied) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative">
          <div className="flex flex-col items-center justify-center -mt-20">
            <div className="w-40 h-32 mb-4 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-50 rounded-full opacity-50 blur-2xl"></div>
              <Inbox className="h-16 w-16 text-slate-200" />
            </div>
            <h3 className="text-[17px] font-bold text-slate-800 mb-1.5">No data to show</h3>
            <p className="text-sm text-slate-600 mb-6">Import a file to see data here</p>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium px-5"
              onClick={() => setUploadDrawerOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" /> Import file
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
        {/* Left Filters Sidebar */}
        <div className="w-[300px] flex flex-col bg-white border-r border-slate-200 h-full flex-shrink-0 relative">
          <div className="border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-base">Filters</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 rounded-full" onClick={() => setIsFilterApplied(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <div
                className="flex items-center justify-between mb-2 cursor-pointer group"
                onClick={() => setIsDateExpanded(!isDateExpanded)}
              >
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Document Date</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDateExpanded ? '' : '-rotate-90'}`} />
              </div>
              {isDateExpanded && (
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-slate-500 font-normal border-slate-300 h-9">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <span className="truncate">{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</span>
                        ) : (
                          <span>{format(dateRange.from, 'LLL dd, y')}</span>
                        )
                      ) : (
                        <span>Select here...</span>
                      )}
                      <Calendar className="h-4 w-4 text-blue-500 ml-auto" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <div className="flex justify-center">
                      <CalendarPicker
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        initialFocus
                        numberOfMonths={2}
                      />
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                      <Button className="bg-blue-600 hover:bg-blue-700 shadow-none px-6 h-8 text-xs font-semibold text-white" onClick={() => setDatePopoverOpen(false)}>Apply</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div>
              <div
                className="flex items-center justify-between mb-3 cursor-pointer group"
                onClick={() => setIsTypeExpanded(!isTypeExpanded)}
              >
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Document Type Code</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isTypeExpanded ? '' : '-rotate-90'}`} />
              </div>
              {isTypeExpanded && (
                <div className="space-y-3">
                  {['INV', 'CRN', 'DBN', 'RECEIPT', 'ADVANCE_ADJUSTMENT'].map(type => (
                    <div key={type} className="flex items-center group cursor-pointer" onClick={() => toggleDoc(type)}>
                      <Checkbox id={`doc-${type}`} checked={selectedDocs.includes(type)} onCheckedChange={() => toggleDoc(type)} className="mr-3 font-medium border-slate-300" />
                      <label htmlFor={`doc-${type}`} className="text-sm text-slate-600 font-medium cursor-pointer group-hover:text-blue-600 transition-colors">{type}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div
                className="flex items-center justify-between mb-3 cursor-pointer group"
                onClick={() => setIsSectionExpanded(!isSectionExpanded)}
              >
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Section Name</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isSectionExpanded ? '' : '-rotate-90'}`} />
              </div>
              {isSectionExpanded && (
                <div className="space-y-3">
                  {['B2B', 'B2BA'].map(type => (
                    <div key={type} className="flex items-center group cursor-pointer" onClick={() => toggleSection(type)}>
                      <Checkbox id={`sec-${type}`} checked={selectedSections.includes(type)} onCheckedChange={() => toggleSection(type)} className="mr-3 font-medium border-slate-300" />
                      <label htmlFor={`sec-${type}`} className="text-sm text-slate-600 font-medium cursor-pointer group-hover:text-blue-600 transition-colors">{type}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex items-center gap-3">
            <Button variant="outline" className="flex-1 font-medium text-slate-700 border-slate-300" onClick={handleResetFilters}>
              Reset
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 font-medium shadow-none text-white" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
          <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-2 overflow-hidden flex-1 mr-4">
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-slate-400">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
              <div className="flex items-center bg-white border border-slate-200 rounded px-3 py-1 text-xs shrink-0 shadow-sm">
                <span className="text-slate-500 mr-2">Status :</span>
                <span className="font-medium mr-2">{selectedDocs.length > 0 ? selectedDocs.length : 4} filters</span>
                <X className="h-3 w-3 text-slate-400 cursor-pointer hover:text-slate-600" onClick={handleResetFilters} />
              </div>
              <div className="flex items-center bg-white border border-slate-200 rounded px-3 py-1 text-xs shrink-0 shadow-sm">
                <span className="text-slate-500 mr-2">Section Name :</span>
                <span className="font-medium mr-2">{selectedSections.length > 0 ? selectedSections.length : 1} filter</span>
                <X className="h-3 w-3 text-slate-400 cursor-pointer hover:text-slate-600" onClick={handleResetFilters} />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button className="bg-blue-400 hover:bg-blue-500 text-white shadow-none h-8 text-xs font-medium px-3">
                <Download className="mr-2 h-3.5 w-3.5" /> Download (doc level report)
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-slate-300 text-blue-600 font-medium h-8 text-xs px-3 bg-white">
                    Actions <ChevronDown className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Mark as read</DropdownMenuItem>
                  <DropdownMenuItem>Refresh Data</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Delete all</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative -top-10">
            <div className="w-32 h-32 mb-4 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-50 rounded-full opacity-50 blur-2xl"></div>
              <Inbox className="h-16 w-16 text-slate-300 absolute fallback-icon" />
            </div>
            <h3 className="text-[17px] font-bold text-slate-800 mb-1.5">No data to show</h3>
            <p className="text-sm text-slate-600 mb-1">Didn't find any documents that match the filters applied.</p>
            <p className="text-sm text-slate-600">Try <span className="text-blue-600 font-medium cursor-pointer hover:underline" onClick={handleResetFilters}>resetting the filters.</span></p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] w-full mt-0 rounded-t-xl overflow-hidden flex flex-col bg-white">
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
                      <span className="font-semibold text-slate-800 max-w-[150px] truncate">{businessName}</span>
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
                            <span className="text-xs text-slate-500">PAN: {b.gstins?.[0]?.gstin.substring(2, 12) || 'N/A'}</span>
                          </div>
                          {b.gstins.map((g: any) => (
                            <div
                              key={g.gstin}
                              className={`px-6 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-100 ${g.gstin === gstin ? 'bg-blue-50/50' : ''}`}
                              onClick={() => {
                                onSelectGstin?.(g.gstin, b.businessName);
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
                <X className="h-5 w-5 text-slate-500 cursor-pointer hover:text-red-500" onClick={() => { setUploadDrawerOpen(false); setUploadStep('select'); }} />
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
                            link.download = 'gov_template.pdf';
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
                          <span className="text-sm text-slate-800 font-medium truncate">{selectedFile?.name || 'Demo_Client_Sales_Data.xlsx'}</span>
                          <Trash2 className="h-4 w-4 text-slate-400 cursor-pointer hover:text-red-500" onClick={() => setUploadStep('select')} />
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">2. Business (PAN/GSTIN)</p>
                        <Select defaultValue={gstin}>
                          <SelectTrigger className="w-full h-11 border-slate-200 text-sm">
                            <SelectValue placeholder="Select Business" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={gstin}>{businessName}: GSTIN - {gstin}</SelectItem>
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
                        <Select defaultValue="virtualca">
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
                      <Button onClick={handleProcessFile} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-[15px] flex items-center justify-center gap-2">
                        Check file for errors & duplicates <ChevronRight className="h-4 w-4" />
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
                           <div className="flex items-center gap-2 text-sm text-slate-700"><FileText className="h-4 w-4 text-slate-400" /> <span className="font-medium">{selectedFile?.name || 'Demo_Client_Sales.xlsx'}</span></div>
                           <span className="text-xs text-slate-500">{(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 5)} KB</span>
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700">
                           <Inbox className="h-4 w-4 text-slate-400" /> 
                           <span className="truncate">{businessName}: GSTIN - {gstin}</span>
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700">
                           <Calendar className="h-4 w-4 text-slate-400" /> 
                           {dateRange?.from ? `${format(dateRange.from, 'LLL yyyy')} - ${format(dateRange.to || dateRange.from, 'LLL yyyy')}` : 'Mar 2026'}
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-700"><Download className="h-4 w-4 text-slate-400" /> Virtual CA Template</div>
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
