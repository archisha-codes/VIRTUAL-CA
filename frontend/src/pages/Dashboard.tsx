import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnnouncementsPanel } from '@/components/AnnouncementsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileText, 
  BarChart3, 
  FileDown, 
  ArrowRight, 
  Calculator, 
  Shield, 
  ShoppingCart, 
  CheckCircle,
  FileCheck,
  History,
  BookOpen,
  FileBarChart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const modules = [
  {
    icon: Upload,
    title: 'Upload & Map',
    description: 'Upload your Excel file and map columns to GST fields',
    href: '/upload',
    color: 'from-olive-500 to-olive-600'
  },
  {
    icon: FileText,
    title: 'Preview & Validate',
    description: 'Review invoices with real-time validation feedback',
    href: '/invoices',
    color: 'from-blue-500 to-blue-600'
  },
  {
    icon: BarChart3,
    title: 'Generate GSTR-1',
    description: 'Auto-generate all GSTR-1 sections (B2B, B2CL, B2CS, etc.)',
    href: '/gstr1',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    icon: FileCheck,
    title: 'Generate GSTR-3B',
    description: 'Calculate tax liability and ITC for GSTR-3B filing',
    href: '/gstr3b',
    color: 'from-orange-500 to-orange-600'
  },
  {
    icon: Shield,
    title: 'GSTR-2B Reconciliation',
    description: 'Reconcile purchase invoices with GSTR-2B data',
    href: '/gstr2b',
    color: 'from-purple-500 to-purple-600'
  },
  {
    icon: Calculator,
    title: 'ITC Ledger',
    description: 'Track and manage your Input Tax Credit',
    href: '/itc',
    color: 'from-green-500 to-green-600'
  },
  {
    icon: ShoppingCart,
    title: 'IMS',
    description: 'Invoice Management System for inward supplies',
    href: '/ims',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    icon: FileBarChart,
    title: 'Reports',
    description: 'Filing tracker and reconciliation reports',
    href: '/reports',
    color: 'from-pink-500 to-pink-600'
  },
  {
    icon: History,
    title: 'Upload History',
    description: 'View previously uploaded files and templates',
    href: '/upload?tab=history',
    color: 'from-slate-500 to-slate-600'
  },
  {
    icon: BookOpen,
    title: 'Docs & Guide',
    description: 'Onboarding guide and documentation',
    href: '/docs',
    color: 'from-amber-500 to-amber-600'
  }
];

// Dashboard cards for the main content
const prepareForFilingCards = [
  {
    title: 'Table-4 for 3B filing',
    description: 'Outward supplies details for GSTR-3B',
    icon: Calculator,
    href: '/gstr3b',
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'IMS Inward Supplies',
    description: 'Input Tax Credit from purchases',
    icon: ShoppingCart,
    href: '/purchase-invoices',
    color: 'from-green-500 to-green-600'
  },
  {
    title: 'IMS Outward Supplies',
    description: 'Sales data for tax liability',
    icon: FileText,
    href: '/gstr1',
    color: 'from-purple-500 to-purple-600'
  }
];

const filingCards = [
  {
    title: 'GSTR-1 / IFF',
    description: 'Monthly/quarterly return for outward supplies',
    icon: FileText,
    href: '/gstr1',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    title: 'GSTR-3B',
    description: 'Summary return with tax liability',
    icon: BarChart3,
    href: '/gstr3b',
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'GSTR-9',
    description: 'Annual return for the financial year',
    icon: FileDown,
    href: '/downloads',
    color: 'from-teal-500 to-teal-600'
  }
];

const reportsCards = [
  {
    title: 'Filing Tracker',
    description: 'Track your filing status',
    icon: CheckCircle,
    href: '/filing',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    title: 'GSTR-2A Report',
    description: 'View inward supplies reconciliation',
    icon: Shield,
    href: '/gstr3b',
    color: 'from-pink-500 to-pink-600'
  },
  {
    title: 'Multi-PAN GSTR-3B',
    description: 'Consolidated returns across PANs',
    icon: BarChart3,
    href: '/gstr3b',
    color: 'from-amber-500 to-amber-600'
  }
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to upload if user just logged in
    if (user && !profile?.company_name) {
      // Could show onboarding, for now just continue
    }
  }, [user, profile]);

  return (
    <DashboardLayout title="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
        {/* Main Content Area - 3 columns */}
        <div className="lg:col-span-3 space-y-6">
          {/* Welcome Card with Gradient */}
          <Card className="shadow-card bg-gradient-to-r from-[#556B2F] to-[#800020] text-white border-0">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
                  </h2>
                  <p className="text-white/80 mt-1">
                    Start automating your GST compliance
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  className="shrink-0 bg-white text-[#556B2F] hover:bg-white/90"
                  onClick={() => navigate('/upload')}
                >
                  Upload New File
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GST Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <Card 
                key={module.title}
                className="shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer group glass-card border-0"
                onClick={() => navigate(module.href)}
              >
                <CardHeader>
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <module.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full group-hover:bg-primary/5">
                    Go to {module.title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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
