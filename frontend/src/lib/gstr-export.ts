import * as XLSX from 'xlsx';
import type { GSTR3BData, OutwardSupplies, EligibleITC } from '@/hooks/useGSTR3BData';

// ============================================
// GSTR-3B Export Functions
// ============================================

interface GSTR3BJsonFormat {
  gstin: string;
  ret_period: string;
  sup_details: {
    osup_det: { txval: number; iamt: number; camt: number; samt: number; csamt: number };
    osup_zero: { txval: number; iamt: number; camt: number; samt: number; csamt: number };
    osup_nil_exmp: { txval: number; iamt: number; camt: number; samt: number; csamt: number };
    isup_rev: { txval: number; iamt: number; camt: number; samt: number; csamt: number };
    osup_nongst: { txval: number };
  };
  itc_elg: {
    itc_avl: Array<{ ty: string; iamt: number; camt: number; samt: number; csamt: number }>;
    itc_rev: Array<{ ty: string; iamt: number; camt: number; samt: number; csamt: number }>;
    itc_net: { iamt: number; camt: number; samt: number; csamt: number };
    itc_inelg: Array<{ ty: string; iamt: number; camt: number; samt: number; csamt: number }>;
  };
  inward_sup: {
    isup_details: Array<{ ty: string; inter: number; intra: number }>;
  };
  intr_ltfee: {
    intr_details: { iamt: number; camt: number; samt: number; csamt: number };
    ltfee_details: { iamt: number; camt: number; samt: number; csamt: number };
  };
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

export function exportGSTR3BToJson(
  data: GSTR3BData,
  gstin: string,
  period: string
): string {
  const jsonData: GSTR3BJsonFormat = {
    gstin: gstin || 'XXXXXXXXXXXXXXXXX',
    ret_period: period || formatReturnPeriod(new Date()),
    sup_details: {
      osup_det: {
        txval: roundToTwo(data.outwardSupplies.taxableSupplies.taxableValue),
        iamt: roundToTwo(data.outwardSupplies.taxableSupplies.igst),
        camt: roundToTwo(data.outwardSupplies.taxableSupplies.cgst),
        samt: roundToTwo(data.outwardSupplies.taxableSupplies.sgst),
        csamt: roundToTwo(data.outwardSupplies.taxableSupplies.cess),
      },
      osup_zero: {
        txval: roundToTwo(data.outwardSupplies.zeroRatedSupplies.taxableValue),
        iamt: roundToTwo(data.outwardSupplies.zeroRatedSupplies.igst),
        camt: roundToTwo(data.outwardSupplies.zeroRatedSupplies.cgst),
        samt: roundToTwo(data.outwardSupplies.zeroRatedSupplies.sgst),
        csamt: roundToTwo(data.outwardSupplies.zeroRatedSupplies.cess),
      },
      osup_nil_exmp: {
        txval: roundToTwo(data.outwardSupplies.nilRatedSupplies.taxableValue),
        iamt: roundToTwo(data.outwardSupplies.nilRatedSupplies.igst),
        camt: roundToTwo(data.outwardSupplies.nilRatedSupplies.cgst),
        samt: roundToTwo(data.outwardSupplies.nilRatedSupplies.sgst),
        csamt: roundToTwo(data.outwardSupplies.nilRatedSupplies.cess),
      },
      isup_rev: {
        txval: roundToTwo(data.outwardSupplies.reverseChargeSupplies.taxableValue),
        iamt: roundToTwo(data.outwardSupplies.reverseChargeSupplies.igst),
        camt: roundToTwo(data.outwardSupplies.reverseChargeSupplies.cgst),
        samt: roundToTwo(data.outwardSupplies.reverseChargeSupplies.sgst),
        csamt: roundToTwo(data.outwardSupplies.reverseChargeSupplies.cess),
      },
      osup_nongst: {
        txval: roundToTwo(data.outwardSupplies.nonGstSupplies.taxableValue),
      },
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
        {
          ty: 'IMPS',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
        {
          ty: 'ISRC',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
        {
          ty: 'ISD',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
        {
          ty: 'OTH',
          iamt: roundToTwo(data.eligibleItc.itcAvailable.igst),
          camt: roundToTwo(data.eligibleItc.itcAvailable.cgst),
          samt: roundToTwo(data.eligibleItc.itcAvailable.sgst),
          csamt: roundToTwo(data.eligibleItc.itcAvailable.cess),
        },
      ],
      itc_rev: [
        {
          ty: 'RUL',
          iamt: roundToTwo(data.eligibleItc.itcReversed.igst),
          camt: roundToTwo(data.eligibleItc.itcReversed.cgst),
          samt: roundToTwo(data.eligibleItc.itcReversed.sgst),
          csamt: roundToTwo(data.eligibleItc.itcReversed.cess),
        },
        {
          ty: 'OTH',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
      ],
      itc_net: {
        iamt: roundToTwo(data.eligibleItc.netItc.igst),
        camt: roundToTwo(data.eligibleItc.netItc.cgst),
        samt: roundToTwo(data.eligibleItc.netItc.sgst),
        csamt: roundToTwo(data.eligibleItc.netItc.cess),
      },
      itc_inelg: [
        {
          ty: 'RUL',
          iamt: roundToTwo(data.eligibleItc.ineligibleItc.igst),
          camt: roundToTwo(data.eligibleItc.ineligibleItc.cgst),
          samt: roundToTwo(data.eligibleItc.ineligibleItc.sgst),
          csamt: roundToTwo(data.eligibleItc.ineligibleItc.cess),
        },
        {
          ty: 'OTH',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
      ],
    },
    inward_sup: {
      isup_details: [
        { ty: 'GST', inter: 0, intra: 0 },
        { ty: 'NONGST', inter: 0, intra: 0 },
      ],
    },
    intr_ltfee: {
      intr_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ltfee_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    },
  };

  return JSON.stringify(jsonData, null, 2);
}

export function exportGSTR3BToExcel(
  data: GSTR3BData,
  gstin: string,
  period: string
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['GSTR-3B Summary Report'],
    ['GSTIN', gstin || 'Not Provided'],
    ['Return Period', period || formatReturnPeriod(new Date())],
    [''],
    ['Summary Statistics'],
    ['Total Invoices', data.summary.totalInvoices],
    ['Validated Invoices', data.summary.validatedInvoices],
    ['Total Taxable Value', data.summary.totalTaxableValue],
    ['Total Tax', data.summary.totalTax],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: 3.1 Outward Supplies
  const outwardData = [
    ['3.1 Details of Outward Supplies and Inward Supplies liable to Reverse Charge'],
    [''],
    ['Nature of Supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST/UTGST', 'Cess'],
    [
      '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      data.outwardSupplies.taxableSupplies.taxableValue,
      data.outwardSupplies.taxableSupplies.igst,
      data.outwardSupplies.taxableSupplies.cgst,
      data.outwardSupplies.taxableSupplies.sgst,
      data.outwardSupplies.taxableSupplies.cess,
    ],
    [
      '(b) Outward taxable supplies (zero rated)',
      data.outwardSupplies.zeroRatedSupplies.taxableValue,
      data.outwardSupplies.zeroRatedSupplies.igst,
      data.outwardSupplies.zeroRatedSupplies.cgst,
      data.outwardSupplies.zeroRatedSupplies.sgst,
      data.outwardSupplies.zeroRatedSupplies.cess,
    ],
    [
      '(c) Other outward supplies (Nil rated, exempted)',
      data.outwardSupplies.nilRatedSupplies.taxableValue,
      data.outwardSupplies.nilRatedSupplies.igst,
      data.outwardSupplies.nilRatedSupplies.cgst,
      data.outwardSupplies.nilRatedSupplies.sgst,
      data.outwardSupplies.nilRatedSupplies.cess,
    ],
    [
      '(d) Inward supplies (liable to reverse charge)',
      data.outwardSupplies.reverseChargeSupplies.taxableValue,
      data.outwardSupplies.reverseChargeSupplies.igst,
      data.outwardSupplies.reverseChargeSupplies.cgst,
      data.outwardSupplies.reverseChargeSupplies.sgst,
      data.outwardSupplies.reverseChargeSupplies.cess,
    ],
    [
      '(e) Non-GST outward supplies',
      data.outwardSupplies.nonGstSupplies.taxableValue,
      '-',
      '-',
      '-',
      '-',
    ],
  ];
  const outwardSheet = XLSX.utils.aoa_to_sheet(outwardData);
  XLSX.utils.book_append_sheet(workbook, outwardSheet, '3.1 Outward Supplies');

  // Sheet 3: 4. Eligible ITC
  const itcData = [
    ['4. Eligible ITC'],
    [''],
    ['Details', 'IGST', 'CGST', 'SGST/UTGST', 'Cess'],
    [
      '(A) ITC Available (whether in full or part)',
      data.eligibleItc.itcAvailable.igst,
      data.eligibleItc.itcAvailable.cgst,
      data.eligibleItc.itcAvailable.sgst,
      data.eligibleItc.itcAvailable.cess,
    ],
    [
      '(B) ITC Reversed',
      data.eligibleItc.itcReversed.igst,
      data.eligibleItc.itcReversed.cgst,
      data.eligibleItc.itcReversed.sgst,
      data.eligibleItc.itcReversed.cess,
    ],
    [
      '(C) Net ITC Available (A) - (B)',
      data.eligibleItc.netItc.igst,
      data.eligibleItc.netItc.cgst,
      data.eligibleItc.netItc.sgst,
      data.eligibleItc.netItc.cess,
    ],
    [
      '(D) Ineligible ITC',
      data.eligibleItc.ineligibleItc.igst,
      data.eligibleItc.ineligibleItc.cgst,
      data.eligibleItc.ineligibleItc.sgst,
      data.eligibleItc.ineligibleItc.cess,
    ],
  ];
  const itcSheet = XLSX.utils.aoa_to_sheet(itcData);
  XLSX.utils.book_append_sheet(workbook, itcSheet, '4. Eligible ITC');

  // Sheet 4: 6. Tax Payable
  const taxData = [
    ['6. Payment of Tax'],
    [''],
    ['Description', 'IGST', 'CGST', 'SGST/UTGST', 'Cess'],
    [
      'Tax on outward supplies',
      data.taxPayable.onOutwardSupplies.igst,
      data.taxPayable.onOutwardSupplies.cgst,
      data.taxPayable.onOutwardSupplies.sgst,
      data.taxPayable.onOutwardSupplies.cess,
    ],
    [
      'Tax on reverse charge',
      data.taxPayable.onReverseCharge.igst,
      data.taxPayable.onReverseCharge.cgst,
      data.taxPayable.onReverseCharge.sgst,
      data.taxPayable.onReverseCharge.cess,
    ],
    [
      'Net Tax Payable (after ITC)',
      data.taxPayable.total.igst,
      data.taxPayable.total.cgst,
      data.taxPayable.total.sgst,
      data.taxPayable.total.cess,
    ],
  ];
  const taxSheet = XLSX.utils.aoa_to_sheet(taxData);
  XLSX.utils.book_append_sheet(workbook, taxSheet, '6. Tax Payable');

  return workbook;
}

function formatReturnPeriod(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${year}`;
}

export function downloadExcel(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

export function downloadJson(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// GSTR-1 Export Functions (Placeholder for Phase 2)
// ============================================

export interface GSTR1Data {
  b2b: Array<{
    customerGstin: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceValue: number;
    placeOfSupply: string;
    reverseCharge: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  }>;
  b2cl: Array<{
    placeOfSupply: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceValue: number;
    taxableValue: number;
    igst: number;
    cess: number;
  }>;
  b2cs: Array<{
    placeOfSupply: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    cess: number;
  }>;
  hsn: Array<{
    hsnCode: string;
    description: string;
    uqc: string;
    quantity: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  }>;
}

export function exportGSTR1ToJson(data: GSTR1Data, gstin: string, period: string): string {
  const jsonData = {
    gstin: gstin || 'XXXXXXXXXXXXXXXXX',
    fp: period || formatReturnPeriod(new Date()),
    b2b: data.b2b.map((inv) => ({
      ctin: inv.customerGstin,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate,
          val: inv.invoiceValue,
          pos: inv.placeOfSupply,
          rchrg: inv.reverseCharge,
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                iamt: inv.igst,
                camt: inv.cgst,
                samt: inv.sgst,
                csamt: inv.cess,
              },
            },
          ],
        },
      ],
    })),
    b2cl: data.b2cl.map((inv) => ({
      pos: inv.placeOfSupply,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate,
          val: inv.invoiceValue,
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                iamt: inv.igst,
                csamt: inv.cess,
              },
            },
          ],
        },
      ],
    })),
    b2cs: data.b2cs.map((item) => ({
      pos: item.placeOfSupply,
      typ: 'OE',
      txval: item.taxableValue,
      camt: item.cgst,
      samt: item.sgst,
      csamt: item.cess,
    })),
    hsn: {
      data: data.hsn.map((item) => ({
        hsn_sc: item.hsnCode,
        desc: item.description,
        uqc: item.uqc,
        qty: item.quantity,
        txval: item.taxableValue,
        iamt: item.igst,
        camt: item.cgst,
        samt: item.sgst,
        csamt: item.cess,
      })),
    },
  };

  return JSON.stringify(jsonData, null, 2);
}

export function exportGSTR1ToExcel(data: GSTR1Data, gstin: string, period: string): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: B2B
  const b2bData = [
    ['GSTR-1 B2B Invoices'],
    ['GSTIN', gstin || 'Not Provided'],
    ['Return Period', period || formatReturnPeriod(new Date())],
    [''],
    ['Customer GSTIN', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
    ...data.b2b.map((inv) => [
      inv.customerGstin,
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.invoiceValue,
      inv.placeOfSupply,
      inv.reverseCharge,
      inv.taxableValue,
      inv.igst,
      inv.cgst,
      inv.sgst,
      inv.cess,
    ]),
  ];
  const b2bSheet = XLSX.utils.aoa_to_sheet(b2bData);
  XLSX.utils.book_append_sheet(workbook, b2bSheet, 'B2B');

  // Sheet 2: B2CL
  const b2clData = [
    ['GSTR-1 B2CL Invoices (Large B2C > ₹2.5 Lakh)'],
    [''],
    ['Place of Supply', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Taxable Value', 'IGST', 'Cess'],
    ...data.b2cl.map((inv) => [
      inv.placeOfSupply,
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.invoiceValue,
      inv.taxableValue,
      inv.igst,
      inv.cess,
    ]),
  ];
  const b2clSheet = XLSX.utils.aoa_to_sheet(b2clData);
  XLSX.utils.book_append_sheet(workbook, b2clSheet, 'B2CL');

  // Sheet 3: B2CS
  const b2csData = [
    ['GSTR-1 B2CS Summary (State-wise)'],
    [''],
    ['Place of Supply', 'Taxable Value', 'CGST', 'SGST', 'Cess'],
    ...data.b2cs.map((item) => [
      item.placeOfSupply,
      item.taxableValue,
      item.cgst,
      item.sgst,
      item.cess,
    ]),
  ];
  const b2csSheet = XLSX.utils.aoa_to_sheet(b2csData);
  XLSX.utils.book_append_sheet(workbook, b2csSheet, 'B2CS');

  // Sheet 4: HSN Summary
  const hsnData = [
    ['GSTR-1 HSN Summary'],
    [''],
    ['HSN Code', 'Description', 'UQC', 'Quantity', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
    ...data.hsn.map((item) => [
      item.hsnCode,
      item.description,
      item.uqc,
      item.quantity,
      item.taxableValue,
      item.igst,
      item.cgst,
      item.sgst,
      item.cess,
    ]),
  ];
  const hsnSheet = XLSX.utils.aoa_to_sheet(hsnData);
  XLSX.utils.book_append_sheet(workbook, hsnSheet, 'HSN');

  return workbook;
}
