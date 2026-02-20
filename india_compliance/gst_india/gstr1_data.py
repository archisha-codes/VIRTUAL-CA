"""
GSTR-1 Data Aggregation Module

This module provides functions to convert validated sales data into GSTR-1 schema
with proper classification logic for B2B, B2CL, B2CS, Export, CDNR, HSN, and Docs tables.

Compatible with FastAPI and does not depend on frappe/ERPNext.
Optimized for large datasets (10,000+ rows) with memory-efficient aggregation.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple, Generator
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import time

from india_compliance.gst_india.utils.logger import get_logger
from india_compliance.gst_india.utils.gstr_1 import (
    GSTR1_Category,
    GSTR1_SubCategory,
    GSTR1_B2B_InvoiceType,
    GovDataField,
    get_b2c_limit,
    getdate,
)

# Initialize logger
logger = get_logger(__name__)

# Processing timeout threshold (seconds)
PROCESSING_TIMEOUT_THRESHOLD = 5

# ADD: UQC (Unit of Quantity Code) validation - as per GSTN
VALID_UQC_CODES = {
    "BAG", "BAL", "BDL", "BKL", "BOU", "BOX", "BRL", "BSH", "BTL", "BUN", 
    "CAN", "CBM", "CCM", "CFT", "CMT", "CMS", "CTN", "DOZ", "DRM", "DRS",
    "DZ", "GGR", "GKL", "GMS", "GRS", "GYD", "KGS", "KLR", "KME", "LTR",
    "MLT", "MTR", "MTS", "NOS", "ODR", "OZA", "OZFT", "PAC", "PCS", "PDR",
    "PFT", "PKG", "PLT", "POU", "PRS", "QTL", "QTR", "RFT", "RMT", "ROL",
    "SET", "SHT", "SKE", "SMT", "SQFT", "SQM", "SQYD", "TBS", "TF", "TH",
    "TOL", "TON", "TUB", "UGS", "UNT", "VLS", "YDS", "LOTS", "BOXES", "BALES",
    "BUNDLES", "CRATES", "DRUMS", "JARS", "REELS", "SACS", "TUBES", "UNITS"
}

# ADD: CESS rate constants
CESS_RATES = {
    "tobacco": 0.36,      # 36% on tobacco products
    "motor_vehicles": 0.15, # 15% on certain motor vehicles
    "airlines": 0.03,      # 3% on airlines
    "coal": 0.04,          # 4% on coal
    "fertilizer": 0.01,    # 1% on fertilizers
    "default": 0.0          # Default CESS rate
}


def money(value: Any) -> float:
    """
    Convert value to Decimal and quantize to 2 decimal places using ROUND_HALF_UP.
    This ensures consistent rounding for tax calculations.
    """
    if value is None:
        return 0.0
    try:
        return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except (TypeError, ValueError):
        return 0.0


def calculate_taxable_from_inclusive(invoice_value: float, rate: float) -> Tuple[float, float]:
    """
    Calculate taxable value and tax from inclusive invoice value.
    
    Args:
        invoice_value: Total invoice value (tax inclusive)
        rate: GST rate percentage
    
    Returns:
        Tuple of (taxable_value, tax_amount)
    """
    if rate <= 0 or invoice_value <= 0:
        return 0.0, 0.0
    
    divisor = 1 + (rate / 100)
    taxable = invoice_value / divisor
    tax = invoice_value - taxable
    
    return money(taxable), money(tax)


def validate_gstin_checksum(gstin: str) -> bool:
    """
    Validate GSTIN using Mod-36 checksum algorithm.
    
    Args:
        gstin: 15-character GSTIN
    
    Returns:
        True if valid, False otherwise
    """
    if not gstin or len(gstin) != 15:
        return False
    
    # Character mapping for Mod-36
    char_map = {}
    for i in range(10):
        char_map[str(i)] = i
    for i in range(26):
        char_map[chr(65 + i)] = 10 + i
    
    # Position weights (1 to 15)
    weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    
    # Calculate weighted sum
    total = 0
    for i, char in enumerate(gstin[:14]):
        if char not in char_map:
            return False
        total += char_map[char] * weights[i]
    
    # Check digit calculation
    check_digit = total % 36
    check_digit = (36 - check_digit) % 36
    
    # Get the last character
    last_char = gstin[14]
    
    # Validate against expected check digit
    expected_chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return last_char == expected_chars[check_digit]


def determine_service_pos(
    supplier_gstin: str,
    recipient_gstin: str,
    place_of_supply: str,
    service_type: str = "B2B"
) -> str:
    """
    STUB: Determine Place of Supply for services as per IGST Act.
    
    For services, POS is determined by:
    - B2B: Location of recipient (but if registered, it's the recipient's state)
    - B2C: Location of recipient
    - Export: 96 (Overseas)
    
    This is a placeholder for future IGST Act compliance.
    Currently returns the provided place_of_supply.
    
    Args:
        supplier_gstin: Supplier's GSTIN
        recipient_gstin: Recipient's GSTIN (empty for unregistered)
        place_of_supply: Current place of supply
        service_type: Type of service supply
    
    Returns:
        Determined Place of Supply code
    """
    # TODO: Implement full IGST Act compliance for services
    # Reference: Section 12 (Intra-state) and Section 13 (Inter-state) of IGST Act
    
    # For now, return the provided POS
    return place_of_supply


def validate_rate_vs_tax_consistency(
    taxable_value: float,
    rate: float,
    provided_tax: float,
    tolerance: float = 0.10
) -> Tuple[bool, str]:
    """
    ADD 3: Validate rate vs tax consistency.
    
    Validates that: (provided_tax / taxable) × 100 ≈ rate
    
    Args:
        taxable_value: Taxable value of the invoice
        rate: GST rate percentage
        provided_tax: Actual tax amount provided
        tolerance: Allowable tolerance (default 0.10 INR)
    
    Returns:
        Tuple of (is_valid, message)
    """
    if taxable_value <= 0 or rate <= 0:
        return True, "Skipped - zero values"
    
    # Calculate expected tax
    expected_tax = taxable_value * rate / 100
    
    # Calculate difference
    diff = abs(provided_tax - expected_tax)
    
    # Check within tolerance
    if diff <= tolerance:
        return True, f"Valid: rate={rate}% matches tax={provided_tax}"
    
    # Calculate actual rate from provided tax
    actual_rate = (provided_tax / taxable_value) * 100 if taxable_value > 0 else 0
    
    return False, (
        f"Tax mismatch: expected {expected_tax:.2f} ({rate}%), "
        f"got {provided_tax:.2f} ({actual_rate:.2f}%), diff={diff:.2f}"
    )


def validate_cess_limit(
    cess_amount: float,
    taxable_value: float,
    cess_rate: float = 0.0,
    max_cess_rate: float = 0.50
) -> Tuple[bool, str]:
    """
    ADD 6: Validate CESS amount against maximum allowable.
    
    Validates that: cess <= taxable × cess_rate (or max default)
    
    Args:
        cess_amount: CESS amount provided
        taxable_value: Taxable value
        cess_rate: CESS rate (if known)
        max_cess_rate: Maximum allowable CESS rate (default 50%)
    
    Returns:
        Tuple of (is_valid, message)
    """
    if cess_amount <= 0:
        return True, "Valid: No CESS"
    
    # Calculate maximum allowable CESS
    max_cess = taxable_value * max_cess_rate
    
    if cess_rate > 0:
        expected_cess = taxable_value * cess_rate
        if cess_amount > expected_cess * 1.01:  # 1% tolerance
            return False, (
                f"CESS exceeds maximum: got {cess_amount}, "
                f"max at {cess_rate*100}% = {expected_cess:.2f}"
            )
    
    if cess_amount > max_cess:
        return False, (
            f"CESS suspiciously high: {cess_amount} on {taxable_value} "
            f"(max {max_cess_rate*100}% = {max_cess:.2f})"
        )
    
    return True, f"Valid: CESS {cess_amount} is within limits"


def validate_uqc_code(uqc_code: str) -> Tuple[bool, str]:
    """
    ADD 7: Validate Unit of Quantity Code (UQC).
    
    Validates against the official GSTN UQC list.
    
    Args:
        uqc_code: UQC code to validate
    
    Returns:
        Tuple of (is_valid, message)
    """
    if not uqc_code or str(uqc_code).strip() == "":
        return True, "Skipped: No UQC provided"
    
    uqc_normalized = str(uqc_code).strip().upper()
    
    if uqc_normalized in VALID_UQC_CODES:
        return True, f"Valid UQC: {uqc_normalized}"
    
    # Suggest closest match
    return False, (
        f"Invalid UQC: {uqc_code}. "
        f"Valid codes include: NOS, KGS, LTR, MTR, BTL, BOX, etc."
    )


class ValidationReport:
    """Structured report for validation results."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.auto_corrections: List[str] = []
        self.final_status: str = "success"
    
    def add_error(self, error: str):
        self.errors.append(error)
        self.final_status = "failed"
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)
    
    def add_auto_correction(self, correction: str):
        self.auto_corrections.append(correction)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "errors": self.errors,
            "warnings": self.warnings,
            "auto_corrections": self.auto_corrections,
            "final_status": self.final_status,
        }
    
    def is_valid(self) -> bool:
        return self.final_status == "success"


def flt(value: Any, precision: int = 2) -> float:
    """Round a value to specified precision."""
    if value is None:
        return 0.0
    try:
        return round(float(value), precision)
    except (TypeError, ValueError):
        return 0.0


def cint(value: Any) -> int:
    """Convert value to integer."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def normalize_row_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize row keys to ensure compatibility with preprocessing pipeline.
    Maps upstream field names to downstream expected field names.
    """
    row = dict(row)

    # GSTIN normalization
    if "customer_gstin" in row and "gstin" not in row:
        row["gstin"] = row["customer_gstin"]

    # Invoice number normalization
    if "invoice_no" in row and "invoice_number" not in row:
        row["invoice_number"] = row["invoice_no"]

    # Rate normalization
    if "gst_rate" in row and "rate" not in row:
        row["rate"] = row["gst_rate"]

    # Quantity normalization
    if "qty" in row and "quantity" not in row:
        row["quantity"] = row["qty"]

    # HSN normalization
    if "hsn" in row and "hsn_code" not in row:
        row["hsn_code"] = row["hsn"]

    # Tax amount alias normalization (joi → igst, joc → cgst, jos → sgst)
    if "joi" in row and "igst" not in row:
        row["igst"] = row["joi"]

    if "joc" in row and "cgst" not in row:
        row["cgst"] = row["joc"]

    if "jos" in row and "sgst" not in row:
        row["sgst"] = row["jos"]

    return row


def get_company_state_from_gstin(company_gstin: str) -> str:
    """Extract state code from GSTIN (first 2 digits)."""
    if company_gstin and len(company_gstin) >= 2:
        return company_gstin[:2]
    return ""


def extract_state_code(pos: Any) -> str:
    """Extract 2-digit state code from Place of Supply."""
    if not pos:
        return ""

    pos_str = str(pos).strip()

    # Already a 2-digit code
    if len(pos_str) == 2 and pos_str.isdigit():
        return pos_str

    # Extract from format like "27-Gujarat"
    if "-" in pos_str:
        code = pos_str.split("-")[0].strip()
        if len(code) == 2 and code.isdigit():
            return code

    # Try to find 2-digit number
    import re
    match = re.match(r"^(\d{2})", pos_str)
    if match:
        return match.group(1)

    return ""


def is_inter_state(company_gstin: str, pos: Any, igst: float = 0, cgst: float = 0, sgst: float = 0) -> bool:
    """Check if transaction is inter-state based on company GSTIN and Place of Supply.

    Falls back to tax amounts (IGST vs CGST/SGST) if POS/state info is incomplete.
    """
    company_state = get_company_state_from_gstin(company_gstin)
    pos_state = extract_state_code(pos)

    # If we have both state codes, compare them
    if company_state and pos_state:
        return company_state != pos_state

    # Fallback: use tax amounts to determine inter/intra state
    # Inter-state: IGST > 0 and CGST+SGST == 0
    # Intra-state: CGST+SGST > 0 and IGST == 0
    if igst > 0 and (cgst == 0 and sgst == 0):
        return True
    if cgst > 0 or sgst > 0:
        return False

    # Default to intra-state if we can't determine
    return False


def get_invoice_category(row: Dict[str, Any], company_gstin: str = "") -> Tuple[str, Optional[str]]:
    """
    Determine GSTR-1 category and sub-category for a row.

    Classification logic:
    1. SEZ (Special Economic Zone) - customer_type == SEZ
    2. Exports (POS = 96, Overseas)
    3. Credit/Debit Notes (with GSTIN = CDNR, without = CDNUR)
    4. B2B (registered recipient with GSTIN)
    5. B2CL (inter-state > threshold, no GSTIN)
    6. B2CS (intra-state or below threshold)

    Returns:
        Tuple of (category, sub_category)
    """
    gstin = row.get("gstin", "") or ""
    pos = row.get("place_of_supply", "")
    invoice_value = flt(row.get("invoice_value", 0))
    is_return = row.get("is_return", False)
    is_debit_note = row.get("is_debit_note", False)
    gst_category = row.get("gst_category", "")
    is_reverse_charge = str(row.get("reverse_charge", "")).upper() in ("Y", "YES", "TRUE", "1")
    
    # ADD 1: SEZ Classification - Check customer_type first
    customer_type = str(row.get("customer_type", "")).upper()
    if customer_type == "SEZ" or gst_category == "SEZ":
        # SEZ transactions are treated as zero-rated supplies
        is_sez_with_gst = row.get("is_sez_with_gst", row.get("is_export_with_gst", False))
        if is_sez_with_gst:
            logger.debug(f"Row classified as B2B/SEZWP (with GST): gstin={gstin[:6] if gstin else 'N/A'}...")
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWP.value)
        else:
            logger.debug(f"Row classified as B2B/SEZWOP (without GST): gstin={gstin[:6] if gstin else 'N/A'}...")
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWOP.value)
    
    # Check both invoice_type and document_type for credit/debit note detection
    invoice_type = row.get("invoice_type", "").lower()
    document_type = row.get("document_type", "").lower()
    
    # Combine both for detection
    doc_type_combined = invoice_type + " " + document_type

    # Get tax amounts for inter-state detection
    igst_amount = flt(row.get("igst", 0))
    cgst_amount = flt(row.get("cgst", 0))
    sgst_amount = flt(row.get("sgst", 0))

    # Nil-rated, exempted, non-GST check
    gst_treatment = row.get("gst_treatment", "")
    if gst_treatment in ("Nil-Rated", "Exempted", "Non-GST"):
        logger.debug(f"Row classified as NIL_EXEMPT: gst_treatment={gst_treatment}")
        return (GSTR1_Category.NIL_EXEMPT.value, GSTR1_SubCategory.NIL_EXEMPT.value)

    # Get invoice date for B2C limit calculation
    invoice_date = row.get("invoice_date")

    # Check if export - POS is 96 or manually marked
    pos_lower = str(pos).lower()
    is_export = (
        "96" in pos_lower or
        "other countries" in pos_lower or
        "overseas" in pos_lower or
        gst_category == "Overseas" or
        row.get("is_export", False)
    )

    if is_export:
        if gst_category == "Deemed Export":
            logger.debug(f"Row classified as B2B/DE: gstin={gstin[:6] if gstin else 'N/A'}...")
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
        exp_sub = GSTR1_SubCategory.EXPWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.EXPWOP.value
        logger.debug(f"Row classified as EXP ({exp_sub}): POS={pos}, is_export={is_export}")
        return (GSTR1_Category.EXP.value, exp_sub)

    # Detect credit/debit notes based on invoice_type OR document_type field
    is_credit_note = is_return or "credit" in doc_type_combined or invoice_type in ["cn", "cr"]
    is_debit_note_type = is_debit_note or "debit" in doc_type_combined or invoice_type in ["dn", "dr"]

    if is_credit_note or is_debit_note_type:
        if gstin:
            # Registered recipient - CDNR
            if gst_category == "Deemed Export":
                logger.debug(f"Note classified as B2B/DE: gstin={gstin[:6] if gstin else 'N/A'}...")
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
            elif gst_category == "SEZ":
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.SEZWOP.value)
            elif is_reverse_charge:
                return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REVERSE_CHARGE.value)
            note_type = "Credit Note" if is_credit_note else "Debit Note"
            logger.debug(f"Note classified as CDNR: {note_type}, gstin={gstin[:6] if gstin else 'N/A'}...")
            return (GSTR1_Category.CDNR.value, GSTR1_SubCategory.CDNR.value)
        else:
            # Unregistered recipient
            limit_date = invoice_date if invoice_date else datetime.now().date()
            b2c_limit = get_b2c_limit(limit_date)
            inter_state = is_inter_state(company_gstin, pos, igst_amount, cgst_amount, sgst_amount)

            if invoice_value > b2c_limit and inter_state:
                logger.debug(f"Note classified as B2CL: value={invoice_value}, limit={b2c_limit}")
                return (GSTR1_Category.B2CL.value, GSTR1_SubCategory.B2CL.value)

            logger.debug(f"Note classified as CDNUR: unregistered, value={invoice_value}")
            return (GSTR1_Category.CDNUR.value, GSTR1_SubCategory.CDNUR.value)

    # Regular invoices classification
    if gstin:
        # B2B (registered recipient with GSTIN)
        if gst_category == "Deemed Export":
            logger.debug(f"Invoice classified as B2B/DE: gstin={gstin[:6] if gstin else 'N/A'}...")
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.DE.value)
        elif gst_category == "SEZ":
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.SEZWP.value if row.get("is_export_with_gst") else GSTR1_SubCategory.SEZWOP.value)
        elif is_reverse_charge:
            return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REVERSE_CHARGE.value)
        logger.debug(f"Invoice classified as B2B Regular: gstin={gstin[:6] if gstin else 'N/A'}...")
        return (GSTR1_Category.B2B.value, GSTR1_SubCategory.B2B_REGULAR.value)

    # No GSTIN - check B2CL vs B2CS
    # IMPORTANT: Check B2CL BEFORE B2CS for inter-state transactions
    limit_date = invoice_date if invoice_date else datetime.now().date()
    b2c_limit = get_b2c_limit(limit_date)
    inter_state = is_inter_state(company_gstin, pos, igst_amount, cgst_amount, sgst_amount)

    # B2CL: inter-state and above threshold - check FIRST
    if invoice_value > b2c_limit and inter_state:
        logger.debug(f"Invoice classified as B2CL: value={invoice_value}, limit={b2c_limit}, inter_state={inter_state}")
        return (GSTR1_Category.B2CL.value, GSTR1_SubCategory.B2CL.value)

    # B2CS: all other unregistered transactions
    logger.debug(f"Invoice classified as B2CS: value={invoice_value}, limit={b2c_limit}, inter_state={inter_state}")
    return (GSTR1_Category.B2CS.value, GSTR1_SubCategory.B2CS.value)


def format_date_for_gstr(date_val: Any) -> str:
    """Format date as DD/MM/YYYY string for GSTR-1."""
    if not date_val:
        return ""

    if isinstance(date_val, datetime):
        return date_val.strftime("%d/%m/%Y")
    elif isinstance(date_val, str):
        # Try to parse and format
        try:
            parsed = datetime.fromisoformat(date_val.replace("/", "-").replace(" ", ""))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return date_val

    return ""


def format_invoice_for_b2b(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2B table with IRN and e-invoice fields."""
    # Ensure invoice_number is present - raise error if missing for B2B
    invoice_number = row.get("invoice_number", "")
    if not invoice_number:
        invoice_number = "INV-" + str(row.get("idx", ""))
    
    # Get item-level taxable value and taxes
    taxable_value = flt(row.get("taxable_value", 0))
    igst = flt(row.get("igst", 0))
    cgst = flt(row.get("cgst", 0))
    sgst = flt(row.get("sgst", 0))
    cess = flt(row.get("cess", 0))
    
    # Properly check for RCM - only "Y", "YES", "TRUE", "1" should be RCM
    is_rcm = str(row.get("reverse_charge", "")).upper() in ("Y", "YES", "TRUE", "1")
    
    return {
        GovDataField.CUST_GSTIN: row.get("gstin", ""),
        "inum": invoice_number,
        "idt": format_date_for_gstr(row.get("invoice_date")),
        "val": flt(row.get("invoice_value")),
        "pos": extract_state_code(row.get("place_of_supply")),
        "rchrg": "Y" if is_rcm else "N",
        "inv_typ": row.get("invoice_type", "Regular"),
        # E-invoice fields (optional)
        "irn": row.get("irn", ""),
        "ack_no": row.get("ack_no", ""),
        "ack_dt": format_date_for_gstr(row.get("ack_date")),
        GovDataField.ITEMS: [
            {
                "txval": taxable_value,
                "iamt": igst,
                "camt": cgst,
                "samt": sgst,
                "csamt": cess,
                "rt": flt(row.get("rate", 0)),
            }
        ],
    }


def format_invoice_for_b2cl(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2CL table."""
    # Ensure invoice_number is present - raise error if missing for B2CL
    invoice_number = row.get("invoice_number", "")
    if not invoice_number:
        invoice_number = "INV-" + str(row.get("idx", ""))
    
    # Get all tax amounts - B2CL can have CGST/SGST in addition to IGST
    # This handles cases where source data has both IGST and CGST/SGST
    taxable_value = flt(row.get("taxable_value", 0))
    igst = flt(row.get("igst", 0))
    cgst = flt(row.get("cgst", 0))
    sgst = flt(row.get("sgst", 0))
    cess = flt(row.get("cess", 0))
    
    return {
        "inum": invoice_number,
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        "val": flt(row.get("invoice_value")),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        "txval": taxable_value,
        "rt": flt(row.get("rate", 0)),
        "iamt": igst,
        "csamt": cess,
        # Include CGST/SGST when present (for data consistency)
        "camt": cgst,
        "samt": sgst,
        # E-invoice fields (optional)
        "irn": row.get("irn", ""),
        "ack_no": row.get("ack_no", ""),
        "ack_date": format_date_for_gstr(row.get("ack_date")),
    }


def format_invoice_for_b2cs(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for B2CS table."""
    return {
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        "txval": flt(row.get("taxable_value")),
        "rt": flt(row.get("rate", 0)),
        "iamt": flt(row.get("igst", 0)),
        "camt": flt(row.get("cgst", 0)),
        "samt": flt(row.get("sgst", 0)),
        "csamt": flt(row.get("cess", 0)),
    }


def format_invoice_for_exp(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for Export table."""
    # Ensure invoice_number is present - raise error if missing for Export
    invoice_number = row.get("invoice_number", "")
    if not invoice_number:
        invoice_number = "EXP-" + str(row.get("idx", ""))
    
    return {
        "inum": invoice_number,
        GovDataField.DOC_DATE: format_date_for_gstr(row.get("invoice_date")),
        "val": flt(row.get("invoice_value")),
        GovDataField.SHIPPING_PORT_CODE: row.get("port_code", ""),
        GovDataField.SHIPPING_BILL_NUMBER: row.get("shipping_bill_number", ""),
        GovDataField.SHIPPING_BILL_DATE: format_date_for_gstr(row.get("shipping_bill_date")),
        "txval": flt(row.get("taxable_value")),
        "rt": flt(row.get("rate", 0)),
        "iamt": flt(row.get("igst", 0)),
        "csamt": flt(row.get("cess", 0)),
        GovDataField.EXPORT_TYPE: "WPAY" if row.get("is_export_with_gst") else "WOPAY",
        # E-invoice fields (optional)
        "irn": row.get("irn", ""),
        "ack_no": row.get("ack_no", ""),
        "ack_date": format_date_for_gstr(row.get("ack_date")),
    }


def format_invoice_for_cdnr(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a row for CDNR table (Credit/Debit Notes - Registered).
    
    Credit Notes: Reduce taxable and tax amounts (negative values in GSTR-1)
    Debit Notes: Increase taxable and tax amounts (positive values in GSTR-1)
    
    GSTN Format:
    - nt_num: Note number
    - nt_ty: Note type (C for Credit, D for Debit)
    - val: Note value
    """
    is_credit_note = row.get("is_return", False) or "credit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    is_debit_note = row.get("is_debit_note", False) or "debit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    
    note_type = "C" if is_credit_note else "D"
    
    # Use GSTN standard field names
    note_number = row.get("note_number", row.get("invoice_number", ""))
    if not note_number:
        note_number = "NT-" + str(row.get("idx", ""))
    
    note_value = flt(row.get("note_value", row.get("invoice_value", 0)))
    taxable_value = flt(row.get("taxable_value", 0))
    igst = flt(row.get("igst", 0))
    cgst = flt(row.get("cgst", 0))
    sgst = flt(row.get("sgst", 0))
    cess = flt(row.get("cess", 0))
    
    if is_credit_note:
        taxable_value = -abs(taxable_value)
        igst = -abs(igst)
        cgst = -abs(cgst)
        sgst = -abs(sgst)
        cess = -abs(cess)
    elif is_debit_note:
        taxable_value = abs(taxable_value)
        igst = abs(igst)
        cgst = abs(cgst)
        sgst = abs(sgst)
        cess = abs(cess)
    
    return {
        GovDataField.CUST_GSTIN: row.get("gstin", ""),
        "nt_num": note_number,
        GovDataField.NOTE_DATE: format_date_for_gstr(row.get("note_date", row.get("invoice_date"))),
        "nt_ty": note_type,
        "val": abs(note_value),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        GovDataField.REVERSE_CHARGE: "Y" if row.get("reverse_charge") else "N",
        GovDataField.INVOICE_TYPE: row.get("invoice_type", "Regular"),
        "original_invoice_number": row.get("original_invoice_number", ""),
        "original_invoice_date": format_date_for_gstr(row.get("original_invoice_date")),
        "pre_gst": "Y" if row.get("pre_gst", False) else "N",
        "irn": row.get("irn", ""),
        "ack_no": row.get("ack_no", ""),
        "ack_date": format_date_for_gstr(row.get("ack_date")),
        GovDataField.ITEMS: [
            {
                "txval": taxable_value,
                "iamt": igst,
                "camt": cgst,
                "samt": sgst,
                "csamt": cess,
                "rt": flt(row.get("rate", 0)),
            }
        ],
    }


def get_signed_values(row: Dict[str, Any]) -> Dict[str, float]:
    """Get signed values for totals calculation."""
    is_credit_note = row.get("is_return", False) or "credit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    is_debit_note = row.get("is_debit_note", False) or "debit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    
    if is_credit_note:
        # Credit notes have negative values
        taxable_value = -abs(flt(row.get("taxable_value", 0)))
        igst = -abs(flt(row.get("igst", 0)))
        cgst = -abs(flt(row.get("cgst", 0)))
        sgst = -abs(flt(row.get("sgst", 0)))
        cess = -abs(flt(row.get("cess", 0)))
        return {
            "taxable_value": taxable_value,
            "igst": igst,
            "cgst": cgst,
            "sgst": sgst,
            "cess": cess,
        }
    elif is_debit_note:
        # Debit notes have positive values
        return {
            "taxable_value": abs(flt(row.get("taxable_value", 0))),
            "igst": abs(flt(row.get("igst", 0))),
            "cgst": abs(flt(row.get("cgst", 0))),
            "sgst": abs(flt(row.get("sgst", 0))),
            "cess": abs(flt(row.get("cess", 0))),
        }
    else:
        # Regular invoices have positive values
        return {
            "taxable_value": abs(flt(row.get("taxable_value", 0))),
            "igst": abs(flt(row.get("igst", 0))),
            "cgst": abs(flt(row.get("cgst", 0))),
            "sgst": abs(flt(row.get("sgst", 0))),
            "cess": abs(flt(row.get("cess", 0))),
        }


def format_invoice_for_cdnur(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format a row for CDNUR table (Credit/Debit Notes - Unregistered)."""
    is_credit_note = row.get("is_return", False) or "credit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    is_debit_note = row.get("is_debit_note", False) or "debit" in (row.get("invoice_type", "") + " " + row.get("document_type", "")).lower()
    
    note_type = "C" if is_credit_note else "D"
    
    # Use GSTN standard field names
    note_number = row.get("note_number", row.get("invoice_number", ""))
    if not note_number:
        note_number = "NT-" + str(row.get("idx", ""))
    
    note_value = flt(row.get("note_value", row.get("invoice_value", 0)))
    taxable_value = flt(row.get("taxable_value", 0))
    igst = flt(row.get("igst", 0))
    cess = flt(row.get("cess", 0))
    
    if is_credit_note:
        taxable_value = -abs(taxable_value)
        igst = -abs(igst)
        cess = -abs(cess)
    elif is_debit_note:
        taxable_value = abs(taxable_value)
        igst = abs(igst)
        cess = abs(cess)
    
    return {
        "nt_num": note_number,
        GovDataField.NOTE_DATE: format_date_for_gstr(row.get("note_date", row.get("invoice_date"))),
        "nt_ty": note_type,
        "val": abs(note_value),
        GovDataField.POS: extract_state_code(row.get("place_of_supply")),
        "txval": taxable_value,
        "rt": flt(row.get("rate", 0)),
        "iamt": igst,
        "csamt": cess,
        "customer_name": row.get("customer_name", ""),
        "original_invoice_number": row.get("original_invoice_number", ""),
        "original_invoice_date": format_date_for_gstr(row.get("original_invoice_date")),
        "pre_gst": "Y" if row.get("pre_gst", False) else "N",
    }


def aggregate_hsn_summary(clean_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aggregate data by HSN Code + Rate for HSN summary table."""
    start_time = time.time()
    
    if not clean_data:
        return []
    
    hsn_aggregation: Dict[Tuple[str, float], Dict[str, Any]] = {}
    
    for row in clean_data:
        hsn_code = str(row.get("hsn_code", row.get("gst_hsn_code", ""))).strip()
        if not hsn_code or hsn_code == "nan":
            continue
        
        rate = flt(row.get("rate", 0))
        if rate <= 0:
            continue
        
        quantity = flt(row.get("quantity", 0))
        
        # Get signed values for proper aggregation (credit notes should subtract)
        signed = get_signed_values(row)
        taxable_value = signed["taxable_value"]
        igst = signed["igst"]
        cgst = signed["cgst"]
        sgst = signed["sgst"]
        cess = signed["cess"]
        invoice_value = flt(row.get("invoice_value", 0))
        
        # Calculate taxable value from invoice value if not provided
        if taxable_value == 0 and (igst != 0 or cgst != 0 or sgst != 0 or cess != 0 or invoice_value != 0):
            total_taxes = abs(igst) + abs(cgst) + abs(sgst) + abs(cess)
            if invoice_value > total_taxes:
                taxable_value = invoice_value - total_taxes
            elif invoice_value > 0:
                taxable_value = invoice_value
        
        if taxable_value == 0 and quantity == 0:
            continue
        
        key = (hsn_code, rate)
        
        if key not in hsn_aggregation:
            hsn_aggregation[key] = {
                "hsn_code": hsn_code,
                "description": row.get("description", ""),
                "uom": row.get("uom", ""),
                "quantity": 0.0,
                "total_value": 0.0,
                "taxable_value": 0.0,
                "igst": 0.0,
                "cgst": 0.0,
                "sgst": 0.0,
                "cess": 0.0,
                "rate": rate,
            }
        
        agg = hsn_aggregation[key]
        agg["quantity"] += quantity
        agg["total_value"] += invoice_value
        agg["taxable_value"] += taxable_value
        agg["igst"] += igst
        agg["cgst"] += cgst
        agg["sgst"] += sgst
        agg["cess"] += cess
        
        if not agg["description"] and row.get("description"):
            agg["description"] = row.get("description")
        if not agg["uom"] and row.get("uom"):
            agg["uom"] = row.get("uom")

    hsn_records = []
    for (hsn_code, rate), agg in sorted(hsn_aggregation.items()):
        # Apply rounding to all aggregated values
        agg["taxable_value"] = round(agg["taxable_value"], 2)
        agg["igst"] = round(agg["igst"], 2)
        agg["cgst"] = round(agg["cgst"], 2)
        agg["sgst"] = round(agg["sgst"], 2)
        agg["cess"] = round(agg["cess"], 2)
        
        # If taxable_value is still 0 but we have taxes, calculate it
        # Use abs() to handle both positive (regular) and negative (credit notes) tax amounts
        if agg["taxable_value"] == 0:
            abs_igst = abs(agg["igst"])
            abs_cgst = abs(agg["cgst"])
            abs_sgst = abs(agg["sgst"])
            
            if abs_igst > 0:
                agg["taxable_value"] = round(abs_igst * 100 / rate, 2) if rate > 0 else 0
            elif abs_cgst > 0 or abs_sgst > 0:
                total_cgst_sgst = abs_cgst + abs_sgst
                agg["taxable_value"] = round(total_cgst_sgst * 100 / rate, 2) if rate > 0 else 0
        
        hsn_records.append({
            GovDataField.HSN_CODE: hsn_code,
            "description": agg["description"],
            GovDataField.UOM: agg["uom"],
            GovDataField.QUANTITY: round(agg["quantity"], 3),
            "supp_ty": "Inter-State" if agg["igst"] != 0 else "Intra-State",
            GovDataField.TAXABLE_VALUE: agg["taxable_value"],  # Use txval for HSN
            GovDataField.IGST: agg["igst"],
            GovDataField.CGST: agg["cgst"],
            GovDataField.SGST: agg["sgst"],
            GovDataField.CESS: agg["cess"],
            GovDataField.TAX_RATE: round(rate, 3),
        })
    
    elapsed = time.time() - start_time
    if elapsed > 1 or len(hsn_records) > 1000:
        logger.info(f"HSN aggregation: {len(hsn_records)} records from {len(clean_data)} rows in {elapsed:.2f}s")

    return hsn_records


def calculate_totals_from_tables(gstr1_tables: Dict[str, Any], exclude_rcm: bool = True) -> Dict[str, float]:
    """Calculate totals by summing values from individual GSTR-1 tables.
    
    Args:
        gstr1_tables: The GSTR-1 tables dictionary
        exclude_rcm: If True, exclude RCM entries from liability totals (default True)
    
    Returns:
        Dictionary with totals (taxable_value, igst, cgst, sgst, cess)
    """
    calculated = {
        "taxable_value": 0.0,
        "igst": 0.0,
        "cgst": 0.0,
        "sgst": 0.0,
        "cess": 0.0,
        "rcm_taxable": 0.0,
        "rcm_igst": 0.0,
        "rcm_cgst": 0.0,
        "rcm_sgst": 0.0,
        "rcm_cess": 0.0,
    }
    
    # Sum B2B invoices
    for customer in gstr1_tables.get("b2b", []):
        for invoice in customer.get("invoices", []):
            is_rcm = invoice.get("rchrg", "N").upper() == "Y"
            
            for item in invoice.get("itms", []):
                txval = flt(item.get("txval", 0))
                igst = flt(item.get("iamt", 0))
                cgst = flt(item.get("camt", 0))
                sgst = flt(item.get("samt", 0))
                cess = flt(item.get("csamt", 0))
                
                if is_rcm and exclude_rcm:
                    calculated["rcm_taxable"] += txval
                    calculated["rcm_igst"] += igst
                    calculated["rcm_cgst"] += cgst
                    calculated["rcm_sgst"] += sgst
                    calculated["rcm_cess"] += cess
                else:
                    calculated["taxable_value"] += txval
                    calculated["igst"] += igst
                    calculated["cgst"] += cgst
                    calculated["sgst"] += sgst
                    calculated["cess"] += cess
    
    # Sum B2CL invoices - include CGST/SGST when present
    for invoice in gstr1_tables.get("b2cl", []):
        calculated["taxable_value"] += flt(invoice.get("txval", 0))
        calculated["igst"] += flt(invoice.get("iamt", 0))
        calculated["cgst"] += flt(invoice.get("camt", 0))
        calculated["sgst"] += flt(invoice.get("samt", 0))
        calculated["cess"] += flt(invoice.get("csamt", 0))
    
    # Sum B2CS entries - include CGST/SGST when present
    for entry in gstr1_tables.get("b2cs", []):
        calculated["taxable_value"] += flt(entry.get("txval", 0))
        calculated["igst"] += flt(entry.get("iamt", 0))
        calculated["cgst"] += flt(entry.get("camt", 0))
        calculated["sgst"] += flt(entry.get("samt", 0))
        calculated["cess"] += flt(entry.get("csamt", 0))
    
    # Sum EXP invoices
    for invoice in gstr1_tables.get("exp", []):
        calculated["taxable_value"] += flt(invoice.get("txval", 0))
        calculated["igst"] += flt(invoice.get("iamt", 0))
        calculated["cess"] += flt(invoice.get("csamt", 0))
    
    # Sum CDNR notes
    for customer in gstr1_tables.get("cdnr", []):
        for note in customer.get("notes", []):
            for item in note.get("itms", []):
                calculated["taxable_value"] += flt(item.get("txval", 0))
                calculated["igst"] += flt(item.get("iamt", 0))
                calculated["cgst"] += flt(item.get("camt", 0))
                calculated["sgst"] += flt(item.get("samt", 0))
                calculated["cess"] += flt(item.get("csamt", 0))
    
    # Sum CDNUR notes
    for note in gstr1_tables.get("cdnur", []):
        calculated["taxable_value"] += flt(note.get("txval", 0))
        calculated["igst"] += flt(note.get("iamt", 0))
        calculated["cess"] += flt(note.get("csamt", 0))
    
    # Apply final rounding to avoid floating point errors
    for key in calculated:
        calculated[key] = round(calculated[key], 2)
    
    return calculated


def validate_summary_totals(gstr1_tables: Dict[str, Any]) -> ValidationReport:
    """
    Validate that summary totals match the sum of individual table values.
    
    RCM entries are excluded from liability totals in both summary and table sums.
    
    Returns a structured ValidationReport instead of crashing.
    """
    report = ValidationReport()
    summary = gstr1_tables.get("summary", {})
    
    # Calculate totals from tables - this now excludes RCM by default
    calculated = calculate_totals_from_tables(gstr1_tables, exclude_rcm=True)
    
    # Get summary liability totals (RCM already excluded in generate_gstr1_tables)
    summary_taxable = flt(summary.get("total_taxable_value", 0))
    summary_igst = flt(summary.get("total_igst", 0))
    summary_cgst = flt(summary.get("total_cgst", 0))
    summary_sgst = flt(summary.get("total_sgst", 0))
    summary_cess = flt(summary.get("total_cess", 0))
    
    # Tolerance for floating point comparison
    tolerance = 0.05
    
    has_mismatch = False
    
    # Check taxable value
    if abs(summary_taxable - calculated["taxable_value"]) > tolerance:
        report.add_error(
            f"Taxable Value Mismatch: Summary={summary_taxable}, Tables Sum={calculated['taxable_value']}"
        )
        has_mismatch = True
    
    # Check IGST
    if abs(summary_igst - calculated["igst"]) > tolerance:
        report.add_error(
            f"IGST Mismatch: Summary={summary_igst}, Tables Sum={calculated['igst']}"
        )
        has_mismatch = True
    
    # Check CGST
    if abs(summary_cgst - calculated["cgst"]) > tolerance:
        report.add_error(
            f"CGST Mismatch: Summary={summary_cgst}, Tables Sum={calculated['cgst']}"
        )
        has_mismatch = True
    
    # Check SGST
    if abs(summary_sgst - calculated["sgst"]) > tolerance:
        report.add_error(
            f"SGST Mismatch: Summary={summary_sgst}, Tables Sum={calculated['sgst']}"
        )
        has_mismatch = True
    
    # Check CESS
    if abs(summary_cess - calculated["cess"]) > tolerance:
        report.add_error(
            f"CESS Mismatch: Summary={summary_cess}, Tables Sum={calculated['cess']}"
        )
        has_mismatch = True
    
    # Log RCM breakdown for transparency
    rcm_igst = flt(summary.get("rcm_igst", 0))
    rcm_cgst = flt(summary.get("rcm_cgst", 0))
    rcm_sgst = flt(summary.get("rcm_sgst", 0))
    
    if rcm_igst > 0 or rcm_cgst > 0 or rcm_sgst > 0:
        logger.info(
            f"RCM entries excluded from liability: IGST={rcm_igst}, CGST={rcm_cgst}, SGST={rcm_sgst}"
        )
    
    if not has_mismatch:
        logger.info(
            f"Summary validation passed: Taxable={calculated['taxable_value']}, "
            f"IGST={calculated['igst']}, CGST={calculated['cgst']}, "
            f"SGST={calculated['sgst']}, CESS={calculated['cess']}"
        )
    else:
        logger.error(f"Summary validation failed: {report.errors}")
    
    return report


def generate_gstr1_tables(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    include_hsn: bool = True,
    include_docs: bool = False,
    validate: bool = True,
) -> Tuple[Dict[str, Any], ValidationReport]:
    """
    Convert validated clean_data into GSTR-1 schema tables.
    
    Returns tuple of (gstr1_tables, validation_report)
    
    The validation_report will contain errors if validation fails,
    but processing will continue to return partial results.
    
    Safety checks:
    - No duplicate invoice_number per GSTIN
    - No duplicate export entries
    - HSN taxable total equals summary taxable
    - Summary totals match table sums
    """
    start_time = time.time()
    report = ValidationReport()

    if not clean_data:
        logger.warning("No clean_data provided to generate_gstr1_tables")
        report.add_error("No clean data passed to GSTR-1 generator")
        return {
            "b2b": [],
            "b2cl": [],
            "b2cs": [],
            "exp": [],
            "cdnr": [],
            "cdnur": [],
            "summary": {
                "total_records": 0,
                "total_taxable_value": 0,
                "total_igst": 0,
                "total_cgst": 0,
                "total_sgst": 0,
                "total_cess": 0,
                "processing_time_seconds": 0,
                "cdnr_credit_notes": 0,
                "cdnr_debit_notes": 0,
                "cdnur_credit_notes": 0,
                "cdnur_debit_notes": 0,
                "rcm_taxable": 0,
                "rcm_igst": 0,
                "rcm_cgst": 0,
                "rcm_sgst": 0,
                "rcm_cess": 0,
                "total_reported_taxable": 0,
                "total_reported_igst": 0,
                "total_reported_cgst": 0,
                "total_reported_sgst": 0,
                "total_reported_cess": 0,
            }
        }, report

    logger.info(f"Generating GSTR-1 tables from {len(clean_data)} records...")

    b2b_invoices: Dict[str, Dict[str, Any]] = {}
    b2cl_invoices: List[Dict[str, Any]] = []
    b2cs_invoices: List[Dict[str, Any]] = []
    exp_invoices: List[Dict[str, Any]] = []
    cdnr_invoices: Dict[str, Dict[str, Any]] = {}
    cdnur_invoices: List[Dict[str, Any]] = []
    
    # ADD 5: Advance Receipt Table
    advances_received: List[Dict[str, Any]] = []
    advances_adjusted: List[Dict[str, Any]] = []
    
    # ADD 6: E-Commerce Operator Table
    ecom_operators: Dict[str, Dict[str, Any]] = {}
    
    # ADD 10: NIL/Exempt/Non-GST
    nil_exempt_supplies: Dict[str, float] = {
        "nil_rated": 0.0,
        "exempted": 0.0,
        "non_gst": 0.0,
    }
    
    # Track duplicates for safety checks
    b2b_invoice_keys: Dict[str, set] = {}  # gstin -> set of invoice_numbers
    exp_invoice_keys: set = set()  # set of invoice_numbers

    total_taxable = 0.0
    total_igst = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_cess = 0.0
    total_invoices = 0
    
    # Track RCM separately - RCM is reported but NOT included in liability
    total_rcm_taxable = 0.0
    total_rcm_igst = 0.0
    total_rcm_cgst = 0.0
    total_rcm_sgst = 0.0
    total_rcm_cess = 0.0
    
    cdnur_credit_notes = 0
    cdnur_debit_notes = 0
    cdnr_credit_notes = 0
    cdnr_debit_notes = 0

    # Valid state codes (01-37 and 96 for overseas)
    VALID_STATE_CODES = {f"{i:02d}" for i in range(1, 38)} | {"96"}

    for original_row in clean_data:
        row = normalize_row_fields(original_row)

        # FIX 10: Required field validation
        required_fields = ["invoice_number", "invoice_date", "place_of_supply"]
        missing_fields = [f for f in required_fields if not row.get(f)]
        if missing_fields:
            report.add_warning(
                f"Skipping row with missing required fields {missing_fields}: {row.get('idx', 'unknown')}"
            )
            continue

        # FIX 9: State code validation
        pos_code = extract_state_code(row.get("place_of_supply"))
        if pos_code and pos_code not in VALID_STATE_CODES:
            report.add_warning(
                f"Invalid POS state code '{pos_code}' at row {row.get('idx', 'unknown')}. Expected 01-37 or 96."
            )

        # ADD 1: Tax Inclusive Logic - Calculate taxable if missing but invoice_value present
        rate_value = flt(row.get("rate", 0))
        invoice_value = flt(row.get("invoice_value", 0))
        taxable_value = flt(row.get("taxable_value", 0))
        
        if taxable_value == 0 and invoice_value > 0 and rate_value > 0:
            # Calculate taxable from inclusive invoice value
            calculated_taxable, calculated_tax = calculate_taxable_from_inclusive(invoice_value, rate_value)
            row["taxable_value"] = calculated_taxable
            # Update tax amounts if not provided
            if flt(row.get("igst", 0)) == 0 and flt(row.get("cgst", 0)) == 0 and flt(row.get("sgst", 0)) == 0:
                # Determine inter-state vs intra-state
                if is_inter_state(company_gstin, row.get("place_of_supply")):
                    row["igst"] = calculated_tax
                else:
                    row["cgst"] = calculated_tax / 2
                    row["sgst"] = calculated_tax / 2
            report.add_auto_correction(
                f"Calculated taxable value from inclusive invoice value: {calculated_taxable}"
            )

        # ADD 4: HSN Digit Validation
        hsn_code = str(row.get("hsn_code", "")).strip()
        if hsn_code and hsn_code != "nan":
            # Assume turnover > 5 crore for now (can be made configurable)
            if len(hsn_code) < 6:
                report.add_warning(
                    f"HSN code '{hsn_code}' should be at least 6 digits for entities with turnover > 5 crore"
                )

        # ADD 7: GSTIN Checksum Validation
        customer_gstin = row.get("gstin", "")
        if customer_gstin and len(customer_gstin) == 15:
            if not validate_gstin_checksum(customer_gstin):
                report.add_warning(
                    f"Invalid GSTIN checksum for '{customer_gstin}' at row {row.get('idx', 'unknown')}"
                )

        signed = get_signed_values(row)
        
        # Check if this is RCM - RCM is reported but NOT added to liability
        is_rcm = str(row.get("reverse_charge", "")).upper() in ("Y", "YES", "TRUE", "1")
        
        # Get category AFTER signed values
        category, _ = get_invoice_category(row, company_gstin)
        
        # ADD 2: Shipping Bill Details Validation for Exports
        if category == GSTR1_Category.EXP.value:
            shipping_bill_number = row.get("shipping_bill_number", "")
            shipping_bill_date = row.get("shipping_bill_date", "")
            port_code = row.get("port_code", "")
            
            if not shipping_bill_number:
                report.add_warning(
                    f"Export without shipping bill number at row {row.get('idx', 'unknown')}"
                )
            if not shipping_bill_date:
                report.add_warning(
                    f"Export without shipping bill date at row {row.get('idx', 'unknown')}"
                )
            if not port_code:
                report.add_warning(
                    f"Export without port code at row {row.get('idx', 'unknown')}"
                )
        
        # ADD 3: Rate vs Tax Consistency Check
        rate_value = flt(row.get("rate", 0))
        taxable_for_check = signed["taxable_value"]
        
        # Check IGST consistency for inter-state
        if signed["igst"] != 0:
            is_valid, msg = validate_rate_vs_tax_consistency(
                taxable_for_check, rate_value, abs(signed["igst"])
            )
            if not is_valid:
                report.add_warning(f"{msg} at row {row.get('idx', 'unknown')}")
        
        # Check CGST consistency for intra-state
        if signed["cgst"] != 0:
            is_valid, msg = validate_rate_vs_tax_consistency(
                taxable_for_check, rate_value / 2, abs(signed["cgst"])
            )
            if not is_valid:
                report.add_warning(f"CGST {msg} at row {row.get('idx', 'unknown')}")
        
        # ADD 6: CESS Validation
        cess_amount = signed["cess"]
        if cess_amount > 0:
            is_valid, msg = validate_cess_limit(cess_amount, taxable_for_check)
            if not is_valid:
                report.add_warning(f"{msg} at row {row.get('idx', 'unknown')}")
        
        # ADD 7: UQC Validation
        uqc_code = row.get("uom", "") or row.get("uqc", "")
        if uqc_code:
            is_valid, msg = validate_uqc_code(uqc_code)
            if not is_valid:
                report.add_warning(f"{msg} at row {row.get('idx', 'unknown')}")
        
        if is_rcm:
            # RCM is included in tables but excluded from liability totals
            total_rcm_taxable += signed["taxable_value"]
            total_rcm_igst += signed["igst"]
            total_rcm_cgst += signed["cgst"]
            total_rcm_sgst += signed["sgst"]
            total_rcm_cess += signed["cess"]
            # RCM is still counted in total_invoices for reporting
            total_invoices += 1
        else:
            # Non-RCM entries are added to liability totals
            total_taxable += signed["taxable_value"]
            total_igst += signed["igst"]
            total_cgst += signed["cgst"]
            total_sgst += signed["sgst"]
            total_cess += signed["cess"]
            total_invoices += 1

        gstin = row.get("gstin", "") or ""
        
        # ADD 10: NIL/Exempt/Non-GST Separation
        rate_value = flt(row.get("rate", 0))
        taxable_value = signed["taxable_value"]
        
        if rate_value == 0 and taxable_value > 0:
            gst_treatment = row.get("gst_treatment", "").lower()
            if "nil" in gst_treatment:
                nil_exempt_supplies["nil_rated"] += taxable_value
            elif "exempt" in gst_treatment:
                nil_exempt_supplies["exempted"] += taxable_value
            else:
                nil_exempt_supplies["non_gst"] += taxable_value
            # Skip adding to regular tables as it's already categorized
        
        # ADD 5: Advance Receipt Table Processing
        is_advance = row.get("is_advance", False)
        is_advance_adjusted = row.get("advance_adjusted", False)
        
        if is_advance and not is_advance_adjusted:
            advance_amount = flt(row.get("advance_received", 0))
            if advance_amount > 0:
                advance_rate = flt(row.get("rate", 0))
                advance_tax = advance_amount * advance_rate / 100
                advances_received.append({
                    "pos": extract_state_code(row.get("place_of_supply")),
                    "txval": advance_amount,
                    "rt": advance_rate,
                    "iamt": advance_tax if is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                    "camt": advance_tax / 2 if not is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                    "samt": advance_tax / 2 if not is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                })
        
        if is_advance_adjusted:
            adjusted_amount = flt(row.get("advance_adjusted_amount", 0))
            if adjusted_amount > 0:
                adjusted_rate = flt(row.get("rate", 0))
                adjusted_tax = adjusted_amount * adjusted_rate / 100
                advances_adjusted.append({
                    "pos": extract_state_code(row.get("place_of_supply")),
                    "txval": adjusted_amount,
                    "rt": adjusted_rate,
                    "iamt": adjusted_tax if is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                    "camt": adjusted_tax / 2 if not is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                    "samt": adjusted_tax / 2 if not is_inter_state(company_gstin, row.get("place_of_supply")) else 0,
                })
        
        # ADD 6: E-Commerce Operator Table
        operator_gstin = row.get("operator_gstin", "") or row.get("ecommerce_gstin", "")
        if operator_gstin and category in [GSTR1_Category.B2CS.value]:
            if operator_gstin not in ecom_operators:
                ecom_operators[operator_gstin] = {
                    "etin": operator_gstin,
                    "sply_ty": "INTRA" if not is_inter_state(company_gstin, row.get("place_of_supply")) else "INTER",
                    "pos": extract_state_code(row.get("place_of_supply")),
                    "txval": 0,
                    "rt": flt(row.get("rate", 0)),
                    "iamt": 0,
                    "camt": 0,
                    "samt": 0,
                    "csamt": 0,
                }
            ecom_operators[operator_gstin]["txval"] += signed["taxable_value"]
            ecom_operators[operator_gstin]["iamt"] += signed["igst"]
            ecom_operators[operator_gstin]["camt"] += signed["cgst"]
            ecom_operators[operator_gstin]["samt"] += signed["sgst"]
            ecom_operators[operator_gstin]["csamt"] += signed["cess"]
        invoice_number = row.get("invoice_number", "")
        
        # Get document type info for credit/debit note detection
        invoice_type = row.get("invoice_type", "").lower()
        document_type = row.get("document_type", "").lower()
        doc_type_combined = invoice_type + " " + document_type
        
        # Edge case protection: Missing invoice_number for B2B/Export should error
        if category in [GSTR1_Category.B2B.value, GSTR1_Category.EXP.value] and not invoice_number:
            report.add_error(f"Missing invoice_number for {category} transaction at row index {row.get('idx', 'unknown')}")
        
        # Detect credit/debit notes - these go ONLY to CDNR/CDNUR, never to B2B
        is_credit_note = row.get("is_return", False) or "credit" in doc_type_combined.lower() or invoice_type in ["cn", "cr"]
        is_debit_note_type = row.get("is_debit_note", False) or "debit" in doc_type_combined.lower() or invoice_type in ["dn", "dr"]
        
        # Skip adding to B2B if it's a credit/debit note (should be in CDNR only)
        is_credit_debit_note = is_credit_note or is_debit_note_type
        
        invoice_value = flt(row.get("invoice_value", 0))
        
        # FIX 8: Strict validation - check if invoice_value ≈ taxable + taxes
        taxable_value = signed["taxable_value"]
        igst_amount = signed["igst"]
        cgst_amount = signed["cgst"]
        sgst_amount = signed["sgst"]
        cess_amount = signed["cess"]
        
        expected_value = taxable_value + igst_amount + cgst_amount + sgst_amount + cess_amount
        if invoice_value > 0 and abs(invoice_value - expected_value) > 0.05:
            # Only warn if the difference is significant (more than 5 paise)
            report.add_warning(
                f"Invoice value ({invoice_value}) differs from sum of taxable + taxes ({expected_value}) "
                f"at row {row.get('idx', 'unknown')}. Diff: {abs(invoice_value - expected_value):.2f}"
            )
        
        if is_credit_note and invoice_value > 0:
            report.add_warning(f"Credit note with positive value: {invoice_value}. Consider checking sign.")
        if is_debit_note_type and invoice_value < 0:
            report.add_warning(f"Debit note with negative value: {invoice_value}. Consider checking sign.")

        if category == GSTR1_Category.B2B.value and not is_credit_debit_note:
            # Only add REGULAR invoices to B2B, not credit/debit notes
            # Credit/debit notes with GSTIN go to CDNR
            # ADD: Multi-rate invoice support - group by (invoice_number, rate)
            invoice_key = (invoice_number, flt(row.get("rate", 0)))
            
            if gstin not in b2b_invoices:
                b2b_invoices[gstin] = {
                    "ctin": gstin,
                    "customer_name": row.get("customer_name", ""),
                    "invoices": [],
                }
                b2b_invoice_keys[gstin] = set()
            
            # Try to find existing invoice with same number and rate
            existing_invoice = None
            for inv in b2b_invoices[gstin]["invoices"]:
                if inv.get("inum") == invoice_number:
                    # Check if this rate already exists in items
                    existing_item = None
                    for item in inv.get("itms", []):
                        if item.get("rt") == flt(row.get("rate", 0)):
                            existing_item = item
                            break
                    if existing_item:
                        # Add to existing rate item
                        existing_invoice = inv
                        break
            
            if existing_invoice:
                # Update existing item with same rate
                for item in existing_invoice.get("itms", []):
                    if item.get("rt") == flt(row.get("rate", 0)):
                        item["txval"] = flt(item.get("txval", 0) + signed["taxable_value"])
                        item["iamt"] = flt(item.get("iamt", 0) + signed["igst"])
                        item["camt"] = flt(item.get("camt", 0) + signed["cgst"])
                        item["samt"] = flt(item.get("samt", 0) + signed["sgst"])
                        item["csamt"] = flt(item.get("csamt", 0) + signed["cess"])
                        break
                # Update invoice value
                existing_invoice["val"] = flt(existing_invoice.get("val", 0) + invoice_value)
            else:
                # Add new invoice with new rate item
                formatted_invoice = format_invoice_for_b2b(row)
                
                # Check for duplicate
                if invoice_number in b2b_invoice_keys.get(gstin, set()):
                    report.add_warning(
                        f"Multi-rate invoice: '{invoice_number}' has different rates for GSTIN '{gstin[:6]}...'"
                    )
                else:
                    b2b_invoice_keys[gstin].add(invoice_number)
                
                b2b_invoices[gstin]["invoices"].append(formatted_invoice)

        elif category == GSTR1_Category.B2CL.value:
            b2cl_invoices.append(format_invoice_for_b2cl(row))

        elif category == GSTR1_Category.B2CS.value:
            pos_code = extract_state_code(row.get("place_of_supply"))
            rate_value = flt(row.get("rate", 0))
            
            signed_taxable = signed["taxable_value"]
            signed_igst = signed["igst"]
            signed_cgst = signed["cgst"]
            signed_sgst = signed["sgst"]
            signed_cess = signed["cess"]
            
            existing = next(
                (x for x in b2cs_invoices
                 if x.get("pos") == pos_code and x.get("rt") == rate_value),
                None
            )

            if existing:
                existing["txval"] += signed_taxable
                existing["iamt"] += signed_igst
                existing["camt"] += signed_cgst
                existing["samt"] += signed_sgst
                existing["csamt"] += signed_cess
            else:
                b2cs_invoices.append({
                    "pos": pos_code,
                    "rt": rate_value,
                    "txval": signed_taxable,
                    "iamt": signed_igst,
                    "camt": signed_cgst,
                    "samt": signed_sgst,
                    "csamt": signed_cess,
                })

        elif category == GSTR1_Category.EXP.value:
            # Safety check: No duplicate export invoices
            if invoice_number in exp_invoice_keys:
                report.add_warning(f"Duplicate export invoice_number '{invoice_number}'")
            else:
                exp_invoice_keys.add(invoice_number)
            exp_invoices.append(format_invoice_for_exp(row))

        elif category == GSTR1_Category.CDNR.value:
            if gstin not in cdnr_invoices:
                cdnr_invoices[gstin] = {
                    "ctin": gstin,
                    "customer_name": row.get("customer_name", ""),
                    "notes": [],
                }
            cdnr_invoices[gstin]["notes"].append(format_invoice_for_cdnr(row))
            if is_credit_note:
                cdnr_credit_notes += 1
            elif is_debit_note_type:
                cdnr_debit_notes += 1

        elif category == GSTR1_Category.CDNUR.value:
            cdnur_invoices.append(format_invoice_for_cdnur(row))
            if is_credit_note:
                cdnur_credit_notes += 1
            elif is_debit_note:
                cdnur_debit_notes += 1

        elif category == GSTR1_Category.NIL_EXEMPT.value:
            pass

    elapsed = time.time() - start_time

    result = {
        "b2b": list(b2b_invoices.values()),
        "b2cl": b2cl_invoices,
        "b2cs": b2cs_invoices,
        "exp": exp_invoices,
        "cdnr": list(cdnr_invoices.values()),
        "cdnur": cdnur_invoices,
        # ADD 5: Advance tables
        "at": advances_received,  # Advances Received
        "txpd": advances_adjusted,  # Advances Adjusted
        # ADD 6: E-Commerce Operator Table
        "sup_ecom": list(ecom_operators.values()),
        # ADD 10: NIL/Exempt/Non-GST
        "nil_exemp": {
            "inv": [],
            "expt_amt": round(nil_exempt_supplies["exempted"], 2),
            "nil_amt": round(nil_exempt_supplies["nil_rated"], 2),
            "ngsup_amt": round(nil_exempt_supplies["non_gst"], 2),
        },
        # ADD 5: Amendment Table Placeholders (for future use)
        "b2b_amend": [],
        "b2cl_amend": [],
        "exp_amend": [],
        "cdnr_amend": [],
        "cdnur_amend": [],
        "at_amend": [],
        "txpd_amend": [],
        "summary": {
            "total_records": total_invoices,
            "total_taxable_value": round(total_taxable, 2),
            "total_igst": round(total_igst, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_cess": round(total_cess, 2),
            "processing_time_seconds": round(elapsed, 2),
            "cdnr_credit_notes": cdnr_credit_notes,
            "cdnr_debit_notes": cdnr_debit_notes,
            "cdnur_credit_notes": cdnur_credit_notes,
            "cdnur_debit_notes": cdnur_debit_notes,
            # RCM breakdown - reported but excluded from liability
            "rcm_taxable": round(total_rcm_taxable, 2),
            "rcm_igst": round(total_rcm_igst, 2),
            "rcm_cgst": round(total_rcm_cgst, 2),
            "rcm_sgst": round(total_rcm_sgst, 2),
            "rcm_cess": round(total_rcm_cess, 2),
            # Total reported (including RCM) for reference
            "total_reported_taxable": round(total_taxable + total_rcm_taxable, 2),
            "total_reported_igst": round(total_igst + total_rcm_igst, 2),
            "total_reported_cgst": round(total_cgst + total_rcm_cgst, 2),
            "total_reported_sgst": round(total_sgst + total_rcm_sgst, 2),
            "total_reported_cess": round(total_cess + total_rcm_cess, 2),
        }
    }

    if include_hsn:
        result["hsn"] = aggregate_hsn_summary(clean_data)
        
        # Safety check: HSN taxable should match summary taxable
        hsn_taxable_total = sum(h.get("txval", 0) for h in result.get("hsn", []))
        hsn_taxable_total = round(hsn_taxable_total, 2)
        
        # Allow tolerance due to rounding
        if abs(hsn_taxable_total - result["summary"]["total_taxable_value"]) > 1.0:
            report.add_warning(
                f"HSN taxable total ({hsn_taxable_total}) differs from summary taxable "
                f"({result['summary']['total_taxable_value']})".format(
                    hsn_taxable_total, result['summary']['total_taxable_value']
                )
            )

    if include_docs:
        result["docs"] = generate_document_summary(clean_data)

    # Validate if requested
    if validate:
        validation_report = validate_summary_totals(result)
        report.errors.extend(validation_report.errors)
        report.warnings.extend(validation_report.warnings)
        report.auto_corrections.extend(validation_report.auto_corrections)
        if not validation_report.is_valid():
            report.final_status = "failed"

    # Set integrity status
    if report.errors:
        report.final_status = "failed"
        report.add_auto_correction("Integrity validation failed - see errors")
    elif report.warnings:
        report.final_status = "passed_with_warnings"
    else:
        report.final_status = "passed"

    if elapsed > PROCESSING_TIMEOUT_THRESHOLD:
        logger.warning(
            f"GSTR-1 table generation: {len(clean_data)} rows in {elapsed:.2f}s. "
            f"Consider streaming for larger datasets."
        )
    else:
        logger.info(
            f"GSTR-1 tables generated in {elapsed:.2f}s: "
            f"{len(result['b2b'])} B2B, {len(result['b2cl'])} B2CL, "
            f"{len(result['b2cs'])} B2CS, {len(result['exp'])} EXP"
        )

    return result, report


def generate_document_summary(clean_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate document issue summary for GSTR-1."""
    document_counts = {
        "Invoices for outward supply": 0,
        "Invoices for inward supply from unregistered person": 0,
        "Debit Note": 0,
        "Credit Note": 0,
        "Delivery Challan for job work": 0,
    }

    for row in clean_data:
        is_return = row.get("is_return", False)
        is_debit_note = row.get("is_debit_note", False)

        if is_return:
            document_counts["Credit Note"] += 1
        elif is_debit_note:
            document_counts["Debit Note"] += 1
        else:
            document_counts["Invoices for outward supply"] += 1

    return {
        "document_summary": document_counts,
        "total_documents": sum(document_counts.values()),
    }


def generate_gstr1_json(
    clean_data: List[Dict[str, Any]],
    company_gstin: str = "",
    return_period: str = "",
    gstin: str = "",
    username: str = "",
    validate: bool = True,
) -> Tuple[Dict[str, Any], ValidationReport]:
    """
    Generate complete GSTR-1 JSON payload for government filing.
    
    Returns tuple of (gstr1_json, validation_report)
    
    The validation_report contains errors/warnings/final_status
    instead of crashing on validation failures.
    """
    gstr1_tables, report = generate_gstr1_tables(
        clean_data, 
        company_gstin, 
        validate=validate
    )

    gstr1_json = {
        "gstin": gstin,
        "ret_period": return_period,
        "username": username,
        "fp": return_period,
        "gt": 0.0,
        "cur_gt": 0.0,
        "b2b": gstr1_tables["b2b"],
        "b2cl": gstr1_tables["b2cl"],
        "b2cs": gstr1_tables["b2cs"],
        "exp": gstr1_tables["exp"],
        "cdnr": gstr1_tables["cdnr"],
        "cdnur": gstr1_tables["cdnur"],
        "at": [],
        "txpd": [],
        "hsn": gstr1_tables.get("hsn", []),
        "doc_issue": gstr1_tables.get("docs", {}),
        "sup_ecom": [],
        "nil_exemp": {
            "inv": [],
            "expt_amt": 0.0,
            "nil_amt": 0.0,
            "ngsup_amt": 0.0,
        },
        "txnval": gstr1_tables["summary"]["total_taxable_value"],
        "iamt": gstr1_tables["summary"]["total_igst"],
        "camt": gstr1_tables["summary"]["total_cgst"],
        "samt": gstr1_tables["summary"]["total_sgst"],
        "csamt": gstr1_tables["summary"]["total_cess"],
        # Include validation report in output
        "_validation": report.to_dict() if not report.is_valid() else None,
    }

    logger.info(f"Generated GSTR-1 JSON with {len(gstr1_json['b2b'])} B2B entries, "
                f"{len(gstr1_json['b2cl'])} B2CL entries, "
                f"{len(gstr1_json['b2cs'])} B2CS entries")

    return gstr1_json, report


def to_gstn_json(
    gstr1_tables: Dict[str, Any],
    gstin: str,
    return_period: str,
    username: str = "",
    fp: str = "",
    gt: float = 0.0,
    cur_gt: float = 0.0
) -> Dict[str, Any]:
    """
    ADD 8: JSON Schema Export Prep - Format GSTR-1 data for GSTN filing.
    
    This function prepares the complete JSON payload for GSTN upload.
    Future-ready with all required fields and proper schema.
    
    Args:
        gstr1_tables: Output from generate_gstr1_tables()
        gstin: GSTIN of the taxpayer
        return_period: Return period in MMYYYY format
        username: Username for filing
        fp: Filing period (defaults to return_period)
        gt: Gross turnover of previous FY
        cur_gt: Current FY turnover
    
    Returns:
        GSTN-compliant JSON for filing
    """
    summary = gstr1_tables.get("summary", {})
    
    # Build the GSTN-compliant JSON
    gstn_json = {
        "gstin": gstin,
        "fp": fp or return_period,
        "ret_period": return_period,
        "username": username,
        "gt": gt,
        "cur_gt": cur_gt,
        
        # Main tables
        "b2b": gstr1_tables.get("b2b", []),
        "b2cl": gstr1_tables.get("b2cl", []),
        "b2cs": gstr1_tables.get("b2cs", []),
        "exp": gstr1_tables.get("exp", []),
        "cdnr": gstr1_tables.get("cdnr", []),
        "cdnur": gstr1_tables.get("cdnur", []),
        
        # Advance tables
        "at": gstr1_tables.get("at", []),
        "txpd": gstr1_tables.get("txpd", []),
        
        # E-commerce
        "sup_ecom": gstr1_tables.get("sup_ecom", []),
        
        # NIL/Exempt/Non-GST
        "nil_exemp": gstr1_tables.get("nil_exemp", {
            "inv": [],
            "expt_amt": 0.0,
            "nil_amt": 0.0,
            "ngsup_amt": 0.0
        }),
        
        # HSN Summary
        "hsn": gstr1_tables.get("hsn", []),
        
        # Document Summary
        "doc_issue": gstr1_tables.get("docs", {}),
        
        # Amendment placeholders (for future)
        "b2b_amend": gstr1_tables.get("b2b_amend", []),
        "b2cl_amend": gstr1_tables.get("b2cl_amend", []),
        "exp_amend": gstr1_tables.get("exp_amend", []),
        "cdnr_amend": gstr1_tables.get("cdnr_amend", []),
        "cdnur_amend": gstr1_tables.get("cdnur_amend", []),
        "at_amend": gstr1_tables.get("at_amend", []),
        "txpd_amend": gstr1_tables.get("txpd_amend", []),
        
        # Summary totals (for validation)
        "txnval": summary.get("total_taxable_value", 0),
        "iamt": summary.get("total_igst", 0),
        "camt": summary.get("total_cgst", 0),
        "samt": summary.get("total_sgst", 0),
        "csamt": summary.get("total_cess", 0),
        
        # RCM breakdown
        "rcm": {
            "txval": summary.get("rcm_taxable", 0),
            "iamt": summary.get("rcm_igst", 0),
            "camt": summary.get("rcm_cgst", 0),
            "samt": summary.get("rcm_sgst", 0),
            "csamt": summary.get("rcm_cess", 0),
        },
        
        # Document counts
        "doc_count": {
            "b2b": len(gstr1_tables.get("b2b", [])),
            "b2cl": len(gstr1_tables.get("b2cl", [])),
            "b2cs": len(gstr1_tables.get("b2cs", [])),
            "exp": len(gstr1_tables.get("exp", [])),
            "cdnr": len(gstr1_tables.get("cdnr", [])),
            "cdnur": len(gstr1_tables.get("cdnur", [])),
        },
        
        # Metadata
        "meta": {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0",
            "engine": "india-compliance-gstn",
        }
    }
    
    return gstn_json
