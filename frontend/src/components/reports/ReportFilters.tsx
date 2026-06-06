/**
 * Report Filters Component
 * 
 * Reusable filter component for reports with date range, GSTIN, period selection
 */

import { useState } from 'react';
import { Calendar, Building2, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface ReportFiltersProps {
  onApply: (filters: FilterValues) => void;
  onReset: () => void;
  availableGSTINs?: Array<{ id: string; gstin: string; name: string }>;
  showGSTIN?: boolean;
  showDateRange?: boolean;
  showPeriod?: boolean;
  defaultGSTIN?: string;
  defaultFromPeriod?: string;
  defaultToPeriod?: string;
}

export interface FilterValues {
  gstin?: string;
  fromDate?: string;
  toDate?: string;
  fromPeriod?: string;
  toPeriod?: string;
}

const returnPeriods = [
  { value: '012026', label: 'January 2026' },
  { value: '122025', label: 'December 2025' },
  { value: '112025', label: 'November 2025' },
  { value: '102025', label: 'October 2025' },
  { value: '092025', label: 'September 2025' },
  { value: '082025', label: 'August 2025' },
  { value: '072025', label: 'July 2025' },
  { value: '062025', label: 'June 2025' },
  { value: '052025', label: 'May 2025' },
  { value: '042025', label: 'April 2025' },
];

export function ReportFilters({
  onApply,
  onReset,
  availableGSTINs = [],
  showGSTIN = true,
  showDateRange = true,
  showPeriod = true,
  defaultGSTIN = '',
  defaultFromPeriod = '',
  defaultToPeriod = '',
}: ReportFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    gstin: defaultGSTIN,
    fromPeriod: defaultFromPeriod,
    toPeriod: defaultToPeriod,
  });
  
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleApply = () => {
    const filterValues: FilterValues = {
      ...filters,
      fromDate: fromDate?.toISOString().split('T')[0],
      toDate: toDate?.toISOString().split('T')[0],
    };
    onApply(filterValues);
  };

  const handleReset = () => {
    setFilters({});
    setFromDate(undefined);
    setToDate(undefined);
    onReset();
  };

  const updateFilter = (key: keyof FilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = () => {
    return filters.gstin || filters.fromPeriod || filters.toPeriod || fromDate || toDate;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          {hasActiveFilters() && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GSTIN Selection */}
          {showGSTIN && (
            <div className="space-y-2">
              <Label htmlFor="gstin" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                GSTIN
              </Label>
              <Select
                value={filters.gstin || ''}
                onValueChange={(value) => updateFilter('gstin', value)}
              >
                <SelectTrigger id="gstin">
                  <SelectValue placeholder="Select GSTIN" />
                </SelectTrigger>
                <SelectContent>
                  {availableGSTINs.length > 0 ? (
                    availableGSTINs.map((gstin) => (
                      <SelectItem key={gstin.id} value={gstin.gstin}>
                        {gstin.gstin} - {gstin.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="27AAAAA1234A1Z1">27AAAAA1234A1Z1 - Demo Company</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Return Period */}
          {showPeriod && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fromPeriod">From Period</Label>
                <Select
                  value={filters.fromPeriod || ''}
                  onValueChange={(value) => updateFilter('fromPeriod', value)}
                >
                  <SelectTrigger id="fromPeriod">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {returnPeriods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toPeriod">To Period</Label>
                <Select
                  value={filters.toPeriod || ''}
                  onValueChange={(value) => updateFilter('toPeriod', value)}
                >
                  <SelectTrigger id="toPeriod">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {returnPeriods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Date Range */}
          {showDateRange && (
            <>
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <Calendar className="mr-2 h-4 w-4" />
                      {fromDate ? fromDate.toLocaleDateString() : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <Calendar className="mr-2 h-4 w-4" />
                      {toDate ? toDate.toLocaleDateString() : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-muted-foreground"
          >
            <Filter className="h-4 w-4 mr-1" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
          </Button>
        </div>

        {/* Apply Button */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReportFilters;
