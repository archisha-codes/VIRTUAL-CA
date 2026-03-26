/**
 * Enhanced GST Validation Engine
 * 
 * Comprehensive validation rules for GST compliance across multiple categories.
 * Supports 200+ validation rules with severity levels, auto-fix capabilities, and localization.
 */

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info' | 'critical';
export type ValidationCategory = 
  | 'gstin' | 'invoice' | 'tax' | 'hsn' 
  | 'return_period' | 'gstr1' | 'gstr3b' | 'cross_return'
  | 'classification' | 'format' | 'amount' | 'date' 
  | 'duplicate' | 'consistency';

export type GSTRReturnType = 
  | 'GSTR-1' | 'GSTR-2A' | 'GSTR-2B' | 'GSTR-3B' 
  | 'GSTR-4' | 'GSTR-5' | 'GSTR-6' | 'GSTR-7' 
  | 'GSTR-8' | 'GSTR-9';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: ValidationCategory;
  subcategory: string;
  severity: ValidationSeverity;
  applicableReturns: GSTRReturnType[];
  errorCode: string;
  messageTemplate: string;
  suggestionTemplate: string;
}

export interface ValidationError {
  ruleId: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
  value?: any;
  expected?: any;
  actual?: any;
  rowIndex?: number;
}

export interface ValidationResult {
  status: 'passed' | 'warning' | 'failed' | 'critical';
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// GSTIN validation constants
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const UIN_REGEX = /^[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const VALID_STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '97', '99'
];

export const STATE_NAMES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Ladakh',
};

// Allowed GST rates
export const ALLOWED_GST_RATES = [0, 0.1, 0.25, 3, 5, 12, 18, 28];

// Thresholds
export const B2C_LIMIT_NEW = 100000;
export const B2C_LIMIT_OLD = 250000;
export const E_INVOICE_THRESHOLD = 50000;
export const ROUNDING_TOLERANCE = 0.50;

// Test GSTIN patterns
export const TEST_GSTIN_PATTERNS = ['TEST', 'DEMO', 'SAMPLE', '9999', '0000'];

// =============================================================================
// VALIDATION RULES REGISTRY (200+ rules)
// =============================================================================

export const VALIDATION_RULES: ValidationRule[] = [
  // GSTIN Rules (20 rules)
  { id: 'GSTIN_001', name: 'GSTIN Format Validation', description: 'Validates 15-character GSTIN format', category: 'gstin', subcategory: 'format', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B'], errorCode: 'GSTIN_001', messageTemplate: 'Invalid GSTIN format: {value}', suggestionTemplate: 'Format: XXAAAAA0000A1Z0 (15 characters)' },
  { id: 'GSTIN_002', name: 'GSTIN Checksum Validation', description: 'Validates the check digit using GSTN algorithm', category: 'gstin', subcategory: 'checksum', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B'], errorCode: 'GSTIN_002', messageTemplate: 'GSTIN checksum validation failed: {value}', suggestionTemplate: 'Verify the GSTIN check digit' },
  { id: 'GSTIN_003', name: 'State Code Validity', description: 'Validates state code is between 01-37', category: 'gstin', subcategory: 'state_code', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B'], errorCode: 'GSTIN_003', messageTemplate: 'Invalid state code: {value}', suggestionTemplate: 'State code must be 01-37' },
  { id: 'GSTIN_004', name: 'Entity Number Validity', description: 'Validates entity number is valid', category: 'gstin', subcategory: 'entity_number', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B'], errorCode: 'GSTIN_004', messageTemplate: 'Invalid entity number: {value}', suggestionTemplate: 'Entity number should be 4 digits' },
  { id: 'GSTIN_005', name: 'Test GSTIN Detection', description: 'Detects test/dummy GSTINs', category: 'gstin', subcategory: 'test_detection', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B'], errorCode: 'GSTIN_005', messageTemplate: 'Test GSTIN detected: {value}', suggestionTemplate: 'Replace with valid GSTIN' },
  { id: 'GSTIN_006', name: 'UIN Validation', description: 'Validates UIN format for special entities', category: 'gstin', subcategory: 'uin', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'GSTIN_006', messageTemplate: 'Invalid UIN format: {value}', suggestionTemplate: 'UIN format: 2-digit code + 4-char entity + 5-digit + check digit' },
  { id: 'GSTIN_007', name: 'GSTIN vs UIN Discrimination', description: 'Ensures correct entity type selection', category: 'gstin', subcategory: 'entity_type', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'GSTIN_007', messageTemplate: 'Entity type mismatch: {value}', suggestionTemplate: 'Verify if GSTIN or UIN' },
  { id: 'GSTIN_008', name: 'PAN Linkage Validation', description: 'Validates PAN in GSTIN', category: 'gstin', subcategory: 'pan_linkage', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B'], errorCode: 'GSTIN_008', messageTemplate: 'PAN not found in GSTIN: {value}', suggestionTemplate: 'GSTIN should contain valid PAN' },
  { id: 'GSTIN_009', name: 'GSTIN Status Validation', description: 'Validates GSTIN is active', category: 'gstin', subcategory: 'status', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B'], errorCode: 'GSTIN_009', messageTemplate: 'GSTIN may be cancelled/suspended: {value}', suggestionTemplate: 'Verify GSTIN status on portal' },
  { id: 'GSTIN_010', name: 'Same State Validation', description: 'Validates inter-state vs intra-state', category: 'gstin', subcategory: 'state_match', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'GSTIN_010', messageTemplate: 'State code mismatch', suggestionTemplate: 'Supplier state should match POS for intra-state' },
  { id: 'GSTIN_011', name: 'Composition Dealer Detection', description: 'Detects composition dealer', category: 'gstin', subcategory: 'composition', severity: 'info', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'GSTIN_011', messageTemplate: 'Composition dealer: {value}', suggestionTemplate: 'Composition dealers cannot claim ITC' },
  { id: 'GSTIN_012', name: 'SEZ Unit Detection', description: 'Validates SEZ unit format', category: 'gstin', subcategory: 'sez', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'GSTIN_012', messageTemplate: 'SEZ unit validation failed: {value}', suggestionTemplate: 'SEZ units need authorization' },
  { id: 'GSTIN_013', name: 'ISD GSTIN Validation', description: 'Validates ISD GSTIN', category: 'gstin', subcategory: 'isd', severity: 'error', applicableReturns: ['GSTR-6'], errorCode: 'GSTIN_013', messageTemplate: 'ISD GSTIN validation failed: {value}', suggestionTemplate: 'ISD registration should be separate' },
  { id: 'GSTIN_014', name: 'E-Commerce Operator GSTIN', description: 'Validates e-commerce operator', category: 'gstin', subcategory: 'ecommerce', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'GSTIN_014', messageTemplate: 'E-commerce operator validation failed: {value}', suggestionTemplate: 'Need separate registration' },
  { id: 'GSTIN_015', name: 'TDS Deductor GSTIN', description: 'Validates TDS deductor', category: 'gstin', subcategory: 'tds', severity: 'error', applicableReturns: ['GSTR-7'], errorCode: 'GSTIN_015', messageTemplate: 'TDS deductor GSTIN invalid: {value}', suggestionTemplate: 'Need valid GSTIN' },
  { id: 'GSTIN_016', name: 'TCS Collector GSTIN', description: 'Validates TCS collector', category: 'gstin', subcategory: 'tcs', severity: 'error', applicableReturns: ['GSTR-8'], errorCode: 'GSTIN_016', messageTemplate: 'TCS collector GSTIN invalid: {value}', suggestionTemplate: 'Need valid GSTIN' },
  { id: 'GSTIN_017', name: 'Non-Resident Taxpayer', description: 'Validates non-resident format', category: 'gstin', subcategory: 'non_resident', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-5'], errorCode: 'GSTIN_017', messageTemplate: 'Non-resident validation failed: {value}', suggestionTemplate: 'Specific format for non-residents' },
  { id: 'GSTIN_018', name: 'OIDAR Service Provider', description: 'Validates OIDAR provider', category: 'gstin', subcategory: 'oidar', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-5'], errorCode: 'GSTIN_018', messageTemplate: 'OIDAR provider invalid: {value}', suggestionTemplate: 'Need specific registration' },
  { id: 'GSTIN_019', name: 'Unique Entity Reference', description: 'Validates UER for government', category: 'gstin', subcategory: 'uer', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'GSTIN_019', messageTemplate: 'UER validation failed: {value}', suggestionTemplate: 'Government entities may have UER' },
  { id: 'GSTIN_020', name: 'Casual Taxable Person', description: 'Validates casual taxpayer', category: 'gstin', subcategory: 'casual', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-4'], errorCode: 'GSTIN_020', messageTemplate: 'Casual taxpayer invalid: {value}', suggestionTemplate: 'Temporary registration format' },

  // Invoice Rules (40 rules)
  { id: 'INV_001', name: 'Invoice Number Required', description: 'Validates invoice number present', category: 'invoice', subcategory: 'required', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_001', messageTemplate: 'Invoice number required', suggestionTemplate: 'Provide invoice number' },
  { id: 'INV_002', name: 'Invoice Number Format', description: 'Max 16 chars, no special chars', category: 'invoice', subcategory: 'format', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_002', messageTemplate: 'Invalid invoice format: {value}', suggestionTemplate: 'Max 16 chars, no special characters' },
  { id: 'INV_003', name: 'Invoice Date Required', description: 'Validates invoice date present', category: 'invoice', subcategory: 'required', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_003', messageTemplate: 'Invoice date required', suggestionTemplate: 'Provide date in DD/MM/YYYY' },
  { id: 'INV_004', name: 'Invoice Date Format', description: 'Validates date format', category: 'invoice', subcategory: 'format', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_004', messageTemplate: 'Invalid date format: {value}', suggestionTemplate: 'Use DD/MM/YYYY' },
  { id: 'INV_005', name: 'Invoice Date Not Future', description: 'Date not in future', category: 'invoice', subcategory: 'date_range', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_005', messageTemplate: 'Future date: {value}', suggestionTemplate: 'Cannot be future dated' },
  { id: 'INV_006', name: 'Invoice Within Return Period', description: 'Date within filing period', category: 'invoice', subcategory: 'date_range', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'INV_006', messageTemplate: 'Date outside period: {value}', suggestionTemplate: 'Should match filing period' },
  { id: 'INV_007', name: 'Duplicate Detection', description: 'Checks for duplicates', category: 'duplicate', subcategory: 'duplicate', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'INV_007', messageTemplate: 'Duplicate invoice: {value}', suggestionTemplate: 'Remove duplicates' },
  { id: 'INV_008', name: 'E-invoice Threshold', description: 'B2B >₹50K needs e-invoice', category: 'invoice', subcategory: 'e_invoice', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_008', messageTemplate: 'E-invoice required: {value}', suggestionTemplate: 'Generate e-invoice for >₹50K' },
  { id: 'INV_009', name: 'Bill-to-Ship-to', description: 'Validates address details', category: 'invoice', subcategory: 'address', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_009', messageTemplate: 'Address validation failed', suggestionTemplate: 'Provide complete address' },
  { id: 'INV_010', name: 'POS Required', description: 'Place of supply required', category: 'invoice', subcategory: 'required', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_010', messageTemplate: 'POS required', suggestionTemplate: 'Provide state code or name' },
  { id: 'INV_011', name: 'POS Validity', description: 'Valid Indian state', category: 'invoice', subcategory: 'validity', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_011', messageTemplate: 'Invalid POS: {value}', suggestionTemplate: 'Use valid state code 01-37' },
  { id: 'INV_012', name: 'Invoice Type Classification', description: 'Correct type selection', category: 'classification', subcategory: 'invoice_type', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_012', messageTemplate: 'Invalid type: {value}', suggestionTemplate: 'Select B2B/B2CL/B2CS/Export' },
  { id: 'INV_013', name: 'Document Type Validation', description: 'Credit/Debit note type', category: 'classification', subcategory: 'document_type', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_013', messageTemplate: 'Invalid doc type: {value}', suggestionTemplate: 'Invoice/CN/DN' },
  { id: 'INV_014', name: 'Serial Number Continuity', description: 'Sequential serial numbers', category: 'invoice', subcategory: 'serial_number', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'INV_014', messageTemplate: 'Serial number gap', suggestionTemplate: 'Ensure continuity' },
  { id: 'INV_015', name: 'Invoice Value Required', description: 'Value present and positive', category: 'amount', subcategory: 'required', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_015', messageTemplate: 'Invoice value required', suggestionTemplate: 'Value > 0' },
  { id: 'INV_016', name: 'Taxable Value Required', description: 'Taxable value present', category: 'amount', subcategory: 'required', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'INV_016', messageTemplate: 'Taxable value required', suggestionTemplate: 'Provide taxable value' },
  { id: 'INV_017', name: 'Invoice Value Consistency', description: 'Value = taxable + taxes', category: 'consistency', subcategory: 'amount', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'INV_017', messageTemplate: 'Value mismatch: {value}', suggestionTemplate: 'Invoice = taxable + taxes' },
  { id: 'INV_018', name: 'Reverse Charge', description: 'RCM applicability', category: 'tax', subcategory: 'rcm', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'INV_018', messageTemplate: 'RCM validation: {value}', suggestionTemplate: 'Mark Y/N appropriately' },
  { id: 'INV_019', name: 'Export Invoice', description: 'Has shipping bill', category: 'invoice', subcategory: 'export', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_019', messageTemplate: 'Export validation: {value}', suggestionTemplate: 'Provide shipping bill' },
  { id: 'INV_020', name: 'Deemed Export', description: 'Deemed export invoices', category: 'invoice', subcategory: 'deemed_export', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_020', messageTemplate: 'Deemed export failed: {value}', suggestionTemplate: 'Need both GSTINs' },
  { id: 'INV_021', name: 'SEZ Invoice', description: 'SEZ with approval', category: 'invoice', subcategory: 'sez', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_021', messageTemplate: 'SEZ validation failed: {value}', suggestionTemplate: 'Need authorization' },
  { id: 'INV_022', name: 'B2CL High Value', description: '₹2.5L threshold', category: 'invoice', subcategory: 'threshold', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_022', messageTemplate: 'B2CL threshold: {value}', suggestionTemplate: '>₹2.5L inter-state' },
  { id: 'INV_023', name: 'B2CS Small Value', description: '₹1L threshold', category: 'invoice', subcategory: 'threshold', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_023', messageTemplate: 'B2CS threshold: {value}', suggestionTemplate: '<₹1L intra-state' },
  { id: 'INV_024', name: 'Credit Note Reference', description: 'Original invoice ref', category: 'invoice', subcategory: 'credit_note', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_024', messageTemplate: 'CN needs invoice ref: {value}', suggestionTemplate: 'Provide invoice ref' },
  { id: 'INV_025', name: 'Debit Note Reference', description: 'Original invoice ref', category: 'invoice', subcategory: 'debit_note', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_025', messageTemplate: 'DN needs invoice ref: {value}', suggestionTemplate: 'Provide invoice ref' },
  { id: 'INV_026', name: 'Amendment Reference', description: 'Original invoice ref', category: 'invoice', subcategory: 'amendment', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_026', messageTemplate: 'Amendment needs ref: {value}', suggestionTemplate: 'Provide original ref' },
  { id: 'INV_027', name: 'Tax Invoice vs Bill of Supply', description: 'Exempt supplies', category: 'classification', subcategory: 'document_type', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_027', messageTemplate: 'Use Bill of Supply: {value}', suggestionTemplate: 'For exempt supplies' },
  { id: 'INV_028', name: 'Recipient Name Required', description: 'Customer name for B2B', category: 'invoice', subcategory: 'required', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_028', messageTemplate: 'Recipient name required', suggestionTemplate: 'Provide name' },
  { id: 'INV_029', name: 'Recipient Address', description: 'Complete address', category: 'invoice', subcategory: 'address', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_029', messageTemplate: 'Address validation: {value}', suggestionTemplate: 'Provide address' },
  { id: 'INV_030', name: 'E-waybill', description: 'E-waybill number', category: 'invoice', subcategory: 'ewaybill', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'INV_030', messageTemplate: 'E-waybill: {value}', suggestionTemplate: 'Generate if >₹50K' },
  { id: 'INV_031', name: 'TDS Deduction', description: 'TDS applicable', category: 'invoice', subcategory: 'tds', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'INV_031', messageTemplate: 'TDS: {value}', suggestionTemplate: 'Check TDS rules' },
  { id: 'INV_032', name: 'TCS Collection', description: 'E-commerce TCS', category: 'invoice', subcategory: 'tcs', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_032', messageTemplate: 'TCS: {value}', suggestionTemplate: 'Collect @1%' },
  { id: 'INV_033', name: 'GST Payment Mode', description: 'Cash/Credit mode', category: 'tax', subcategory: 'payment', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'INV_033', messageTemplate: 'Payment mode: {value}', suggestionTemplate: 'Select Cash/Credit' },
  { id: 'INV_034', name: 'Port Code', description: 'Export port code', category: 'invoice', subcategory: 'export', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_034', messageTemplate: 'Invalid port: {value}', suggestionTemplate: 'Use valid code' },
  { id: 'INV_035', name: 'Country Code', description: 'Export country code', category: 'invoice', subcategory: 'export', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_035', messageTemplate: 'Invalid country: {value}', suggestionTemplate: 'Use ISO code' },
  { id: 'INV_036', name: 'Shipping Bill Date', description: 'SB after invoice', category: 'invoice', subcategory: 'export', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'INV_036', messageTemplate: 'SB date: {value}', suggestionTemplate: 'After invoice date' },
  { id: 'INV_037', name: 'Original Invoice CN/DN', description: 'Within 1 year', category: 'invoice', subcategory: 'credit_debit_note', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_037', messageTemplate: 'Original date: {value}', suggestionTemplate: 'Within 1 year' },
  { id: 'INV_038', name: 'Advance Receipt', description: 'GST on advance', category: 'invoice', subcategory: 'advance', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'INV_038', messageTemplate: 'Advance: {value}', suggestionTemplate: 'Pay GST on advance' },
  { id: 'INV_039', name: 'Nil Rated Classification', description: '0% rate', category: 'classification', subcategory: 'nil_rated', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'INV_039', messageTemplate: 'Nil rated: {value}', suggestionTemplate: '0% tax rate' },
  { id: 'INV_040', name: 'Exempt Classification', description: 'Separate from taxable', category: 'classification', subcategory: 'exempt', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'INV_040', messageTemplate: 'Exempt: {value}', suggestionTemplate: 'Report separately' },

  // Tax Calculation Rules (50 rules)
  { id: 'TAX_001', name: 'CGST Rate', description: 'Valid CGST rate', category: 'tax', subcategory: 'cgst_rate', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_001', messageTemplate: 'Invalid CGST: {value}', suggestionTemplate: 'Use 0%, 0.25%, 3%, 5%, 12%, 18%, 28%' },
  { id: 'TAX_002', name: 'SGST Rate', description: 'SGST = CGST', category: 'tax', subcategory: 'sgst_rate', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_002', messageTemplate: 'SGST ≠ CGST: {value}', suggestionTemplate: 'Intra-state: SGST = CGST' },
  { id: 'TAX_003', name: 'IGST Rate', description: 'Inter-state rate', category: 'tax', subcategory: 'igst_rate', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_003', messageTemplate: 'IGST: {value}', suggestionTemplate: 'Use IGST for inter-state' },
  { id: 'TAX_004', name: 'IGST vs CGST+SGST', description: 'Mutual exclusive', category: 'tax', subcategory: 'mutual_exclusive', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_004', messageTemplate: 'Both IGST & CGST/SGST: {value}', suggestionTemplate: 'Use one or other' },
  { id: 'TAX_005', name: 'CGST Calculation', description: 'taxable × rate / 2', category: 'tax', subcategory: 'cgst_calc', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_005', messageTemplate: 'CGST calc error: {value}', suggestionTemplate: '= (taxable × rate) / 2' },
  { id: 'TAX_006', name: 'SGST Calculation', description: 'taxable × rate / 2', category: 'tax', subcategory: 'sgst_calc', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_006', messageTemplate: 'SGST calc error: {value}', suggestionTemplate: '= (taxable × rate) / 2' },
  { id: 'TAX_007', name: 'IGST Calculation', description: 'taxable × rate', category: 'tax', subcategory: 'igst_calc', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_007', messageTemplate: 'IGST calc error: {value}', suggestionTemplate: '= taxable × rate' },
  { id: 'TAX_008', name: 'Cess Rate', description: 'Valid cess rate', category: 'tax', subcategory: 'cess_rate', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_008', messageTemplate: 'Invalid cess: {value}', suggestionTemplate: 'Check cess rates' },
  { id: 'TAX_009', name: 'Cess Calculation', description: 'Cess calculation', category: 'tax', subcategory: 'cess_calc', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_009', messageTemplate: 'Cess calc error: {value}', suggestionTemplate: '= taxable × cess_rate' },
  { id: 'TAX_010', name: 'RCM Applicability', description: 'Reverse charge', category: 'tax', subcategory: 'rcm', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_010', messageTemplate: 'RCM: {value}', suggestionTemplate: 'Check RCM rules' },
  { id: 'TAX_011', name: 'RCM Calculation', description: 'Tax under RCM', category: 'tax', subcategory: 'rcm_calc', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_011', messageTemplate: 'RCM calc: {value}', suggestionTemplate: 'Recipient pays tax' },
  { id: 'TAX_012', name: 'Exempt Supply', description: 'Zero tax', category: 'tax', subcategory: 'exempt', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_012', messageTemplate: 'Exempt has tax: {value}', suggestionTemplate: 'Exempt = 0% tax' },
  { id: 'TAX_013', name: 'Nil Rated Supply', description: '0% rate', category: 'tax', subcategory: 'nil_rated', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_013', messageTemplate: 'Nil rated: {value}', suggestionTemplate: '0% rate' },
  { id: 'TAX_014', name: 'Zero Rated Supply', description: 'Exports/SEZ', category: 'tax', subcategory: 'zero_rated', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_014', messageTemplate: 'Zero rated: {value}', suggestionTemplate: 'Need LUT/Bond' },
  { id: 'TAX_015', name: 'Integrated Tax', description: 'IGST calculation', category: 'tax', subcategory: 'integrated_tax', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_015', messageTemplate: 'IGST: {value}', suggestionTemplate: 'Check computation' },
  { id: 'TAX_016', name: 'State Tax', description: 'SGST/UTGST', category: 'tax', subcategory: 'state_tax', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_016', messageTemplate: 'SGST: {value}', suggestionTemplate: 'Check computation' },
  { id: 'TAX_017', name: 'Central Tax', description: 'CGST', category: 'tax', subcategory: 'central_tax', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_017', messageTemplate: 'CGST: {value}', suggestionTemplate: 'Check computation' },
  { id: 'TAX_018', name: 'Tax Rounding', description: '2 decimal places', category: 'tax', subcategory: 'rounding', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_018', messageTemplate: 'Rounding: {value}', suggestionTemplate: 'Round to 2 decimals' },
  { id: 'TAX_019', name: 'ITC Eligibility', description: 'ITC eligible', category: 'tax', subcategory: 'itc', severity: 'error', applicableReturns: ['GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_019', messageTemplate: 'ITC eligibility: {value}', suggestionTemplate: 'Check rules' },
  { id: 'TAX_020', name: 'ITC Reversal', description: 'Reversal required', category: 'tax', subcategory: 'itc_reversal', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_020', messageTemplate: 'ITC reversal: {value}', suggestionTemplate: 'Reverse blocked ITC' },
  { id: 'TAX_021', name: 'Interest Calculation', description: 'Interest on delay', category: 'tax', subcategory: 'interest', severity: 'warning', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_021', messageTemplate: 'Interest: {value}', suggestionTemplate: '@18% p.a.' },
  { id: 'TAX_022', name: 'Late Fee', description: 'Late filing fee', category: 'tax', subcategory: 'late_fee', severity: 'warning', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_022', messageTemplate: 'Late fee: {value}', suggestionTemplate: '₹50/day' },
  { id: 'TAX_023', name: 'Cash Credit', description: 'Cash ledger', category: 'tax', subcategory: 'cash_credit', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_023', messageTemplate: 'Cash credit: {value}', suggestionTemplate: 'Check balance' },
  { id: 'TAX_024', name: 'E-Credit Ledger', description: 'Credit ledger', category: 'tax', subcategory: 'e_credit', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_024', messageTemplate: 'E-credit: {value}', suggestionTemplate: 'Check balance' },
  { id: 'TAX_025', name: 'E-Cash Ledger', description: 'Cash ledger', category: 'tax', subcategory: 'e_cash', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_025', messageTemplate: 'E-cash: {value}', suggestionTemplate: 'Check balance' },
  { id: 'TAX_026', name: 'Tax Demand', description: 'Demand computation', category: 'tax', subcategory: 'demand', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_026', messageTemplate: 'Tax demand: {value}', suggestionTemplate: 'Verify calculation' },
  { id: 'TAX_027', name: 'Tax Refund', description: 'Refund claim', category: 'tax', subcategory: 'refund', severity: 'error', applicableReturns: ['GSTR-3B', 'GSTR-1'], errorCode: 'TAX_027', messageTemplate: 'Refund: {value}', suggestionTemplate: 'Verify eligibility' },
  { id: 'TAX_028', name: 'Advance Tax', description: 'Advance received', category: 'tax', subcategory: 'advance', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_028', messageTemplate: 'Advance: {value}', suggestionTemplate: 'Check accounting' },
  { id: 'TAX_029', name: 'Composition Tax', description: 'Composition rates', category: 'tax', subcategory: 'composition', severity: 'error', applicableReturns: ['GSTR-4'], errorCode: 'TAX_029', messageTemplate: 'Composition: {value}', suggestionTemplate: '0.5%/2.5%/1%' },
  { id: 'TAX_030', name: 'TDS Tax', description: 'TDS deduction', category: 'tax', subcategory: 'tds', severity: 'error', applicableReturns: ['GSTR-7'], errorCode: 'TAX_030', messageTemplate: 'TDS: {value}', suggestionTemplate: '@2%' },
  { id: 'TAX_031', name: 'TCS Tax', description: 'TCS collection', category: 'tax', subcategory: 'tcs', severity: 'error', applicableReturns: ['GSTR-8'], errorCode: 'TAX_031', messageTemplate: 'TCS: {value}', suggestionTemplate: '@1%' },
  { id: 'TAX_032', name: 'Input Tax Recon', description: 'Input tax match', category: 'tax', subcategory: 'reconciliation', severity: 'warning', applicableReturns: ['GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_032', messageTemplate: 'Input recon: {value}', suggestionTemplate: 'Match with GSTR-2B' },
  { id: 'TAX_033', name: 'Output Tax Recon', description: 'Output tax match', category: 'tax', subcategory: 'reconciliation', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_033', messageTemplate: 'Output recon: {value}', suggestionTemplate: 'Match with GSTR-1' },
  { id: 'TAX_034', name: 'Tax Rate Change', description: 'Rate changes', category: 'tax', subcategory: 'rate_change', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_034', messageTemplate: 'Rate change: {value}', suggestionTemplate: 'Apply correct rate' },
  { id: 'TAX_035', name: 'Supply Type Tax', description: 'Based on supply', category: 'tax', subcategory: 'supply_type', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_035', messageTemplate: 'Supply type: {value}', suggestionTemplate: 'Different treatments' },
  { id: 'TAX_036', name: 'POS Tax Impact', description: 'Based on POS', category: 'tax', subcategory: 'pos_tax', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_036', messageTemplate: 'POS tax: {value}', suggestionTemplate: 'Inter-state = IGST' },
  { id: 'TAX_037', name: 'Branch Transfer', description: 'Branch treatment', category: 'tax', subcategory: 'branch_transfer', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_037', messageTemplate: 'Branch transfer: {value}', suggestionTemplate: 'Treated as supply' },
  { id: 'TAX_038', name: 'Stock Transfer', description: 'Stock between states', category: 'tax', subcategory: 'stock_transfer', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'TAX_038', messageTemplate: 'Stock transfer: {value}', suggestionTemplate: 'Taxable if inter-state' },
  { id: 'TAX_039', name: 'Job Work', description: 'Job work treatment', category: 'tax', subcategory: 'job_work', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'TAX_039', messageTemplate: 'Job work: {value}', suggestionTemplate: 'Check provisions' },
  { id: 'TAX_040', name: 'Royalty/License', description: 'Royalty tax', category: 'tax', subcategory: 'royalty', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_040', messageTemplate: 'Royalty: {value}', suggestionTemplate: 'RCM applies' },
  { id: 'TAX_041', name: 'Director Services', description: 'Director tax', category: 'tax', subcategory: 'director', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'TAX_041', messageTemplate: 'Director: {value}', suggestionTemplate: 'RCM applies' },
  { id: 'TAX_042', name: 'Government Discount', description: 'Discount rules', category: 'tax', subcategory: 'discount', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'TAX_042', messageTemplate: 'Govt discount: {value}', suggestionTemplate: 'Check rules' },
  { id: 'TAX_043', name: 'Trade Discount', description: 'Discount rules', category: 'tax', subcategory: 'discount', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'TAX_043', messageTemplate: 'Trade discount: {value}', suggestionTemplate: 'If not linked' },
  { id: 'TAX_044', name: 'Secondary Adjustments', description: 'Excess ITC', category: 'tax', subcategory: 'adjustment', severity: 'warning', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_044', messageTemplate: 'Secondary adj: {value}', suggestionTemplate: 'Make adjustments' },
  { id: 'TAX_045', name: 'Transition Credit', description: 'From pre-GST', category: 'tax', subcategory: 'transition', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_045', messageTemplate: 'Transition: {value}', suggestionTemplate: 'Verify eligibility' },
  { id: 'TAX_046', name: 'ISD Credit', description: 'ISD distribution', category: 'tax', subcategory: 'isd', severity: 'error', applicableReturns: ['GSTR-6'], errorCode: 'TAX_046', messageTemplate: 'ISD credit: {value}', suggestionTemplate: 'Check rules' },
  { id: 'TAX_047', name: 'Credit Distribution', description: 'By ISD', category: 'tax', subcategory: 'distribution', severity: 'error', applicableReturns: ['GSTR-6'], errorCode: 'TAX_047', messageTemplate: 'Distribution: {value}', suggestionTemplate: 'As per rules' },
  { id: 'TAX_048', name: 'TDS Credit', description: 'TDS in 2A/2B', category: 'tax', subcategory: 'tds_credit', severity: 'error', applicableReturns: ['GSTR-2A', 'GSTR-2B'], errorCode: 'TAX_048', messageTemplate: 'TDS credit: {value}', suggestionTemplate: 'In GSTR-2A/2B' },
  { id: 'TAX_049', name: 'TCS Credit', description: 'TCS in 2A/2B', category: 'tax', subcategory: 'tcs_credit', severity: 'error', applicableReturns: ['GSTR-2A', 'GSTR-2B'], errorCode: 'TAX_049', messageTemplate: 'TCS credit: {value}', suggestionTemplate: 'In GSTR-2A/2B' },
  { id: 'TAX_050', name: 'ELR', description: 'Liability register', category: 'tax', subcategory: 'elr', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'TAX_050', messageTemplate: 'ELR: {value}', suggestionTemplate: 'Check entries' },

  // HSN Rules (30 rules)
  { id: 'HSN_001', name: 'HSN Format', description: '4, 6, or 8 digits', category: 'hsn', subcategory: 'format', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B', 'GSTR-3B'], errorCode: 'HSN_001', messageTemplate: 'Invalid HSN: {value}', suggestionTemplate: '4, 6, or 8 digits' },
  { id: 'HSN_002', name: 'HSN Chapter', description: '01-99', category: 'hsn', subcategory: 'chapter', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_002', messageTemplate: 'Invalid chapter: {value}', suggestionTemplate: '01-99' },
  { id: 'HSN_003', name: 'HSN Heading', description: 'Valid heading', category: 'hsn', subcategory: 'heading', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_003', messageTemplate: 'Invalid heading: {value}', suggestionTemplate: 'Check valid heading' },
  { id: 'HSN_004', name: 'SAC Code', description: 'Services 99xx', category: 'hsn', subcategory: 'sac', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_004', messageTemplate: 'Invalid SAC: {value}', suggestionTemplate: 'Start with 99' },
  { id: 'HSN_005', name: 'HSN-Tax Rate', description: 'Correct rate', category: 'hsn', subcategory: 'rate_mapping', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_005', messageTemplate: 'Rate mismatch: {value}', suggestionTemplate: 'Check recommended rate' },
  { id: 'HSN_006', name: 'Chapter 99', description: 'Services use SAC', category: 'hsn', subcategory: 'chapter_99', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_006', messageTemplate: 'Use SAC: {value}', suggestionTemplate: '99xxxx for services' },
  { id: 'HSN_007', name: 'HSN vs SAC', description: 'Goods vs Services', category: 'hsn', subcategory: 'goods_services', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_007', messageTemplate: 'Type mismatch: {value}', suggestionTemplate: 'HSN=goods, SAC=services' },
  { id: 'HSN_008', name: 'Chemical CAS', description: 'CAS for chemicals', category: 'hsn', subcategory: 'chemical', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'HSN_008', messageTemplate: 'CAS: {value}', suggestionTemplate: 'May need CAS' },
  { id: 'HSN_009', name: 'Tobacco', description: 'Tobacco products', category: 'hsn', subcategory: 'tobacco', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_009', messageTemplate: 'Tobacco: {value}', suggestionTemplate: 'Special tax' },
  { id: 'HSN_010', name: 'Precious Metals', description: 'Gold, silver', category: 'hsn', subcategory: 'precious_metals', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_010', messageTemplate: 'Precious: {value}', suggestionTemplate: '7101, 7102, 7103' },
  { id: 'HSN_011', name: 'Textiles', description: 'Chapter 50-63', category: 'hsn', subcategory: 'textiles', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_011', messageTemplate: 'Textile: {value}', suggestionTemplate: '50-63' },
  { id: 'HSN_012', name: 'Food', description: 'Chapter 1-24', category: 'hsn', subcategory: 'food', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_012', messageTemplate: 'Food: {value}', suggestionTemplate: '1-24' },
  { id: 'HSN_013', name: 'Electronics', description: 'Chapter 84-85', category: 'hsn', subcategory: 'electronics', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_013', messageTemplate: 'Electronics: {value}', suggestionTemplate: '84-85' },
  { id: 'HSN_014', name: 'Automobile', description: 'Chapter 86-87', category: 'hsn', subcategory: 'automobile', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_014', messageTemplate: 'Automobile: {value}', suggestionTemplate: '86-87' },
  { id: 'HSN_015', name: 'Pharma', description: 'Chapter 28-30', category: 'hsn', subcategory: 'pharma', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_015', messageTemplate: 'Pharma: {value}', suggestionTemplate: '28-30' },
  { id: 'HSN_016', name: 'Construction', description: 'Cement, steel', category: 'hsn', subcategory: 'construction', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'HSN_016', messageTemplate: 'Construction: {value}', suggestionTemplate: 'Specific codes' },
  { id: 'HSN_017', name: 'Textile 2-digit', description: 'Chapter ID', category: 'hsn', subcategory: 'textile_2digit', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'HSN_017', messageTemplate: 'Textile ID: {value}', suggestionTemplate: '50-63' },
  { id: 'HSN_018', name: 'HSN Description', description: 'Description needed', category: 'hsn', subcategory: 'description', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-2B'], errorCode: 'HSN_018', messageTemplate: 'Description: {value}', suggestionTemplate: 'Provide HSN desc' },
  { id: 'HSN_019', name: 'HSN Quantity', description: 'Unit matches HSN', category: 'hsn', subcategory: 'quantity', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_019', messageTemplate: 'Quantity: {value}', suggestionTemplate: 'Standard UOM' },
  { id: 'HSN_020', name: 'UQC', description: 'Valid UQC', category: 'hsn', subcategory: 'uqc', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_020', messageTemplate: 'Invalid UQC: {value}', suggestionTemplate: 'Valid UQC list' },
  { id: 'HSN_021', name: 'Motor Vehicle', description: '8702, 8703', category: 'hsn', subcategory: 'motor_vehicle', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_021', messageTemplate: 'Vehicle: {value}', suggestionTemplate: '8702, 8703' },
  { id: 'HSN_022', name: 'Cement', description: '2523', category: 'hsn', subcategory: 'cement', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_022', messageTemplate: 'Cement: {value}', suggestionTemplate: '2523' },
  { id: 'HSN_023', name: 'Steel', description: 'Chapter 72-73', category: 'hsn', subcategory: 'steel', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_023', messageTemplate: 'Steel: {value}', suggestionTemplate: '72-73' },
  { id: 'HSN_024', name: 'Mobile', description: '8517 12', category: 'hsn', subcategory: 'mobile', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_024', messageTemplate: 'Mobile: {value}', suggestionTemplate: '8517 12' },
  { id: 'HSN_025', name: 'Footwear', description: 'Chapter 64', category: 'hsn', subcategory: 'footwear', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_025', messageTemplate: 'Footwear: {value}', suggestionTemplate: '64' },
  { id: 'HSN_026', name: 'Garments', description: 'Chapter 62', category: 'hsn', subcategory: 'garments', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_026', messageTemplate: 'Garment: {value}', suggestionTemplate: '62' },
  { id: 'HSN_027', name: 'Furniture', description: 'Chapter 94', category: 'hsn', subcategory: 'furniture', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'HSN_027', messageTemplate: 'Furniture: {value}', suggestionTemplate: '94' },
  { id: 'HSN_028', name: 'Petroleum', description: 'Chapter 27', category: 'hsn', subcategory: 'petroleum', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'HSN_028', messageTemplate: 'Petroleum: {value}', suggestionTemplate: '27 (exempted)' },
  { id: 'HSN_029', name: 'E-Waste', description: 'Chapter 84-85', category: 'hsn', subcategory: 'e_waste', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_029', messageTemplate: 'E-waste: {value}', suggestionTemplate: 'With surcharge' },
  { id: 'HSN_030', name: 'Solar Panels', description: '8541 40', category: 'hsn', subcategory: 'solar', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'HSN_030', messageTemplate: 'Solar: {value}', suggestionTemplate: '8541 40' },

  // Return Period Rules (15 rules)
  { id: 'RET_001', name: 'Period Format', description: 'MM-YYYY or MMYYYY', category: 'return_period', subcategory: 'format', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B', 'GSTR-4', 'GSTR-9'], errorCode: 'RET_001', messageTemplate: 'Invalid format: {value}', suggestionTemplate: 'MM-YYYY' },
  { id: 'RET_002', name: 'Filing Due Date', description: 'Within due date', category: 'return_period', subcategory: 'due_date', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_002', messageTemplate: 'Due date: {value}', suggestionTemplate: '10th/20th/22nd' },
  { id: 'RET_003', name: 'Late Filing', description: 'Detect late', category: 'return_period', subcategory: 'late_filing', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_003', messageTemplate: 'Late filing: {value}', suggestionTemplate: '₹50/day penalty' },
  { id: 'RET_004', name: 'Amendment Period', description: 'Within period', category: 'return_period', subcategory: 'amendment', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'RET_004', messageTemplate: 'Amendment: {value}', suggestionTemplate: '10th of next month' },
  { id: 'RET_005', name: 'Annual Return', description: 'April-March', category: 'return_period', subcategory: 'annual', severity: 'error', applicableReturns: ['GSTR-9'], errorCode: 'RET_005', messageTemplate: 'Annual: {value}', suggestionTemplate: 'FY April-March' },
  { id: 'RET_006', name: 'Quarterly Return', description: 'Quarterly periods', category: 'return_period', subcategory: 'quarterly', severity: 'error', applicableReturns: ['GSTR-4'], errorCode: 'RET_006', messageTemplate: 'Quarterly: {value}', suggestionTemplate: 'Q1/Q2/Q3/Q4' },
  { id: 'RET_007', name: 'Financial Year', description: 'Valid FY', category: 'return_period', subcategory: 'fy', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B', 'GSTR-9'], errorCode: 'RET_007', messageTemplate: 'FY: {value}', suggestionTemplate: 'Current/prev FY' },
  { id: 'RET_008', name: 'Month Validity', description: '01-12', category: 'return_period', subcategory: 'month', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B', 'GSTR-4'], errorCode: 'RET_008', messageTemplate: 'Month: {value}', suggestionTemplate: '01-12' },
  { id: 'RET_009', name: 'Year Validity', description: '2017-current', category: 'return_period', subcategory: 'year', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B', 'GSTR-4', 'GSTR-9'], errorCode: 'RET_009', messageTemplate: 'Year: {value}', suggestionTemplate: '2017-current' },
  { id: 'RET_010', name: 'First Return', description: 'After registration', category: 'return_period', subcategory: 'first_return', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_010', messageTemplate: 'First return: {value}', suggestionTemplate: 'From reg month' },
  { id: 'RET_011', name: 'Cancellation', description: 'After cancellation', category: 'return_period', subcategory: 'cancellation', severity: 'warning', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_011', messageTemplate: 'Cancellation: {value}', suggestionTemplate: 'Till cancel date' },
  { id: 'RET_012', name: 'Opt-In Period', description: 'Scheme opt-in', category: 'return_period', subcategory: 'opt_in', severity: 'warning', applicableReturns: ['GSTR-4'], errorCode: 'RET_012', messageTemplate: 'Opt-in: {value}', suggestionTemplate: 'From FY start' },
  { id: 'RET_013', name: 'Transition', description: 'Pre-GST period', category: 'return_period', subcategory: 'transition', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_013', messageTemplate: 'Transition: {value}', suggestionTemplate: 'July 2017 rules' },
  { id: 'RET_014', name: 'Period Consistency', description: 'Same across sections', category: 'return_period', subcategory: 'consistency', severity: 'error', applicableReturns: ['GSTR-1', 'GSTR-3B'], errorCode: 'RET_014', messageTemplate: 'Consistency: {value}', suggestionTemplate: 'Same period' },
  { id: 'RET_015', name: 'ITC Period', description: '180 days', category: 'return_period', subcategory: 'itc_period', severity: 'error', applicableReturns: ['GSTR-2B', 'GSTR-3B'], errorCode: 'RET_015', messageTemplate: 'ITC period: {value}', suggestionTemplate: 'Within 180 days' },

  // GSTR-1 Rules (25 rules)
  { id: 'G1_001', name: 'B2B Invoice', description: 'Recipient GSTIN', category: 'gstr1', subcategory: 'b2b', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_001', messageTemplate: 'B2B GSTIN: {value}', suggestionTemplate: 'Required' },
  { id: 'G1_002', name: 'B2CL', description: '>₹2.5L threshold', category: 'gstr1', subcategory: 'b2cl', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_002', messageTemplate: 'B2CL: {value}', suggestionTemplate: '>₹2.5L inter-state' },
  { id: 'G1_003', name: 'B2CS', description: '<₹1L threshold', category: 'gstr1', subcategory: 'b2cs', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_003', messageTemplate: 'B2CS: {value}', suggestionTemplate: '<₹1L intra-state' },
  { id: 'G1_004', name: 'Export', description: 'Shipping bill', category: 'gstr1', subcategory: 'export', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_004', messageTemplate: 'Export: {value}', suggestionTemplate: 'Need shipping bill' },
  { id: 'G1_005', name: 'Deemed Export', description: 'Both GSTINs', category: 'gstr1', subcategory: 'deemed_export', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_005', messageTemplate: 'Deemed: {value}', suggestionTemplate: 'Need both GSTINs' },
  { id: 'G1_006', name: 'SEZ', description: 'Approval number', category: 'gstr1', subcategory: 'sez', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_006', messageTemplate: 'SEZ: {value}', suggestionTemplate: 'Need auth' },
  { id: 'G1_007', name: 'CDNR', description: 'Registered CN/DN', category: 'gstr1', subcategory: 'cdnr', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_007', messageTemplate: 'CDNR: {value}', suggestionTemplate: 'GSTIN + invoice ref' },
  { id: 'G1_008', name: 'CDNUR', description: 'Unregistered CN/DN', category: 'gstr1', subcategory: 'cdnur', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_008', messageTemplate: 'CDNUR: {value}', suggestionTemplate: 'Name + address' },
  { id: 'G1_009', name: 'Nil Rated', description: '0% rate', category: 'gstr1', subcategory: 'nil_rated', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_009', messageTemplate: 'Nil rated: {value}', suggestionTemplate: '0% rate' },
  { id: 'G1_010', name: 'Exempted', description: 'Separate report', category: 'gstr1', subcategory: 'exempted', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_010', messageTemplate: 'Exempted: {value}', suggestionTemplate: 'Separate' },
  { id: 'G1_011', name: 'Outward Total', description: 'Matches summary', category: 'gstr1', subcategory: 'outward', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_011', messageTemplate: 'Outward: {value}', suggestionTemplate: 'Match sum' },
  { id: 'G1_012', name: 'Inter-State', description: 'IGST applied', category: 'gstr1', subcategory: 'inter_state', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_012', messageTemplate: 'Inter-state: {value}', suggestionTemplate: 'IGST' },
  { id: 'G1_013', name: 'Intra-State', description: 'CGST+SGST', category: 'gstr1', subcategory: 'intra_state', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_013', messageTemplate: 'Intra-state: {value}', suggestionTemplate: 'CGST+SGST' },
  { id: 'G1_014', name: 'Taxable Total', description: 'Taxable value sum', category: 'gstr1', subcategory: 'taxable', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_014', messageTemplate: 'Taxable: {value}', suggestionTemplate: 'Match sum' },
  { id: 'G1_015', name: 'Advance Received', description: 'Advance received', category: 'gstr1', subcategory: 'advance', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'G1_015', messageTemplate: 'Advance: {value}', suggestionTemplate: 'Record and adjust' },
  { id: 'G1_016', name: 'Advance Adjustment', description: 'Against supply', category: 'gstr1', subcategory: 'advance_adjustment', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'G1_016', messageTemplate: 'Adj: {value}', suggestionTemplate: 'Adjust' },
  { id: 'G1_017', name: 'HSN Summary', description: 'Matches items', category: 'gstr1', subcategory: 'hsn_summary', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_017', messageTemplate: 'HSN sum: {value}', suggestionTemplate: 'Match items' },
  { id: 'G1_018', name: 'Document Summary', description: 'Count match', category: 'gstr1', subcategory: 'doc_summary', severity: 'info', applicableReturns: ['GSTR-1'], errorCode: 'G1_018', messageTemplate: 'Doc count: {value}', suggestionTemplate: 'Match' },
  { id: 'G1_019', name: 'Zero Rated', description: 'Exports/SEZ', category: 'gstr1', subcategory: 'zero_rated', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_019', messageTemplate: 'Zero rated: {value}', suggestionTemplate: 'LUT/Bond' },
  { id: 'G1_020', name: 'Portal Count', description: 'Match portal', category: 'gstr1', subcategory: 'portal_count', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'G1_020', messageTemplate: 'Portal: {value}', suggestionTemplate: 'Verify' },
  { id: 'G1_021', name: 'Amendment', description: 'Previous period', category: 'gstr1', subcategory: 'amendment', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'G1_021', messageTemplate: 'Amendment: {value}', suggestionTemplate: 'Ref period' },
  { id: 'G1_022', name: 'E-Commerce', description: 'Through operator', category: 'gstr1', subcategory: 'ecommerce', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_022', messageTemplate: 'E-com: {value}', suggestionTemplate: 'Operator details' },
  { id: 'G1_023', name: 'TDS Deduction', description: 'Government/PSU', category: 'gstr1', subcategory: 'tds', severity: 'warning', applicableReturns: ['GSTR-1'], errorCode: 'G1_023', messageTemplate: 'TDS: {value}', suggestionTemplate: '@2%' },
  { id: 'G1_024', name: 'TCS Collection', description: 'E-commerce', category: 'gstr1', subcategory: 'tcs', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_024', messageTemplate: 'TCS: {value}', suggestionTemplate: '@1%' },
  { id: 'G1_025', name: 'Invoice Sum', description: 'Sum matches total', category: 'gstr1', subcategory: 'sum_validation', severity: 'error', applicableReturns: ['GSTR-1'], errorCode: 'G1_025', messageTemplate: 'Sum: {value}', suggestionTemplate: 'Match' },

  // GSTR-3B Rules (25 rules)
  { id: 'G3_001', name: 'Outward Liability', description: 'Matches GSTR-1', category: 'gstr3b', subcategory: 'outward_liability', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_001', messageTemplate: 'Outward: {value}', suggestionTemplate: 'Match GSTR-1' },
  { id: 'G3_002', name: 'Inward Supplies', description: 'Matches 2A/2B', category: 'gstr3b', subcategory: 'inward_supplies', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_002', messageTemplate: 'Inward: {value}', suggestionTemplate: 'Match 2A/2B' },
  { id: 'G3_003', name: 'ITC Eligible', description: 'Eligible ITC', category: 'gstr3b', subcategory: 'itc_eligibility', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_003', messageTemplate: 'ITC: {value}', suggestionTemplate: 'Check rules' },
  { id: 'G3_004', name: 'ITC Reversal', description: 'Reversal required', category: 'gstr3b', subcategory: 'itc_reversal', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_004', messageTemplate: 'Reversal: {value}', suggestionTemplate: 'Reverse blocked' },
  { id: 'G3_005', name: 'Late Fee', description: 'Late fee calc', category: 'gstr3b', subcategory: 'late_fee', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_005', messageTemplate: 'Late fee: {value}', suggestionTemplate: '₹50/day' },
  { id: 'G3_006', name: 'Cash Credit', description: 'Cash used', category: 'gstr3b', subcategory: 'cash_credit', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_006', messageTemplate: 'Cash: {value}', suggestionTemplate: 'Check balance' },
  { id: 'G3_007', name: 'E-Credit', description: 'Credit used', category: 'gstr3b', subcategory: 'e_credit', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_007', messageTemplate: 'Credit: {value}', suggestionTemplate: 'Check balance' },
  { id: 'G3_008', name: 'E-Cash', description: 'Cash used', category: 'gstr3b', subcategory: 'e_cash', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_008', messageTemplate: 'E-cash: {value}', suggestionTemplate: 'Check balance' },
  { id: 'G3_009', name: 'Tax Payment', description: 'Payment details', category: 'gstr3b', subcategory: 'tax_payment', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_009', messageTemplate: 'Payment: {value}', suggestionTemplate: 'Verify' },
  { id: 'G3_010', name: 'Interest', description: 'Interest liability', category: 'gstr3b', subcategory: 'interest_liability', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_010', messageTemplate: 'Interest: {value}', suggestionTemplate: '@18% p.a.' },
  { id: 'G3_011', name: 'Fee Liability', description: 'Fee liability', category: 'gstr3b', subcategory: 'fee_liability', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_011', messageTemplate: 'Fee: {value}', suggestionTemplate: 'Calculate' },
  { id: 'G3_012', name: 'Total Tax', description: 'Sum of taxes', category: 'gstr3b', subcategory: 'total_liability', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_012', messageTemplate: 'Total: {value}', suggestionTemplate: 'Sum all' },
  { id: 'G3_013', name: 'ITC Available', description: 'Total ITC', category: 'gstr3b', subcategory: 'itc_available', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_013', messageTemplate: 'ITC avail: {value}', suggestionTemplate: 'Sum eligible' },
  { id: 'G3_014', name: 'ITC Utilized', description: 'ITC used', category: 'gstr3b', subcategory: 'itc_utilized', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_014', messageTemplate: 'ITC used: {value}', suggestionTemplate: 'For tax' },
  { id: 'G3_015', name: 'Cash Utilized', description: 'Cash used', category: 'gstr3b', subcategory: 'cash_utilized', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_015', messageTemplate: 'Cash used: {value}', suggestionTemplate: 'For tax' },
  { id: 'G3_016', name: 'Period Match', description: 'Same period', category: 'gstr3b', subcategory: 'period_match', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_016', messageTemplate: 'Period: {value}', suggestionTemplate: 'Same across' },
  { id: 'G3_017', name: 'GSTR-1 Match', description: 'Output match', category: 'gstr3b', subcategory: 'gstr1_match', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_017', messageTemplate: 'Match 1: {value}', suggestionTemplate: 'Match GSTR-1' },
  { id: 'G3_018', name: 'GSTR-2B Match', description: 'ITC match', category: 'gstr3b', subcategory: 'gstr2b_match', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_018', messageTemplate: 'Match 2B: {value}', suggestionTemplate: 'Match GSTR-2B' },
  { id: 'G3_019', name: 'RCM Liability', description: 'RCM supplies', category: 'gstr3b', subcategory: 'rc_liability', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_019', messageTemplate: 'RCM: {value}', suggestionTemplate: 'Check RCM' },
  { id: 'G3_020', name: 'Section 9(5)', description: 'E-commerce', category: 'gstr3b', subcategory: 'section_9_5', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_020', messageTemplate: '9(5): {value}', suggestionTemplate: 'Specific supplies' },
  { id: 'G3_021', name: 'Composition', description: 'Composition tax', category: 'gstr3b', subcategory: 'composition', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_021', messageTemplate: 'Composition: {value}', suggestionTemplate: 'Calc' },
  { id: 'G3_022', name: 'Exempt', description: 'Exempt supplies', category: 'gstr3b', subcategory: 'exempt_supply', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_022', messageTemplate: 'Exempt: {value}', suggestionTemplate: 'Report' },
  { id: 'G3_023', name: 'Nil Rated', description: 'Nil rated supplies', category: 'gstr3b', subcategory: 'nil_rated_supply', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_023', messageTemplate: 'Nil: {value}', suggestionTemplate: 'Report' },
  { id: 'G3_024', name: 'Export Without Payment', description: 'Exports LUT', category: 'gstr3b', subcategory: 'export_without_payment', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_024', messageTemplate: 'Export: {value}', suggestionTemplate: 'LUT/Bond' },
  { id: 'G3_025', name: 'Summary Total', description: 'Summary = details', category: 'gstr3b', subcategory: 'summary_totals', severity: 'error', applicableReturns: ['GSTR-3B'], errorCode: 'G3_025', messageTemplate: 'Summary: {value}', suggestionTemplate: 'Match details' },
];

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function getRuleById(id: string): ValidationRule | undefined {
  return VALIDATION_RULES.find(r => r.id === id);
}

export function getRulesByCategory(category: ValidationCategory): ValidationRule[] {
  return VALIDATION_RULES.filter(r => r.category === category);
}

export function getRulesByReturn(returnType: GSTRReturnType): ValidationRule[] {
  return VALIDATION_RULES.filter(r => r.applicableReturns.includes(returnType));
}

export function getRulesBySeverity(severity: ValidationSeverity): ValidationRule[] {
  return VALIDATION_RULES.filter(r => r.severity === severity);
}

// GSTIN Validation
export function validateGSTIN(gstin: string | null | undefined): ValidationError | null {
  if (!gstin || gstin.trim() === '') {
    return createError('GSTIN_001', 'customer_gstin', 'GSTIN is missing');
  }
  
  const cleanGstin = gstin.toUpperCase().trim();
  
  if (!GSTIN_REGEX.test(cleanGstin)) {
    return createError('GSTIN_001', 'customer_gstin', `Invalid GSTIN format: ${cleanGstin}`);
  }
  
  const stateCode = cleanGstin.substring(0, 2);
  if (!VALID_STATE_CODES.includes(stateCode)) {
    return createError('GSTIN_003', 'customer_gstin', `Invalid state code: ${stateCode}`);
  }
  
  // Test GSTIN detection
  if (TEST_GSTIN_PATTERNS.some(p => cleanGstin.includes(p))) {
    return createWarning('GSTIN_005', 'customer_gstin', `Test GSTIN detected: ${cleanGstin}`);
  }
  
  return null;
}

// Place of Supply Validation
export function validatePlaceOfSupply(pos: string | null | undefined): ValidationError | null {
  if (!pos || pos.trim() === '') {
    return createError('INV_010', 'place_of_supply', 'Place of supply is required');
  }
  
  const posStr = pos.trim();
  
  // Check numeric code
  if (/^\d+$/.test(posStr)) {
    if (!VALID_STATE_CODES.includes(posStr)) {
      return createError('INV_011', 'place_of_supply', `Invalid state code: ${posStr}`);
    }
  } else {
    // Check state name
    const found = Object.values(STATE_NAMES).some(
      name => name.toLowerCase().includes(posStr.toLowerCase()) || posStr.toLowerCase().includes(name.toLowerCase())
    );
    if (!found) {
      return createError('INV_011', 'place_of_supply', `Unknown state: ${pos}`);
    }
  }
  
  return null;
}

// Tax Calculation Validation
export function validateTaxCalculation(
  taxableValue: number,
  cgst: number,
  sgst: number,
  igst: number,
  cess: number,
  total: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  const calculatedTotal = taxableValue + cgst + sgst + igst + cess;
  const tolerance = ROUNDING_TOLERANCE;
  
  if (Math.abs(calculatedTotal - total) > tolerance) {
    errors.push(createError('INV_017', 'total_amount',
      `Total mismatch: Expected ₹${calculatedTotal.toFixed(2)}, got ₹${total.toFixed(2)}`));
  }
  
  // Check mutual exclusivity
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    errors.push(createError('TAX_004', 'tax_type', 'Both IGST and CGST/SGST cannot be applied together'));
  }
  
  // CGST should equal SGST for intra-state
  if (cgst > 0 && sgst > 0 && Math.abs(cgst - sgst) > tolerance) {
    errors.push(createError('TAX_002', 'cgst_sgst', 'CGST and SGST should be equal for intra-state'));
  }
  
  return errors;
}

// Tax Rate Validation
export function validateTaxRate(
  taxableValue: number,
  taxRate: number,
  taxAmount: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (taxableValue <= 0 || taxRate <= 0) return errors;
  
  // Check if rate is allowed
  const allowedRate = ALLOWED_GST_RATES.some(r => Math.abs(r - taxRate) < 0.01);
  if (!allowedRate) {
    errors.push(createWarning('TAX_001', 'tax_rate', 
      `Non-standard rate: ${taxRate}%. Use: ${ALLOWED_GST_RATES.join(', ')}%`));
  }
  
  const expectedTax = (taxableValue * taxRate) / 100;
  const tolerance = Math.max(ROUNDING_TOLERANCE, expectedTax * 0.01);
  
  if (Math.abs(expectedTax - taxAmount) > tolerance) {
    errors.push(createError('TAX_005', 'tax_amount',
      `Tax mismatch: Expected ₹${expectedTax.toFixed(2)}, got ₹${taxAmount.toFixed(2)}`));
  }
  
  return errors;
}

// Invoice Number Validation
export function validateInvoiceNumber(invoiceNo: string | null | undefined): ValidationError | null {
  if (!invoiceNo || invoiceNo.trim() === '') {
    return createError('INV_001', 'invoice_number', 'Invoice number is required');
  }
  
  if (invoiceNo.length > 16) {
    return createWarning('INV_002', 'invoice_number', 'Invoice number exceeds 16 characters');
  }
  
  return null;
}

// Invoice Date Validation
export function validateInvoiceDate(date: Date | string | null | undefined): ValidationError | null {
  if (!date) {
    return createError('INV_003', 'invoice_date', 'Invoice date is required');
  }
  
  const invoiceDate = new Date(date);
  const today = new Date();
  
  if (invoiceDate > today) {
    return createWarning('INV_005', 'invoice_date', 'Invoice date cannot be in the future');
  }
  
  return null;
}

// Invoice Interface
export interface Invoice {
  invoice_number?: string | null;
  invoice_date?: string | Date | null;
  customer_gstin?: string | null;
  place_of_supply?: string | null;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  cess_amount?: number;
  total_amount?: number;
  rate?: number;
}

// Full Invoice Validation
export function validateInvoice(invoice: Invoice): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];
  
  // Invoice number
  const invoiceNoError = validateInvoiceNumber(invoice.invoice_number);
  if (invoiceNoError) {
    if (invoiceNoError.severity === 'error') errors.push(invoiceNoError);
    else warnings.push(invoiceNoError);
  }
  
  // Invoice date
  const dateError = validateInvoiceDate(invoice.invoice_date);
  if (dateError) {
    if (dateError.severity === 'error') errors.push(dateError);
    else warnings.push(dateError);
  }
  
  // GSTIN
  const gstinError = validateGSTIN(invoice.customer_gstin);
  if (gstinError) {
    if (gstinError.severity === 'error') errors.push(gstinError);
    else warnings.push(gstinError);
  }
  
  // Place of Supply
  const posError = validatePlaceOfSupply(invoice.place_of_supply);
  if (posError) {
    if (posError.severity === 'error') errors.push(posError);
    else warnings.push(posError);
  }
  
  // Tax calculations
  const taxErrors = validateTaxCalculation(
    invoice.taxable_value || 0,
    invoice.cgst_amount || 0,
    invoice.sgst_amount || 0,
    invoice.igst_amount || 0,
    invoice.cess_amount || 0,
    invoice.total_amount || 0
  );
  errors.push(...taxErrors);
  
  // Tax rate
  if (invoice.rate && invoice.taxable_value && invoice.igst_amount !== undefined) {
    const rateErrors = validateTaxRate(
      invoice.taxable_value,
      invoice.rate,
      invoice.igst_amount || invoice.cgst_amount || 0
    );
    rateErrors.forEach(e => {
      if (e.severity === 'error') errors.push(e);
      else warnings.push(e);
    });
  }
  
  // Determine status
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  
  return {
    status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'passed',
    errors,
    warnings,
    info,
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    totalInfo: info.length,
  };
}

// Duplicate Invoice Detection
interface InvoiceKey {
  invoiceNumber: string;
  gstin: string;
}

export function findDuplicateInvoices(invoices: Invoice[]): { 
  duplicates: InvoiceKey[]; 
  originalIndices: number[]; 
  duplicateIndices: number[] 
} {
  const seen = new Map<string, number>();
  const duplicates: InvoiceKey[] = [];
  const originalIndices: number[] = [];
  const duplicateIndices: number[] = [];
  
  invoices.forEach((invoice, index) => {
    const invoiceNumber = (invoice.invoice_number || '').toUpperCase().trim();
    const gstin = (invoice.customer_gstin || '').toUpperCase().trim();
    
    const key = `${invoiceNumber}|${gstin}`;
    
    if (seen.has(key)) {
      duplicates.push({ invoiceNumber, gstin });
      originalIndices.push(seen.get(key)!);
      duplicateIndices.push(index);
    } else {
      seen.set(key, index);
    }
  });
  
  return { duplicates, originalIndices, duplicateIndices };
}

export function validateForDuplicates(invoices: Invoice[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { duplicates, originalIndices, duplicateIndices } = findDuplicateInvoices(invoices);
  
  duplicates.forEach((dup, idx) => {
    errors.push(createError('INV_007', 'invoice_number',
      `Duplicate: "${dup.invoiceNumber}" with GSTIN "${dup.gstin}" at rows ${originalIndices[idx] + 1} and ${duplicateIndices[idx] + 1}`));
  });
  
  return errors;
}

// Helper functions
function createError(ruleId: string, field: string, message: string): ValidationError {
  return { ruleId, field, message, severity: 'error' };
}

function createWarning(ruleId: string, field: string, message: string): ValidationError {
  return { ruleId, field, message, severity: 'warning' };
}

function createInfo(ruleId: string, field: string, message: string): ValidationError {
  return { ruleId, field, message, severity: 'info' };
}

// Export summary
export const VALIDATION_SUMMARY = {
  totalRules: VALIDATION_RULES.length,
  byCategory: {
    gstin: VALIDATION_RULES.filter(r => r.category === 'gstin').length,
    invoice: VALIDATION_RULES.filter(r => r.category === 'invoice').length,
    tax: VALIDATION_RULES.filter(r => r.category === 'tax').length,
    hsn: VALIDATION_RULES.filter(r => r.category === 'hsn').length,
    return_period: VALIDATION_RULES.filter(r => r.category === 'return_period').length,
    gstr1: VALIDATION_RULES.filter(r => r.category === 'gstr1').length,
    gstr3b: VALIDATION_RULES.filter(r => r.category === 'gstr3b').length,
  },
  bySeverity: {
    error: VALIDATION_RULES.filter(r => r.severity === 'error').length,
    warning: VALIDATION_RULES.filter(r => r.severity === 'warning').length,
    info: VALIDATION_RULES.filter(r => r.severity === 'info').length,
  },
};
