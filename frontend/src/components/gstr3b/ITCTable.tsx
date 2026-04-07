import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EligibleITC } from '@/hooks/useGSTR3BData';

interface ITCTableProps {
  data: EligibleITC;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ITCTable({ data }: ITCTableProps) {
  const rows = [
    { 
      label: '(A) ITC Available (whether in full or part)', 
      sublabel: 'Import of goods, Import of services, Inward supplies liable to reverse charge, Inward supplies from ISD, All other ITC',
      ...data.itcAvailable,
      type: 'available' as const,
    },
    { 
      label: '(B) ITC Reversed', 
      sublabel: 'As per rules 42 & 43 of CGST Rules and others',
      ...data.itcReversed,
      type: 'reversed' as const,
    },
    { 
      label: '(C) Net ITC Available (A) - (B)', 
      sublabel: '',
      ...data.netItc,
      type: 'net' as const,
    },
    { 
      label: '(D) Ineligible ITC', 
      sublabel: 'As per section 17(5)',
      ...data.ineligibleItc,
      type: 'ineligible' as const,
    },
  ];

  const hasNoITC = rows.every(row => row.igst === 0 && row.cgst === 0 && row.sgst === 0 && row.cess === 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">4. Eligible ITC</CardTitle>
            <CardDescription>Details of eligible Input Tax Credit (ITC) availed during the tax period</CardDescription>
          </div>
          {hasNoITC && (
            <Badge variant="outline" className="text-muted-foreground">
              No purchase invoices uploaded
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Details</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST/UTGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow 
                  key={index} 
                  className={row.type === 'net' ? 'bg-muted/30 font-semibold' : ''}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{row.label}</span>
                      {row.sublabel && (
                        <p className="text-xs text-muted-foreground mt-1">{row.sublabel}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cess)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasNoITC && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Upload purchase invoices to calculate eligible Input Tax Credit
          </p>
        )}
      </CardContent>
    </Card>
  );
}
