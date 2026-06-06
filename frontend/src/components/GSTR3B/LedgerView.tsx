/**
 * LedgerView - ITC Credit Utilization View
 * 
 * Displays ITC credit ledger with cross-utilization visualization:
 * - IGST can be used for IGST → CGST → SGST
 * - CGST can be used for CGST → IGST
 * - SGST can be used for SGST → IGST
 * - No direct CGST ↔ SGST utilization
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CreditCard, RefreshCw } from 'lucide-react';

interface LedgerBalance {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

interface UtilizationDetail {
  from: string;
  to: string;
  amount: number;
}

interface LedgerViewProps {
  availableCredit: LedgerBalance;
  utilizedCredit: LedgerBalance;
  utilizationDetails?: {
    igst_utilized: number;
    cgst_utilized: number;
    sgst_utilized: number;
    cess_utilized: number;
    cross_utilization: UtilizationDetail[];
  };
  taxLiability?: LedgerBalance;
  remainingLiability?: LedgerBalance;
}

export function LedgerView({
  availableCredit,
  utilizedCredit,
  utilizationDetails,
  taxLiability,
  remainingLiability,
}: LedgerViewProps) {
  
  const formatCurrency = (value: number) => 
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}`;

  const getUtilizationPercentage = (utilized: number, available: number) => {
    if (available === 0) return 0;
    return Math.round((utilized / available) * 100);
  };

  // Calculate totals
  const totalAvailable = 
    (availableCredit.igst || 0) + 
    (availableCredit.cgst || 0) + 
    (availableCredit.sgst || 0) + 
    (availableCredit.cess || 0);
    
  const totalUtilized = 
    (utilizedCredit.igst || 0) + 
    (utilizedCredit.cgst || 0) + 
    (utilizedCredit.sgst || 0) + 
    (utilizedCredit.cess || 0);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              ITC Credit Ledger
            </CardTitle>
            <CardDescription>
              Track ITC utilization with cross-utilization rules
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Credit Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 mb-1">Available Credit</div>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(totalAvailable)}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 mb-1">Utilized Credit</div>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(totalUtilized)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 mb-1">Remaining Credit</div>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(totalAvailable - totalUtilized)}
            </div>
          </div>
        </div>

        {/* Credit Breakdown Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tax Type</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Utilized</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">IGST</TableCell>
              <TableCell className="text-right">{formatCurrency(availableCredit.igst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(utilizedCredit.igst)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency((availableCredit.igst || 0) - (utilizedCredit.igst || 0))}
              </TableCell>
              <TableCell>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full" 
                    style={{ width: `${getUtilizationPercentage(utilizedCredit.igst, availableCredit.igst)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">CGST</TableCell>
              <TableCell className="text-right">{formatCurrency(availableCredit.cgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(utilizedCredit.cgst)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency((availableCredit.cgst || 0) - (utilizedCredit.cgst || 0))}
              </TableCell>
              <TableCell>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-cyan-600 h-2 rounded-full" 
                    style={{ width: `${getUtilizationPercentage(utilizedCredit.cgst, availableCredit.cgst)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">SGST</TableCell>
              <TableCell className="text-right">{formatCurrency(availableCredit.sgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(utilizedCredit.sgst)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency((availableCredit.sgst || 0) - (utilizedCredit.sgst || 0))}
              </TableCell>
              <TableCell>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-teal-600 h-2 rounded-full" 
                    style={{ width: `${getUtilizationPercentage(utilizedCredit.sgst, availableCredit.sgst)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">CESS</TableCell>
              <TableCell className="text-right">{formatCurrency(availableCredit.cess)}</TableCell>
              <TableCell className="text-right">{formatCurrency(utilizedCredit.cess)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency((availableCredit.cess || 0) - (utilizedCredit.cess || 0))}
              </TableCell>
              <TableCell>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-600 h-2 rounded-full" 
                    style={{ width: `${getUtilizationPercentage(utilizedCredit.cess, availableCredit.cess)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Cross-Utilization Visualization */}
        {utilizationDetails?.cross_utilization && utilizationDetails.cross_utilization.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Cross-Utilization Applied
            </h4>
            <div className="flex flex-wrap gap-2">
              {utilizationDetails.cross_utilization.map((cu, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200"
                >
                  <span className="font-medium text-indigo-700">{cu.from}</span>
                  <ArrowRight className="h-4 w-4 text-indigo-400" />
                  <span className="font-medium text-indigo-700">{cu.to}</span>
                  <span className="text-indigo-600">({formatCurrency(cu.amount)})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tax Liability vs Remaining */}
        {taxLiability && remainingLiability && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-600 mb-1">Tax Liability</div>
              <div className="text-xl font-bold text-red-700">
                {formatCurrency(
                  (taxLiability.igst || 0) + 
                  (taxLiability.cgst || 0) + 
                  (taxLiability.sgst || 0) + 
                  (taxLiability.cess || 0)
                )}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 mb-1">Remaining to Pay</div>
              <div className="text-xl font-bold text-orange-700">
                {formatCurrency(
                  (remainingLiability.igst || 0) + 
                  (remainingLiability.cgst || 0) + 
                  (remainingLiability.sgst || 0) + 
                  (remainingLiability.cess || 0)
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
