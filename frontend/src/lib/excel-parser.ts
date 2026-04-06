import * as XLSX from 'xlsx';

export interface ExcelRow {
  [key: string]: string | number | Date | null;
}

export interface ParsedExcel {
  headers: string[];
  rows: ExcelRow[];
  sheetNames: string[];
}

// Chunk processing configuration
export const CHUNK_SIZE = 1000;

// Progress callback type
export type ProgressCallback = (processed: number, total: number) => void;

// Process large Excel files in chunks for better performance
export async function processLargeExcelFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParsedExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const sheetNames = workbook.SheetNames;
        const firstSheet = workbook.Sheets[sheetNames[0]];

        // Get range and headers
        const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
        const headers: string[] = [];

        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
          const cell = firstSheet[cellAddress];
          headers.push(cell ? String(cell.v) : `Column ${col + 1}`);
        }

        // Get total rows (excluding header)
        const totalRows = range.e.r;

        // Process in chunks
        const allRows: ExcelRow[] = [];
        
        for (let startRow = 1; startRow <= range.e.r; startRow += CHUNK_SIZE) {
          const endRow = Math.min(startRow + CHUNK_SIZE - 1, range.e.r);
          
          // Create a temporary range for this chunk
          const chunkRange = {
            s: { r: startRow, c: range.s.c },
            e: { r: endRow, c: range.e.c }
          };
          
          // Create a new sheet with just this chunk
          const chunkSheet = XLSX.utils.aoa_to_sheet([]);
          
          // Copy data row by row
          for (let r = startRow; r <= endRow; r++) {
            const rowData: (string | number | null)[] = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cellAddress = XLSX.utils.encode_cell({ r, c });
              const cell = firstSheet[cellAddress];
              rowData.push(cell ? cell.v : null);
            }
            XLSX.utils.sheet_add_aoa(chunkSheet, [rowData], { origin: r - startRow });
          }
          
          // Add header row to chunk
          XLSX.utils.sheet_add_aoa(chunkSheet, [headers], { origin: -1 });
          
          // Parse chunk
          const chunkData = XLSX.utils.sheet_to_json<ExcelRow>(chunkSheet, {
            raw: false,
            dateNF: 'yyyy-mm-dd',
          });
          
          allRows.push(...chunkData);
          
          // Report progress
          if (onProgress) {
            onProgress(allRows.length, totalRows);
          }
          
          // Allow UI to update (yield to event loop)
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        resolve({
          headers,
          rows: allRows,
          sheetNames,
        });
      } catch (error) {
        reject(new Error('Failed to process Excel file. Please ensure it is a valid .xlsx or .xls file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Process invoices in chunks for large datasets
export async function processInvoicesChunked(
  rows: ExcelRow[],
  mapping: ColumnMapping,
  onProgress?: ProgressCallback
): Promise<ReturnType<typeof mapRowToInvoice>[]> {
  const results: ReturnType<typeof mapRowToInvoice>[] = [];
  const total = rows.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    
    for (const row of chunk) {
      results.push(mapRowToInvoice(row, mapping));
    }

    if (onProgress) {
      onProgress(i + chunk.length, total);
    }

    // Yield to event loop for UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

export interface ColumnMapping {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  gstin: string;
  place_of_supply: string;
  hsn_code: string;
  taxable_value: string;
  rate: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  invoice_value: string;
  quantity: string;
  uom: string;
  document_type: string;
  supply_type: string;
  reverse_charge: string;
}

export const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
  'invoice_number',
  'invoice_date',
  'taxable_value',
  'invoice_value',
];

export const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  invoice_number: 'Invoice Number',
  invoice_date: 'Invoice Date',
  customer_name: 'Customer Name',
  gstin: 'GSTIN',
  place_of_supply: 'Place of Supply',
  hsn_code: 'HSN Code',
  taxable_value: 'Taxable Value',
  rate: 'Tax Rate (%)',
  cgst: 'CGST Amount',
  sgst: 'SGST Amount',
  igst: 'IGST Amount',
  cess: 'CESS Amount',
  invoice_value: 'Invoice Value / Total',
  quantity: 'Quantity',
  uom: 'Unit of Measure',
  document_type: 'Document Type',
  supply_type: 'Supply Type',
  reverse_charge: 'Reverse Charge',
};

// Purchase invoice field labels (reusing same column mapping structure)
export const PURCHASE_REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
  'invoice_number',
  'invoice_date',
  'taxable_value',
  'invoice_value',
];

export const PURCHASE_FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  invoice_number: 'Invoice Number',
  invoice_date: 'Invoice Date',
  customer_name: 'Supplier Name',
  gstin: 'Supplier GSTIN',
  place_of_supply: 'Place of Supply',
  hsn_code: 'HSN Code',
  taxable_value: 'Taxable Value',
  rate: 'Tax Rate (%)',
  cgst: 'CGST Amount',
  sgst: 'SGST Amount',
  igst: 'IGST Amount',
  cess: 'CESS Amount',
  invoice_value: 'Invoice Value / Total',
  quantity: 'Quantity',
  uom: 'Unit of Measure',
  document_type: 'Document Type',
  supply_type: 'Supply Type',
  reverse_charge: 'Reverse Charge',
};

export async function parseExcelFile(file: File): Promise<ParsedExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const sheetNames = workbook.SheetNames;
        const firstSheet = workbook.Sheets[sheetNames[0]];

        // Get range and headers
        const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
        const headers: string[] = [];

        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
          const cell = firstSheet[cellAddress];
          headers.push(cell ? String(cell.v) : `Column ${col + 1}`);
        }

        // Parse rows
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        resolve({
          headers,
          rows: jsonData,
          sheetNames,
        });
      } catch (error) {
        reject(new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function autoMapColumns(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  const patterns: Record<keyof ColumnMapping, RegExp[]> = {
    invoice_number: [/invoice\s*no/i, /inv\s*no/i, /invoice\s*number/i, /bill\s*no/i],
    invoice_date: [/invoice\s*date/i, /inv\s*date/i, /date/i, /bill\s*date/i],
    customer_name: [/customer\s*name/i, /party\s*name/i, /buyer\s*name/i, /name/i],
    customer_gstin: [/gstin/i, /gst\s*no/i, /customer\s*gstin/i, /buyer\s*gstin/i],
    place_of_supply: [/place\s*of\s*supply/i, /pos/i, /state/i],
    hsn_code: [/hsn/i, /hsn\s*code/i, /sac/i],
    taxable_value: [/taxable\s*value/i, /taxable/i, /base\s*amount/i, /net\s*amount/i],
    cgst_rate: [/cgst\s*rate/i, /cgst\s*%/i],
    cgst_amount: [/cgst\s*amount/i, /cgst/i],
    sgst_rate: [/sgst\s*rate/i, /sgst\s*%/i],
    sgst_amount: [/sgst\s*amount/i, /sgst/i],
    igst_rate: [/igst\s*rate/i, /igst\s*%/i],
    igst_amount: [/igst\s*amount/i, /igst/i],
    total_amount: [/total\s*amount/i, /total/i, /gross\s*amount/i, /invoice\s*value/i],
  };

  for (const [field, regexPatterns] of Object.entries(patterns)) {
    for (const pattern of regexPatterns) {
      const matchIndex = lowerHeaders.findIndex(h => pattern.test(h));
      if (matchIndex !== -1 && !Object.values(mapping).includes(headers[matchIndex])) {
        mapping[field as keyof ColumnMapping] = headers[matchIndex];
        break;
      }
    }
  }

  return mapping;
}

export function mapRowToInvoice(row: ExcelRow, mapping: ColumnMapping) {
  const getValue = (field: keyof ColumnMapping) => {
    const columnName = mapping[field];
    if (!columnName) return null;
    return row[columnName] ?? null;
  };

  const parseNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[₹,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const parseDate = (value: unknown): string | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      // Try parsing various date formats
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  };

  return {
    invoice_number: String(getValue('invoice_number') || ''),
    invoice_date: parseDate(getValue('invoice_date')),
    customer_name: String(getValue('customer_name') || ''),
    customer_gstin: String(getValue('customer_gstin') || ''),
    place_of_supply: String(getValue('place_of_supply') || ''),
    hsn_code: String(getValue('hsn_code') || ''),
    taxable_value: parseNumber(getValue('taxable_value')),
    cgst_rate: parseNumber(getValue('cgst_rate')),
    cgst_amount: parseNumber(getValue('cgst_amount')),
    sgst_rate: parseNumber(getValue('sgst_rate')),
    sgst_amount: parseNumber(getValue('sgst_amount')),
    igst_rate: parseNumber(getValue('igst_rate')),
    igst_amount: parseNumber(getValue('igst_amount')),
    total_amount: parseNumber(getValue('total_amount')),
    raw_data: row,
  };
}
