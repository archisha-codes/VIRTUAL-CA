from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Optional, List
from datetime import datetime


def parse_decimal(v) -> Decimal:
    if v is None or str(v).strip() == '':
        return Decimal('0.00')
    try:
        clean_str = str(v).replace(',', '').strip()
        return Decimal(clean_str).quantize(Decimal('0.00'), rounding=ROUND_HALF_EVEN)
    except Exception as exc:
        raise ValueError(f'Invalid decimal value: {v}') from exc


class InvoiceRecord(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    invoice_no: str = Field(alias='Invoice_No')
    invoice_date: datetime = Field(alias='Invoice_Date')
    customer_name: Optional[str] = Field(alias='Customer_Name', default=None)
    customer_gstin: Optional[str] = Field(alias='Customer_GSTIN', default=None)
    place_of_supply: str = Field(alias='Place_of_Supply')
    invoice_value: Decimal = Field(alias='Invoice_Value')
    taxable_value: Decimal = Field(alias='Taxable_Value')
    gst_rate: Decimal = Field(alias='GST_Rate')
    igst: Decimal = Field(alias='IGST', default=Decimal('0.00'))
    cgst: Decimal = Field(alias='CGST', default=Decimal('0.00'))
    sgst: Decimal = Field(alias='SGST', default=Decimal('0.00'))
    cess: Decimal = Field(alias='Cess', default=Decimal('0.00'))
    hsn: str = Field(alias='HSN', default='999999-MISSING')
    quantity: Decimal = Field(alias='Quantity', default=Decimal('0.00'))
    uom: str = Field(alias='UOM', default='OTH')
    supply_type: str = Field(alias='Supply_Type', default='Regular')
    reverse_charge: str = Field(alias='Reverse_Charge', default='N')
    document_type: str = Field(alias='Document_Type', default='Invoice')

    @field_validator('invoice_value', 'taxable_value', 'gst_rate', 'igst', 'cgst', 'sgst', 'cess', 'quantity', mode='before')
    @classmethod
    def sanitize_decimals(cls, v):
        return parse_decimal(v)

    @field_validator('customer_gstin', 'hsn', mode='before')
    @classmethod
    def sanitize_strings(cls, v):
        if v is None or str(v).strip() == '' or str(v).lower() == 'nan':
            return None
        return str(v).strip().upper()


BaseInvoiceModel = InvoiceRecord


__all__ = ['InvoiceRecord', 'BaseInvoiceModel', 'parse_decimal']