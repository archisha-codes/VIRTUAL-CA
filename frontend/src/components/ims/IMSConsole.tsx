import React, { useState } from 'react';
import { ArrowLeft, Download, Upload, ChevronDown, Filter, Columns, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IMSDocumentViewTable } from './IMSDocumentViewTable';

interface IMSConsoleProps {
  gstin: string;
  onBack: () => void;
}

export function IMSConsole({ gstin, onBack }: IMSConsoleProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'document'>('summary');

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 absolute inset-0 overflow-hidden">
      {/* Top Header */}
      <div className="flex-none bg-white border-b px-6 py-3 flex items-center justify-between z-10 shrink-0">
        <div>
           <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 -ml-2 mb-1 h-6" onClick={onBack}>
             <ArrowLeft className="h-4 w-4 mr-1" />
             Go Back
           </Button>
           <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
             IMS Console
           </h1>
           <p className="text-sm text-slate-500">Manage IMS data and actions</p>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-sm text-slate-500">Last downloaded from IMS on 17 November, 10:23 pm</span>
           <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 bg-white font-medium h-9">
              <Download className="h-4 w-4 mr-2" />
              Download Data from IMS
           </Button>
           <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-9">
              <Upload className="h-4 w-4 mr-2" />
              Upload Actions to IMS
           </Button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex-none px-6 pt-4 shrink-0 bg-slate-50">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-1 bg-white p-1 rounded-md border w-fit">
               <button 
                  className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === 'summary' ? 'bg-white shadow-sm text-slate-900 border' : 'text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => setActiveTab('summary')}
               >
                 IMS Summary
               </button>
               <button 
                  className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === 'document' ? 'bg-white shadow-sm text-slate-900 border' : 'text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => setActiveTab('document')}
               >
                 Document View
               </button>
           </div>
           
           <div className="flex items-center gap-3">
             <span className="text-sm text-slate-500">Generated on Nov 17, 2025 10:23 PM</span>
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" className="bg-white border-slate-200 text-slate-700 h-8 font-medium">
                   Actions <ChevronDown className="h-4 w-4 ml-2" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-64">
                 {activeTab === 'summary' ? (
                   <DropdownMenuItem className="cursor-pointer">
                     <Download className="mr-2 h-4 w-4" /> Download Excel
                   </DropdownMenuItem>
                 ) : (
                   <>
                     <DropdownMenuLabel className="text-xs uppercase text-slate-500 font-semibold tracking-wider">IMS Actions (Clear Platform)</DropdownMenuLabel>
                     <DropdownMenuItem className="cursor-pointer"><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Accept</DropdownMenuItem>
                     <DropdownMenuItem className="cursor-pointer">Pending</DropdownMenuItem>
                     <DropdownMenuItem className="cursor-pointer">Reject</DropdownMenuItem>
                     <DropdownMenuItem className="cursor-pointer">Reset</DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuLabel className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Table Actions</DropdownMenuLabel>
                     <DropdownMenuItem className="cursor-pointer"><Download className="mr-2 h-4 w-4" /> Download Excel</DropdownMenuItem>
                     <DropdownMenuItem className="cursor-pointer"><Columns className="mr-2 h-4 w-4" /> Show/Hide Reorder Column</DropdownMenuItem>
                     <DropdownMenuItem className="cursor-pointer">Sort</DropdownMenuItem>
                   </>
                 )}
               </DropdownMenuContent>
             </DropdownMenu>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative mt-4 mx-6 mb-6">
        {activeTab === 'summary' && (
           <div className="h-full w-full bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-auto flex-1 overscroll-contain pb-6">
                 <table className="w-full border-collapse">
                    <thead className="bg-[#fcfdfd] sticky top-0 z-10 shadow-sm border-b">
                       <tr>
                          <th className="border-r border-b text-left p-3 text-xs font-medium text-slate-500 uppercase w-64" rowSpan={2}>Section</th>
                          <th className="border-r border-b p-3 text-xs font-medium text-slate-500 uppercase text-center w-28 bg-[#fdfaf2]" rowSpan={2}>Total number of documents</th>
                          <th className="border-r border-b p-2 text-xs font-medium text-slate-500 uppercase text-center" colSpan={4}>IMS Action (Govt.)</th>
                          <th className="border-r border-b p-3 text-xs font-medium text-slate-500 uppercase text-right w-32" rowSpan={2}>Tax Value (₹)</th>
                          <th className="border-r border-b p-3 text-xs font-medium text-slate-500 uppercase text-center w-28" rowSpan={2}>Actions Yet to be Uploaded</th>
                          <th className="border-b p-3 text-xs font-medium text-slate-500 uppercase text-center w-24" rowSpan={2}>View Details</th>
                       </tr>
                       <tr>
                          <th className="border-r p-2 text-xs font-medium text-slate-500 uppercase text-center w-24">No Action</th>
                          <th className="border-r p-2 text-xs font-medium text-slate-500 uppercase text-center w-24">Accept</th>
                          <th className="border-r p-2 text-xs font-medium text-slate-500 uppercase text-center w-24">Pending</th>
                          <th className="border-r p-2 text-xs font-medium text-slate-500 uppercase text-center w-24">Reject</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm">
                       {summaryData.map((row, i) => (
                         <tr key={i} className="border-b hover:bg-slate-50">
                           <td className="border-r p-3 text-slate-700">{row.section}</td>
                           <td className="border-r p-3 text-center bg-[#fdfaf2] font-medium">{row.total}</td>
                           <td className="border-r p-3 text-center">{row.noAction}</td>
                           <td className="border-r p-3 text-center">{row.accept}</td>
                           <td className="border-r p-3 text-center">{row.pending}</td>
                           <td className="border-r p-3 text-center">{row.reject}</td>
                           <td className="border-r p-3 text-right">{row.taxValue}</td>
                           <td className="border-r p-3 text-center">{row.yetToUpload}</td>
                           <td className="p-3 text-center">
                             <Button variant="link" className="text-blue-600 h-auto p-0 font-medium">View →</Button>
                           </td>
                         </tr>
                       ))}
                       <tr className="border-t-2 font-semibold bg-slate-50">
                           <td className="border-r p-3 text-slate-800">TOTAL</td>
                           <td className="border-r p-3 text-center bg-[#fdfaf2]">{summaryData.reduce((acc, row) => acc + parseVal(row.total), 0)}</td>
                           <td className="border-r p-3 text-center">{summaryData.reduce((acc, row) => acc + parseVal(row.noAction), 0)}</td>
                           <td className="border-r p-3 text-center">{summaryData.reduce((acc, row) => acc + parseVal(row.accept), 0)}</td>
                           <td className="border-r p-3 text-center">{summaryData.reduce((acc, row) => acc + parseVal(row.pending), 0)}</td>
                           <td className="border-r p-3 text-center">{summaryData.reduce((acc, row) => acc + parseVal(row.reject), 0)}</td>
                           <td className="border-r p-3 text-right">1,06,871.74</td>
                           <td className="border-r p-3 text-center">{summaryData.reduce((acc, row) => acc + parseVal(row.yetToUpload), 0)}</td>
                           <td className="p-3"></td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'document' && (
           <IMSDocumentViewTable />
        )}
      </div>
    </div>
  );
}

const parseVal = (val: string | number) => {
  if (typeof val === 'number') return val;
  return Number(val.replace(/,/g, '')) || 0;
};

const summaryData = [
  { section: 'B2B - Invoices', total: 69, noAction: 69, accept: 0, pending: 0, reject: 0, taxValue: '1,06,477.54', yetToUpload: 0 },
  { section: 'B2B - Invoices (Amendments)', total: 1, noAction: 1, accept: 0, pending: 0, reject: 0, taxValue: '574.2', yetToUpload: 0 },
  { section: 'B2B - Debit Notes', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'B2B - Debit Notes (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'B2B - Credit Notes', total: 1, noAction: 0, accept: 0, pending: 0, reject: 1, taxValue: '(180)', yetToUpload: 0 },
  { section: 'B2B - Credit Notes (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'ECO [9(5)] - Invoices', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'ECO [9(5)] - Invoices (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'IMPG - Import of Goods from Overseas', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'IMPG (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'IMPGSEZ - Import of Goods from SEZ', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
  { section: 'IMPGSEZ (Amendments)', total: 0, noAction: 0, accept: 0, pending: 0, reject: 0, taxValue: 0, yetToUpload: 0 },
];
