import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMSOutwardFilterSidebar } from './IMSOutwardFilterSidebar';

interface IMSOutwardDocumentViewProps {
  sectionFilter?: string | null;
  onClearFilter?: () => void;
}

export function IMSOutwardDocumentView({ sectionFilter, onClearFilter }: IMSOutwardDocumentViewProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden relative">
        {/* Toolbar */}
        <div className="flex-none p-3 border-b bg-white shrink-0 flex flex-col gap-3 z-10 relative">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                className="bg-white border-slate-200 h-8 gap-2 px-3 text-slate-700 font-medium"
                onClick={() => setFilterOpen(true)}
              >
                <Filter className="h-4 w-4" /> Filter
              </Button>
            </div>
            
            {sectionFilter && (
              <div className="flex items-center gap-2">
                 <div className="flex items-center text-xs text-slate-600 bg-white border border-slate-200 shadow-sm rounded-full px-3 py-1">
                    <span className="text-slate-400">Section Name :</span> 
                    <span className="font-semibold text-slate-800 ml-1">In {sectionFilter}</span>
                 </div>
                 <button 
                   className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline px-2"
                   onClick={onClearFilter}
                 >
                   Clear All
                 </button>
              </div>
            )}
        </div>

        {/* Small Fixed Upper Table */}
        <div className="flex-none bg-white border-b overflow-x-auto hide-scrollbar z-10">
           <table className="w-full min-w-[800px] border-collapse text-sm">
             <thead>
               <tr className="bg-[#f8fafd]">
                 <th className="p-3 border-r font-semibold text-slate-600 text-center">Total number of documents</th>
                 <th className="p-3 border-r font-semibold text-slate-600 text-center">Accept</th>
                 <th className="p-3 border-r font-semibold text-slate-600 text-center">Pending</th>
                 <th className="p-3 border-r font-semibold text-slate-600 text-center">Reject</th>
                 <th className="p-3 border-r font-semibold text-slate-600 text-center">No action</th>
                 <th className="p-3 font-semibold text-slate-600 text-right pr-6">Total Tax Value (₹)</th>
               </tr>
             </thead>
             <tbody>
               <tr>
                 <td className="p-3 border-r text-center font-medium">0</td>
                 <td className="p-3 border-r text-center font-medium">0</td>
                 <td className="p-3 border-r text-center font-medium">0</td>
                 <td className="p-3 border-r text-center font-medium">0</td>
                 <td className="p-3 border-r text-center font-medium">0</td>
                 <td className="p-3 text-right pr-6 font-medium">0.00</td>
               </tr>
             </tbody>
           </table>
        </div>

        {/* Massive Table */}
        <div className="flex-1 overflow-auto relative overscroll-contain bg-white">
           <table className="w-auto border-collapse text-xs">
              <thead className="bg-[#f8fafd] sticky top-0 z-20 whitespace-nowrap shadow-sm">
                 <tr>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[150px]">Document Number</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[140px]">IMS Action</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px]">Document Type</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px]">Document Date</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[140px]">Recipient GSTIN</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[180px]">Trade/Legal Name</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px] text-center">Reject</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[140px]">My GSTIN</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[140px]">Place of Supply</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px] text-right">Document Value</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px] text-right">Total Tax value</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px] text-right">IGST</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px] text-right">CGST</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px] text-right">SGST</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px] text-right">CESS</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px]">Return Period</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[120px]">Section Name</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[200px]">Is Reverse Charge Applicable?</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[180px]">Original Document Number</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[160px]">Original Document Date</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[140px]">Recipient PAN</th>
                    <th className="p-3 border-r border-b font-semibold text-slate-600 min-w-[100px]">Form Type</th>
                    <th className="p-3 border-b font-semibold text-slate-600 min-w-[100px]">Invoice Type</th>
                 </tr>
              </thead>
              <tbody className="whitespace-nowrap">
                 {/* Empty State exactly as in the image */}
                 <tr>
                   <td colSpan={23} className="p-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                         <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-3xl text-slate-300">☁️</span>
                         </div>
                         <h3 className="text-lg font-semibold text-slate-800 mb-1">No Results Found</h3>
                         <p className="text-slate-500 text-sm">Please try a different search term.</p>
                      </div>
                   </td>
                 </tr>
              </tbody>
           </table>
        </div>

        <IMSOutwardFilterSidebar open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
