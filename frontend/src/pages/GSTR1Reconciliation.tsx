/**
 * GSTR-1 Reconciliation Page
 * 
 * ClearTax-style E-Invoice vs Sales Register Reconciliation wizard and dashboard.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  FileX,
  Filter,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  Shield,
  Upload,
  Users,
  X,
  AlertCircle
} from 'lucide-react';
import { 
  useActiveWorkspace, 
  useActiveBusiness, 
  useTenantStore 
} from '@/store/tenantStore';
import { getGstr1State } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function GSTR1ReconciliationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Workspace integration
  const activeWorkspace = useActiveWorkspace();
  const activeBusiness = useActiveBusiness();
  const { businesses: allWorkspaceBusinesses } = useTenantStore();
  const workspaceId = activeWorkspace?.id;

  // Selected values
  const [selectedGstin, setSelectedGstin] = useState('');
  const [returnPeriod, setReturnPeriod] = useState('');

  // Sync initial parameters
  useEffect(() => {
    if (activeBusiness?.gstin) {
      setSelectedGstin(activeBusiness.gstin);
    } else if (allWorkspaceBusinesses.length > 0) {
      setSelectedGstin(allWorkspaceBusinesses[0].gstin);
    }
    setReturnPeriod(searchParams.get('period') || '062026');
  }, [activeBusiness, allWorkspaceBusinesses, searchParams]);

  // GSTR-1 State data loaded from backend
  const [g1Data, setG1Data] = useState<any>(null);
  const [g1Totals, setG1Totals] = useState({ docs: 0, taxable: 0, tax: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });

  const getTotals = (bizData: any) => {
    let docs = 0, taxable = 0, tax = 0;
    if (bizData?.upload_result?.data) {
      const gstr1Data = bizData.upload_result.data;
      if (gstr1Data.summary && typeof gstr1Data.summary.total_taxable_value === 'number') {
        const s = gstr1Data.summary;
        const igst = s.total_igst || 0;
        const cgst = s.total_cgst || 0;
        const sgst = s.total_sgst || 0;
        const cess = s.total_cess || 0;
        return {
          docs: s.total_invoices || 0,
          taxable: s.total_taxable_value || 0,
          tax: igst + cgst + sgst + cess,
          igst,
          cgst,
          sgst,
          cess
        };
      }
      // Helper: extract tax/value from nested GSTN structures (B2B: invoices[].itms[], CDNR: notes[].itms[], flat: B2CS/B2CL/EXP)
      const extractFromStructure = (arr: any[], fields: string[]): number => {
        const getFieldVal = (obj: any): number => fields.reduce((s, f) => s + Number(obj[f] || 0), 0);
        return arr?.reduce((acc: number, val: any) => {
          // B2B: {ctin, invoices: [{inum, itms: [{txval, iamt, camt, samt}]}]}
          if (Array.isArray(val.invoices)) {
            return acc + val.invoices.reduce((s: number, inv: any) => {
              if (Array.isArray(inv.itms)) return s + inv.itms.reduce((t: number, itm: any) => t + getFieldVal(itm), 0);
              return s + getFieldVal(inv);
            }, 0);
          }
          // CDNR: {ctin, notes: [{nt_num, itms: [{txval, iamt, camt, samt}]}]}
          if (Array.isArray(val.notes)) {
            return acc + val.notes.reduce((s: number, note: any) => {
              if (Array.isArray(note.itms)) return s + note.itms.reduce((t: number, itm: any) => t + getFieldVal(itm), 0);
              return s + getFieldVal(note);
            }, 0);
          }
          // Flat with itms (some schemas)
          if (Array.isArray(val.itms)) return acc + val.itms.reduce((s: number, itm: any) => s + getFieldVal(itm), 0);
          // Old items[] format
          if (Array.isArray(val.items)) return acc + val.items.reduce((s: number, itm: any) => s + getFieldVal(itm), 0);
          // Flat: B2CS, B2CL, EXP
          return acc + getFieldVal(val);
        }, 0) || 0;
      };

      const calculateTotal = (arr: any[]): number => extractFromStructure(arr || [], ['txval', 'taxable_value']);

      const b2bDocsCount = gstr1Data.b2b?.reduce((acc: number, val: any) => acc + (val.invoices?.length || 0), 0) || 0;
      const cdnrDocsCount = gstr1Data.cdnr?.reduce((acc: number, val: any) => acc + (val.notes?.length || 0), 0) || 0;

      docs = b2bDocsCount + (gstr1Data.b2cl?.length || 0) + (gstr1Data.b2cs?.length || 0) + (gstr1Data.exp?.length || 0) + cdnrDocsCount;
      taxable = calculateTotal(gstr1Data.b2b) + calculateTotal(gstr1Data.b2cl) + calculateTotal(gstr1Data.b2cs) + calculateTotal(gstr1Data.exp) + calculateTotal(gstr1Data.cdnr);

      const getTaxDetails = (arr: any[], type: 'igst' | 'cgst' | 'sgst' | 'cess') => {
        const fieldMap: Record<string, string[]> = {
          'igst': ['iamt', 'igst', 'integrated_tax', 'igst_amount'],
          'cgst': ['camt', 'cgst', 'central_tax', 'cgst_amount'],
          'sgst': ['samt', 'sgst', 'state_tax', 'sgst_amount'],
          'cess': ['csamt', 'cess', 'compensation_tax', 'cess_amount']
        };
        return extractFromStructure(arr || [], fieldMap[type]);
      };

      const igst = getTaxDetails(gstr1Data.b2b, 'igst') + getTaxDetails(gstr1Data.b2cl, 'igst') + getTaxDetails(gstr1Data.exp, 'igst') + getTaxDetails(gstr1Data.cdnr, 'igst');
      const cgst = getTaxDetails(gstr1Data.b2b, 'cgst') + getTaxDetails(gstr1Data.b2cs, 'cgst') + getTaxDetails(gstr1Data.cdnr, 'cgst');
      const sgst = getTaxDetails(gstr1Data.b2b, 'sgst') + getTaxDetails(gstr1Data.b2cs, 'sgst') + getTaxDetails(gstr1Data.cdnr, 'sgst');
      const cess = getTaxDetails(gstr1Data.b2b, 'cess') + getTaxDetails(gstr1Data.b2cs, 'cess') + getTaxDetails(gstr1Data.exp, 'cess') + getTaxDetails(gstr1Data.cdnr, 'cess');
      tax = igst + cgst + sgst + cess;
      return { docs, taxable, tax, igst, cgst, sgst, cess };
    }
    return { docs, taxable, tax, igst: 0, cgst: 0, sgst: 0, cess: 0 };
  };

  // Load G1 state baseline data
  useEffect(() => {
    const loadG1State = async () => {
      if (!workspaceId || !selectedGstin || !returnPeriod) return;
      try {
        const response = await getGstr1State(workspaceId, selectedGstin, returnPeriod);
        if (response.success && response.data) {
          setG1Data(response.data);
          setG1Totals(getTotals(response.data));
        } else {
          setG1Data(null);
          setG1Totals({ docs: 0, taxable: 0, tax: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
        }
      } catch (e) {
        console.error("Failed to load GSTR1 state:", e);
      }
    };
    loadG1State();
  }, [workspaceId, selectedGstin, returnPeriod]);

  // Reconciliation workflow states
  const [reconciliationGenerated, setReconciliationGenerated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [reconcilingStatus, setReconcilingStatus] = useState(false);
  const [reconcilingProgress, setReconcilingProgress] = useState(0);

  // Form states in drawer
  const [drawerGstin, setDrawerGstin] = useState('');
  const [srPeriodStart, setSrPeriodStart] = useState('Jun 26');
  const [srPeriodEnd, setSrPeriodEnd] = useState('Jun 26');
  const [g1PeriodStart, setG1PeriodStart] = useState('Jun 26');
  const [g1PeriodEnd, setG1PeriodEnd] = useState('Jun 26');
  
  // Step 3 Upload states
  const [excelUploaded, setExcelUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Document Filters sidebar state
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [filterInvoice, setFilterInvoice] = useState(true);
  const [filterCreditNote, setFilterCreditNote] = useState(true);
  const [filterDebitNote, setFilterDebitNote] = useState(true);
  const [searchDocTerm, setSearchDocTerm] = useState('');

  // Initialize values when drawer opens
  useEffect(() => {
    if (drawerOpen) {
      setDrawerGstin(selectedGstin);
      setWizardStep(1);
      setExcelUploaded(false);
      setUploadedFileName('');
    }
  }, [drawerOpen, selectedGstin]);

  // Derived baseline values for simulated reconciliation
  const baseDocs = g1Totals.docs || 120;
  const baseTaxable = g1Totals.taxable || 420000;
  const baseTax = g1Totals.tax || 75600;
  const baseIgst = g1Totals.igst || 37800;
  const baseCgst = g1Totals.cgst || 18900;
  const baseSgst = g1Totals.sgst || 18900;
  const baseCess = g1Totals.cess || 0;

  // Invoice generator based on G1 data to ensure strict consistency
  const invoices = useMemo(() => {
    const list = [];
    const customerNames = [
      { name: 'Bauer Engineering India Private Limited', gstin: '03AAICB4800F1Z8' },
      { name: 'Punjab Logistics Ltd', gstin: '03AAICB4900F1Z8' },
      { name: 'Supreme Sales Corp', gstin: '03AABCS1234F1Z5' },
      { name: 'Karan Traders', gstin: '03AAEPG5678C1ZY' },
      { name: 'Bright Future Agency', gstin: '03AADCS9012M1ZN' }
    ];

    // Matched (Exact Match) - 92% of docs
    const exactCount = Math.max(1, Math.round(baseDocs * 0.92));
    for (let i = 1; i <= exactCount; i++) {
      const cust = customerNames[i % customerNames.length];
      list.push({
        id: `doc-${i}`,
        invoice_number: `INV/2026/00${i}`,
        gstin: cust.gstin,
        customer_name: cust.name,
        invoice_date: `${10 + (i % 18)}-Jun-2026`,
        taxable_value: Math.round((baseTaxable * (0.92 / exactCount)) * 100) / 100,
        igst: Math.round((baseIgst * (0.92 / exactCount)) * 100) / 100,
        cgst: Math.round((baseCgst * (0.92 / exactCount)) * 100) / 100,
        sgst: Math.round((baseSgst * (0.92 / exactCount)) * 100) / 100,
        status: 'matched',
        document_type: i === 3 ? 'Credit Note' : i === 7 ? 'Debit Note' : 'Invoice',
        remarks: 'Exact match'
      });
    }

    // Suggested Match - 2% of docs
    const suggCount = Math.max(1, Math.round(baseDocs * 0.02));
    for (let i = 1; i <= suggCount; i++) {
      const cust = customerNames[(i + 1) % customerNames.length];
      list.push({
        id: `doc-sugg-${i}`,
        invoice_number: `INV/2026/08${i}`,
        gstin: cust.gstin,
        customer_name: cust.name,
        invoice_date: '21-Jun-2026',
        taxable_value: Math.round((baseTaxable * (0.02 / suggCount)) * 100) / 100,
        igst: Math.round((baseIgst * (0.02 / suggCount)) * 100) / 100,
        cgst: Math.round((baseCgst * (0.02 / suggCount)) * 100) / 100,
        sgst: Math.round((baseSgst * (0.02 / suggCount)) * 100) / 100,
        status: 'suggested_match',
        document_type: 'Invoice',
        remarks: 'Fuzzy match on date'
      });
    }

    // Mismatched - 2% of docs
    const misCount = Math.max(1, Math.round(baseDocs * 0.02));
    for (let i = 1; i <= misCount; i++) {
      const cust = customerNames[(i + 2) % customerNames.length];
      list.push({
        id: `doc-mis-${i}`,
        invoice_number: `INV/2026/09${i}`,
        gstin: cust.gstin,
        customer_name: cust.name,
        invoice_date: '23-Jun-2026',
        taxable_value: Math.round((baseTaxable * (0.02 / misCount)) * 100) / 100,
        igst: Math.round((baseIgst * (0.02 / misCount)) * 100) / 100,
        cgst: Math.round((baseCgst * (0.02 / misCount)) * 100) / 100,
        sgst: Math.round((baseSgst * (0.02 / misCount)) * 100) / 100,
        status: 'mismatch',
        document_type: 'Invoice',
        remarks: 'Tax amount mismatched'
      });
    }

    // Missing in G1 - 2% of docs
    const missG1Count = Math.max(1, Math.round(baseDocs * 0.02));
    for (let i = 1; i <= missG1Count; i++) {
      const cust = customerNames[(i + 3) % customerNames.length];
      list.push({
        id: `doc-missg1-${i}`,
        invoice_number: `INV/2026/10${i}`,
        gstin: cust.gstin,
        customer_name: cust.name,
        invoice_date: '25-Jun-2026',
        taxable_value: Math.round((baseTaxable * (0.02 / missG1Count)) * 100) / 100,
        igst: Math.round((baseIgst * (0.02 / missG1Count)) * 100) / 100,
        cgst: Math.round((baseCgst * (0.02 / missG1Count)) * 100) / 100,
        sgst: Math.round((baseSgst * (0.02 / missG1Count)) * 100) / 100,
        status: 'missing_in_g1',
        document_type: 'Invoice',
        remarks: 'Missing in GSTR-1'
      });
    }

    // Missing in SR - 2% of docs
    const missSRCount = Math.max(1, Math.round(baseDocs * 0.02));
    for (let i = 1; i <= missSRCount; i++) {
      const cust = customerNames[(i + 4) % customerNames.length];
      list.push({
        id: `doc-misssr-${i}`,
        invoice_number: `INV/2026/11${i}`,
        gstin: cust.gstin,
        customer_name: cust.name,
        invoice_date: '27-Jun-2026',
        taxable_value: Math.round((baseTaxable * (0.02 / missSRCount)) * 100) / 100,
        igst: Math.round((baseIgst * (0.02 / missSRCount)) * 100) / 100,
        cgst: Math.round((baseCgst * (0.02 / missSRCount)) * 100) / 100,
        sgst: Math.round((baseSgst * (0.02 / missSRCount)) * 100) / 100,
        status: 'missing_in_sr',
        document_type: 'Invoice',
        remarks: 'Missing in Sales Register'
      });
    }

    return list;
  }, [baseDocs, baseTaxable, baseIgst, baseCgst, baseSgst]);

  // Compute summary rows based on generated invoices
  const summaryRows = useMemo(() => {
    const filterByStatus = (statusList: string[]) => invoices.filter(inv => statusList.includes(inv.status));
    
    const exact = filterByStatus(['matched']);
    const suggested = filterByStatus(['suggested_match']);
    const mismatched = filterByStatus(['mismatch']);
    const missingG1 = filterByStatus(['missing_in_g1']);
    const missingSR = filterByStatus(['missing_in_sr']);

    const sumVals = (arr: any[], key: 'taxable_value' | 'igst' | 'cgst' | 'sgst') => arr.reduce((acc, val) => acc + (val[key] || 0), 0);

    const exactG1Tax = sumVals(exact, 'igst') + sumVals(exact, 'cgst') + sumVals(exact, 'sgst');
    const suggG1Tax = sumVals(suggested, 'igst') + sumVals(suggested, 'cgst') + sumVals(suggested, 'sgst');
    const misG1Tax = sumVals(mismatched, 'igst') + sumVals(mismatched, 'cgst') + sumVals(mismatched, 'sgst');
    const missSRG1Tax = sumVals(missingSR, 'igst') + sumVals(missingSR, 'cgst') + sumVals(missingSR, 'sgst');

    // Counts & Tax Values
    const data = {
      exact: {
        g1Docs: exact.length,
        srDocs: exact.length,
        g1TaxVal: exactG1Tax,
        srTaxVal: exactG1Tax,
        taxDiff: 0,
        actionsTaken: '100%'
      },
      suggested: {
        g1Docs: suggested.length,
        srDocs: suggested.length,
        g1TaxVal: suggG1Tax,
        srTaxVal: suggG1Tax,
        taxDiff: 0,
        actionsTaken: '100%'
      },
      mismatched: {
        g1Docs: mismatched.length,
        srDocs: mismatched.length,
        g1TaxVal: misG1Tax,
        srTaxVal: misG1Tax + 45 * mismatched.length,
        taxDiff: 8.1 * mismatched.length,
        actionsTaken: '0%'
      },
      missingG1: {
        g1Docs: 0,
        srDocs: missingG1.length,
        g1TaxVal: 0,
        srTaxVal: sumVals(missingG1, 'igst') + sumVals(missingG1, 'cgst') + sumVals(missingG1, 'sgst'),
        taxDiff: sumVals(missingG1, 'igst') + sumVals(missingG1, 'cgst') + sumVals(missingG1, 'sgst'),
        actionsTaken: '0%'
      },
      missingSR: {
        g1Docs: missingSR.length,
        srDocs: 0,
        g1TaxVal: missSRG1Tax,
        srTaxVal: 0,
        taxDiff: missSRG1Tax,
        actionsTaken: '0%'
      }
    };

    return [
      {
        id: 'matched',
        label: 'Matched',
        g1Docs: data.exact.g1Docs + data.suggested.g1Docs,
        srDocs: data.exact.srDocs + data.suggested.srDocs,
        g1TaxVal: data.exact.g1TaxVal + data.suggested.g1TaxVal,
        srTaxVal: data.exact.srTaxVal + data.suggested.srTaxVal,
        taxDiff: 0,
        actionsTaken: '100%',
        isGroup: true,
        percent: Math.round(((data.exact.g1Docs + data.suggested.g1Docs) / invoices.length) * 100)
      },
      {
        id: 'exact',
        label: 'Exact Match',
        ...data.exact,
        isChild: true
      },
      {
        id: 'suggested',
        label: 'Suggested Match',
        ...data.suggested,
        isChild: true
      },
      {
        id: 'mismatched',
        label: 'Mismatched',
        ...data.mismatched,
        isGroup: true,
        percent: Math.round((data.mismatched.g1Docs / invoices.length) * 100)
      },
      {
        id: 'missing',
        label: 'Missing',
        g1Docs: data.missingSR.g1Docs,
        srDocs: data.missingG1.srDocs,
        g1TaxVal: data.missingSR.g1TaxVal,
        srTaxVal: data.missingG1.srTaxVal,
        taxDiff: data.missingSR.g1TaxVal + data.missingG1.srTaxVal,
        actionsTaken: '0%',
        isGroup: true,
        percent: Math.round(((data.missingSR.g1Docs + data.missingG1.srDocs) / invoices.length) * 100)
      },
      {
        id: 'missing_g1',
        label: 'Missing in G1',
        ...data.missingG1,
        isChild: true
      },
      {
        id: 'missing_sr',
        label: 'Missing in SR',
        ...data.missingSR,
        isChild: true
      },
      {
        id: 'excluded',
        label: 'Excluded (0%)',
        g1Docs: 0,
        srDocs: 0,
        g1TaxVal: 0,
        srTaxVal: 0,
        taxDiff: 0,
        actionsTaken: '0%',
        isGroup: true,
        percent: 0
      },
      {
        id: 'total',
        label: 'Total',
        g1Docs: invoices.filter(i => i.status !== 'missing_in_g1').length,
        srDocs: invoices.filter(i => i.status !== 'missing_in_sr').length,
        g1TaxVal: exactG1Tax + suggG1Tax + misG1Tax + missSRG1Tax,
        srTaxVal: exactG1Tax + suggG1Tax + (misG1Tax + 45 * mismatched.length) + (sumVals(missingG1, 'igst') + sumVals(missingG1, 'cgst') + sumVals(missingG1, 'sgst')),
        taxDiff: (data.mismatched.taxDiff) + data.missingG1.taxDiff + data.missingSR.taxDiff,
        actionsTaken: '95%',
        isTotal: true
      }
    ];
  }, [invoices]);

  // Customer View grouped calculations
  const customersList = useMemo(() => {
    const map: Record<string, any> = {};
    invoices.forEach(inv => {
      if (!map[inv.gstin]) {
        map[inv.gstin] = {
          gstin: inv.gstin,
          customer_name: inv.customer_name,
          g1Docs: 0,
          srDocs: 0,
          g1Tax: 0,
          srTax: 0,
          taxDiff: 0,
          g1Taxable: 0,
          srTaxable: 0,
          g1DocVal: 0,
          srDocVal: 0,
          missingG1: 0,
          missingSR: 0,
          noActionDocs: 0
        };
      }
      const c = map[inv.gstin];
      
      const isG1 = inv.status !== 'missing_in_g1';
      const isSR = inv.status !== 'missing_in_sr';
      
      const g1Taxable = isG1 ? inv.taxable_value : 0;
      const srTaxable = isSR ? (inv.status === 'mismatch' ? inv.taxable_value + 45 : inv.taxable_value) : 0;
      
      const g1Tax = isG1 ? (inv.igst + inv.cgst + inv.sgst) : 0;
      const srTax = isSR ? (inv.status === 'mismatch' ? (inv.igst + inv.cgst + inv.sgst) + 8.1 : (inv.igst + inv.cgst + inv.sgst)) : 0;
      
      if (isG1) c.g1Docs++;
      if (isSR) c.srDocs++;
      
      c.g1Tax += g1Tax;
      c.srTax += srTax;
      c.g1Taxable += g1Taxable;
      c.srTaxable += srTaxable;
      c.g1DocVal += g1Taxable + g1Tax;
      c.srDocVal += srTaxable + srTax;
      
      if (inv.status === 'missing_in_g1') c.missingG1++;
      if (inv.status === 'missing_in_sr') c.missingSR++;
    });
    
    Object.values(map).forEach((c: any) => {
      c.taxDiff = Math.abs(c.g1Tax - c.srTax);
    });
    
    return Object.values(map);
  }, [invoices]);

  // Filtered customer list for Customer View search
  const filteredCustomers = useMemo(() => {
    return customersList.filter(cust => {
      const term = searchDocTerm.toLowerCase();
      return !term || 
        cust.customer_name.toLowerCase().includes(term) || 
        cust.gstin.toLowerCase().includes(term);
    });
  }, [customersList, searchDocTerm]);

  // Document Type checkboxes filter logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = !searchDocTerm || 
        inv.invoice_number.toLowerCase().includes(searchDocTerm.toLowerCase()) ||
        inv.gstin.toLowerCase().includes(searchDocTerm.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(searchDocTerm.toLowerCase());

      let matchesType = false;
      if (inv.document_type === 'Invoice' && filterInvoice) matchesType = true;
      if (inv.document_type === 'Credit Note' && filterCreditNote) matchesType = true;
      if (inv.document_type === 'Debit Note' && filterDebitNote) matchesType = true;
      
      return matchesSearch && matchesType;
    });
  }, [invoices, searchDocTerm, filterInvoice, filterCreditNote, filterDebitNote]);

  // Trigger simulated reconciliation loader
  const handleTriggerReconciliation = () => {
    setReconcilingStatus(true);
    setReconcilingProgress(0);
    
    const interval = setInterval(() => {
      setReconcilingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setReconcilingStatus(false);
            setReconciliationGenerated(true);
            setDrawerOpen(false);
            toast({
              title: "Reconciliation Complete",
              description: "E-Invoice and Sales Register successfully reconciled."
            });
          }, 300);
          return 100;
        }
        return prev + 15;
      });
    }, 150);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      
      {/* Alert GSTN downtime portal */}
      <div className="bg-slate-900 border-b border-slate-800 text-amber-500 text-xs px-6 py-2.5 flex items-center justify-between font-medium">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Alert Scheduled Downtime on the GSTN portal [Starting: Sun, 07 Jun 2026 12:00:00 AM]</span>
        </div>
        <span>Estimated time to resolve: June 7, 2026 6:30 AM</span>
      </div>

      {/* Main Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>All Recons</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700 dark:text-slate-300">E-Invoice Data(GSTR-1) vs Sales Register(SR)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 flex items-center gap-2">
            E-Invoice Data(GSTR-1) vs Sales Register(SR)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View and validate GSTR-1 vs SR reconciliation results and re-run reconciliation as per your requirement.
          </p>
        </div>
        
        {reconciliationGenerated && (
          <Button 
            onClick={() => navigate('/gst/gstr1/prepare', { state: { gstin: selectedGstin, returnPeriod } })}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            Proceed to prepare GSTR-1
          </Button>
        )}
      </div>

      {/* Dashboard Area */}
      <div className="px-6 py-4 space-y-4">
        
        {!reconciliationGenerated ? (
          /* Empty/Initial Screen */
          <div className="flex flex-col items-center justify-center bg-white border rounded-lg py-32 text-center max-w-5xl mx-auto shadow-xs px-6">
            <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
              <RefreshCw className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No reconciliation result to show</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2 leading-relaxed">
              Run reconciliation to compare GSTR-1 e-invoices against local sales register data to find mismatches.
            </p>
            <Button 
              onClick={() => setDrawerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-5 shadow-sm mt-6 gap-2"
            >
              Run reconciliation <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          /* Reconciliation results grid */
          <div className="flex flex-col lg:flex-row gap-4">
            
            {/* Left Filter Sidebar for Document View */}
            {filterSidebarOpen && (
              <div className="w-[240px] shrink-0 bg-white border border-slate-200 rounded-lg flex flex-col p-4 shadow-sm h-fit">
                <div className="flex items-center justify-between border-b pb-2 mb-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Filter</h3>
                  <button onClick={() => setFilterSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
                     <X className="h-4 w-4" />
                  </button>
                </div>
                
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Search Filters</span>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-2.5">Document Type</span>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <Checkbox checked={filterInvoice} onCheckedChange={(c) => setFilterInvoice(c as boolean)} className="border-slate-300" />
                        <span className="text-xs font-medium text-slate-600">Invoice</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <Checkbox checked={filterCreditNote} onCheckedChange={(c) => setFilterCreditNote(c as boolean)} className="border-slate-300" />
                        <span className="text-xs font-medium text-slate-600">Credit Note</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <Checkbox checked={filterDebitNote} onCheckedChange={(c) => setFilterDebitNote(c as boolean)} className="border-slate-300" />
                        <span className="text-xs font-medium text-slate-600">Debit Note</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 my-4"></div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setFilterInvoice(true);
                      setFilterCreditNote(true);
                      setFilterDebitNote(true);
                    }}
                    className="flex-1 h-8 text-xs font-semibold text-slate-500"
                  >
                    Clear All
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      toast({ title: "Filters Applied", description: "Document view filtered successfully." });
                    }}
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-8 text-xs font-semibold"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 bg-white border border-slate-200 rounded-lg p-5 shadow-sm max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                  <span>Generated on Jun 7, 2026 12:20 AM</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setFilterSidebarOpen(!filterSidebarOpen)}
                    className="h-9 border-slate-200 text-slate-600 font-semibold text-xs gap-1.5 shadow-sm"
                  >
                    <Filter className="h-3.5 w-3.5" /> Filter
                  </Button>
                  
                  <Select value={selectedGstin} onValueChange={setSelectedGstin}>
                    <SelectTrigger className="w-[200px] h-9 border-slate-200 text-xs font-medium">
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {allWorkspaceBusinesses.map(biz => (
                        <SelectItem key={biz.id} value={biz.gstin} className="text-xs font-medium">
                          {biz.trade_name || 'Punjab'} ({biz.gstin})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={() => setDrawerOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Actions
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="summary" className="space-y-4">
                <TabsList className="bg-slate-50 border p-1 rounded-lg w-max mb-2">
                  <TabsTrigger value="summary" className="text-xs font-bold px-4 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-xs">Summary</TabsTrigger>
                  <TabsTrigger value="customer" className="text-xs font-bold px-4 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-xs">Customer View</TabsTrigger>
                  <TabsTrigger value="document" className="text-xs font-bold px-4 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-xs">Document View</TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary">
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <Table className="w-full text-left text-xs border-collapse">
                      <TableHeader className="bg-slate-50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-bold py-3 text-slate-700 pl-4 w-44">Match Type</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-center">No. of Docs (G1)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-center">No. of Docs (SR)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-right">Tax Value G1 (₹)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-right">Tax Value SR (₹)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-right">Tax Difference (₹)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-center">Actions Taken (%)</TableHead>
                          <TableHead className="font-bold py-3 text-slate-700 text-center pr-4">View Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryRows.map((row) => (
                          <TableRow 
                            key={row.id} 
                            className={`border-b border-slate-100 hover:bg-slate-50/40 ${row.isTotal ? 'bg-slate-50 font-bold border-t border-slate-200 hover:bg-slate-50' : ''}`}
                          >
                            <TableCell className={`py-3 pl-4 ${row.isChild ? 'pl-8 text-slate-500 font-medium' : 'font-bold text-slate-700'} ${row.id.startsWith('match') ? 'text-green-600' : row.id.startsWith('mis') ? 'text-orange-600 font-bold' : row.id.startsWith('missing') ? 'text-rose-600' : ''}`}>
                              {row.label} {row.isGroup && typeof row.percent === 'number' && `(${row.percent}%)`}
                            </TableCell>
                            <TableCell className="text-center font-medium py-3">{row.g1Docs}</TableCell>
                            <TableCell className="text-center font-medium py-3">{row.srDocs}</TableCell>
                            <TableCell className="text-right font-medium py-3">{formatCurrency(row.g1TaxVal)}</TableCell>
                            <TableCell className="text-right font-medium py-3">{formatCurrency(row.srTaxVal)}</TableCell>
                            <TableCell className="text-right font-medium py-3 text-rose-500">{formatCurrency(row.taxDiff)}</TableCell>
                            <TableCell className="text-center font-medium py-3 text-emerald-600">{row.actionsTaken}</TableCell>
                            <TableCell className="text-center py-3 pr-4">
                              {!row.isTotal && (
                                <button className="text-blue-600 font-bold hover:underline">View</button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Customer View Tab */}
                <TabsContent value="customer" className="space-y-3">
                  <div className="relative w-full max-w-sm mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search customer, GSTIN..."
                      value={searchDocTerm}
                      onChange={(e) => setSearchDocTerm(e.target.value)}
                      className="pl-9 h-8.5 text-xs border-slate-200"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-w-full">
                    <Table className="w-full text-left text-xs border-collapse min-w-[1500px]">
                      <TableHeader className="bg-slate-50 border-b select-none">
                        {/* Header Row 1 */}
                        <TableRow className="hover:bg-transparent border-b border-slate-200">
                          <TableHead rowSpan={2} className="font-bold py-3 text-slate-700 pl-4 border-r align-middle">Name</TableHead>
                          <TableHead rowSpan={2} className="font-bold py-3 text-slate-700 border-r align-middle">GSTIN</TableHead>
                          <TableHead colSpan={2} className="font-bold py-2 text-slate-700 text-center border-r">No. of Documents</TableHead>
                          <TableHead colSpan={3} className="font-bold py-2 text-slate-700 text-center border-r">Total Tax (₹)</TableHead>
                          <TableHead colSpan={2} className="font-bold py-2 text-slate-700 text-center border-r">Taxable Value (₹)</TableHead>
                          <TableHead colSpan={2} className="font-bold py-2 text-slate-700 text-center border-r">Total Document value</TableHead>
                          <TableHead colSpan={2} className="font-bold py-2 text-slate-700 text-center border-r">Match Status</TableHead>
                          <TableHead rowSpan={2} className="font-bold py-3 text-slate-700 text-center pr-4 align-middle">No Action Docs</TableHead>
                        </TableRow>
                        {/* Header Row 2 */}
                        <TableRow className="hover:bg-transparent">
                          {/* No. of Docs */}
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">G1</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">SR</TableHead>
                          {/* Total Tax */}
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">Tax Diff(G1-SR) (₹)</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">G1</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">SR</TableHead>
                          {/* Taxable Value */}
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">G1</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">SR</TableHead>
                          {/* Total Document Value */}
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">G1</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">SR</TableHead>
                          {/* Match Status */}
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">Missing in G1</TableHead>
                          <TableHead className="font-bold py-2 text-slate-600 text-center border-r text-[10px]">Missing in SR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={14} className="py-12 text-center bg-white">
                              <div className="flex flex-col items-center justify-center">
                                <FileX className="h-12 w-12 text-slate-300 mb-2" />
                                <p className="text-sm font-bold text-slate-800">No Results Found</p>
                                <p className="text-xs text-slate-400 mt-1">Please try a different search term.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCustomers.map((cust) => (
                            <TableRow key={cust.gstin} className="border-b border-slate-100 hover:bg-slate-50/20">
                              <TableCell className="font-semibold text-slate-700 py-3 pl-4 border-r">{cust.customer_name}</TableCell>
                              <TableCell className="font-mono text-[11px] text-slate-600 py-3 border-r">{cust.gstin}</TableCell>
                              {/* No of Docs */}
                              <TableCell className="text-center py-3 border-r font-medium">{cust.g1Docs}</TableCell>
                              <TableCell className="text-center py-3 border-r font-medium">{cust.srDocs}</TableCell>
                              {/* Total Tax */}
                              <TableCell className="text-right py-3 border-r font-medium text-rose-500">{formatCurrency(cust.taxDiff)}</TableCell>
                              <TableCell className="text-right py-3 border-r font-medium">{formatCurrency(cust.g1Tax)}</TableCell>
                              <TableCell className="text-right py-3 border-r font-medium">{formatCurrency(cust.srTax)}</TableCell>
                              {/* Taxable Value */}
                              <TableCell className="text-right py-3 border-r font-medium">{formatCurrency(cust.g1Taxable)}</TableCell>
                              <TableCell className="text-right py-3 border-r font-medium">{formatCurrency(cust.srTaxable)}</TableCell>
                              {/* Total Doc Value */}
                              <TableCell className="text-right py-3 border-r font-semibold">{formatCurrency(cust.g1DocVal)}</TableCell>
                              <TableCell className="text-right py-3 border-r font-semibold">{formatCurrency(cust.srDocVal)}</TableCell>
                              {/* Match Status */}
                              <TableCell className="text-center py-3 border-r">
                                <Badge className="bg-rose-50 text-rose-600 border border-rose-100 rounded-sm shadow-none font-semibold text-[10px]">{cust.missingG1}</Badge>
                              </TableCell>
                              <TableCell className="text-center py-3 border-r">
                                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 rounded-sm shadow-none font-semibold text-[10px]">{cust.missingSR}</Badge>
                              </TableCell>
                              <TableCell className="text-center py-3 pr-4 font-bold text-slate-800">{cust.noActionDocs}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Document View Tab */}
                <TabsContent value="document" className="space-y-3">
                  <div className="relative w-full max-w-sm mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search invoice, GSTIN, customer..."
                      value={searchDocTerm}
                      onChange={(e) => setSearchDocTerm(e.target.value)}
                      className="pl-9 h-8.5 text-xs border-slate-200"
                    />
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-w-full">
                    <Table className="w-full text-left text-xs border-collapse min-w-[3200px]">
                      <TableHeader className="bg-slate-50 border-b select-none">
                        {/* Header Row 1 */}
                        <TableRow className="hover:bg-transparent border-b border-slate-200">
                          <TableHead colSpan={3} className="text-center font-bold text-slate-700 border-r border-slate-200 py-2.5">Sources</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-slate-200 text-center py-2.5 align-middle">Match Status</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-slate-200 text-center py-2.5 align-middle">Mismatched Fields</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-slate-200 py-2.5 align-middle">Customer Name</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-slate-200 py-2.5">No. of Documents</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-slate-200 py-2.5">Taxable Value (₹)</TableHead>
                          <TableHead colSpan={3} className="text-center font-bold text-slate-700 border-r border-slate-200 py-2.5">Tax Value (₹)</TableHead>
                          
                          {/* Spanned headers under Tax Difference */}
                          <TableHead colSpan={29} className="text-center font-bold text-slate-700 border-r border-slate-200 py-2.5">Tax Difference</TableHead>
                        </TableRow>
                        
                        {/* Header Row 2 */}
                        <TableRow className="hover:bg-transparent border-b border-slate-200">
                          {/* Under Sources */}
                          <TableHead className="font-bold text-slate-700 border-r border-b border-slate-200 py-2 w-10 text-center">
                            <Checkbox className="rounded-xs border-slate-300" />
                          </TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">Document No.</TableHead>
                          {/* Under No. of Documents (actually this corresponds to Customer GSTIN) */}
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">Customer GSTIN</TableHead>
                          {/* Under Taxable Value (₹) (actually this corresponds to My GSTIN) */}
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">My GSTIN</TableHead>
                          {/* Under Tax Value (₹) (actually this corresponds to EInv Details) */}
                          <TableHead colSpan={3} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">EInv Details</TableHead>
                          
                          {/* Under Tax Difference */}
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">Tax Amount(₹)</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">Taxable Value(₹)</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">Total Document value</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">FY</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Return Period</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Document Date</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Document Type</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Document Section</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Reverse Charge</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">POS</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Original Document Number</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Original Document Date</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Shipping Bill Number</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Port Number</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Shipping Bill date</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">IGST</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">CGST</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">SGST</TableHead>
                          <TableHead colSpan={2} className="text-center font-bold text-slate-700 border-r border-b border-slate-200 py-2">CESS</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">Action</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 border-r border-b border-slate-200 text-center py-2.5 align-middle">G1 Filing Status</TableHead>
                          <TableHead rowSpan={2} className="font-bold text-slate-700 pr-4 py-2.5 align-middle">Remarks</TableHead>
                        </TableRow>
                        
                        {/* Header Row 3 */}
                        <TableRow className="hover:bg-transparent">
                          {/* Under Document No */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under Customer GSTIN */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under My GSTIN */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under EInv Details */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">IRN (G1)</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">IRN (Sales)</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">IRN Date</TableHead>
                          
                          {/* Under Tax Amount */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under Taxable Value */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under Total Doc Value */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          
                          {/* Under IGST */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under CGST */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under SGST */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                          {/* Under CESS */}
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">G1</TableHead>
                          <TableHead className="text-center font-bold text-slate-500 border-r py-1 text-[10px]">SR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={42} className="py-12 text-center bg-white">
                              <div className="flex flex-col items-center justify-center">
                                <FileX className="h-12 w-12 text-slate-300 mb-2" />
                                <p className="text-sm font-bold text-slate-800">No Results Found</p>
                                <p className="text-xs text-slate-400 mt-1">Please try a different search term.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInvoices.map((doc) => {
                            const isG1 = doc.status !== 'missing_in_g1';
                            const isSR = doc.status !== 'missing_in_sr';

                            const g1DocNo = isG1 ? doc.invoice_number : '-';
                            const srDocNo = isSR ? doc.invoice_number : '-';

                            const g1Gstin = isG1 ? doc.gstin : '-';
                            const srGstin = isSR ? doc.gstin : '-';

                            const g1MyGstin = isG1 ? selectedGstin : '-';
                            const srMyGstin = isSR ? selectedGstin : '-';

                            const irnG1 = isG1 ? `IRN-${doc.invoice_number.replace(/\//g, '')}` : '-';
                            const irnSales = isSR ? `IRN-${doc.invoice_number.replace(/\//g, '')}` : '-';
                            const irnDate = isSR ? `12-Jun-2026` : '-';

                            const g1Tax = isG1 ? (doc.igst + doc.cgst + doc.sgst) : 0;
                            const srTax = isSR ? (doc.status === 'mismatch' ? (doc.igst + doc.cgst + doc.sgst) + 8.1 : (doc.igst + doc.cgst + doc.sgst)) : 0;

                            const g1Taxable = isG1 ? doc.taxable_value : 0;
                            const srTaxable = isSR ? (doc.status === 'mismatch' ? doc.taxable_value + 45 : doc.taxable_value) : 0;

                            const g1DocVal = g1Taxable + g1Tax;
                            const srDocVal = srTaxable + srTax;

                            const igstG1 = isG1 ? doc.igst : 0;
                            const igstSR = isSR ? doc.igst : 0;

                            const cgstG1 = isG1 ? doc.cgst : 0;
                            const cgstSR = isSR ? (doc.status === 'mismatch' ? doc.cgst + 4.05 : doc.cgst) : 0;

                            const sgstG1 = isG1 ? doc.sgst : 0;
                            const sgstSR = isSR ? (doc.status === 'mismatch' ? doc.sgst + 4.05 : doc.sgst) : 0;

                            return (
                              <TableRow key={doc.id} className="border-b border-slate-100 hover:bg-slate-50/20">
                                {/* checkbox */}
                                <TableCell className="border-r py-2 w-10 text-center">
                                  <Checkbox className="rounded-xs border-slate-300" />
                                </TableCell>
                                {/* Document No G1, SR */}
                                <TableCell className="border-r py-2 font-medium text-slate-800 text-center">{g1DocNo}</TableCell>
                                <TableCell className="border-r py-2 font-medium text-slate-800 text-center">{srDocNo}</TableCell>
                                {/* Match Status */}
                                <TableCell className="border-r py-2 text-center">
                                  {doc.status === 'matched' ? (
                                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-sm shadow-none text-[10px] font-bold">Matched</Badge>
                                  ) : doc.status === 'suggested_match' ? (
                                    <Badge className="bg-teal-50 text-teal-600 border border-teal-100 rounded-sm shadow-none text-[10px] font-bold">Suggested</Badge>
                                  ) : doc.status === 'mismatch' ? (
                                    <Badge className="bg-amber-50 text-amber-600 border border-amber-100 rounded-sm shadow-none text-[10px] font-bold">Mismatch</Badge>
                                  ) : doc.status === 'missing_in_g1' ? (
                                    <Badge className="bg-rose-50 text-rose-600 border border-rose-100 rounded-sm shadow-none text-[10px] font-bold">Missing in G1</Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 rounded-sm shadow-none text-[10px] font-bold">Missing in SR</Badge>
                                  )}
                                </TableCell>
                                {/* Mismatched Fields */}
                                <TableCell className="border-r py-2 text-center font-medium text-amber-600 text-[11px]">{doc.status === 'mismatch' ? 'Tax Amount' : '-'}</TableCell>
                                {/* Customer Name */}
                                <TableCell className="border-r py-2 font-semibold text-slate-700 max-w-[200px] truncate">{doc.customer_name}</TableCell>
                                {/* Customer GSTIN G1, SR */}
                                <TableCell className="border-r py-2 font-mono text-[11px] text-slate-500 text-center">{g1Gstin}</TableCell>
                                <TableCell className="border-r py-2 font-mono text-[11px] text-slate-500 text-center">{srGstin}</TableCell>
                                {/* My GSTIN G1, SR */}
                                <TableCell className="border-r py-2 font-mono text-[11px] text-slate-500 text-center">{g1MyGstin}</TableCell>
                                <TableCell className="border-r py-2 font-mono text-[11px] text-slate-500 text-center">{srMyGstin}</TableCell>
                                {/* EInv Details (IRN G1, Sales, Date) */}
                                <TableCell className="border-r py-2 font-mono text-[10px] text-slate-400 text-center max-w-[150px] truncate">{irnG1}</TableCell>
                                <TableCell className="border-r py-2 font-mono text-[10px] text-slate-400 text-center max-w-[150px] truncate">{irnSales}</TableCell>
                                <TableCell className="border-r py-2 text-slate-400 text-center">{irnDate}</TableCell>
                                {/* Tax Amount G1, SR */}
                                <TableCell className="border-r py-2 text-right font-medium">{formatCurrency(g1Tax)}</TableCell>
                                <TableCell className="border-r py-2 text-right font-medium">{formatCurrency(srTax)}</TableCell>
                                {/* Taxable Value G1, SR */}
                                <TableCell className="border-r py-2 text-right font-medium">{formatCurrency(g1Taxable)}</TableCell>
                                <TableCell className="border-r py-2 text-right font-medium">{formatCurrency(srTaxable)}</TableCell>
                                {/* Total Doc Value G1, SR */}
                                <TableCell className="border-r py-2 text-right font-semibold">{formatCurrency(g1DocVal)}</TableCell>
                                <TableCell className="border-r py-2 text-right font-semibold">{formatCurrency(srDocVal)}</TableCell>
                                {/* FY, Period, Doc Date, Doc Type, Section, Rev, POS, Orig Doc, Orig Date, Shipping, Port, Ship Date */}
                                <TableCell className="border-r py-2 text-center text-slate-500">2026-27</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">062026</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">{doc.invoice_date}</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">{doc.document_type}</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">B2B</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">N</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500 font-medium">03-Punjab</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">-</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">-</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">-</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">-</TableCell>
                                <TableCell className="border-r py-2 text-center text-slate-500">-</TableCell>
                                {/* IGST G1, SR */}
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(igstG1)}</TableCell>
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(igstSR)}</TableCell>
                                {/* CGST G1, SR */}
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(cgstG1)}</TableCell>
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(cgstSR)}</TableCell>
                                {/* SGST G1, SR */}
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(sgstG1)}</TableCell>
                                <TableCell className="border-r py-2 text-right text-slate-600">{formatCurrency(sgstSR)}</TableCell>
                                {/* CESS G1, SR */}
                                <TableCell className="border-r py-2 text-right text-slate-600">₹0.00</TableCell>
                                <TableCell className="border-r py-2 text-right text-slate-600">₹0.00</TableCell>
                                {/* Action */}
                                <TableCell className="border-r py-2 text-center">
                                  <select className="border border-slate-200 text-[10px] font-bold rounded-sm px-1 py-0.5 text-blue-600 bg-white">
                                    <option>Accept Match</option>
                                    <option>Reject</option>
                                    <option>Keep Pending</option>
                                  </select>
                                </TableCell>
                                {/* G1 Filing Status */}
                                <TableCell className="border-r py-2 text-center font-bold text-emerald-600">Filed</TableCell>
                                {/* Remarks */}
                                <TableCell className="py-2 pr-4 text-slate-500 text-[11px]">{doc.remarks}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Run Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => !reconcilingStatus && setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-[450px] bg-white dark:bg-slate-800 shadow-xl flex flex-col h-full">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Run Reconciliation</h2>
                <button 
                  disabled={reconcilingStatus}
                  onClick={() => setDrawerOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Progress Indicator */}
              {!reconcilingStatus && (
                <div className="px-6 pt-5 shrink-0">
                  <div className="bg-amber-50 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 w-max rounded-sm mb-3">
                    Step {wizardStep} of 4
                  </div>
                </div>
              )}

              {/* Step Content */}
              <div className="flex-1 overflow-y-auto px-6 py-2">
                {reconcilingStatus ? (
                  /* Loading Progress UI */
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-sm font-bold text-slate-800">Reconciliation Run In Progress</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Matching local sales register invoices against GSTR-1 returns.
                    </p>
                    <div className="w-64 mt-6">
                      <Progress value={reconcilingProgress} className="h-1.5" />
                      <span className="text-[10px] font-bold text-slate-400 mt-2 block">{reconcilingProgress}% Completed</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {wizardStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Business (PAN/GSTIN) <span className="text-red-500">*</span>
                          </label>
                          <Select value={drawerGstin} onValueChange={setDrawerGstin}>
                            <SelectTrigger className="w-full h-10 border-slate-200 text-xs">
                              <SelectValue placeholder="Select business" />
                            </SelectTrigger>
                            <SelectContent>
                              {allWorkspaceBusinesses.map(biz => (
                                <SelectItem key={biz.id} value={biz.gstin} className="text-xs">
                                  {biz.trade_name || 'Punjab'} ({biz.gstin})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            SR Return Period <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <Input value={srPeriodStart} onChange={(e) => setSrPeriodStart(e.target.value)} className="h-10 text-xs text-slate-700 border-slate-200" />
                            <span className="text-slate-400 text-xs">→</span>
                            <Input value={srPeriodEnd} onChange={(e) => setSrPeriodEnd(e.target.value)} className="h-10 text-xs text-slate-700 border-slate-200" />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            G1 Return Period <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <Input value={g1PeriodStart} onChange={(e) => setG1PeriodStart(e.target.value)} className="h-10 text-xs text-slate-700 border-slate-200" />
                            <span className="text-slate-400 text-xs">→</span>
                            <Input value={g1PeriodEnd} onChange={(e) => setG1PeriodEnd(e.target.value)} className="h-10 text-xs text-slate-700 border-slate-200" />
                          </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="space-y-4">
                        <div className="text-center py-6">
                          <Shield className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                          <h3 className="text-sm font-bold text-slate-800">Connect GSTINs to Download G1 data</h3>
                          <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed mx-auto">
                            Verify your credentials or request OTP via the official GST portal to download e-invoices directly.
                          </p>
                        </div>

                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600">GSTIN</span>
                            <span className="font-mono text-slate-700">{drawerGstin}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs border-t pt-2.5">
                            <span className="font-bold text-slate-600">Portal Username</span>
                            <span className="font-medium text-slate-700">user_{drawerGstin.slice(2, 6)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Import Sales register</h3>
                          <p className="text-xs text-slate-500 mt-1">Import Sales register to run reconciliation</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Return Period</span>
                            <span className="font-bold text-slate-700">Jun'2026 → Jun'2026</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">GSTIN</span>
                            <span className="font-mono font-bold text-slate-700">1</span>
                          </div>
                        </div>

                        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors rounded-lg p-6 text-center bg-slate-50/20">
                          <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                          <span className="text-xs font-bold text-slate-700 block mb-1">Import SR via excel</span>
                          <span className="text-[10px] text-slate-400 block mb-4">Upload local sales register Excel workbook</span>
                          
                          {excelUploaded ? (
                            <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 py-1.5 px-3 rounded-md w-max mx-auto text-xs font-semibold">
                              <CheckCircle className="h-4 w-4" /> {uploadedFileName}
                            </div>
                          ) : (
                            <Button 
                              onClick={() => {
                                setExcelUploaded(true);
                                setUploadedFileName('Sales_Register_Jun2026.xlsx');
                                toast({ title: "File Selected", description: "Sales_Register_Jun2026.xlsx loaded." });
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 shadow-sm"
                            >
                              Import
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {wizardStep === 4 && (
                      <div className="space-y-4">
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3 text-xs">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-600">Business (PAN/GSTIN)</span>
                            <span className="font-semibold text-slate-700 text-right">
                              {allWorkspaceBusinesses.find(b => b.gstin === drawerGstin)?.trade_name || 'Punjab'} ({drawerGstin})
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2.5">
                            <span className="font-bold text-slate-600">SR Return Period</span>
                            <span className="font-semibold text-slate-700">{srPeriodStart} → {srPeriodEnd}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2.5">
                            <span className="font-bold text-slate-600">G1 Return Period</span>
                            <span className="font-semibold text-slate-700">{g1PeriodStart} → {g1PeriodEnd}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer Buttons */}
              {!reconcilingStatus && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800">
                  {wizardStep > 1 ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setWizardStep(prev => prev - 1)}
                      className="h-10 font-semibold text-xs text-slate-600 dark:text-slate-300 border-slate-200"
                    >
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {wizardStep === 1 && (
                    <Button 
                      onClick={() => setWizardStep(2)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 w-full shadow-sm"
                    >
                      Download Data from GSTN
                    </Button>
                  )}

                  {wizardStep === 2 && (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setWizardStep(3)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-2"
                      >
                        skip
                      </button>
                      <Button 
                        onClick={() => setWizardStep(3)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 shadow-sm"
                      >
                        Next: 'Import Sales Register'
                      </Button>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <Button 
                      onClick={() => {
                        if (!excelUploaded) {
                          toast({ title: "Excel Required", description: "Please upload your sales register excel to continue.", variant: "destructive" });
                          return;
                        }
                        setWizardStep(4);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 shadow-sm"
                    >
                      Review Reconciliation Parameters
                    </Button>
                  )}

                  {wizardStep === 4 && (
                    <Button 
                      onClick={handleTriggerReconciliation}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 shadow-sm"
                    >
                      Run Reconciliation
                    </Button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
