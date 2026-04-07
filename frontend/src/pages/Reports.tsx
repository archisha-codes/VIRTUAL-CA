/**
 * Reports Page - Advanced GST Reports Dashboard
 * 
 * Comprehensive reporting with 30+ reports across 6 categories:
 * 1. Filing & Compliance Reports (8 reports)
 * 2. Tax Liability Reports (6 reports)
 * 3. ITC & Credit Reports (5 reports)
 * 4. Transaction Reports (6 reports)
 * 5. Reconciliation Reports (5 reports)
 * 6. Analytics & Trends (4 reports)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileBarChart, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Calendar,
  Download,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  DollarSign,
  CreditCard,
  FileText,
  BarChart3,
  PieChart,
  ArrowRight,
  LayoutGrid,
  List,
  Settings,
  Bell
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { ReportCard, ReportFilters, ReportTable, ReportChart } from '@/components/reports';
import { useToast } from '@/hooks/use-toast';

// Report types
interface ReportConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  return_type: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  columns: Array<{
    key: string;
    label: string;
    data_type: string;
  }>;
}

// Category definitions
const categories = [
  { 
    id: 'filing_compliance', 
    name: 'Filing & Compliance', 
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    count: 8,
    description: 'Track filing status, deadlines, and compliance metrics'
  },
  { 
    id: 'tax_liability', 
    name: 'Tax Liability', 
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    count: 6,
    description: 'Analyze tax liability, rates, and cash flow'
  },
  { 
    id: 'itc_credit', 
    name: 'ITC & Credit', 
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    count: 5,
    description: 'Input tax credit tracking and eligibility'
  },
  { 
    id: 'transactions', 
    name: 'Transactions', 
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    count: 6,
    description: 'Detailed transaction reports by type'
  },
  { 
    id: 'reconciliation', 
    name: 'Reconciliation', 
    icon: RefreshCw,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    count: 5,
    description: 'Match and reconcile GSTR data'
  },
  { 
    id: 'analytics_trends', 
    name: 'Analytics & Trends', 
    icon: TrendingUp,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    count: 4,
    description: 'Business insights and trend analysis'
  },
];

// Mock reports data (in production, this comes from API)
const mockReports: ReportConfig[] = [
  // Category 1: Filing & Compliance (8)
  { id: 'gstr1_filing_status', name: 'GSTR-1 Filing Status', description: 'Monthly/quarterly filing status by GSTIN', category: 'filing_compliance', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'gstr3b_filing_status', name: 'GSTR-3B Filing Status', description: 'Tax payment and filing status', category: 'filing_compliance', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'gstr9_annual_summary', name: 'GSTR-9 Annual Summary', description: 'Annual return reconciliation', category: 'filing_compliance', return_type: 'GSTR-9', parameters: [], columns: [] },
  { id: 'filing_calendar', name: 'Filing Calendar', description: 'Upcoming filing deadlines', category: 'filing_compliance', return_type: 'ALL', parameters: [], columns: [] },
  { id: 'late_fee_calculator', name: 'Late Fee Calculator', description: 'Calculate late fees for delayed filings', category: 'filing_compliance', return_type: 'ALL', parameters: [], columns: [] },
  { id: 'amendment_tracker', name: 'Amendment Tracker', description: 'Track all amendments filed', category: 'filing_compliance', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'compliance_scorecard', name: 'Compliance Scorecard', description: 'Overall compliance rating', category: 'filing_compliance', return_type: 'ALL', parameters: [], columns: [] },
  { id: 'fraud_risk_indicators', name: 'Fraud Risk Indicators', description: 'Flag suspicious transactions', category: 'filing_compliance', return_type: 'ALL', parameters: [], columns: [] },
  
  // Category 2: Tax Liability (6)
  { id: 'tax_liability_summary', name: 'Tax Liability Summary', description: 'CGST/SGST/IGST liability by period', category: 'tax_liability', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'tax_rate_analysis', name: 'Tax Rate Analysis', description: 'Tax breakdown by rate (5%, 12%, 18%, 28%)', category: 'tax_liability', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'rcm_liability', name: 'RCM Liability Report', description: 'Reverse Charge Mechanism liabilities', category: 'tax_liability', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'tds_tcs_summary', name: 'TDS/TCS Summary', description: 'Tax deducted/collected at source', category: 'tax_liability', return_type: 'GSTR-7', parameters: [], columns: [] },
  { id: 'interest_calculator', name: 'Interest Calculator', description: 'Interest on late tax payment', category: 'tax_liability', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'tax_cash_flow', name: 'Tax Cash Flow', description: 'Tax outflow projections', category: 'tax_liability', return_type: 'GSTR-3B', parameters: [], columns: [] },
  
  // Category 3: ITC & Credit (5)
  { id: 'itc_availment', name: 'ITC Availment Report', description: 'Input tax credit claimed', category: 'itc_credit', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'itc_reversal', name: 'ITC Reversal Report', description: 'ITC reversed/disallowed', category: 'itc_credit', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'itc_eligibility_matrix', name: 'ITC Eligibility Matrix', description: 'Eligible vs ineligible ITC', category: 'itc_credit', return_type: 'GSTR-2B', parameters: [], columns: [] },
  { id: 'credit_ledger_status', name: 'Credit Ledger Status', description: 'Electronic credit ledger balance', category: 'itc_credit', return_type: 'GSTR-3B', parameters: [], columns: [] },
  { id: 'unclaimed_itc', name: 'Unclaimed ITC Report', description: 'ITC that could have been claimed', category: 'itc_credit', return_type: 'GSTR-2B', parameters: [], columns: [] },
  
  // Category 4: Transactions (6)
  { id: 'b2b_invoices', name: 'B2B Invoices Detail', description: 'Business to business invoices', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'b2c_invoices', name: 'B2C Invoices Detail', description: 'Business to consumer invoices', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'export_invoices', name: 'Export Invoices', description: 'Export transactions', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'nil_rated_supplies', name: 'Nil Rated/Exempt Supplies', description: 'Zero tax supplies', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'credit_debit_notes', name: 'Credit/Debit Notes', description: 'Amendment invoices', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'hsn_code_summary', name: 'HSN Code Summary', description: 'Goods/services breakdown by HSN/SAC', category: 'transactions', return_type: 'GSTR-1', parameters: [], columns: [] },
  
  // Category 5: Reconciliation (5)
  { id: 'gstr1_vs_gstr3b', name: 'GSTR-1 vs GSTR-3B', description: 'Outward supply reconciliation', category: 'reconciliation', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'gstr2a_vs_gstr2b', name: 'GSTR-2A vs GSTR-2B', description: 'Purchase reconciliation', category: 'reconciliation', return_type: 'GSTR-2B', parameters: [], columns: [] },
  { id: 'portal_vs_books', name: 'GSTN Portal vs Books', description: 'External vs internal data', category: 'reconciliation', return_type: 'ALL', parameters: [], columns: [] },
  { id: 'missing_invoices', name: 'Missing Invoices', description: 'Invoices in one return not other', category: 'reconciliation', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'mismatch_report', name: 'Mismatch Report', description: 'All mismatches with amounts', category: 'reconciliation', return_type: 'ALL', parameters: [], columns: [] },
  
  // Category 6: Analytics (4)
  { id: 'sales_trend_analysis', name: 'Sales Trend Analysis', description: 'Monthly/quarterly sales trends', category: 'analytics_trends', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'purchase_pattern', name: 'Purchase Pattern Analysis', description: 'Supplier analysis', category: 'analytics_trends', return_type: 'GSTR-2B', parameters: [], columns: [] },
  { id: 'tax_rate_distribution', name: 'Tax Rate Distribution', description: 'Visual breakdown of tax rates', category: 'analytics_trends', return_type: 'GSTR-1', parameters: [], columns: [] },
  { id: 'state_wise_sales', name: 'State-wise Sales', description: 'Inter-state vs intra-state', category: 'analytics_trends', return_type: 'GSTR-1', parameters: [], columns: [] },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [isRunningReport, setIsRunningReport] = useState(false);
  
  // Summary stats
  const totalReports = mockReports.length;
  const recentReports = mockReports.slice(0, 6);

  // Filter reports based on search and category
  const filteredReports = mockReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRunReport = (reportId: string) => {
    setIsRunningReport(true);
    const report = mockReports.find(r => r.id === reportId);
    setSelectedReport(report || null);
    
    // Simulate report generation
    setTimeout(() => {
      setIsRunningReport(false);
      toast({
        title: 'Report Generated',
        description: `${report?.name} has been generated successfully`,
      });
    }, 1500);
  };

  const handleScheduleReport = (reportId: string) => {
    toast({
      title: 'Schedule Report',
      description: 'Schedule dialog would open here',
    });
  };

  const getCategoryCount = (categoryId: string) => {
    return mockReports.filter(r => r.category === categoryId).length;
  };

  return (
    <DashboardLayout title="Advanced Reports">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                  <p className="text-3xl font-bold">{totalReports}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <FileBarChart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="text-3xl font-bold">{categories.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
                  <LayoutGrid className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-3xl font-bold">12</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-3xl font-bold">3</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categories Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Report Categories
            </CardTitle>
            <CardDescription>
              Browse reports by category or search for specific reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedCategory === category.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent hover:border-muted'
                  }`}
                  onClick={() => setSelectedCategory(
                    selectedCategory === category.id ? 'all' : category.id
                  )}
                >
                  <div className={`h-10 w-10 rounded-lg ${category.bgColor} flex items-center justify-center mb-3`}>
                    <category.icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <p className="font-medium text-sm">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryCount(category.id)} reports
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedCategory === 'all' 
                  ? 'All Reports' 
                  : categories.find(c => c.id === selectedCategory)?.name || 'Reports'
                }
              </span>
              <Badge variant="secondary">
                {filteredReports.length} reports
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No reports found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    id={report.id}
                    name={report.name}
                    description={report.description}
                    category={report.category}
                    returnType={report.return_type}
                    onRun={handleRunReport}
                    onSchedule={handleScheduleReport}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleRunReport(report.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        categories.find(c => c.id === report.category)?.bgColor || 'bg-gray-50'
                      }`}>
                        {(() => {
                          const Icon = categories.find(c => c.id === report.category)?.icon || FileBarChart;
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </div>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{report.return_type}</Badge>
                      <Button size="sm" variant="ghost">
                        Run <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Access Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recently Run Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentReports.slice(0, 4).map((report, index) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleRunReport(report.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.return_type}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Popular Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Popular Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'GSTR-1 Filing Status', runs: 156 },
                  { name: 'Tax Liability Summary', runs: 134 },
                  { name: 'GSTR-2A vs GSTR-2B', runs: 112 },
                  { name: 'ITC Availment Report', runs: 98 },
                ].map((report, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.runs} runs this month</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Generation Dialog */}
        <Dialog open={isRunningReport} onOpenChange={setIsRunningReport}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Running Report</DialogTitle>
              <DialogDescription>
                {selectedReport?.name || 'Generating report...'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Generating report data...
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
