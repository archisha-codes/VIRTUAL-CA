import React, { useState } from 'react';
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
  RotateCcw, 
  Download, 
  Eye, 
  FileSearch, 
  Plus, 
  Minus,
  RefreshCw,
  ExternalLink,
  ClipboardList,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import GSTR3BDetailedTaxCalculationModal from './GSTR3BDetailedTaxCalculationModal';

interface GSTR3BReviewTaxCalculationProps {
  businessName: string;
  gstin: string;
  onBack: () => void;
  onProceed: () => void;
}

const GSTR3BReviewTaxCalculation: React.FC<GSTR3BReviewTaxCalculationProps> = ({
  businessName,
  gstin,
  onBack,
  onProceed
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDetailedModalOpen, setIsDetailedModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC]">
      {/* Step Header */}
      <div className="flex-none pt-4 pb-6 px-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-3">
            <button 
              onClick={onBack}
              className="mt-1.5 p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="space-y-1">
              <h1 className="text-[22px] font-bold text-slate-800">Step 2/5 Review tax calculation and ITC offset</h1>
              <p className="text-sm text-slate-500 font-medium">
                Default tax calculation source (Clear GST vs GOVT) is chosen to give you most savings. You can view & Change tax calculation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-4 gap-2 border-slate-300 text-slate-600 font-bold bg-white hover:bg-slate-50">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Actions <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px] p-2 shadow-2xl border-slate-200 bg-white z-[100]">
                <DropdownMenuLabel className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">REFRESH</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer">
                  <RefreshCw className="h-4 w-4 text-blue-500" /> Ledger balance
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">DOWNLOAD & SHARE</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer">
                  <Download className="h-4 w-4 text-blue-500" /> Download Summary for GSTR-3B
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">VIEW</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer">
                  <Eye className="h-4 w-4 text-blue-500" /> Show IGST, CGST, SGST, Cess
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">INVOICES</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer">
                  <FileSearch className="h-4 w-4 text-blue-500" /> View sales invoices
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer">
                  <FileSearch className="h-4 w-4 text-blue-500" /> View purchase invoices
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-6 gap-2 rounded-md shadow-sm"
              onClick={onProceed}
            >
              Proceed to Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="h-full bg-white rounded-md border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-x-auto overflow-y-auto w-full custom-scrollbar-thin flex-1">
            <Table className="border-collapse min-w-[2800px] table-fixed w-full">
              <TableHeader className="bg-[#F8F9FA] sticky top-0 z-50 border-b-2 border-slate-200 h-[100px]">
                <TableRow className="hover:bg-transparent border-none">
                  {/* Checkbox Pillar */}
                  <TableHead className="w-[50px] sticky left-0 z-[60] bg-[#F8F9FA] border-r border-slate-200 pt-8 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-center">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" />
                    </div>
                  </TableHead>

                  {/* Business Pillar */}
                  <TableHead className="w-[450px] border-r border-slate-200 font-bold text-slate-600 uppercase tracking-widest text-[11px] text-center sticky left-[50px] bg-[#F8F9FA] z-[60] shadow-[1px_0_0_rgba(0,0,0,0.05)] pt-8">
                     BUSINESS
                  </TableHead>

                  {/* Tax Cal Column */}
                  <TableHead className="w-[200px] border-r border-slate-200 font-bold text-slate-500 uppercase tracking-[0.1em] text-[10px] text-center px-4 leading-normal">
                    <div className="flex flex-col items-center">
                      <span>TAX CAL. USED</span>
                      <span className="text-[9px] font-heavy text-slate-400 mt-0.5">CLEAR GST VS GOVT</span>
                    </div>
                  </TableHead>

                  {/* Table A Header */}
                  <TableHead className="w-[320px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                        A) TOTAL LIABILITY (3.1 a,b,c,d,e + 3.1.1 + 5.1)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Table B Header */}
                  <TableHead className="w-[320px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                         B) TABLE 4C - NET AVAILABLE ITC (AVAILABLE - REVERSAL)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Table C Header */}
                  <TableHead className="w-[320px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                        C) AVAILABLE CREDIT LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL CREDIT BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Cash Ledger Header */}
                  <TableHead className="w-[320px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight uppercase">
                        AVAILABLE CASH LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL CASH BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Total available Ledger balance */}
                  <TableHead className="w-[320px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                        TOTAL AVAILABLE LEDGER BALANCE (₹)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                         TOTAL AVAILABLE BALANCE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Table D Header */}
                  <TableHead className="w-[280px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight uppercase">
                        D) UTILIZATION BALANCE
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Liability to be paid in cash */}
                  <TableHead className="w-[380px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-6 text-center leading-tight uppercase">
                        LIABILITY TO BE PAID IN CASH (TOTAL LIABILITY - UTILIZABLE BALANCE)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Refresh Ledger Pillar */}
                  <TableHead className="w-[240px] font-bold text-slate-500 uppercase tracking-widest text-[11px] text-center pt-8">
                    REFRESH LEDGER BALANCE
                  </TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {/* Business Row */}
                <TableRow className="bg-[#EDF4FF] hover:bg-[#E2EDFF] border-b border-slate-200 h-[80px]">
                  <TableCell className="border-r border-slate-200 sticky left-0 z-40 bg-inherit shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-center">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" />
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-slate-200 font-bold text-slate-800 sticky left-[50px] z-40 bg-inherit shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4 pl-4 pr-6">
                       <button 
                         onClick={() => setIsExpanded(!isExpanded)}
                         className="flex items-center justify-center w-[18px] h-[18px] rounded-sm border border-blue-400 bg-white text-blue-500 shadow-sm"
                       >
                         {isExpanded ? <Minus className="h-3 w-3" strokeWidth={5} /> : <Plus className="h-3 w-3" strokeWidth={5} />}
                       </button>
                       <span className="text-[13px] font-black leading-tight text-slate-800 uppercase tracking-tight">{businessName}</span>
                    </div>
                  </TableCell>
                  {/* Empty filler cells for parent row */}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <TableCell key={i} className="border-r border-slate-200 text-center font-bold text-slate-500">0.00</TableCell>
                  ))}
                </TableRow>

                {/* GSTIN Row */}
                {isExpanded && (
                  <TableRow className="hover:bg-slate-50 bg-white border-b border-slate-200 transition-colors h-[100px]">
                    <TableCell className="border-r border-slate-100 sticky left-0 z-40 bg-inherit shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex justify-center">
                        <input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" />
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-slate-100 sticky left-[50px] z-40 bg-inherit shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col gap-2 pl-16">
                        <span className="text-[13px] font-bold text-slate-600 tracking-tight">{gstin}</span>
                        <button 
                           onClick={() => setIsDetailedModalOpen(true)}
                           className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest underline decoration-blue-300 underline-offset-4 text-left"
                        >
                          VIEW & CHANGE TAX CALCULATION
                        </button>
                      </div>
                    </TableCell>
                    
                    {/* Data Cells */}
                    <TableCell className="border-r border-slate-100 text-center font-bold">
                       <div className="bg-[#E7F3FF] text-[#007AFF] text-[10px] font-black px-2 py-1.5 rounded-sm uppercase tracking-tighter">
                          CLEAR GST
                       </div>
                    </TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">78,42,446.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">78,42,446.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    
                    {/* Last Refresh Info */}
                    <TableCell className="text-center">
                       <div className="flex flex-col items-center gap-1.5">
                         <div className="flex items-center gap-2 text-blue-100 bg-blue-600/5 group hover:bg-blue-600/10 p-2 rounded-full transition-colors cursor-pointer">
                           <RefreshCw className="h-4 w-4 text-blue-600" />
                         </div>
                         <div className="flex flex-col text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none text-center">
                           <span>Last Refreshed at -</span>
                           <span className="mt-1">10:40 AM 16/04/2026</span>
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
      />
    </div>
  );
};

export default GSTR3BReviewTaxCalculation;
