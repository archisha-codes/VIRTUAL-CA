"""
GSTR Export Utilities
Generate Excel and JSON exports for GSTR-1 and GSTR-3B data
"""

import io
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("gstr_export")


def generate_gstr1_template() -> io.BytesIO:
    """
    Generate a GSTR-1 Excel template with required sheets.
    Returns BytesIO buffer containing the Excel file.
    """
    try:
        import pandas as pd
        
        buffer = io.BytesIO()
        
        # Create Excel writer
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # B2B Sheet
            b2b_columns = ["GSTIN/UIN of Recipient", "Recipient Name", "Invoice Number", 
                          "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge",
                          "Taxable Value", "Rate", "Integrated Tax Amount", 
                          "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"]
            b2b_df = pd.DataFrame(columns=b2b_columns)
            b2b_df.to_excel(writer, sheet_name="B2B", index=False)
            
            # B2CL Sheet
            b2cl_columns = ["Invoice Number", "Invoice date", "Invoice Value", 
                           "Place Of Supply", "Taxable Value", "Rate", 
                           "Integrated Tax Amount", "Cess Amount"]
            b2cl_df = pd.DataFrame(columns=b2cl_columns)
            b2cl_df.to_excel(writer, sheet_name="B2CL", index=False)
            
            # B2CS Sheet
            b2cs_columns = ["Type", "Place Of Supply", "Taxable Value", "Rate",
                           "Integrated Tax Amount", "Central Tax Amount", 
                           "State/UT Tax Amount", "Cess Amount"]
            b2cs_df = pd.DataFrame(columns=b2cs_columns)
            b2cs_df.to_excel(writer, sheet_name="B2CS", index=False)
            
            # EXP Sheet
            exp_columns = ["Export Type", "Invoice Number", "Invoice date", 
                          "Invoice Value", "Taxable Value", "Rate",
                          "Integrated Tax Amount", "Port Code", "Shipping Bill Number",
                          "Shipping Bill Date"]
            exp_df = pd.DataFrame(columns=exp_columns)
            exp_df.to_excel(writer, sheet_name="EXP", index=False)
            
            # CDNR Sheet
            cdnr_columns = ["GSTIN/UIN of Recipient", "Recipient Name", "Note Number",
                           "Note date", "Note Value", "Place Of Supply", "Reverse Charge",
                           "Taxable Value", "Rate", "Integrated Tax Amount",
                           "Central Tax Amount", "State/UT Tax Amount", "Cess Amount",
                           "Note Type"]
            cdnr_df = pd.DataFrame(columns=cdnr_columns)
            cdnr_df.to_excel(writer, sheet_name="CDNR", index=False)
            
            # CDNUR Sheet
            cdnur_columns = ["Note Type", "UR Number", "Note date", "Note Value",
                            "Place Of Supply", "Taxable Value", "Rate",
                            "Integrated Tax Amount", "Cess Amount"]
            cdnur_df = pd.DataFrame(columns=cdnur_columns)
            cdnur_df.to_excel(writer, sheet_name="CDNUR", index=False)
            
            # Nil Rated Sheet
            nil_columns = ["Description", "Nil Rated Amount", "Exempt Amount", "Non-GST Amount"]
            nil_df = pd.DataFrame(columns=nil_columns)
            nil_df.to_excel(writer, sheet_name="NIL Rated", index=False)
        
        buffer.seek(0)
        logger.info("GSTR-1 template generated successfully")
        return buffer
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-1 template: {str(e)}")
        raise


def generate_gstr1_excel(data: Dict[str, Any]) -> io.BytesIO:
    """
    Generate GSTR-1 Excel from processed data.
    Returns BytesIO buffer containing the Excel file.
    """
    try:
        import pandas as pd
        
        buffer = io.BytesIO()
        
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # B2B data
            b2b = data.get("b2b", [])
            if b2b:
                b2b_df = pd.DataFrame(b2b)
                b2b_df.to_excel(writer, sheet_name="B2B", index=False)
            
            # B2CL data
            b2cl = data.get("b2cl", [])
            if b2cl:
                b2cl_df = pd.DataFrame(b2cl)
                b2cl_df.to_excel(writer, sheet_name="B2CL", index=False)
            
            # B2CS data
            b2cs = data.get("b2cs", [])
            if b2cs:
                b2cs_df = pd.DataFrame(b2cs)
                b2cs_df.to_excel(writer, sheet_name="B2CS", index=False)
            
            # Export data
            export_data = data.get("export", [])
            if export_data:
                export_df = pd.DataFrame(export_data)
                export_df.to_excel(writer, sheet_name="EXP", index=False)
            
            # Summary sheet
            summary = {
                "Metric": ["Total Invoices", "Total Taxable Value", "Total IGST", 
                          "Total CGST", "Total SGST", "Total CESS"],
                "Value": [
                    data.get("summary", {}).get("total_invoices", 0),
                    data.get("summary", {}).get("total_taxable_value", 0),
                    data.get("summary", {}).get("total_igst", 0),
                    data.get("summary", {}).get("total_cgst", 0),
                    data.get("summary", {}).get("total_sgst", 0),
                    data.get("summary", {}).get("total_cess", 0),
                ]
            }
            summary_df = pd.DataFrame(summary)
            summary_df.to_excel(writer, sheet_name="Summary", index=False)
        
        buffer.seek(0)
        logger.info("GSTR-1 Excel generated successfully")
        return buffer
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-1 Excel: {str(e)}")
        raise


def generate_gstr3b_excel(gstr1_data: Dict[str, Any], gstr3b_summary: Dict[str, Any]) -> io.BytesIO:
    """
    Generate GSTR-3B Excel report from GSTR-1 data and summary.
    Returns BytesIO buffer containing the Excel file.
    """
    try:
        import pandas as pd
        
        buffer = io.BytesIO()
        
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # Section 3.1 Summary
            section_3_1_data = []
            
            # 3.1(a) Taxable Outward Supplies
            s3_1a = gstr3b_summary.get("3.1a", {})
            section_3_1_data.append({
                "Section": "3.1(a)",
                "Description": "Taxable Outward Supplies",
                "Taxable Value": s3_1a.get("taxable_value", 0),
                "Integrated Tax": s3_1a.get("igst_amount", 0),
                "Central Tax": s3_1a.get("cgst_amount", 0),
                "State/UT Tax": s3_1a.get("sgst_amount", 0),
                "Cess": s3_1a.get("cess_amount", 0),
            })
            
            # 3.1(b) Zero Rated Exports
            s3_1b = gstr3b_summary.get("3.1b", {})
            section_3_1_data.append({
                "Section": "3.1(b)",
                "Description": "Zero Rated Outward Supplies (Exports)",
                "Taxable Value": s3_1b.get("taxable_value", 0),
                "Integrated Tax": s3_1b.get("igst_amount", 0),
                "Central Tax": s3_1b.get("cgst_amount", 0),
                "State/UT Tax": s3_1b.get("sgst_amount", 0),
                "Cess": s3_1b.get("cess_amount", 0),
            })
            
            # 3.1(c) Nil Rated/Exempt
            s3_1c = gstr3b_summary.get("3.1c", {})
            section_3_1_data.append({
                "Section": "3.1(c)",
                "Description": "Nil Rated, Exempt and Non-GST Supplies",
                "Taxable Value": s3_1c.get("taxable_value", 0),
                "Integrated Tax": s3_1c.get("igst_amount", 0),
                "Central Tax": s3_1c.get("cgst_amount", 0),
                "State/UT Tax": s3_1c.get("sgst_amount", 0),
                "Cess": s3_1c.get("cess_amount", 0),
            })
            
            # 3.1(d) Reverse Charge
            s3_1d = gstr3b_summary.get("3.1d", {})
            section_3_1_data.append({
                "Section": "3.1(d)",
                "Description": "Outward Supplies liable to Reverse Charge",
                "Taxable Value": s3_1d.get("taxable_value", 0),
                "Integrated Tax": s3_1d.get("igst_amount", 0),
                "Central Tax": s3_1d.get("cgst_amount", 0),
                "State/UT Tax": s3_1d.get("sgst_amount", 0),
                "Cess": s3_1d.get("cess_amount", 0),
            })
            
            df_3_1 = pd.DataFrame(section_3_1_data)
            df_3_1.to_excel(writer, sheet_name="3.1 Outward Supplies", index=False)
            
            # Section 3.2 Interstate B2C
            s3_2 = gstr3b_summary.get("3.2", {})
            section_3_2_data = []
            for state, values in s3_2.items():
                section_3_2_data.append({
                    "State/UT": state,
                    "Taxable Value": values.get("taxable_value", 0),
                    "Integrated Tax": values.get("igst_amount", 0),
                    "Cess": values.get("cess_amount", 0),
                })
            
            if section_3_2_data:
                df_3_2 = pd.DataFrame(section_3_2_data)
                df_3_2.to_excel(writer, sheet_name="3.2 B2C Interstate", index=False)
            
            # Input Tax Credit Summary
            itc_data = [
                {"Description": "ITC Available", "Amount": 0},
                {"Description": "ITC Reversed", "Amount": 0},
                {"Description": "Net ITC Available", "Amount": 0},
            ]
            df_itc = pd.DataFrame(itc_data)
            df_itc.to_excel(writer, sheet_name="ITC Summary", index=False)
            
            # Tax Liability Summary
            tax_liability_data = [
                {"Description": "Output Tax - IGST", "Amount": s3_1a.get("igst_amount", 0) + s3_1b.get("igst_amount", 0)},
                {"Description": "Output Tax - CGST", "Amount": s3_1a.get("cgst_amount", 0) + s3_1b.get("cgst_amount", 0)},
                {"Description": "Output Tax - SGST", "Amount": s3_1a.get("sgst_amount", 0) + s3_1b.get("sgst_amount", 0)},
                {"Description": "Output Tax - Cess", "Amount": s3_1a.get("cess_amount", 0) + s3_1b.get("cess_amount", 0)},
            ]
            df_liability = pd.DataFrame(tax_liability_data)
            df_liability.to_excel(writer, sheet_name="Tax Liability", index=False)
        
        buffer.seek(0)
        logger.info("GSTR-3B Excel generated successfully")
        return buffer
        
    except Exception as e:
        logger.exception(f"Error generating GSTR-3B Excel: {str(e)}")
        raise


def generate_gstr1_json(data: Dict[str, Any]) -> str:
    """Generate GSTR-1 JSON output."""
    import json
    
    output = {
        "gstr1_summary": {
            "generated_at": data.get("generated_at", ""),
            "tax_period": data.get("tax_period", ""),
            "gstin": data.get("gstin", ""),
            "b2b": data.get("b2b", []),
            "b2cl": data.get("b2cl", []),
            "b2cs": data.get("b2cs", []),
            "export": data.get("export", []),
            "cdnr": data.get("cdnr", []),
            "cdnur": data.get("cdnur", []),
            "summary": data.get("summary", {}),
        }
    }
    
    return json.dumps(output, indent=2)
