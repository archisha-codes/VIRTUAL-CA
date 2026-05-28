import pandas as pd
from typing import List, Dict, Any, Tuple
from decimal import Decimal
from pydantic import ValidationError
from io import BytesIO
from india_compliance.gst_india.domain.gstr1_models import InvoiceRecord


class ExcelIngestionAdapter:
    @staticmethod
    def process_file(file_content: bytes) -> Tuple[List[InvoiceRecord], List[Dict[str, Any]]]:
        df = pd.read_excel(BytesIO(file_content), dtype=str)
        df = df.fillna('')

        column_map = {
            'Invoice No': 'Invoice_No',
            'Invoice Number': 'Invoice_No',
            'Invoice_Date': 'Invoice_Date',
            'Invoice Date': 'Invoice_Date',
            'Customer Name': 'Customer_Name',
            'Customer GSTIN': 'Customer_GSTIN',
            'GSTIN': 'Customer_GSTIN',
            'Place of Supply': 'Place_of_Supply',
            'POS': 'Place_of_Supply',
            'Invoice Value': 'Invoice_Value',
            'Taxable Value': 'Taxable_Value',
            'GST Rate': 'GST_Rate',
            'Rate': 'GST_Rate',
            'IGST': 'IGST',
            'CGST': 'CGST',
            'SGST': 'SGST',
            'Cess': 'Cess',
            'HSN': 'HSN',
            'HSN Code': 'HSN',
            'Quantity': 'Quantity',
            'Qty': 'Quantity',
            'UOM': 'UOM',
            'Supply Type': 'Supply_Type',
            'Reverse Charge': 'Reverse_Charge',
            'Document Type': 'Document_Type',
        }

        df = df.rename(columns={k: v for k, v in column_map.items() if k in df.columns})

        records = df.to_dict('records')
        valid_invoices: List[InvoiceRecord] = []
        errors: List[Dict[str, Any]] = []

        for index, row in enumerate(records):
            try:
                invoice = InvoiceRecord(**row)
                valid_invoices.append(invoice)
            except ValidationError as e:
                errors.append({
                    'row': index + 2,
                    'raw_data': row,
                    'errors': e.errors(),
                })

        return valid_invoices, errors


__all__ = ['ExcelIngestionAdapter']