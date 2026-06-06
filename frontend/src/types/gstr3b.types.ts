/**
 * GSTR-3B Frontend - Type Definitions
 * 
 * Comprehensive TypeScript interfaces for GSTR-3B auto-population
 */

import { ReactNode } from 'react';

// ============================================================================
// BACKEND RESPONSE TYPES
// ============================================================================

export interface TaxAmount {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface SupplyTable extends TaxAmount {
  taxable_value: number;
  invoice_count: number;
  credit_note_count: number;
  source: string;
  status: 'Filed' | 'Not filed' | 'Partial' | 'Not generated' | 'Generated';
}

export interface OutwardSupplies {
  table_3_1_a: SupplyTable;
  table_3_1_b: SupplyTable;
  table_3_1_c: SupplyTable;
  table_3_1_d: SupplyTable;
  table_3_1_e: SupplyTable;
}

export interface InterStateSupplies {
  description: string;
  summary: Record<string, Record<string, number>>;
  total_taxable_value: number;
  total_igst: number;
  status: 'Filed' | 'Not filed';
}

export interface ITCDetails {
  section_4a: Record<string, any>;
  section_4b: Record<string, any>;
  section_4c: TaxAmount & { total: number };
  status: 'Generated' | 'Not generated' | 'Partial';
  note: string;
}

export interface TaxSummary {
  outward_tax_liability: TaxAmount & { total: number };
  rcm_tax_liability: TaxAmount & { total: number };
  total_liability: TaxAmount & { total: number };
  total_itc: TaxAmount & { total: number };
  total_payable: TaxAmount & { total: number };
}

export interface FilingStatusFlags {
  gstr1_filed: boolean;
  gstr2b_generated: boolean;
}

export interface GSTR3BAutoPopulateResponse {
  metadata: Record<string, any>;
  filing_status: FilingStatusFlags;
  section_3_1: OutwardSupplies;
  section_3_2: InterStateSupplies;
  section_4: ITCDetails;
  tax_summary: TaxSummary;
  compliance: Record<string, any>;
  generated_at: string;
  generated_by: string;
}

// ============================================================================
// LOCAL STATE TYPES
// ============================================================================

export interface LocalGSTR3BState {
  // Section 3.1 edited values
  section_3_1_a_edited: Partial<SupplyTable>;
  section_3_1_b_edited: Partial<SupplyTable>;
  section_3_1_c_edited: Partial<SupplyTable>;
  section_3_1_d_edited: Partial<SupplyTable>;
  section_3_1_e_edited: Partial<SupplyTable>;

  // Section 3.2 edited values
  section_3_2_edited: Partial<InterStateSupplies>;

  // Section 4 edited values
  section_4_edited: Partial<ITCDetails>;

  // Flags
  gstr1_filed: boolean;
  gstr2b_generated: boolean;
  
  // Metadata
  lastSavedAt?: string;
  returnPeriod: string;
  gstin: string;
}

export interface VarianceAlert {
  fieldPath: string;
  fieldLabel: string;
  originalValue: number;
  editedValue: number;
  variancePercent: number;
  threshold: number;
  isExceeded: boolean;
}

export interface FormState {
  saved: LocalGSTR3BState;
  current: LocalGSTR3BState;
  isDirty: boolean;
  varianceAlerts: VarianceAlert[];
  showVarianceWarning: boolean;
  pendingVarianceAlert?: VarianceAlert;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface ToastMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ModalState {
  isOpen: boolean;
  type: 'variance_warning' | 'confirmation' | 'info' | 'error';
  title: string;
  message: string;
  alert?: VarianceAlert;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface GSTR3BFormProps {
  gstin: string;
  returnPeriod: string;
  initialSavedState?: LocalGSTR3BState;
  onSave?: (state: LocalGSTR3BState) => Promise<void>;
  onSubmit?: (state: LocalGSTR3BState) => Promise<void>;
  varianceThreshold?: number; // Default: 10 (percent)
}

export interface SupplyTableInputProps {
  tableKey: 'table_3_1_a' | 'table_3_1_b' | 'table_3_1_c' | 'table_3_1_d' | 'table_3_1_e';
  label: string;
  data: SupplyTable;
  editedData?: Partial<SupplyTable>;
  onChange: (field: string, value: number) => void;
  varianceAlerts?: VarianceAlert[];
  status: string;
}

export interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

export interface ToastContainerProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface VarianceWarningModalProps {
  isOpen: boolean;
  alert: VarianceAlert;
  onContinue: () => void;
  onRevert: () => void;
}

export interface EditFieldProps {
  label: string;
  value: number;
  originalValue: number;
  unit?: string;
  onChange: (value: number) => void;
  hasVariance?: boolean;
  status?: string;
  tooltip?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface VarianceCalculationResult {
  isVarianceExceeded: boolean;
  variancePercent: number;
  threshold: number;
}

export interface EditableFieldConfig {
  field: string;
  label: string;
  format?: 'currency' | 'number' | 'percent';
  editable: boolean;
}
