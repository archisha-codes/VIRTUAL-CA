"""
Pytest configuration and fixtures for GST compliance tests.
"""

import pytest
import pandas as pd
import io
from io import BytesIO


class ExcelFixtures:
    """Helper class to create Excel test fixtures."""

    @staticmethod
    def create_valid_b2b_sheet() -> pd.DataFrame:
        """Create a valid B2B data sheet."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH", "27AAECM3564C1Z3"],
            "Receiver Name": ["Customer A", "Customer B"],
            "Invoice Number": ["INV001", "INV002"],
            "Invoice date": ["15/01/2024", "16/01/2024"],
            "Invoice Value": [100000, 250000],
            "Place Of Supply": ["07-Delhi", "27-Maharashtra"],
            "Reverse Charge": ["N", "N"],
            "Applicable % of Tax Rate": [18, 18],
            "Invoice Type": ["Regular", "Regular"],
            "Taxable Value": [100000, 250000],
            "E-Commerce GSTIN": ["", ""],
            "Rate": [18, 18],
            "Integrated Tax Amount": [18000, 45000],
            "Central Tax Amount": [0, 0],
            "State/UT Tax Amount": [0, 0],
            "Cess Amount": [0, 0],
        })

    @staticmethod
    def create_valid_b2cl_sheet() -> pd.DataFrame:
        """Create a valid B2CL data sheet (inter-state B2C > ₹2.5 lakh)."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["NA", "NA"],
            "Receiver Name": ["Customer C", "Customer D"],
            "Invoice Number": ["INV003", "INV004"],
            "Invoice date": ["15/01/2024", "16/01/2024"],
            "Invoice Value": [300000, 500000],
            "Place Of Supply": ["07-Delhi", "08-Rajasthan"],
            "Applicable % of Tax Rate": [18, 12],
            "Invoice Type": ["R", "R"],
            "Taxable Value": [300000, 500000],
            "E-Commerce GSTIN": ["", ""],
            "Rate": [18, 12],
            "Integrated Tax Amount": [54000, 60000],
            "Central Tax Amount": [0, 0],
            "State/UT Tax Amount": [0, 0],
            "Cess Amount": [0, 0],
            "Port Code": ["", ""],
            "Shipping Bill Number": ["", ""],
            "Shipping Bill Date": ["", ""],
        })

    @staticmethod
    def create_valid_b2cs_sheet() -> pd.DataFrame:
        """Create a valid B2CS data sheet (B2C small/others)."""
        return pd.DataFrame({
            "Invoice date": ["15/01/2024", "16/01/2024"],
            "Invoice Value": [5000, 10000],
            "Place Of Supply": ["27-Maharashtra", "07-Delhi"],
            "Applicable % of Tax Rate": [18, 12],
            "Type": ["OE", "OE"],
            "Taxable Value": [5000, 10000],
            "E-Commerce GSTIN": ["", ""],
            "Rate": [18, 12],
            "Integrated Tax Amount": [0, 1200],
            "Central Tax Amount": [450, 0],
            "State/UT Tax Amount": [450, 0],
            "Cess Amount": [0, 0],
        })

    @staticmethod
    def create_valid_export_sheet() -> pd.DataFrame:
        """Create a valid Export data sheet."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["", ""],
            "Receiver Name": ["Foreign Buyer A", "Foreign Buyer B"],
            "Invoice Number": ["EXP001", "EXP002"],
            "Invoice date": ["15/01/2024", "16/01/2024"],
            "Invoice Value": [100000, 200000],
            "Place Of Supply": ["96-Other Countries", "96-Other Countries"],
            "Applicable % of Tax Rate": [18, 0],
            "Invoice Type": ["WPAY", "WOPAY"],
            "Taxable Value": [100000, 200000],
            "Rate": [18, 0],
            "Integrated Tax Amount": [18000, 0],
            "Central Tax Amount": [0, 0],
            "State/UT Tax Amount": [0, 0],
            "Cess Amount": [0, 0],
            "Port Code": ["INNSA1", "INNSA2"],
            "Shipping Bill Number": ["SB001", "SB002"],
            "Shipping Bill Date": ["16/01/2024", "17/01/2024"],
        })

    @staticmethod
    def create_invalid_gstin_sheet() -> pd.DataFrame:
        """Create a B2B sheet with invalid GSTINs."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["INVALID123", "07BZAAH6384P1ZH"],
            "Receiver Name": ["Customer A", "Customer B"],
            "Invoice Number": ["INV001", "INV002"],
            "Invoice date": ["15/01/2024", "16/01/2024"],
            "Invoice Value": [100000, 250000],
            "Place Of Supply": ["07-Delhi", "27-Maharashtra"],
            "Reverse Charge": ["N", "N"],
            "Applicable % of Tax Rate": [18, 18],
            "Invoice Type": ["Regular", "Regular"],
            "Taxable Value": [100000, 250000],
            "E-Commerce GSTIN": ["", ""],
            "Rate": [18, 18],
            "Integrated Tax Amount": [18000, 45000],
            "Central Tax Amount": [0, 0],
            "State/UT Tax Amount": [0, 0],
            "Cess Amount": [0, 0],
        })

    @staticmethod
    def create_missing_mandatory_sheet() -> pd.DataFrame:
        """Create a B2B sheet with missing mandatory fields."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH", ""],
            "Receiver Name": ["Customer A", "Customer B"],
            "Invoice Number": ["", "INV002"],
            "Invoice date": ["", "16/01/2024"],
            "Invoice Value": [100000, 250000],
            "Place Of Supply": ["07-Delhi", "27-Maharashtra"],
            "Reverse Charge": ["N", "N"],
            "Applicable % of Tax Rate": [18, 18],
            "Invoice Type": ["Regular", "Regular"],
            "Taxable Value": [100000, 250000],
            "E-Commerce GSTIN": ["", ""],
            "Rate": [18, 18],
            "Integrated Tax Amount": [18000, 45000],
            "Central Tax Amount": [0, 0],
            "State/UT Tax Amount": [0, 0],
            "Cess Amount": [0, 0],
        })

    @staticmethod
    def create_invalid_pos_sheet() -> pd.DataFrame:
        """Create a B2B sheet with invalid place of supply."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH"],
            "Receiver Name": ["Customer A"],
            "Invoice Number": ["INV001"],
            "Invoice date": ["15/01/2024"],
            "Invoice Value": [100000],
            "Place Of Supply": ["99-Invalid State"],
            "Reverse Charge": ["N"],
            "Applicable % of Tax Rate": [18],
            "Invoice Type": ["Regular"],
            "Taxable Value": [100000],
            "E-Commerce GSTIN": [""],
            "Rate": [18],
            "Integrated Tax Amount": [18000],
            "Central Tax Amount": [0],
            "State/UT Tax Amount": [0],
            "Cess Amount": [0],
        })

    @staticmethod
    def create_invalid_date_sheet() -> pd.DataFrame:
        """Create a B2B sheet with invalid date format."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH"],
            "Receiver Name": ["Customer A"],
            "Invoice Number": ["INV001"],
            "Invoice date": ["32/01/2024"],  # Invalid date
            "Invoice Value": [100000],
            "Place Of Supply": ["07-Delhi"],
            "Reverse Charge": ["N"],
            "Applicable % of Tax Rate": [18],
            "Invoice Type": ["Regular"],
            "Taxable Value": [100000],
            "E-Commerce GSTIN": [""],
            "Rate": [18],
            "Integrated Tax Amount": [18000],
            "Central Tax Amount": [0],
            "State/UT Tax Amount": [0],
            "Cess Amount": [0],
        })

    @staticmethod
    def create_tax_mismatch_sheet() -> pd.DataFrame:
        """Create a B2B sheet with mismatched tax amounts."""
        return pd.DataFrame({
            "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH"],
            "Receiver Name": ["Customer A"],
            "Invoice Number": ["INV001"],
            "Invoice date": ["15/01/2024"],
            "Invoice Value": [100000],
            "Place Of Supply": ["07-Delhi"],  # Intra-state (same state)
            "Reverse Charge": ["N"],
            "Applicable % of Tax Rate": [18],
            "Invoice Type": ["Regular"],
            "Taxable Value": [100000],
            "E-Commerce GSTIN": [""],
            "Rate": [18],
            "Integrated Tax Amount": [18000],  # Should be 0 for intra-state
            "Central Tax Amount": [9000],
            "State/UT Tax Amount": [9000],
            "Cess Amount": [0],
        })

    @staticmethod
    def create_empty_sheet() -> pd.DataFrame:
        """Create an empty B2B sheet."""
        return pd.DataFrame(columns=[
            "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number",
            "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge",
            "Applicable % of Tax Rate", "Invoice Type", "Taxable Value",
            "E-Commerce GSTIN", "Rate", "Integrated Tax Amount",
            "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"
        ])

    @staticmethod
    def create_excel_bytes(sheets: dict) -> BytesIO:
        """Create an Excel file from sheet dataframes."""
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for sheet_name, df in sheets.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)
        return output


@pytest.fixture
def valid_b2b_excel() -> BytesIO:
    """Create a valid B2B Excel file."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_valid_b2b_sheet()})


@pytest.fixture
def valid_full_excel() -> BytesIO:
    """Create a valid Excel file with all sheets."""
    return ExcelFixtures.create_excel_bytes({
        "B2B": ExcelFixtures.create_valid_b2b_sheet(),
        "B2CL": ExcelFixtures.create_valid_b2cl_sheet(),
        "B2CS": ExcelFixtures.create_valid_b2cs_sheet(),
        "EXP": ExcelFixtures.create_valid_export_sheet(),
    })


@pytest.fixture
def invalid_gstin_excel() -> BytesIO:
    """Create an Excel file with invalid GSTINs."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_invalid_gstin_sheet()})


@pytest.fixture
def missing_mandatory_excel() -> BytesIO:
    """Create an Excel file with missing mandatory fields."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_missing_mandatory_sheet()})


@pytest.fixture
def invalid_pos_excel() -> BytesIO:
    """Create an Excel file with invalid place of supply."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_invalid_pos_sheet()})


@pytest.fixture
def invalid_date_excel() -> BytesIO:
    """Create an Excel file with invalid date format."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_invalid_date_sheet()})


@pytest.fixture
def tax_mismatch_excel() -> BytesIO:
    """Create an Excel file with mismatched tax amounts."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_tax_mismatch_sheet()})


@pytest.fixture
def empty_excel() -> BytesIO:
    """Create an empty Excel file."""
    return ExcelFixtures.create_excel_bytes({"B2B": ExcelFixtures.create_empty_sheet()})


@pytest.fixture
def sample_gstr1_data() -> dict:
    """Create sample GSTR-1 processed data."""
    return {
        "b2b": [
            {
                "invoice_no": "INV001",
                "invoice_date": "15/01/2024",
                "invoice_value": 100000,
                "place_of_supply": "07-Delhi",
                "reverse_charge": False,
                "items": [
                    {
                        "taxable_value": 100000,
                        "igst_amount": 18000,
                        "cgst_amount": 0,
                        "sgst_amount": 0,
                        "cess_amount": 0,
                        "tax_rate": 18,
                    }
                ],
            },
            {
                "invoice_no": "INV002",
                "invoice_date": "16/01/2024",
                "invoice_value": 250000,
                "place_of_supply": "27-Maharashtra",  # Inter-state from Delhi
                "reverse_charge": False,
                "items": [
                    {
                        "taxable_value": 250000,
                        "igst_amount": 45000,
                        "cgst_amount": 0,
                        "sgst_amount": 0,
                        "cess_amount": 0,
                        "tax_rate": 18,
                    }
                ],
            },
        ],
        "b2cl": [
            {
                "invoice_no": "INV003",
                "invoice_date": "17/01/2024",
                "invoice_value": 300000,
                "place_of_supply": "07-Delhi",  # Inter-state from Maharashtra
                "reverse_charge": False,
                "items": [
                    {
                        "taxable_value": 300000,
                        "igst_amount": 54000,
                        "cgst_amount": 0,
                        "sgst_amount": 0,
                        "cess_amount": 0,
                        "tax_rate": 18,
                    }
                ],
            }
        ],
        "b2cs": [
            {
                "invoice_no": "0001",
                "invoice_date": "18/01/2024",
                "invoice_value": 5000,
                "place_of_supply": "27-Maharashtra",  # Intra-state
                "items": [
                    {
                        "taxable_value": 5000,
                        "igst_amount": 0,
                        "cgst_amount": 450,
                        "sgst_amount": 450,
                        "cess_amount": 0,
                        "tax_rate": 18,
                    }
                ],
            }
        ],
        "export": [
            {
                "invoice_no": "EXP001",
                "invoice_date": "19/01/2024",
                "invoice_value": 100000,
                "place_of_supply": "96-Other Countries",
                "items": [
                    {
                        "taxable_value": 100000,
                        "igst_amount": 18000,
                        "cgst_amount": 0,
                        "sgst_amount": 0,
                        "cess_amount": 0,
                        "tax_rate": 18,
                    }
                ],
            }
        ],
        "cdnr": [],
        "cdnur": [],
        "nil_exempt": [],
    }


@pytest.fixture
def sample_gstr3b_expected() -> dict:
    """Expected GSTR-3B summary for sample data (company GSTIN: 07AAAAA1234A1ZA)."""
    return {
        "3.1a": {
            "description": "Outward Taxable Supplies (Inter State, Registered)",
            "taxable_value": 250000.0,  # INV002 (inter-state to Maharashtra)
            "igst_amount": 45000.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
        "3.1b": {
            "description": "Outward Taxable Supplies (Inter State, Unregistered)",
            "taxable_value": 300000.0,  # B2CL invoice
            "igst_amount": 54000.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
        "3.1c": {
            "description": "Outward Taxable Supplies (Intra State)",
            "taxable_value": 105000.0,  # INV001 (intra-state) + B2CS
            "igst_amount": 0.0,
            "cgst_amount": 450.0,
            "sgst_amount": 450.0,
            "cess_amount": 0.0,
        },
        "3.1d": {
            "description": "Outward Taxable Supplies (Reverse Charge)",
            "taxable_value": 0.0,
            "igst_amount": 0.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
        "3.2": {
            "description": "Zero Rated Supplies (Export)",
            "taxable_value": 100000.0,
            "igst_amount": 18000.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
    }
