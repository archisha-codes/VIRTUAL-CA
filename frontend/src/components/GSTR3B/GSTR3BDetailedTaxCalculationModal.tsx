import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Info, AlertTriangle, Edit2, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import type { GSTR3BComputation } from '@/hooks/useGSTR3BCompute';

interface GSTR3BDetailedTaxCalculationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gstin: string;
  computation?: GSTR3BComputation | null;
}

const GSTR3BDetailedTaxCalculationModal: React.FC<GSTR3BDetailedTaxCalculationModalProps> = ({
  open,
  onOpenChange,
  gstin,
  computation
}) => {
  const [activeTab, setActiveTab] = useState("clear_gst");
  const [isEditing, setIsEditing] = useState(false);
  
  // Real-time values state (fetched or mocked)
  const [values, setValues] = useState<Record<string, Record<string, number>>>({
    clear_gst: {},
    govt: {},
    user: {}
  });

  useEffect(() => {
    if (computation) {
      setValues(prev => ({
        ...prev,
        clear_gst: {
          ...prev.clear_gst,
          "row1f_igst": computation.totalLiability?.igst || 0,
          "row1f_cgst": computation.totalLiability?.cgst || 0,
          "row1f_sgst": computation.totalLiability?.sgst || 0,
          "row1f_cess": computation.totalLiability?.cess || 0,
          "row1f_total": computation.totalLiability?.total || 0,
          
          "row5_igst": computation.netItc4c?.igst || 0,
          "row5_cgst": computation.netItc4c?.cgst || 0,
          "row5_sgst": computation.netItc4c?.sgst || 0,
          "row5_cess": computation.netItc4c?.cess || 0,
          "row5_total": computation.netItc4c?.total || 0,

          "row6_igst": computation.itcUtilized?.igst || 0,
          "row6_cgst": computation.itcUtilized?.cgst || 0,
          "row6_sgst": computation.itcUtilized?.sgst || 0,
          "row6_cess": computation.itcUtilized?.cess || 0,
          "row6_total": computation.itcUtilized?.total || 0,

          "row12_igst": computation.cashLiability?.igst || 0,
          "row12_cgst": computation.cashLiability?.cgst || 0,
          "row12_sgst": computation.cashLiability?.sgst || 0,
          "row12_cess": computation.cashLiability?.cess || 0,
          "row12_total": computation.cashLiability?.total || 0,

          "row20_igst": computation.netItc4c?.igst || 0,
          "row20_cgst": computation.netItc4c?.cgst || 0,
          "row20_sgst": computation.netItc4c?.sgst || 0,
          "row20_cess": computation.netItc4c?.cess || 0,
          "row20_total": computation.netItc4c?.total || 0,
        }
      }));
    }
  }, [computation]);


  // Effects to load/save from sessionStorage for user input
  useEffect(() => {
    if (activeTab === "user") {
      const saved = sessionStorage.getItem(`gstr3b_user_input_${gstin}`);
      if (saved) {
        setValues(prev => ({ ...prev, user: JSON.parse(saved) }));
      }
    }
  }, [activeTab, gstin]);

  const handleSaveUserEntry = () => {
    sessionStorage.setItem(`gstr3b_user_input_${gstin}`, JSON.stringify(values.user));
    setIsEditing(false);
  };

  const handleInputChange = (rowKey: string, field: string, val: string) => {
    const numericVal = parseFloat(val.replace(/,/g, '')) || 0;
    setValues(prev => ({
      ...prev,
      user: {
        ...prev.user,
        [`${rowKey}_${field}`]: numericVal
      }
    }));
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] flex flex-col p-0 overflow-hidden border-none shadow-none rounded-none bg-white">
        
        {/* Top Header */}
        <div className="flex-none bg-[#F5F5F5] border-b border-slate-200 px-6 h-[48px] flex items-center justify-between z-[110]">
          <div className="text-[14px] font-bold text-[#333333]">
            Detailed tax calculation
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          
          {/* Main Layout: Sidebar vs Content */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* Left Sidebar (Mini navigation for GSTINs) */}
            <div className="w-[80px] border-r border-slate-200 bg-[#F8FAFC] flex flex-col">
               <div className="p-4 flex flex-col items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer shadow-md">
                    07-DL
                  </div>
               </div>
            </div>

            {/* Right Main Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Internal Header Area */}
              <div className="px-8 pt-6 pb-2 shrink-0">
                <h2 className="text-[17px] font-bold text-slate-800 mb-6">
                  Tax calculation for Delhi ({gstin})
                </h2>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex justify-between items-center mb-6">
                    <TabsList className="bg-slate-100/50 p-1 h-auto gap-1 border border-slate-200">
                      <TabsTrigger value="clear_gst" className="px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm font-bold text-slate-500 text-xs tracking-tight">
                        Clear GST calculation (Recommended)
                      </TabsTrigger>
                      <TabsTrigger value="govt" className="px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm font-bold text-slate-500 text-xs tracking-tight">
                        Govt Calculation
                      </TabsTrigger>
                      <TabsTrigger value="user" className="px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm font-bold text-slate-500 text-xs tracking-tight">
                        User Input
                      </TabsTrigger>
                    </TabsList>

                    {activeTab === "user" && !isEditing && (
                      <Button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 h-9 gap-2 px-6 font-bold text-sm rounded-sm">
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {activeTab === "user" && isEditing && (
                      <Button onClick={handleSaveUserEntry} className="bg-emerald-600 hover:bg-emerald-700 h-9 gap-2 px-6 font-bold text-sm rounded-sm">
                        <Check className="h-3.5 w-3.5" /> Save Changes
                      </Button>
                    )}
                  </div>

                  {/* Settings Notice */}
                  <div className="bg-orange-50/50 border border-orange-100 rounded-md py-3 px-4 mb-6 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="use-calc" checked className="w-4 h-4 accent-blue-600" />
                      <label htmlFor="use-calc" className="text-sm font-bold text-slate-700">Use this for tax calculation (Recommended)</label>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mt-1">
                      <Info className="h-4 w-4 text-orange-400" />
                      If you have not filed the 3B return from Clear GST 2.0, then your closing ECL balance might not match with the actuals
                    </div>
                  </div>

                  {/* Table area */}
                  <div className="border border-slate-200 rounded-sm overflow-hidden mb-8">
                    <div className="max-h-[calc(100vh-320px)] overflow-auto custom-scrollbar-thin">
                      <Table className="border-collapse table-fixed w-full">
                        <TableHeader className="bg-[#F9FAFB] border-b border-slate-200">
                          <TableRow className="h-[50px]">
                            <TableHead className="w-[450px] font-bold text-slate-400 uppercase tracking-widest text-[9px] px-6">DETAILS</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">TOTAL (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">IGST (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">CGST (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">SGST (₹)</TableHead>
                            <TableHead className="w-[180px] font-bold text-slate-400 uppercase tracking-widest text-[9px] text-center">CESS (₹)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Rendering Sections */}
                          <DataSection title="TOTAL TAX LIABILITY" />
                          <CalcRow id="1a" label="Tax payable other than reverse charge" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="1b" label="Tax Payable for Supplies u/s 9(5)" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="1c" label="Reverse Charge tax payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="1d" label="Interest payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="1e" label="Late fee payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="1f" label="Total tax to be paid (a+b+c+d+e)" valObj={values[activeTab]} isEditing={isEditing} isBold />

                          <DataSection title="Adjustment of Negative Liability of Previous Tax Period" />
                          <CalcRow id="2a" label="Tax payable other than reverse charge" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="2b" label="Tax Payable for Supplies u/s 9(5) and reverse charge" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />

                          <DataSection title="NET TAX LIABILITY" />
                          <CalcRow id="3a" label="Tax payable other than reverse charge" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="3b" label="Tax Payable for Supplies u/s 9(5)" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="3c" label="Reverse Charge tax payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="3d" label="Interest payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="3e" label="Late fee payable" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />

                          <DataSection title="ITC CLAIMED & CREDIT LEDGER BALANCE" />
                          <CalcRow id="4" label="ITC available" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          <CalcRow id="5" label="Electronic Credit Ledger balance" valObj={values[activeTab]} isEditing={isEditing} onEdit={handleInputChange} />
                          
                          <CalcRow id="6" label="Total Tax to be paid through ITC (2+3)" valObj={values[activeTab]} subRows={[
                            { id: "6A", label: "6A - Integrated Tax (IGST)" },
                            { id: "6B", label: "6B - Central Tax (CGST)" },
                            { id: "6C", label: "6C - State/UT Tax" },
                            { id: "6D", label: "6D - Cess" },
                          ]} />

                          <DataSection title="PAYMENT OF TAX (TABLE 6.1 in GSTR-3B FORM)" />
                          <CalcRow id="7" label="Other than Reverse Charge (1a-4)" valObj={values[activeTab]} />
                          <CalcRow id="8" label="Tax to be paid in cash for Supplies u/s 9(5)" valObj={values[activeTab]} />
                          <CalcRow id="9" label="Reverse Charge tax to be paid in cash" valObj={values[activeTab]} />
                          <CalcRow id="10" label="Interest to be paid in cash" valObj={values[activeTab]} />
                          <CalcRow id="11" label="Late fee to be paid in cash" valObj={values[activeTab]} />
                          <CalcRow id="12" label="Total tax to be paid in cash (5+6+7+8+9)" valObj={values[activeTab]} isBold />

                          <DataSection title="CASH LEDGER BALANCE" />
                          <CalcRow id="13" label="Tax amount" valObj={values[activeTab]} />
                          <CalcRow id="14" label="Penalty amount" valObj={values[activeTab]} />
                          <CalcRow id="15" label="Interest amount" valObj={values[activeTab]} />
                          <CalcRow id="16" label="Fee amount" valObj={values[activeTab]} />
                          <CalcRow id="17" label="Other amount" valObj={values[activeTab]} />
                          
                          <CalcRow id="18" label="Total Utilizable Cash Balance" valObj={values[activeTab]} subRows={[
                            { id: "18a", label: "Other than Reverse Charge" },
                            { id: "18b", label: "Reverse Charge" },
                            { id: "18c", label: "Interest" },
                            { id: "18d", label: "Late Fee" },
                            { id: "18e", label: "Total" },
                          ]} />

                          <CalcRow id="19" label="Additional cash required" valObj={values[activeTab]} bgClass="bg-[#E7F3FF]" isBold />

                          <DataSection title="CLOSING LEDGER BALANCE" />
                          <CalcRow id="20" label="Electronic Credit Ledger balance" valObj={values[activeTab]} bgClass="bg-[#E7F3FF]" isBold />
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DataSection = ({ title }: { title: string }) => (
  <TableRow className="bg-[#F8F9FA] h-[40px] border-y border-slate-200">
    <TableCell colSpan={6} className="px-6 font-black text-slate-500 text-[10px] tracking-widest uppercase">{title}</TableCell>
  </TableRow>
);

const CalcRow = ({ id, label, valObj, subRows, bgClass, isBold, isEditing, onEdit }: any) => {
  const formatVal = (v: any) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
      <TableRow className={cn("h-[55px] border-b border-slate-100 hover:bg-slate-50 transition-colors", bgClass)}>
        <TableCell className="px-6 flex items-center gap-4 h-full">
           <span className="w-8 text-[11px] font-bold text-slate-400">{id}</span>
           <span className={cn("text-[13px] font-bold", isBold ? "text-slate-900" : "text-slate-600")}>{label}</span>
        </TableCell>
        {['total', 'igst', 'cgst', 'sgst', 'cess'].map(field => (
          <TableCell key={field} className="p-2 text-center">
            {isEditing && id !== "1f" && id !== "12" && id !== "19" && id !== "20" ? (
              <input 
                type="text" 
                value={formatVal(valObj?.[`row${id}_${field}`] || 0)} 
                onChange={(e) => onEdit?.(`row${id}`, field, e.target.value)}
                className="w-full h-9 border border-blue-200 px-2 text-center font-bold text-blue-600 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            ) : (
              <span className={cn("text-[13px] font-bold", isBold ? "text-slate-900" : "text-slate-500")}>
                {formatVal(valObj?.[`row${id}_${field}`] || 0)}
              </span>
            )}
          </TableCell>
        ))}
      </TableRow>
      {subRows?.map((sub: any) => (
        <TableRow key={sub.id} className="h-[45px] border-b border-slate-50 bg-orange-50/20">
          <TableCell className="px-16 text-[11px] font-black text-slate-500 uppercase tracking-tight">{sub.label}</TableCell>
          {['total', 'igst', 'cgst', 'sgst', 'cess'].map(field => (
            <TableCell key={field} className="text-center">
              <span className="text-[11.5px] font-bold text-slate-400">0.00</span>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

export default GSTR3BDetailedTaxCalculationModal;
