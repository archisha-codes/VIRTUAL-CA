import React, { useState } from 'react';
import { Filter, ChevronDown, Download, Eye, FileSpreadsheet, EyeOff, LogOut, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IMSFilterSidebar } from './IMSFilterSidebar';

export function IMSDocumentViewTable() {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden">
        {/* Top Summary Row */}
        <div className="flex-none border-b shrink-0 bg-white flex shadow-sm z-20">
           <div className="flex items-center overflow-x-auto hide-scrollbar w-full text-sm">
             <div className="flex flex-col border-r px-4 py-2 bg-[#fdfaf2] min-w-[200px]">
                <span className="text-slate-500 font-medium">Total number of documents</span>
                <span className="font-semibold text-lg text-slate-800 text-center">71</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[120px]">
                <span className="text-slate-500 font-medium text-center">No Action</span>
                <span className="font-semibold text-lg text-blue-600 text-center">0</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[120px]">
                <span className="text-slate-500 font-medium text-center">Accept</span>
                <span className="font-semibold text-lg text-slate-800 text-center">0</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[120px]">
                <span className="text-slate-500 font-medium text-center">Pending</span>
                <span className="font-semibold text-lg text-slate-800 text-center">0</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[120px]">
                <span className="text-slate-500 font-medium text-center">Reject</span>
                <span className="font-semibold text-lg text-red-500 text-center">1</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[200px]">
                <span className="text-slate-500 font-medium text-center">Actions Yet to be Uploaded</span>
                <span className="font-semibold text-lg text-slate-800 text-center">0</span>
             </div>
             <div className="flex flex-col border-r px-6 py-2 min-w-[150px]">
                <span className="text-slate-500 font-medium text-right">Total Tax Value (₹)</span>
                <span className="font-semibold text-lg text-slate-800 text-right">1,06,871.74</span>
             </div>
             <div className="flex flex-col px-6 py-2 min-w-[150px]">
                <span className="text-slate-500 font-medium text-right">Taxable Value (₹)</span>
                <span className="font-semibold text-lg text-slate-800 text-right">5,93,730.79</span>
             </div>
           </div>
        </div>

        {/* Toolbar */}
        <div className="flex-none p-2 border-b bg-slate-50 shrink-0 flex items-center justify-between z-10 relative">
            <Button 
              variant="outline" 
              className="bg-white border-slate-200 h-8 gap-2 px-3"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="h-4 w-4" /> Filter
            </Button>
            <Button variant="outline" className="bg-white border-slate-200 h-8 gap-2 px-3">
              <Download className="h-4 w-4" /> Download Excel
            </Button>
        </div>

        {/* Massive Table */}
        <div className="flex-1 overflow-auto relative overscroll-contain bg-white">
           <table className="w-auto border-collapse text-xs">
              <thead className="bg-[#fcfdfd] sticky top-0 z-20 whitespace-nowrap shadow-sm border-b">
                 <tr>
                    <th className="p-3 border-r border-b font-medium text-slate-500 sticky left-0 z-30 bg-[#fcfdfd] min-w-[40px]">
                      <Checkbox />
                    </th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[150px]">Document Number</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[140px]">IMS Action (Govt.)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px]">Document Type</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px]">Document Date</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[140px]">Supplier GSTIN</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[180px]">Trade/Legal Name</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[140px]">My GSTIN</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px]">Place of Supply</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px] text-right">Document Value</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px] text-right">Taxable Value</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px] text-right">Total tax value</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px] text-right">IGST</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px] text-right">CGST</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px] text-right">SGST</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px] text-right">CESS</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[150px]">Source Return Period</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[180px]">Source Return Filling Status</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px]">Section Name</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[180px]">Port Code (Import Docs)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[200px]">Amendment Type (Import Docs)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[220px]">ICEGATE Reference Date (Import Docs)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[200px]">Reverse Charge Applicable?</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[180px]">Original Document Number</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[160px]">Original Document Date</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[120px]">Supplier Pan</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[180px]">IN Pending Action Blocked</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px]">Form Type</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[100px]">Invoice Type</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[160px]">Unique Key</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[160px]">is ITC Reduction Blocked</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[250px]">Whether ITC to be Reduced (Govt. Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[220px] text-right">ITC Reduction IGST (Govt Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[220px] text-right">ITC Reduction SGST (Govt Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[220px] text-right">ITC Reduction CGST (Govt Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[220px] text-right">ITC Reduction CESS (Govt Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[250px]">IMS Remarks GSTN (Govt Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[280px]">Whether ITC to be Reduced (Virtual CA Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[240px] text-right">ITC Reduction IGST (Clear Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[240px] text-right">ITC Reduction SGST (Clear Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[240px] text-right">ITC Reduction CGST (Virtual CA Platform)</th>
                    <th className="p-3 border-r border-b font-medium text-slate-500 min-w-[240px] text-right">ITC Reduction CESS (Virtual CA Platform)</th>
                    
                    {/* Fixed Right Columns */}
                    <th className="p-3 border-r border-l shadow-[-4px_0_10px_rgba(0,0,0,0.05)] border-b font-medium text-slate-800 bg-blue-50 sticky right-[250px] z-30 min-w-[150px]">
                      IMS Action<br/>(Clear Platform)
                    </th>
                    <th className="p-3 border-r border-b font-medium text-slate-800 bg-blue-50 sticky right-[100px] z-30 min-w-[150px]">
                      IMS Remarks-GSTN<br/>(Virtual CA Platform)
                    </th>
                    <th className="p-3 border-b font-medium text-slate-800 bg-blue-50 sticky right-0 z-30 min-w-[100px]">
                      Upload<br/>Status
                    </th>
                 </tr>
              </thead>
              <tbody className="whitespace-nowrap">
                 {mockDocs.map((doc, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                       <td className="p-3 border-r sticky left-0 z-10 bg-white"><Checkbox /></td>
                       <td className="p-3 border-r font-medium text-slate-800">{doc.docNumber}</td>
                       <td className="p-3 border-r text-blue-600 font-medium">{doc.imsActionGovt}</td>
                       <td className="p-3 border-r text-slate-700">{doc.docType}</td>
                       <td className="p-3 border-r text-slate-700">{doc.docDate}</td>
                       <td className="p-3 border-r text-slate-700">{doc.suppGstin}</td>
                       <td className="p-3 border-r text-slate-700">{doc.tradeName}</td>
                       <td className="p-3 border-r text-slate-700">{doc.myGstin}</td>
                       <td className="p-3 border-r text-slate-700">{doc.pos}</td>
                       <td className="p-3 border-r text-right text-slate-800">{doc.docValue}</td>
                       <td className="p-3 border-r text-right text-slate-800">{doc.taxableValue}</td>
                       <td className="p-3 border-r text-right text-slate-800">{doc.totalTax}</td>
                       <td className="p-3 border-r text-right text-slate-700">{doc.igst}</td>
                       <td className="p-3 border-r text-right text-slate-700">{doc.cgst}</td>
                       <td className="p-3 border-r text-right text-slate-700">{doc.sgst}</td>
                       <td className="p-3 border-r text-right text-slate-700">{doc.cess}</td>
                       <td className="p-3 border-r text-slate-700">{doc.sourcePeriod}</td>
                       <td className="p-3 border-r text-slate-700">{doc.sourceStatus}</td>
                       <td className="p-3 border-r text-slate-700">{doc.section}</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">NA</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">{doc.suppPan}</td>
                       <td className="p-3 border-r text-slate-700">No</td>
                       <td className="p-3 border-r text-slate-700">GSTR-1/IFF</td>
                       <td className="p-3 border-r text-slate-700">Regular</td>
                       <td className="p-3 border-r text-slate-700 font-mono text-[10px]">{doc.uniqueKey}</td>
                       <td className="p-3 border-r text-slate-700">False</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-slate-700">-</td>
                       <td className="p-3 border-r text-slate-700">NA</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>
                       <td className="p-3 border-r text-right text-slate-700">0.00</td>

                       {/* Fixed Right Columns Data */}
                       <td className="p-2 border-r border-l shadow-[-4px_0_10px_rgba(0,0,0,0.02)] sticky right-[250px] z-10 bg-slate-50/90 backdrop-blur">
                          <Button variant="outline" size="sm" className="w-full text-left justify-between bg-white text-slate-600 h-8 font-normal shadow-sm">
                             {doc.actionClear || 'Select'} <ChevronDown className="h-3 w-3 opacity-50 ml-2" />
                          </Button>
                       </td>
                       <td className="p-3 border-r text-slate-700 sticky right-[100px] z-10 bg-slate-50/90 backdrop-blur w-[150px]">
                          <div className="flex items-center justify-center">
                             <span className="text-blue-500 cursor-pointer">
                                <DocumentIcon />
                             </span>
                          </div>
                       </td>
                       <td className="p-3 text-center sticky right-0 z-10 bg-slate-50/90 backdrop-blur w-[100px]">
                          {doc.uploadStatus ? (
                             <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-100 rounded">Uploaded</span>
                          ) : (
                             <span className="text-slate-400">-</span>
                          )}
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
        
        <IMSFilterSidebar open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

const mockDocs = [
  { docNumber: 'FCU2629705747952', imsActionGovt: 'No Action', docType: 'Invoice', docDate: '2025-10-24', suppGstin: '07AAACH2702H1Z2', tradeName: 'HDFC BANK LTD.', myGstin: '07AAICB4900F1Z0', pos: 'DELHI', docValue: '8,226.84', taxableValue: '6,971.90', totalTax: '1,254.94', igst: '0.00', cgst: '627.47', sgst: '627.47', cess: '0.00', sourcePeriod: '102025', sourceStatus: 'Filed', section: 'B2B', suppPan: 'AAACH2702H', uniqueKey: '032609470223fdd9', actionClear: '', uploadStatus: false },
  { docNumber: 'FCU2629604801469', imsActionGovt: 'No Action', docType: 'Invoice', docDate: '2025-10-23', suppGstin: '07AAACH2702H1Z2', tradeName: 'HDFC BANK LTD.', myGstin: '07AAICB4900F1Z0', pos: 'DELHI', docValue: '30,427.33', taxableValue: '25,785.87', totalTax: '4,641.46', igst: '0.00', cgst: '2,320.73', sgst: '2,320.73', cess: '0.00', sourcePeriod: '102025', sourceStatus: 'Filed', section: 'B2B', suppPan: 'AAACH2702H', uniqueKey: '04c7c531f702e3f0', actionClear: '', uploadStatus: false },
  { docNumber: 'PPI2629604798493', imsActionGovt: 'No Action', docType: 'Invoice', docDate: '2025-10-19', suppGstin: '27AAACH2702H5ZW', tradeName: 'HDFC BANK LIMITED', myGstin: '07AAICB4900F1Z0', pos: 'DELHI', docValue: '123.90', taxableValue: '105.00', totalTax: '18.90', igst: '18.90', cgst: '0.00', sgst: '0.00', cess: '0.00', sourcePeriod: '102025', sourceStatus: 'Filed', section: 'B2B', suppPan: 'AAACH2702H', uniqueKey: '0af6b7eca1f8ecf6', actionClear: '', uploadStatus: false },
  { docNumber: 'BM2507I006347907', imsActionGovt: 'No Action', docType: 'Invoice', docDate: '2024-10-03', suppGstin: '07AAACB2894G1ZP', tradeName: 'Bharti Airtel Limited', myGstin: '07AAICB4900F1Z0', pos: 'DELHI', docValue: '3,764.20', taxableValue: '3,190.00', totalTax: '574.20', igst: '0.00', cgst: '287.10', sgst: '287.10', cess: '0.00', sourcePeriod: '102025', sourceStatus: 'Filed', section: 'B2BA', suppPan: 'AAACB2894G', uniqueKey: '10030d22eb4111b8', actionClear: '', uploadStatus: false },
  { docNumber: '5598', imsActionGovt: 'Reject', docType: 'Credit Note', docDate: '2025-10-26', suppGstin: '07ZLIPK1816A1ZJ', tradeName: 'KUMAR TRADERS', myGstin: '07AAICB4900F1Z0', pos: 'DELHI', docValue: '(1,180.00)', taxableValue: '(1,000.00)', totalTax: '(180.00)', igst: '0.00', cgst: '(90.00)', sgst: '(90.00)', cess: '0.00', sourcePeriod: '102025', sourceStatus: 'Filed', section: 'CDNR', suppPan: 'ZLIPK1816A', uniqueKey: '0983bd7eca1f8ecf', actionClear: 'Reject', uploadStatus: true },
];

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );
}
