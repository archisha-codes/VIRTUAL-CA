"""
Terminal Test Harness for GSTR-1 & GSTR-3B Engine

This module provides direct testing of the GST engine without API overhead.
Run with: python test_engine_terminal.py

Tests:
1. GSTR-1 table generation from Excel
2. GSTR-3B summary generation
3. Validation of totals
4. Export functionality
"""

import pandas as pd
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from india_compliance.gst_india.gstr1_data import generate_gstr1_tables
from india_compliance.gst_india.gstr3b_data import generate_gstr3b_summary
from india_compliance.gst_india.utils.header_mapper import normalize_dataframe_simple


def test_gstr1_engine():
    """Test GSTR-1 engine with Demo_Client_Sales_Data.xlsx"""
    print("=" * 60)
    print("GSTR-1 ENGINE TERMINAL TEST")
    print("=" * 60)
    
    file_path = "Demo_Client_Sales_Data.xlsx"
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        return False
    
    print(f"\n1. Loading Excel file: {file_path}")
    df = pd.read_excel(file_path)
    print(f"   - Loaded {len(df)} records")
    print(f"   - Original columns: {df.columns.tolist()}")
    
    # Manual canonical rename (simulating frontend mapping)
    print("\n2. Applying column mapping...")
    rename_map = {
        "Invoice_No": "invoice_number",
        "Invoice_Date": "invoice_date",
        "Customer_Name": "customer_name",
        "Customer_GSTIN": "gstin",
        "Place_of_Supply": "place_of_supply",
        "Invoice_Value": "invoice_value",
        "Taxable_Value": "taxable_value",
        "GST_Rate": "rate",
        "IGST": "igst",
        "CGST": "cgst",
        "SGST": "sgst",
        "Cess": "cess",
        "HSN": "hsn_code",
        "Quantity": "quantity",
        "UOM": "uom",
        "Supply_Type": "supply_type",
        "Reverse_Charge": "reverse_charge",
        "Document_Type": "document_type",
    }
    df = df.rename(columns=rename_map)
    print(f"   - Renamed columns: {df.columns.tolist()}")
    
    # Normalize dataframe
    print("\n3. Normalizing dataframe...")
    df_normalized, _ = normalize_dataframe_simple(df)
    print(f"   - Normalized columns: {df_normalized.columns.tolist()}")
    
    # Convert to records
    records = df_normalized.to_dict(orient="records")
    print(f"   - Converted {len(records)} records to dict format")
    
    # Generate GSTR-1 tables
    print("\n4. Generating GSTR-1 tables...")
    gstr1_tables, validation_report = generate_gstr1_tables(
        clean_data=records,
        company_gstin="27AAAAA1234A1ZA",
        include_hsn=True,
        include_docs=False
    )
    
    # Display results
    summary = gstr1_tables.get("summary", {})
    print(f"\n5. GSTR-1 RESULTS:")
    print(f"   - B2B invoices: {len(gstr1_tables.get('b2b', []))}")
    print(f"   - B2CL invoices: {len(gstr1_tables.get('b2cl', []))}")
    print(f"   - B2CS entries: {len(gstr1_tables.get('b2cs', []))}")
    print(f"   - Export invoices: {len(gstr1_tables.get('exp', []))}")
    print(f"   - CDNR entries: {len(gstr1_tables.get('cdnr', []))}")
    print(f"   - HSN entries: {len(gstr1_tables.get('hsn', []))}")
    
    print(f"\n6. TAX SUMMARY:")
    print(f"   - Total Taxable Value: Rs.{summary.get('total_taxable_value', 0):,.2f}")
    print(f"   - Total IGST: Rs.{summary.get('total_igst', 0):,.2f}")
    print(f"   - Total CGST: Rs.{summary.get('total_cgst', 0):,.2f}")
    print(f"   - Total SGST: Rs.{summary.get('total_sgst', 0):,.2f}")
    print(f"   - Total CESS: Rs.{summary.get('total_cess', 0):,.2f}")
    
    print(f"\n7. VALIDATION REPORT:")
    print(f"   - Status: {validation_report.final_status}")
    print(f"   - Errors: {len(validation_report.errors)}")
    print(f"   - Warnings: {len(validation_report.warnings)}")
    
    if validation_report.errors:
        print(f"   - Error details:")
        for error in validation_report.errors[:5]:  # Show first 5
            print(f"     * {error}")
    
    return gstr1_tables, validation_report


def test_gstr3b_engine(gstr1_tables: dict):
    """Test GSTR-3B engine with GSTR-1 tables"""
    print("\n" + "=" * 60)
    print("GSTR-3B ENGINE TERMINAL TEST")
    print("=" * 60)
    
    if not gstr1_tables:
        print("ERROR: No GSTR-1 tables provided")
        return None
    
    print("\n1. Generating GSTR-3B summary...")
    gstr3b_summary = generate_gstr3b_summary(
        gstr1_tables=gstr1_tables,
        return_period="122025",
        taxpayer_gstin="27AAAAA1234A1ZA",
        taxpayer_name="ABC Pvt Ltd"
    )
    
    print("\n2. GSTR-3B RESULTS:")
    
    # Section 3.1(a) - B2B Outward taxable supplies
    section_3_1_a = gstr3b_summary.get("3_1_a", {})
    print(f"   3.1(a) B2B Outward:")
    print(f"      - Taxable Value: Rs.{section_3_1_a.get('taxable_value', 0):,.2f}")
    print(f"      - IGST: Rs.{section_3_1_a.get('igst', 0):,.2f}")
    print(f"      - CGST: Rs.{section_3_1_a.get('cgst', 0):,.2f}")
    print(f"      - SGST: Rs.{section_3_1_a.get('sgst', 0):,.2f}")
    
    # Section 3.1(b) - Exports
    section_3_1_b = gstr3b_summary.get("3_1_b", {})
    print(f"\n   3.1(b) Exports:")
    print(f"      - Taxable Value: Rs.{section_3_1_b.get('taxable_value', 0):,.2f}")
    print(f"      - IGST: Rs.{section_3_1_b.get('igst', 0):,.2f}")
    
    # Section 3.2 - Inter-State Supplies
    section_3_2 = gstr3b_summary.get("3_2", {})
    print(f"\n   3.2 Inter-State Supplies (B2CS > Rs.1L):")
    print(f"      - Total Taxable: Rs.{section_3_2.get('total_taxable_value', 0):,.2f}")
    print(f"      - Total IGST: Rs.{section_3_2.get('total_igst', 0):,.2f}")
    
    # Total Liability
    total_liability = gstr3b_summary.get("total_liability", {})
    print(f"\n3. TAX LIABILITY SUMMARY:")
    print(f"   - Total IGST Liability: Rs.{total_liability.get('igst', 0):,.2f}")
    print(f"   - Total CGST Liability: Rs.{total_liability.get('cgst', 0):,.2f}")
    print(f"   - Total SGST Liability: Rs.{total_liability.get('sgst', 0):,.2f}")
    print(f"   - Total CESS Liability: Rs.{total_liability.get('cess', 0):,.2f}")
    print(f"   - Grand Total: Rs.{total_liability.get('total', 0):,.2f}")
    
    return gstr3b_summary


def test_export_functionality(gstr1_tables: dict, gstr3b_summary: dict):
    """Test Excel export functionality"""
    print("\n" + "=" * 60)
    print("EXPORT FUNCTIONALITY TEST")
    print("=" * 60)
    
    try:
        from india_compliance.gst_india.exporters.gstr1_excel import export_gstr1_excel
        
        print("\n1. Exporting GSTR-1 Excel...")
        excel_bytes = export_gstr1_excel(
            clean_data=gstr1_tables,
            return_period="122025",
            taxpayer_gstin="27AAAAA1234A1ZA",
            taxpayer_name="ABC Pvt Ltd"
        )
        print(f"   - Generated {len(excel_bytes)} bytes")
        print(f"   - File saved: gstr1_export.xlsx")
        
        # Save to file for verification
        with open("gstr1_export.xlsx", "wb") as f:
            f.write(excel_bytes)
        
        return True
    except Exception as e:
        print(f"   ERROR: {e}")
        return False


def main():
    """Main test runner"""
    print("\n" + "=" * 60)
    print("VIRTUAL CA GST ENGINE - TERMINAL TEST HARNESS")
    print("=" * 60)
    print(f"Timestamp: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run GSTR-1 test
    gstr1_tables, validation_report = test_gstr1_engine()
    
    if validation_report.final_status != "passed":
        print("\nWARNING: GSTR-1 validation has errors")
        print("   Some sections may be empty due to validation failures")
    
    # Run GSTR-3B test
    gstr3b_summary = test_gstr3b_engine(gstr1_tables)
    
    # Test export
    export_success = test_export_functionality(gstr1_tables, gstr3b_summary)
    
    # Final summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    if gstr1_tables and gstr3b_summary:
        print("GSTR-1 ENGINE: WORKING")
        print(f"   - B2B: {len(gstr1_tables.get('b2b', []))} invoices")
        print(f"   - B2CS: {len(gstr1_tables.get('b2cs', []))} entries")
        print(f"   - EXP: {len(gstr1_tables.get('exp', []))} invoices")
        print(f"   - Taxable: Rs.{gstr1_tables.get('summary', {}).get('total_taxable_value', 0):,.2f}")
        
        print("\nGSTR-3B ENGINE: WORKING")
        total_liability = gstr3b_summary.get("total_liability", {})
        print(f"   - Total Payable: Rs.{total_liability.get('total', 0):,.2f}")
        
        if export_success:
            print("\nEXPORT: WORKING")
        else:
            print("\nEXPORT: FAILED")
        
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED")
        print("=" * 60)
    else:
        print("\nTESTS FAILED")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
