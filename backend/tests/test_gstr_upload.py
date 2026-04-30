"""
Unit tests for GSTR upload API endpoints.
"""

import pytest
import io
import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi import UploadFile

from india_compliance.gst_india.api_classes.gstr_upload import router


# Create test client
app = FastAPI()
app.include_router(router)
client = TestClient(app)


def create_excel_file(rows: list) -> bytes:
    """Create an Excel file from a list of dictionaries."""
    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Sales')
    output.seek(0)
    return output.getvalue()


class TestUploadSalesExcel:
    """Tests for /upload-sales-excel endpoint."""

    def test_valid_file(self):
        """Test upload with valid data."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024", 
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
            {"gstin": "27AAAAA5678A1ZB", "invoice_no": "INV-002", "invoice_date": "15/03/2024",
             "place_of_supply": "27-Maharashtra", "taxable_value": 200000, "gst_rate": 18,
             "igst_amount": 36000},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            params={"company_gstin": "07AAAAA1234A1ZA", "return_period": "03/2024"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "File processed successfully"
        assert data["summary"]["total_rows"] == 2
        assert data["summary"]["valid_rows"] == 2
        assert data["summary"]["error_count"] == 0

    def test_invalid_gstin(self):
        """Test upload with invalid GSTIN."""
        rows = [
            {"gstin": "invalid", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert len(data["errors"]) > 0
        assert any(e["field"] == "recipient_gstin" for e in data["errors"])

    def test_invalid_gst_rate(self):
        """Test upload with invalid GST rate."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 15,  # Invalid
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert any("gst_rate" in e["field"].lower() for e in data["errors"])

    def test_missing_taxable_value(self):
        """Test upload with missing taxable value."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},  # Missing taxable_value
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert any("taxable" in e["field"].lower() for e in data["errors"])

    def test_multiple_errors(self):
        """Test upload with multiple validation errors."""
        rows = [
            {"invoice_no": "INV-001", "invoice_date": "15/03/2024",  # Missing gstin
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-002", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 10,  # Invalid rate
             "cgst_amount": 9000, "sgst_amount": 9000},
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-003", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},  # Valid
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert len(data["errors"]) >= 2
        
        # Check error structure
        for error in data["errors"]:
            assert "row" in error
            assert "field" in error
            assert "error" in error

    def test_invalid_file_format(self):
        """Test upload with invalid file format."""
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.txt", b"not an excel file")},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert any("file" in e["field"].lower() for e in data["errors"])

    def test_empty_file(self):
        """Test upload with empty Excel file."""
        df = pd.DataFrame()
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Sales')
        output.seek(0)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("empty.xlsx", output.getvalue())},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_rows"] == 0

    def test_error_row_numbers(self):
        """Test that error row numbers are correct."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
            {"gstin": "invalid", "invoice_no": "INV-002", "invoice_date": "15/03/2024",  # Row 3
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        # Row 2 is the first data row (row 1 is header), so invalid row should be row 3
        assert any(e["row"] == 3 for e in data["errors"])

    def test_section_detection(self):
        """Test that sections are detected correctly."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},  # B2B
            {"invoice_no": "INV-002", "invoice_date": "15/03/2024",  # B2CS (no GSTIN)
             "place_of_supply": "07-Delhi", "taxable_value": 50000, "gst_rate": 18,
             "cgst_amount": 4500, "sgst_amount": 4500},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["sections"]["b2b"] == 1
        assert data["summary"]["sections"]["b2cs"] == 1


class TestUploadValidateOnly:
    """Tests for /upload-validate-only endpoint."""

    def test_valid_file(self):
        """Test validation with valid data."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-validate-only",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "All rows valid"

    def test_invalid_file(self):
        """Test validation with invalid data."""
        rows = [
            {"gstin": "bad", "invoice_no": "INV-001"},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-validate-only",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data


class TestValidateRows:
    """Tests for /validate-rows endpoint."""

    def test_valid_rows(self):
        """Test validation of row data without file."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        
        response = client.post(
            "/validate-rows",
            json={"rows": rows, "company_gstin": "07AAAAA1234A1ZA"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "All rows valid"

    def test_invalid_rows(self):
        """Test validation with invalid row data."""
        rows = [
            {"gstin": "invalid"},
        ]
        
        response = client.post(
            "/validate-rows",
            json={"rows": rows}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data

    def test_with_section_hint(self):
        """Test validation with section hint."""
        rows = [
            {"gstin": "07AAAAA1234A1ZA", "invoice_no": "INV-001", "invoice_date": "15/03/2024",
             "place_of_supply": "07-Delhi", "taxable_value": 100000, "gst_rate": 18,
             "cgst_amount": 9000, "sgst_amount": 9000},
        ]
        
        response = client.post(
            "/validate-rows",
            json={"rows": rows, "section_hint": "b2b"}
        )
        
        assert response.status_code == 200


class TestErrorFormat:
    """Tests for error format consistency."""

    def test_error_fields(self):
        """Test that errors have all required fields."""
        rows = [
            {"gstin": "bad", "invoice_no": "INV-001"},
        ]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        
        for error in data["errors"]:
            assert "row" in error
            assert "field" in error
            assert "error" in error
            assert isinstance(error["row"], int)

    def test_error_limit(self):
        """Test that error list is limited to 100."""
        # Create 150 rows with errors
        rows = [{"gstin": "bad"} for _ in range(150)]
        excel_content = create_excel_file(rows)
        
        response = client.post(
            "/upload-sales-excel",
            files={"file": ("test.xlsx", excel_content)},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert len(data["errors"]) <= 101  # 100 errors + truncation message
