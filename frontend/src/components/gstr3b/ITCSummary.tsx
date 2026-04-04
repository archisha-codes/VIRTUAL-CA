/**
 * ITCSummary - ITC Impact Preview
 * 
 * Shows ITC breakdown with impact preview:
 * - Section 4A: ITC Available
 * - Section 4B: ITC Reversed
 * - Section 4C: Net ITC
 * 
 * Color coding:
 * - Green: ITC Available
 * - Red: ITC Reversed
 * - Blue: Net ITC
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowUp, Calculator, TrendingUp, TrendingDown } from 'lucide-react';

interface ITCSummaryProps {
  data?: {
    section_4a?: {
      description?: string;
      imports?: { igst: number; cess: number };
      inward_supplies?: { igst: number; cgst: number; sgst: number; cess: number };
      rcm?: { cgst: number; sgst: number };
      total_igst?: number;
      total_cgst?: number;
      total_sgst?: number;
      total_cess?: number;
    };
    section_4b?: {
      description?: string;
      blocked_credit?: number;
      ims_rejected?: number;
      rule_42?: number;
      rule_43?: number;
      total_reversed?: number;
    };
    section_4c?: {
      description?: string;
      igst?: number;
      cgst?: number;
      sgst?: number;
      cess?: number;
    };
  };
  loading?: boolean;
}

export function ITCSummary({ data, loading }: ITCSummaryProps) {
  const formatCurrency = (value: number) => 
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}`;

  const section4a = data?.section_4a;
  const section4b = data?.section_4b;
  const section4c = data?.section_4c;

  // Calculate totals
  const totalITC = section4a ? 
    (section4a.total_igst || 0) + 
    (section4a.total_cgst || 0) + 
    (section4a.total_sgst || 0) + 
    (section4a.total_cess || 0) : 0;

  const totalReversed = section4b?.total_reversed || 0;
  const totalNet = section4c ? 
    (section4c.igst || 0) + 
    (section4c.cgst || 0) + 
    (section4c.sgst || 0) + 
    (section4c.cess || 0) : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            ITC Summary
          </CardTitle>
          <CardDescription>Input Tax Credit breakdown and impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading ITC data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            ITC Summary
          </CardTitle>
          <CardDescription>Input Tax Credit breakdown and impact</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No ITC data available. Process GSTR-2B to see ITC summary.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          ITC Summary
        </CardTitle>
        <CardDescription>
          Input Tax Credit breakdown - Section 4 of GSTR-3B
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 4A - ITC Available */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">ITC Available (4A)</span>
            </div>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(totalITC)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              From imports, inward supplies & RCM
            </div>
          </div>

          {/* 4B - ITC Reversed */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600 font-medium">ITC Reversed (4B)</span>
            </div>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(totalReversed)}
            </div>
            <div className="text-xs text-red-600 mt-1">
              Blocked credit, IMS rejected, Rule 42/43
            </div>
          </div>

          {/* 4C - Net ITC */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-600 font-medium">Net ITC (4C)</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(totalNet)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Available after reversals
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">CESS</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 4A - ITC Available */}
            <TableRow className="bg-green-50/50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-green-600" />
                  ITC Available
                </div>
              </TableCell>
              <TableCell className="text-right text-green-600">
                {formatCurrency(section4a?.total_igst || 0)}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {formatCurrency(section4a?.total_cgst || 0)}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {formatCurrency(section4a?.total_sgst || 0)}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {formatCurrency(section4a?.total_cess || 0)}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                {formatCurrency(totalITC)}
              </TableCell>
            </TableRow>

            {/* 4A Details */}
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- Imports</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.imports?.igst || 0)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.imports?.cess || 0)}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- Inward Supplies</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.inward_supplies?.igst || 0)}</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.inward_supplies?.cgst || 0)}</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.inward_supplies?.sgst || 0)}</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.inward_supplies?.cess || 0)}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- RCM Inward</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.rcm?.cgst || 0)}</TableCell>
              <TableCell className="text-right">{formatCurrency(section4a?.rcm?.sgst || 0)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>

            {/* 4B - ITC Reversed */}
            <TableRow className="bg-red-50/50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-red-600" />
                  ITC Reversed
                </div>
              </TableCell>
              <TableCell className="text-right text-red-600">-</TableCell>
              <TableCell className="text-right text-red-600">-</TableCell>
              <TableCell className="text-right text-red-600">-</TableCell>
              <TableCell className="text-right text-red-600">-</TableCell>
              <TableCell className="text-right font-medium text-red-600">
                {formatCurrency(totalReversed)}
              </TableCell>
            </TableRow>

            {/* 4B Details */}
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- Blocked Credit</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{formatCurrency(section4b?.blocked_credit || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- IMS Rejected</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{formatCurrency(section4b?.ims_rejected || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground pl-8">- Rule 42/43</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{formatCurrency((section4b?.rule_42 || 0) + (section4b?.rule_43 || 0))}</TableCell>
            </TableRow>

            {/* 4C - Net ITC */}
            <TableRow className="bg-blue-50/50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Net ITC Available
                </div>
              </TableCell>
              <TableCell className="text-right font-medium text-blue-600">
                {formatCurrency(section4c?.igst || 0)}
              </TableCell>
              <TableCell className="text-right font-medium text-blue-600">
                {formatCurrency(section4c?.cgst || 0)}
              </TableCell>
              <TableCell className="text-right font-medium text-blue-600">
                {formatCurrency(section4c?.sgst || 0)}
              </TableCell>
              <TableCell className="text-right font-medium text-blue-600">
                {formatCurrency(section4c?.cess || 0)}
              </TableCell>
              <TableCell className="text-right font-bold text-blue-600">
                {formatCurrency(totalNet)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
