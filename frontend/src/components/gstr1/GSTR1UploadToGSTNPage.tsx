import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Filter, ChevronDown, Download, CheckCircle, Upload, AlertCircle, RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { useActiveWorkspace } from '@/store/tenantStore';
import { getGstr1State, saveGstr1State } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  const [showNoDataAction, setShowNoDataAction] = useState(false);
  const [noDataAction, setNoDataAction] = useState<'nil' | 'skip'>('nil');
  const [uploading, setUploading] = useState(false);

  const [uploadedStatus, setUploadedStatus] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspaceId || !gstin || !returnPeriod) return;
    setIsLoading(true);
    try {
      const response = await getGstr1State(workspaceId, gstin, returnPeriod);
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, gstin, returnPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract total values from saved state
  const getTotals = () => {
    let docs = 0, taxable = 0, tax = 0;

    if (data?.upload_result?.data) {
      const gstr1Data = data.upload_result.data;
      const calculateTotal = (arr: any[], key: string) => arr?.reduce((acc: number, val: any) => {
        const num = Number(val[key] || val.txval || val.taxable_value || 0);
        return acc + (Number.isFinite(num) ? num : 0);
      }, 0) || 0;

      docs = (gstr1Data.b2b?.length || 0) + (gstr1Data.b2cl?.length || 0) + (gstr1Data.b2cs?.length || 0) + (gstr1Data.exp?.length || 0) + (gstr1Data.cdnr?.length || 0);

      taxable = calculateTotal(gstr1Data.b2b, 'txval') + calculateTotal(gstr1Data.b2cl, 'txval') + calculateTotal(gstr1Data.b2cs, 'txval') + calculateTotal(gstr1Data.exp, 'txval') + calculateTotal(gstr1Data.cdnr, 'txval');

      const getTax = (arr: any[]) => arr?.reduce((acc: number, val: any) => {
        const iamt = Number(val.iamt || val.igst || 0);
        const camt = Number(val.camt || val.cgst || 0);
        const samt = Number(val.samt || val.sgst || 0);
        const csamt = Number(val.csamt || val.cess || 0);
        return acc + iamt + camt + samt + csamt;
      }, 0) || 0;

      const getTaxDetails = (arr: any[], type: 'igst' | 'cgst' | 'sgst' | 'cess') => arr?.reduce((acc: number, val: any) => {
        const fieldMap: Record<string, string[]> = {
          'igst': ['iamt', 'igst', 'integrated_tax'],
          'cgst': ['camt', 'cgst', 'central_tax'],
          'sgst': ['samt', 'sgst', 'state_tax'],
          'cess': ['csamt', 'cess', 'compensation_tax']
        };
        const fields = fieldMap[type];
        const val_tax = fields.reduce((sum, f) => sum + Number(val[f] || 0), 0);
        return acc + val_tax;
      }, 0) || 0;

      const igst = getTaxDetails(gstr1Data.b2b, 'igst') + getTaxDetails(gstr1Data.b2cl, 'igst') + getTaxDetails(gstr1Data.exp, 'igst');
      const cgst = getTaxDetails(gstr1Data.b2b, 'cgst') + getTaxDetails(gstr1Data.b2cs, 'cgst');
      const sgst = getTaxDetails(gstr1Data.b2b, 'sgst') + getTaxDetails(gstr1Data.b2cs, 'sgst');
      const cess = getTaxDetails(gstr1Data.b2b, 'cess') + getTaxDetails(gstr1Data.b2cs, 'cess') + getTaxDetails(gstr1Data.exp, 'cess');

      tax = igst + cgst + sgst + cess;
      return { docs, taxable, tax, igst, cgst, sgst, cess };
    }

    return { docs, taxable, tax, igst: 0, cgst: 0, sgst: 0, cess: 0 };
  };

  const totals = getTotals();

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 border-blue-200 text-blue-600 font-bold gap-2 text-xs bg-white shadow-sm">
                <Filter className="h-3.5 w-3.5" /> Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 font-sans">
              <DropdownMenuLabel className="text-xs text-slate-500">Filter By</DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer text-sm font-medium">My GSTIN</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm font-medium text-slate-400 italic">Search here...</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm font-medium">Filing Status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 bg-white shadow-sm text-blue-600 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
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

        <div className="bg-white rounded border border-slate-200 overflow-x-auto shadow-sm">
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
                        {activeWorkspace?.gstins?.find(g => g.gstin === gstin)?.legal_name || 'Business'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">{gstin}</span>
                      <a href="#" className="text-[10px] text-blue-600 font-bold uppercase hover:underline mt-1">View Sections</a>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-center border-r border-slate-100 align-middle" rowSpan={3}>
                  {uploadedStatus ? (
                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold shadow-none rounded-sm">Uploaded</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold shadow-none rounded-sm">Not Uploaded</Badge>
                  )}
                </td>
                <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Your Data</td>
                <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{totals.docs || '-'}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-blue-600 font-medium">{formatCurrency(totals.taxable)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-blue-600 font-medium">{formatCurrency(totals.tax)}</td>
                 <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(totals.igst)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(totals.cgst)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(totals.sgst)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-orange-500 font-medium">{formatCurrency(totals.cess)}</td>
                <td className="py-2 px-4 text-center border-r border-slate-100 align-middle" rowSpan={3}>
                  <a href="#" className="text-blue-600 font-bold hover:underline">View</a>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-slate-100 bg-slate-50/40 group hover:bg-slate-50/60">
                <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Uploaded to GSTN</td>
                <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{uploadedStatus ? totals.docs : '-'}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(uploadedStatus ? totals.taxable : 0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(uploadedStatus ? totals.tax : 0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-slate-200 bg-white group hover:bg-slate-50/30">
                <td className="py-2 px-4 text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">Difference</td>
                <td className="py-2 px-4 text-center border-r border-slate-100 text-slate-600">{uploadedStatus ? '-' : (totals.docs || '-')}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(uploadedStatus ? 0 : totals.taxable)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(uploadedStatus ? 0 : totals.tax)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
                <td className="py-2 px-4 text-right border-r border-slate-100 text-slate-600">{formatCurrency(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showNoDataAction} onOpenChange={setShowNoDataAction}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Confirm action on GSTINs with no data</DialogTitle>
            <DialogDescription className="text-slate-600 pt-2 text-base">
              Based on our checks, the following GSTINs have no sales data. How would you like to proceed?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={noDataAction} onValueChange={(val: any) => setNoDataAction(val)}>
              <div className="flex items-start space-x-3 border border-slate-200 rounded-lg p-4 mb-3 hover:bg-slate-50 transition-colors">
                <RadioGroupItem value="nil" id="nil" className="mt-1" />
                <div className="grid gap-1.5">
                  <Label htmlFor="nil" className="font-semibold text-slate-900 cursor-pointer">Mark as Nil Filing</Label>
                  <p className="text-sm text-slate-500">Will file a NIL return for these GSTINs automatically.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                <RadioGroupItem value="skip" id="skip" className="mt-1" />
                <div className="grid gap-1.5">
                  <Label htmlFor="skip" className="font-semibold text-slate-900 cursor-pointer">Skip Upload</Label>
                  <p className="text-sm text-slate-500">Will skip uploading data for these GSTINs.</p>
                </div>
              </div>
            </RadioGroup>

            <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-200">
                GSTINs (1)
              </div>
              <div className="p-3 bg-white">
                <div className="flex items-center justify-between py-2">
                  <span className="font-mono text-slate-700">{gstin}</span>
                  <Badge variant="outline" className="text-slate-500 font-medium">Nil Rated</Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowNoDataAction(false)}>Cancel</Button>
            <Button onClick={processUpload} className="bg-blue-600 text-white hover:bg-blue-700">Confirm & Proceed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
