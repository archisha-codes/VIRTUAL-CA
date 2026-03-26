"""
Integration tests for FastAPI endpoints.
"""

import pytest
import io
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import pandas as pd


# Set environment for testing
import os
os.environ["GST_API_KEY"] = "test-api-key"


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self):
        """Test health check returns healthy status."""
        with patch("india_compliance.gst_india.utils.gstr_1.processor.process_gstr1_excel"):
            with TestClient(app) as client:
                response = client.get("/health")
                
                assert response.status_code == 200
                assert response.json() == {"status": "healthy"}


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_endpoint(self):
        """Test root endpoint returns welcome message."""
        with TestClient(app) as client:
            response = client.get("/")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "version" in data
            assert "docs" in data


class TestUploadEndpoint:
    """Tests for upload-sales-excel endpoint."""

    def test_upload_valid_excel(self, valid_full_excel):
        """Test uploading valid Excel file returns success."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", valid_full_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            # Should return 200 or 400 depending on validation
            assert response.status_code in [200, 400]
            data = response.json()
            assert "summary" in data
            assert "errors" in data

    def test_upload_invalid_file_type(self):
        """Test uploading non-Excel file returns error."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.txt", b"invalid content", "text/plain")}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert len(data["errors"]) > 0
            assert "Invalid file type" in data["errors"][0]["error"]

    def test_upload_empty_file(self):
        """Test uploading empty file returns error."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("empty.xlsx", b"", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert len(data["errors"]) > 0

    def test_upload_with_invalid_gstin(self, invalid_gstin_excel):
        """Test uploading file with invalid GSTINs returns validation errors."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", invalid_gstin_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert len(data["errors"]) > 0
            # Check that errors contain row info
            errors_with_row = [e for e in data["errors"] if "row" in e]
            assert len(errors_with_row) > 0

    def test_upload_response_structure(self, valid_b2b_excel):
        """Test upload response has correct structure."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", valid_b2b_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            data = response.json()
            assert "summary" in data
            assert "errors" in data
            
            summary = data["summary"]
            assert "b2b_count" in summary
            assert "b2cl_count" in summary
            assert "b2cs_count" in summary
            assert "export_count" in summary
            assert "total_invoices" in summary

    def test_upload_gstr3b_summary_included(self, valid_b2b_excel):
        """Test that GSTR-3B summary is included in response."""
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", valid_b2b_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            data = response.json()
            summary = data.get("summary", {})
            assert "gstr3b" in summary
            
            gstr3b = summary["gstr3b"]
            assert "3.1a" in gstr3b
            assert "3.1b" in gstr3b
            assert "3.1c" in gstr3b
            assert "3.2" in gstr3b


class TestDownloadEndpoints:
    """Tests for download endpoints (require API key)."""

    def test_download_gstr1_json_without_api_key(self):
        """Test download without API key returns 403."""
        with TestClient(app) as client:
            response = client.get("/download-gstr1-json")
            
            assert response.status_code == 403

    def test_download_gstr1_json_with_api_key(self):
        """Test download with valid API key."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr1-json",
                headers={"X-API-Key": "test-api-key"}
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/json"
            assert "attachment" in response.headers["content-disposition"]

    def test_download_gstr1_json_with_query_param(self):
        """Test download with API key as query parameter."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr1-json?api_key=test-api-key"
            )
            
            assert response.status_code == 200

    def test_download_gstr3b_excel_without_api_key(self):
        """Test GSTR-3B Excel download without API key returns 403."""
        with TestClient(app) as client:
            response = client.get("/download-gstr3b-excel")
            
            assert response.status_code == 403

    def test_download_gstr3b_excel_with_api_key(self):
        """Test GSTR-3B Excel download with valid API key."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr3b-excel",
                headers={"X-API-Key": "test-api-key"}
            )
            
            assert response.status_code == 200
            assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
            assert "attachment" in response.headers["content-disposition"]

    def test_download_gstr1_json_with_file(self, valid_full_excel):
        """Test POST download-gstr1-json with file."""
        with TestClient(app) as client:
            response = client.post(
                "/download-gstr1-json",
                headers={"X-API-Key": "test-api-key"},
                files={"file": ("test.xlsx", valid_full_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/json"

    def test_download_gstr1_excel_with_file(self, valid_full_excel):
        """Test POST download-gstr1-excel with file."""
        with TestClient(app) as client:
            response = client.post(
                "/download-gstr1-excel",
                headers={"X-API-Key": "test-api-key"},
                files={"file": ("test.xlsx", valid_full_excel.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 200
            assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


class TestTemplateEndpoints:
    """Tests for template-related endpoints."""

    def test_gstr1_template_format(self):
        """Test gstr1-template-format endpoint."""
        with TestClient(app) as client:
            response = client.get("/gstr1-template-format")
            
            assert response.status_code == 200
            data = response.json()
            assert "sheet_names" in data
            assert "notes" in data
            
            # Check required sheets
            assert "b2b" in data["sheet_names"]
            assert "b2cl" in data["sheet_names"]
            assert "b2cs" in data["sheet_names"]
            assert "exp" in data["sheet_names"]


class TestValidationErrorsEndpoint:
    """Tests for validation-errors endpoint."""

    def test_validation_errors_endpoint(self):
        """Test validation-errors endpoint returns error codes."""
        with TestClient(app) as client:
            response = client.get("/validation-errors")
            
            assert response.status_code == 200
            data = response.json()
            assert "error_codes" in data
            assert "notes" in data
            
            # Check for specific error codes
            error_codes = data["error_codes"]
            assert "GSTIN_01" in error_codes
            assert "GSTIN_03" in error_codes
            assert "DATE_01" in error_codes
            assert "POS_01" in error_codes


class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_malformed_row_error_format(self):
        """Test that malformed rows return proper error format."""
        # Create a file with invalid data
        import pandas as pd
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # B2B sheet with invalid GSTIN
            df = pd.DataFrame({
                "GSTIN/UIN of Recipient": ["INVALID123"],
                "Receiver Name": ["Test"],
                "Invoice Number": ["INV001"],
                "Invoice date": ["15/01/2024"],
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
            df.to_excel(writer, sheet_name="B2B", index=False)
        
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 400
            data = response.json()
            
            # Verify error structure has "row" and "error" keys
            for error in data["errors"]:
                assert "row" in error
                assert "error" in error

    def test_missing_taxable_value_error(self):
        """Test that missing taxable value returns proper error."""
        import pandas as pd
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df = pd.DataFrame({
                "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH"],
                "Receiver Name": ["Test"],
                "Invoice Number": ["INV001"],
                "Invoice date": ["15/01/2024"],
                "Invoice Value": [100000],
                "Place Of Supply": ["07-Delhi"],
                "Reverse Charge": ["N"],
                "Applicable % of Tax Rate": [18],
                "Invoice Type": ["Regular"],
                "Taxable Value": [None],  # Missing value
                "E-Commerce GSTIN": [""],
                "Rate": [18],
                "Integrated Tax Amount": [18000],
                "Central Tax Amount": [0],
                "State/UT Tax Amount": [0],
                "Cess Amount": [0],
            })
            df.to_excel(writer, sheet_name="B2B", index=False)
        
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            # Should return validation error
            assert response.status_code in [200, 400]
            data = response.json()
            
            # Check if Taxable Value error is present
            errors_str = str(data.get("errors", []))
            assert "Taxable Value" in errors_str or "taxable" in errors_str.lower()

    def test_invalid_pos_error(self):
        """Test that invalid place of supply returns proper error."""
        import pandas as pd
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df = pd.DataFrame({
                "GSTIN/UIN of Recipient": ["07BZAAH6384P1ZH"],
                "Receiver Name": ["Test"],
                "Invoice Number": ["INV001"],
                "Invoice date": ["15/01/2024"],
                "Invoice Value": [100000],
                "Place Of Supply": ["99-Invalid State"],  # Invalid POS
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
            df.to_excel(writer, sheet_name="B2B", index=False)
        
        with TestClient(app) as client:
            response = client.post(
                "/upload-sales-excel",
                files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
            
            assert response.status_code == 400
            data = response.json()
            
            # Check for POS-related error
            errors_str = str(data.get("errors", []))
            assert "Place of Supply" in errors_str or "supply" in errors_str.lower()


class TestAPIKeyAuthentication:
    """Tests for API key authentication."""

    def test_invalid_api_key(self):
        """Test that invalid API key returns 403."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr1-json",
                headers={"X-API-Key": "wrong-key"}
            )
            
            assert response.status_code == 403
            assert "Invalid or missing API key" in response.json()["detail"]

    def test_valid_api_key_header(self):
        """Test that API key in header works."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr1-json",
                headers={"X-API-Key": "test-api-key"}
            )
            
            assert response.status_code == 200

    def test_valid_api_key_query(self):
        """Test that API key as query parameter works."""
        with TestClient(app) as client:
            response = client.get(
                "/download-gstr1-json?api_key=test-api-key"
            )
            
            assert response.status_code == 200


# Import app after setting environment
from main import app
