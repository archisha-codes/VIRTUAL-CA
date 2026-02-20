/**
 * GST Backend API Service Layer
 * 
 * This module provides functions to communicate with the FastAPI backend
 * for GSTR-1 and GSTR-3B processing, import/export operations.
 * 
 * Backend = Single source of truth
 * Frontend = UI only (presentation layer)
 */

import { useAuth } from '@/contexts/AuthContext';

// API Base URL - should match backend FastAPI server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================
// Type Definitions (matching backend schema)
// ============================================

export interface BackendB2BInvoice {
  invoice_no: string;
  invoice_date: string;
  invoice_value: number;
  place_of_supply: string;
  reverse_charge: boolean;
  invoice_type: string;
  ecommerce_gstin: string;
  // Customer can be optional for some invoices
  customer?: {
    gstin: string;
    name: string;
  };
  // Support both GSTN format (txval, iamt, camt, samt, csamt, rt) and camelCase format
  items: Array<{
    // GSTN format
    txval?: number;
    iamt?: number;
    camt?: number;
    samt?: number;
    csamt?: number;
    rt?: number;
    // camelCase format
    taxable_value?: number;
    igst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    cess_amount?: number;
    tax_rate?: number;
  }>;
}

export interface BackendB2CLInvoice {
  invoice_no: string;
  invoice_date: string;
  invoice_value: number;
  place_of_supply: string;
  invoice_type: string;
  ecommerce_gstin: string;
  // Customer can be optional for some invoices
  customer?: {
    gstin: string;
    name: string;
  };
  // Support both GSTN format (txval, iamt, camt, samt, csamt, rt) and camelCase format
  items: Array<{
    // GSTN format
    txval?: number;
    iamt?: number;
    camt?: number;
    samt?: number;
    csamt?: number;
    rt?: number;
    // camelCase format
    taxable_value?: number;
    igst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    cess_amount?: number;
    tax_rate?: number;
  }>;
  shipping_bill?: {
    bill_no: string;
    bill_date: string;
    port_code: string;
  };
}

export interface BackendB2CSEntry {
  // Flat structure from backend: {pos, rt, txval, iamt, camt, samt, csamt}
  pos?: string;
  rt?: number;
  txval?: number;
  iamt?: number;
  camt?: number;
  samt?: number;
  csamt?: number;
  // Also support nested structure for backwards compatibility
  invoice_no?: string;
  invoice_date?: string;
  invoice_value?: number;
  place_of_supply?: string;
  invoice_type?: string;
  ecommerce_gstin?: string;
  // Support both GSTN format and camelCase format in nested items
  items?: Array<{
    // GSTN format
    txval?: number;
    iamt?: number;
    camt?: number;
    samt?: number;
    csamt?: number;
    rt?: number;
    // camelCase format
    taxable_value?: number;
    igst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    cess_amount?: number;
    tax_rate?: number;
  }>;
}

export interface BackendExportInvoice {
  invoice_no: string;
  invoice_date: string;
  invoice_value: number;
  place_of_supply: string;
  invoice_type: string;
  ecommerce_gstin: string;
  // Customer can be optional for some invoices
  customer?: {
    gstin: string;
    name: string;
  };
  // Support both GSTN format (txval, iamt, rt) and camelCase format
  items: Array<{
    // GSTN format
    txval?: number;
    iamt?: number;
    rt?: number;
    // camelCase format
    taxable_value?: number;
    igst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    cess_amount?: number;
    tax_rate?: number;
  }>;
  shipping_bill?: {
    bill_no: string;
    bill_date: string;
    port_code: string;
  };
}

export interface BackendCDNREntry {
  invoice_no: string;
  invoice_date: string;
  invoice_value: number;
  place_of_supply: string;
  reverse_charge: boolean;
  invoice_type: string;
  ecommerce_gstin: string;
  // Customer can be optional for some entries
  customer?: {
    gstin: string;
    name: string;
  };
  // Support both GSTN format (txval, iamt, camt, samt, csamt, rt) and camelCase format
  items: Array<{
    // GSTN format
    txval?: number;
    iamt?: number;
    camt?: number;
    samt?: number;
    csamt?: number;
    rt?: number;
    // camelCase format
    taxable_value?: number;
    igst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    cess_amount?: number;
    tax_rate?: number;
  }>;
}

export interface BackendGSTR1Summary {
  total_taxable_value: number;
  total_igst: number;
  total_cgst: number;
  total_sgst: number;
  total_cess: number;
  total_invoices: number;
  b2b_count: number;
  b2cl_count: number;
  b2cs_count: number;
  exp_count: number;
  cdnr_count: number;
}

export interface BackendValidationError {
  row: number;
  field: string;
  value: string | null;
  message: string;
  error_code: string;
}

export interface BackendValidationSummary {
  total_errors: number;
  total_warnings: number;
  errors: BackendValidationError[];
  warnings: string[];
  is_valid: boolean;
}

export interface BackendGSTR1Response {
  b2b: BackendB2BInvoice[];
  b2cl: BackendB2CLInvoice[];
  b2cs: BackendB2CSEntry[];
  export: BackendExportInvoice[];
  cdnr: BackendCDNREntry[];
  cdnur: BackendCDNREntry[];
  summary: BackendGSTR1Summary;
  validation_summary: BackendValidationSummary;
}

export interface BackendUploadResponse {
  summary: {
    b2b_count: number;
    b2cl_count: number;
    b2cs_count: number;
    export_count: number;
    total_invoices: number;
    total_taxable_value: number;
    total_igst: number;
    total_cgst: number;
    total_sgst: number;
    total_cess: number;
    gstr3b?: Record<string, unknown>;
  };
  errors: Array<{
    row: number;
    error: string;
  }>;
  warnings?: string[];
  message?: string;
}

export interface GSTR1ExportRequest {
  clean_data: Record<string, unknown>[];
  return_period: string;
  taxpayer_gstin: string;
  taxpayer_name: string;
  company_gstin?: string;
  include_hsn?: boolean;
  include_docs?: boolean;
}

export interface GSTR3BExportRequest {
  clean_data: Record<string, unknown>[];
  return_period: string;
  taxpayer_gstin: string;
  taxpayer_name: string;
}

// ============================================
// API Helper Functions
// ============================================

async function getAuthHeaders(): Promise<HeadersInit> {
  // Get JWT token from localStorage (set by FastAPI login)
  const token = localStorage.getItem('gst_access_token');
  
  const headers: HeadersInit = {
    // 'Content-Type': 'multipart/form-data' is handled automatically for FormData
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `HTTP Error: ${response.status}`);
  }
  
  // Check if response is a file download
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return response.blob() as unknown as T;
  }
  
  return response.json();
}

// ============================================
// API Functions
// ============================================

/**
 * Upload Excel file for GSTR-1 processing
 * POST /upload-sales-excel
 */
export async function uploadSalesExcel(
  file: File,
  onProgress?: (progress: number) => void
): Promise<BackendUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/upload-sales-excel`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });
  
  return handleResponse<BackendUploadResponse>(response);
}

/**
 * Upload Excel file for GSTR-1 processing (JWT auth version)
 * POST /upload-gstr1-excel
 */
export async function uploadGSTR1Excel(
  file: File
): Promise<BackendUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/upload-gstr1-excel`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });
  
  return handleResponse<BackendUploadResponse>(response);
}

/**
 * Export GSTR-1 as Excel file
 * POST /download-gstr1-excel
 */
export async function exportGSTR1Excel(
  request: GSTR1ExportRequest
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/download-gstr1-excel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });
  
  return handleResponse<Blob>(response);
}

/**
 * Export GSTR-3B as Excel file
 * POST /download-gstr3b-excel
 */
export async function exportGSTR3BExcel(
  request: GSTR3BExportRequest
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/download-gstr3b-excel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });
  
  return handleResponse<Blob>(response);
}

/**
 * Download GSTR-1 template
 * GET /gstr1-template-download
 */
export async function downloadGSTR1Template(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/gstr1-template-download`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  
  return handleResponse<Blob>(response);
}

/**
 * Login and get JWT token
 * POST /login
 */
export async function login(username: string, password: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  return handleResponse(response);
}

/**
 * Get current user info
 * GET /me
 */
export async function getCurrentUser(): Promise<{
  username: string;
  role: string;
  email: string;
}> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  
  return handleResponse(response);
}

/**
 * Export validation errors as CSV
 * POST /export-errors-csv
 */
export async function exportErrorsCSV(
  errors: Array<{ row?: number; type?: string; severity?: string; message?: string; sheet?: string; column?: string }>
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export-errors-csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({ errors }),
  });
  
  return handleResponse<Blob>(response);
}

// ============================================
// File Download Helpers
// ============================================

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Download Excel file from backend response
 */
export function downloadExcelFromResponse(
  blob: Blob,
  defaultFilename: string = 'gstr_export.xlsx'
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '_').slice(0, 19);
  const filename = defaultFilename.replace('.xlsx', `_${timestamp}.xlsx`);
  downloadBlob(blob, filename);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if backend is running
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ping backend
 */
export async function pingBackend(): Promise<{ ping: string; timestamp: string }> {
  const response = await fetch(`${API_BASE_URL}/ping`, {
    method: 'GET',
  });
  return handleResponse(response);
}

// ============================================
// NEW API Functions for /api/gstr1/* Endpoints
// ============================================

/**
 * Get columns from uploaded Excel file
 * POST /api/gstr1/get-columns
 */
export async function getExcelColumns(
  file: File
): Promise<{ columns: string[]; column_count: number; sample_data: Record<string, unknown>[] }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/gstr1/get-columns`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });

  return handleResponse(response);
}

/**
 * Process Excel file and return structured GSTR-1 tables
 * POST /api/gstr1/process
 * 
 * This is the MAIN integration endpoint for frontend.
 * Sends FormData with file and mapping.
 */
export interface GSTR1ProcessResponse {
  success: boolean;
  data: {
    summary: {
      total_taxable_value: number;
      total_igst: number;
      total_cgst: number;
      total_sgst: number;
      total_cess: number;
      total_invoices: number;
      b2b_count: number;
      b2cl_count: number;
      b2cs_count: number;
      exp_count: number;
      cdnr_count: number;
      [key: string]: unknown;
    };
    b2b: BackendB2BInvoice[];
    b2cl: BackendB2CLInvoice[];
    b2cs: BackendB2CSEntry[];
    exp: BackendExportInvoice[];
    cdnr: BackendCDNREntry[];
    cdnur: BackendCDNREntry[];
    hsn: Array<{
      hsn_code: string;
      description: string;
      uom: string;
      quantity: number;
      total_value: number;
      taxable_value: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      rate: number;
    }>;
  };
  validation_report: {
    errors: string[];
    warnings: string[];
    final_status: string;
  };
  total_records: number;
}

export async function processGSTR1Excel(
  file: File,
  mapping: Record<string, string>,
  companyGstin?: string,
  returnPeriod?: string
): Promise<GSTR1ProcessResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));

  const response = await fetch(`${API_BASE_URL}/api/gstr1/process`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });

  return handleResponse<GSTR1ProcessResponse>(response);
}

/**
 * Export GSTR-1 Excel file
 * POST /api/gstr1/export
 * 
 * Expected payload:
 * {
 *   "gstr1_tables": {...}
 * }
 */
export async function apiExportGSTR1Excel(
  gstr1_tables: Record<string, unknown>,
  return_period: string,
  taxpayer_gstin: string,
  taxpayer_name: string,
  company_gstin?: string,
  include_hsn: boolean = true,
  include_docs: boolean = false
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      gstr1_tables,
      return_period,
      taxpayer_gstin,
      taxpayer_name,
      company_gstin,
      include_hsn,
      include_docs,
    }),
  });

  return handleResponse<Blob>(response);
}

/**
 * Export GSTR-3B Excel file
 * POST /api/gstr3b/export
 * 
 * Expected payload:
 * {
 *   "gstr3b_data": {...}
 * }
 */
export async function apiExportGSTR3BExcel(
  gstr3b_data: Record<string, unknown>,
  return_period: string,
  taxpayer_gstin: string,
  taxpayer_name: string
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/gstr3b/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      gstr3b_data,
      return_period,
      taxpayer_gstin,
      taxpayer_name,
    }),
  });

  return handleResponse<Blob>(response);
}

// ============================================
// GSTR-3B Process API Types
// ============================================

export interface GSTR3BProcessResponse {
  outward_summary: {
    b2b: Record<string, unknown>;
    exports: Record<string, unknown>;
    nil_exempt: Record<string, unknown>;
    rcm_inward: Record<string, unknown>;
    interstate: Record<string, unknown>;
    total_taxable: number;
  };
  inward_summary: {
    purchases: Record<string, unknown>;
    rcm_liability: Record<string, unknown>;
    itc_claimed?: Record<string, unknown>;
  };
  net_tax_liability: {
    total_liability: Record<string, unknown>;
    total_itc: Record<string, unknown>;
    net_payable: Record<string, unknown>;
    itc_claim?: Record<string, unknown>;
  };
  reconciliation: {
    exact_matches: ReconciliationEntry[];
    probable_matches: ReconciliationEntry[];
    gstin_matches: ReconciliationEntry[];
    no_matches: ReconciliationEntry[];
  };
  errors: string[];
}

export interface ReconciliationEntry {
  supplier_gstin: string;
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
  local_amount: number;
  matched_amount: number;
  match_category: 'exact_match' | 'probable_match' | 'gstin_match' | 'no_match';
  match_confidence: number;
  difference: number;
  difference_percent: number;
  supplier_name: string;
  notes: string;
}

/**
 * Process GSTR-3B with ITC reconciliation
 * POST /api/gstr3b/process
 * 
 * Expected payload (FormData):
 * {
 *   "gstr1_tables": JSON.stringify({b2b: [...], b2cl: [...], ...})
 * }
 */
export async function processGSTR3B(
  gstr1_tables: Record<string, unknown>,
  purchasesFile: File | null
): Promise<GSTR3BProcessResponse> {
  const formData = new FormData();
  // Wrap gstr1_tables in {gstr1_tables: {...}} format for backend compatibility
  formData.append('gstr1_tables', JSON.stringify({gstr1_tables}));
  
  if (purchasesFile) {
    formData.append('purchases_file', purchasesFile);
  }

  const response = await fetch(`${API_BASE_URL}/api/gstr3b/process`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });

  return handleResponse<GSTR3BProcessResponse>(response);
}
