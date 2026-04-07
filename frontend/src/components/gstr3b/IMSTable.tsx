/**
 * IMSTable - Invoice Management System Table
 * 
 * Displays IMS entries with accept/reject actions and color coding:
 * - Green: Accepted (exact match)
 * - Yellow: Pending (probable match)
 * - Red: Rejected (no match)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface IMSEntry {
  gstin: string;
  invoice_number: string;
  invoice_date: string;
  taxable_value: number;
  tax_amount: number;
  match_status: string;
  ims_action: string;
  eligible_itc: number;
  invoice_type: string;
}

interface IMSTableProps {
  data: IMSEntry[];
  onAccept?: (invoiceNumber: string) => void;
  onReject?: (invoiceNumber: string) => void;
  loading?: boolean;
}

export function IMSTable({ data, onAccept, onReject, loading }: IMSTableProps) {
  const [processing, setProcessing] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getRowColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-50/50';
      case 'pending':
        return 'bg-yellow-50/50';
      case 'rejected':
        return 'bg-red-50/50';
      default:
        return '';
    }
  };

  const handleAccept = async (invoiceNumber: string) => {
    setProcessing(invoiceNumber);
    try {
      await onAccept?.(invoiceNumber);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (invoiceNumber: string) => {
    setProcessing(invoiceNumber);
    try {
      await onReject?.(invoiceNumber);
    } finally {
      setProcessing(null);
    }
  };

  // Calculate summary
  const acceptedCount = data.filter(d => d.ims_action === 'accepted').length;
  const pendingCount = data.filter(d => d.ims_action === 'pending').length;
  const rejectedCount = data.filter(d => d.ims_action === 'rejected').length;
  const totalEligibleITC = data.reduce((sum, d) => sum + (d.eligible_itc || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice Management System (IMS)</CardTitle>
          <CardDescription>Match and manage ITC eligibility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice Management System (IMS)</CardTitle>
          <CardDescription>Match and manage ITC eligibility</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No IMS data available. Import GSTR-2B to enable IMS functionality.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoice Management System (IMS)</CardTitle>
            <CardDescription>
              Match invoices from GSTR-2B and manage ITC eligibility
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">{acceptedCount}</span>
              <span className="text-muted-foreground">Accepted</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">{pendingCount}</span>
              <span className="text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium">{rejectedCount}</span>
              <span className="text-muted-foreground">Rejected</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Total Eligible ITC: <span className="font-medium text-green-600">₹{totalEligibleITC.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier GSTIN</TableHead>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Taxable Value</TableHead>
              <TableHead className="text-right">Tax Amount</TableHead>
              <TableHead>Match Status</TableHead>
              <TableHead>ITC Status</TableHead>
              <TableHead className="text-right">Eligible ITC</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={`${entry.gstin}-${entry.invoice_number}`} className={getRowColor(entry.ims_action)}>
                <TableCell className="font-mono text-xs">{entry.gstin}</TableCell>
                <TableCell className="font-medium">{entry.invoice_number}</TableCell>
                <TableCell>{entry.invoice_date}</TableCell>
                <TableCell>{entry.invoice_type}</TableCell>
                <TableCell className="text-right">₹{entry.taxable_value?.toLocaleString('en-IN') || 0}</TableCell>
                <TableCell className="text-right">₹{entry.tax_amount?.toLocaleString('en-IN') || 0}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    entry.match_status === 'exact_match' ? 'bg-green-100 text-green-800' :
                    entry.match_status === 'probable_match' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {entry.match_status?.replace('_', ' ') || 'Unknown'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(entry.ims_action)}
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${getStatusColor(entry.ims_action)}`}>
                      {entry.ims_action}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  ₹{entry.eligible_itc?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || 0}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-green-600 border-green-300 hover:bg-green-50"
                      onClick={() => handleAccept(entry.invoice_number)}
                      disabled={processing === entry.invoice_number || entry.ims_action === 'accepted'}
                    >
                      {processing === entry.invoice_number ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleReject(entry.invoice_number)}
                      disabled={processing === entry.invoice_number || entry.ims_action === 'rejected'}
                    >
                      {processing === entry.invoice_number ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
