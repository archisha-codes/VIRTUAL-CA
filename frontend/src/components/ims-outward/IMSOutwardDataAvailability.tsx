import React, { useState } from 'react';
import { Eye, Download, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function IMSOutwardDataAvailability() {
  const [dataSources] = useState([
    {
      id: 1,
      gstinLocal: 'Delhi',
      gstin: '07AADCB1626P1ZJ',
      returnType: 'IMS_SUPPLIER_GSTR1',
      connection: 'Active',
      status: '100% Downloaded',
      statusSub: '18 of 18 Return Periods',
      refreshedOn: 'Apr 12, 2026 01:52 AM',
    },
    {
      id: 2,
      gstinLocal: 'Delhi',
      gstin: '07AADCB1626P1ZJ',
      returnType: 'IMS_SUPPLIER_GSTR1A',
      connection: 'Active',
      status: '100% Downloaded',
      statusSub: '18 of 18 Return Periods',
      refreshedOn: 'Apr 12, 2026 01:52 AM',
    }
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-slate-50/30 p-6 overflow-y-auto">
      {/* Status Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Successfully downloaded</h2>
        <span className="px-2 py-0.5 rounded text-sm font-medium bg-green-100 text-green-700">2 of 2</span>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8fafd] border-b">
              <th className="p-3 text-left font-bold text-xs uppercase text-slate-600 border-r w-[25%]">PAN/GSTINs</th>
              <th className="p-3 text-left font-bold text-xs uppercase text-slate-600 border-r w-[15%]">RETURN TYPE</th>
              <th className="p-3 text-center font-bold text-xs uppercase text-slate-600 border-r w-[15%]">GSTN CONNECTION</th>
              <th className="p-3 text-center font-bold text-xs uppercase text-slate-600 border-r w-[15%]">DOWNLOAD STATUS</th>
              <th className="p-3 text-left font-bold text-xs uppercase text-slate-600 border-r w-[15%]">REFRESHED ON</th>
              <th className="p-3 text-center font-bold text-xs uppercase text-slate-600 border-r w-[10%]">Actions</th>
              <th className="p-3 text-center font-bold text-xs uppercase text-slate-600 w-[10%]">VIEW DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {/* Parent Row */}
            <tr className="border-b bg-white">
              <td colSpan={7} className="p-3 border-r">
                <div className="flex items-center gap-3">
                  <Checkbox id="select-all" className="rounded-[4px]" />
                  <span className="font-semibold text-slate-800 text-xs">
                    Bauer Specialized Foundation Contractor India Private Limited AADCB1626P
                  </span>
                </div>
              </td>
            </tr>

            {/* Child Rows */}
            {dataSources.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors">
                <td className="p-4 border-r align-top">
                  <div className="flex flex-col ml-8">
                    <span className="text-xs text-slate-700">{row.gstinLocal}</span>
                    <span className="text-xs text-slate-500 font-mono mt-0.5">{row.gstin}</span>
                  </div>
                </td>
                <td className="p-4 border-r align-top">
                  <span className="text-xs font-medium text-slate-700">{row.returnType}</span>
                </td>
                <td className="p-4 border-r text-center align-top">
                  <span className="text-xs font-semibold text-green-600">{row.connection}</span>
                </td>
                <td className="p-4 border-r text-center align-top">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold text-green-600">{row.status}</span>
                    <span className="text-xs text-slate-500 mt-1">{row.statusSub}</span>
                  </div>
                </td>
                <td className="p-4 border-r align-top">
                  <span className="text-xs text-slate-700">{row.refreshedOn}</span>
                </td>
                <td className="p-3 border-r text-center align-top">
                  <Button variant="outline" size="sm" className="h-8 rounded-full text-blue-600 border-blue-200 hover:bg-blue-50 font-medium px-4">
                    <RotateCw className="h-3 w-3 mr-2" /> Download again
                  </Button>
                </td>
                <td className="p-3 text-center align-top">
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:bg-blue-50 font-medium px-4">
                    <Eye className="h-4 w-4 mr-2" /> View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
