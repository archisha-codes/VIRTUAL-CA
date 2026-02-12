#!/usr/bin/env python
"""Verify GSTR-1 Excel export works correctly."""

from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel, B2B_COLUMNS, B2CL_COLUMNS, B2CS_COLUMNS, EXP_COLUMNS, CDNR_COLUMNS, CDNUR_COLUMNS, HSN_COLUMNS, DOCS_COLUMNS

# Sample clean data for testing
sample_clean_data = [
    # B2B invoice
    {
        "gstin": "08AACCE0560A1ZB",
        "customer_name": "Test Customer",
        "invoice_number": "INV-001",
        "invoice_date": "2025-12-15",
        "invoice_value": 118000,
        "place_of_supply": "08",  # Rajasthan
        "taxable_value": 100000,
        "rate": 18,
        "cgst": 9000,
        "sgst": 9000,
        "igst": 0,
        "cess": 0,
    },
    # B2CL invoice (>2.5L inter-state)
    {
        "invoice_number": "INV-002",
        "invoice_date": "2025-12-16",
        "invoice_value": 300000,
        "place_of_supply": "27",  # Maharashtra (inter-state)
        "taxable_value": 300000,
        "rate": 18,
        "igst": 54000,
        "cess": 0,
    },
    # B2CS entry
    {
        "invoice_date": "2025-12-17",
        "invoice_value": 5000,
        "place_of_supply": "07",  # Delhi (inter-state)
        "taxable_value": 5000,
        "rate": 18,
        "igst": 900,
    },
    # Export invoice
    {
        "invoice_number": "EXP-001",
        "invoice_date": "2025-12-18",
        "invoice_value": 100000,
        "place_of_supply": "96",  # Outside India
        "taxable_value": 100000,
        "rate": 0,  # Export without payment
        "is_export_without_gst": True,
    },
]

def test_export():
    """Test GSTR-1 Excel export."""
    print("Testing GSTR-1 Excel Export...")
    print(f"Return Period: 122025")
    print(f"Taxpayer GSTIN: 08AACCE0560A1ZB")
    print(f"Taxpayer Name: Test Taxpayer")
    print(f"\nSample clean_data: {len(sample_clean_data)} records")
    
    # Generate Excel
    excel_bytes = export_gstr1_excel(
        sample_clean_data,
        return_period="122025",
        taxpayer_gstin="08AACCE0560A1ZB",
        taxpayer_name="Test Taxpayer",
    )
    
    print(f"\nGenerated Excel: {len(excel_bytes)} bytes")
    
    # Save to file for inspection
    with open("test_gstr1_output.xlsx", "wb") as f:
        f.write(excel_bytes)
    print("Saved to test_gstr1_output.xlsx")
    
    # Print column headers for each sheet
    print("\n=== GSTR-1 Excel Column Headers ===")
    print(f"B2B ({len(B2B_COLUMNS)} columns): {B2B_COLUMNS}")
    print(f"\nB2CL ({len(B2CL_COLUMNS)} columns): {B2CL_COLUMNS}")
    print(f"\nB2CS ({len(B2CS_COLUMNS)} columns): {B2CS_COLUMNS}")
    print(f"\nEXP ({len(EXP_COLUMNS)} columns): {EXP_COLUMNS}")
    print(f"\nCDNR ({len(CDNR_COLUMNS)} columns): {CDNR_COLUMNS}")
    print(f"\nCDNUR ({len(CDNUR_COLUMNS)} columns): {CDNUR_COLUMNS}")
    print(f"\nHSN ({len(HSN_COLUMNS)} columns): {HSN_COLUMNS}")
    print(f"\nDOCS ({len(DOCS_COLUMNS)} columns): {DOCS_COLUMNS}")
    
    print("\n✅ GSTR-1 Excel export test completed successfully!")

if __name__ == "__main__":
    test_export()
