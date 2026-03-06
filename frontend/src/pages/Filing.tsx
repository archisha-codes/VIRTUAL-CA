import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  FileSpreadsheet,
  FileJson,
  Loader2,
  BarChart3,
  Calculator,
  Shield,
  Clock,
  Zap,
  Upload
} from 'lucide-react';

interface FilingCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  actions: {
    label: string;
    icon: React.ElementType;
    variant?: 'default' | 'outline' | 'secondary';
    onClick: () => void;
    disabled?: boolean;
  }[];
  status?: 'ready' | 'pending' | 'error';
  lastUpdated?: string;
}

function FilingCard({ 
  title, 
  description, 
  icon: Icon, 
  features, 
  actions,
  status = 'ready',
  lastUpdated 
}: FilingCardProps) {
  const statusColors = {
    ready: 'bg-green-500',
    pending: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const statusLabels = {
    ready: 'Ready',
    pending: 'Pending Data',
    error: 'Action Required'
  };

  return (
    <Card className="shadow-card hover:shadow-card-hover transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
                <span className="text-sm text-muted-foreground">{statusLabels[status]}</span>
              </div>
            </div>
          </div>
        </div>
        <CardDescription className="mt-3">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Features */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Key Features</h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {lastUpdated}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
              disabled={action.disabled}
              className="w-full"
            >
              {action.disabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Filing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const gstr1Features = [
    'Monthly or quarterly return for outward supplies',
    'B2B, B2CL, B2CS, CDNR, CDNUR tables',
    'Export data in JSON format',
    'Validate invoices before filing',
    'HSN and document summary'
  ];

  const gstr3bFeatures = [
    'Summary GST return with tax liability',
    'Auto-calculate from uploaded data',
    'ITC claims and cross-utilization',
    'Interest calculation',
    'Payment details generation'
  ];

  return (
    <DashboardLayout title="Filing">
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">GST Filing Center</h2>
            <p className="text-muted-foreground">
              Prepare and file your GST returns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              FY 2025-26
            </Badge>
          </div>
        </div>

        {/* Filing Options */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gstr1">GSTR-1</TabsTrigger>
            <TabsTrigger value="gstr2b">GSTR-2B</TabsTrigger>
            <TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GSTR-1 Card */}
              <FilingCard
                title="GSTR-1"
                description="Monthly or quarterly return for outward supplies. Reports all sales transactions to the government."
                icon={FileText}
                features={gstr1Features}
                status="ready"
                lastUpdated="March 1, 2026"
                actions={[
                  {
                    label: 'Prepare Return',
                    icon: Calculator,
                    onClick: () => navigate('/gstr1')
                  },
                  {
                    label: 'Validate',
                    icon: Shield,
                    variant: 'outline',
                    onClick: () => navigate('/gstr1')
                  },
                  {
                    label: 'Export JSON',
                    icon: FileJson,
                    variant: 'secondary',
                    onClick: () => navigate('/gstr1')
                  }
                ]}
              />

              {/* GSTR-3B Card */}
              <FilingCard
                title="GSTR-3B"
                description="Summary GST return. Consolidates all tax liabilities and Input Tax Credit claims."
                icon={BarChart3}
                features={gstr3bFeatures}
                status="ready"
                lastUpdated="March 1, 2026"
                actions={[
                  {
                    label: 'Prepare Return',
                    icon: Calculator,
                    onClick: () => navigate('/gstr3b')
                  },
                  {
                    label: 'Preview Summary',
                    icon: FileSpreadsheet,
                    variant: 'outline',
                    onClick: () => navigate('/gstr3b')
                  },
                  {
                    label: 'Generate JSON',
                    icon: FileJson,
                    variant: 'secondary',
                    onClick: () => navigate('/gstr3b')
                  }
                ]}
              />
            </div>

            {/* Filing Status Summary */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">GSTR-1 Status</p>
                      <p className="text-2xl font-bold text-blue-900">Ready to File</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">GSTR-3B Status</p>
                      <p className="text-2xl font-bold text-green-900">Ready to File</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">GSTR-2B Status</p>
                      <p className="text-2xl font-bold text-purple-900">Auto Pull</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="mt-8 shadow-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common filing tasks and utilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => navigate('/upload')}
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">Upload Data</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => navigate('/invoices')}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">View Invoices</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => navigate('/downloads')}
                  >
                    <FileJson className="h-5 w-5" />
                    <span className="text-sm">Downloads</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => navigate('/settings')}
                  >
                    <Shield className="h-5 w-5" />
                    <span className="text-sm">Settings</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gstr1" className="mt-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  GSTR-1 - Details
                </CardTitle>
                <CardDescription>
                  Monthly or quarterly return for outward supplies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Return Period</p>
                    <p className="text-lg font-semibold">February 2026</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-lg font-semibold">156</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Taxable Value</p>
                    <p className="text-lg font-semibold">₹45,23,000</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Tax</p>
                    <p className="text-lg font-semibold">₹8,13,540</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => navigate('/gstr1')}>
                    <Calculator className="mr-2 h-4 w-4" />
                    Prepare Return
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/gstr1')}>
                    <Shield className="mr-2 h-4 w-4" />
                    Validate Data
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/gstr1')}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Generate JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gstr3b" className="mt-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  GSTR-3B - Details
                </CardTitle>
                <CardDescription>
                  Summary GST return with tax liability and ITC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Return Period</p>
                    <p className="text-lg font-semibold">February 2026</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Liability</p>
                    <p className="text-lg font-semibold">₹8,13,540</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">ITC Available</p>
                    <p className="text-lg font-semibold">₹6,45,230</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Net Payable</p>
                    <p className="text-lg font-semibold text-green-600">₹1,68,310</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => navigate('/gstr3b')}>
                    <Calculator className="mr-2 h-4 w-4" />
                    Auto Calculate
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/gstr3b')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Preview Summary
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/gstr3b')}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Generate JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gstr2b" className="mt-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  GSTR-2B - Details
                </CardTitle>
                <CardDescription>
                  Auto-generated from purchase invoices and GSTR-1 filed by suppliers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Return Period</p>
                    <p className="text-lg font-semibold">February 2026</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Purchase Invoices</p>
                    <p className="text-lg font-semibold">89</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">ITC Available</p>
                    <p className="text-lg font-semibold">₹4,23,560</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Matched Invoices</p>
                    <p className="text-lg font-semibold text-green-600">82</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => navigate('/gstr2b')}>
                    <Calculator className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/gstr2b')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Reconciliation
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/reports')}>
                    <FileJson className="mr-2 h-4 w-4" />
                    View Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
