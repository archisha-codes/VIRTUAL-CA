import logging
from typing import Any, Dict, List, Optional
import sys
import os

from india_compliance.gst_india.constants import GST_TAX_TYPES

# Set up logging with rotating file handler
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'logs')
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB per log file
BACKUP_COUNT = 5  # Keep 5 backup log files

# Create logs directory if it doesn't exist
os.makedirs(LOG_DIR, exist_ok=True)

# Set up logger for this module
logger = logging.getLogger("gstr3b_data")
logger.setLevel(logging.DEBUG)

# Create rotating file handler for all logs
log_file = os.path.join(LOG_DIR, 'gstr3b.log')
file_handler = logging.RotatingFileHandler(
    log_file, maxBytes=MAX_LOG_SIZE, backupCount=BACKUP_COUNT
)
file_handler.setLevel(logging.DEBUG)

# Create console handler for warnings and errors
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.WARNING)

# Create formatter with timestamp
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# TODO: These imports reference Frappe modules that need to be replaced
# from india_compliance.gst_india.overrides.transaction import is_inter_state_supply
# from india_compliance.gst_india.utils.gstr_1 import GSTR1_SubCategory

logger = logging.getLogger(__name__)

# B2C Large threshold (₹2.5 lakh)
B2C_LARGE_THRESHOLD = 250000


def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    return round(float(value), precision)


def get_state_code(place_of_supply: str) -> str:
    """Extract state code from place of supply."""
    if not place_of_supply:
        return ""
    if "-" in place_of_supply:
        return place_of_supply.split("-")[0].strip()
    return place_of_supply[:2] if len(place_of_supply) >= 2 else place_of_supply


def is_inter_state(company_gstin: str, place_of_supply: str) -> bool:
    """Check if supply is inter-state based on company GSTIN and place of supply."""
    if not company_gstin or not place_of_supply:
        return False
    company_state = company_gstin[:2]
    supply_state = get_state_code(place_of_supply)
    return company_state != supply_state


def get_invoice_totals(invoice: Dict[str, Any]) -> Dict[str, float]:
    """Calculate total amounts from invoice items."""
    totals = {
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
        "total_tax": 0.0,
    }
    for item in invoice.get("items", []):
        totals["taxable_value"] += flt(item.get("taxable_value"))
        totals["igst_amount"] += flt(item.get("igst_amount"))
        totals["cgst_amount"] += flt(item.get("cgst_amount"))
        totals["sgst_amount"] += flt(item.get("sgst_amount"))
        totals["cess_amount"] += flt(item.get("cess_amount"))
    totals["total_tax"] = (
        totals["igst_amount"]
        + totals["cgst_amount"]
        + totals["sgst_amount"]
        + totals["cess_amount"]
    )
    return totals


def generate_gstr3b_summary(
    data: Dict[str, Any], company_gstin: str = ""
) -> Dict[str, Any]:
    """
    Generate GSTR-3B summary from GSTR-1 processed data.

    This function aggregates data from GSTR-1 categories to create the GSTR-3B
    output tax liability summary as per the GST Portal JSON format.

    Args:
        data: Dictionary containing GSTR-1 processed data with keys:
            - b2b: List of B2B invoices
            - b2cl: List of B2C Large invoices (inter-state, > ₹2.5 lakh)
            - b2cs: List of B2C Small invoices
            - export: List of export invoices
            - cdnr: List of credit/debit notes for registered persons
            - cdnur: List of credit/debit notes for unregistered persons
            - nil_exempt: List of nil-rated/exempt/non-GST invoices
        company_gstin: Company's GSTIN for inter-state/intra-state determination

    Returns:
        Dictionary with GSTR-3B section keys matching GST Portal format:
            - 3.1a: Outward taxable supplies (inter-state) to registered persons
            - 3.1b: Outward taxable supplies (inter-state) to unregistered persons
            - 3.1c: Outward taxable supplies (intra-state)
            - 3.1d: Reverse charge supplies
            - 3.2: Zero-rated supplies (exports)
    """
    logger.info("Starting GSTR-3B summary generation from GSTR-1 data")

    # Initialize summary structure as per GST Portal format
    gstr3b_summary = {
        "3.1a": {
            "description": "Outward Taxable Supplies (Inter State, Registered)",
            "taxable_value": 0.0,
            "igst_amount": 0.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
        "3.1b": {
            "description": "Outward Taxable Supplies (Inter State, Unregistered)",
            "taxable_value": 0.0,
            "igst_amount": 0.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
        "3.1c": {
            "description": "Outward Taxable Supplies (Intra State)",
            "taxable_value": 0.0,
            "igst_amount": 0.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
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
            "taxable_value": 0.0,
            "igst_amount": 0.0,
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "cess_amount": 0.0,
        },
    }

    # Process B2B invoices
    for invoice in data.get("b2b", []):
        totals = get_invoice_totals(invoice)
        place_of_supply = invoice.get("place_of_supply", "")
        reverse_charge = invoice.get("reverse_charge", False)

        if is_inter_state(company_gstin, place_of_supply):
            if reverse_charge:
                # 3.1(d): Reverse charge supplies
                gstr3b_summary["3.1d"]["taxable_value"] += totals["taxable_value"]
                gstr3b_summary["3.1d"]["igst_amount"] += totals["igst_amount"]
                gstr3b_summary["3.1d"]["cgst_amount"] += totals["cgst_amount"]
                gstr3b_summary["3.1d"]["sgst_amount"] += totals["sgst_amount"]
                gstr3b_summary["3.1d"]["cess_amount"] += totals["cess_amount"]
            else:
                # 3.1(a): Inter-state supplies to registered persons
                gstr3b_summary["3.1a"]["taxable_value"] += totals["taxable_value"]
                gstr3b_summary["3.1a"]["igst_amount"] += totals["igst_amount"]
                gstr3b_summary["3.1a"]["cgst_amount"] += totals["cgst_amount"]
                gstr3b_summary["3.1a"]["sgst_amount"] += totals["sgst_amount"]
                gstr3b_summary["3.1a"]["cess_amount"] += totals["cess_amount"]
        else:
            # 3.1(c): Intra-state supplies
            gstr3b_summary["3.1c"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1c"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1c"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1c"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1c"]["cess_amount"] += totals["cess_amount"]

    # Process B2CL invoices (inter-state B2C > ₹2.5 lakh)
    for invoice in data.get("b2cl", []):
        totals = get_invoice_totals(invoice)
        # B2CL is always inter-state
        gstr3b_summary["3.1b"]["taxable_value"] += totals["taxable_value"]
        gstr3b_summary["3.1b"]["igst_amount"] += totals["igst_amount"]
        gstr3b_summary["3.1b"]["cgst_amount"] += totals["cgst_amount"]
        gstr3b_summary["3.1b"]["sgst_amount"] += totals["sgst_amount"]
        gstr3b_summary["3.1b"]["cess_amount"] += totals["cess_amount"]

    # Process B2CS invoices (B2C small / others)
    for invoice in data.get("b2cs", []):
        totals = get_invoice_totals(invoice)
        place_of_supply = invoice.get("place_of_supply", "")

        if is_inter_state(company_gstin, place_of_supply):
            # 3.1(b): Inter-state supplies to unregistered persons
            gstr3b_summary["3.1b"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1b"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1b"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1b"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1b"]["cess_amount"] += totals["cess_amount"]
        else:
            # 3.1(c): Intra-state supplies
            gstr3b_summary["3.1c"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1c"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1c"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1c"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1c"]["cess_amount"] += totals["cess_amount"]

    # Process Export invoices (zero-rated supplies)
    for invoice in data.get("export", []):
        totals = get_invoice_totals(invoice)
        # All exports are zero-rated with IGST
        gstr3b_summary["3.2"]["taxable_value"] += totals["taxable_value"]
        gstr3b_summary["3.2"]["igst_amount"] += totals["igst_amount"]
        gstr3b_summary["3.2"]["cgst_amount"] += totals["cgst_amount"]
        gstr3b_summary["3.2"]["sgst_amount"] += totals["sgst_amount"]
        gstr3b_summary["3.2"]["cess_amount"] += totals["cess_amount"]

    # Process CDNR invoices (credit/debit notes for registered persons)
    for invoice in data.get("cdnr", []):
        totals = get_invoice_totals(invoice)
        place_of_supply = invoice.get("place_of_supply", "")

        if is_inter_state(company_gstin, place_of_supply):
            # 3.1(a): Inter-state supplies to registered persons
            gstr3b_summary["3.1a"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1a"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1a"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1a"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1a"]["cess_amount"] += totals["cess_amount"]
        else:
            # 3.1(c): Intra-state supplies
            gstr3b_summary["3.1c"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1c"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1c"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1c"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1c"]["cess_amount"] += totals["cess_amount"]

    # Process CDNUR invoices (credit/debit notes for unregistered persons)
    for invoice in data.get("cdnur", []):
        totals = get_invoice_totals(invoice)
        place_of_supply = invoice.get("place_of_supply", "")

        if is_inter_state(company_gstin, place_of_supply):
            # 3.1(b): Inter-state supplies to unregistered persons
            gstr3b_summary["3.1b"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1b"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1b"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1b"]["sgst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1b"]["cess_amount"] += totals["cess_amount"]
        else:
            # 3.1(c): Intra-state supplies
            gstr3b_summary["3.1c"]["taxable_value"] += totals["taxable_value"]
            gstr3b_summary["3.1c"]["igst_amount"] += totals["igst_amount"]
            gstr3b_summary["3.1c"]["cgst_amount"] += totals["cgst_amount"]
            gstr3b_summary["3.1c"]["sgst_amount"] += totals["sgst_amount"]
            gstr3b_summary["3.1c"]["cess_amount"] += totals["cess_amount"]

    # Round all values to 2 decimal places
    for section in gstr3b_summary:
        for key in gstr3b_summary[section]:
            if isinstance(gstr3b_summary[section][key], float):
                gstr3b_summary[section][key] = round(gstr3b_summary[section][key], 2)

    logger.info("GSTR-3B summary generation completed")
    return gstr3b_summary


def generate_gstr3b_json_format(
    data: Dict[str, Any], company_gstin: str = "", return_period: str = ""
) -> Dict[str, Any]:
    """
    Generate complete GSTR-3B JSON structure for GST Portal upload.

    Args:
        data: GSTR-1 processed data dictionary
        company_gstin: Company's GSTIN
        return_period: Return period in format MM/YYYY

    Returns:
        Complete GSTR-3B JSON structure ready for portal upload
    """
    summary = generate_gstr3b_summary(data, company_gstin)

    gstr3b_json = {
        "gstin": company_gstin,
        "ret_period": return_period,
        "outward_supplies_details": {
            "inter_state_supplies": [
                {
                    "place_of_supply": summary["3.1a"]["description"],
                    "taxable_value": summary["3.1a"]["taxable_value"],
                    "igst_amount": summary["3.1a"]["igst_amount"],
                    "cgst_amount": summary["3.1a"]["cgst_amount"],
                    "sgst_amount": summary["3.1a"]["sgst_amount"],
                    "cess_amount": summary["3.1a"]["cess_amount"],
                },
                {
                    "place_of_supply": summary["3.1b"]["description"],
                    "taxable_value": summary["3.1b"]["taxable_value"],
                    "igst_amount": summary["3.1b"]["igst_amount"],
                    "cgst_amount": summary["3.1b"]["cgst_amount"],
                    "sgst_amount": summary["3.1b"]["sgst_amount"],
                    "cess_amount": summary["3.1b"]["cess_amount"],
                },
            ],
            "intra_state_supplies": {
                "taxable_value": summary["3.1c"]["taxable_value"],
                "cgst_amount": summary["3.1c"]["cgst_amount"],
                "sgst_amount": summary["3.1c"]["sgst_amount"],
                "cess_amount": summary["3.1c"]["cess_amount"],
            },
        },
        "reverse_charge_details": {
            "outward_reverse_charge": {
                "taxable_value": summary["3.1d"]["taxable_value"],
                "igst_amount": summary["3.1d"]["igst_amount"],
                "cgst_amount": summary["3.1d"]["cgst_amount"],
                "sgst_amount": summary["3.1d"]["sgst_amount"],
                "cess_amount": summary["3.1d"]["cess_amount"],
            }
        },
        "zero_rated_supplies": {
            "export_with_payment": {
                "taxable_value": summary["3.2"]["taxable_value"],
                "igst_amount": summary["3.2"]["igst_amount"],
                "cgst_amount": summary["3.2"]["cgst_amount"],
                "sgst_amount": summary["3.2"]["sgst_amount"],
                "cess_amount": summary["3.2"]["cess_amount"],
            }
        },
    }

    return gstr3b_json


def generate_gstr3b_summary_v2(
    data: Dict[str, Any], company_gstin: str = ""
) -> Dict[str, Any]:
    """
    Generate GSTR-3B summary from GSTR-1 parsed data.
    
    This function aggregates GSTR-1 category data into GSTR-3B output sections
    as per the GST Portal JSON format with detailed section mapping.
    
    GSTR-3B Section Mapping:
    -------------------------
    
    Section 3.1(a): Outward Taxable Supplies (Other than Zero Rated, Nil Rated, Exempt)
        - Aggregates: B2B + B2CL + B2CS
        - All taxable outward supplies except exports and credit notes
        
    Section 3.1(b): Zero Rated Supplies (Export)
        - Aggregates: EXP (Exports)
        - Exports with payment of tax (zero-rated supplies)
        
    Section 3.1(c): Credit Notes
        - Aggregates: CDNR (Credit/Debit Notes for Registered Persons)
        - Adjustments for credit notes issued to registered taxpayers
        
    Section 3.1(d): Debit Notes / Unregistered Credit Notes
        - Aggregates: CDNUR (Credit/Debit Notes for Unregistered Persons)
        - Adjustments for credit/debit notes issued to unregistered taxpayers
        
    Section 3.2: Inter-State Supplies to Unregistered Persons (B2CS Inter-state only)
        - Aggregates: B2CS (inter-state only)
        - B2C small supplies delivered inter-state to unregistered persons
    
    Args:
        data: Dictionary containing GSTR-1 parsed data with keys:
            - b2b: List of B2B invoices (registered persons with GSTIN)
            - b2cl: List of B2C Large invoices (>₹2.5 lakh)
            - b2cs: List of B2C Small invoices (others)
            - export: List of export invoices
            - cdnr: List of credit/debit notes for registered persons
            - cdnur: List of credit/debit notes for unregistered persons
        company_gstin: Company's GSTIN for inter-state/intra-state determination
        
    Returns:
        Dictionary with GSTR-3B section keys:
            {
                "3.1a": {description, taxable_value, igst_amount, cgst_amount, sgst_amount, cess_amount},
                "3.1b": {...},
                "3.1c": {...},
                "3.1d": {...},
                "3.2": {...}
            }
    """
    logger.info("Starting GSTR-3B summary generation (v2) from GSTR-1 data")
    
    # =========================================================================
    # SECTION 3.1(a): Outward Taxable Supplies (Other than Zero Rated, Nil Rated, Exempt)
    # This section captures all taxable outward supplies that are:
    # - B2B: Supplies to registered persons
    # - B2CL: B2C large supplies (>₹2.5 lakh, always inter-state)
    # - B2CS: B2C small supplies (all, both inter and intra state)
    # =========================================================================
    section_3_1a = {
        "description": "Outward Taxable Supplies (Other than Zero Rated, Nil Rated, Exempt)",
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
    }
    
    # =========================================================================
    # SECTION 3.1(b): Zero Rated Supplies (Export)
    # Exports are zero-rated supplies where IGST is paid and later refunded/claimed
    # =========================================================================
    section_3_1b = {
        "description": "Zero Rated Supplies (Export)",
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
    }
    
    # =========================================================================
    # SECTION 3.1(c): Credit Notes
    # CDNR: Credit/Debit Notes issued to registered persons (GSTIN available)
    # These adjust the output tax liability for the original B2B supplies
    # =========================================================================
    section_3_1c = {
        "description": "Credit Notes (Registered Persons)",
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
    }
    
    # =========================================================================
    # SECTION 3.1(d): Debit Notes / Credit Notes (Unregistered Persons)
    # CDNUR: Credit/Debit Notes issued to unregistered persons (no GSTIN)
    # These adjust the output tax liability for B2C supplies
    # =========================================================================
    section_3_1d = {
        "description": "Debit/Credit Notes (Unregistered Persons)",
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
    }
    
    # =========================================================================
    # SECTION 3.2: Inter-State Supplies to Unregistered Persons
    # B2CS Inter-state only: B2C small supplies delivered inter-state
    # This is a subset of B2CS that is specifically inter-state
    # =========================================================================
    section_3_2 = {
        "description": "Inter-State Supplies to Unregistered Persons",
        "taxable_value": 0.0,
        "igst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "cess_amount": 0.0,
    }
    
    # -------------------------------------------------------------------------
    # Process B2B Invoices (Registered Persons)
    # B2B invoices go to Section 3.1(a)
    # -------------------------------------------------------------------------
    for invoice in data.get("b2b", []):
        totals = get_invoice_totals(invoice)
        section_3_1a["taxable_value"] += totals["taxable_value"]
        section_3_1a["igst_amount"] += totals["igst_amount"]
        section_3_1a["cgst_amount"] += totals["cgst_amount"]
        section_3_1a["sgst_amount"] += totals["sgst_amount"]
        section_3_1a["cess_amount"] += totals["cess_amount"]
    
    # -------------------------------------------------------------------------
    # Process B2CL Invoices (B2C Large, >₹2.5 lakh)
    # B2CL invoices always go to Section 3.1(a)
    # B2CL is always inter-state by definition
    # -------------------------------------------------------------------------
    for invoice in data.get("b2cl", []):
        totals = get_invoice_totals(invoice)
        section_3_1a["taxable_value"] += totals["taxable_value"]
        section_3_1a["igst_amount"] += totals["igst_amount"]
        section_3_1a["cgst_amount"] += totals["cgst_amount"]
        section_3_1a["sgst_amount"] += totals["sgst_amount"]
        section_3_1a["cess_amount"] += totals["cess_amount"]
    
    # -------------------------------------------------------------------------
    # Process B2CS Invoices (B2C Small / Others)
    # B2CS invoices go to:
    #   - Section 3.1(a): All B2CS (taxable value aggregation)
    #   - Section 3.2: Only inter-state B2CS
    # -------------------------------------------------------------------------
    for invoice in data.get("b2cs", []):
        totals = get_invoice_totals(invoice)
        place_of_supply = invoice.get("place_of_supply", "")
        
        # Add all B2CS to Section 3.1(a)
        section_3_1a["taxable_value"] += totals["taxable_value"]
        section_3_1a["igst_amount"] += totals["igst_amount"]
        section_3_1a["cgst_amount"] += totals["cgst_amount"]
        section_3_1a["sgst_amount"] += totals["sgst_amount"]
        section_3_1a["cess_amount"] += totals["cess_amount"]
        
        # Add only inter-state B2CS to Section 3.2
        if is_inter_state(company_gstin, place_of_supply):
            section_3_2["taxable_value"] += totals["taxable_value"]
            section_3_2["igst_amount"] += totals["igst_amount"]
            section_3_2["cgst_amount"] += totals["cgst_amount"]
            section_3_2["sgst_amount"] += totals["sgst_amount"]
            section_3_2["cess_amount"] += totals["cess_amount"]
    
    # -------------------------------------------------------------------------
    # Process Export Invoices (Zero-Rated Supplies)
    # Exports go to Section 3.1(b)
    # -------------------------------------------------------------------------
    for invoice in data.get("export", []):
        totals = get_invoice_totals(invoice)
        section_3_1b["taxable_value"] += totals["taxable_value"]
        section_3_1b["igst_amount"] += totals["igst_amount"]
        section_3_1b["cgst_amount"] += totals["cgst_amount"]
        section_3_1b["sgst_amount"] += totals["sgst_amount"]
        section_3_1b["cess_amount"] += totals["cess_amount"]
    
    # -------------------------------------------------------------------------
    # Process CDNR (Credit/Debit Notes for Registered Persons)
    # CDNR goes to Section 3.1(c)
    # -------------------------------------------------------------------------
    for invoice in data.get("cdnr", []):
        totals = get_invoice_totals(invoice)
        section_3_1c["taxable_value"] += totals["taxable_value"]
        section_3_1c["igst_amount"] += totals["igst_amount"]
        section_3_1c["cgst_amount"] += totals["cgst_amount"]
        section_3_1c["sgst_amount"] += totals["sgst_amount"]
        section_3_1c["cess_amount"] += totals["cess_amount"]
    
    # -------------------------------------------------------------------------
    # Process CDNUR (Credit/Debit Notes for Unregistered Persons)
    # CDNUR goes to Section 3.1(d)
    # -------------------------------------------------------------------------
    for invoice in data.get("cdnur", []):
        totals = get_invoice_totals(invoice)
        section_3_1d["taxable_value"] += totals["taxable_value"]
        section_3_1d["igst_amount"] += totals["igst_amount"]
        section_3_1d["cgst_amount"] += totals["cgst_amount"]
        section_3_1d["sgst_amount"] += totals["sgst_amount"]
        section_3_1d["cess_amount"] += totals["cess_amount"]
    
    # Round all values to 2 decimal places
    def round_section(section):
        return {k: round(v, 2) if isinstance(v, float) else v for k, v in section.items()}
    
    gstr3b_summary = {
        "3.1a": round_section(section_3_1a),
        "3.1b": round_section(section_3_1b),
        "3.1c": round_section(section_3_1c),
        "3.1d": round_section(section_3_1d),
        "3.2": round_section(section_3_2),
    }
    
    logger.info("GSTR-3B summary (v2) generation completed")
    return gstr3b_summary


def generate_gstr3b_json_format_v2(
    data: Dict[str, Any], company_gstin: str = "", return_period: str = ""
) -> Dict[str, Any]:
    """
    Generate complete GSTR-3B JSON structure for GST Portal upload.
    
    Uses the v2 aggregation logic from generate_gstr3b_summary_v2().
    
    Args:
        data: GSTR-1 processed data dictionary
        company_gstin: Company's GSTIN
        return_period: Return period in format MM/YYYY
        
    Returns:
        Complete GSTR-3B JSON structure ready for portal upload
    """
    summary = generate_gstr3b_summary_v2(data, company_gstin)
    
    gstr3b_json = {
        "gstin": company_gstin,
        "ret_period": return_period,
        "outward_supplies_details": {
            "3_1_a": {
                "description": summary["3.1a"]["description"],
                "taxable_value": summary["3.1a"]["taxable_value"],
                "igst_amount": summary["3.1a"]["igst_amount"],
                "cgst_amount": summary["3.1a"]["cgst_amount"],
                "sgst_amount": summary["3.1a"]["sgst_amount"],
                "cess_amount": summary["3.1a"]["cess_amount"],
            },
            "3_1_b": {
                "description": summary["3.1b"]["description"],
                "taxable_value": summary["3.1b"]["taxable_value"],
                "igst_amount": summary["3.1b"]["igst_amount"],
                "cgst_amount": summary["3.1b"]["cgst_amount"],
                "sgst_amount": summary["3.1b"]["sgst_amount"],
                "cess_amount": summary["3.1b"]["cess_amount"],
            },
        },
        "amendments_details": {
            "3_1_c": {
                "description": summary["3.1c"]["description"],
                "taxable_value": summary["3.1c"]["taxable_value"],
                "igst_amount": summary["3.1c"]["igst_amount"],
                "cgst_amount": summary["3.1c"]["cgst_amount"],
                "sgst_amount": summary["3.1c"]["sgst_amount"],
                "cess_amount": summary["3.1c"]["cess_amount"],
            },
            "3_1_d": {
                "description": summary["3.1d"]["description"],
                "taxable_value": summary["3.1d"]["taxable_value"],
                "igst_amount": summary["3.1d"]["igst_amount"],
                "cgst_amount": summary["3.1d"]["cgst_amount"],
                "sgst_amount": summary["3.1d"]["sgst_amount"],
                "cess_amount": summary["3.1d"]["cess_amount"],
            },
        },
        "inter_state_supplies_b2cs": {
            "description": summary["3.2"]["description"],
            "taxable_value": summary["3.2"]["taxable_value"],
            "igst_amount": summary["3.2"]["igst_amount"],
            "cgst_amount": summary["3.2"]["cgst_amount"],
            "sgst_amount": summary["3.2"]["sgst_amount"],
            "cess_amount": summary["3.2"]["cess_amount"],
        },
    }
    
    return gstr3b_json


# Placeholder for is_inter_state_supply
def is_inter_state_supply(invoice):
    """
    TODO: Replace with actual implementation when database schema is available.
    """
    return False


PURCHASE_CATEGORY_CONDITIONS = {
    "Composition Scheme, Exempted, Nil Rated": {
        "category": "is_composition_nil_rated_or_exempted",
        "sub_category": "set_for_composition_nil_rated_or_exempted",
    },
    "Non-GST": {
        "category": "is_non_gst",
        "sub_category": "set_for_non_gst",
    },
    "ITC Available": {
        "category": "is_itc_available",
        "sub_category": "set_for_itc_available",
    },
    "Ineligible ITC": {
        "category": "is_ineligible_itc",
        "sub_category": "set_for_ineligible_itc",
    },
    # keep always after ITC available
    "ITC Reversed": {
        "category": "is_itc_reversed",
        "sub_category": "set_for_itc_reversed",
    },
}

BOE_CATEGORY_CONDITIONS = {
    "ITC Available": {
        "category": "is_itc_available_for_boe",
        "sub_category": "set_for_itc_available_boe",
    },
    "ITC Reversed": {
        "category": "is_itc_reversed_for_boe",
        "sub_category": "set_for_itc_reversed",
    },
}

JE_CATEGORY_CONDITIONS = {
    "ITC Reversed": {
        "category": "is_itc_reversed_for_je",
        "sub_category": "set_for_itc_reversed",
    },
    "ITC Reclaimed": {
        "category": "is_itc_reclaimed",
        "sub_category": "set_for_itc_reclaimed",
    },
}

DOCTYPE_CONDITION_MAP = {
    "Purchase Invoice": PURCHASE_CATEGORY_CONDITIONS,
    "Bill of Entry": BOE_CATEGORY_CONDITIONS,
    "Journal Entry": JE_CATEGORY_CONDITIONS,
}

AMOUNT_FIELDS = (
    "igst_amount",
    "cgst_amount",
    "sgst_amount",
    "cess_amount",
    "total_tax",
    "total_amount",
)


# Placeholder for frappe.get_cached_doc
def get_cached_doc(doctype, name=None):
    """
    TODO: Replace with actual database retrieval when schema is available.
    """
    return {}


class GSTR3BCategoryConditions:
    def is_composition_nil_rated_or_exempted(self, invoice):
        return invoice.gst_category != "Overseas" and (
            invoice.gst_treatment == "Nil-Rated"
            or invoice.gst_treatment == "Exempted"
            or invoice.gst_category == "Registered Composition"
        )

    def is_non_gst(self, invoice):
        return invoice.gst_category != "Overseas" and invoice.gst_treatment == "Non-GST"

    def is_itc_available(self, invoice):
        return invoice.ineligibility_reason != "ITC restricted due to PoS rules"

    def is_itc_reversed(self, invoice):
        return invoice.ineligibility_reason == "Ineligible As Per Section 17(5)"

    def is_ineligible_itc(self, invoice):
        return invoice.ineligibility_reason == "ITC restricted due to PoS rules"

    def is_itc_available_for_boe(self, invoice):
        return True

    def is_itc_reversed_for_boe(self, invoice):
        return invoice.is_ineligible_for_itc

    def is_itc_reversed_for_je(self, invoice):
        return invoice.ineligibility_type == "Reversal Of ITC"

    def is_itc_reclaimed(self, invoice):
        return invoice.ineligibility_type == "Reclaim of ITC Reversal"


class GSTR3BSubcategory(GSTR3BCategoryConditions):
    def set_for_composition_nil_rated_or_exempted(self, invoice):
        invoice.invoice_sub_category = "Composition Scheme, Exempted, Nil Rated"

    def set_for_non_gst(self, invoice):
        invoice.invoice_sub_category = "Non-GST"

    def set_for_itc_available(self, invoice):
        invoice.invoice_sub_category = invoice.itc_classification

    def set_for_itc_reversed(self, invoice):
        invoice.invoice_sub_category = (
            "As per rules 42 & 43 of CGST Rules and section 17(5)"
        )

    def set_for_ineligible_itc(self, invoice):
        invoice.invoice_sub_category = "ITC restricted due to PoS rules"

    def set_for_itc_available_boe(self, invoice):
        invoice.invoice_sub_category = "Import Of Goods"

    def set_for_itc_reclaimed(self, invoice):
        invoice.invoice_sub_category = "Reclaim of ITC Reversal"


class GSTR3BQuery:
    def __init__(self, filters):
        # Replaced frappe._dict with native dict
        self.filters = dict(filters or {})
        
        # TODO: Replace with actual database query builder when schema is available
        # self.PI = frappe.qb.DocType("Purchase Invoice")
        # self.PI_ITEM = frappe.qb.DocType("Purchase Invoice Item")
        # self.BOE = frappe.qb.DocType("Bill of Entry")
        # self.BOE_ITEM = frappe.qb.DocType("Bill of Entry Item")
        # self.JE = frappe.qb.DocType("Journal Entry")
        # self.JE_ACCOUNT = frappe.qb.DocType("Journal Entry Account")

    def get_base_purchase_query(self):
        """
        TODO: Replace with actual database query when schema is available.
        Current implementation uses frappe.qb.
        """
        return []

    def get_base_boe_query(self):
        """
        TODO: Replace with actual database query when schema is available.
        """
        return []

    def get_base_je_query(self):
        """
        TODO: Replace with actual database query when schema is available.
        """
        return []

    def get_query_with_common_filters(self, query, doc):
        """
        TODO: Replace with actual query builder when schema is available.
        """
        return query


class GSTR3BInvoices(GSTR3BQuery, GSTR3BSubcategory):
    def get_data(self, doctype, group_by_invoice=False):
        """
        TODO: Replace with actual database query when schema is available.
        """
        return []

    def get_processed_invoices(self, doctype, data):
        """
        TODO: Replace with actual processing when data structure is available.
        """
        return data or []

    def update_tax_values(self, invoice):
        inter = intra = 0

        if is_inter_state_supply(invoice):
            inter = invoice.taxable_value
        else:
            intra = invoice.taxable_value

        invoice.update(
            {
                "inter": inter,
                "intra": intra,
                "invoice_type": "Inter State" if inter else "Intra State",
            }
        )

    def process_uom(self, invoice, identified_uom):
        """
        TODO: Replace with actual UOM processing when GST settings are available.
        """
        if invoice.gst_hsn_code and invoice.gst_hsn_code.startswith("99"):
            invoice["uom"] = "OTH-OTHERS"
            return

        uom = invoice.get("uom", "")
        if uom in identified_uom:
            invoice["uom"] = identified_uom[uom]
        else:
            # Placeholder: get_full_gst_uom needs frappe.get_cached_doc("GST Settings")
            identified_uom[uom] = uom
            invoice["uom"] = uom

    def set_invoice_category(self, invoice, conditions):
        for category, functions in conditions.items():
            if getattr(self, functions["category"], None)(invoice):
                invoice.invoice_category = category
                return

    def set_invoice_sub_category(self, invoice, conditions):
        category = invoice.invoice_category
        function = conditions[category]["sub_category"]
        getattr(self, function, None)(invoice)

    def get_invoice_wise_data(self, invoices):
        invoice_wise_data = {}
        for invoice in invoices:
            key = f"{invoice.voucher_no}-{invoice.invoice_category}-{invoice.invoice_sub_category}"

            if key not in invoice_wise_data:
                invoice_wise_data[key] = invoice
            else:
                for field in AMOUNT_FIELDS:
                    invoice_wise_data[key][field] += invoice[field]

        return list(invoice_wise_data.values())

    def get_filtered_invoices(self, invoices, subcategories):
        if not subcategories:
            return invoices

        return [
            invoice
            for invoice in invoices
            if invoice.invoice_sub_category in subcategories
        ]


class GSTR3BOutputSummary:
    """
    Compute GSTR-3B output tax liability sections based on GSTR-1 summary data.

    GSTR-3B Sections:
    - Section 3.1: Outward Taxable Supplies (other than zero-rated, nil-rated, and exempt)
      - 3.1(a): Inter State supplies to registered persons
      - 3.1(b): Inter State supplies to unregistered persons
      - 3.1(c): Intra State supplies
    - Section 3.2: Outward Taxable Supplies (zero-rated)
    - Section 4: Inward Taxable Supplies (reverse charge)
    - Section 5: Exempted/Nil-rated/Non-GST supplies
    """

    def __init__(self, filters=None):
        # Replaced frappe._dict with native dict
        self.filters = dict(filters or {})
        # TODO: Replace with actual database query builder when schema is available
        # self.si = frappe.qb.DocType("Sales Invoice")
        # self.si_item = frappe.qb.DocType("Sales Invoice Item")

    def get_summary(self):
        """
        Get complete GSTR-3B output tax liability summary.
        Returns a dictionary with all sections populated.
        """
        logger.info("Starting GSTR-3B summary computation")
        
        # TODO: Replace with actual database query when schema is available
        # invoices = self._get_gstr1_invoices()
        invoices = []
        logger.info(f"Fetched {len(invoices)} invoices for GSTR-3B summary")
        
        summary = {
            "section_3_1": self._get_section_3_1_summary(invoices),
            "section_3_2": self._get_section_3_2_summary(invoices),
            "section_4": self._get_section_4_summary(invoices),
            "section_5": self._get_section_5_summary(invoices),
        }
        
        logger.info("GSTR-3B summary computation completed")
        return summary

    def _get_gstr1_invoices(self):
        """Fetch and process GSTR-1 invoices for the given period."""
        logger.debug(f"Fetching GSTR-1 invoices with filters: {self.filters}")
        # TODO: Replace with actual database query when schema is available
        # query = self._build_base_query()
        # invoices = query.run(as_dict=True)
        invoices = []
        logger.debug(f"Retrieved {len(invoices)} invoices")
        return invoices

    def _build_base_query(self):
        """
        TODO: Replace with actual database query builder when schema is available.
        """
        return None

    def _is_inter_state(self, invoice):
        """Check if invoice is inter-state supply."""
        if not invoice.place_of_supply:
            return False
        return invoice.company_gstin[:2] != invoice.place_of_supply[:2]

    def _is_nil_rated_exempted_or_non_gst(self, invoice):
        """Check if invoice is nil-rated, exempted, or non-GST."""
        return invoice.gst_treatment in ("Nil-Rated", "Exempted", "Non-GST")

    def _is_export_with_payment(self, invoice):
        """Check if invoice is export with payment of tax."""
        return (
            invoice.place_of_supply == "96-Other Countries"
            and invoice.gst_category == "Overseas"
            and not self._is_nil_rated_exempted_or_non_gst(invoice)
        )

    def _is_b2b_invoice(self, invoice):
        """Check if invoice is B2B (registered person with GSTIN)."""
        return (
            invoice.billing_address_gstin
            and not self._is_nil_rated_exempted_or_non_gst(invoice)
            and not (invoice.is_return or invoice.is_debit_note)
            and invoice.place_of_supply != "96-Other Countries"
        )

    def _is_b2cl_invoice(self, invoice):
        """Check if invoice is B2CL (large B2C inter-state)."""
        # TODO: Replace with actual implementation when get_b2c_limit is available
        # from india_compliance.gst_india.utils.gstr_1 import get_b2c_limit
        return (
            not invoice.billing_address_gstin
            and not self._is_nil_rated_exempted_or_non_gst(invoice)
            and not (invoice.is_return or invoice.is_debit_note)
            and invoice.place_of_supply != "96-Other Countries"
            and self._is_inter_state(invoice)
        )

    def _is_b2cs_invoice(self, invoice):
        """Check if invoice is B2CS (other B2C)."""
        return (
            not invoice.billing_address_gstin
            and not self._is_nil_rated_exempted_or_non_gst(invoice)
            and invoice.place_of_supply != "96-Other Countries"
            and not self._is_b2cl_invoice(invoice)
        )

    def _get_section_3_1_summary(self, invoices):
        """
        Section 3.1: Outward Taxable Supplies (other than zero-rated, nil-rated, and exempt)
        - 3.1(a): Inter State supplies to registered persons
        - 3.1(b): Inter State supplies to unregistered persons
        - 3.1(c): Intra State supplies
        """
        logger.debug("Computing Section 3.1 summary (Outward Taxable Supplies)")
        summary = {
            "3_1_a": {"description": "Inter State supplies to registered persons", "taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "3_1_b": {"description": "Inter State supplies to unregistered persons", "taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "3_1_c": {"description": "Intra State supplies", "taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
        }

        for invoice in invoices:
            if self._is_nil_rated_exempted_or_non_gst(invoice):
                continue
            if invoice.is_return or invoice.is_debit_note:
                continue
            if self._is_export_with_payment(invoice):
                continue

            if self._is_b2b_invoice(invoice):
                # 3.1(a): Inter State supplies to registered persons
                if self._is_inter_state(invoice):
                    summary["3_1_a"]["taxable_value"] += invoice.taxable_value
                    summary["3_1_a"]["igst_amount"] += invoice.igst_amount
                    summary["3_1_a"]["cgst_amount"] += invoice.cgst_amount
                    summary["3_1_a"]["sgst_amount"] += invoice.sgst_amount
                    summary["3_1_a"]["cess_amount"] += invoice.cess_amount
                else:
                    # 3.1(c): Intra State supplies
                    summary["3_1_c"]["taxable_value"] += invoice.taxable_value
                    summary["3_1_c"]["igst_amount"] += invoice.igst_amount
                    summary["3_1_c"]["cgst_amount"] += invoice.cgst_amount
                    summary["3_1_c"]["sgst_amount"] += invoice.sgst_amount
                    summary["3_1_c"]["cess_amount"] += invoice.cess_amount
            elif self._is_b2cl_invoice(invoice) or self._is_b2cs_invoice(invoice):
                # 3.1(b): Inter State supplies to unregistered persons
                if self._is_inter_state(invoice):
                    summary["3_1_b"]["taxable_value"] += invoice.taxable_value
                    summary["3_1_b"]["igst_amount"] += invoice.igst_amount
                    summary["3_1_b"]["cgst_amount"] += invoice.cgst_amount
                    summary["3_1_b"]["sgst_amount"] += invoice.sgst_amount
                    summary["3_1_b"]["cess_amount"] += invoice.cess_amount
                else:
                    # 3.1(c): Intra State supplies
                    summary["3_1_c"]["taxable_value"] += invoice.taxable_value
                    summary["3_1_c"]["igst_amount"] += invoice.igst_amount
                    summary["3_1_c"]["cgst_amount"] += invoice.cgst_amount
                    summary["3_1_c"]["sgst_amount"] += invoice.sgst_amount
                    summary["3_1_c"]["cess_amount"] += invoice.cess_amount

        logger.debug(f"Section 3.1 summary computed: {summary}")
        return summary

    def _get_section_3_2_summary(self, invoices):
        """
        Section 3.2: Outward Taxable Supplies (zero-rated)
        - Exports with payment of tax
        """
        logger.debug("Computing Section 3.2 summary (Zero rated supplies)")
        summary = {
            "3_2": {"description": "Zero rated supplies (Export)", "taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
        }

        for invoice in invoices:
            if self._is_export_with_payment(invoice):
                summary["3_2"]["taxable_value"] += invoice.taxable_value
                summary["3_2"]["igst_amount"] += invoice.igst_amount
                summary["3_2"]["cgst_amount"] += invoice.cgst_amount
                summary["3_2"]["sgst_amount"] += invoice.sgst_amount
                summary["3_2"]["cess_amount"] += invoice.cess_amount

        logger.debug(f"Section 3.2 summary computed: {summary}")
        return summary

    def _get_section_4_summary(self, invoices):
        """
        Section 4: Inward Taxable Supplies (reverse charge)
        - B2B Reverse Charge invoices
        """
        logger.debug("Computing Section 4 summary (Inward supplies - reverse charge)")
        summary = {
            "4": {"description": "Inward supplies (liable to reverse charge)", "taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
        }

        for invoice in invoices:
            if invoice.gst_category == "Reverse Charge":
                summary["4"]["taxable_value"] += invoice.taxable_value
                summary["4"]["igst_amount"] += invoice.igst_amount
                summary["4"]["cgst_amount"] += invoice.cgst_amount
                summary["4"]["sgst_amount"] += invoice.sgst_amount
                summary["4"]["cess_amount"] += invoice.cess_amount

        logger.debug(f"Section 4 summary computed: {summary}")
        return summary

    def _get_section_5_summary(self, invoices):
        """
        Section 5: Exempted/Nil-rated/Non-GST supplies
        """
        logger.debug("Computing Section 5 summary (Exempted/Nil-rated/Non-GST supplies)")
        summary = {
            "5": {"description": "Exempted (including Nil rated, Non-GST supplies)", "inter_state": 0, "intra_state": 0},
        }

        for invoice in invoices:
            if not self._is_nil_rated_exempted_or_non_gst(invoice):
                continue

            if self._is_inter_state(invoice):
                summary["5"]["inter_state"] += invoice.taxable_value
            else:
                summary["5"]["intra_state"] += invoice.taxable_value

        logger.debug(f"Section 5 summary computed: {summary}")
        return summary

    def get_gstr1_summary(self):
        """
        Get GSTR-1 summary data categorized by type.
        Returns breakdown by B2B, B2CL, B2CS, Exports categories.
        """
        logger.info("Computing GSTR-1 summary from invoices")
        invoices = self._get_gstr1_invoices()
        
        summary = {
            "b2b": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "b2cl": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "b2cs": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "exports": {"taxable_value": 0, "igst_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "cess_amount": 0},
            "nil_exempt_non_gst": {"inter_state": 0, "intra_state": 0},
        }

        for invoice in invoices:
            if self._is_b2b_invoice(invoice):
                summary["b2b"]["taxable_value"] += invoice.taxable_value
                summary["b2b"]["igst_amount"] += invoice.igst_amount
                summary["b2b"]["cgst_amount"] += invoice.cgst_amount
                summary["b2b"]["sgst_amount"] += invoice.sgst_amount
                summary["b2b"]["cess_amount"] += invoice.cess_amount
            elif self._is_b2cl_invoice(invoice):
                summary["b2cl"]["taxable_value"] += invoice.taxable_value
                summary["b2cl"]["igst_amount"] += invoice.igst_amount
                summary["b2cl"]["cgst_amount"] += invoice.cgst_amount
                summary["b2cl"]["sgst_amount"] += invoice.sgst_amount
                summary["b2cl"]["cess_amount"] += invoice.cess_amount
            elif self._is_b2cs_invoice(invoice):
                summary["b2cs"]["taxable_value"] += invoice.taxable_value
                summary["b2cs"]["igst_amount"] += invoice.igst_amount
                summary["b2cs"]["cgst_amount"] += invoice.cgst_amount
                summary["b2cs"]["sgst_amount"] += invoice.sgst_amount
                summary["b2cs"]["cess_amount"] += invoice.cess_amount
            elif self._is_export_with_payment(invoice):
                summary["exports"]["taxable_value"] += invoice.taxable_value
                summary["exports"]["igst_amount"] += invoice.igst_amount
                summary["exports"]["cgst_amount"] += invoice.cgst_amount
                summary["exports"]["sgst_amount"] += invoice.sgst_amount
                summary["exports"]["cess_amount"] += invoice.cess_amount
            elif self._is_nil_rated_exempted_or_non_gst(invoice):
                if self._is_inter_state(invoice):
                    summary["nil_exempt_non_gst"]["inter_state"] += invoice.taxable_value
                else:
                    summary["nil_exempt_non_gst"]["intra_state"] += invoice.taxable_value

        logger.info(f"GSTR-1 summary computed: {summary}")
        return summary
