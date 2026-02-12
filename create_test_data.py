"""Create test GSTR-1 Excel file with sample data covering all categories."""

import pandas as pd
from datetime import datetime, timedelta
import os
import random
import string

def generate_valid_gstin(state_code: str = "07"):
    """Generate a valid GSTIN with correct checksum.
    
    GSTIN format: 2 digits (state) + 5 letters + 4 digits + 1 letter + 1 digit + Z + 1 digit (checksum) = 15 chars
    """
    
    prefix = state_code
    letters = ''.join(random.choices(string.ascii_uppercase, k=5))
    numbers = ''.join(random.choices(string.digits, k=4))
    letter = random.choice(string.ascii_uppercase)
    digit = random.choice(string.digits)
    z_placeholder = 'Z'
    
    partial = prefix + letters + numbers + letter + digit + z_placeholder
    
    # Calculate checksum
    numeric = []
    for char in partial:
        if char.isdigit():
            numeric.append(int(char))
        else:
            numeric.append(ord(char) - ord('A') + 10)
    
    total = sum((numeric[i] * (i + 1)) for i in range(14))
    check_digit = total % 36
    
    if check_digit < 10:
        check_char = str(check_digit)
    else:
        check_char = chr(ord('A') + check_digit - 10)
    
    return partial + check_char


def create_test_gstr1_excel():
    """Create test Excel file with sample data for B2B, B2CL, B2CS, and EXP categories."""
    
    base_date = datetime.now()
    
    # Generate valid GSTINs
    gstin_1 = generate_valid_gstin("07")  # Delhi
    gstin_2 = generate_valid_gstin("27")  # Maharashtra
    
    print(f"Generated GSTINs:")
    print(f"  Delhi: {gstin_1}")
    print(f"  Maharashtra: {gstin_2}")
    
    # B2B sheet - Inter-state and Intra-state
    b2b_data = [
        # Summary rows (will be skipped)
        {"GSTIN/UIN of Recipient": "Summary", "Invoice Number": "", "Invoice date": "", 
         "Invoice Value": "", "Place Of Supply": "", "Reverse Charge": "", 
         "Invoice Type": "", "E-Commerce GSTIN": "", "Rate": "", 
         "Taxable Value": "", "Integrated Tax Amount": "", "Central Tax Amount": "", "State/UT Tax Amount": "", "Cess Amount": ""},
        {"GSTIN/UIN of Recipient": "", "Invoice Number": "", "Invoice date": "", 
         "Invoice Value": "", "Place Of Supply": "", "Reverse Charge": "", 
         "Invoice Type": "", "E-Commerce GSTIN": "", "Rate": "", 
         "Taxable Value": "", "Integrated Tax Amount": "", "Central Tax Amount": "", "State/UT Tax Amount": "", "Cess Amount": ""},
        # Header row
        {"GSTIN/UIN of Recipient": "GSTIN/UIN of Recipient", "Invoice Number": "Invoice Number", 
         "Invoice date": "Invoice date", "Invoice Value": "Invoice Value", 
         "Place Of Supply": "Place Of Supply", "Reverse Charge": "Reverse Charge", 
         "Invoice Type": "Invoice Type", "E-Commerce GSTIN": "E-Commerce GSTIN", 
         "Rate": "Rate", "Taxable Value": "Taxable Value", 
         "Integrated Tax Amount": "Integrated Tax Amount", "Central Tax Amount": "Central Tax Amount", 
         "State/UT Tax Amount": "State/UT Tax Amount", "Cess Amount": "Cess Amount"},
        # Data rows
        {"GSTIN/UIN of Recipient": gstin_1, "Invoice Number": "B2B-001", 
         "Invoice date": base_date.strftime("%d/%m/%Y"), "Invoice Value": 100000, 
         "Place Of Supply": "07-Delhi", "Reverse Charge": "N", 
         "Invoice Type": "Regular B2B", "E-Commerce GSTIN": "", 
         "Rate": 18, "Taxable Value": 100000, 
         "Integrated Tax Amount": 0, "Central Tax Amount": 9000, 
         "State/UT Tax Amount": 9000, "Cess Amount": 0},
        {"GSTIN/UIN of Recipient": gstin_2, "Invoice Number": "B2B-002", 
         "Invoice date": base_date.strftime("%d/%m/%Y"), "Invoice Value": 150000, 
         "Place Of Supply": "27-Maharashtra", "Reverse Charge": "N", 
         "Invoice Type": "Regular B2B", "E-Commerce GSTIN": "", 
         "Rate": 12, "Taxable Value": 150000, 
         "Integrated Tax Amount": 18000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0},
    ]
    
    # B2CL sheet - Inter-state invoices > 2.5L
    b2cl_data = [
        {"Invoice Number": "", "Invoice date": "", "Invoice Value": "", 
         "Place Of Supply": "", "Rate": "", "Taxable Value": "", 
         "Integrated Tax Amount": "", "Central Tax Amount": "", "State/UT Tax Amount": "", 
         "Cess Amount": "", "Customer Name": "", "GSTIN": ""},
        {"Invoice Number": "", "Invoice date": "", "Invoice Value": "", 
         "Place Of Supply": "", "Rate": "", "Taxable Value": "", 
         "Integrated Tax Amount": "", "Central Tax Amount": "", "State/UT Tax Amount": "", 
         "Cess Amount": "", "Customer Name": "", "GSTIN": ""},
        {"Invoice Number": "Invoice Number", "Invoice date": "Invoice date", 
         "Invoice Value": "Invoice Value", "Place Of Supply": "Place Of Supply", 
         "Rate": "Rate", "Taxable Value": "Taxable Value", 
         "Integrated Tax Amount": "Integrated Tax Amount", "Central Tax Amount": "Central Tax Amount", 
         "State/UT Tax Amount": "State/UT Tax Amount", "Cess Amount": "Cess Amount", 
         "Customer Name": "Customer Name", "GSTIN": "GSTIN"},
        {"Invoice Number": "B2CL-001", "Invoice date": base_date.strftime("%d/%m/%Y"), 
         "Invoice Value": 300000, "Place Of Supply": "27-Maharashtra", 
         "Rate": 18, "Taxable Value": 300000, 
         "Integrated Tax Amount": 54000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0, 
         "Customer Name": "Customer A", "GSTIN": "NA"},
        {"Invoice Number": "B2CL-002", "Invoice date": base_date.strftime("%d/%m/%Y"), 
         "Invoice Value": 500000, "Place Of Supply": "19-West Bengal", 
         "Rate": 12, "Taxable Value": 500000, 
         "Integrated Tax Amount": 60000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0, 
         "Customer Name": "Customer B", "GSTIN": ""},
    ]
    
    # B2CS sheet - Unregistered invoices (summary format with invoice date)
    # Note: B2CS uses a different format - one row per rate/pos combination
    b2cs_data = [
        {"Type": "", "Place Of Supply": "", "Invoice date": "", "Rate": "", 
         "Taxable Value": "", "Integrated Tax Amount": "", 
         "Central Tax Amount": "", "State/UT Tax Amount": "", 
         "Cess Amount": "", "E-Commerce GSTIN": ""},
        {"Type": "", "Place Of Supply": "", "Invoice date": "", "Rate": "", 
         "Taxable Value": "", "Integrated Tax Amount": "", 
         "Central Tax Amount": "", "State/UT Tax Amount": "", 
         "Cess Amount": "", "E-Commerce GSTIN": ""},
        {"Type": "Type", "Place Of Supply": "Place Of Supply", "Invoice date": "Invoice date",
         "Rate": "Rate", "Taxable Value": "Taxable Value", 
         "Integrated Tax Amount": "Integrated Tax Amount", "Central Tax Amount": "Central Tax Amount", 
         "State/UT Tax Amount": "State/UT Tax Amount", "Cess Amount": "Cess Amount", 
         "E-Commerce GSTIN": "E-Commerce GSTIN"},
        # Inter-state B2CS (Maharashtra - company is Delhi)
        {"Type": "OE", "Place Of Supply": "27-Maharashtra", "Invoice date": base_date.strftime("%d/%m/%Y"),
         "Rate": 18, "Taxable Value": 50000, 
         "Integrated Tax Amount": 9000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0, 
         "E-Commerce GSTIN": ""},
        # Intra-state B2CS (Delhi)
        {"Type": "OE", "Place Of Supply": "07-Delhi", "Invoice date": base_date.strftime("%d/%m/%Y"),
         "Rate": 5, "Taxable Value": 20000, 
         "Integrated Tax Amount": 0, "Central Tax Amount": 500, 
         "State/UT Tax Amount": 500, "Cess Amount": 0, 
         "E-Commerce GSTIN": ""},
    ]
    
    # Export sheet
    exp_data = [
        {"Invoice Number": "", "Invoice date": "", "Invoice Value": "", 
         "Rate": "", "Taxable Value": "", "Integrated Tax Amount": "", 
         "Central Tax Amount": "", "State/UT Tax Amount": "", "Cess Amount": "", 
         "Shipping Bill Number": "", "Shipping Bill Date": "", "Port Code": ""},
        {"Invoice Number": "", "Invoice date": "", "Invoice Value": "", 
         "Rate": "", "Taxable Value": "", "Integrated Tax Amount": "", 
         "Central Tax Amount": "", "State/UT Tax Amount": "", "Cess Amount": "", 
         "Shipping Bill Number": "", "Shipping Bill Date": "", "Port Code": ""},
        {"Invoice Number": "Invoice Number", "Invoice date": "Invoice date", 
         "Invoice Value": "Invoice Value", "Rate": "Rate", 
         "Taxable Value": "Taxable Value", "Integrated Tax Amount": "Integrated Tax Amount", 
         "Central Tax Amount": "Central Tax Amount", "State/UT Tax Amount": "State/UT Tax Amount", 
         "Cess Amount": "Cess Amount", "Shipping Bill Number": "Shipping Bill Number", 
         "Shipping Bill Date": "Shipping Bill Date", "Port Code": "Port Code"},
        {"Invoice Number": "EXP-001", "Invoice date": base_date.strftime("%d/%m/%Y"), 
         "Invoice Value": 250000, "Rate": 18, "Taxable Value": 250000, 
         "Integrated Tax Amount": 45000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0, 
         "Shipping Bill Number": "SB001", "Shipping Bill Date": base_date.strftime("%d/%m/%Y"), 
         "Port Code": "INNSA"},
        {"Invoice Number": "EXP-002", "Invoice date": base_date.strftime("%d/%m/%Y"), 
         "Invoice Value": 100000, "Rate": 12, "Taxable Value": 100000, 
         "Integrated Tax Amount": 12000, "Central Tax Amount": 0, 
         "State/UT Tax Amount": 0, "Cess Amount": 0, 
         "Shipping Bill Number": "SB002", "Shipping Bill Date": base_date.strftime("%d/%m/%Y"), 
         "Port Code": "INMAA"},
    ]
    
    # Create Excel file with multiple sheets
    with pd.ExcelWriter('test_gstr1_data.xlsx', engine='openpyxl') as writer:
        pd.DataFrame(b2b_data).to_excel(writer, sheet_name='B2B', index=False, header=False)
        pd.DataFrame(b2cl_data).to_excel(writer, sheet_name='B2CL', index=False, header=False)
        pd.DataFrame(b2cs_data).to_excel(writer, sheet_name='B2CS', index=False, header=False)
        pd.DataFrame(exp_data).to_excel(writer, sheet_name='Export', index=False, header=False)
    
    print("\nCreated test_gstr1_data.xlsx with sample data")
    print("B2B: 2 invoices (1 intra-state, 1 inter-state)")
    print("B2CL: 2 invoices (inter-state > 2.5L)")
    print("B2CS: 2 invoices (unregistered)")
    print("Export: 2 invoices")

if __name__ == "__main__":
    create_test_gstr1_excel()
