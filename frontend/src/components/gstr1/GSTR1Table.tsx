/**
 * GSTR1 Table Component
 * 
 * Reusable table component for displaying GSTR-1 data.
 */

import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface GSTR1TableProps<T> {
  data?: T[] | null;
  columns?: Column<T>[];
  keyField?: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  maxHeight?: string;
}

// Helper functions (defined before use)
function formatCurrencyValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Default columns for different GSTR1 data types
const DEFAULT_COLUMNS: Record<string, Column<Record<string, unknown>>[]> = {
  b2b: [
    { key: 'gstin', header: 'GSTIN', width: '150px' },
    { key: 'customerName', header: 'Customer Name', width: '200px' },
    { key: 'invoiceNumber', header: 'Invoice No', width: '120px' },
    { key: 'invoiceDate', header: 'Date', width: '100px' },
    { key: 'invoiceValue', header: 'Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
    { key: 'totalTaxableValue', header: 'Taxable Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
    { key: 'totalTax', header: 'Tax', width: '100px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
  ],
  b2cl: [
    { key: 'placeOfSupply', header: 'Place of Supply', width: '150px' },
    { key: 'invoiceNumber', header: 'Invoice No', width: '120px' },
    { key: 'invoiceDate', header: 'Date', width: '100px' },
    { key: 'invoiceValue', header: 'Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
  ],
  b2cs: [
    { key: 'placeOfSupply', header: 'Place of Supply', width: '150px' },
    { key: 'supplyType', header: 'Type', width: '80px' },
    { key: 'rate', header: 'Rate', width: '80px', align: 'right', render: (v) => `${v}%` },
    { key: 'taxableValue', header: 'Taxable Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
    { key: 'igstAmount', header: 'IGST', width: '100px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
  ],
  cdnr: [
    { key: 'gstin', header: 'GSTIN', width: '150px' },
    { key: 'customerName', header: 'Customer Name', width: '200px' },
    { key: 'noteType', header: 'Type', width: '60px' },
    { key: 'noteNumber', header: 'Note No', width: '120px' },
    { key: 'noteDate', header: 'Date', width: '100px' },
    { key: 'noteValue', header: 'Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
  ],
  hsn: [
    { key: 'hsnCode', header: 'HSN Code', width: '120px' },
    { key: 'description', header: 'Description', width: '200px' },
    { key: 'uqc', header: 'UQC', width: '80px' },
    { key: 'totalQuantity', header: 'Qty', width: '80px', align: 'right' },
    { key: 'totalValue', header: 'Total Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
    { key: 'taxableValue', header: 'Taxable Value', width: '120px', align: 'right', render: (v) => formatCurrencyValue(v as number) },
  ],
  docs: [
    { key: 'documentType', header: 'Document Type', width: '150px' },
    { key: 'serialNumber', header: 'Sr No', width: '80px' },
    { key: 'totalNumber', header: 'Total', width: '80px', align: 'right' },
    { key: 'totalCancelled', header: 'Cancelled', width: '100px', align: 'right' },
    { key: 'netIssued', header: 'Net Issued', width: '100px', align: 'right' },
  ],
  summary: [
    { key: 'label', header: 'Category', width: '200px' },
    { key: 'value', header: 'Count/Value', align: 'right' },
  ],
};

export function GSTR1Table<T extends Record<string, unknown>>({
  data,
  columns,
  keyField = 'id' as keyof T,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  maxHeight = '500px',
}: GSTR1TableProps<T>) {
  // Use default columns based on data structure if not provided
  const effectiveColumns = columns || DEFAULT_COLUMNS.b2b as Column<T>[];

  if (loading) {
    return (
      <div className={cn("border border-slate-200 dark:border-slate-700 rounded-lg", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-2 text-slate-500">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  const displayData = data || [];

  if (displayData.length === 0) {
    return (
      <div className={cn("border border-slate-200 dark:border-slate-700 rounded-lg", className)}>
        <div className="flex items-center justify-center h-32">
          <p className="text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden", className)}
      style={{ maxHeight }}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
            <tr>
              {effectiveColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider",
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    !column.align && 'text-left'
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {displayData.map((row, index) => {
              const key = String(row[keyField as keyof T] || String(index));
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row, index)}
                  className={cn(
                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {effectiveColumns.map((column) => {
                    const value = row[column.key as keyof T];
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-sm text-slate-700 dark:text-slate-300",
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          !column.align && 'text-left'
                        )}
                      >
                        {column.render 
                          ? column.render(value, row, index)
                          : String(value ?? '-')
                        }
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper to format currency
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Helper to format number
export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Helper to format percentage
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}

// Helper to format date
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}
