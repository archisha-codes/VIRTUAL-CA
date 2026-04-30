/**
 * GSTR-1 Prepare Table Component
 * 
 * Enterprise SaaS-style table showing:
 * - Business rows with expandable child GSTIN rows
 * - Document counts, taxable amounts, tax breakdown
 * - Checkbox selection
 * - VIEW SECTIONS links
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  Circle,
  FileText,
  Building2,
  Link2,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types
export interface GSTR1BusinessData {
  id: string;
  businessName: string;
  gstins: GSTR1GstinData[];
}

export interface GSTR1GstinData {
  id: string;
  gstin: string;
  legalName: string;
  state: string;
  status: 'filed' | 'pending' | 'available';
  // Data fields
  docCount: number;
  taxableAmount: number;
  totalTax: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalInvoiceValue: number;
  // Sections data
  sections?: GSTR1SectionData[];
}

export interface GSTR1SectionData {
  id: string;
  name: string;
  docCount: number;
  taxableAmount: number;
  tax: number;
  totalInvoiceValue?: number;
}

interface GSTR1PrepareTableProps {
  businesses: GSTR1BusinessData[];
  onSelectionChange?: (selectedGstins: string[]) => void;
  onViewSections?: (gstin: string) => void;
  onEdit?: (gstin: string) => void;
  onDelete?: (gstin: string) => void;
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format number
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export default function GSTR1PrepareTable({
  businesses,
  onSelectionChange,
  onViewSections,
  onEdit,
  onDelete
}: GSTR1PrepareTableProps) {
  // Expanded state for businesses
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set());
  // Selected GSTINs
  const [selectedGstins, setSelectedGstins] = useState<Set<string>>(new Set());
  // Expanded sections for each GSTIN
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Toggle business expansion
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

  // Toggle GSTIN selection
  const toggleGstinSelection = (gstin: string) => {
    setSelectedGstins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gstin)) {
        newSet.delete(gstin);
      } else {
        newSet.add(gstin);
      }
      // Notify parent
      onSelectionChange?.(Array.from(newSet));
      return newSet;
    });
  };

  // Toggle section expansion
  const toggleSection = (gstinId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gstinId)) {
        newSet.delete(gstinId);
      } else {
        newSet.add(gstinId);
      }
      return newSet;
    });
  };

  // Calculate totals for a business
  const calculateBusinessTotals = (business: GSTR1BusinessData) => {
    return business.gstins.reduce((acc, gstin) => ({
      docCount: acc.docCount + (gstin.docCount || 0),
      taxableAmount: acc.taxableAmount + (gstin.taxableAmount || 0),
      totalTax: acc.totalTax + (gstin.totalTax || 0),
      igst: acc.igst + (gstin.igst || 0),
      cgst: acc.cgst + (gstin.cgst || 0),
      sgst: acc.sgst + (gstin.sgst || 0),
      cess: acc.cess + (gstin.cess || 0),
      totalInvoiceValue: acc.totalInvoiceValue + (gstin.totalInvoiceValue || 0),
    }), {
      docCount: 0,
      taxableAmount: 0,
      totalTax: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalInvoiceValue: 0
    });
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'filed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Filed</Badge>;
      case 'available':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Available</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  // If no data
  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          No Data Available
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Upload your sales register or import data from GSTN to see your GSTR-1 data here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <TableHead className="w-10"></TableHead>
            <TableHead className="w-10"></TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Business</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300"># Docs</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Taxable Amount</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Total Tax</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">IGST (₹)</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">CGST (₹)</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">SGST (₹)</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Cess (₹)</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Doc Value (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((business) => {
            const isExpanded = expandedBusinesses.has(business.id);
            const totals = calculateBusinessTotals(business);
            const allSelected = business.gstins.every(g => selectedGstins.has(g.gstin));
            const someSelected = business.gstins.some(g => selectedGstins.has(g.gstin));

            return (
              <React.Fragment key={business.id}>
                {/* Business Row */}
                <TableRow 
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  onClick={() => toggleBusinessExpansion(business.id)}
                >
                  <TableCell className="w-10">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </TableCell>
                  <TableCell className="w-10">
                    <Checkbox 
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        // Prevent row click when clicking checkbox
                        business.gstins.forEach(g => {
                          if (checked) {
                            if (!selectedGstins.has(g.gstin)) {
                              toggleGstinSelection(g.gstin);
                            }
                          } else {
                            if (selectedGstins.has(g.gstin)) {
                              toggleGstinSelection(g.gstin);
                            }
                          }
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-corporate-primary" />
                      {business.businessName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatNumber(totals.docCount)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(totals.taxableAmount)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(totals.totalTax)}
                  </TableCell>
                  <TableCell className="text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(totals.igst)}
                  </TableCell>
                  <TableCell className="text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(totals.cgst)}
                  </TableCell>
                  <TableCell className="text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(totals.sgst)}
                  </TableCell>
                  <TableCell className="text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(totals.cess)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-corporate-primary">
                    {formatCurrency(totals.totalInvoiceValue || 0)}
                  </TableCell>
                </TableRow>

                {/* Child GSTIN Rows */}
                {isExpanded && business.gstins.map((gstin) => {
                  const isSectionExpanded = expandedSections.has(gstin.id);
                  
                  return (
                    <React.Fragment key={gstin.id}>
                      <TableRow 
                        className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                      >
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={selectedGstins.has(gstin.gstin)}
                              onCheckedChange={() => toggleGstinSelection(gstin.gstin)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                  {gstin.state.toUpperCase()} {gstin.gstin}
                                </span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); onViewSections?.(gstin.gstin); }}
                                className="text-[10px] text-blue-600 font-bold text-left uppercase hover:underline mt-1.5 focus:outline-none tracking-tight"
                              >
                                View Sections
                              </button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-300">
                          {formatNumber(gstin.docCount)}
                        </TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-300">
                          {formatCurrency(gstin.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-300">
                          {formatCurrency(gstin.totalTax)}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(gstin.igst)}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(gstin.cgst)}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(gstin.sgst)}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(gstin.cess)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-corporate-primary">
                          {formatCurrency(gstin.totalInvoiceValue)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
