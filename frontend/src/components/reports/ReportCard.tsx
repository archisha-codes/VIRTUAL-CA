/**
 * Report Card Component
 * 
 * Displays an individual report card with metadata and actions
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileBarChart, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  RefreshCw,
  Download,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ReportCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  returnType: string;
  onRun?: (reportId: string) => void;
  onSchedule?: (reportId: string) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  filing_compliance: Calendar,
  tax_liability: DollarSign,
  itc_credit: RefreshCw,
  transactions: FileBarChart,
  reconciliation: TrendingUp,
  analytics_trends: TrendingUp,
};

const categoryColors: Record<string, string> = {
  filing_compliance: 'bg-blue-50 border-blue-200',
  tax_liability: 'bg-green-50 border-green-200',
  itc_credit: 'bg-purple-50 border-purple-200',
  transactions: 'bg-orange-50 border-orange-200',
  reconciliation: 'bg-red-50 border-red-200',
  analytics_trends: 'bg-cyan-50 border-cyan-200',
};

export function ReportCard({ 
  id, 
  name, 
  description, 
  category, 
  returnType,
  onRun,
  onSchedule 
}: ReportCardProps) {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  
  const Icon = categoryIcons[category] || FileBarChart;
  const colorClass = categoryColors[category] || 'bg-gray-50 border-gray-200';
  
  const handleRun = () => {
    setIsRunning(true);
    if (onRun) {
      onRun(id);
    }
    // Navigate to report viewer
    setTimeout(() => {
      setIsRunning(false);
      navigate(`/reports/view/${id}`);
    }, 1000);
  };
  
  const categoryLabels: Record<string, string> = {
    filing_compliance: 'Filing & Compliance',
    tax_liability: 'Tax Liability',
    itc_credit: 'ITC & Credit',
    transactions: 'Transactions',
    reconciliation: 'Reconciliation',
    analytics_trends: 'Analytics & Trends',
  };

  return (
    <Card className={`hover:shadow-md transition-all cursor-pointer ${colorClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg bg-white/80`}>
            <Icon className="h-5 w-5 text-gray-700" />
          </div>
          <Badge variant="outline" className="text-xs">
            {returnType}
          </Badge>
        </div>
        <CardTitle className="text-base mt-2">{name}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>{categoryLabels[category] || category}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Cached
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileBarChart className="h-4 w-4 mr-1" />
            )}
            Run
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSchedule?.(id)}
          >
            <Clock className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/reports/view/${id}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReportCard;
