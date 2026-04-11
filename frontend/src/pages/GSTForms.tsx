/**
 * GST Forms Landing Page
 * ClearTax-style centralized hub for all GST filing modules
 * Route: /gst/forms
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Calculator,
  BarChart3,
  ArrowRight,
  FileCheck,
  FileDiff,
  Building2,
  Shield,
  Briefcase,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRightLeft,
  Receipt,
  FileBarChart,
  History,
  Loader2,
  AlertTriangle,
  Inbox
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardService, DashboardData, FormModule } from '@/services/dashboardService';
import GSTR3BDrawerFlow from '@/components/gstr3b/GSTR3BDrawerFlow';

// Filing module types
interface FilingModule {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: React.ElementType;
  color: string;
  path: string;
  dueDate: string;
  frequency: string;
  status: 'ready' | 'pending' | 'filed' | 'overdue';
  lastFiled?: string;
}

// Map form IDs to icons and colors
const getModuleStyle = (id: string): { icon: React.ElementType; color: string } => {
  const styles: Record<string, { icon: React.ElementType; color: string }> = {
    gstr1: { icon: FileText, color: 'from-indigo-500 to-indigo-600' },
    gstr3b: { icon: Calculator, color: 'from-orange-500 to-orange-600' },
    gstr2b: { icon: FileBarChart, color: 'from-purple-500 to-purple-600' },
    gstr9: { icon: FileCheck, color: 'from-teal-500 to-teal-600' },
    gstr9c: { icon: Shield, color: 'from-cyan-500 to-cyan-600' },
    gstr6: { icon: Building2, color: 'from-cyan-500 to-cyan-600' },
    gstr7: { icon: FileDiff, color: 'from-amber-500 to-amber-600' },
    gstr8: { icon: Briefcase, color: 'from-rose-500 to-rose-600' },
    cmp08: { icon: Receipt, color: 'from-pink-500 to-pink-600' },
    'einv-sr': { icon: ArrowRightLeft, color: 'from-violet-500 to-violet-600' },
    '2a-pr': { icon: RefreshCw, color: 'from-red-500 to-red-600' },
    '2b-pr': { icon: History, color: 'from-orange-500 to-orange-600' },
  };
  return styles[id] || { icon: FileText, color: 'from-slate-500 to-slate-600' };
};

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-red-500 dark:text-red-400 mb-4">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-corporate-primary" />
        <p className="text-slate-500 dark:text-slate-400">Loading filing modules...</p>
      </div>
    </div>
  );
}

interface FilingModuleCardProps {
  module: FilingModule;
  onClick: () => void;
}

function FilingModuleCard({ module, onClick }: FilingModuleCardProps) {
  const statusConfig = {
    ready: { label: 'Ready to File', color: 'bg-green-500', text: 'text-green-600' },
    pending: { label: 'Pending', color: 'bg-yellow-500', text: 'text-yellow-600' },
    filed: { label: 'Filed', color: 'bg-blue-500', text: 'text-blue-600' },
    overdue: { label: 'Overdue', color: 'bg-red-500', text: 'text-red-600' },
  };

  const status = statusConfig[module.status];

  return (
    <Card
      className="shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-300 cursor-pointer group border-0 bg-white dark:bg-slate-800"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <module.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{module.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`h-2 w-2 rounded-full ${status.color}`} />
                <span className={`text-xs ${status.text}`}>{status.label}</span>
              </div>
            </div>
          </div>
        </div>
        <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {module.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {module.dueDate}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              {module.frequency}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-corporate-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function GSTForms() {
  const navigate = useNavigate();
  const { currentGstProfile, currentOrganization } = useAuth();
  const { getDashboardData, getForms } = useDashboardService();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [formModules, setFormModules] = useState<FormModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isGSTR3BDrawerOpen, setIsGSTR3BDrawerOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, forms] = await Promise.all([
        getDashboardData(),
        getForms()
      ]);
      setDashboardData(data);
      setFormModules(forms || []);

      // Set current period
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear().toString();
      const period = month + year;
      setSelectedPeriod(period);
    } catch (err) {
      console.error('Failed to load forms data:', err);
      setError('Failed to load filing modules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter modules by category from backend data
  const monthlyModules = formModules.filter(m =>
    ['gstr1', 'gstr3b', 'gstr2b'].includes(m.id) && m.enabled
  );
  const annualModules = formModules.filter(m =>
    ['gstr9', 'gstr9c'].includes(m.id) && m.enabled
  );
  const otherModules = formModules.filter(m =>
    ['gstr6', 'gstr7', 'gstr8', 'cmp08', 'itc04'].includes(m.id) && m.enabled
  );
  const reconciliationModules = formModules.filter(m =>
    ['einv-sr', '2a-pr', '2b-pr'].includes(m.id) && m.enabled
  );

  // Filing status from dashboard
  const filingStatus = dashboardData?.filing_status || {
    gstr1: { status: 'pending', period: '', filed_date: undefined },
    gstr3b: { status: 'pending', period: '', filed_date: undefined },
    gstr2b: { status: 'pending', period: '', filed_date: undefined },
  };

  // Get GSTIN for display
  const currentGstin = currentGstProfile?.gstin || 'Not configured';
  const orgName = currentOrganization?.name || 'Organization';

  return (
    <DashboardLayout title="GST Forms">
      <div className="space-y-6 animate-fade-in">
        {/* Header Banner */}
        <Card className="shadow-card bg-gradient-to-r from-corporate-primary to-corporate-dark text-white border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">GST Filing Center</h2>
                <p className="text-white/80 mt-1">
                  Prepare and file your GST returns for {orgName}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    PAN: {currentOrganization?.pan || 'Not set'}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    GSTIN: {currentGstin}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    Period: {selectedPeriod}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => navigate('/settings')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Configure GSTIN
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filing Status Quick View */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`shadow-sm ${filingStatus.gstr1.status === 'filed'
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
              : filingStatus.gstr1.status === 'available'
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            }`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">GSTR-1</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {filingStatus.gstr1.status === 'filed' ? 'Filed' :
                      filingStatus.gstr1.status === 'available' ? 'Ready' : 'Pending'}
                  </p>
                  {filingStatus.gstr1.filed_date && (
                    <p className="text-xs text-slate-500">Filed: {filingStatus.gstr1.filed_date}</p>
                  )}
                </div>
                {filingStatus.gstr1.status === 'filed' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${filingStatus.gstr3b.status === 'filed'
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
              : filingStatus.gstr3b.status === 'available'
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            }`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">GSTR-3B</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {filingStatus.gstr3b.status === 'filed' ? 'Filed' :
                      filingStatus.gstr3b.status === 'available' ? 'Ready' : 'Pending'}
                  </p>
                  {filingStatus.gstr3b.filed_date && (
                    <p className="text-xs text-slate-500">Filed: {filingStatus.gstr3b.filed_date}</p>
                  )}
                </div>
                {filingStatus.gstr3b.status === 'filed' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${filingStatus.gstr2b.status === 'available'
              ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
              : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
            }`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">GSTR-2B</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {filingStatus.gstr2b.status === 'available' ? 'Available' : 'Not Available'}
                  </p>
                </div>
                <RefreshCw className={`h-8 w-8 ${filingStatus.gstr2b.status === 'available'
                    ? 'text-purple-600'
                    : 'text-slate-400'
                  }`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filing Modules Tabs */}
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="monthly">Monthly Returns</TabsTrigger>
            <TabsTrigger value="annual">Annual Returns</TabsTrigger>
            <TabsTrigger value="other">Other Returns</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-6">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={loadData} />
            ) : monthlyModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyModules.map((module) => {
                  const style = getModuleStyle(module.id);
                  return (
                    <FilingModuleCard
                      key={module.id}
                      module={{
                        id: module.id,
                        name: module.name,
                        fullName: module.name,
                        description: module.description,
                        icon: style.icon,
                        color: style.color,
                        path: module.path,
                        dueDate: module.due_date,
                        frequency: module.frequency,
                        status: 'pending' as const
                      }}
                      onClick={() => {
                        if (module.id === 'gstr3b') {
                          setIsGSTR3BDrawerOpen(true);
                        } else {
                          navigate(module.path);
                        }
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No monthly returns available for your subscription." />
            )}
          </TabsContent>

          <TabsContent value="annual" className="mt-6">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={loadData} />
            ) : annualModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {annualModules.map((module) => {
                  const style = getModuleStyle(module.id);
                  return (
                    <FilingModuleCard
                      key={module.id}
                      module={{
                        id: module.id,
                        name: module.name,
                        fullName: module.name,
                        description: module.description,
                        icon: style.icon,
                        color: style.color,
                        path: module.path,
                        dueDate: module.due_date,
                        frequency: module.frequency,
                        status: 'pending' as const
                      }}
                      onClick={() => navigate(module.path)}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No annual returns available for your subscription." />
            )}
          </TabsContent>

          <TabsContent value="other" className="mt-6">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={loadData} />
            ) : otherModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherModules.map((module) => {
                  const style = getModuleStyle(module.id);
                  return (
                    <FilingModuleCard
                      key={module.id}
                      module={{
                        id: module.id,
                        name: module.name,
                        fullName: module.name,
                        description: module.description,
                        icon: style.icon,
                        color: style.color,
                        path: module.path,
                        dueDate: module.due_date,
                        frequency: module.frequency,
                        status: 'pending' as const
                      }}
                      onClick={() => navigate(module.path)}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No other returns available for your subscription." />
            )}
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-6">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={loadData} />
            ) : reconciliationModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reconciliationModules.map((module) => {
                  const style = getModuleStyle(module.id);
                  return (
                    <FilingModuleCard
                      key={module.id}
                      module={{
                        id: module.id,
                        name: module.name,
                        fullName: module.name,
                        description: module.description,
                        icon: style.icon,
                        color: style.color,
                        path: module.path,
                        dueDate: module.due_date,
                        frequency: module.frequency,
                        status: 'ready' as const
                      }}
                      onClick={() => navigate(module.path)}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No reconciliation tools available for your subscription." />
            )}
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="shadow-card">
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
                <FileText className="h-5 w-5" />
                <span className="text-sm">Upload Data</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/downloads')}
              >
                <Download className="h-5 w-5" />
                <span className="text-sm">Downloads</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/reports')}
                disabled
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm">Reports</span>
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
      </div>

      <GSTR3BDrawerFlow
        open={isGSTR3BDrawerOpen}
        onOpenChange={setIsGSTR3BDrawerOpen}
        onContinue={(gstins, period) => {
          setIsGSTR3BDrawerOpen(false);
          // Navigate to GSTR3B passing the selected info
          navigate('/gstr3b', {
            state: { gstin: gstins[0], returnPeriod: period, fromDrawer: true }
          });
        }}
      />
    </DashboardLayout>
  );
}
