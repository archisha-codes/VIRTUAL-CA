/**
 * GSTR-3B Utilities
 * 
 * Helper functions for variance calculation, formatting, and state management
 */

import { SupplyTable, VarianceAlert } from '../types/gstr3b.types';

// ============================================================================
// VARIANCE CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate variance percentage between original and edited values
 */
export function calculateVariancePercent(
  originalValue: number,
  editedValue: number
): number {
  if (originalValue === 0) {
    return editedValue !== 0 ? 100 : 0;
  }

  const variance = Math.abs((editedValue - originalValue) / originalValue) * 100;
  return Math.round(variance * 100) / 100; // Round to 2 decimals
}

/**
 * Check if variance exceeds threshold
 */
export function isVarianceExceeded(
  originalValue: number,
  editedValue: number,
  threshold: number = 10
): boolean {
  const variancePercent = calculateVariancePercent(originalValue, editedValue);
  return variancePercent > threshold;
}

/**
 * Generate variance message
 */
export function getVarianceMessage(alert: VarianceAlert): string {
  return `${alert.fieldLabel} has changed by ${alert.variancePercent}% ` +
    `(from ₹${alert.originalValue.toFixed(2)} to ₹${alert.editedValue.toFixed(2)})`;
}

/**
 * Detect high-risk variances (>50%)
 */
export function isHighRiskVariance(variancePercent: number): boolean {
  return variancePercent > 50;
}

// ============================================================================
// STATE MANAGEMENT UTILITIES
// ============================================================================

/**
 * Merge edited state with original to get current values
 */
export function mergeEditedWithOriginal(
  original: SupplyTable,
  edited: Partial<SupplyTable>
): SupplyTable {
  return {
    ...original,
    ...edited,
  };
}

/**
 * Check if a supply table has been edited
 */
export function isSupplyTableEdited(edited: Partial<SupplyTable>): boolean {
  return Object.keys(edited).length > 0;
}

/**
 * Get only the edited fields (diff)
 */
export function getEditedFields(
  original: SupplyTable,
  edited: Partial<SupplyTable>
): Record<string, { original: number; edited: number }> {
  const diff: Record<string, { original: number; edited: number }> = {};

  for (const [key, editedValue] of Object.entries(edited)) {
    if (key in original) {
      const originalValue = (original as any)[key];
      if (editedValue !== originalValue) {
        diff[key] = { original: originalValue, edited: editedValue as number };
      }
    }
  }

  return diff;
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency values
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100) / 100}%`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/**
 * Parse currency input
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

// ============================================================================
// STATUS DISPLAY UTILITIES
// ============================================================================

/**
 * Get display text for status
 */
export function getStatusDisplayText(status: string): string {
  const statusMap: Record<string, string> = {
    'Filed': '✓ Filed',
    'Not filed': '✗ Not filed',
    'Generated': '✓ Generated',
    'Not generated': '✗ Not generated',
    'Partial': '⚠ Partial',
  };
  return statusMap[status] || status;
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Filed':
    case 'Generated':
      return 'text-green-600 bg-green-50';
    case 'Not filed':
    case 'Not generated':
      return 'text-red-600 bg-red-50';
    case 'Partial':
      return 'text-yellow-600 bg-yellow-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Check if status indicates data unavailability
 */
export function isStatusUnavailable(status: string): boolean {
  return status === 'Not filed' || status === 'Not generated';
}

// ============================================================================
// EDITABLE FIELD UTILITIES
// ============================================================================

/**
 * Determine if field should be editable based on status
 */
export function isFieldEditable(status: string): boolean {
  // Always allow editing, even if data not filed/generated
  // The user might want to fill in manually or adjust values
  return true;
}

/**
 * Get disabled state for field
 */
export function getFieldDisabledState(status: string): boolean {
  // Never disable fields, allow user to always edit
  return false;
}

/**
 * Get field hint text based on status
 */
export function getFieldHintText(status: string): string | null {
  switch (status) {
    case 'Not filed':
      return 'GSTR-1 not filed. Please file GSTR-1 first or enter values manually.';
    case 'Not generated':
      return 'GSTR-2B not generated. Please generate GSTR-2B first or enter values manually.';
    case 'Partial':
      return 'Some data is incomplete. Review and update as needed.';
    default:
      return null;
  }
}

// ============================================================================
// TOOLTIP UTILITIES
// ============================================================================

/**
 * Get tooltip text for Table 3.1(d)
 */
export function getTable3_1_d_Tooltip(): string {
  return `Table 3.1(d) - Inward Supplies (RCM)

Note: System values in this table do NOT include:
• Supplies from unregistered persons liable to RCM
• Import of services

You MUST manually add these amounts if applicable to your business.

Sources included:
• GSTR-2B data (where available)
• Auto-populated from supplier invoices`;
}

/**
 * Get tooltip text for ITC Section
 */
export function getITCTooltip(): string {
  return `Input Tax Credit (ITC) Summary

Section 4A: Available ITC
• ITC from imports (IGST)
• ITC from inward supplies (IGST/CGST/SGST)
• ITC from RCM (CGST/SGST)

Section 4B: ITC Reversed/Blocked
• Blocked credit
• IMS rejected invoices
• Rule 42 reversals
• Rule 43 reversals

Section 4C: Net ITC Available
• 4A minus 4B
• This is the ITC you can utilize`;
}

/**
 * Get tooltip text for variance warning
 */
export function getVarianceWarningTooltip(): string {
  return `This field has been modified significantly from the auto-populated value.
Please review the changes to ensure accuracy before saving.

You can proceed with saving - this is just a warning.`;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate currency input
 */
export function isValidCurrencyInput(value: string): boolean {
  const num = parseCurrencyInput(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate GST amount
 */
export function isValidGSTAmount(taxable: number, gstAmount: number, rate: number): boolean {
  const expectedGST = (taxable * rate) / 100;
  const tolerance = expectedGST * 0.01; // 1% tolerance for rounding
  return Math.abs(gstAmount - expectedGST) <= tolerance;
}

/**
 * Validate that values maintain decimal precision (2 places)
 */
export function ensureDecimalPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

/**
 * Save form state to local storage
 */
export function saveTolocalStorage(key: string, state: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
  }
}

/**
 * Load form state from local storage
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error('Error loading from localStorage:', err);
    return null;
  }
}

/**
 * Clear form state from local storage
 */
export function clearLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Error clearing localStorage:', err);
  }
}

/**
 * Get auto-save key
 */
export function getAutoSaveKey(gstin: string, returnPeriod: string): string {
  return `gstr3b_autosave_${gstin}_${returnPeriod}`;
}

/**
 * Get draft key
 */
export function getDraftKey(gstin: string, returnPeriod: string): string {
  return `gstr3b_draft_${gstin}_${returnPeriod}`;
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Deep compare two objects
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Get differences between two objects
 */
export function getObjectDifferences(obj1: any, obj2: any): Record<string, { before: any; after: any }> {
  const diff: Record<string, { before: any; after: any }> = {};

  for (const key in obj1) {
    if (obj1[key] !== obj2[key]) {
      diff[key] = {
        before: obj1[key],
        after: obj2[key],
      };
    }
  }

  return diff;
}

// ============================================================================
// TABLE DATA UTILITIES
// ============================================================================

/**
 * Calculate total tax from components
 */
export function calculateTotalTax(igst: number, cgst: number, sgst: number, cess: number): number {
  return ensureDecimalPrecision(igst + cgst + sgst + cess);
}

/**
 * Calculate effective tax rate
 */
export function calculateEffectiveTaxRate(taxable: number, totalTax: number): number {
  if (taxable === 0) return 0;
  return ensureDecimalPrecision((totalTax / taxable) * 100);
}

/**
 * Get summary of invoices vs credit notes
 */
export function getInvoiceSummary(invoiceCount: number, creditNoteCount: number): string {
  if (creditNoteCount === 0) {
    return `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`;
  }
  return `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''} + ${creditNoteCount} credit note${creditNoteCount !== 1 ? 's' : ''}`;
}
