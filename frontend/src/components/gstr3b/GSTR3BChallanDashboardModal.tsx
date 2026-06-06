import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ChevronDown, Download, RefreshCw, HelpCircle, Plus, Trash2, ArrowLeft } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface GSTR3BChallanDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string;
}

const GSTR3BChallanDashboardModal: React.FC<GSTR3BChallanDashboardModalProps> = ({
  open,
  onOpenChange,
  gstin
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'generated'>('create');
  const [isEditingChallan, setIsEditingChallan] = useState(false);

  // Business info from context/props
  const businessName = "Bauer Specialized Foundation Contractor India Private Limited AADCB1626P";
  const panInfo = "PAN: Bauer Specia... AADCB1626P";
  const period = "Feb 26";

  const handleClose = () => {
    onOpenChange(false);
    setIsEditingChallan(false);
    setActiveTab('create');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] flex flex-col p-0 overflow-hidden border-none shadow-none rounded-none bg-white focus:outline-none">
        
        {/* Top Header */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 h-[52px] flex items-center justify-between z-[110]">
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-bold text-[#333333]">
              {isEditingChallan && (
                <button 
                  onClick={() => setIsEditingChallan(false)}
                  className="mr-2 p-1 hover:bg-slate-100 rounded-full transition-colors inline-flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-500" />
                </button>
              )}
              {isEditingChallan ? "Edit challan" : "Challan dashboard"}
            </span>
            <div className="flex items-center gap-4 ml-8">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <div className="w-4 h-4 rounded-sm bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-600 text-[8px] font-black">PAN</span>
                </div>
                {panInfo}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase">
                 <div className="w-[18px] h-[18px] rounded-sm bg-red-50 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-red-400" />
                 </div>
                {period}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isEditingChallan && (
              <div className="flex items-center gap-3">
                 <Button variant="outline" className="h-[32px] px-4 gap-2 border-blue-200 text-blue-600 font-bold text-[11px] hover:bg-blue-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                 </Button>
                 <Button className="h-[32px] px-6 bg-[#007AFF] hover:bg-[#0062CC] text-white font-bold text-[11px] shadow-sm">
                    Save
                 </Button>
              </div>
            )}
            <div className="flex items-center gap-1 ml-4">
              <button className="h-10 w-10 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>
              <button 
                onClick={handleClose}
                className="h-10 w-10 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
          
          {/* Internal Navbar Tabs - only if not editing */}
          {!isEditingChallan && (
            <div className="h-[48px] border-b border-slate-200 px-6 flex items-center gap-8 shrink-0 bg-white">
               <button 
                  onClick={() => setActiveTab('create')}
                  className={cn(
                    "h-full flex items-center px-1 transition-all",
                    activeTab === 'create' ? "border-b-2 border-blue-600" : "hover:bg-slate-50"
                  )}
               >
                  <span className={cn("font-bold text-[13px]", activeTab === 'create' ? "text-blue-600" : "text-slate-500")}>Create challans</span>
               </button>
               <button 
                  onClick={() => setActiveTab('generated')}
                  className={cn(
                    "h-full flex items-center px-1 transition-all",
                    activeTab === 'generated' ? "border-b-2 border-blue-600" : "hover:bg-slate-50 relative"
                  )}
               >
                  <span className={cn("font-bold text-[13px]", activeTab === 'generated' ? "text-blue-600" : "text-slate-500")}>
                    Generated challans (0)
                  </span>
               </button>
            </div>
          )}

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isEditingChallan ? (
              <div className="flex-1 flex flex-col overflow-auto p-6 space-y-4">
                 <div className="flex gap-4">
                    {/* Draft Table */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                       <Table className="border-collapse">
                          <TableHeader className="bg-[#F8F9FA] border-b border-slate-200 h-[48px]">
                             <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[40px] border-r border-slate-100"><div className="flex justify-center"><input type="checkbox" className="w-3.5 h-3.5 accent-blue-600" /></div></TableHead>
                                <TableHead className="w-[200px] border-r border-slate-100"></TableHead>
                                <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center border-r border-slate-100">TOTAL TAX (₹)</TableHead>
                                <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center border-r border-slate-100">INTEREST (₹)</TableHead>
                                <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center border-r border-slate-100">PENALTY (₹)</TableHead>
                                <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center border-r border-slate-100">LATE FEES (₹)</TableHead>
                                <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center border-r border-slate-100">OTHER (₹)</TableHead>
                                <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">TOTAL AMOUNT (₹)</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             <TableRow className="h-[40px] bg-[#F9FAFB] border-b border-slate-100 font-extra-black text-[12px] text-slate-800">
                                <TableCell className="border-r border-slate-100 text-center"><input type="checkbox" className="w-3.5 h-3.5" /></TableCell>
                                <TableCell className="border-r border-slate-100 font-bold">Challan DRAFT - Total</TableCell>
                                <TableCell className="border-r border-slate-100 text-center">0</TableCell>
                                <TableCell className="border-r border-slate-100 text-center">0</TableCell>
                                <TableCell className="border-r border-slate-100 text-center">0</TableCell>
                                <TableCell className="border-r border-slate-100 text-center">0</TableCell>
                                <TableCell className="border-r border-slate-100 text-center">0</TableCell>
                                <TableCell className="text-center font-bold">0</TableCell>
                             </TableRow>
                             {["CGST", "IGST", "CESS", "SGST"].map((comp) => (
                               <TableRow key={comp} className="h-[36px] border-b border-slate-50 text-[12px] hover:bg-slate-50/50">
                                  <TableCell className="border-r border-slate-100"></TableCell>
                                  <TableCell className="border-r border-slate-100 pl-6 font-medium text-slate-500">{comp}</TableCell>
                                  <TableCell className="border-r border-slate-100 text-center text-slate-600 font-bold">0.00</TableCell>
                                  <TableCell className="border-r border-slate-100 text-center text-slate-600 font-bold">0.00</TableCell>
                                  <TableCell className="border-r border-slate-100 text-center text-slate-600 font-bold">0.00</TableCell>
                                  <TableCell className="border-r border-slate-100 text-center text-slate-600 font-bold">0.00</TableCell>
                                  <TableCell className="border-r border-slate-100 text-center text-slate-600 font-bold">0.00</TableCell>
                                  <TableCell className="text-center text-slate-600 font-bold">0</TableCell>
                               </TableRow>
                             ))}
                          </TableBody>
                       </Table>
                    </div>

                    {/* Right Selectors */}
                    <div className="w-[200px] flex flex-col gap-0 border border-slate-200 rounded-sm overflow-hidden bg-white shadow-sm">
                       <div className="border-b border-slate-100">
                          <div className="bg-[#F8F9FA] px-3 py-2 border-b border-slate-50">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">PAYMENT MODE</span>
                          </div>
                          <div className="p-2">
                             <Select defaultValue="select">
                               <SelectTrigger className="w-full text-[12px] h-8 bg-white border-none focus:ring-0 font-bold text-slate-600">
                                 <SelectValue placeholder="Select" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="select">Select</SelectItem>
                                 <SelectItem value="epayment">E-Payment</SelectItem>
                                 <SelectItem value="neft">NEFT/RTGS</SelectItem>
                               </SelectContent>
                             </Select>
                          </div>
                       </div>
                       <div className="flex-1">
                          <div className="bg-[#F8F9FA] px-3 py-2 border-b border-slate-50">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BANK</span>
                          </div>
                          <div className="p-2">
                             <Select defaultValue="select">
                               <SelectTrigger className="w-full text-[12px] h-8 bg-white border-none focus:ring-0 font-bold text-slate-600">
                                 <SelectValue placeholder="Select" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="select">Select</SelectItem>
                               </SelectContent>
                             </Select>
                          </div>
                       </div>
                    </div>
                 </div>

                 <button 
                   onClick={() => {}} 
                   className="w-full h-11 border-2 border-dashed border-blue-200 rounded-sm bg-white flex items-center justify-center text-blue-500 font-black text-[12px] gap-2 hover:bg-blue-50/50 transition-colors uppercase tracking-widest"
                 >
                   <Plus className="h-4 w-4" strokeWidth={3} /> Challan
                 </button>
              </div>
            ) : activeTab === 'create' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Dashboard Header Bar */}
                <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
                   <div className="flex-1 flex items-center gap-4 bg-white border border-blue-50 rounded-sm p-3.5 shadow-sm">
                      <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center text-white shrink-0">
                         <RefreshCw className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                         <p className="text-[14px] font-bold text-slate-700 leading-tight">
                            You can "Autofill challans" for the pending amount to be paid
                         </p>
                      </div>
                      <Button variant="outline" className="h-9 gap-2 border-blue-200 text-blue-600 font-bold px-6 text-[12px] hover:bg-blue-50">
                        <RefreshCw className="h-3.5 w-3.5" /> Autofill challans
                      </Button>
                   </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex-none h-[64px] px-6 flex items-center justify-end gap-3 bg-[#F8FAFC]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-[34px] px-4 gap-2 border-blue-400 text-blue-600 font-bold bg-white hover:bg-blue-50 text-[11px] rounded-sm shadow-sm">
                        <Plus className="h-4 w-4" /> Actions <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[240px] p-1.5 shadow-2xl border-slate-200 rounded-sm">
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Set Payment mode & bank
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Set Max amount per challan
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Download data as CSV
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuItem className="py-2 px-3 font-bold text-red-600 cursor-pointer text-[12px]">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Challans
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button className="bg-[#1D70E2] hover:bg-blue-700 text-white font-bold h-[34px] px-6 text-[11px] rounded-sm shadow-sm border border-blue-400">
                    Generate challans
                  </Button>
                </div>

                {/* Dashboard Grid */}
                <div className="flex-1 overflow-auto px-6 pb-20 space-y-8">
                  
                  {/* TOTAL Section */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                    <div className="bg-[#F8F9FA] h-10 border-b border-slate-100 flex items-center justify-center">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
                    </div>
                    <Table className="border-collapse table-fixed w-full">
                      <TableHeader className="bg-white border-b border-slate-50">
                        <TableRow className="h-10 hover:bg-transparent border-none">
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">CHALLANS</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">TOTAL TAX (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">INTEREST (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">PENALTY (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">LATE FEES (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">OTHER (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">TOTAL AMOUNT (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="h-[44px] font-bold text-slate-600 text-[13px] hover:bg-transparent">
                          <TableCell className="text-center text-[#1D70E2]">0</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Master Listing Table */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto w-full custom-scrollbar-thin">
                      <Table className="min-w-[1600px] border-collapse table-fixed">
                        <TableHeader className=" bg-[#F8F9FA] border-b border-slate-200 h-[52px]">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-[50px]"><div className="flex justify-center"><input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" /></div></TableHead>
                            <TableHead className="w-[300px] font-bold text-slate-400 uppercase tracking-widest text-[10px]">BUSINESS</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">STATUS</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">CHALLANS</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">TOTAL TAX (₹)</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">INTEREST (₹)</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">PENALTY (₹)</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">LATE FEES (₹)</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">OTHER (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">TOTAL AMOUNT (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">PAYMENT MODE</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">BANK</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="h-[72px] hover:bg-slate-50 border-b border-slate-50 transition-colors">
                            <TableCell><div className="flex justify-center"><input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" /></div></TableCell>
                            <TableCell>
                               <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                     <span className="text-[13px] font-bold text-blue-600">Delhi</span>
                                     <span className="text-[13px] font-bold text-slate-500">07AADCB1626P1ZJ</span>
                                  </div>
                                  <button 
                                     onClick={() => setIsEditingChallan(true)} 
                                     className="text-blue-600 font-bold text-[11px] hover:underline transition-all underline-offset-2 uppercase tracking-wide text-left"
                                  >
                                     View & Create Challan
                                  </button>
                               </div>
                            </TableCell>
                            {Array.from({ length: 10 }).map((_, i) => (
                               <TableCell key={i} className="text-center">—</TableCell>
                            ))}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Actions Toolbar - Generated Tab */}
                <div className="flex-none h-[64px] px-6 flex items-center justify-end bg-[#F8FAFC]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-[34px] px-4 gap-2 border-blue-400 text-blue-600 font-bold bg-white hover:bg-blue-50 text-[11px] rounded-sm shadow-sm">
                        Actions <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[240px] p-1.5 shadow-2xl border-slate-200 rounded-sm">
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Download data as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Download data as PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Refresh challans
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-2 px-3 font-bold text-[#333333] cursor-pointer text-[12px]">
                        Get challans from GSTN
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Dashboard Grid - Generated Tab */}
                <div className="flex-1 overflow-auto px-6 pb-20 space-y-8">
                  
                  {/* TOTAL Section */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                    <div className="bg-[#F8F9FA] h-10 border-b border-slate-100 flex items-center justify-center">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
                    </div>
                    <Table className="border-collapse table-fixed w-full">
                      <TableHeader className="bg-white border-b border-slate-50">
                        <TableRow className="h-10 hover:bg-transparent border-none">
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">CHALLANS</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">TOTAL TAX (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">INTEREST (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">PENALTY (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">LATE FEES (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4 border-r border-slate-100">OTHER (₹)</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center px-4">TOTAL AMOUNT (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="h-[44px] font-bold text-slate-600 text-[13px] hover:bg-transparent">
                          <TableCell className="text-center border-r border-slate-50">0</TableCell>
                          <TableCell className="text-center border-r border-slate-50 text-[#1D70E2]">0.00</TableCell>
                          <TableCell className="text-center border-r border-slate-50">0.00</TableCell>
                          <TableCell className="text-center border-r border-slate-50">0.00</TableCell>
                          <TableCell className="text-center border-r border-slate-50">0.00</TableCell>
                          <TableCell className="text-center border-r border-slate-50">0.00</TableCell>
                          <TableCell className="text-center">0.00</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Status Section */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                    <Table className="border-collapse table-fixed w-full">
                      <TableHeader className="bg-[#F8F9FA] border-b border-slate-100">
                        <TableRow className="h-10 hover:bg-transparent border-none">
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4 border-r border-slate-100">TOTAL GENERATED CHALLANS</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4 border-r border-slate-100">PAID</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4 border-r border-slate-100">TO BE PAID</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4 border-r border-slate-100">PAYMENT INITIATED</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4 border-r border-slate-100">PAYMENT FAILED</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[9px] px-4">EXPIRED</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="h-[44px] font-bold text-slate-700 text-[13px] hover:bg-transparent">
                          <TableCell className="px-4 border-r border-slate-50">0</TableCell>
                          <TableCell className="px-4 border-r border-slate-50">0</TableCell>
                          <TableCell className="px-4 border-r border-slate-50">0</TableCell>
                          <TableCell className="px-4 border-r border-slate-50">0</TableCell>
                          <TableCell className="px-4 border-r border-slate-50">0</TableCell>
                          <TableCell className="px-4">0</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Master Listing Table - Generated */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto w-full custom-scrollbar-thin">
                      <Table className="min-w-[1800px] border-collapse table-fixed">
                        <TableHeader className="bg-[#F8F9FA] border-b border-slate-200 h-[52px]">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-[50px]"><div className="flex justify-center"><input type="checkbox" className="w-4 h-4 accent-blue-600 border-slate-300 rounded-sm" /></div></TableHead>
                            <TableHead className="w-[300px] font-bold text-slate-400 uppercase tracking-widest text-[9px]">BUSINESS</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">PAYMENT STATUS</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">CPIN</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">GENERATED ON DATE</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">EXPIRED ON DATE</TableHead>
                            <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">TOTAL TAX (₹)</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">INTEREST (₹)</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">PENALTY (₹)</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">LATE FEES (₹)</TableHead>
                            <TableHead className="w-[100px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">OTHER (₹)</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">TOTAL AMOUNT (₹)</TableHead>
                            <TableHead className="w-[140px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">PAYMENT MODE</TableHead>
                            <TableHead className="w-[160px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">BANK</TableHead>
                            <TableHead className="w-[120px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">ACTIONS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="h-[200px] hover:bg-transparent">
                             <TableCell colSpan={15} className="p-0">
                                <div className="flex flex-col items-center justify-center h-full w-full py-12 gap-3 text-center">
                                   <div className="text-[13px] font-bold text-slate-400">No Data</div>
                                   <div className="flex flex-col gap-1">
                                     <button 
                                        onClick={() => setActiveTab('create')} 
                                        className="text-blue-600 font-bold text-[13px] hover:underline transition-all"
                                     >
                                        Create a challan and generate it to see it here
                                     </button>
                                   </div>
                                </div>
                             </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GSTR3BChallanDashboardModal;
