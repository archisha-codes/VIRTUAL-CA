/**
 * Custom Template Definitions
 * 
 * Common business format templates for GSTR-1 data import.
 */

// Common column variations used in custom templates
export const CUSTOM_TEMPLATE_COLUMNS = {
  invoice: [
    { key: 'invoice_number', label: 'Invoice Number', aliases: ['Invoice No', 'Inv #', 'Bill No', 'Reference No', 'Number'] },
    { key: 'invoice_date', label: 'Invoice Date', aliases: ['Date', 'Inv Date', 'Bill Date', 'Transaction Date'] },
    { key: 'customer_name', label: 'Customer Name', aliases: ['Customer', 'Buyer', 'Party', 'Client', 'Consignee', 'Name'] },
    { key: 'customer_gstin', label: 'GSTIN', aliases: ['GSTIN', 'GST No', 'Tax ID', 'Customer GST', 'GST Number'] },
    { key: 'customer_state', label: 'Customer State', aliases: ['State', 'Ship To State', 'Billing State'] },
    { key: 'place_of_supply', label: 'Place of Supply', aliases: ['POS', 'Place of Supply', 'Supply State'] },
    { key: 'invoice_value', label: 'Total Amount', aliases: ['Total', 'Grand Total', 'Invoice Value', 'Amount', 'Total Amount', 'Gross Amount'] },
    { key: 'taxable_value', label: 'Taxable Value', aliases: ['Taxable', 'Taxable Amount', 'Base Amount', 'Net Amount', 'Subtotal'] },
    { key: 'tax_rate', label: 'Tax Rate', aliases: ['Rate', 'GST Rate', 'Tax %', 'Percentage'] },
    { key: 'tax_amount', label: 'Tax Amount', aliases: ['Tax', 'GST Amount', 'Total Tax', 'Tax Payable'] },
  ],
  line_item: [
    { key: 'item_name', label: 'Item Name', aliases: ['Product', 'Description', 'Item', 'Particulars', 'Service'] },
    { key: 'hsn_code', label: 'HSN/SAC Code', aliases: ['HSN', 'SAC', 'HSN Code', 'SAC Code', 'Code'] },
    { key: 'quantity', label: 'Quantity', aliases: ['Qty', 'Nos', 'Units', 'Amount'] },
    { key: 'unit_price', label: 'Unit Price', aliases: ['Rate', 'Unit Rate', 'Price', 'Unit Price'] },
    { key: 'discount', label: 'Discount', aliases: ['Disc', 'Discount %', 'Discount Amount'] },
  ],
  tax_breakup: [
    { key: 'igst_rate', label: 'IGST Rate', aliases: ['IGST %', 'Integrated Tax Rate'] },
    { key: 'igst_amount', label: 'IGST Amount', aliases: ['IGST', 'Integrated Tax'] },
    { key: 'cgst_rate', label: 'CGST Rate', aliases: ['CGST %', 'Central Tax Rate'] },
    { key: 'cgst_amount', label: 'CGST Amount', aliases: ['CGST', 'Central Tax'] },
    { key: 'sgst_rate', label: 'SGST Rate', aliases: ['SGST %', 'State Tax Rate', 'UTGST Rate'] },
    { key: 'sgst_amount', label: 'SGST Amount', aliases: ['SGST', 'State Tax', 'UTGST'] },
    { key: 'cess_rate', label: 'Cess Rate', aliases: ['Cess %', 'Cess Rate'] },
    { key: 'cess_amount', label: 'Cess Amount', aliases: ['Cess', 'Cess Tax'] },
  ],
  export: [
    { key: 'shipping_bill_number', label: 'Shipping Bill No', aliases: ['SB No', 'Shipping Bill', 'Bill of Lading', 'Export Invoice'] },
    { key: 'shipping_bill_date', label: 'Shipping Bill Date', aliases: ['SB Date', 'Export Date'] },
    { key: 'port_code', label: 'Port Code', aliases: ['Port', 'Port of Export', 'ICD'] },
    { key: 'country', label: 'Country', aliases: ['Country of Export', 'Destination Country'] },
    { key: 'currency', label: 'Currency', aliases: ['Cur', 'Currency Code'] },
    { key: 'exchange_rate', label: 'Exchange Rate', aliases: ['Rate', 'Conversion Rate'] },
  ],
  credit_debit_note: [
    { key: 'note_type', label: 'Note Type', aliases: ['Type', 'CN/DN', 'Credit Debit', 'Note Type'] },
    { key: 'note_number', label: 'Note Number', aliases: ['CN No', 'DN No', 'Credit Note No', 'Debit Note No'] },
    { key: 'note_date', label: 'Note Date', aliases: ['CN Date', 'DN Date', 'Credit Note Date'] },
    { key: 'original_invoice', label: 'Original Invoice', aliases: ['Original Inv', 'Ref Invoice', 'Invoice Ref'] },
    { key: 'reason', label: 'Reason', aliases: ['Reason', 'Narration', 'Remarks', 'Note Reason'] },
  ],
};

// Predefined custom templates
export const CUSTOM_TEMPLATES = [
  {
    id: 'simple_sales',
    name: 'Simple Sales Register',
    description: 'Basic sales data with GST breakdown',
    columns: [
      'Invoice No',
      'Date',
      'Customer Name',
      'GSTIN',
      'Place of Supply',
      'Taxable Value',
      'IGST',
      'CGST',
      'SGST',
      'Total',
    ],
  },
  {
    id: 'detailed_sales',
    name: 'Detailed Sales Register',
    description: 'Complete sales data with line items',
    columns: [
      'Invoice No',
      'Date',
      'Customer Name',
      'GSTIN',
      'State',
      'Place of Supply',
      'HSN Code',
      'Quantity',
      'Unit Price',
      'Discount',
      'Taxable Value',
      'IGST Rate',
      'IGST Amount',
      'CGST Rate',
      'CGST Amount',
      'SGST Rate',
      'SGST Amount',
      'Total',
    ],
  },
  {
    id: 'accounting_software',
    name: 'Accounting Software Export',
    description: 'Common format from Tally, QuickBooks, etc.',
    columns: [
      'Voucher Number',
      'Voucher Date',
      'Party Name',
      'GSTIN/UIN',
      'Party State',
      'Place of Supply',
      'Voucher Type',
      'Voucher Value',
      'Taxable Value',
      'IGST',
      'CGST',
      'SGST',
      'Cess',
    ],
  },
  {
    id: 'erp_export',
    name: 'ERP System Export',
    description: 'SAP, Oracle, Microsoft Dynamics format',
    columns: [
      'Document ID',
      'Document Date',
      'Customer ID',
      'Customer Name',
      'Tax Registration Number',
      'Shipping Address - Country',
      'Shipping Address - State',
      'Tax Destination Region',
      'Material/Service Code',
      'Quantity',
      'Base Amount',
      'Tax Code',
      'Tax Rate',
      'Tax Amount',
      'Total Amount',
    ],
  },
  {
    id: 'eway_bill',
    name: 'E-Way Bill Format',
    description: 'Format compatible with E-Way Bill system',
    columns: [
      'Invoice Number',
      'Invoice Date',
      'Supplier GSTIN',
      'Supplier Name',
      'Supplier State',
      'Recipient GSTIN',
      'Recipient Name',
      'Recipient State',
      'Place of Delivery',
      'HSN Code',
      'Taxable Value',
      'IGST Rate',
      'IGST Amount',
      'CGST Rate',
      'CGST Amount',
      'SGST Rate',
      'SGST Amount',
      'Total Tax',
      'Total Value',
    ],
  },
];

// Auto-mapping suggestions based on common column names
export const CUSTOM_AUTO_MAPPING: Record<string, string[]> = {
  invoice_number: [
    'invoice', 'inv', 'bill', 'voucher', 'reference', 'doc', 'number', 'no', '#'
  ],
  invoice_date: [
    'date', 'dt', 'dated', 'time', 'created', 'transaction'
  ],
  customer_name: [
    'customer', 'buyer', 'party', 'client', 'consignee', 'recipient', 'name', 'person'
  ],
  customer_gstin: [
    'gstin', 'gst', 'tax', 'tin', 'vat', 'registration'
  ],
  place_of_supply: [
    'pos', 'place', 'supply', 'state', 'destination', 'delivery', 'ship'
  ],
  taxable_value: [
    'taxable', 'base', 'net', 'subtotal', 'amount'
  ],
  total_amount: [
    'total', 'grand', 'gross', 'invoice', 'value', 'payable'
  ],
  hsn_code: [
    'hsn', 'sac', 'code', 'classification', 'tariff'
  ],
};

// Template configuration
export const CUSTOM_TEMPLATE_CONFIG = {
  name: 'Custom Template',
  description: 'Flexible format for various business systems',
  version: '1.0',
  supported_sections: ['b2b', 'b2cl', 'b2cs', 'cdnr', 'exports'],
  max_file_size: 20 * 1024 * 1024, // 20MB
  allowed_extensions: ['.xlsx', '.xls', '.csv'],
};
