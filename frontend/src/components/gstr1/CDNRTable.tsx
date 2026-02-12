import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CDNRCustomer } from '@/hooks/useGSTR1Data';

interface CDNRTableProps {
  data: CDNRCustomer[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function CustomerRow({ customer }: { customer: CDNRCustomer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </TableCell>
          <TableCell className="font-mono text-sm">{customer.customerGstin}</TableCell>
          <TableCell>{customer.customerName}</TableCell>
          <TableCell className="text-center">
            <Badge variant="secondary">{customer.notes.length}</Badge>
          </TableCell>
          <TableCell className="text-right">{formatCurrency(customer.totalTaxableValue)}</TableCell>
          <TableCell className="text-right">{formatCurrency(customer.totalTax)}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <div className="bg-muted/30 p-4">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Note No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">Note Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.notes.map((note, idx) => (
                    <TableRow key={idx} className="text-sm">
                      <TableCell className="font-medium">{note.noteNumber}</TableCell>
                      <TableCell>{formatDate(note.noteDate)}</TableCell>
                      <TableCell>
                        <Badge variant={note.noteType === 'C' ? 'default' : 'destructive'} className="text-xs">
                          {note.noteType === 'C' ? 'Credit' : 'Debit'}
                        </Badge>
                      </TableCell>
                      <TableCell>{note.placeOfSupply || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.taxableValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.igst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.cgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.sgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.noteValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CDNRTable({ data }: CDNRTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Credit/Debit Notes Found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          CDN/R includes credit and debit notes issued to registered persons.
          Upload invoices with type 'Credit Note' or 'Debit Note' to see data here.
        </p>
      </div>
    );
  }

  const totalNotes = data.reduce((sum, cust) => sum + cust.notes.length, 0);
  const totalTaxableValue = data.reduce((sum, cust) => sum + cust.totalTaxableValue, 0);
  const totalTax = data.reduce((sum, cust) => sum + cust.totalTax, 0);
  const creditNotes = data.reduce((sum, cust) => sum + cust.notes.filter(n => n.noteType === 'C').length, 0);
  const debitNotes = totalNotes - creditNotes;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Unique Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalNotes}</div>
            <p className="text-xs text-muted-foreground">Total Notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{creditNotes} / {debitNotes}</div>
            <p className="text-xs text-muted-foreground">Credit / Debit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalTaxableValue)}</div>
            <p className="text-xs text-muted-foreground">Taxable Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalTax)}</div>
            <p className="text-xs text-muted-foreground">Total Tax</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CDN/R - 9B Credit/Debit Notes (Registered)</CardTitle>
          <CardDescription>
            Credit and debit notes issued to registered persons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Customer GSTIN</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead className="text-center">Notes</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((customer) => (
                  <CustomerRow key={customer.customerGstin} customer={customer} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
