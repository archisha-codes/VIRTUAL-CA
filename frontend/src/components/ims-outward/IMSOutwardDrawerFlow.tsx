import React, { useState } from 'react';
import { Search, ChevronDown, CheckCircle2, Building2, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IMSOutwardDrawerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFetchData: () => void;
}

export function IMSOutwardDrawerFlow({ open, onOpenChange, onFetchData }: IMSOutwardDrawerFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-y-0 right-0 z-50 w-[400px] bg-slate-50 shadow-xl flex flex-col transform transition-transform duration-300">
        
        {step === 1 && (
          <div className="flex flex-col h-full bg-white relative shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
               <h2 className="text-lg font-semibold text-slate-800">IMS Outward Suppliers</h2>
               <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 ml-2">
                 <X className="h-4 w-4" />
               </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/50">
               <div className="flex flex-col gap-2">
                 <label className="text-sm font-medium text-slate-700">Business</label>
                 <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-3 relative hover:border-blue-300 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                       <span className="font-medium text-slate-800 text-sm truncate max-w-[120px]">Bauer Specializ...</span>
                       <span className="text-slate-400 text-xs">PAN: AADCB1626P</span>
                    </div>
                    <Building2 className="h-5 w-5 text-blue-600" />
                 </div>
               </div>

               <div className="flex flex-col gap-2">
                 <label className="text-sm font-medium text-slate-700">Return Period</label>
                 <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-3 relative hover:border-blue-300 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                       <span className="font-medium text-slate-800 text-sm">Oct 2024 <span className="text-slate-400 font-normal">→</span> Mar 2026</span>
                    </div>
                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                 </div>
               </div>
            </div>
            
            <div className="p-4 border-t bg-white flex items-center justify-between shrink-0">
               <Button 
                 className="w-full bg-blue-600 hover:bg-blue-700 rounded text-white font-medium h-10 transition-colors" 
                 onClick={() => setStep(2)}
               >
                 Continue
               </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col h-full bg-white relative shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-white">
               <h2 className="text-lg font-semibold text-slate-800">Generate OTP to connect GSTINs</h2>
               <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 ml-2">
                 <X className="h-4 w-4" />
               </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
               <div className="flex items-center text-blue-600 font-medium text-sm gap-2">
                 <Building2 className="h-4 w-4" /> Multi GSTIN(1)
               </div>
               
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                     placeholder="State name or GSTIN number" 
                     className="pl-9 bg-white border-slate-200 h-10 shadow-sm"
                  />
               </div>

               <div className="mt-4 bg-white border rounded-md p-4 shadow-sm">
                  <div className="flex items-start gap-2 border-b border-dashed pb-3 mb-3">
                     <ChevronDown className="h-5 w-5 text-slate-600" />
                     <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800 tracking-wide uppercase">1/1 GSTINS ARE CONNECTED</span>
                        <span className="text-xs text-slate-500 mt-0.5">Connected GSTINs appears here</span>
                     </div>
                  </div>
                  
                  <div className="flex flex-col py-1 pl-7">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800">Delhi</span>
                        <span className="flex items-center text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-medium">
                           <CheckCircle2 className="h-2.5 w-2.5 mr-1 text-green-600" /> Connected
                        </span>
                     </div>
                     <span className="text-xs text-slate-500 font-mono">07AADCB1626P1ZJ</span>
                  </div>
               </div>
            </div>
            
            <div className="p-4 border-t bg-white flex items-center justify-between shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
               <Button 
                 className="w-full bg-blue-600 hover:bg-blue-700 rounded text-white font-medium h-10 flex items-center justify-center transition-colors" 
                 onClick={onFetchData}
               >
                 Fetch Data and Generate Report <span className="ml-2">→</span>
               </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
