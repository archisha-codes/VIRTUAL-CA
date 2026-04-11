import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Building2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export interface GSTR3BBusinessData {
  id: string;
  businessName: string;
  gstins: GSTR3BGstinData[];
}

export interface GSTR3BGstinData {
  id: string;
  gstin: string;
  state: string;
  totalLiability: number;
  outwardSupplies: number;
  inwardSuppliesRCM: number;
  outwardSupplies95: number;
  netAvailableITC: number;
  interestLateFees: number;
}

interface GSTR3BPrepareTableProps {
  businesses: GSTR3BBusinessData[];
  onSelectionChange?: (selectedGstins: string[]) => void;
}

export default function GSTR3BPrepareTable({
  businesses,
  onSelectionChange
}: GSTR3BPrepareTableProps) {
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set(businesses.map(b => b.id)));
  const [selectedGstins, setSelectedGstins] = useState<Set<string>>(new Set());

  const toggleBusinessExpansion = (businessId: string) => {
    setExpandedBusinesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(businessId)) {
        newSet.delete(businessId);
      } else {
        newSet.add(businessId);
      }
      return newSet;
    });
  };

  const toggleGstinSelection = (gstin: string) => {
    setSelectedGstins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gstin)) {
        newSet.delete(gstin);
      } else {
        newSet.add(gstin);
      }
      onSelectionChange?.(Array.from(newSet));
      return newSet;
    });
  };

  const calculateBusinessTotals = (business: GSTR3BBusinessData) => {
    return business.gstins.reduce((acc, gstin) => ({
      totalLiability: acc.totalLiability + (gstin.totalLiability || 0),
      outwardSupplies: acc.outwardSupplies + (gstin.outwardSupplies || 0),
      inwardSuppliesRCM: acc.inwardSuppliesRCM + (gstin.inwardSuppliesRCM || 0),
      outwardSupplies95: acc.outwardSupplies95 + (gstin.outwardSupplies95 || 0),
      netAvailableITC: acc.netAvailableITC + (gstin.netAvailableITC || 0),
      interestLateFees: acc.interestLateFees + (gstin.interestLateFees || 0),
    }), {
      totalLiability: 0,
      outwardSupplies: 0,
      inwardSuppliesRCM: 0,
      outwardSupplies95: 0,
      netAvailableITC: 0,
      interestLateFees: 0,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toFixed(2);
  };

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
      <Table className="whitespace-nowrap w-full text-xs">
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-700/50">
            <TableHead className="w-[40px] px-2 border-r border-slate-200 dark:border-slate-700"></TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[250px] border-r border-slate-200 dark:border-slate-700">BUSINESS</TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700 w-[120px]">STATUS</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[200px] border-r border-slate-200 dark:border-slate-700">
              <div>TOTAL LIABILITY (3.1 a,b,c,d,e + 3.1.1 + 5.1)</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL TAX VALUE (₹)</div>
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[180px] border-r border-slate-200 dark:border-slate-700">
              <div>TABLE 3.1 (a,b,c & e) OUTWARD SUPPLIES</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL TAX VALUE (₹)</div>
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[180px] border-r border-slate-200 dark:border-slate-700">
              <div>TABLE 3.1 (d) INWARD SUPPLIES - RCM</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL TAX VALUE (₹)</div>
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[180px] border-r border-slate-200 dark:border-slate-700">
              <div>TABLE 3.1.1 OUTWARD SUPPLIES U/S 9(5)</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL TAX VALUE (₹)</div>
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[200px] border-r border-slate-200 dark:border-slate-700">
              <div>TABLE 4C NET AVAILABLE ITC (AVAILABLE - REVERSAL)</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL TAX VALUE (₹)</div>
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 px-4 min-w-[180px]">
              <div>TABLE 5.1 - INTEREST AND LATE FEES</div>
              <div className="text-[10px] font-normal text-slate-500 mt-1">TOTAL VALUE (₹)</div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((business) => {
            const isExpanded = expandedBusinesses.has(business.id);
            const totals = calculateBusinessTotals(business);
            const allSelected = business.gstins.every(g => selectedGstins.has(g.gstin));

            return (
              <React.Fragment key={business.id}>
                <TableRow 
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer border-b"
                  onClick={() => toggleBusinessExpansion(business.id)}
                >
                  <TableCell className="px-2 border-r border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-center">
                      <Checkbox 
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          business.gstins.forEach(g => {
                            if (checked) {
                              if (!selectedGstins.has(g.gstin)) toggleGstinSelection(g.gstin);
                            } else {
                              if (selectedGstins.has(g.gstin)) toggleGstinSelection(g.gstin);
                            }
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="border border-blue-200 rounded text-blue-500 flex items-center justify-center w-4 h-4 bg-blue-50">
                        {isExpanded ? <span className="text-[10px] leading-none mb-0.5">-</span> : <span className="text-[10px] leading-none mb-0.5">+</span>}
                      </div>
                      {business.businessName}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 border-r border-slate-200 dark:border-slate-700"></TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    {formatAmount(totals.totalLiability)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    {formatAmount(totals.outwardSupplies)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    {formatAmount(totals.inwardSuppliesRCM)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    {formatAmount(totals.outwardSupplies95)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4 border-r border-slate-200 dark:border-slate-700">
                    {formatAmount(totals.netAvailableITC)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100 px-4">
                    {formatAmount(totals.interestLateFees)}
                  </TableCell>
                </TableRow>

                {isExpanded && business.gstins.map((gstin) => (
                  <TableRow 
                    key={gstin.id}
                    className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/30 border-b"
                  >
                    <TableCell className="px-2 border-r border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-center">
                        <Checkbox 
                          checked={selectedGstins.has(gstin.gstin)}
                          onCheckedChange={() => toggleGstinSelection(gstin.gstin)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 pl-10 border-r border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col">
                        <span className="text-slate-700 dark:text-slate-300">
                          {gstin.state} {gstin.gstin}
                        </span>
                        <button 
                          className="text-[10px] text-blue-600 font-bold uppercase hover:underline mt-0.5 tracking-tight text-left w-fit"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Dispatch event or call a prop function that opens the full drawer
                            const event = new CustomEvent('openGSTR3BModal', { detail: { gstin: gstin.gstin } });
                            window.dispatchEvent(event);
                          }}
                        >
                          VIEW PREPARED 3B
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 border-r border-slate-200 dark:border-slate-700"></TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700">
                      {formatAmount(gstin.totalLiability)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700">
                      {formatAmount(gstin.outwardSupplies)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700">
                      {formatAmount(gstin.inwardSuppliesRCM)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700">
                      {formatAmount(gstin.outwardSupplies95)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4 border-r border-slate-200 dark:border-slate-700">
                      {formatAmount(gstin.netAvailableITC)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-slate-300 px-4">
                      {formatAmount(gstin.interestLateFees)}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
