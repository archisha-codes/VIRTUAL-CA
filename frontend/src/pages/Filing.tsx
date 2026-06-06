import { useState, useEffect } from 'react';
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
import { useDashboardService, DashboardData } from '@/services/dashboardService';

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
  const { getDashboardData, getForms } = useDashboardService();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load filing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get filing status
  const filingStatus = dashboardData?.filing_status || {
    gstr1: { status: 'pending', period: '' },
    gstr3b: { status: 'pending', period: '' },
    gstr2b: { status: 'pending', period: '' }
  };

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
                status={filingStatus.gstr1.status === 'filed' ? 'ready' : filingStatus.gstr1.status === 'available' ? 'ready' : 'pending'}
                lastUpdated={filingStatus.gstr1.filed_date || 'Not filed yet'}
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
                status={filingStatus.gstr3b.status === 'filed' ? 'ready' : filingStatus.gstr3b.status === 'available' ? 'ready' : 'pending'}
                lastUpdated={filingStatus.gstr3b.filed_date || 'Not filed yet'}
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
              <Card className={`bg-gradient-to-br ${filingStatus.gstr1.status === 'filed' ? 'from-green-50 to-emerald-50 border-green-100' : filingStatus.gstr1.status === 'available' ? 'from-blue-50 to-indigo-50 border-blue-100' : 'from-yellow-50 to-amber-50 border-yellow-100'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${filingStatus.gstr1.status === 'filed' ? 'text-green-600' : filingStatus.gstr1.status === 'available' ? 'text-blue-600' : 'text-yellow-600'}`}>GSTR-1 Status</p>
                      <p className={`text-2xl font-bold ${filingStatus.gstr1.status === 'filed' ? 'text-green-900' : filingStatus.gstr1.status === 'available' ? 'text-blue-900' : 'text-yellow-900'}`}>
                        {filingStatus.gstr1.status === 'filed' ? 'Filed' : filingStatus.gstr1.status === 'available' ? 'Ready to File' : 'Pending'}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${filingStatus.gstr1.status === 'filed' ? 'bg-green-100' : filingStatus.gstr1.status === 'available' ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                      {filingStatus.gstr1.status === 'filed' ? <CheckCircle className="h-6 w-6 text-green-600" /> : filingStatus.gstr1.status === 'available' ? <CheckCircle className="h-6 w-6 text-blue-600" /> : <AlertCircle className="h-6 w-6 text-yellow-600" />}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${filingStatus.gstr3b.status === 'filed' ? 'from-green-50 to-emerald-50 border-green-100' : filingStatus.gstr3b.status === 'available' ? 'from-blue-50 to-indigo-50 border-blue-100' : 'from-yellow-50 to-amber-50 border-yellow-100'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${filingStatus.gstr3b.status === 'filed' ? 'text-green-600' : filingStatus.gstr3b.status === 'available' ? 'text-blue-600' : 'text-yellow-600'}`}>GSTR-3B Status</p>
                      <p className={`text-2xl font-bold ${filingStatus.gstr3b.status === 'filed' ? 'text-green-900' : filingStatus.gstr3b.status === 'available' ? 'text-blue-900' : 'text-yellow-900'}`}>
                        {filingStatus.gstr3b.status === 'filed' ? 'Filed' : filingStatus.gstr3b.status === 'available' ? 'Ready to File' : 'Pending'}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${filingStatus.gstr3b.status === 'filed' ? 'bg-green-100' : filingStatus.gstr3b.status === 'available' ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                      {filingStatus.gstr3b.status === 'filed' ? <CheckCircle className="h-6 w-6 text-green-600" /> : filingStatus.gstr3b.status === 'available' ? <CheckCircle className="h-6 w-6 text-blue-600" /> : <AlertCircle className="h-6 w-6 text-yellow-600" />}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${filingStatus.gstr2b.status === 'available' ? 'from-purple-50 to-violet-50 border-purple-100' : 'from-slate-50 to-gray-50 border-slate-100'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${filingStatus.gstr2b.status === 'available' ? 'text-purple-600' : 'text-slate-600'}`}>GSTR-2B Status</p>
                      <p className={`text-2xl font-bold ${filingStatus.gstr2b.status === 'available' ? 'text-purple-900' : 'text-slate-900'}`}>
                        {filingStatus.gstr2b.status === 'available' ? 'Auto Pull' : 'Not Available'}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${filingStatus.gstr2b.status === 'available' ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      {filingStatus.gstr2b.status === 'available' ? <Zap className="h-6 w-6 text-purple-600" /> : <AlertCircle className="h-6 w-6 text-slate-600" />}
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
                    <p className="text-lg font-semibold">{filingStatus.gstr1.period || 'Not selected'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-lg font-semibold">{dashboardData?.gstr1_stats?.total_invoices || 0}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Taxable Value</p>
                    <p className="text-lg font-semibold">₹{dashboardData?.gstr1_stats?.taxable_value?.toLocaleString('en-IN') || '0'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Tax</p>
                    <p className="text-lg font-semibold">₹{dashboardData?.gstr1_stats?.total_tax?.toLocaleString('en-IN') || '0'}</p>
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
                    <p className="text-lg font-semibold">{filingStatus.gstr3b.period || 'Not selected'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Liability</p>
                    <p className="text-lg font-semibold">₹{dashboardData?.gstr3b_stats?.total_liability?.toLocaleString('en-IN') || '0'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">ITC Available</p>
                    <p className="text-lg font-semibold">₹{dashboardData?.gstr3b_stats?.itc_available?.toLocaleString('en-IN') || '0'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Net Payable</p>
                    <p className="text-lg font-semibold text-green-600">₹{dashboardData?.gstr3b_stats?.net_payable?.toLocaleString('en-IN') || '0'}</p>
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
                    <p className="text-lg font-semibold">{filingStatus.gstr2b.period || 'Not available'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Purchase Invoices</p>
                    <p className="text-lg font-semibold">{dashboardData?.gstr2b_stats?.total_invoices || 0}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">ITC Available</p>
                    <p className="text-lg font-semibold">₹{dashboardData?.gstr2b_stats?.itc_available?.toLocaleString('en-IN') || '0'}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Matched Invoices</p>
                    <p className="text-lg font-semibold text-green-600">{dashboardData?.gstr2b_stats?.matched_invoices || 0}</p>
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
