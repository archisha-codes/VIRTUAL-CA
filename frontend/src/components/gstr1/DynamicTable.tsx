import React from 'react';

interface DynamicTableProps {
  title: string;
  data: Record<string, unknown>[];
  description?: string;
}

/**
 * DynamicTable - A fully dynamic table component that automatically 
 * detects columns from the data and renders them.
 * 
 * Handles nested objects (like inv, pos, etc.) by rendering them as formatted strings.
 * Handles both cname and customer_name fields for backward compatibility.
 * 
 * Future-proof: If backend adds new tables or columns, they will 
 * automatically appear without any frontend changes.
 */
const DynamicTable: React.FC<DynamicTableProps> = ({ title, data, description }) => {
  // ISSUE 6: Defensive check - prevent crash if no data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="gstr-table-wrapper">
        <div className="gstr-table-header">
          <h3 className="gstr-table-title">{title}</h3>
        </div>
        <div className="gstr-empty-message">
          No data available
        </div>
      </div>
    );
  }

  // Dynamically detect columns from the first row
  const columns = Object.keys(data[0]);

  // ISSUE 3: Helper to get customer name from various possible field names
  const getCustomerName = (row: Record<string, unknown>): string => {
    return String(row.cname || row.customer_name || row.customerName || row.billing_name || '-');
  };

  // ISSUE 1: Helper to format cell value - handles nested objects properly
  const formatCellValue = (value: unknown): React.ReactNode => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return '-';
    }
    
    // Handle arrays (nested data like inv, pos, etc.)
    if (Array.isArray(value)) {
      if (value.length === 0) return '-';
      
      // Check if it's an array of objects (like invoices)
      if (typeof value[0] === 'object' && value[0] !== null) {
        return (
          <div className="nested-items">
            {value.map((item: unknown, idx: number) => {
              // Handle invoice-like objects
              const obj = item as Record<string, unknown>;
              if (obj.inum || obj.invoice_number || obj.note_num) {
                // It's an invoice/note
                const num = String(obj.inum || obj.invoice_number || obj.note_num || '');
                const date = String(obj.idt || obj.invoice_date || obj.note_date || '');
                const val = obj.val !== undefined ? Number(obj.val) : Number(obj.txval || obj.invoice_value || 0);
                const txval = Number(obj.txval || obj.taxable_value || 0);
                return (
                  <div key={idx} className="nested-item">
                    <span className="nested-main">{num}</span>
                    {date && <span className="nested-secondary">{date}</span>}
                    <span className="nested-number">₹{val.toLocaleString('en-IN')}</span>
                    {txval > 0 && (
                      <span className="nested-tax">Tax: ₹{txval.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                );
              }
              // Generic object
              return (
                <div key={idx} className="nested-item">
                  {JSON.stringify(item)}
                </div>
              );
            })}
          </div>
        );
      }
      
      // Array of primitives
      return value.join(', ');
    }
    
    // Handle objects (non-array)
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      
      // Check for known object types
      if (obj.inum || obj.invoice_number) {
        // Single invoice object
        const num = String(obj.inum || obj.invoice_number || '');
        const val = Number(obj.val || obj.txval || 0);
        return (
          <span className="inline-nested">
            {num} | ₹{val.toLocaleString('en-IN')}
          </span>
        );
      }
      
      // Try to extract useful fields
      const usefulFields = ['val', 'txval', 'rate', 'iamt', 'camt', 'samt', 'csamt', 'qty', 'unit_price'];
      const found: string[] = [];
      for (const field of usefulFields) {
        if (obj[field] !== undefined && obj[field] !== null) {
          found.push(`${field}: ${Number(obj[field]).toLocaleString('en-IN')}`);
        }
      }
      
      if (found.length > 0) {
        return found.join(', ');
      }
      
      // Fallback: show as JSON string ( ISSUE 1 fix - no more [object Object] )
      return JSON.stringify(value).slice(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
    }
    
    // Handle numbers - format with Indian locale
    if (typeof value === 'number') {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    
    // Handle strings and other primitives
    return String(value);
  };

  // Format column header: convert snake_case to Title Case
  const formatHeader = (header: string): string => {
    return header
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Check if a column contains nested data
  const hasNestedData = (column: string): boolean => {
    const firstVal = data[0][column];
    return Array.isArray(firstVal) || (typeof firstVal === 'object' && firstVal !== null);
  };

  return (
    <div className="gstr-table-wrapper">
      <div className="gstr-table-header">
        <h3 className="gstr-table-title">{title}</h3>
        {description && (
          <p className="gstr-table-description">{description}</p>
        )}
      </div>
      <div className="gstr-excel-table">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {columns.map((col) => (
                <th key={col}>{formatHeader(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td className="row-number">{idx + 1}</td>
                {columns.map((col) => (
                  <td 
                    key={col} 
                    className={hasNestedData(col) ? 'has-nested-data' : ''}
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DynamicTable;
