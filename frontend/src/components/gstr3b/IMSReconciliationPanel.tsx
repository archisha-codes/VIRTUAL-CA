/**
 * IMS Reconciliation Panel Component
 * Invoice Management System - Accept/Reject functionality with AI/ML Matching
 */

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle, Loader2, Sparkles, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface IMSEntry {
  gstin: string;
  invoice_number: string;
  invoice_date: string;
  taxable_value: number;
  tax_amount: number;
  match_status: 'exact_match' | 'probable_match' | 'gstin_match' | 'no_match';
  ims_action: 'pending' | 'accepted' | 'rejected' | 'partial';
  eligible_itc: number;
  invoice_type: string;
}

// AI Match Result Interface
interface AIMatchResult {
  id: string;
  sales_invoice: {
    invoice_number: string;
    invoice_value: number;
    supplier_gstin: string;
    supplier_name?: string;
  };
  purchase_invoice: {
    invoice_number: string;
    invoice_value: number;
    supplier_gstin: string;
    supplier_name?: string;
  };
  confidence: number;
  confidence_display: string;
  category: string;
  category_display: string;
  requires_review: boolean;
  eligible_for_itc: boolean;
  explanation: string;
  color: string;
  match_factors: Record<string, number>;
  discrepancies: string[];
}

interface Anomaly {
  invoice: Record<string, unknown>;
  anomaly_score: number;
  is_anomaly: boolean;
  anomaly_reasons: string[];
}

interface IMSReconciliationPanelProps {
  data: IMSEntry[];
  onAccept: (invoiceNumber: string) => Promise<void>;
  onReject: (invoiceNumber: string) => Promise<void>;
  onPartial: (invoiceNumber: string, amount: number) => Promise<void>;
  loading?: boolean;
  // AI-specific props
  aiEnabled?: boolean;
  onAIToggle?: (enabled: boolean) => void;
  aiResults?: AIMatchResult[];
  anomalies?: Anomaly[];
  confidenceThreshold?: number;
  onConfidenceChange?: (threshold: number) => void;
  onRunAIReconciliation?: () => Promise<void>;
  onConfirmMatch?: (matchId: string) => Promise<void>;
  onRejectMatch?: (matchId: string) => Promise<void>;
  onSubmitFeedback?: (matchId: string, feedback: string) => Promise<void>;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MatchStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    exact_match: 'default',
    probable_match: 'secondary',
    gstin_match: 'outline',
    no_match: 'destructive',
  };

  const labels: Record<string, string> = {
    exact_match: 'Exact Match',
    probable_match: 'Probable',
    gstin_match: 'GSTIN Only',
    no_match: 'No Match',
  };

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {labels[status] || status}
    </Badge>
  );
}

function ActionBadge({ action }: { action: string }) {
  const config: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: typeof CheckCircle; label: string }> = {
    accepted: { variant: 'default', icon: CheckCircle, label: 'Accepted' },
    rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
    partial: { variant: 'secondary', icon: AlertCircle, label: 'Partial' },
    pending: { variant: 'outline', icon: AlertCircle, label: 'Pending' },
  };

  const { variant, icon: Icon, label } = config[action] || config.pending;

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function IMSReconciliationPanel({ 
  data, 
  onAccept, 
  onReject, 
  onPartial, 
  loading,
  aiEnabled = false,
  onAIToggle,
  aiResults = [],
  anomalies = [],
  confidenceThreshold = 70,
  onConfidenceChange,
  onRunAIReconciliation,
  onConfirmMatch,
  onRejectMatch,
  onSubmitFeedback,
}: IMSReconciliationPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAIResults, setShowAIResults] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<AIMatchResult | null>(null);

  // Group data by match status
  const exactMatches = data.filter(d => d.match_status === 'exact_match');
  const probableMatches = data.filter(d => d.match_status === 'probable_match');
  const gstinMatches = data.filter(d => d.match_status === 'gstin_match');
  const noMatches = data.filter(d => d.match_status === 'no_match');

  const handleAccept = async (invoiceNumber: string) => {
    setProcessingId(invoiceNumber);
    try {
      await onAccept(invoiceNumber);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invoiceNumber: string) => {
    setProcessingId(invoiceNumber);
    try {
      await onReject(invoiceNumber);
    } finally {
      setProcessingId(null);
    }
  };

  // Calculate summary stats
  const stats = {
    total: data.length,
    accepted: data.filter(d => d.ims_action === 'accepted').length,
    rejected: data.filter(d => d.ims_action === 'rejected').length,
    pending: data.filter(d => d.ims_action === 'pending').length,
    totalEligibleITC: data.reduce((sum, d) => sum + d.eligible_itc, 0),
  };

  // AI-specific stats
  const aiStats = {
    totalMatches: aiResults.length,
    highConfidence: aiResults.filter(m => m.confidence >= 90).length,
    needsReview: aiResults.filter(m => m.requires_review).length,
    anomalies: anomalies.length,
    avgConfidence: aiResults.length > 0 
      ? Math.round(aiResults.reduce((sum, m) => sum + m.confidence, 0) / aiResults.length)
      : 0,
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IMS Reconciliation</CardTitle>
          <CardDescription>Invoice Management System - Accept/Reject supplier invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No IMS data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">IMS Reconciliation</CardTitle>
        <CardDescription>Invoice Management System - Accept/Reject supplier invoices for ITC claims</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Matching Toggle & Controls */}
        {onAIToggle && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-900">AI-Powered Matching</p>
                <p className="text-sm text-purple-700">Use ML algorithms to auto-match invoices</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Switch
                checked={aiEnabled}
                onCheckedChange={onAIToggle}
                className="data-[state=checked]:bg-purple-600"
              />
              {aiEnabled && onRunAIReconciliation && (
                <Button 
                  onClick={onRunAIReconciliation}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  <Loader2 className="h-4 w-4" />
                  Run AI Match
                </Button>
              )}
            </div>
          </div>
        )}

        {/* AI Results Summary */}
        {aiEnabled && aiResults.length > 0 && (
          <div className="space-y-4">
            {/* AI Match Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-700">{aiStats.totalMatches}</p>
                <p className="text-xs text-purple-600">AI Matches</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{aiStats.highConfidence}</p>
                <p className="text-xs text-green-600">High Confidence</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{aiStats.needsReview}</p>
                <p className="text-xs text-yellow-600">Needs Review</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{aiStats.anomalies}</p>
                <p className="text-xs text-red-600">Anomalies</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{aiStats.avgConfidence}%</p>
                <p className="text-xs text-blue-600">Avg Confidence</p>
              </div>
            </div>

            {/* Confidence Threshold Slider */}
            {onConfidenceChange && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Min Confidence Threshold:</span>
                </div>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={([value]) => onConfidenceChange(value)}
                  max={100}
                  min={0}
                  step={5}
                  className="flex-1 max-w-xs"
                />
                <span className="text-sm font-bold w-12">{confidenceThreshold}%</span>
              </div>
            )}

            {/* Match Rate Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Match Rate</span>
                <span className="text-muted-foreground">
                  {aiStats.totalMatches > 0 
                    ? Math.round((aiStats.highConfidence / aiStats.totalMatches) * 100) 
                    : 0}% Auto-Confirmable
                </span>
              </div>
              <Progress 
                value={aiStats.totalMatches > 0 ? (aiStats.highConfidence / aiStats.totalMatches) * 100 : 0} 
                className="h-2"
              />
            </div>

            {/* Anomaly Alerts */}
            {anomalies.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Anomalies Detected</span>
                  <Badge variant="destructive">{anomalies.length}</Badge>
                </div>
                <div className="space-y-1">
                  {anomalies.slice(0, 3).map((anomaly, idx) => (
                    <div key={idx} className="text-sm text-red-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{anomaly.anomaly_reasons.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Invoices</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{stats.accepted}</p>
            <p className="text-xs text-green-600">Accepted</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
            <p className="text-xs text-red-600">Rejected</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            <p className="text-xs text-yellow-600">Pending</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats.totalEligibleITC)}</p>
            <p className="text-xs text-blue-600">Eligible ITC</p>
          </div>
        </div>

        {/* Match Categories */}
        {[
          { title: 'Exact Matches', data: exactMatches, color: 'bg-green-500', description: 'GSTIN + Invoice + Amount match' },
          { title: 'Probable Matches', data: probableMatches, color: 'bg-blue-500', description: 'Slight amount difference' },
          { title: 'GSTIN Matches Only', data: gstinMatches, color: 'bg-yellow-500', description: 'Invoice not found in GSTR-2B' },
          { title: 'No Matches', data: noMatches, color: 'bg-red-500', description: 'Cannot reconcile' },
        ].map(({ title, data: categoryData, color, description }) => (
          categoryData.length > 0 && (
            <div key={title} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <h4 className="font-medium">{title}</h4>
                <Badge variant="outline">{categoryData.length}</Badge>
                <span className="text-xs text-muted-foreground">- {description}</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Supplier GSTIN</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Eligible ITC</TableHead>
                      <TableHead className="w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.slice(0, 10).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{entry.gstin}</TableCell>
                        <TableCell className="font-medium">{entry.invoice_number}</TableCell>
                        <TableCell>{entry.invoice_date}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.taxable_value)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.tax_amount)}</TableCell>
                        <TableCell><MatchStatusBadge status={entry.match_status} /></TableCell>
                        <TableCell><ActionBadge action={entry.ims_action} /></TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(entry.eligible_itc)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handleAccept(entry.invoice_number)}
                              disabled={processingId === entry.invoice_number || entry.ims_action === 'accepted'}
                            >
                              {processingId === entry.invoice_number ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleReject(entry.invoice_number)}
                              disabled={processingId === entry.invoice_number || entry.ims_action === 'rejected'}
                            >
                              {processingId === entry.invoice_number ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {categoryData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Showing 10 of {categoryData.length} entries
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </CardContent>
    </Card>
  );
}
