import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateRangeChange: (startDate: Date | undefined, endDate: Date | undefined) => void;
}

const PRESET_RANGES = [
  { label: 'All Time', value: 'all' },
  { label: 'Current Month', value: 'current' },
  { label: 'Last Month', value: 'last' },
  { label: 'Last 3 Months', value: 'last3' },
  { label: 'Last 6 Months', value: 'last6' },
  { label: 'Current FY', value: 'currentfy' },
  { label: 'Custom Range', value: 'custom' },
];

function getFinancialYearStart(): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const fyStartMonth = 3; // April (0-indexed)
  
  if (now.getMonth() >= fyStartMonth) {
    return new Date(currentYear, fyStartMonth, 1);
  }
  return new Date(currentYear - 1, fyStartMonth, 1);
}

export function DateRangeFilter({ startDate, endDate, onDateRangeChange }: DateRangeFilterProps) {
  const [preset, setPreset] = useState<string>('all');
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();

    switch (value) {
      case 'all':
        setShowCustom(false);
        onDateRangeChange(undefined, undefined);
        break;
      case 'current':
        setShowCustom(false);
        onDateRangeChange(startOfMonth(now), endOfMonth(now));
        break;
      case 'last':
        setShowCustom(false);
        const lastMonth = subMonths(now, 1);
        onDateRangeChange(startOfMonth(lastMonth), endOfMonth(lastMonth));
        break;
      case 'last3':
        setShowCustom(false);
        onDateRangeChange(startOfMonth(subMonths(now, 2)), endOfMonth(now));
        break;
      case 'last6':
        setShowCustom(false);
        onDateRangeChange(startOfMonth(subMonths(now, 5)), endOfMonth(now));
        break;
      case 'currentfy':
        setShowCustom(false);
        onDateRangeChange(getFinancialYearStart(), endOfMonth(now));
        break;
      case 'custom':
        setShowCustom(true);
        break;
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label>Period</Label>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCustom && (
        <>
          <div className="space-y-2">
            <Label>From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[160px] justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd MMM yyyy') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => onDateRangeChange(date, endDate)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[160px] justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd MMM yyyy') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => onDateRangeChange(startDate, date)}
                  disabled={(date) => (startDate ? date < startDate : false)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {(startDate || endDate) && preset !== 'all' && (
        <div className="text-sm text-muted-foreground">
          Showing data from{' '}
          <span className="font-medium text-foreground">
            {startDate ? format(startDate, 'dd MMM yyyy') : 'beginning'}
          </span>
          {' to '}
          <span className="font-medium text-foreground">
            {endDate ? format(endDate, 'dd MMM yyyy') : 'now'}
          </span>
        </div>
      )}
    </div>
  );
}
