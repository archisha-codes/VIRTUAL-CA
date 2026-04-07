/**
 * Report Chart Component
 * 
 * Visualization component for report data with various chart types
 */

import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartData {
  name?: string;
  value?: number;
  [key: string]: string | number | undefined;
}

interface ReportChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: ChartData[];
  dataKeys: Array<{
    key: string;
    color: string;
    name?: string;
  }>;
  xAxisKey?: string;
  height?: number;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export function ReportChart({ 
  type, 
  title, 
  data, 
  dataKeys, 
  xAxisKey = 'name',
  height = 300 
}: ReportChartProps) {
  
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((dk, index) => (
                <Bar 
                  key={dk.key} 
                  dataKey={dk.key} 
                  fill={dk.color || COLORS[index % COLORS.length]}
                  name={dk.name || dk.key}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((dk, index) => (
                <Line 
                  key={dk.key} 
                  type="monotone" 
                  dataKey={dk.key} 
                  stroke={dk.color || COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  name={dk.name || dk.key}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((dk, index) => (
                <Area 
                  key={dk.key} 
                  type="monotone" 
                  dataKey={dk.key} 
                  stroke={dk.color || COLORS[index % COLORS.length]}
                  fill={dk.color || COLORS[index % COLORS.length]}
                  fillOpacity={0.3}
                  name={dk.name || dk.key}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKeys[0]?.key || 'value'}
                nameKey={xAxisKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}

// Helper component for chart data transformation
export function createChartData(
  rawData: Record<string, any>[],
  xAxisKey: string,
  dataKeys: string[]
): Array<Record<string, string | number>> {
  return rawData.map(row => {
    const chartPoint: Record<string, string | number> = {
      [xAxisKey]: row[xAxisKey]
    };
    dataKeys.forEach(key => {
      chartPoint[key] = Number(row[key]) || 0;
    });
    return chartPoint;
  });
}

export default ReportChart;
