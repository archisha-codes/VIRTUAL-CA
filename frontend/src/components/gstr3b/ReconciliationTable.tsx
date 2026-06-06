/**
 * Reconciliation Table Component
 * Displays ITC reconciliation results with match categories
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ReconciliationEntry } from '@/lib/api';

interface ReconciliationTableProps {
  data: {
    exact_matches: ReconciliationEntry[];
    probable_matches: ReconciliationEntry[];
    gstin_matches: ReconciliationEntry[];
    no_matches: ReconciliationEntry[];
  };
}

function MatchBadge({ category }: { category: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    exact_match: 'default',
    probable_match: 'secondary',
    gstin_match: 'outline',
    no_match: 'destructive',
  };

  const labels: Record<string, string> = {
    exact_match: 'Exact Match',
    probable_match: 'Probable Match',
    gstin_match: 'GSTIN Only',
    no_match: 'No Match',
  };

  return (
    <Badge variant={variants[category] || 'secondary'}>
      {labels[category] || category}
    </Badge>
  );
}

function ReconciliationSection({ 
  title, 
  entries, 
  color 
}: { 
  title: string; 
  entries: ReconciliationEntry[];
  color: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h4 className="font-medium">{title}</h4>
        <Badge variant="outline">{entries.length}</Badge>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier GSTIN</TableHead>
              <TableHead>Invoice No</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead className="text-right">Local Amount</TableHead>
              <TableHead className="text-right">Matched Amount</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 10).map((entry, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">{entry.supplier_gstin}</TableCell>
                <TableCell>{entry.invoice_number}</TableCell>
                <TableCell>{entry.invoice_date}</TableCell>
                <TableCell className="text-right">₹{entry.local_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{entry.matched_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  ₹{entry.difference.toLocaleString()}
                  {entry.difference_percent > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({entry.difference_percent.toFixed(1)}%)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <MatchBadge category={entry.match_category} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {entries.length > 10 && (
          <div className="p-2 text-center text-sm text-muted-foreground">
            Showing 10 of {entries.length} entries
          </div>
        )}
      </div>
    </div>
  );
}

export function ReconciliationTable({ data }: ReconciliationTableProps) {
  // Add defensive checks for missing data
  const exactMatches = data?.exact_matches || [];
  const probableMatches = data?.probable_matches || [];
  const gstinMatches = data?.gstin_matches || [];
  const noMatches = data?.no_matches || [];
  
  const total = 
    exactMatches.length + 
    probableMatches.length + 
    gstinMatches.length + 
    noMatches.length;
  
  const matched = exactMatches.length + probableMatches.length;
  const matchRate = total > 0 ? ((matched / total) * 100).toFixed(1) : '0';

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>ITC Reconciliation</CardTitle>
        <CardDescription>
          Reconciliation of purchase invoices with supplier (GSTR-2B) data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{matched}</p>
            <p className="text-sm text-green-600">Matched</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-700">{noMatches.length}</p>
            <p className="text-sm text-yellow-600">Unmatched</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{matchRate}%</p>
            <p className="text-sm text-blue-600">Match Rate</p>
          </div>
        </div>

        {/* Reconciliation Sections */}
        <div className="space-y-4">
          <ReconciliationSection 
            title="Exact Matches" 
            entries={exactMatches} 
            color="bg-green-500"
          />
          <ReconciliationSection 
            title="Probable Matches" 
            entries={probableMatches} 
            color="bg-blue-500"
          />
          <ReconciliationSection 
            title="GSTIN Matches Only" 
            entries={gstinMatches} 
            color="bg-yellow-500"
          />
          <ReconciliationSection 
            title="No Matches" 
            entries={noMatches} 
            color="bg-red-500"
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Exact: GSTIN + Invoice + Amount</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Probable: Slight amount difference</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>GSTIN Only: Invoice not found</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>No Match: Cannot reconcile</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
