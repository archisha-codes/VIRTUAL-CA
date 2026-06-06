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
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import GSTR3BDetailedTaxCalculationModal from './GSTR3BDetailedTaxCalculationModal';
import { GSTR3BValidationBanner } from './GSTR3BValidationBanner';
import type { ValidationState } from '@/hooks/useGSTR3BValidation';
import type { GSTR3BComputation } from '@/hooks/useGSTR3BCompute';

interface GSTR3BReviewTaxCalculationProps {
  businessName: string;
  gstin: string;
  onBack: () => void;
  onProceed: () => void;
  nilReturn?: boolean;
  liveValidation?: ValidationState;
  computation?: GSTR3BComputation | null;
}

const GSTR3BReviewTaxCalculation: React.FC<GSTR3BReviewTaxCalculationProps> = ({
  businessName,
  gstin,
  onBack,
  onProceed,
  nilReturn = false,
  liveValidation,
  computation,
}) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDetailedModalOpen, setIsDetailedModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  });

  const handleRefreshLedger = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // In production: call API to refresh ledger balance from GSTN
      await new Promise(resolve => setTimeout(resolve, 1200));
      const now = new Date();
      setLastRefreshed(now.toLocaleString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        day: '2-digit', month: '2-digit', year: 'numeric'
      }));
      toast({ title: 'Ledger Refreshed', description: 'Credit and cash ledger balances updated from GSTN.' });
    } catch {
      toast({ title: 'Refresh Failed', description: 'Unable to refresh ledger. Please try again.', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  const formatVal = (val: number | undefined) => (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
              <h1 className="text-[20px] font-bold text-foreground">Step 2/5: Review tax calculation and ITC offset</h1>
              <p className="text-sm text-muted-foreground">
                Default tax calculation source (Clear GST vs GOVT) is chosen to give you most savings. You can view &amp; Change tax calculation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-4 gap-2 font-semibold text-sm">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px] p-2 shadow-2xl z-[100]">
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">REFRESH</DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-3 py-2.5 px-3 font-semibold cursor-pointer"
                  onClick={handleRefreshLedger}
                >
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
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold h-9 px-6 gap-2 rounded-md shadow-sm"
              onClick={onProceed}
              disabled={liveValidation ? (!liveValidation.canProceed && liveValidation.errorCount > 0) : false}
              title={liveValidation && !liveValidation.canProceed ? 'Fix validation errors before proceeding' : undefined}
            >
              Proceed to Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Nil return badge */}
      {nilReturn && (
        <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-400/30 flex items-center gap-2 text-[12px] text-amber-600">
          <span className="font-bold">NIL RETURN</span> — All values are zero. No tax payable.
        </div>
      )}

      {/* Validation Banner */}
      {liveValidation && (
        <GSTR3BValidationBanner
          errors={liveValidation.errors}
          warnings={liveValidation.warnings}
          info={liveValidation.info}
        />
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

                  {/* Tax Cal */}
                  <TableHead className="w-[200px] border-r border-border font-bold text-muted-foreground uppercase tracking-[0.1em] text-[10px] text-center px-4 leading-normal">
                    <div className="flex flex-col items-center">
                      <span>TAX CAL. USED</span>
                      <span className="text-[9px] font-semibold text-muted-foreground/70 mt-0.5">CLEAR GST VS GOVT</span>
                    </div>
                  </TableHead>

                  {/* A */}
                  <TableHead className="w-[320px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        A) TOTAL LIABILITY (3.1 a,b,c,d,e + 3.1.1 + 5.1)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* B */}
                  <TableHead className="w-[320px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        B) TABLE 4C - NET AVAILABLE ITC (AVAILABLE - REVERSAL)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* C */}
                  <TableHead className="w-[320px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        C) AVAILABLE CREDIT LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL CREDIT BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Cash Ledger */}
                  <TableHead className="w-[320px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        AVAILABLE CASH LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL CASH BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Total Available */}
                  <TableHead className="w-[320px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        TOTAL AVAILABLE LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL AVAILABLE BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* D */}
                  <TableHead className="w-[280px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-2 text-center leading-tight">
                        D) UTILIZATION BALANCE
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-muted-foreground text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Liability cash */}
                  <TableHead className="w-[380px] border-r border-border p-0">
                    <div className="flex flex-col h-full bg-muted/50">
                      <div className="flex-1 flex items-center justify-center font-bold text-foreground/70 uppercase tracking-[0.05em] text-[9.5px] border-b border-border mt-2 px-6 text-center leading-tight">
                        LIABILITY TO BE PAID IN CASH (TOTAL LIABILITY - UTILIZABLE BALANCE)
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
                {/* Business Row */}
                <TableRow className="bg-blue-600/10 dark:bg-blue-500/10 hover:bg-blue-600/15 dark:hover:bg-blue-500/15 border-b border-border h-[80px] transition-colors">
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
                  {Array.from({ length: 9 }).map((_, i) => (
                    <TableCell key={i} className="border-r border-border text-center font-bold text-muted-foreground">0.00</TableCell>
                  ))}
                </TableRow>

                {/* GSTIN Row */}
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
                          onClick={() => setIsDetailedModalOpen(true)}
                          className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest underline decoration-blue-400/40 underline-offset-4 text-left transition-colors"
                        >
                          VIEW &amp; CHANGE TAX CALCULATION
                        </button>
                      </div>
                    </TableCell>

                    {/* Tax Cal Used badge */}
                    <TableCell className="border-r border-border/50 text-center font-bold">
                      <div className="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-1.5 rounded-sm uppercase tracking-tighter inline-block">
                        CLEAR GST
                      </div>
                    </TableCell>

                    {/* Data cells */}
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">{formatVal(computation?.totalLiability?.total)}</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">{formatVal(computation?.netItc4c?.total)}</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">{formatVal(computation?.itcUtilized?.total)}</TableCell>
                    <TableCell className="border-r border-border/50 text-center font-bold text-foreground text-[13px]">{formatVal(computation?.cashLiability?.total)}</TableCell>

                    {/* Refresh */}
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

      <GSTR3BDetailedTaxCalculationModal
        open={isDetailedModalOpen}
        onOpenChange={setIsDetailedModalOpen}
        gstin={gstin}
        computation={computation}
      />
    </div>
  );
};

export default GSTR3BReviewTaxCalculation;
