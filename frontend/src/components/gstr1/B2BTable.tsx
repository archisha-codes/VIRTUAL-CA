import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { B2BCustomer } from '@/hooks/useGSTR1Data';

interface B2BTableProps {
  data: B2BCustomer[];
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

function CustomerRow({ customer }: { customer: B2BCustomer }) {
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
            <Badge variant="secondary">{customer.invoices.length}</Badge>
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
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">Invoice Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.invoices.map((invoice, idx) => (
                    <TableRow key={idx} className="text-sm">
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>{invoice.placeOfSupply || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.taxableValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.igst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.cgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.sgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.invoiceValue)}</TableCell>
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

export function B2BTable({ data }: B2BTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No B2B Invoices Found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          B2B invoices are sales to registered businesses (with valid GSTIN). 
          Upload invoices with customer GSTIN to see data here.
        </p>
      </div>
    );
  }

  const totalInvoices = data.reduce((sum, cust) => sum + cust.invoices.length, 0);
  const totalTaxableValue = data.reduce((sum, cust) => sum + cust.totalTaxableValue, 0);
  const totalTax = data.reduce((sum, cust) => sum + cust.totalTax, 0);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Unique Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Total Invoices</p>
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

      {/* B2B Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B2B Invoices - 4A, 4B, 6B, 6C</CardTitle>
          <CardDescription>
            Taxable outward supplies to registered persons
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
                  <TableHead className="text-center">Invoices</TableHead>
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
