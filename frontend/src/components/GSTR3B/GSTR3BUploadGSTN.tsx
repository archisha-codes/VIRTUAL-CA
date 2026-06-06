import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Download,
  Eye,
  FileSearch,
  Plus,
  Minus,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Upload,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import GSTR3BDetailedSummaryModal from './GSTR3BDetailedSummaryModal';
import GSTR3BChallanDashboardModal from './GSTR3BChallanDashboardModal';
import { GSTR3BValidationBanner } from './GSTR3BValidationBanner';
import type { ValidationState } from '@/hooks/useGSTR3BValidation';

interface GSTR3BUploadGSTNProps {
  businessName: string;
  gstin: string;
  onBack: () => void;
  onProceed: () => void;
  canFile?: boolean;
  nilReturn?: boolean;
  liveValidation?: ValidationState;
  workspaceId?: string;
  returnPeriod?: string;
}

const GSTR3BUploadGSTN: React.FC<GSTR3BUploadGSTNProps> = ({
  businessName,
  gstin,
  onBack,
  onProceed,
  canFile = true,
  nilReturn = false,
  liveValidation,
}) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  });

  const handleUploadToGSTN = useCallback(async () => {
    setIsUploading(true);
    try {
      // In production: call GSTN API to upload return data
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({
        title: 'Uploaded to GSTN',
        description: 'GSTR-3B data has been successfully uploaded to GSTN portal.',
      });
    } catch {
      toast({
        title: 'Upload Failed',
        description: 'Unable to upload to GSTN. Please retry or check your network.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleRefreshLedger = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const now = new Date();
      setLastRefreshed(now.toLocaleString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        day: '2-digit', month: '2-digit', year: 'numeric'
      }));
      toast({ title: 'Ledger Refreshed', description: 'Ledger balances updated from GSTN.' });
    } catch {
      toast({ title: 'Refresh Failed', description: 'Unable to refresh ledger.', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Step Header */}
      <div className="flex-none pt-5 pb-4 px-6 border-b border-border">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className="mt-1.5 p-1.5 hover:bg-accent rounded-full transition-colors text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="space-y-0.5">
              <h1 className="text-[20px] font-bold text-foreground">Step 3/5: Upload to GSTN</h1>
              <p className="text-sm text-muted-foreground">
                See total values of the prepared data and payment made. Once ready, proceed to upload.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              className="h-9 px-4 gap-2 font-semibold text-sm"
              onClick={() => setIsChallanModalOpen(true)}
            >
              <CreditCard className="h-4 w-4 text-blue-500" />
              Create / View Challans
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-4 gap-2 font-semibold text-sm">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] p-2 shadow-2xl z-[100]">
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">REFRESH</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-semibold cursor-pointer" onClick={handleRefreshLedger}>
                  <RefreshCw className="h-4 w-4 text-blue-500" /> Ledger balance
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">DOWNLOAD &amp; SHARE</DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={() => toast({ title: 'Download Started', description: 'Downloading GSTR-3B summary...' })}
                >
                  <Download className="h-4 w-4 text-blue-500" /> Download Summary for GSTR-3B
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={() => toast({ title: 'Download Started', description: 'Downloading GSTR-3B PDF from GSTN...' })}
                >
                  <Download className="h-4 w-4 text-blue-500" /> Download GSTR3B PDF from GSTN
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">VIEW</DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={() => toast({ title: 'Tax Breakdown', description: 'Showing IGST, CGST, SGST and Cess breakdown.' })}
                >
                  <Eye className="h-4 w-4 text-blue-500" /> Show IGST, CGST, SGST, Cess
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">INVOICES</DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={() => toast({ title: 'Sales Invoices', description: 'Opening sales invoices view.' })}
                >
                  <FileSearch className="h-4 w-4 text-blue-500" /> View sales invoices
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={() => toast({ title: 'Purchase Invoices', description: 'Opening purchase invoices view.' })}
                >
                  <FileSearch className="h-4 w-4 text-blue-500" /> View purchase invoices
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 px-5 gap-2 shadow-sm"
              onClick={handleUploadToGSTN}
              disabled={isUploading}
            >
              {isUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload to GSTN</>
              )}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold h-9 px-5 gap-2 shadow-sm"
              onClick={() => { if (canFile) onProceed(); }}
              disabled={!canFile}
              title={!canFile ? 'Resolve all validation errors before filing' : undefined}
            >
              Post Credit to Ledger &amp; File 3B <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {nilReturn && (
        <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-400/30 flex items-center gap-2 text-[12px] text-amber-600">
          <span className="font-bold">NIL RETURN</span> — All values are zero. No tax payable.
        </div>
      )}

      {liveValidation && (
        <GSTR3BValidationBanner
          errors={liveValidation.errors}
          warnings={liveValidation.warnings}
          info={liveValidation.info}
        />
      )}

      {liveValidation && !canFile && liveValidation.errorCount > 0 && (
        <div className="mx-6 mt-3 flex items-start gap-3 p-3 rounded-lg border border-red-400/40 bg-red-500/5 text-[12px] text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Filing Blocked</p>
            <p className="text-red-400 mt-0.5">
              {liveValidation.errorCount} validation error{liveValidation.errorCount > 1 ? 's' : ''} must be resolved before filing.
              The Post Credit to Ledger button is disabled.
            </p>
          </div>
        </div>
      )}

      {/* Main Table Area */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full bg-card rounded-md border border-border overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-x-auto overflow-y-auto w-full custom-scrollbar flex-1">
            <Table className="border-collapse min-w-[2800px] table-fixed w-full">
              <TableHeader className="bg-muted/50 sticky top-0 z-50 border-b-2 border-border h-[100px]">
                <TableRow className="hover:bg-transparent border-none">
                  {/* Checkbox */}
                  <TableHead className="w-[50px] sticky left-0 z-[60] bg-muted/50 border-r border-border pt-8 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-center">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded-sm" />
                    </div>
                  </TableHead>

                  {/* Business */}
                  <TableHead className="w-[450px] border-r border-border font-bold text-muted-foreground uppercase tracking-widest text-[11px] text-center sticky left-[50px] bg-muted/50 z-[60] shadow-[1px_0_0_rgba(0,0,0,0.05)] pt-8">
                    BUSINESS
                  </TableHead>

                  {/* Upload Status */}
                  <TableHead className="w-[200px] border-r border-border font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center pt-8">
                    UPLOAD STATUS
                  </TableHead>

                  {/* Ready to File */}
                  <TableHead className="w-[150px] border-r border-border font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center pt-8">
                    READY TO FILE
                  </TableHead>

                  {/* Total Liability */}
                  <TableHead className="w-[300px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        TOTAL LIABILITY (3.1 a,b,c,d,e + 3.1.1 + 5.1)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Paid through ITC */}
                  <TableHead className="w-[300px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        PAID THROUGH ITC
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Paid through cash */}
                  <TableHead className="w-[340px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        PAID THROUGH AVAILABLE CASH LEDGER
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Pending */}
                  <TableHead className="w-[280px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        PENDING AMOUNT TO BE PAID
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Refresh */}
                  <TableHead className="w-[240px] font-bold text-muted-foreground uppercase tracking-widest text-[11px] text-center pt-8">
                    REFRESH LEDGER BALANCE
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Entity (Business) Row */}
                <TableRow className="bg-blue-600/10 dark:bg-blue-500/10 hover:bg-blue-600/15 dark:hover:bg-blue-500/15 border-b border-border h-[64px] transition-colors">
                  <TableCell className="border-r border-border sticky left-0 z-40 bg-blue-600/10 dark:bg-blue-500/10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-center">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded-sm" />
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-border font-bold text-foreground sticky left-[50px] z-40 bg-blue-600/10 dark:bg-blue-500/10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4 pl-4 pr-6">
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center justify-center w-[18px] h-[18px] rounded-sm border border-blue-400 bg-card text-blue-500 shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        {isExpanded ? <Minus className="h-3 w-3" strokeWidth={5} /> : <Plus className="h-3 w-3" strokeWidth={5} />}
                      </button>
                      <span className="text-[13px] font-black leading-tight text-foreground uppercase tracking-tight">{businessName}</span>
                    </div>
                  </TableCell>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableCell key={i} className="border-r border-border text-center font-bold text-muted-foreground">
                      {i >= 2 ? '0.00' : ''}
                    </TableCell>
                  ))}
                </TableRow>

                {/* GSTIN Details Row */}
                {isExpanded && (
                  <TableRow className="hover:bg-muted/30 bg-card border-b border-border transition-colors h-[100px]">
                    <TableCell className="border-r border-border/50 sticky left-0 z-40 bg-card shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex justify-center">
                        <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded-sm" />
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-border/50 sticky left-[50px] z-40 bg-card shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col gap-2 pl-16">
                        <span className="text-[13px] font-bold text-foreground tracking-tight">{gstin}</span>
                        <button
                          onClick={() => setIsPreviewModalOpen(true)}
                          className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest underline decoration-blue-400/40 underline-offset-4 text-left transition-colors"
                        >
                          PREVIEW 3B
                        </button>
                      </div>
                    </TableCell>

                    {/* Upload Status */}
                    <TableCell className="border-r border-border/50 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-3 py-1.5 rounded-sm uppercase tracking-widest">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        FILED
                      </div>
                    </TableCell>

                    {/* Ready to File */}
                    <TableCell className="border-r border-border/50 px-4 text-center">
                      <div className="bg-muted text-muted-foreground border border-border text-[10px] font-bold p-2 h-[34px] flex items-center justify-center rounded-sm uppercase tracking-widest w-full">
                        NO
                      </div>
                    </TableCell>

                    {/* Numeric data cells */}
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>

                    {/* Refresh Ledger */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          onClick={handleRefreshLedger}
                          disabled={isRefreshing}
                          className="flex items-center gap-2 bg-blue-500/5 hover:bg-blue-500/15 p-2 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isRefreshing
                            ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                            : <RefreshCw className="h-4 w-4 text-blue-500" />
                          }
                        </button>
                        <div className="flex flex-col text-[9px] text-muted-foreground font-bold uppercase tracking-tight leading-none text-center">
                          <span>Last Refreshed at -</span>
                          <span className="mt-1">{lastRefreshed}</span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <GSTR3BDetailedSummaryModal
        open={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        gstin={gstin}
      />

      <GSTR3BChallanDashboardModal
        open={isChallanModalOpen}
        onOpenChange={setIsChallanModalOpen}
        gstin={gstin}
      />
    </div>
  );
};

export default GSTR3BUploadGSTN;
