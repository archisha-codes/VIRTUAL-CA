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
  returnPeriod?: string,
  workspaceId?: string
): Promise<GSTR1ProcessResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  
  // Add workspace context for multi-tenant support
  if (workspaceId) {
    formData.append('workspace_id', workspaceId);
  }
  if (companyGstin) {
    formData.append('company_gstin', companyGstin);
  }
  if (returnPeriod) {
    formData.append('return_period', returnPeriod);
  }

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

// ============================================
// CLIENT MANAGEMENT API
// ============================================

export interface Client {
  id: string;
  business_name: string;
  gstin: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface CreateClientRequest {
  business_name: string;
  gstin: string;
  email: string;
  phone: string;
}

export interface UpdateClientRequest {
  business_name?: string;
  gstin?: string;
  email?: string;
  phone?: string;
}

/**
 * Get all clients
 * GET /clients
 */
export async function getClients(search?: string): Promise<Client[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`${API_BASE_URL}/clients${params}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Client[]>(response);
}

/**
 * Get a specific client by ID
 * GET /clients/{client_id}
 */
export async function getClient(clientId: string): Promise<Client> {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Client>(response);
}

/**
 * Create a new client
 * POST /clients
 */
export async function createClient(client: CreateClientRequest): Promise<Client> {
  const response = await fetch(`${API_BASE_URL}/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(client),
  });
  return handleResponse<Client>(response);
}

/**
 * Update a client
 * PUT /clients/{client_id}
 */
export async function updateClient(clientId: string, client: UpdateClientRequest): Promise<Client> {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(client),
  });
  return handleResponse<Client>(response);
}

/**
 * Delete a client
 * DELETE /clients/{client_id}
 */
export async function deleteClient(clientId: string): Promise<{ message: string; client: Client }> {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string; client: Client }>(response);
}

// ============================================
// GSTIN LOOKUP API
// ============================================

export interface GSTINDetails {
  gstin: string;
  legal_name: string;
  trade_name: string;
  status: string;
  registration_date: string;
  state: string;
  constitution: string;
  taxpayer_type: string;
  cancellation_status: string;
  last_updated: string;
}

export interface GSTINLookupResponse {
  success: boolean;
  data: GSTINDetails;
}

/**
 * Lookup GSTIN taxpayer details
 * GET /gstin/{gstin}
 */
export async function lookupGSTIN(gstin: string): Promise<GSTINLookupResponse> {
  const response = await fetch(`${API_BASE_URL}/gstin/${encodeURIComponent(gstin)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<GSTINLookupResponse>(response);
}

// ============================================
// INVOICE MANAGEMENT API
// ============================================

export interface Invoice {
  id: string;
  invoice_no: string;
  gstin: string;
  customer_gstin?: string;
  customer_name?: string;
  amount: number;
  tax_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  date: string;
  type: 'sale' | 'purchase';
  place_of_supply?: string;
  hsn_code?: string;
  description?: string;
  created_at: string;
}

export interface CreateInvoiceRequest {
  invoice_no: string;
  gstin: string;
  customer_gstin?: string;
  customer_name?: string;
  amount: number;
  tax_amount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  date: string;
  type: 'sale' | 'purchase';
  place_of_supply?: string;
  hsn_code?: string;
  description?: string;
}

export interface UploadInvoicesResponse {
  success: boolean;
  message: string;
  uploaded_count: number;
  error_count: number;
  invoices: Invoice[];
  errors: Array<{
    row: number;
    error: string;
    data: Record<string, unknown>;
  }>;
}

export interface GSTR1GeneratedData {
  b2b: Invoice[];
  b2cl: Invoice[];
  b2cs: Invoice[];
  exp: Invoice[];
  cdnr: Invoice[];
  cdnur: Invoice[];
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
}

export interface GSTR1GenerateResponse {
  success: boolean;
  gstr1: GSTR1GeneratedData;
  summary: {
    total_invoices: number;
    total_taxable_value: number;
    total_igst: number;
    total_cgst: number;
    total_sgst: number;
    total_cess: number;
    b2b_count: number;
    b2cl_count: number;
    b2cs_count: number;
    exp_count: number;
  };
  total_records: number;
}

export interface GSTR3BCalculatedData {
  return_period: string;
  taxpayer_gstin: string;
  output_tax: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  itc: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  net_payable: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  summary: {
    total_sales: number;
    total_purchases: number;
    total_output_tax: number;
    total_itc: number;
    net_tax_payable: number;
  };
}

export interface GSTR3BCalculateResponse {
  success: boolean;
  return_period: string;
  taxpayer_gstin: string;
  output_tax: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  itc: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  net_payable: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  summary: {
    total_sales: number;
    total_purchases: number;
    total_output_tax: number;
    total_itc: number;
    net_tax_payable: number;
  };
}

/**
 * Get all invoices with optional filtering
 * GET /invoices
 */
export async function getInvoices(
  invoiceType?: 'sale' | 'purchase',
  search?: string
): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (invoiceType) params.append('invoice_type', invoiceType);
  if (search) params.append('search', search);
  
  const queryString = params.toString();
  const response = await fetch(`${API_BASE_URL}/invoices${queryString ? '?' + queryString : ''}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Invoice[]>(response);
}

/**
 * Get a specific invoice by ID
 * GET /invoices/{invoice_id}
 */
export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Invoice>(response);
}

/**
 * Create a new invoice
 * POST /invoices
 */
export async function createInvoice(invoice: CreateInvoiceRequest): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(invoice),
  });
  return handleResponse<Invoice>(response);
}

/**
 * Delete an invoice
 * DELETE /invoices/{invoice_id}
 */
export async function deleteInvoice(invoiceId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

/**
 * Upload invoices from Excel/CSV file
 * POST /upload-invoices
 */
export async function uploadInvoices(
  file: File,
  invoiceType: 'sale' | 'purchase' = 'sale'
): Promise<UploadInvoicesResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('invoice_type', invoiceType);
  
  const response = await fetch(`${API_BASE_URL}/upload-invoices`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });
  return handleResponse<UploadInvoicesResponse>(response);
}

/**
 * Generate GSTR-1 from uploaded invoices
 * POST /generate-gstr1
 */
export async function generateGSTR1(
  invoiceType: 'sale' | 'purchase' = 'sale'
): Promise<GSTR1GenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/generate-gstr1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({ invoice_type: invoiceType }),
  });
  return handleResponse<GSTR1GenerateResponse>(response);
}

/**
 * Calculate GSTR-3B tax liability
 * POST /calculate-gstr3b
 */
export async function calculateGSTR3B(
  returnPeriod: string,
  taxpayerGstin: string
): Promise<GSTR3BCalculateResponse> {
  const formData = new FormData();
  formData.append('return_period', returnPeriod);
  formData.append('taxpayer_gstin', taxpayerGstin);
  
  const response = await fetch(`${API_BASE_URL}/calculate-gstr3b`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });
  return handleResponse<GSTR3BCalculateResponse>(response);
}

// ============================================
// USER REGISTRATION API
// ============================================

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  company_name?: string;
  gstin?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: {
    username: string;
    email: string;
    full_name: string;
  };
}

/**
 * Register a new user
 * POST /register
 */
export async function register(request: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return handleResponse<RegisterResponse>(response);
}

// ============================================
// RETURNS DATABASE API
// ============================================

export interface ReturnFiling {
  id: string;
  gstin: string;
  return_type: 'GSTR1' | 'GSTR3B' | 'GSTR2B';
  period: string;
  status: 'pending' | 'filed' | 'available';
  filed_date: string | null;
  arn: string | null;
  created_at: string;
}

export interface FilingStatusResponse {
  gstin: string;
  current_period: string;
  returns: {
    GSTR1: {
      period: string;
      status: string;
      filed_date?: string;
      arn?: string;
    };
    GSTR3B: {
      period: string;
      status: string;
      filed_date?: string;
      arn?: string;
    };
    GSTR2B: {
      period: string;
      status: string;
      filed_date?: string;
      arn?: string;
    };
  };
  summary: {
    total_returns: number;
    filed: number;
    pending: number;
    available: number;
  };
}

/**
 * Record a new return filing
 * POST /returns
 */
export async function createReturn(filing: {
  gstin: string;
  return_type: string;
  period: string;
  status: string;
  filed_date?: string;
  arn?: string;
}): Promise<ReturnFiling> {
  const response = await fetch(`${API_BASE_URL}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(filing),
  });
  return handleResponse<ReturnFiling>(response);
}

/**
 * Get returns with filtering
 * GET /returns
 */
export async function getReturns(
  gstin?: string,
  returnType?: string,
  status?: string
): Promise<ReturnFiling[]> {
  const params = new URLSearchParams();
  if (gstin) params.append('gstin', gstin);
  if (returnType) params.append('return_type', returnType);
  if (status) params.append('status', status);
  
  const queryString = params.toString();
  const response = await fetch(`${API_BASE_URL}/returns${queryString ? '?' + queryString : ''}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<ReturnFiling[]>(response);
}

/**
 * Get filing status dashboard
 * GET /filing-status
 */
export async function getFilingStatus(gstin?: string): Promise<FilingStatusResponse> {
  const params = gstin ? `?gstin=${encodeURIComponent(gstin)}` : '';
  const response = await fetch(`${API_BASE_URL}/filing-status${params}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<FilingStatusResponse>(response);
}

// ============================================
// NOTIFICATIONS API
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  due_date?: string;
  read: boolean;
  created_at: string;
}

export interface CreateNotificationRequest {
  user_id: string;
  title: string;
  message: string;
  notification_type?: string;
  due_date?: string;
}

/**
 * Create a notification
 * POST /notifications
 */
export async function createNotification(
  notification: CreateNotificationRequest
): Promise<Notification> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(notification),
  });
  return handleResponse<Notification>(response);
}

/**
 * Get notifications for a user
 * GET /notifications
 */
export async function getNotifications(
  userId?: string,
  unreadOnly?: boolean
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (unreadOnly) params.append('unread_only', 'true');
  
  const queryString = params.toString();
  const response = await fetch(`${API_BASE_URL}/notifications${queryString ? '?' + queryString : ''}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Notification[]>(response);
}

/**
 * Mark notification as read
 * PUT /notifications/{id}/read
 */
export async function markNotificationRead(notificationId: string): Promise<Notification> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Notification>(response);
}

/**
 * Delete a notification
 * DELETE /notifications/{id}
 */
export async function deleteNotification(notificationId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

/**
 * Generate due date notifications
 * POST /notifications/generate-due-dates
 */
export async function generateDueDateNotifications(): Promise<{
  success: boolean;
  message: string;
  total_notifications: number;
}> {
  const response = await fetch(`${API_BASE_URL}/notifications/generate-due-dates`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{
    success: boolean;
    message: string;
    total_notifications: number;
  }>(response);
}

// ============================================
// GSTN SYNC API
// ============================================

export interface GSTNSyncRequest {
  gstin: string;
  return_period: string;
  sync_type: 'full' | 'gstr1' | 'gstr2b' | 'gstr3b';
}

export interface GSTNSyncResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    gstin: string;
    return_period: string;
    sync_type: string;
    status: string;
    message: string;
    records_downloaded: number;
    last_updated: string;
    created_at: string;
  };
}

export interface GSTNSyncLog {
  id: string;
  gstin: string;
  return_period: string;
  sync_type: string;
  status: string;
  message: string;
  records_downloaded: number;
  last_updated: string;
  created_at: string;
}

export interface GSTNSyncStatus {
  gstin: string;
  last_sync: string | null;
  status: string;
  records_downloaded: number;
  message: string;
}

/**
 * Sync GST data from GSTN portal
 * POST /sync-gstn
 */
export async function syncGSTN(request: GSTNSyncRequest): Promise<GSTNSyncResponse> {
  const response = await fetch(`${API_BASE_URL}/sync-gstn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });
  return handleResponse<GSTNSyncResponse>(response);
}

/**
 * Get GSTN sync logs
 * GET /sync-gstn/logs
 */
export async function getGSTNSyncLogs(
  gstin?: string,
  limit: number = 10
): Promise<GSTNSyncLog[]> {
  const params = new URLSearchParams();
  if (gstin) params.append('gstin', gstin);
  params.append('limit', limit.toString());
  
  const response = await fetch(`${API_BASE_URL}/sync-gstn/logs?${params}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<GSTNSyncLog[]>(response);
}

/**
 * Get GSTN sync status
 * GET /sync-gstn/status
 */
export async function getGSTNSyncStatus(gstin: string): Promise<GSTNSyncStatus> {
  const response = await fetch(`${API_BASE_URL}/sync-gstn/status?gstin=${encodeURIComponent(gstin)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<GSTNSyncStatus>(response);
}

// ============================================
// UPLOAD HISTORY API (DATA OVERVIEW)
// ============================================

export interface UploadHistoryRecord {
  id: string;
  file_name: string;
  template_type: string;
  record_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source: string;
  pan_gstin?: string;
  created_at: string;
}

export interface CreateUploadHistoryRequest {
  file_name: string;
  template_type: string;
  record_count: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  source?: string;
  pan_gstin?: string;
}

/**
 * Record an upload in history
 * POST /upload-history
 */
export async function createUploadHistoryRecord(
  request: CreateUploadHistoryRequest
): Promise<{ success: boolean; data: UploadHistoryRecord }> {
  const response = await fetch(`${API_BASE_URL}/upload-history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });
  return handleResponse<{ success: boolean; data: UploadHistoryRecord }>(response);
}

/**
 * Get upload history
 * GET /upload-history
 */
export async function getUploadHistory(
  limit: number = 20
): Promise<{ success: boolean; data: UploadHistoryRecord[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/upload-history?limit=${limit}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ success: boolean; data: UploadHistoryRecord[]; total: number }>(response);
}

/**
 * Delete an upload record
 * DELETE /upload-history/{record_id}
 */
export async function deleteUploadHistoryRecord(
  recordId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/upload-history/${recordId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ success: boolean; message: string }>(response);
}

// ============================================
// GSTR-1 VALIDATION API
// ============================================

export interface GSTR1ValidationRequest {
  gstr1_data: {
    b2b: BackendB2BInvoice[];
    b2cl: BackendB2CLInvoice[];
    b2cs: BackendB2CSEntry[];
    exp: BackendExportInvoice[];
    cdnr: BackendCDNREntry[];
  };
}

export interface GSTR1ValidationError {
  invoice?: string;
  error: string;
  field?: string;
  error_code?: string;
}

export interface GSTR1ValidationRule {
  name: string;
  category: string;
  severity: string;
  message: string;
  suggestion?: string | null;
  error_code?: string;
}

export interface GSTR1ValidationResultItem {
  rule: string;
  category: string;
  severity: string;
  message: string;
  field?: string | null;
  value?: string | null;
  expected?: string | null;
  actual?: string | null;
  row_index?: number | null;
  suggestion?: string | null;
  error_code?: string | null;
  corrected_value?: unknown;
}

export interface GSTR1ValidationResponse {
  success: boolean;
  is_valid: boolean;
  validation_report: {
    input_validation: {
      errors: string[];
      warnings: string[];
      rules?: GSTR1ValidationRule[];
      results?: GSTR1ValidationResultItem[];
      summary?: Record<string, number>;
      total_rows?: number;
      total_columns?: number;
      total_results?: number;
      total_errors?: number;
      total_warnings?: number;
      is_valid?: boolean;
    };
    table_validation: {
      errors: string[];
      warnings: string[];
      summary?: Record<string, number>;
      total_results?: number;
      total_errors?: number;
      total_warnings?: number;
      is_valid?: boolean;
      results?: GSTR1ValidationResultItem[];
      rules?: GSTR1ValidationRule[];
    };
    final_status: string;
  };
  summary: {
    total_rows: number;
    input_errors: number;
    input_warnings: number;
    table_errors: number;
    table_warnings: number;
  };
}

/**
 * Validate GSTR-1 data from uploaded file
 * POST /api/gstr1/validate
 * 
 * This endpoint performs comprehensive validation of GSTR-1 data including:
 * - GSTIN format validation (15 characters)
 * - Invoice number uniqueness
 * - Tax calculation verification
 * - HSN code validation
 * - Structured row-level and table-level validation
 */
export async function validateGSTR1File(
  file: File,
  mapping: Record<string, string>,
  companyGstin?: string
): Promise<GSTR1ValidationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  
  if (companyGstin) {
    formData.append('company_gstin', companyGstin);
  }

  const response = await fetch(`${API_BASE_URL}/api/gstr1/validate`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });

  return handleResponse<GSTR1ValidationResponse>(response);
}

/**
 * Validate GSTR-1 data (legacy database-based)
 * POST /api/gstr1/validate-db
 * 
 * DEPRECATED: Use validateGSTR1File() instead for file-based validation
 */
export async function validateGSTR1(gstr1Data?: {
  b2b?: BackendB2BInvoice[];
  b2cl?: BackendB2CLInvoice[];
  b2cs?: BackendB2CSEntry[];
  exp?: BackendExportInvoice[];
  cdnr?: BackendCDNREntry[];
}): Promise<GSTR1ValidationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/validate-db`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: gstr1Data ? JSON.stringify({ data: gstr1Data }) : undefined,
  });

  return handleResponse<GSTR1ValidationResponse>(response);
}

// ============================================
// GSTR-1 TABLE API ENDPOINTS
// ============================================

/**
 * Paginated response structure for GSTR-1 tables
 */
export interface GSTR1TableResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary: Record<string, number>;
}

/**
 * Get B2B invoices (invoices where customer GSTIN exists)
 * GET /api/gstr1/b2b
 */
export async function getB2BInvoices(
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<GSTR1TableResponse<Invoice>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  
  const response = await fetch(`${API_BASE_URL}/api/gstr1/b2b?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1TableResponse<Invoice>>(response);
}

/**
 * Get B2CS invoices (invoices where GSTIN is empty/unregistered)
 * GET /api/gstr1/b2cs
 */
export async function getB2CSInvoices(
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<GSTR1TableResponse<Invoice>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  
  const response = await fetch(`${API_BASE_URL}/api/gstr1/b2cs?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1TableResponse<Invoice>>(response);
}

/**
 * Get Credit and Debit Notes (CDNR)
 * GET /api/gstr1/cdnr
 */
export async function getCDNRInvoices(
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<GSTR1TableResponse<Invoice>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  
  const response = await fetch(`${API_BASE_URL}/api/gstr1/cdnr?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1TableResponse<Invoice>>(response);
}

/**
 * HSN Summary entry structure
 */
export interface HSNSummaryEntry {
  hsn_code: string;
  description: string;
  quantity: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  invoice_count: number;
}

/**
 * Get HSN code-wise summary
 * GET /api/gstr1/hsn
 */
export async function getHSNSummary(
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<GSTR1TableResponse<HSNSummaryEntry>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  
  const response = await fetch(`${API_BASE_URL}/api/gstr1/hsn?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1TableResponse<HSNSummaryEntry>>(response);
}

// ============================================
// GSTR-3B COMPUTE API
// ============================================

export interface GSTR3BComputeResponse {
  gstin: string;
  return_period: string;
  output_tax: number;
  input_tax: number;
  payable: number;
}

/**
 * Compute GSTR-3B tax liability
 * GET /api/gstr3b/compute
 * 
 * Calculates:
 * - output_tax: Sum of all sales invoices (GSTR-1) tax amount
 * - input_tax: Sum of all purchase invoices (GSTR-2A/2B) tax amount
 * - payable: net_tax = output_tax - input_tax
 * 
 * Query params:
 * - gstin: GSTIN of the taxpayer
 * - return_period: Return period in format YYYY-MM
 */
export async function computeGSTR3B(
  gstin: string,
  returnPeriod: string
): Promise<GSTR3BComputeResponse> {
  const params = new URLSearchParams({
    gstin,
    return_period: returnPeriod,
  });
  
  const response = await fetch(`${API_BASE_URL}/api/gstr3b/compute?${params}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  return handleResponse<GSTR3BComputeResponse>(response);
}

// ============================================
// GSTR-1 RECONCILIATION API
// ============================================

export interface ReconInvoice {
  invoice_number: string;
  gstin: string;
  customer_name: string;
  invoice_date?: string;
  invoice_value?: number;
  taxable_value: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  cess?: number;
}

export interface ReconResult {
  invoice_number: string;
  gstin: string;
  customer_name: string;
  sales_taxable?: number;
  einvoice_taxable?: number;
  difference?: number;
}

export interface ReconResponse {
  success: boolean;
  message?: string;
  data?: {
    matched: ReconResult[];
    mismatch: ReconResult[];
    missing_in_einvoice: ReconResult[];
    missing_in_sales: ReconResult[];
  };
}

export interface ReconRequest {
  workspace_id?: string;
  gstin?: string;
  einvoice_data?: ReconInvoice[];
  sales_register_data?: ReconInvoice[];
}

/**
 * Reconcile E-Invoice data with Sales Register
 * POST /api/gstr1/reconcile
 * 
 * Compares E-Invoice data with Sales Register to find:
 * - Matched invoices (exact match)
 * - Mismatched invoices (different values)
 * - Missing in E-Invoice (in sales but not in e-invoice)
 * - Missing in Sales (in e-invoice but not in sales)
 */
export async function reconcileGSTR1(
  request: ReconRequest
): Promise<ReconResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });

  return handleResponse<ReconResponse>(response);
}

/**
 * Update reconciliation invoice status
 * PUT /api/gstr1/reconcile/{id}/status
 * 
 * Updates the status of a reconciled invoice:
 * - accepted: Accept the reconciliation result
 * - rejected: Reject the reconciliation result
 * - extra: Mark as extra invoice
 */
export interface ReconStatusUpdateRequest {
  invoice_number: string;
  status: 'accepted' | 'rejected' | 'extra';
  notes?: string;
}

export interface ReconStatusUpdateResponse {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    invoice_number: string;
    status: string;
    updated_at: string;
  };
}

export async function updateReconciliationStatus(
  invoiceId: string,
  status: 'accepted' | 'rejected' | 'extra',
  notes?: string
): Promise<ReconStatusUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconcile/${invoiceId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({ status, notes }),
  });

  return handleResponse<ReconStatusUpdateResponse>(response);
}

// ============================================
// GSTR-1 ENHANCED RECONCILIATION API
// ============================================

export interface GSTR1ReconciliationRequest {
  workspace_id?: string;
  gstin?: string;
  return_period?: string;
  einvoice_data?: ReconInvoice[];
  sales_register_data?: ReconInvoice[];
}

export interface GSTR1ReconciliationSummary {
  matched_count: number;
  matched_total: number;
  mismatch_count: number;
  mismatch_total: number;
  missing_in_sales_count: number;
  missing_in_sales_total: number;
  missing_in_einvoice_count: number;
  missing_in_einvoice_total: number;
  total_einvoice_count: number;
  total_sales_count: number;
  total_einvoice_taxable: number;
  total_sales_taxable: number;
  total_einvoice_igst: number;
  total_einvoice_cgst: number;
  total_einvoice_sgst: number;
  total_sales_igst: number;
  total_sales_cgst: number;
  total_sales_sgst: number;
}

export interface GSTR1CustomerView {
  gstin: string;
  customer_name: string;
  matched_count: number;
  mismatched_count: number;
  missing_in_sales_count: number;
  missing_in_einvoice_count: number;
  total_count: number;
}

export interface GSTR1DocumentView {
  id: string;
  invoice_number: string;
  gstin: string;
  customer_name: string;
  invoice_date: string;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  status: string;
  remarks: string;
}

export interface GSTR1ReconciliationResponse {
  success: boolean;
  message: string;
  report_id: string;
  data: {
    summary: GSTR1ReconciliationSummary;
    customer_view: GSTR1CustomerView[];
    document_view: GSTR1DocumentView[];
  };
}

export interface GSTR1ReconciliationListItem {
  id: string;
  gstin: string;
  return_period: string;
  created_at: string;
  summary: GSTR1ReconciliationSummary;
}

export interface GSTR1ReconciliationListResponse {
  success: boolean;
  message: string;
  data: GSTR1ReconciliationListItem[];
}

/**
 * Create a new E-Invoice vs Sales Register reconciliation
 * POST /api/gstr1/reconciliation
 * 
 * This endpoint:
 * 1. Compares E-Invoice data with Sales Register
 * 2. Identifies matched, mismatched, and missing invoices
 * 3. Persists results for later retrieval
 * 4. Returns comprehensive reconciliation report
 */
export async function createGSTR1Reconciliation(
  request: GSTR1ReconciliationRequest
): Promise<GSTR1ReconciliationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconciliation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });

  return handleResponse<GSTR1ReconciliationResponse>(response);
}

/**
 * Get a saved reconciliation report by ID
 * GET /api/gstr1/reconciliation/{report_id}
 */
export async function getGSTR1Reconciliation(
  reportId: string
): Promise<GSTR1ReconciliationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconciliation/${reportId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1ReconciliationResponse>(response);
}

/**
 * List all reconciliation reports
 * GET /api/gstr1/reconciliation
 */
export async function listGSTR1Reconciliations(
  gstin?: string,
  returnPeriod?: string,
  limit: number = 10
): Promise<GSTR1ReconciliationListResponse> {
  const params = new URLSearchParams();
  if (gstin) params.append('gstin', gstin);
  if (returnPeriod) params.append('return_period', returnPeriod);
  params.append('limit', limit.toString());

  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconciliation?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1ReconciliationListResponse>(response);
}

/**
 * Update reconciliation status for an invoice
 * PUT /api/gstr1/reconciliation/{invoice_id}/status
 */
export async function updateGSTR1ReconciliationStatus(
  invoiceId: string,
  status: 'accepted' | 'rejected' | 'extra' | 'pending',
  notes?: string
): Promise<ReconStatusUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/reconciliation/${invoiceId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({ status, notes }),
  });

  return handleResponse<ReconStatusUpdateResponse>(response);
}

// ============================================
// WORKSPACE MANAGEMENT API
// ============================================

export interface Workspace {
  id: string;
  pan: string;
  name: string;
  description?: string;
  gstin_count: number;
  active_gstin_count: number;
  member_count: number;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceDetails extends Workspace {
  members: WorkspaceMember[];
  gstins: WorkspaceGSTIN[];
  settings: {
    default_return_type: string;
    auto_reconciliation: boolean;
    consolidated_filing: boolean;
    timezone: string;
  };
  is_active: boolean;
}

export interface WorkspaceMember {
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  gstin_access: string[];
  can_manage_members: boolean;
  can_file_returns: boolean;
}

export interface WorkspaceGSTIN {
  id: string;
  gstin: string;
  legal_name: string;
  trade_name?: string;
  state: string;
  status: 'active' | 'inactive' | 'cancelled';
  registration_type: string;
  category: string;
  is_default: boolean;
}

export interface CreateWorkspaceRequest {
  pan: string;
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  pan?: string;
  name?: string;
  description?: string;
}

export interface CreateGSTINRequest {
  gstin: string;
  legal_name: string;
  trade_name?: string;
  state: string;
  registration_type?: string;
  category?: string;
}

export interface AddMemberRequest {
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  gstin_access?: string[];
}

/**
 * Get all workspaces for a user
 * GET /api/workspaces
 */
export async function getWorkspaces(userId: string): Promise<Workspace[]> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces?user_id=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<Workspace[]>(response);
}

/**
 * Get a specific workspace by ID
 * GET /api/workspaces/{workspace_id}
 */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetails> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<WorkspaceDetails>(response);
}

/**
 * Create a new workspace
 * POST /api/workspaces
 */
export async function createWorkspace(
  userId: string,
  data: CreateWorkspaceRequest
): Promise<Workspace> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Workspace>(response);
}

/**
 * Update a workspace
 * PUT /api/workspaces/{workspace_id}
 */
export async function updateWorkspace(
  workspaceId: string,
  data: UpdateWorkspaceRequest
): Promise<Workspace> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Workspace>(response);
}

/**
 * Delete a workspace
 * DELETE /api/workspaces/{workspace_id}
 */
export async function deleteWorkspace(workspaceId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

/**
 * Get GSTINs in a workspace
 * GET /api/workspaces/{workspace_id}/gstins
 */
export async function getWorkspaceGstins(workspaceId: string): Promise<WorkspaceGSTIN[]> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/gstins`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<WorkspaceGSTIN[]>(response);
}

/**
 * Add a GSTIN to a workspace
 * POST /api/workspaces/{workspace_id}/gstins
 */
export async function createWorkspaceGstin(
  workspaceId: string,
  userId: string,
  data: CreateGSTINRequest
): Promise<WorkspaceGSTIN> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/gstins?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<WorkspaceGSTIN>(response);
}

/**
 * Remove a GSTIN from a workspace
 * DELETE /api/gstins/{gstin_id}
 */
export async function deleteWorkspaceGstin(
  gstinId: string,
  workspaceId: string,
  userId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/gstins/${gstinId}?user_id=${encodeURIComponent(userId)}&workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

/**
 * Get members of a workspace
 * GET /api/workspaces/{workspace_id}/members
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/members`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return handleResponse<WorkspaceMember[]>(response);
}

/**
 * Add a member to a workspace
 * POST /api/workspaces/{workspace_id}/members
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  data: AddMemberRequest
): Promise<WorkspaceMember> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/members?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<WorkspaceMember>(response);
}

/**
 * Remove a member from a workspace
 * DELETE /api/workspaces/{workspace_id}/members/{user_id}
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  memberUserId: string,
  userId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/members/${memberUserId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

/**
 * Switch default GSTIN in workspace
 * POST /api/workspaces/{workspace_id}/switch-gstin
 */
export async function switchWorkspaceGstin(
  workspaceId: string,
  gstinId: string,
  userId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/switch-gstin?user_id=${encodeURIComponent(userId)}&gstin_id=${encodeURIComponent(gstinId)}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(response);
}

// ============================================
// GSTR-1 WORKFLOW STATE API
// ============================================

/**
 * GSTR-1 Workflow State - Backend-driven state management
 * 
 * The backend is the single source of truth for GSTR1 workflow state.
 * This replaces localStorage-based state persistence.
 */

export interface GSTR1WorkflowState {
  id?: string;
  workspace_id: string;
  gstin: string;
  return_period: string;
  current_step: string;
  step_data: Record<string, unknown>;
  validation_status: Record<string, string>;
  gstr1_tables: Record<string, unknown> | null;
  upload_result: Record<string, unknown> | null;
  classification_result: Record<string, unknown> | null;
  validation_result: Record<string, unknown> | null;
  filing_result: Record<string, unknown> | null;
  last_saved: string;
  created_at?: string;
  updated_at?: string;
}

export interface GSTR1StateResponse {
  success: boolean;
  data?: GSTR1WorkflowState;
  message?: string;
}

export interface GSTR1StateListResponse {
  success: boolean;
  data: GSTR1WorkflowState[];
  total: number;
}

/**
 * Save GSTR-1 workflow state to backend
 * POST /api/gstr1/state
 * 
 * This replaces localStorage.setItem('gstr1_workflow_state', ...)
 */
export async function saveGstr1State(
  workspaceId: string,
  gstin: string,
  returnPeriod: string,
  state: {
    currentStep: string;
    stepData: Record<string, unknown>;
    validationStatus: Record<string, string>;
    gstr1Tables: Record<string, unknown> | null;
    uploadResult: Record<string, unknown> | null;
    classificationResult: Record<string, unknown> | null;
    validationResult: Record<string, unknown> | null;
    filingResult: Record<string, unknown> | null;
  }
): Promise<GSTR1StateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
      current_step: state.currentStep,
      step_data: state.stepData,
      validation_status: state.validationStatus,
      gstr1_tables: state.gstr1Tables,
      upload_result: state.uploadResult,
      classification_result: state.classificationResult,
      validation_result: state.validationResult,
      filing_result: state.filingResult,
      last_saved: new Date().toISOString(),
    }),
  });

  return handleResponse<GSTR1StateResponse>(response);
}

/**
 * Get saved GSTR-1 workflow state from backend
 * GET /api/gstr1/state
 * 
 * This replaces localStorage.getItem('gstr1_workflow_state')
 */
export async function getGstr1State(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<GSTR1StateResponse> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr1/state?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1StateResponse>(response);
}

/**
 * Get all saved GSTR-1 workflow states for a GSTIN/workspace
 * GET /api/gstr1/state/list
 */
export async function listGstr1States(
  workspaceId: string,
  gstin?: string,
  limit: number = 10
): Promise<GSTR1StateListResponse> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    limit: limit.toString(),
  });
  if (gstin) {
    params.append('gstin', gstin);
  }

  const response = await fetch(`${API_BASE_URL}/api/gstr1/state/list?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR1StateListResponse>(response);
}

/**
 * Delete/clear saved GSTR-1 workflow state
 * DELETE /api/gstr1/state
 * 
 * This replaces localStorage.removeItem('gstr1_workflow_state')
 */
export async function deleteGstr1State(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<{ success: boolean; message: string }> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr1/state?${params}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}

/**
 * Quick save GSTR-1 tables only (for incremental saves during workflow)
 * PUT /api/gstr1/state/tables
 */
export async function quickSaveGstr1Tables(
  workspaceId: string,
  gstin: string,
  returnPeriod: string,
  gstr1Tables: Record<string, unknown>
): Promise<GSTR1StateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/state/tables`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
      gstr1_tables: gstr1Tables,
      last_saved: new Date().toISOString(),
    }),
  });

  return handleResponse<GSTR1StateResponse>(response);
}

// ============================================
// GSTR-3B WORKFLOW STATE API
// ============================================

/**
 * GSTR-3B Workflow State - Backend-driven state management
 * 
 * The backend is the single source of truth for GSTR-3B workflow state.
 * This replaces localStorage-based state persistence.
 */

export interface GSTR3BWorkflowState {
  id?: string;
  workspace_id: string;
  gstin: string;
  return_period: string;
  current_step: string;
  step_data: Record<string, unknown>;
  gstr3b_data: Record<string, unknown> | null;
  gstr1_data: Record<string, unknown> | null;
  itc_data: Record<string, unknown> | null;
  tax_computation: Record<string, unknown> | null;
  filing_result: Record<string, unknown> | null;
  status: 'draft' | 'computed' | 'filed' | 'pending';
  last_saved: string;
  created_at?: string;
  updated_at?: string;
}

export interface GSTR3BStateResponse {
  success: boolean;
  data?: GSTR3BWorkflowState;
  message?: string;
}

export interface GSTR3BStateListResponse {
  success: boolean;
  data: GSTR3BWorkflowState[];
  total: number;
}

/**
 * Save GSTR-3B workflow state to backend
 * POST /api/gstr3b/state
 * 
 * This replaces localStorage.setItem('gstr3b_workflow_state', ...)
 */
export async function saveGstr3bState(
  workspaceId: string,
  gstin: string,
  returnPeriod: string,
  state: {
    currentStep: string;
    stepData: Record<string, unknown>;
    gstr3bData: Record<string, unknown> | null;
    gstr1Data: Record<string, unknown> | null;
    itcData: Record<string, unknown> | null;
    taxComputation: Record<string, unknown> | null;
    filingResult: Record<string, unknown> | null;
    status: 'draft' | 'computed' | 'filed' | 'pending';
  }
): Promise<GSTR3BStateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr3b/state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
      current_step: state.currentStep,
      step_data: state.stepData,
      gstr3b_data: state.gstr3bData,
      gstr1_data: state.gstr1Data,
      itc_data: state.itcData,
      tax_computation: state.taxComputation,
      filing_result: state.filingResult,
      status: state.status,
      last_saved: new Date().toISOString(),
    }),
  });

  return handleResponse<GSTR3BStateResponse>(response);
}

/**
 * Get saved GSTR-3B workflow state from backend
 * GET /api/gstr3b/state
 * 
 * This replaces localStorage.getItem('gstr3b_workflow_state')
 */
export async function getGstr3bState(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<GSTR3BStateResponse> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr3b/state?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR3BStateResponse>(response);
}

/**
 * Get all saved GSTR-3B workflow states (historical filings)
 * GET /api/gstr3b/state/list
 * 
 * Lists historical GSTR-3B filings for a GSTIN/workspace
 */
export async function listGstr3bFilings(
  workspaceId: string,
  gstin?: string,
  limit: number = 10
): Promise<GSTR3BStateListResponse> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    limit: limit.toString(),
  });
  if (gstin) {
    params.append('gstin', gstin);
  }

  const response = await fetch(`${API_BASE_URL}/api/gstr3b/state/list?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<GSTR3BStateListResponse>(response);
}

/**
 * Delete/clear saved GSTR-3B workflow state
 * DELETE /api/gstr3b/state
 * 
 * This replaces localStorage.removeItem('gstr3b_workflow_state')
 */
export async function deleteGstr3bState(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<{ success: boolean; message: string }> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr3b/state?${params}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}

// ============================================
// SUPPORT CHAT API - Backend-First Service
// ============================================

export interface SupportConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  subject?: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  feedback?: 'like' | 'dislike' | null;
  is_truncated?: boolean;
  citations?: Array<{
    title: string;
    url?: string;
    source?: string;
  }>;
  suggested_actions?: Array<{
    label: string;
    action_type: string;
    payload?: Record<string, unknown>;
  }>;
}

export interface CreateConversationRequest {
  workspace_id: string;
  subject?: string;
}

export interface SendMessageRequest {
  content: string;
  context?: {
    module?: string;
    route?: string;
    selectedGstin?: string;
    selectedBusiness?: string;
    currentTab?: string;
    currentSection?: string;
  };
}

/**
 * Get support conversations for a workspace
 * GET /api/support/conversations?workspace_id={id}
 */
export async function getSupportConversations(
  workspaceId: string
): Promise<SupportConversation[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/support/conversations?workspace_id=${encodeURIComponent(workspaceId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeaders(),
      },
    }
  );
  return handleResponse<SupportConversation[]>(response);
}

/**
 * Create a new support conversation
 * POST /api/support/conversations
 */
export async function createSupportConversation(
  workspaceId: string,
  subject?: string
): Promise<SupportConversation> {
  const response = await fetch(`${API_BASE_URL}/api/support/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      subject,
    }),
  });
  return handleResponse<SupportConversation>(response);
}

/**
 * Get messages for a conversation
 * GET /api/support/conversations/{id}/messages
 */
export async function getSupportMessages(
  conversationId: string
): Promise<SupportMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/support/conversations/${conversationId}/messages`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeaders(),
      },
    }
  );
  return handleResponse<SupportMessage[]>(response);
}

/**
 * Send a message to a conversation
 * POST /api/support/conversations/{id}/messages
 */
export async function sendSupportMessage(
  conversationId: string,
  content: string,
  context?: {
    workspaceId?: string;
    businessId?: string;
    gstin?: string;
    userId?: string;
    module?: string;
    route?: string;
    selectedGstin?: string;
    selectedBusiness?: string;
    currentTab?: string;
    currentSection?: string;
  }
): Promise<SupportMessage> {
  const response = await fetch(
    `${API_BASE_URL}/api/support/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeaders(),
      },
      body: JSON.stringify({
        content,
        context: {
          workspaceId: context?.workspaceId,
          businessId: context?.businessId,
          userId: context?.userId,
          selectedGstin: context?.gstin || context?.selectedGstin,
          selectedBusiness: context?.businessId || context?.selectedBusiness,
          module: context?.module,
          route: context?.route,
          currentTab: context?.currentTab,
          currentSection: context?.currentSection,
        },
      }),
    }
  );
  return handleResponse<SupportMessage>(response);
}

/**
 * Close a support conversation
 * POST /api/support/conversations/{id}/close
 */
export async function closeSupportConversation(
  conversationId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/support/conversations/${conversationId}/close`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeaders(),
      },
    }
  );
  return handleResponse<{ success: boolean; message: string }>(response);
}

/**
 * Add reaction to a message
 * POST /api/support/messages/{id}/reaction
 */
export async function addSupportMessageReaction(
  messageId: string,
  reaction: 'like' | 'dislike'
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/api/support/messages/${messageId}/reaction`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeaders(),
      },
      body: JSON.stringify({ emoji: reaction }),
    }
  );
  return handleResponse<{ success: boolean }>(response);
}

// ============================================
// GSTR-1 ACTIONS API
// ============================================

export interface GSTR1PANSummaryResponse {
  success: boolean;
  message?: string;
  data?: Blob;
}

/**
 * Download PAN Summary for GSTR-1/IFF
 * GET /api/gstr1/pan-summary
 */
export async function downloadGSTR1PANSummary(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<Blob> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr1/pan-summary?${params}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  return handleResponse<Blob>(response);
}

export interface GSTNSyncResponseData {
  success: boolean;
  message: string;
  sync_id?: string;
  status?: string;
  records_synced?: number;
}

/**
 * Sync Draft G1 from GSTN
 * POST /api/gstr1/sync-from-gstn
 */
export async function syncGSTR1FromGSTN(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<GSTNSyncResponseData> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/sync-from-gstn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
    }),
  });

  return handleResponse<GSTNSyncResponseData>(response);
}

export interface NILReturnRequest {
  workspace_id: string;
  gstin: string;
  return_period: string;
  is_nil_return: boolean;
}

export interface NILReturnResponse {
  success: boolean;
  message: string;
  is_nil_return?: boolean;
}

/**
 * Select for NIL Returns
 * POST /api/gstr1/nil-return
 */
export async function selectGSTR1ForNIL(
  workspaceId: string,
  gstin: string,
  returnPeriod: string,
  isNilReturn: boolean = true
): Promise<NILReturnResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/nil-return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
      is_nil_return: isNilReturn,
    } as NILReturnRequest),
  });

  return handleResponse<NILReturnResponse>(response);
}

export interface SummarySourceRequest {
  workspace_id: string;
  gstin: string;
  return_period: string;
  source: 'gstn' | 'uploaded' | 'manual';
}

export interface SummarySourceResponse {
  success: boolean;
  message: string;
  source?: string;
}

/**
 * Select Summary Source
 * POST /api/gstr1/summary-source
 */
export async function selectGSTR1SummarySource(
  workspaceId: string,
  gstin: string,
  returnPeriod: string,
  source: 'gstn' | 'uploaded' | 'manual'
): Promise<SummarySourceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstr1/summary-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      return_period: returnPeriod,
      source,
    } as SummarySourceRequest),
  });

  return handleResponse<SummarySourceResponse>(response);
}

export interface DeleteClearResponse {
  success: boolean;
  message: string;
}

/**
 * Delete from clear
 * DELETE /api/gstr1/clear
 */
export async function deleteGSTR1FromClear(
  workspaceId: string,
  gstin: string,
  returnPeriod: string
): Promise<DeleteClearResponse> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    gstin,
    return_period: returnPeriod,
  });

  const response = await fetch(`${API_BASE_URL}/api/gstr1/clear?${params}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  return handleResponse<DeleteClearResponse>(response);
}

/**
 * Get GSTIN connection status
 * GET /api/gstin/connection-status
 */
export interface GSTINConnectionStatus {
  gstin: string;
  is_connected: boolean;
  last_verified?: string;
  verified_by?: string;
}

export async function getGSTINConnectionStatus(
  workspaceId: string
): Promise<{ success: boolean; data: GSTINConnectionStatus[] }> {
  const response = await fetch(
    `${API_BASE_URL}/api/gstin/connection-status?workspace_id=${encodeURIComponent(workspaceId)}`,
    {
      method: 'GET',
      headers: await getAuthHeaders(),
    }
  );
  return handleResponse<{ success: boolean; data: GSTINConnectionStatus[] }>(response);
}

/**
 * Generate OTP for GSTIN verification
 * POST /api/gstin/generate-otp
 */
export interface GenerateOTPResponse {
  success: boolean;
  message: string;
  otp_request_id?: string;
}

export async function generateGSTINOTP(
  workspaceId: string,
  gstin: string
): Promise<GenerateOTPResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstin/generate-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
    }),
  });

  return handleResponse<GenerateOTPResponse>(response);
}

/**
 * Verify OTP for GSTIN connection
 * POST /api/gstin/verify-otp
 */
export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  is_verified?: boolean;
}

export async function verifyGSTINOTP(
  workspaceId: string,
  gstin: string,
  otp: string,
  otpRequestId: string
): Promise<VerifyOTPResponse> {
  const response = await fetch(`${API_BASE_URL}/api/gstin/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      gstin,
      otp,
      otp_request_id: otpRequestId,
    }),
  });

  return handleResponse<VerifyOTPResponse>(response);
}

// ============================================
// BUSINESS WITH GSTINS GROUPED API
// ============================================

/**
 * Business entity with grouped GSTINs for GSTR-1 drawer flow
 */
export interface BusinessWithGstins {
  id: string;
  name: string;
  pan: string;
  gstins: Array<{
    id: string;
    gstin: string;
    state: string;
    status: 'Regular' | 'Composite' | 'Casual';
    isConnected: boolean;
    lastVerified?: string;
  }>;
}

/**
 * Get businesses with GSTINs grouped by company/PAN
 * GET /api/workspaces/{workspace_id}/businesses-with-gstins
 * 
 * This endpoint:
 * 1. Gets all GSTINs for a workspace
 * 2. Groups them by company (legal_name)
 * 3. Includes connection status for each GSTIN
 */
export async function getBusinessesWithGstins(
  workspaceId: string
): Promise<{ success: boolean; data: BusinessWithGstins[] }> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/businesses-with-gstins`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  return handleResponse<{ success: boolean; data: BusinessWithGstins[] }>(response);
}
