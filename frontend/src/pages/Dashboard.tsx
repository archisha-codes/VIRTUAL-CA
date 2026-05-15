import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnnouncementsPanel } from '@/components/AnnouncementsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  BarChart3, 
  FileDown, 
  ArrowRight, 
  Calculator, 
  Shield,
  CheckCircle,
  FileCheck,
  History,
  BookOpen,
  FileBarChart,
  Receipt,
  RefreshCw,
  Database,
  ArrowRightLeft,
  Upload,
  Users,
  Building2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  FileDiff,
  Briefcase,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardService, DashboardData, FormModule } from '@/services/dashboardService';
import { useTenantStore } from '@/store/tenantStore';

// GST Return tiles for dashboard
const gstTiles = [
  {
    title: 'GSTR-1',
    description: 'Monthly/Quarterly return for outward supplies',
    icon: FileText,
    href: '/gstr1',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    title: 'GSTR-3B',
    description: 'Summary return with tax liability',
    icon: Calculator,
    href: '/gstr3b',
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'GSTR-9',
    description: 'Annual return for the financial year',
    icon: FileDown,
    href: '/downloads',
    color: 'from-teal-500 to-teal-600'
  },
  {
    title: 'GSTR-6',
    description: 'Monthly return for ISD',
    icon: Building2,
    href: '/gstr6',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    title: 'GSTR-7',
    description: 'Monthly return for TDS',
    icon: FileDiff,
    href: '/gstr7',
    color: 'from-amber-500 to-amber-600'
  },
  {
    title: 'GSTR-8',
    description: 'Monthly return for TCS',
    icon: Briefcase,
    href: '/gstr8',
    color: 'from-rose-500 to-rose-600'
  }
];

// IMS tiles
const imsTiles = [
  {
    title: 'IMS Inward Supplies',
    description: 'Review and accept inward supplies from GSTR-2B',
    icon: ArrowRightLeft,
    href: '/ims/inward',
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'IMS Outward Supplies',
    description: 'Manage and track outward supply invoices',
    icon: ArrowRightLeft,
    href: '/ims/outward',
    color: 'from-purple-500 to-purple-600'
  }
];

// Reports tiles
const reportsTiles = [
  {
    title: 'Filing Tracker',
    description: 'Track filing status for all GST returns',
    icon: History,
    href: '/reports/filing',
    color: 'from-green-500 to-green-600'
  },
  {
    title: 'GSTR-2A Report',
    description: 'View and analyze GSTR-2A inward supplies',
    icon: FileBarChart,
    href: '/gstr2b',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    title: 'Multi-PAN GSTR-3B',
    description: 'Consolidated GSTR-3B for multiple PANs',
    icon: BarChart3,
    href: '/reports/gst',
    color: 'from-pink-500 to-pink-600'
  }
];

// Reconciliation tiles
const reconciliationTiles = [
  {
    title: '2A vs PR',
    description: 'Reconcile GSTR-2A with Purchase Register',
    icon: Shield,
    href: '/reconciliation/2a-vs-pr',
    color: 'from-red-500 to-red-600'
  },
  {
    title: '2B vs PR',
    description: 'Reconcile GSTR-2B with Purchase Register',
    icon: Shield,
    href: '/gstr2b',
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'E-invoice vs GSTR-1',
    description: 'Match E-invoice data with GSTR-1',
    icon: FileDiff,
    href: '/reconciliation/einvoice',
    color: 'from-violet-500 to-violet-600'
  }
];

// Summary stats
interface DashboardStats {
  totalClients: number;
  pendingReturns: number;
  totalTaxLiability: number;
  itcAvailable: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getDashboardData, getForms } = useDashboardService();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [formModules, setFormModules] = useState<FormModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activeBusinessId } = useTenantStore();

  useEffect(() => {
    loadDashboardData();
    loadFormModules();
  }, [activeBusinessId]);

  const loadFormModules = async () => {
    try {
      const forms = await getForms();
      setFormModules(forms);
    } catch (err) {
      console.error('Failed to load form modules:', err);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Transform backend data to component format
  const stats = dashboardData ? {
    totalClients: dashboardData.stats.total_clients,
    pendingReturns: dashboardData.stats.pending_returns,
    totalTaxLiability: dashboardData.stats.total_tax_liability,
    itcAvailable: dashboardData.stats.itc_available
  } : {
    totalClients: 0,
    pendingReturns: 0,
    totalTaxLiability: 0,
    itcAvailable: 0
  };

  const filingStatus = dashboardData?.filing_status || {
    gstr1: { status: 'pending', period: '' },
    gstr3b: { status: 'pending', period: '' },
    gstr2b: { status: 'pending', period: '' }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
        {/* Main Content Area - 3 columns */}
        <div className="lg:col-span-3 space-y-6">
          {/* Welcome Card with Gradient */}
          <Card className="shadow-card bg-gradient-to-r from-corporate-primary to-corporate-dark text-white border-0">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Welcome back, {user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}!
                  </h2>
                  <p className="text-white/80 mt-1">
                    Manage your GST compliance
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => navigate('/upload')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Data
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => navigate('/clients')}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats - Enhanced Cards with Glass Effect */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Total Clients</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalClients}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Pending Returns</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingReturns}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Tax Liability</p>
                      <p className="text-2xl font-bold text-burgundy dark:text-red-400">₹{stats.totalTaxLiability.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-burgundy-500 to-burgundy-600 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">ITC Available</p>
                      <p className="text-2xl font-bold text-olive-600 dark:text-olive-400">₹{stats.itcAvailable.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-olive-500 to-olive-600 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* GST Return Tiles - Backend Driven */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Prepare for Filing</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/gst/forms')}>
                See All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formModules.length > 0 ? (
                formModules.filter(m => m.enabled).slice(0, 6).map((module) => (
                  <Card 
                    key={module.id}
                    className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer group border-0 bg-white dark:bg-slate-800"
                    onClick={() => navigate(module.path)}
                  >
                    <CardHeader>
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{module.name}</CardTitle>
                      <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{module.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{module.frequency}</span>
                        <Button variant="ghost" size="sm" className="group-hover:bg-primary/5 dark:group-hover:bg-primary/10">
                          Open
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                // Fallback to static tiles if no backend data
                gstTiles.map((tile) => (
                  <Card 
                    key={tile.title}
                    className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer group border-0 bg-white dark:bg-slate-800"
                    onClick={() => navigate(tile.href)}
                  >
                    <CardHeader>
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <tile.icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{tile.title}</CardTitle>
                      <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{tile.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="ghost" size="sm" className="w-full group-hover:bg-primary/5 dark:group-hover:bg-primary/10">
                        Open {tile.title}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* IMS Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Invoice Management System (IMS)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imsTiles.map((tile) => (
                <Card 
                  key={tile.title}
                  className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer group border-0 bg-white dark:bg-slate-800"
                  onClick={() => navigate(tile.href)}
                >
                  <CardHeader>
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <tile.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{tile.title}</CardTitle>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{tile.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full group-hover:bg-primary/5 dark:group-hover:bg-primary/10">
                      Open
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Reconciliation Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Reconciliation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reconciliationTiles.map((tile) => (
                <Card 
                  key={tile.title}
                  className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer group border-0 bg-white dark:bg-slate-800"
                  onClick={() => navigate(tile.href)}
                >
                  <CardHeader>
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <tile.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{tile.title}</CardTitle>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{tile.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full group-hover:bg-primary/5 dark:group-hover:bg-primary/10">
                      Open
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Reports Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportsTiles.map((tile) => (
                <Card 
                  key={tile.title}
                  className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration group border-0-300 cursor-pointer bg-white dark:bg-slate-800"
                  onClick={() => navigate(tile.href)}
                >
                  <CardHeader>
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <tile.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{tile.title}</CardTitle>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{tile.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full group-hover:bg-primary/5 dark:group-hover:bg-primary/10">
                      View Report
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Filing Status Summary */}
          <Card className="shadow-card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                Filing Status - FY 2025-26
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Overview of your GST filing compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* GSTR-1 Status */}
                <div className={`p-4 rounded-lg border ${
                  filingStatus.gstr1.status === 'filed' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : filingStatus.gstr1.status === 'available'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        filingStatus.gstr1.status === 'filed'
                          ? 'text-green-600 dark:text-green-400'
                          : filingStatus.gstr1.status === 'available'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}>GSTR-1</p>
                      <p className={`text-xl font-bold ${
                        filingStatus.gstr1.status === 'filed'
                          ? 'text-green-900 dark:text-green-300'
                          : filingStatus.gstr1.status === 'available'
                          ? 'text-blue-900 dark:text-blue-300'
                          : 'text-orange-900 dark:text-orange-300'
                      }`}>
                        {filingStatus.gstr1.status === 'filed' ? 'Filed' : filingStatus.gstr1.status === 'available' ? 'Available' : 'Pending'}
                      </p>
                      {filingStatus.gstr1.filed_date && (
                        <p className="text-xs text-slate-500 mt-1">Filed: {filingStatus.gstr1.filed_date}</p>
                      )}
                    </div>
                    <FileText className={`h-8 w-8 ${
                      filingStatus.gstr1.status === 'filed'
                        ? 'text-green-600 dark:text-green-400'
                        : filingStatus.gstr1.status === 'available'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`} />
                  </div>
                </div>
                
                {/* GSTR-3B Status */}
                <div className={`p-4 rounded-lg border ${
                  filingStatus.gstr3b.status === 'filed' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : filingStatus.gstr3b.status === 'available'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        filingStatus.gstr3b.status === 'filed'
                          ? 'text-green-600 dark:text-green-400'
                          : filingStatus.gstr3b.status === 'available'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}>GSTR-3B</p>
                      <p className={`text-xl font-bold ${
                        filingStatus.gstr3b.status === 'filed'
                          ? 'text-green-900 dark:text-green-300'
                          : filingStatus.gstr3b.status === 'available'
                          ? 'text-blue-900 dark:text-blue-300'
                          : 'text-orange-900 dark:text-orange-300'
                      }`}>
                        {filingStatus.gstr3b.status === 'filed' ? 'Filed' : filingStatus.gstr3b.status === 'available' ? 'Available' : 'Pending'}
                      </p>
                      {filingStatus.gstr3b.filed_date && (
                        <p className="text-xs text-slate-500 mt-1">Filed: {filingStatus.gstr3b.filed_date}</p>
                      )}
                    </div>
                    <Calculator className={`h-8 w-8 ${
                      filingStatus.gstr3b.status === 'filed'
                        ? 'text-green-600 dark:text-green-400'
                        : filingStatus.gstr3b.status === 'available'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`} />
                  </div>
                </div>
                
                {/* GSTR-2B Status */}
                <div className={`p-4 rounded-lg border ${
                  filingStatus.gstr2b.status === 'available' 
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                    : filingStatus.gstr2b.status === 'filed'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        filingStatus.gstr2b.status === 'available'
                          ? 'text-purple-600 dark:text-purple-400'
                          : filingStatus.gstr2b.status === 'filed'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>GSTR-2B</p>
                      <p className={`text-xl font-bold ${
                        filingStatus.gstr2b.status === 'available'
                          ? 'text-purple-900 dark:text-purple-300'
                          : filingStatus.gstr2b.status === 'filed'
                          ? 'text-green-900 dark:text-green-300'
                          : 'text-slate-900 dark:text-slate-300'
                      }`}>
                        {filingStatus.gstr2b.status === 'available' ? 'Auto Pull' : filingStatus.gstr2b.status === 'filed' ? 'Available' : 'Not Available'}
                      </p>
                    </div>
                    <RefreshCw className={`h-8 w-8 ${
                      filingStatus.gstr2b.status === 'available'
                        ? 'text-purple-600 dark:text-purple-400'
                        : filingStatus.gstr2b.status === 'filed'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Announcements Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <AnnouncementsPanel />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
