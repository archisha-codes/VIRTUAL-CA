"""
GSTR-3B API Router - Comprehensive Test Suite

Demonstrates API endpoint functionality with various scenarios including:
- Status flag combinations
- Invoice/credit note separation
- Decimal precision validation
- Error handling
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from typing import Dict, Any

# Mock FastAPI app for testing
from fastapi import FastAPI
from india_compliance.gst_india.api_layer.gstr3b_router import router as gstr3b_router

# Create test app
app = FastAPI()
app.include_router(gstr3b_router)
client = TestClient(app)


# ============================================================================
# SAMPLE DATA
# ============================================================================

SAMPLE_GSTR1_DATA = {
    "b2b": [
        {
            "inv_no": "INV001",
            "inv_date": "01/12/2025",
            "gstin": "29AABCT1234C1Z5",
            "txval": 100000.00,
            "rate": 18,
            "igst": 18000.00,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
        {
            "inv_no": "INV002",
            "inv_date": "05/12/2025",
            "gstin": "27AABCT5678C1Z5",
            "txval": 200000.00,
            "rate": 18,
            "igst": 36000.00,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    ],
    "b2cl": [
        {
            "inv_no": "INV003",
            "inv_date": "10/12/2025",
            "place_of_supply": "29",
            "txval": 50000.00,
            "rate": 18,
            "igst": 9000.00,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    ],
    "b2cs": [
        {
            "inv_no": "INV004",
            "inv_date": "15/12/2025",
            "place_of_supply": "29",
            "txval": 100000.00,
            "rate": 18,
            "igst": 18000.00,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    ],
    "exp": [
        {
            "inv_no": "INV005",
            "inv_date": "20/12/2025",
            "txval": 500000.00,
            "rate": 0,
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
        },
    ],
    "cdnr": [
        {
            "inv_no": "CDN001",
            "inv_date": "25/12/2025",
            "gstin": "29AABCT1234C1Z5",
            "txval": -50000.00,
            "rate": 18,
            "igst": -9000.00,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
            "is_return": True,
        },
    ],
    "cdnur": [],
}

SAMPLE_GSTR2B_DATA = [
    {
        "invoice_no": "INV-VENDOR-001",
        "invoice_date": "01/12/2025",
        "vendor_gstin": "27XYZAB1234C1Z5",
        "invoice_value": 150000.00,
        "taxable_value": 150000.00,
        "rate": 18,
        "igst": 27000.00,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    },
    {
        "invoice_no": "INV-VENDOR-002",
        "invoice_date": "10/12/2025",
        "vendor_gstin": "27XYZAB5678C1Z5",
        "invoice_value": 100000.00,
        "taxable_value": 100000.00,
        "rate": 18,
        "igst": 18000.00,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
    },
]

TEST_GSTIN = "27AABCT1234C1Z5"
TEST_RETURN_PERIOD = "122025"


# ============================================================================
# TEST CASES
# ============================================================================

class TestGSTR3BAutoPopulation:
    """Test GSTR-3B auto-population endpoints"""

    def test_auto_populate_with_both_sources(self):
        """Test auto-population with GSTR-1 filed and GSTR-2B generated"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={
                "gstr1_filed": True,
                "gstr2b_generated": True,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify metadata
        assert data["metadata"]["gstin"] == TEST_GSTIN
        assert data["metadata"]["return_period"] == TEST_RETURN_PERIOD
        
        # Verify filing status
        assert data["filing_status"]["gstr1_filed"] is True
        assert data["filing_status"]["gstr2b_generated"] is True
        
        # Verify sections exist
        assert "section_3_1" in data
        assert "section_3_2" in data
        assert "section_4" in data
        assert "tax_summary" in data

    def test_gstr1_not_filed(self):
        """Test with GSTR-1 not filed - outward supplies should be 'Not filed'"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={
                "gstr1_filed": False,
                "gstr2b_generated": True,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify GSTR-1 not filed status
        assert data["filing_status"]["gstr1_filed"] is False
        
        # Verify outward supply tables have "Not filed" status
        assert data["section_3_1"]["table_3_1_a"]["status"] == "Not filed"
        assert data["section_3_1"]["table_3_1_b"]["status"] == "Not filed"
        assert data["section_3_1"]["table_3_1_c"]["status"] == "Not filed"
        assert data["section_3_1"]["table_3_1_e"]["status"] == "Not filed"
        
        # Verify values are zeroed
        assert data["section_3_1"]["table_3_1_a"]["taxable_value"] == 0.0
        assert data["section_3_1"]["table_3_1_a"]["igst"] == 0.0

    def test_gstr2b_not_generated(self):
        """Test with GSTR-2B not generated - ITC should be 'Not generated'"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={
                "gstr1_filed": True,
                "gstr2b_generated": False,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify GSTR-2B not generated status
        assert data["filing_status"]["gstr2b_generated"] is False
        
        # Verify inward supplies status
        assert data["section_3_1"]["table_3_1_d"]["status"] == "Not generated"
        assert data["section_3_1"]["table_3_1_d"]["taxable_value"] == 0.0
        
        # Verify ITC section status
        assert data["section_4"]["status"] == "Not generated"

    def test_both_not_available(self):
        """Test with neither GSTR-1 nor GSTR-2B available"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={
                "gstr1_filed": False,
                "gstr2b_generated": False,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify both flags are false
        assert data["filing_status"]["gstr1_filed"] is False
        assert data["filing_status"]["gstr2b_generated"] is False
        
        # Verify all auto-populated sections are zero
        assert data["section_3_1"]["table_3_1_a"]["taxable_value"] == 0.0
        assert data["section_4"]["section_4c"]["igst"] == 0.0

    def test_invalid_gstin_format(self):
        """Test with invalid GSTIN format"""
        response = client.get(
            "/api/v1/gstr3b/auto-populate/INVALID/122025",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 400
        assert "Invalid GSTIN format" in response.json()["detail"]

    def test_invalid_return_period_format(self):
        """Test with invalid return period format"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/12-2025",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 400
        assert "Invalid return period format" in response.json()["detail"]

    def test_response_decimal_precision(self):
        """Test that all monetary values maintain 2 decimal precision"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify decimal precision in key fields
        total_payable = data["tax_summary"]["total_payable"]["igst"]
        
        # Convert to string and check decimal places
        payable_str = str(total_payable)
        if "." in payable_str:
            decimal_places = len(payable_str.split(".")[1])
            assert decimal_places <= 2, f"Expected max 2 decimal places, got {decimal_places}"

    def test_filing_status_endpoint(self):
        """Test filing status endpoint"""
        response = client.get(
            f"/api/v1/gstr3b/filing-status/{TEST_GSTIN}/{TEST_RETURN_PERIOD}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["gstin"] == TEST_GSTIN
        assert data["return_period"] == TEST_RETURN_PERIOD
        assert "gstr1_filed" in data
        assert "gstr2b_generated" in data
        assert "auto_population_ready" in data

    def test_response_structure_completeness(self):
        """Test that response includes all required sections"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required sections exist
        required_sections = [
            "metadata",
            "filing_status",
            "section_3_1",
            "section_3_2",
            "section_4",
            "tax_summary",
            "compliance",
            "generated_at",
            "generated_by",
        ]
        
        for section in required_sections:
            assert section in data, f"Missing section: {section}"

    def test_section_3_1_all_tables(self):
        """Test that Section 3.1 includes all 5 supply tables"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        section_3_1 = data["section_3_1"]
        
        required_tables = [
            "table_3_1_a",
            "table_3_1_b",
            "table_3_1_c",
            "table_3_1_d",
            "table_3_1_e",
        ]
        
        for table in required_tables:
            assert table in section_3_1, f"Missing table: {table}"

    def test_tax_summary_completeness(self):
        """Test that tax summary includes all required calculations"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        tax_summary = data["tax_summary"]
        
        required_components = [
            "outward_tax_liability",
            "rcm_tax_liability",
            "total_liability",
            "total_itc",
            "total_payable",
        ]
        
        for component in required_components:
            assert component in tax_summary, f"Missing component: {component}"

    def test_compliance_metadata(self):
        """Test that compliance metadata is included"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        compliance = data["compliance"]
        
        assert compliance["strict_mapping_applied"] is True
        assert compliance["decimal_precision"] == "2 decimal places"
        assert compliance["negative_values_rule"] == "Default to zero"
        assert len(compliance["auto_populated_sections"]) > 0
        assert len(compliance["manual_entry_sections"]) > 0


class TestInvoiceSeparation:
    """Test invoice and credit note separation logic"""

    def test_separate_invoices_endpoint(self):
        """Test invoice separation utility endpoint"""
        response = client.post(
            "/api/v1/gstr3b/separate-invoices",
            json=SAMPLE_GSTR1_DATA
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert data["total_invoices"] > 0
        assert "b2b_count" in data["invoices"]
        assert "cdnr_count" in data["credit_notes"]

    def test_credit_note_detection(self):
        """Test that credit notes are properly detected"""
        test_data = {
            "b2b": [
                {"inv_no": "INV001", "txval": 100000},
                {"inv_no": "CDN001", "txval": -50000, "is_return": True},
            ],
            "b2cl": [],
            "b2cs": [],
            "exp": [],
            "cdnr": [
                {"inv_no": "CDN002", "txval": -25000},
            ],
            "cdnur": [],
        }
        
        response = client.post(
            "/api/v1/gstr3b/separate-invoices",
            json=test_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should detect both invoices and credit notes
        assert data["total_credit_notes"] > 0


class TestErrorHandling:
    """Test error handling and edge cases"""

    def test_missing_return_period(self):
        """Test missing return period parameter"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/"
        )
        
        # Should fail due to missing path parameter
        assert response.status_code != 200

    def test_empty_gstr1_data(self):
        """Test with empty GSTR-1 data"""
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={
                "gstr1_filed": True,
                "gstr2b_generated": False,
            }
        )
        
        # Should still return valid response with zero values
        assert response.status_code == 200
        data = response.json()
        assert data["section_3_1"]["table_3_1_a"]["taxable_value"] == 0.0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestIntegration:
    """Integration tests with realistic scenarios"""

    def test_complete_workflow_gst_registered_business(self):
        """Test complete workflow for GST registered business"""
        # Step 1: Check filing status
        status_response = client.get(
            f"/api/v1/gstr3b/filing-status/{TEST_GSTIN}/{TEST_RETURN_PERIOD}"
        )
        assert status_response.status_code == 200
        
        # Step 2: Auto-populate when both sources available
        auto_pop_response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        assert auto_pop_response.status_code == 200
        
        # Step 3: Verify response is complete
        data = auto_pop_response.json()
        assert data["filing_status"]["gstr1_filed"] is True
        assert data["filing_status"]["gstr2b_generated"] is True

    def test_staged_filing_workflow(self):
        """Test workflow where GSTR-1 is filed first, then GSTR-2B"""
        # Stage 1: Only GSTR-1 filed
        response1 = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": False}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Verify outward supplies are available
        assert data1["section_3_1"]["table_3_1_a"]["status"] == "Filed"
        
        # Verify ITC is not available
        assert data1["section_4"]["status"] == "Not generated"
        
        # Stage 2: GSTR-2B becomes available
        response2 = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Verify ITC is now available
        assert data2["section_4"]["status"] == "Generated"


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Performance and load testing"""

    def test_response_time_acceptable(self):
        """Test that endpoint responds within acceptable time"""
        import time
        
        start = time.time()
        response = client.get(
            f"/api/v1/gstr3b/auto-populate/{TEST_GSTIN}/{TEST_RETURN_PERIOD}",
            params={"gstr1_filed": True, "gstr2b_generated": True}
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5.0, f"Response took {elapsed}s, expected < 5s"


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
