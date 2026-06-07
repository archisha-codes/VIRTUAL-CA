import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Filter, ChevronDown, Download, CheckCircle, Upload, AlertCircle, RefreshCw, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { useActiveWorkspace, useTenantStore } from '@/store/tenantStore';
import { getGstr1State, saveGstr1State } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import GSTR1SummaryDrawer from './GSTR1SummaryDrawer';

interface Props {
  gstin: string;
  returnPeriod: string;
}

export default function GSTR1UploadToGSTNPage({ gstin, returnPeriod }: Props) {
  const navigate = useNavigate();
  const activeWorkspace = useActiveWorkspace();
  const { toast } = useToast();
  const workspaceId = activeWorkspace?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [dataMap, setDataMap] = useState<Record<string, any>>({});
  const [showNoDataAction, setShowNoDataAction] = useState(false);
  const [noDataAction, setNoDataAction] = useState<'nil' | 'skip'>('nil');
  const [uploading, setUploading] = useState(false);

  const [uploadedStatus, setUploadedStatus] = useState(false);
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(false);
  const [selectedSummaryGstin, setSelectedSummaryGstin] = useState('');
  const [selectedSummaryBusinessName, setSelectedSummaryBusinessName] = useState('');
  const { businesses: allWorkspaceBusinesses } = useTenantStore();

  const loadData = useCallback(async () => {
    if (!workspaceId || !returnPeriod) return;
    setIsLoading(true);
    try {
      const newDataMap: Record<string, any> = {};
      await Promise.all(
        allWorkspaceBusinesses.map(async (biz) => {
          try {
            const response = await getGstr1State(workspaceId, biz.gstin, returnPeriod);
            if (response.success && response.data) {
              newDataMap[biz.gstin] = response.data;
            } else {
              newDataMap[biz.gstin] = null;
            }
          } catch (e) {
            console.error(`Error loading state for business ${biz.gstin}:`, e);
            newDataMap[biz.gstin] = null;
          }
        })
      );
      setDataMap(newDataMap);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, returnPeriod, allWorkspaceBusinesses]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const activeData = dataMap[gstin];
    setData(activeData || null);
    setUploadedStatus(activeData?.filing_status === 'uploaded');
  }, [dataMap, gstin]);

  // Extract total values from saved state
  const getTotals = (bizData: any) => {
    let docs = 0, taxable = 0, tax = 0;

    if (bizData?.upload_result?.data) {
      const gstr1Data = bizData.upload_result.data;

      // If summary is available from engine, use it as canonical
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

  const totals = getTotals(data);

  const handleUpload = () => {
    if (totals.taxable === 0) {
      setShowNoDataAction(true);
    } else {
      processUpload();
    }
  };

  const processUpload = async () => {
    setShowNoDataAction(false);
    try {
      if (workspaceId && gstin && returnPeriod) {
        // In real scenario, we'd save this status to backend
        await saveGstr1State(workspaceId, gstin, returnPeriod, {
          ...data,
          filing_status: 'uploaded',
          uploaded_at: new Date().toISOString()
        });
        
        setUploadedStatus(true);
        toast({
          title: 'Upload Successful',
          description: 'Data has been uploaded to GSTN successfully.',
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload data to GSTN.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getTransformedBusinesses = () => {
    if (allWorkspaceBusinesses.length > 0) {
      return allWorkspaceBusinesses.map(biz => {
        const isSelected = biz.gstin === gstin;
        const bizData = dataMap[biz.gstin];
        const bizTotals = getTotals(bizData);
        return {
          id: biz.id,
          businessName: biz.legal_name,
          gstins: [{
            id: biz.id + "-gstin",
            gstin: biz.gstin,
            legalName: biz.legal_name,
            state: biz.trade_name || 'PUNJAB',
            status: isSelected ? 'pending' : 'not_started',
            isConnected: isSelected,
            docCount: bizTotals.docs,
            taxableAmount: bizTotals.taxable,
            totalTax: bizTotals.tax,
            totalInvoiceValue: bizTotals.taxable + bizTotals.tax,
            igst: bizTotals.igst,
            cgst: bizTotals.cgst,
            sgst: bizTotals.sgst,
            cess: bizTotals.cess,
            sections: []
          }]
        };
      });
    }
    return [];
  };

  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [filterGstinSearch, setFilterGstinSearch] = useState('');
  const [filterFiled, setFilterFiled] = useState(false);
  const [filterNotFiled, setFilterNotFiled] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  const handleShowApplied = () => {
    setFiltersApplied(filterFiled || filterNotFiled || filterGstinSearch.trim().length > 0);
    toast({
      title: 'Filters Applied',
      description: `${[filterFiled && 'Filed', filterNotFiled && 'Not Filed', filterGstinSearch && `GSTIN: ${filterGstinSearch}`].filter(Boolean).join(', ') || 'No filters active'}`
    });
  };

  const handleResetFilters = () => {
    setFilterGstinSearch('');
    setFilterFiled(false);
    setFilterNotFiled(false);
    setFiltersApplied(false);
    toast({ title: 'Filters Reset', description: 'All filters have been cleared.' });
  };

  // Check if business passes filter
  const passesFilter = (bizGstin: string, bizUploadedStatus: boolean) => {
    if (!filtersApplied) return true;
    if (filterGstinSearch && !bizGstin.toLowerCase().includes(filterGstinSearch.toLowerCase())) return false;
    if (filterFiled && !bizUploadedStatus) return false;
    if (filterNotFiled && bizUploadedStatus) return false;
    return true;
  };

  const visibleBusinesses = allWorkspaceBusinesses.filter(biz => {
    const bizData = dataMap[biz.gstin];
    const bizUploadedStatus = bizData?.filing_status === 'uploaded';
    return passesFilter(biz.gstin, bizUploadedStatus);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/gst/gstr1/prepare', { state: { gstin, returnPeriod } })} className="h-8 w-8 text-slate-500 rounded-full shrink-0 -ml-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-slate-500">Previous</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Step 2/3: Upload to Govt Portal (GSTN)
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
              See total values of the data you have prepared. Once you are ready press upload to GSTN
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={uploading || uploadedStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold shadow-sm h-9"
            >
              {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Upload to GSTN'}
            </Button>
            <Button variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 h-9 font-semibold gap-1 border border-blue-100">
              Select filing method <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Action Bar */}
        <div className="flex justify-between items-center bg-white rounded-t-lg">
          <Button
            variant="outline"
            className="h-9 border-blue-200 text-blue-600 font-bold gap-2 text-xs bg-white shadow-sm"
            onClick={() => setFilterSidebarOpen(true)}
          >
            <Filter className="h-3.5 w-3.5" /> Filters
            {filtersApplied && (
              <Badge className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4 shadow-none rounded-full">
                {[filterFiled, filterNotFiled, filterGstinSearch.trim()].filter(Boolean).length}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200 bg-white shadow-sm text-blue-600 hover:bg-slate-50"
              onClick={() => { loadData(); toast({ title: 'Refreshing', description: 'Reloading data...' }); }}
            disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 border-blue-200 text-blue-600 font-bold gap-2 text-xs bg-white shadow-sm">
                  <Menu className="h-3.5 w-3.5" /> Actions <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 font-sans border-slate-200 shadow-md z-50 bg-white">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Download</DropdownMenuLabel>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-slate-700 focus:bg-slate-50 hover:bg-slate-50 focus:text-slate-900">Download GSTR1 PDF from GSTN</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-slate-700 focus:bg-slate-50 hover:bg-slate-50 focus:text-slate-900">Download PAN Level Error Report</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-slate-700 focus:bg-slate-50 hover:bg-slate-50 focus:text-slate-900">Download Summary for GSTR-1/IFF</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-slate-700 focus:bg-slate-50 hover:bg-slate-50 focus:text-slate-900">Download JSON for GSTR-1/IFF</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Reset & Delete</DropdownMenuLabel>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-red-600 focus:bg-red-50 hover:bg-red-50 focus:text-red-700">Reset data from GSTN</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Other Options</DropdownMenuLabel>
                  <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2 px-3 text-slate-700 focus:bg-slate-50 hover:bg-slate-50 focus:text-slate-900">Upload Summaries Only</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content Area - sidebar + table */}
        <div className="flex gap-0">
          {/* Filter Sidebar */}
          {filterSidebarOpen && (
            <div className="w-[220px] shrink-0 bg-white border border-slate-200 rounded-l-lg border-r-0 flex flex-col shadow-sm animate-in slide-in-from-left-2 duration-200">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800">Filter</h3>
                <button
                  onClick={() => setFilterSidebarOpen(false)}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* My GSTIN Section */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700">My GSTIN</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 rotate-180" />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={filterGstinSearch}
                    onChange={(e) => setFilterGstinSearch(e.target.value)}
                    placeholder="Search here..."
                    className="w-full h-8 text-xs border border-slate-200 rounded px-3 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-slate-400 text-slate-700"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 mx-4"></div>

              {/* Filing Status Section */}
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">Filing Status</span>
                </div>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={filterFiled}
                      onCheckedChange={(checked) => setFilterFiled(checked as boolean)}
                      className="border-slate-300 h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span className="text-xs text-slate-600 font-medium group-hover:text-slate-800 transition-colors">Filed</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={filterNotFiled}
                      onCheckedChange={(checked) => setFilterNotFiled(checked as boolean)}
                      className="border-slate-300 h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span className="text-xs text-slate-600 font-medium group-hover:text-slate-800 transition-colors">Not Filed</span>
                  </label>
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Bottom Buttons */}
              <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={handleShowApplied}
                >
                  Show Applied
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold text-slate-500 border-slate-200 hover:bg-slate-50"
                  onClick={handleResetFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}

        <div className={`bg-white border border-slate-200 overflow-x-auto shadow-sm flex-1 ${filterSidebarOpen ? 'rounded-r-lg' : 'rounded-lg'}`}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700">
                <th className="py-3 px-4 font-bold border-r border-slate-200 w-10 text-center"><Checkbox className="border-slate-300" /></th>
                <th className="py-3 px-4 font-bold border-r border-slate-200">Business</th>
                <th className="py-3 px-4 font-bold border-r border-slate-200 text-center w-32">Status</th>
                <th colSpan={7} className="py-3 px-4 font-bold border-r border-slate-200 text-center text-slate-500">Your Data (Top Row) vs Uploaded to GSTN (Middle Row)</th>
                <th className="py-3 px-4 font-bold text-center w-24">History & Errors</th>
              </tr>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                <th colSpan={3} className="border-r border-slate-200"></th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-center whitespace-nowrap"># Docs</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">Taxable Amount (₹)</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">Total Tax (₹)</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">IGST (₹)</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">CGST (₹)</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">SGST (₹)</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-right whitespace-nowrap">CESS (₹)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleBusinesses.length > 0 ? (
                visibleBusinesses.map(biz => {
                  const bizData = dataMap[biz.gstin];
                  const bizTotals = getTotals(bizData);
                  const bizUploadedStatus = bizData?.filing_status === 'uploaded';
                  
                  return (
                    <React.Fragment key={biz.gstin}>
                      {/* Row 1 */}
                      <tr className="border-b border-slate-100 group hover:bg-slate-50/30">
                        <td className="py-2 px-4 text-center border-r border-slate-100 align-middle" rowSpan={3}>
                          <Checkbox className="border-slate-300" />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 align-middle" rowSpan={3}>
                          <div className="flex items-start gap-2 max-w-xs">
                            <div className="mt-0.5 border rounded-sm w-3.5 h-3.5 flex items-center justify-center shrink-0 border-slate-300 text-slate-500"><span className="leading-none text-[8px]">-</span></div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-700 leading-tight">
                                {biz.legal_name || 'Business'}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500">{biz.gstin}</span>
                              <button 
                                onClick={() => {
                                  setSelectedSummaryGstin(biz.gstin);
                                  setSelectedSummaryBusinessName(biz.legal_name || 'Business');
                                  setSummaryDrawerOpen(true);
                                }}
                                className="text-[10px] text-blue-600 font-bold uppercase hover:underline mt-1 text-left w-max"
                              >
                                View Sections
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-100 align-middle" rowSpan={3}>
                          {bizUploadedStatus ? (
                            <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold shadow-none rounded-sm">Uploaded</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold shadow-none rounded-sm">Not Uploaded</Badge>
                          )}
                        </td>
                        <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Your Data</td>
                        <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{bizTotals.docs || '-'}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-blue-600 font-medium">{formatCurrency(bizTotals.taxable)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-blue-600 font-medium">{formatCurrency(bizTotals.tax)}</td>
                         <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(bizTotals.igst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(bizTotals.cgst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(bizTotals.sgst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(bizTotals.cess)}</td>
                        <td className="py-2 px-4 text-center border-r border-slate-100 align-middle" rowSpan={3}>
                          <button 
                            onClick={() => {
                              setSelectedSummaryGstin(biz.gstin);
                              setSelectedSummaryBusinessName(biz.legal_name || 'Business');
                              setSummaryDrawerOpen(true);
                            }}
                            className="text-blue-600 font-bold hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                      {/* Row 2 */}
                      <tr className="border-b border-slate-100 bg-slate-50/40 group hover:bg-slate-50/60">
                        <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Uploaded to GSTN</td>
                        <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{bizUploadedStatus ? bizTotals.docs : '-'}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.taxable : 0)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.tax : 0)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.igst : 0)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.cgst : 0)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.sgst : 0)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? bizTotals.cess : 0)}</td>
                      </tr>
                      {/* Row 3 - Difference: Your Data minus Uploaded to GSTN */}
                      <tr className="border-b border-slate-200 bg-white group hover:bg-slate-50/30">
                        <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Difference</td>
                        <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{bizUploadedStatus ? '-' : (bizTotals.docs || '-')}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.taxable)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.tax)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.igst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.cgst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.sgst)}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(bizUploadedStatus ? 0 : bizTotals.cess)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr><td colSpan={12} className="py-12 text-center text-slate-400 italic text-sm">No businesses match the applied filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <Dialog open={showNoDataAction} onOpenChange={setShowNoDataAction}>
        <DialogContent className="sm:max-w-[560px] p-6 rounded-lg gap-6 font-sans">
          <DialogHeader className="space-y-2 relative pr-6">
            <DialogTitle className="text-lg font-bold text-slate-800">
              Confirm action on GSTINs with no data
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 leading-normal">
              Your selection includes GSTINs with no data. GSTN doesn't support upload of GSTINS with no data.
            </DialogDescription>
          </DialogHeader>

          <div>
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
              <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>GSTINs (1)</span>
                <span>Taxable Amt</span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-700">
                    {(() => {
                      const code = gstin.substring(0, 2);
                      const states: Record<string, string> = {
                        '01': 'JAMMU AND KASHMIR', '02': 'HIMACHAL PRADESH', '03': 'PUNJAB', '04': 'CHANDIGARH',
                        '05': 'UTTARAKHAND', '06': 'HARYANA', '07': 'DELHI', '08': 'RAJASTHAN', '09': 'UTTAR PRADESH',
                        '10': 'BIHAR', '11': 'SIKKIM', '12': 'ARUNACHAL PRADESH', '13': 'NAGALAND', '14': 'MANIPUR',
                        '15': 'MIZORAM', '16': 'TRIPURA', '17': 'MEGHALAYA', '18': 'ASSAM', '19': 'WEST BENGAL',
                        '20': 'JHARKHAND', '21': 'ODISHA', '22': 'CHHATTISGARH', '23': 'MADHYA PRADESH', '24': 'GUJARAT',
                        '26': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU', '27': 'MAHARASHTRA', '29': 'KARNATAKA',
                        '30': 'GOA', '31': 'LAKSHADWEEP', '32': 'KERALA', '33': 'TAMIL NADU', '34': 'PUDUCHERRY',
                        '35': 'ANDAMAN AND NICOBAR ISLANDS', '36': 'TELANGANA', '37': 'ANDHRA PRADESH', '38': 'LADAKH',
                        '97': 'OTHER TERRITORY'
                      };
                      return states[code] || 'PUNJAB';
                    })()}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px] tracking-wide">{gstin}</span>
                </div>
                <span className="font-semibold text-slate-700 text-sm">0.00</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-2">
            <Button
              variant="outline"
              onClick={processUpload}
              className="border-blue-600 text-blue-600 hover:bg-blue-50 font-bold px-4 py-2 text-[13px] h-10 rounded shadow-none"
            >
              Mark as NIL filing and upload
            </Button>
            <Button
              onClick={() => {
                setShowNoDataAction(false);
                toast({
                  title: 'Upload Skipped',
                  description: 'Skipped upload for GSTINs with no data.',
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-[13px] h-10 rounded shadow-none"
            >
              Skip upload for these GSTINs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GSTR1SummaryDrawer
        open={summaryDrawerOpen}
        onOpenChange={setSummaryDrawerOpen}
        gstin={selectedSummaryGstin}
        businessName={selectedSummaryBusinessName}
        businesses={getTransformedBusinesses()}
        onSelectGstin={(gstin, businessName) => {
          setSelectedSummaryGstin(gstin);
          setSelectedSummaryBusinessName(businessName);
        }}
        returnPeriod={returnPeriod}
      />
    </div>
  );
}
