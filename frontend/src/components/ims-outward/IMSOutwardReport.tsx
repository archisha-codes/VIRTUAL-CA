import React, { useState } from 'react';
import { ChevronDown, Download, Columns, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IMSOutwardDocumentView } from './IMSOutwardDocumentView';
import { IMSOutwardDataAvailability } from './IMSOutwardDataAvailability';

interface IMSOutwardReportProps {
  onBack: () => void;
}

export function IMSOutwardReport({ onBack }: IMSOutwardReportProps) {
  const [activeMainTab, setActiveMainTab] = useState<'report' | 'data'>('report');
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'document'>('summary');
  const [activeSectionFilter, setActiveSectionFilter] = useState<string | null>(null);

  const handleViewSection = (section: string) => {
    setActiveSectionFilter(section);
    setActiveSubTab('document');
  };

  return (
    <div className="flex flex-col h-full w-full bg-white absolute inset-0 overflow-hidden">
      {/* Top Header */}
      <div className="flex-none px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-center text-xs text-slate-500 hover:text-blue-600 cursor-pointer mb-2 font-medium" onClick={onBack}>
           <span className="mr-1">All Reports</span> <ChevronDown className="h-3 w-3 -rotate-90" />
        </div>
        
        <div className="flex flex-col gap-4">
           <h1 className="text-2xl font-semibold text-slate-800">IMS Supplier Reports</h1>
           
           <div className="flex items-center gap-6 border-b pb-0">
              <button 
                 className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeMainTab === 'report' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                 onClick={() => setActiveMainTab('report')}
              >
                 Report
              </button>
              <button 
                 className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeMainTab === 'data' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                 onClick={() => setActiveMainTab('data')}
              >
                 Data Availability
              </button>
           </div>
        </div>
      </div>

      {activeMainTab === 'report' && (
        <div className="flex-1 flex flex-col min-h-0 relative bg-white">
          {/* Sub Tabs toolbar */}
          <div className="flex-none px-6 py-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2">
                <button 
                   className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${activeSubTab === 'summary' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                   onClick={() => setActiveSubTab('summary')}
                >
                   Summary
                </button>
                <button 
                   className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${activeSubTab === 'document' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                   onClick={() => setActiveSubTab('document')}
                >
                   Document View
                </button>
             </div>
             
             <div className="flex items-center">
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="outline" className="bg-white border-slate-200 text-slate-700 h-8 font-medium">
                     Actions <ChevronDown className="h-4 w-4 ml-2" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-56">
                   <DropdownMenuItem className="cursor-pointer">
                     <Download className="mr-2 h-4 w-4" /> IMS Supplier Summary
                   </DropdownMenuItem>
                   <DropdownMenuItem className="cursor-pointer">
                     <Columns className="mr-2 h-4 w-4" /> Show/Hide Reorder Column
                   </DropdownMenuItem>
                   <DropdownMenuItem className="cursor-pointer">
                     <span className="mr-2 h-4 w-4 flex items-center justify-center font-bold text-lg">↑↓</span> Sort
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             </div>
          </div>

          <div className="flex-1 p-6 pt-0 overflow-y-auto">
            {activeSubTab === 'summary' && (
              <div className="border rounded-md shadow-sm overflow-hidden bg-white">
                 <table className="w-full border-collapse">
                    <thead className="bg-[#f8fafd] border-b">
                       <tr>
                          <th className="border-r border-b text-left p-4 text-xs font-semibold text-slate-600 w-[24%]" rowSpan={2}>Section</th>
                          <th className="border-r border-b p-4 text-xs font-semibold text-slate-600 text-center w-[12%]" rowSpan={2}>Total number of documents</th>
                          <th className="border-r border-b p-2 text-xs font-semibold text-slate-600 text-center" colSpan={4}>IMS Action Count</th>
                          <th className="border-r border-b p-4 text-xs font-semibold text-slate-600 text-right w-[15%]" rowSpan={2}>Tax Value (₹)</th>
                          <th className="p-4 text-xs font-semibold text-slate-600 text-center w-[10%]" rowSpan={2}>View Details</th>
                       </tr>
                       <tr>
                          <th className="border-r p-3 text-xs font-medium text-slate-500 text-center w-[10%]">No Action</th>
                          <th className="border-r p-3 text-xs font-medium text-slate-500 text-center w-[10%]">Accept</th>
                          <th className="border-r p-3 text-xs font-medium text-slate-500 text-center w-[10%]">Pending</th>
                          <th className="border-r p-3 text-xs font-medium text-slate-500 text-center w-[10%]">Reject</th>
                       </tr>
                    </thead>
                    <tbody className="text-[13px]">
                       {summaryData.map((row, i) => (
                         <tr key={i} className={`border-b hover:bg-slate-50 ${row.section === 'TOTAL' ? 'font-semibold bg-slate-50 border-t-2' : ''}`}>
                           <td className="border-r p-4 text-slate-700">{row.section}</td>
                           <td className="border-r p-4 text-right">{row.total}</td>
                           <td className="border-r p-4 text-right text-slate-600">{row.noAction}</td>
                           <td className="border-r p-4 text-right text-slate-600">{row.accept}</td>
                           <td className="border-r p-4 text-right text-slate-600">{row.pending}</td>
                           <td className="border-r p-4 text-right text-slate-600">{row.reject}</td>
                           <td className="border-r p-4 text-right text-slate-700">{row.taxValue}</td>
                           <td className="p-4 text-center">
                             {row.section !== 'TOTAL' && (
                                <button 
                                  className="text-blue-600 font-medium flex items-center justify-center w-full hover:underline"
                                  onClick={() => handleViewSection(row.section)}
                                >
                                   View <ArrowRight className="h-3 w-3 ml-1" />
                                </button>
                             )}
                           </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )}

            {activeSubTab === 'document' && (
              <IMSOutwardDocumentView 
                  sectionFilter={activeSectionFilter}
                  onClearFilter={() => setActiveSectionFilter(null)}
              />
            )}
          </div>
        </div>
      )}

      {activeMainTab === 'data' && (
        <IMSOutwardDataAvailability />
      )}
    </div>
  );
}

const summaryData = [
  { section: 'B2B - Invoices', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'B2B - Invoices (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'B2B - Debit Notes', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'B2B - Debit Notes (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'B2B - Credit Notes', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'B2B - Credit Notes (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'ECO [9(5)] - Invoices', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'ECO [9(5)] - Invoices (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
  { section: 'TOTAL', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: '0.00' },
];
