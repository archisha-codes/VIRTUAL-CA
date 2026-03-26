"""
Unit tests for GSTR export API endpoints.
"""

import pytest
import json
import io
from fastapi.testclient import TestClient

from india_compliance.gst_india.api_classes.gstr_export import router


# Create test client
client = TestClient(router)


class TestDownloadGSTR1JSON:
    """Tests for /download-gstr1-json endpoint."""

    def test_valid_request(self):
        """Test successful JSON download."""
        response = client.get(
            "/download-gstr1-json",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024"
            }
        )
        
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "application/json"
        assert "GSTR-1_" in response.headers["Content-Disposition"]
        assert ".json" in response.headers["Content-Disposition"]
        
        # Verify JSON content
        data = response.json()
        assert data["gstin"] == "07AAAAA1234A1ZA"
        assert data["fp"] == "03/2024"

    def test_invalid_gstin_length(self):
        """Test with invalid GSTIN length."""
        response = client.get(
            "/download-gstr1-json",
            params={
                "gstin": "07AAAAA1234A1Z",  # 14 characters
                "return_period": "03/2024"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid GSTIN" in response.json()["detail"]

    def test_invalid_return_period(self):
        """Test with invalid return period format."""
        response = client.get(
            "/download-gstr1-json",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03-2024"  # Wrong format
            }
        )
        
        assert response.status_code == 400
        assert "Invalid return period" in response.json()["detail"]

    def test_missing_gstin(self):
        """Test with missing GSTIN."""
        response = client.get(
            "/download-gstr1-json",
            params={
                "return_period": "03/2024"
            }
        )
        
        assert response.status_code == 422  # Validation error

    def test_missing_return_period(self):
        """Test with missing return period."""
        response = client.get(
            "/download-gstr1-json",
            params={
                "gstin": "07AAAAA1234A1ZA"
            }
        )
        
        assert response.status_code == 422  # Validation error


class TestDownloadGSTR3BExcel:
    """Tests for /download-gstr3b-excel endpoint."""

    def test_valid_request(self):
        """Test successful Excel download."""
        response = client.get(
            "/download-gstr3b-excel",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024"
            }
        )
        
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["Content-Type"]
        assert "GSTR-3B_" in response.headers["Content-Disposition"]
        assert ".xlsx" in response.headers["Content-Disposition"]

    def test_with_company_gstin(self):
        """Test with company GSTIN."""
        response = client.get(
            "/download-gstr3b-excel",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024",
                "company_gstin": "27AAAAA1234A1ZB"
            }
        )
        
        assert response.status_code == 200

    def test_invalid_gstin(self):
        """Test with invalid GSTIN."""
        response = client.get(
            "/download-gstr3b-excel",
            params={
                "gstin": "INVALID",
                "return_period": "03/2024"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid GSTIN" in response.json()["detail"]

    def test_invalid_return_period(self):
        """Test with invalid return period."""
        response = client.get(
            "/download-gstr3b-excel",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "202403"  # Wrong format
            }
        )
        
        assert response.status_code == 400


class TestDownloadGSTRExport:
    """Tests for /download-gstr-export endpoint."""

    def test_export_both(self):
        """Test combined export endpoint with both options."""
        response = client.get(
            "/download-gstr-export",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024",
                "export_type": "both"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["gstin"] == "07AAAAA1234A1ZA"
        assert data["return_period"] == "03/2024"
        assert "json_url" in data
        assert "excel_url" in data

    def test_export_json_only(self):
        """Test combined export endpoint with json only."""
        response = client.get(
            "/download-gstr-export",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024",
                "export_type": "json"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "json_url" in data
        assert "excel_url" not in data

    def test_export_excel_only(self):
        """Test combined export endpoint with excel only."""
        response = client.get(
            "/download-gstr-export",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024",
                "export_type": "excel"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "json_url" not in data
        assert "excel_url" in data

    def test_invalid_export_type(self):
        """Test with invalid export type."""
        response = client.get(
            "/download-gstr-export",
            params={
                "gstin": "07AAAAA1234A1ZA",
                "return_period": "03/2024",
                "export_type": "pdf"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid export_type" in response.json()["detail"]


class TestFilenameGeneration:
    """Tests for filename generation utility."""

    def test_get_filename_json(self):
        """Test filename generation for JSON."""
        from india_compliance.gst_india.api_classes.gstr_export import get_filename
        
        filename = get_filename("GSTR-1", "07AAAAA1234A1ZA", "032024", "json")
        assert filename.startswith("GSTR-1_07AAAAA1234A1ZA_032024_")
        assert filename.endswith(".json")

    def test_get_filename_excel(self):
        """Test filename generation for Excel."""
        from india_compliance.gst_india.api_classes.gstr_export import get_filename
        
        filename = get_filename("GSTR-3B", "07AAAAA1234A1ZA", "032024", "xlsx")
        assert filename.startswith("GSTR-3B_07AAAAA1234A1ZA_032024_")
        assert filename.endswith(".xlsx")
