/**
 * GSTR-1 Single Source of Truth
 * 
 * This module provides the SINGLE DATA PIPELINE:
 * RAW IMPORT → TRANSFORM → VALIDATE → STORE → DISPLAY → EXPORT
 * 
 * All components use this as the single source of truth:
 * - Summary
 * - Validation tables  
 * - Export
 * - Reconciliation
 */

import type { BackendB2BInvoice, BackendB2CLInvoice, BackendB2CSEntry, BackendExportInvoice, BackendCDNREntry } from './api';

// ============================================
// PART 3: RAW IMPORT STRUCTURE
// ============================================

/**
 * Raw row from Excel import
 * Example:
 * {
 *   "Invoice No": "INV001",
 *   "Date": "2025-02-10",
 *   "GSTIN": "29ABCDE1234F1Z5",
 *   "Customer Name": "Test Customer",
 *   "Taxable Value": 1000,
 *   "IGST": 180,
 *   "CGST": 0,
 *   "SGST": 0,
 *   "CESS": 0,
 *   "Place of Supply": "29-Karnataka"
 * }
 */
export type RawRow = Record<string, string | number>;

// ============================================
// PART 3: TRANSFORMED DATA TYPE (GSTR1Row)
// ============================================

/**
 * Transformed GSTR-1 row with all calculations done
 */
export type GSTR1Row = {
  invoice_number: string
  invoice_date: string
  gstin: string
  customer_name: string
  taxable_value: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  total_tax: number
  total_value: number
  place_of_supply: string
  section: 'B2B' | 'B2C' | 'CDN'
}

// ============================================
// PART 3: TRANSFORMATION LOGIC
// ============================================

/**
 * Transform raw Excel rows to GSTR1Row[]
 * This is the CORE transformation function used throughout the application
 * 
 * @param rows - Raw rows from Excel import
 * @returns Transformed GSTR1Row[] with all calculations
 */
export function transformRawData(rows: RawRow[]): GSTR1Row[] {
  return rows.map(row => {
    const taxable = Number(row["Taxable Value"] || row["taxable_value"] || row["Taxable Value"] || 0)
    const igst = Number(row["IGST"] || row["igst"] || row["IGST Amount"] || 0)
    const cgst = Number(row["CGST"] || row["cgst"] || row["CGST Amount"] || 0)
    const sgst = Number(row["SGST"] || row["sgst"] || row["SGST Amount"] || 0)
    const cess = Number(row["CESS"] || row["cess"] || row["Cess"] || 0)

    const total_tax = igst + cgst + sgst + cess
    const total_value = taxable + total_tax

    const gstin = String(row["GSTIN"] || row["gstin"] || row["Customer GSTIN"] || row["GSTIN No"] || "")

    return {
      invoice_number: String(row["Invoice No"] || row["invoice_number"] || row["Invoice Number"] || ""),
      invoice_date: String(row["Date"] || row["date"] || row["Invoice Date"] || ""),
      gstin,
      customer_name: String(row["Customer Name"] || row["customer_name"] || row["Party Name"] || ""),
      taxable_value: taxable,
      igst,
      cgst,
      sgst,
      cess,
      total_tax,
      total_value,
      place_of_supply: String(row["Place of Supply"] || row["place_of_supply"] || row["POS"] || ""),
      section: gstin ? "B2B" : "B2C"
    }
  })
}

// ============================================
// PART 4: VALIDATION RULES
// ============================================

/**
 * Validation errors for a single row
 */
export type ValidationErrors = string[]

/**
 * Validate a single GSTR1Row
 * @param row - The row to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateRow(row: GSTR1Row): ValidationErrors {
  const errors: ValidationErrors = []

  // Check required fields
  if (!row.invoice_number || row.invoice_number.trim() === '') {
    errors.push("Missing invoice number")
  }
  if (!row.invoice_date || row.invoice_date.trim() === '') {
    errors.push("Missing date")
  }

  // Validate taxable value
  if (row.taxable_value < 0) {
    errors.push("Invalid taxable value")
  }

  // Validate tax calculation
  const calcTax = row.igst + row.cgst + row.sgst + row.cess
  
  // Allow small rounding differences
  const tolerance = 0.05
  if (Math.abs(calcTax - row.total_tax) > tolerance) {
    errors.push(`Tax mismatch: calculated ${calcTax.toFixed(2)} vs stored ${row.total_tax.toFixed(2)}`)
  }

  // Validate GSTIN format if present
  if (row.gstin && row.gstin.trim() !== '') {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    if (!gstinRegex.test(row.gstin.toUpperCase())) {
      errors.push("Invalid GSTIN format")
    }
  }

  return errors
}

/**
 * Validate entire dataset
 * @param data - Array of GSTR1Row to validate
 * @returns Map of row index to validation errors
 */
export function validateAllRows(data: GSTR1Row[]): Map<number, ValidationErrors> {
  const errorsMap = new Map<number, ValidationErrors>()
  
  data.forEach((row, index) => {
    const errors = validateRow(row)
    if (errors.length > 0) {
      errorsMap.set(index, errors)
    }
  })
  
  return errorsMap
}

// ============================================
// PART 6: SUMMARY CALCULATION
// ============================================

/**
 * Summary statistics for GSTR-1 data
 */
export type GSTR1Summary = {
  total_taxable: number
  total_igst: number
  total_cgst: number
  total_sgst: number
  total_cess: number
  total_docs: number
  b2b_count: number
  b2c_count: number
  total_tax: number
  total_value: number
  // Frontend aliases
  totalInvoices?: number
  totalTaxableValue?: number
  b2bCount?: number
  b2clCount?: number
  b2csCount?: number
  exportCount?: number
  cdnrCount?: number
  cndsCount?: number
  hsnCount?: number
}

/**
 * Calculate summary from transformed data
 * @param data - Array of GSTR1Row
 * @returns Summary statistics
 */
export function calculateSummary(data: GSTR1Row[]): GSTR1Summary {
  const summary = {
    total_taxable: data.reduce((s, r) => s + r.taxable_value, 0),
    total_igst: data.reduce((s, r) => s + r.igst, 0),
    total_cgst: data.reduce((s, r) => s + r.cgst, 0),
    total_sgst: data.reduce((s, r) => s + r.sgst, 0),
    total_cess: data.reduce((s, r) => s + r.cess, 0),
    total_docs: data.length,
    b2b_count: data.filter(d => d.section === "B2B").length,
    b2c_count: data.filter(d => d.section === "B2C").length,
    total_tax: data.reduce((s, r) => s + r.total_tax, 0),
    total_value: data.reduce((s, r) => s + r.total_value, 0)
  }

  return {
    ...summary,
    totalInvoices: summary.total_docs,
    totalTaxableValue: summary.total_taxable,
    b2bCount: summary.b2b_count,
    b2clCount: 0, // Calculated separately in workflow
    b2csCount: summary.b2c_count,
    exportCount: 0,
    cdnrCount: 0,
    cndsCount: 0,
    hsnCount: 0
  }
}

// ============================================
// PART 8: RECONCILIATION
// ============================================

/**
 * Reconciliation row type
 */
export type ReconRow = {
  invoice_number: string
  gstin: string
  sr_value: number
  einv_value: number
  status: "MATCH" | "MISMATCH" | "MISSING"
}

/**
 * Reconciliation summary
 */
export type ReconSummary = {
  total: number
  matched: number
  mismatched: number
  missing: number
}

/**
 * Perform reconciliation between Sales Register (SR) and E-Invoice (EINV) values
 * @param srData - Sales Register data (from GSTR-1)
 * @param einvData - E-Invoice data (from IRP)
 * @returns Array of reconciliation results
 */
export function reconcileData(
  srData: GSTR1Row[], 
  einvData: GSTR1Row[]
): ReconRow[] {
  const results: ReconRow[] = []
  
  // Create map of SR invoices by key (invoice_number + gstin)
  const srMap = new Map<string, GSTR1Row>()
  srData.forEach(row => {
    const key = `${row.invoice_number}|${row.gstin}`
    srMap.set(key, row)
  })
  
  // Create map of EINV invoices
  const einvMap = new Map<string, GSTR1Row>()
  einvData.forEach(row => {
    const key = `${row.invoice_number}|${row.gstin}`
    einvMap.set(key, row)
  })
  
  // Check all SR invoices
  srMap.forEach((srRow, key) => {
    const einvRow = einvMap.get(key)
    
    if (einvRow) {
      // Both exist - check for match
      const status = srRow.total_value === einvRow.total_value 
        ? "MATCH" 
        : "MISMATCH"
      
      results.push({
        invoice_number: srRow.invoice_number,
        gstin: srRow.gstin,
        sr_value: srRow.total_value,
        einv_value: einvRow.total_value,
        status
      })
    } else {
      // SR exists but no EINV
      results.push({
        invoice_number: srRow.invoice_number,
        gstin: srRow.gstin,
        sr_value: srRow.total_value,
        einv_value: 0,
        status: "MISSING"
      })
    }
  })
  
  // Check for EINV invoices not in SR
  einvMap.forEach((einvRow, key) => {
    if (!srMap.has(key)) {
      results.push({
        invoice_number: einvRow.invoice_number,
        gstin: einvRow.gstin,
        sr_value: 0,
        einv_value: einvRow.total_value,
        status: "MISSING"
      })
    }
  })
  
  return results
}

/**
 * Calculate reconciliation summary
 * @param reconData - Reconciliation results
 * @returns Summary counts
 */
export function calculateReconSummary(reconData: ReconRow[]): ReconSummary {
  return {
    total: reconData.length,
    matched: reconData.filter(r => r.status === "MATCH").length,
    mismatched: reconData.filter(r => r.status === "MISMATCH").length,
    missing: reconData.filter(r => r.status === "MISSING").length
  }
}

// ============================================
// PART 9: IMS CONSOLE TYPES
// ============================================

/**
 * IMS Row type for document management
 */
export type IMSRow = {
  document_number: string
  document_type: string
  supplier_gstin: string
  taxable_value: number
  igst: number
  cgst: number
  sgst: number
  action: "ACCEPT" | "REJECT" | "PENDING"
  upload_status: "UPLOADED" | "NOT_UPLOADED"
  row_id?: string
}

/**
 * Handle IMS action
 * @param row - IMS row to update
 * @param action - New action to set
 * @returns Updated row
 */
export function handleIMSAction(row: IMSRow, action: "ACCEPT" | "REJECT" | "PENDING"): IMSRow {
  return {
    ...row,
    action
  }
}

/**
 * Calculate IMS summary
 * @param imsData - Array of IMS rows
 * @returns Summary counts
 */
export function calculateIMSSummary(imsData: IMSRow[]): {
  total: number
  accepted: number
  rejected: number
  pending: number
  uploaded: number
  not_uploaded: number
} {
  return {
    total: imsData.length,
    accepted: imsData.filter(r => r.action === "ACCEPT").length,
    rejected: imsData.filter(r => r.action === "REJECT").length,
    pending: imsData.filter(r => r.action === "PENDING").length,
    uploaded: imsData.filter(r => r.upload_status === "UPLOADED").length,
    not_uploaded: imsData.filter(r => r.upload_status === "NOT_UPLOADED").length
  }
}

// ============================================
// BACKEND DATA TRANSFORMATION
// ============================================

/**
 * Transform backend B2B data to GSTR1Row[]
 */
export function transformBackendB2BToGSTR1(b2b: BackendB2BInvoice[]): GSTR1Row[] {
  return b2b.map(inv => {
    const gstin = inv.customer?.gstin || ''
    const firstItem = inv.items?.[0] || {}
    const taxable = firstItem.txval ?? firstItem.taxable_value ?? 0
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0
    const cgst = firstItem.camt ?? firstItem.cgst_amount ?? 0
    const sgst = firstItem.samt ?? firstItem.sgst_amount ?? 0
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0
    const total_tax = igst + cgst + sgst + cess
    const total_value = (inv.invoice_value ?? 0) || (taxable + total_tax)

    return {
      invoice_number: inv.invoice_no || '',
      invoice_date: inv.invoice_date || '',
      gstin,
      customer_name: inv.customer?.name || '',
      taxable_value: taxable,
      igst,
      cgst,
      sgst,
      cess,
      total_tax,
      total_value,
      place_of_supply: inv.place_of_supply || '',
      section: gstin ? "B2B" : "B2C"
    }
  })
}

/**
 * Transform backend B2CL data to GSTR1Row[]
 */
export function transformBackendB2CLToGSTR1(b2cl: BackendB2CLInvoice[]): GSTR1Row[] {
  return b2cl.map(inv => {
    const firstItem = inv.items?.[0] || {}
    const taxable = firstItem.txval ?? firstItem.taxable_value ?? 0
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0
    const total_tax = igst + cess
    const total_value = (inv.invoice_value ?? 0) || (taxable + total_tax)

    return {
      invoice_number: inv.invoice_no || '',
      invoice_date: inv.invoice_date || '',
      gstin: '',
      customer_name: '',
      taxable_value: taxable,
      igst,
      cgst: 0,
      sgst: 0,
      cess,
      total_tax,
      total_value,
      place_of_supply: inv.place_of_supply || '',
      section: "B2C"
    }
  })
}

/**
 * Transform backend B2CS data to GSTR1Row[]
 */
export function transformBackendB2CSToGSTR1(b2cs: BackendB2CSEntry[]): GSTR1Row[] {
  return b2cs.map(entry => {
    const taxable = entry.txval ?? entry.items?.[0]?.txval ?? entry.items?.[0]?.taxable_value ?? 0
    const igst = entry.iamt ?? entry.items?.[0]?.iamt ?? 0
    const cgst = entry.camt ?? entry.items?.[0]?.camt ?? 0
    const sgst = entry.samt ?? entry.items?.[0]?.samt ?? 0
    const cess = entry.csamt ?? entry.items?.[0]?.csamt ?? 0
    const total_tax = igst + cgst + sgst + cess
    const total_value = taxable + total_tax

    return {
      invoice_number: entry.invoice_no || `B2CS-${entry.pos}-${entry.rt}`,
      invoice_date: entry.invoice_date || '',
      gstin: '',
      customer_name: '',
      taxable_value: taxable,
      igst,
      cgst,
      sgst,
      cess,
      total_tax,
      total_value,
      place_of_supply: entry.pos || entry.place_of_supply || '',
      section: "B2C"
    }
  })
}

/**
 * Transform backend CDN/R data to GSTR1Row[]
 */
export function transformBackendCDNRToGSTR1(cdnr: BackendCDNREntry[]): GSTR1Row[] {
  return cdnr.map(note => {
    const gstin = note.customer?.gstin || ''
    const firstItem = note.items?.[0] || {}
    const taxable = firstItem.txval ?? firstItem.taxable_value ?? 0
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0
    const cgst = firstItem.camt ?? firstItem.cgst_amount ?? 0
    const sgst = firstItem.samt ?? firstItem.sgst_amount ?? 0
    const cess = firstItem.csamt ?? firstItem.cess_amount ?? 0
    const total_tax = igst + cgst + sgst + cess

    return {
      invoice_number: note.invoice_no || '',
      invoice_date: note.invoice_date || '',
      gstin,
      customer_name: note.customer?.name || '',
      taxable_value: taxable,
      igst,
      cgst,
      sgst,
      cess,
      total_tax,
      total_value: (note.invoice_value ?? 0) || (taxable + total_tax),
      place_of_supply: note.place_of_supply || '',
      section: "CDN"
    }
  })
}

/**
 * Transform backend Export data to GSTR1Row[]
 */
export function transformBackendExportToGSTR1(exports: BackendExportInvoice[]): GSTR1Row[] {
  return exports.map(inv => {
    const firstItem = inv.items?.[0] || {}
    const taxable = firstItem.txval ?? firstItem.taxable_value ?? 0
    const igst = firstItem.iamt ?? firstItem.igst_amount ?? 0
    const total_tax = igst

    return {
      invoice_number: inv.invoice_no || '',
      invoice_date: inv.invoice_date || '',
      gstin: '',
      customer_name: '',
      taxable_value: taxable,
      igst,
      cgst: 0,
      sgst: 0,
      cess: 0,
      total_tax,
      total_value: (inv.invoice_value ?? 0) || (taxable + total_tax),
      place_of_supply: inv.place_of_supply || '',
      section: "B2C"
    }
  })
}

/**
 * Transform ALL backend data to single GSTR1Row[] array
 * This is the single source of truth for the entire application
 */
export function transformAllBackendData(backendData: {
  b2b?: BackendB2BInvoice[]
  b2cl?: BackendB2CLInvoice[]
  b2cs?: BackendB2CSEntry[]
  cdnr?: BackendCDNREntry[]
  exp?: BackendExportInvoice[]
  export?: BackendExportInvoice[]
}): GSTR1Row[] {
  const allRows: GSTR1Row[] = []
  
  if (backendData.b2b) {
    allRows.push(...transformBackendB2BToGSTR1(backendData.b2b))
  }
  if (backendData.b2cl) {
    allRows.push(...transformBackendB2CLToGSTR1(backendData.b2cl))
  }
  if (backendData.b2cs) {
    allRows.push(...transformBackendB2CSToGSTR1(backendData.b2cs))
  }
  if (backendData.cdnr) {
    allRows.push(...transformBackendCDNRToGSTR1(backendData.cdnr))
  }
  if (backendData.exp) {
    allRows.push(...transformBackendExportToGSTR1(backendData.exp))
  }
  if (backendData.export) {
    allRows.push(...transformBackendExportToGSTR1(backendData.export))
  }
  
  return allRows
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Filter data by section
 */
export function filterBySection(data: GSTR1Row[], section: 'B2B' | 'B2C' | 'CDN'): GSTR1Row[] {
  return data.filter(row => row.section === section)
}

/**
 * Group data by GSTIN
 */
export function groupByGSTIN(data: GSTR1Row[]): Map<string, GSTR1Row[]> {
  const grouped = new Map<string, GSTR1Row[]>()
  
  data.forEach(row => {
    const gstin = row.gstin || 'UNREGISTERED'
    const existing = grouped.get(gstin) || []
    existing.push(row)
    grouped.set(gstin, existing)
  })
  
  return grouped
}

/**
 * Export data to Excel-compatible format
 */
export function exportToExcelData(data: GSTR1Row[]): Record<string, string | number>[] {
  return data.map(row => ({
    "Invoice Number": row.invoice_number,
    "Date": row.invoice_date,
    "GSTIN": row.gstin,
    "Customer Name": row.customer_name,
    "Place of Supply": row.place_of_supply,
    "Section": row.section,
    "Taxable Value": row.taxable_value,
    "IGST": row.igst,
    "CGST": row.cgst,
    "SGST": row.sgst,
    "Cess": row.cess,
    "Total Tax": row.total_tax,
    "Invoice Value": row.total_value
  }))
}
