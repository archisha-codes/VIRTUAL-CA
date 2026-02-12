import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, BarChart3, FileDown, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const features = [
  {
    icon: Upload,
    title: 'Upload & Map',
    description: 'Upload your Excel file and map columns to GST fields',
    href: '/upload',
  },
  {
    icon: FileText,
    title: 'Preview & Validate',
    description: 'Review invoices with real-time validation feedback',
    href: '/invoices',
  },
  {
    icon: BarChart3,
    title: 'Generate GSTR-1',
    description: 'Auto-generate all GSTR-1 sections (B2B, B2CL, B2CS, etc.)',
    href: '/gstr1',
  },
  {
    icon: FileDown,
    title: 'Download Reports',
    description: 'Export reports in Excel or JSON format',
    href: '/downloads',
  },
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
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Card */}
        <Card className="shadow-card gradient-primary text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
                </h2>
                <p className="text-primary-foreground/80 mt-1">
                  Start automating your GST compliance workflow
                </p>
              </div>
              <Button 
                variant="secondary" 
                className="shrink-0"
                onClick={() => navigate('/upload')}
              >
                Upload New File
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <Card 
              key={feature.title}
              className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group"
              onClick={() => navigate(feature.href)}
            >
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Getting Started */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to generate your GST returns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Upload your sales data</p>
                  <p className="text-sm text-muted-foreground">
                    Upload an Excel file containing your sales invoices
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Map your columns</p>
                  <p className="text-sm text-muted-foreground">
                    Match your Excel columns to the required GST fields
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Review & validate</p>
                  <p className="text-sm text-muted-foreground">
                    Check your invoices for errors and warnings
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Generate reports (Coming soon)</p>
                  <p className="text-sm text-muted-foreground">
                    Download your GSTR-1 and GSTR-3B reports
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
