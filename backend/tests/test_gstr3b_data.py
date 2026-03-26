"""
Unit tests for GSTR-3B data processing logic.
"""

import pytest
from india_compliance.gst_india.utils.gstr3b.gstr3b_data import (
    generate_gstr3b_summary,
    generate_gstr3b_json_format,
    generate_gstr3b_summary_v2,
    generate_gstr3b_json_format_v2,
    get_invoice_totals,
    get_state_code,
    is_inter_state,
    flt,
)


class TestHelperFunctions:
    """Tests for helper functions."""

    def test_flt_with_none(self):
        """Test flt function with None value."""
        assert flt(None) == 0.0

    def test_flt_with_numeric(self):
        """Test flt function with numeric value."""
        assert flt(100.456) == 100.46
        assert flt(100) == 100.0

    def test_flt_with_string(self):
        """Test flt function with string."""
        assert flt("100.456") == 100.46

    def test_get_state_code_with_dash(self):
        """Test get_state_code with state name."""
        assert get_state_code("07-Delhi") == "07"
        assert get_state_code("27-Maharashtra") == "27"

    def test_get_state_code_numeric_only(self):
        """Test get_state_code with numeric only."""
        assert get_state_code("07") == "07"
        assert get_state_code("96") == "96"

    def test_get_state_code_empty(self):
        """Test get_state_code with empty string."""
        assert get_state_code("") == ""
        assert get_state_code(None) == ""

    def test_is_inter_state_same_state(self):
        """Test is_inter_state with same state."""
        result = is_inter_state("07AAAAA1234A1ZA", "07-Delhi")
        assert result is False

    def test_is_inter_state_different_state(self):
        """Test is_inter_state with different state."""
        result = is_inter_state("07AAAAA1234A1ZA", "27-Maharashtra")
        assert result is True

    def test_is_inter_state_export(self):
        """Test is_inter_state with export."""
        result = is_inter_state("07AAAAA1234A1ZA", "96-Other Countries")
        assert result is True

    def test_is_inter_state_empty_inputs(self):
        """Test is_inter_state with empty inputs."""
        assert is_inter_state("", "") is False
        assert is_inter_state("07AAAAA1234A1ZA", "") is False
        assert is_inter_state("", "07-Delhi") is False

    def test_get_invoice_totals(self):
        """Test get_invoice_totals function."""
        invoice = {
            "items": [
                {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
                {"taxable_value": 50000, "igst_amount": 9000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            ]
        }
        totals = get_invoice_totals(invoice)
        
        assert totals["taxable_value"] == 150000
        assert totals["igst_amount"] == 27000
        assert totals["cgst_amount"] == 0
        assert totals["sgst_amount"] == 0
        assert totals["cess_amount"] == 0
        assert totals["total_tax"] == 27000

    def test_get_invoice_totals_empty_items(self):
        """Test get_invoice_totals with empty items."""
        invoice = {"items": []}
        totals = get_invoice_totals(invoice)
        
        assert totals["taxable_value"] == 0.0
        assert totals["total_tax"] == 0.0


class TestGenerateGSTR3BSummary:
    """Tests for generate_gstr3b_summary function."""

    def test_empty_data(self):
        """Test with empty data."""
        result = generate_gstr3b_summary({})
        
        assert "3.1a" in result
        assert "3.1b" in result
        assert "3.1c" in result
        assert "3.1d" in result
        assert "3.2" in result
        
        # All values should be 0
        for section in result:
            assert result[section]["taxable_value"] == 0.0
            assert result[section]["igst_amount"] == 0.0

    def test_b2b_intra_state_goes_to_3_1c(self):
        """Test B2B intra-state supply goes to 3.1(c)."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",  # Same as company state
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1c"]["taxable_value"] == 100000.0
        assert result["3.1c"]["cgst_amount"] == 9000.0
        assert result["3.1c"]["sgst_amount"] == 9000.0

    def test_b2b_inter_state_goes_to_3_1a(self):
        """Test B2B inter-state supply goes to 3.1(a)."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "27-Maharashtra",  # Different from company state
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1a"]["taxable_value"] == 100000.0
        assert result["3.1a"]["igst_amount"] == 18000.0

    def test_b2b_reverse_charge_goes_to_3_1d(self):
        """Test B2B reverse charge supply goes to 3.1(d)."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "reverse_charge": True,
                    "items": [
                        {"taxable_value": 50000, "igst_amount": 9000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1d"]["taxable_value"] == 50000.0
        assert result["3.1d"]["igst_amount"] == 9000.0

    def test_b2cl_goes_to_3_1b(self):
        """Test B2CL invoices go to 3.1(b)."""
        data = {
            "b2b": [],
            "b2cl": [
                {
                    "place_of_supply": "27-Maharashtra",  # B2CL is always inter-state
                    "items": [
                        {"taxable_value": 300000, "igst_amount": 54000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1b"]["taxable_value"] == 300000.0
        assert result["3.1b"]["igst_amount"] == 54000.0

    def test_b2cs_intra_state_goes_to_3_1c(self):
        """Test B2CS intra-state goes to 3.1(c)."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [
                {
                    "place_of_supply": "07-Delhi",  # Same as company state
                    "items": [
                        {"taxable_value": 5000, "igst_amount": 0, "cgst_amount": 450, "sgst_amount": 450, "cess_amount": 0}
                    ]
                }
            ],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1c"]["taxable_value"] == 5000.0
        assert result["3.1c"]["cgst_amount"] == 450.0

    def test_b2cs_inter_state_goes_to_3_1b(self):
        """Test B2CS inter-state goes to 3.1(b)."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [
                {
                    "place_of_supply": "27-Maharashtra",  # Different from company state
                    "items": [
                        {"taxable_value": 5000, "igst_amount": 900, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1b"]["taxable_value"] == 5000.0
        assert result["3.1b"]["igst_amount"] == 900.0

    def test_exports_go_to_3_2(self):
        """Test export invoices go to 3.2."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [
                {
                    "place_of_supply": "96-Other Countries",
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data)
        
        assert result["3.2"]["taxable_value"] == 100000.0
        assert result["3.2"]["igst_amount"] == 18000.0

    def test_cdnr_inter_state_goes_to_3_1a(self):
        """Test CDNR inter-state goes to 3.1(a)."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 10000, "igst_amount": 1800, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1a"]["taxable_value"] == 10000.0

    def test_cdnur_inter_state_goes_to_3_1b(self):
        """Test CDNUR inter-state goes to 3.1(b)."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 5000, "igst_amount": 900, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1b"]["taxable_value"] == 5000.0

    def test_all_sections_accumulated(self):
        """Test that values are accumulated correctly across all sections."""
        data = {
            "b2b": [
                # Intra-state B2B
                {
                    "place_of_supply": "07-Delhi",
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                    ]
                },
                # Inter-state B2B
                {
                    "place_of_supply": "27-Maharashtra",
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 200000, "igst_amount": 36000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                },
            ],
            "b2cl": [
                {
                    "place_of_supply": "08-Rajasthan",
                    "items": [
                        {"taxable_value": 300000, "igst_amount": 36000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cs": [
                {
                    "place_of_supply": "07-Delhi",  # Intra-state
                    "items": [
                        {"taxable_value": 50000, "igst_amount": 0, "cgst_amount": 4500, "sgst_amount": 4500, "cess_amount": 0}
                    ]
                }
            ],
            "export": [
                {
                    "place_of_supply": "96-Other Countries",
                    "items": [
                        {"taxable_value": 150000, "igst_amount": 27000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        # 3.1(a): Inter-state B2B = 200000
        assert result["3.1a"]["taxable_value"] == 200000.0
        
        # 3.1(b): B2CL (300000) + inter-state B2CS = 300000
        assert result["3.1b"]["taxable_value"] == 300000.0
        
        # 3.1(c): Intra-state B2B (100000) + B2CS (50000) = 150000
        assert result["3.1c"]["taxable_value"] == 150000.0
        
        # 3.2: Exports = 150000
        assert result["3.2"]["taxable_value"] == 150000.0

    def test_values_rounded_to_2_decimal_places(self):
        """Test that all values are rounded to 2 decimal places."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100.333333, "igst_amount": 0, "cgst_amount": 9.033333, "sgst_amount": 9.033333, "cess_amount": 0.333333}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        assert result["3.1c"]["taxable_value"] == 100.33
        assert result["3.1c"]["cgst_amount"] == 9.03
        assert result["3.1c"]["sgst_amount"] == 9.03


class TestGenerateGSTR3BJSONFormat:
    """Tests for generate_gstr3b_json_format function."""

    def test_generate_json_format_structure(self):
        """Test that generated JSON has correct structure."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_json_format(
            data,
            company_gstin="07AAAAA1234A1ZA",
            return_period="03/2024"
        )
        
        assert result["gstin"] == "07AAAAA1234A1ZA"
        assert result["ret_period"] == "03/2024"
        assert "outward_supplies_details" in result
        assert "reverse_charge_details" in result
        assert "zero_rated_supplies" in result

    def test_generate_json_with_data(self):
        """Test JSON format with sample data."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_json_format(data, company_gstin="07AAAAA1234A1ZA", return_period="03/2024")
        
        inter_state = result["outward_supplies_details"]["inter_state_supplies"]
        assert len(inter_state) == 2  # 3.1a and 3.1b
        
        # Check 3.1a values
        assert inter_state[0]["taxable_value"] == 100000
        assert inter_state[0]["igst_amount"] == 18000


class TestGSTR3BSectionDescriptions:
    """Tests for GSTR-3B section descriptions."""

    def test_section_descriptions(self):
        """Test that all sections have correct descriptions."""
        result = generate_gstr3b_summary({})
        
        assert result["3.1a"]["description"] == "Outward Taxable Supplies (Inter State, Registered)"
        assert result["3.1b"]["description"] == "Outward Taxable Supplies (Inter State, Unregistered)"
        assert result["3.1c"]["description"] == "Outward Taxable Supplies (Intra State)"
        assert result["3.1d"]["description"] == "Outward Taxable Supplies (Reverse Charge)"
        assert result["3.2"]["description"] == "Zero Rated Supplies (Export)"

    def test_all_amount_fields_present(self):
        """Test that all sections have all amount fields."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",
                    "reverse_charge": False,
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary(data, company_gstin="07AAAAA1234A1ZA")
        
        for section in result:
            assert "taxable_value" in result[section]
            assert "igst_amount" in result[section]
            assert "cgst_amount" in result[section]
            assert "sgst_amount" in result[section]
            assert "cess_amount" in result[section]


class TestGenerateGSTR3BSummaryV2:
    """Tests for generate_gstr3b_summary_v2 function.
    
    This version aggregates GSTR-1 data as per user specification:
    - 3.1(a): B2B + B2CL + B2CS
    - 3.1(b): Exports (EXP)
    - 3.2: B2CS inter-state only
    - 3.1(c): Credit Notes (CDNR)
    - 3.1(d): Credit Notes (CDNUR)
    """

    def test_empty_data_v2(self):
        """Test with empty data (v2)."""
        result = generate_gstr3b_summary_v2({})
        
        assert "3.1a" in result
        assert "3.1b" in result
        assert "3.1c" in result
        assert "3.1d" in result
        assert "3.2" in result
        
        # All values should be 0
        for section in result:
            assert result[section]["taxable_value"] == 0.0
            assert result[section]["igst_amount"] == 0.0

    def test_b2b_goes_to_3_1a_v2(self):
        """Test B2B invoices go to 3.1(a) in v2."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # B2B should go to 3.1(a)
        assert result["3.1a"]["taxable_value"] == 100000.0
        assert result["3.1a"]["cgst_amount"] == 9000.0
        assert result["3.1a"]["sgst_amount"] == 9000.0

    def test_b2cl_goes_to_3_1a_v2(self):
        """Test B2CL invoices go to 3.1(a) in v2."""
        data = {
            "b2b": [],
            "b2cl": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 300000, "igst_amount": 54000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # B2CL should go to 3.1(a)
        assert result["3.1a"]["taxable_value"] == 300000.0
        assert result["3.1a"]["igst_amount"] == 54000.0

    def test_b2cs_goes_to_3_1a_and_3_2_v2(self):
        """Test B2CS invoices go to both 3.1(a) and 3.2 in v2."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [
                {
                    "place_of_supply": "27-Maharashtra",  # Inter-state
                    "items": [
                        {"taxable_value": 50000, "igst_amount": 9000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                },
                {
                    "place_of_supply": "07-Delhi",  # Intra-state
                    "items": [
                        {"taxable_value": 30000, "igst_amount": 0, "cgst_amount": 2700, "sgst_amount": 2700, "cess_amount": 0}
                    ]
                }
            ],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # All B2CS should go to 3.1(a)
        assert result["3.1a"]["taxable_value"] == 80000.0  # 50000 + 30000
        assert result["3.1a"]["igst_amount"] == 9000.0
        assert result["3.1a"]["cgst_amount"] == 2700.0
        assert result["3.1a"]["sgst_amount"] == 11700.0  # 9000 + 2700
        
        # Only inter-state B2CS should go to 3.2
        assert result["3.2"]["taxable_value"] == 50000.0
        assert result["3.2"]["igst_amount"] == 9000.0

    def test_exports_go_to_3_1b_v2(self):
        """Test export invoices go to 3.1(b) in v2."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [
                {
                    "place_of_supply": "96-Other Countries",
                    "items": [
                        {"taxable_value": 150000, "igst_amount": 27000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data)
        
        # Exports should go to 3.1(b)
        assert result["3.1b"]["taxable_value"] == 150000.0
        assert result["3.1b"]["igst_amount"] == 27000.0

    def test_cdnr_goes_to_3_1c_v2(self):
        """Test CDNR (Credit Notes - Registered) goes to 3.1(c) in v2."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 10000, "igst_amount": 1800, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # CDNR should go to 3.1(c)
        assert result["3.1c"]["taxable_value"] == 10000.0
        assert result["3.1c"]["igst_amount"] == 1800.0

    def test_cdnur_goes_to_3_1d_v2(self):
        """Test CDNUR (Credit Notes - Unregistered) goes to 3.1(d) in v2."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 5000, "igst_amount": 900, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # CDNUR should go to 3.1(d)
        assert result["3.1d"]["taxable_value"] == 5000.0
        assert result["3.1d"]["igst_amount"] == 900.0

    def test_all_sections_accumulated_v2(self):
        """Test that values are accumulated correctly across all sections in v2."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 0}
                    ]
                },
            ],
            "b2cl": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 300000, "igst_amount": 54000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cs": [
                {
                    "place_of_supply": "27-Maharashtra",  # Inter-state
                    "items": [
                        {"taxable_value": 50000, "igst_amount": 9000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "export": [
                {
                    "place_of_supply": "96-Other Countries",
                    "items": [
                        {"taxable_value": 150000, "igst_amount": 27000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "cdnr": [
                {
                    "place_of_supply": "07-Delhi",
                    "items": [
                        {"taxable_value": 5000, "igst_amount": 0, "cgst_amount": 450, "sgst_amount": 450, "cess_amount": 0}
                    ]
                }
            ],
            "cdnur": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 2500, "igst_amount": 450, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        # 3.1(a): B2B + B2CL + B2CS = 100000 + 300000 + 50000 = 450000
        assert result["3.1a"]["taxable_value"] == 450000.0
        
        # 3.1(b): Exports = 150000
        assert result["3.1b"]["taxable_value"] == 150000.0
        
        # 3.1(c): CDNR = 5000
        assert result["3.1c"]["taxable_value"] == 5000.0
        
        # 3.1(d): CDNUR = 2500
        assert result["3.1d"]["taxable_value"] == 2500.0
        
        # 3.2: B2CS inter-state only = 50000
        assert result["3.2"]["taxable_value"] == 50000.0


class TestGenerateGSTR3BJSONFormatV2:
    """Tests for generate_gstr3b_json_format_v2 function."""

    def test_generate_json_format_v2_structure(self):
        """Test that generated JSON (v2) has correct structure."""
        data = {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_json_format_v2(
            data,
            company_gstin="07AAAAA1234A1ZA",
            return_period="03/2024"
        )
        
        assert result["gstin"] == "07AAAAA1234A1ZA"
        assert result["ret_period"] == "03/2024"
        assert "outward_supplies_details" in result
        assert "amendments_details" in result
        assert "inter_state_supplies_b2cs" in result

    def test_generate_json_v2_with_data(self):
        """Test JSON format (v2) with sample data."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "27-Maharashtra",
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 18000, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_json_format_v2(
            data,
            company_gstin="07AAAAA1234A1ZA",
            return_period="03/2024"
        )
        
        # Check 3_1_a values
        assert result["outward_supplies_details"]["3_1_a"]["taxable_value"] == 100000
        assert result["outward_supplies_details"]["3_1_a"]["igst_amount"] == 18000


class TestGSTR3BV2SectionDescriptions:
    """Tests for GSTR-3B v2 section descriptions."""

    def test_v2_section_descriptions(self):
        """Test that v2 sections have correct descriptions."""
        result = generate_gstr3b_summary_v2({})
        
        assert result["3.1a"]["description"] == "Outward Taxable Supplies (Other than Zero Rated, Nil Rated, Exempt)"
        assert result["3.1b"]["description"] == "Zero Rated Supplies (Export)"
        assert result["3.1c"]["description"] == "Credit Notes (Registered Persons)"
        assert result["3.1d"]["description"] == "Debit/Credit Notes (Unregistered Persons)"
        assert result["3.2"]["description"] == "Inter-State Supplies to Unregistered Persons"

    def test_v2_all_amount_fields_present(self):
        """Test that v2 sections have all amount fields."""
        data = {
            "b2b": [
                {
                    "place_of_supply": "07-Delhi",
                    "items": [
                        {"taxable_value": 100000, "igst_amount": 0, "cgst_amount": 9000, "sgst_amount": 9000, "cess_amount": 500}
                    ]
                }
            ],
            "b2cl": [],
            "b2cs": [],
            "export": [],
            "cdnr": [],
            "cdnur": [],
        }
        
        result = generate_gstr3b_summary_v2(data, company_gstin="07AAAAA1234A1ZA")
        
        for section in result:
            assert "taxable_value" in result[section]
            assert "igst_amount" in result[section]
            assert "cgst_amount" in result[section]
            assert "sgst_amount" in result[section]
            assert "cess_amount" in result[section]
