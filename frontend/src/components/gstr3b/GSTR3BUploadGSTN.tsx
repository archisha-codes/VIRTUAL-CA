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
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Upload,
  FileText,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import GSTR3BDetailedSummaryModal from './GSTR3BDetailedSummaryModal';
import GSTR3BChallanDashboardModal from './GSTR3BChallanDashboardModal';

interface GSTR3BUploadGSTNProps {
  businessName: string;
  gstin: string;
  onBack: () => void;
  onProceed: () => void;
}

const GSTR3BUploadGSTN: React.FC<GSTR3BUploadGSTNProps> = ({
  businessName,
  gstin,
  onBack,
  onProceed
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);

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
              <h1 className="text-[22px] font-bold text-slate-800">Step 3/5: Upload to GSTN</h1>
              <p className="text-sm text-slate-500 font-medium">
                See total values of the prepared data and payment made. Once ready, proceed to upload.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button 
               variant="outline" 
               className="h-9 px-4 gap-2 border-slate-300 text-slate-600 font-bold bg-white hover:bg-slate-50"
               onClick={() => setIsChallanModalOpen(true)}
            >
              <CreditCard className="h-4 w-4 text-blue-500" />
              Create / View Challans
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-4 gap-2 border-slate-300 text-slate-600 font-bold bg-white hover:bg-slate-50">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Actions <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] p-2 shadow-2xl border-slate-200 bg-white z-[100]">
                <DropdownMenuLabel className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">REFRESH</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4 text-blue-500" /> Ledger balance
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">DOWNLOAD & SHARE</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <Download className="h-4 w-4 text-blue-500" /> Download Summary for GSTR-3B
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <Download className="h-4 w-4 text-blue-500" /> Download GSTR3B PDF from GSTN
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">VIEW</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <Eye className="h-4 w-4 text-blue-500" /> Show IGST, CGST, SGST, Cess
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuLabel className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">INVOICES</DropdownMenuLabel>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <FileSearch className="h-4 w-4 text-blue-500" /> View sales invoices
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
                  <FileSearch className="h-4 w-4 text-blue-500" /> View purchase invoices
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
               className="bg-[#1D70E2] hover:bg-blue-700 text-white font-bold h-9 px-6 shadow-sm"
               onClick={() => {
                 console.log("Uploading to GSTN...");
               }}
            >
              Upload to GSTN
            </Button>
            <Button 
               className="bg-[#1D70E2] hover:bg-blue-700 text-white font-bold h-9 px-6 gap-2 shadow-sm"
               onClick={onProceed}
            >
              Post Credit to Ledger & File 3B <ArrowRight className="h-4 w-4" />
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
                  {/* Pillar Checks */}
                  <TableHead className="w-[50px] sticky left-0 z-[60] bg-[#F8F9FA] border-r border-slate-200 pt-8 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-center">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" />
                    </div>
                  </TableHead>

                  {/* Business Pillar */}
                  <TableHead className="w-[450px] border-r border-slate-200 font-bold text-slate-600 uppercase tracking-widest text-[11px] text-center sticky left-[50px] bg-[#F8F9FA] z-[60] shadow-[1px_0_0_rgba(0,0,0,0.05)] pt-8">
                     BUSINESS
                  </TableHead>

                  {/* Upload Status */}
                  <TableHead className="w-[200px] border-r border-slate-200 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-center pt-8">
                    UPLOAD STATUS
                  </TableHead>

                  {/* Ready to File */}
                  <TableHead className="w-[150px] border-r border-slate-200 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-center pt-8">
                    READY TO FILE
                  </TableHead>

                  {/* Total Liability */}
                  <TableHead className="w-[300px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                        TOTAL LIABILITY (3.1 a,b,c,d,e + 3.1.1 + 5.1)
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Paid through ITC */}
                  <TableHead className="w-[300px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight">
                        PAID THROUGH ITC
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Paid through cash ledger */}
                  <TableHead className="w-[340px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight uppercase">
                        PAID THROUGH AVAILABLE CASH LEDGER
                      </div>
                      <div className="h-[40px] flex items-center justify-center font-bold text-slate-400 text-[9px] uppercase tracking-widest">
                        TOTAL TAX VALUE (₹)
                      </div>
                    </div>
                  </TableHead>

                  {/* Pending amount to be paid */}
                  <TableHead className="w-[280px] border-r border-slate-200 p-0">
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                      <div className="flex-1 flex items-center justify-center font-bold text-[#555555] uppercase tracking-[0.05em] text-[9.5px] border-b border-slate-200 mt-2 px-2 text-center leading-tight uppercase">
                         PENDING AMOUNT TO BE PAID
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
                {/* Entity Row */}
                <TableRow className="bg-[#EDF4FF] hover:bg-[#E2EDFF] border-b border-slate-200 h-[64px] transition-colors">
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
                  {/* Empty filler cells */}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableCell key={i} className="border-r border-slate-200 text-center font-bold text-slate-500">
                      {i >= 2 ? "0.00" : ""}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Details Row */}
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
                           onClick={() => setIsPreviewModalOpen(true)}
                           className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest underline decoration-blue-300 underline-offset-4 text-left"
                        >
                          PREVIEW 3B
                        </button>
                      </div>
                    </TableCell>
                    
                    {/* Status Cells */}
                    <TableCell className="border-r border-slate-100 px-4 text-center">
                       <div className="bg-[#E9FBF0] text-[#1D9F4A] text-[10px] font-bold px-6 py-2 rounded-sm uppercase tracking-widest inline-block h-[34px] flex items-center justify-center">
                          FILED
                       </div>
                    </TableCell>
                    <TableCell className="border-r border-slate-100 px-4 text-center">
                       <div className="bg-[#F8F9FA] text-[#666666] border border-[#D9D9D9] text-[10px] font-extra-black p-2 h-[34px] flex items-center justify-center rounded-sm uppercase tracking-widest inline-block w-full">
                          NO
                       </div>
                    </TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    <TableCell className="border-r border-slate-100 text-center font-bold text-slate-600 text-[13px]">0.00</TableCell>
                    
                    {/* Refresh Ledger */}
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
