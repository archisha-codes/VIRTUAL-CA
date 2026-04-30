"""
GSTR-3B Core Tax Calculation Engine

This module implements the legally mandated ITC utilization order, net tax payable
computation, 4(C) net ITC derivation, negative liability handling, and interest/
late fee stubs — all using Decimal arithmetic for GST-safe precision.

GST Law references:
  - Section 49 of CGST Act: ITC utilization order
  - Rule 86: Electronic credit ledger
  - Section 50: Interest on delayed payment
  - Rule 2A & Notification 51/2018 for late fee
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Tuple
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Precision helpers
# ---------------------------------------------------------------------------

def _d(value: Any) -> Decimal:
    """Convert any value to Decimal safely."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _r(value: Decimal, places: int = 2) -> Decimal:
    """Round Decimal to `places` decimal places (ROUND_HALF_UP)."""
    q = Decimal("0." + "0" * places)
    return value.quantize(q, rounding=ROUND_HALF_UP)


def _f(value: Decimal) -> float:
    """Serialize Decimal → float for JSON output."""
    return float(_r(value))


# ---------------------------------------------------------------------------
# Tax component container
# ---------------------------------------------------------------------------

class TaxComponents:
    """Immutable container for IGST/CGST/SGST/Cess amounts."""

    __slots__ = ("igst", "cgst", "sgst", "cess")

    def __init__(
        self,
        igst: Any = 0,
        cgst: Any = 0,
        sgst: Any = 0,
        cess: Any = 0,
    ):
        self.igst = _d(igst)
        self.cgst = _d(cgst)
        self.sgst = _d(sgst)
        self.cess = _d(cess)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TaxComponents":
        return cls(
            igst=d.get("igst", 0),
            cgst=d.get("cgst", 0),
            sgst=d.get("sgst", 0),
            cess=d.get("cess", 0),
        )

    @property
    def total(self) -> Decimal:
        return self.igst + self.cgst + self.sgst + self.cess

    def to_dict(self) -> Dict[str, float]:
        return {
            "igst": _f(self.igst),
            "cgst": _f(self.cgst),
            "sgst": _f(self.sgst),
            "cess": _f(self.cess),
            "total": _f(self.total),
        }

    def __sub__(self, other: "TaxComponents") -> "TaxComponents":
        return TaxComponents(
            igst=self.igst - other.igst,
            cgst=self.cgst - other.cgst,
            sgst=self.sgst - other.sgst,
            cess=self.cess - other.cess,
        )

    def clamp_positive(self) -> "TaxComponents":
        """Return a new TaxComponents with all negatives clamped to 0."""
        return TaxComponents(
            igst=max(Decimal("0"), self.igst),
            cgst=max(Decimal("0"), self.cgst),
            sgst=max(Decimal("0"), self.sgst),
            cess=max(Decimal("0"), self.cess),
        )


# ---------------------------------------------------------------------------
# 4(C) Net ITC = 4(A) − 4(B)
# ---------------------------------------------------------------------------

def compute_4c_net_itc(
    itc_4a: Dict[str, Any],
    itc_4b: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Table 4(C) Net ITC Available = 4(A) ITC Available − 4(B) ITC Reversed.

    Per GST law, computed separately for each tax head.
    If result < 0 for any head, that negative amount is added to Tax Payable
    in Table 6 (handled by compute_net_tax_payable).

    Args:
        itc_4a: 4(A) ITC Available dict {igst, cgst, sgst, cess}
        itc_4b: 4(B) ITC Reversed dict {igst, cgst, sgst, cess}

    Returns:
        dict with keys: igst, cgst, sgst, cess, total,
        and negative_heads list if any head < 0.
    """
    a = TaxComponents.from_dict(itc_4a)
    b = TaxComponents.from_dict(itc_4b)
    net = a - b

    result = net.to_dict()

    # Track heads with negative net ITC (these add to tax payable)
    negative_heads = {}
    for head in ("igst", "cgst", "sgst", "cess"):
        val = getattr(net, head)
        if val < Decimal("0"):
            negative_heads[head] = _f(abs(val))

    result["negative_heads"] = negative_heads
    return result


# ---------------------------------------------------------------------------
# ITC Utilization Engine (Section 49 CGST Act)
# ---------------------------------------------------------------------------

def compute_itc_utilization(
    liability: Dict[str, Any],
    net_itc: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Apply the legally mandated ITC utilization order (Section 49, CGST Act):

    IGST ITC:
        1st → offset IGST liability
        2nd → offset CGST liability (residual IGST after step 1)
        3rd → offset SGST liability (residual IGST after step 2)

    CGST ITC:
        → offset CGST liability only
        (CGST cannot be used for SGST or IGST in normal course)

    SGST ITC:
        → offset SGST liability only
        (SGST cannot be used for CGST or IGST in normal course)

    CESS ITC:
        → offset Cess liability only

    Args:
        liability: {igst, cgst, sgst, cess} — total output tax liability
        net_itc:   {igst, cgst, sgst, cess} — net ITC available (4C)

    Returns:
        {
          itc_utilized: {igst, cgst, sgst, cess},
          cash_liability: {igst, cgst, sgst, cess, total},
          residual_itc:  {igst, cgst, sgst, cess},
          carry_forward: {igst, cgst, sgst, cess},
          utilization_log: [...],   # human-readable audit trail
        }
    """
    # Work with mutable Decimal copies
    lib_igst = _d(liability.get("igst", 0))
    lib_cgst = _d(liability.get("cgst", 0))
    lib_sgst = _d(liability.get("sgst", 0))
    lib_cess = _d(liability.get("cess", 0))

    avl_igst = _d(net_itc.get("igst", 0))
    avl_cgst = _d(net_itc.get("cgst", 0))
    avl_sgst = _d(net_itc.get("sgst", 0))
    avl_cess = _d(net_itc.get("cess", 0))

    # Utilization tracking
    util_igst = Decimal("0")
    util_cgst = Decimal("0")
    util_sgst = Decimal("0")
    util_cess = Decimal("0")

    log = []

    # ---- Step 1: IGST ITC → IGST Liability --------------------------------
    igst_from_igst = min(avl_igst, lib_igst)
    avl_igst -= igst_from_igst
    lib_igst -= igst_from_igst
    util_igst += igst_from_igst
    if igst_from_igst > 0:
        log.append(f"IGST ITC ₹{_f(igst_from_igst):,.2f} → IGST Liability")

    # ---- Step 2: Residual IGST ITC → CGST Liability -----------------------
    igst_to_cgst = min(avl_igst, lib_cgst)
    avl_igst -= igst_to_cgst
    lib_cgst -= igst_to_cgst
    util_igst += igst_to_cgst
    if igst_to_cgst > 0:
        log.append(f"Residual IGST ITC ₹{_f(igst_to_cgst):,.2f} → CGST Liability")

    # ---- Step 3: Residual IGST ITC → SGST Liability -----------------------
    igst_to_sgst = min(avl_igst, lib_sgst)
    avl_igst -= igst_to_sgst
    lib_sgst -= igst_to_sgst
    util_igst += igst_to_sgst
    if igst_to_sgst > 0:
        log.append(f"Residual IGST ITC ₹{_f(igst_to_sgst):,.2f} → SGST Liability")

    # ---- Step 4: CGST ITC → CGST Liability only ---------------------------
    cgst_from_cgst = min(avl_cgst, lib_cgst)
    avl_cgst -= cgst_from_cgst
    lib_cgst -= cgst_from_cgst
    util_cgst += cgst_from_cgst
    if cgst_from_cgst > 0:
        log.append(f"CGST ITC ₹{_f(cgst_from_cgst):,.2f} → CGST Liability")

    # ---- Step 5: SGST ITC → SGST Liability only ---------------------------
    sgst_from_sgst = min(avl_sgst, lib_sgst)
    avl_sgst -= sgst_from_sgst
    lib_sgst -= sgst_from_sgst
    util_sgst += sgst_from_sgst
    if sgst_from_sgst > 0:
        log.append(f"SGST ITC ₹{_f(sgst_from_sgst):,.2f} → SGST Liability")

    # ---- Step 6: CESS ITC → CESS Liability only ---------------------------
    cess_from_cess = min(avl_cess, lib_cess)
    avl_cess -= cess_from_cess
    lib_cess -= cess_from_cess
    util_cess += cess_from_cess
    if cess_from_cess > 0:
        log.append(f"Cess ITC ₹{_f(cess_from_cess):,.2f} → Cess Liability")

    # Remaining liability must be paid in cash
    cash_igst = max(Decimal("0"), lib_igst)
    cash_cgst = max(Decimal("0"), lib_cgst)
    cash_sgst = max(Decimal("0"), lib_sgst)
    cash_cess = max(Decimal("0"), lib_cess)

    # Residual unutilized ITC carries forward
    carry_igst = max(Decimal("0"), avl_igst)
    carry_cgst = max(Decimal("0"), avl_cgst)
    carry_sgst = max(Decimal("0"), avl_sgst)
    carry_cess = max(Decimal("0"), avl_cess)

    return {
        "itc_utilized": {
            "igst": _f(util_igst),
            "cgst": _f(util_cgst),
            "sgst": _f(util_sgst),
            "cess": _f(util_cess),
            "total": _f(util_igst + util_cgst + util_sgst + util_cess),
        },
        "cash_liability": {
            "igst": _f(cash_igst),
            "cgst": _f(cash_cgst),
            "sgst": _f(cash_sgst),
            "cess": _f(cash_cess),
            "total": _f(cash_igst + cash_cgst + cash_sgst + cash_cess),
        },
        "residual_itc": {
            "igst": _f(avl_igst),
            "cgst": _f(avl_cgst),
            "sgst": _f(avl_sgst),
            "cess": _f(avl_cess),
        },
        "carry_forward": {
            "igst": _f(carry_igst),
            "cgst": _f(carry_cgst),
            "sgst": _f(carry_sgst),
            "cess": _f(carry_cess),
        },
        "utilization_log": log,
    }


# ---------------------------------------------------------------------------
# Net Tax Payable (Table 6 core)
# ---------------------------------------------------------------------------

def compute_net_tax_payable(
    liability: Dict[str, Any],
    net_itc: Dict[str, Any],
    itc_4b_negative_heads: Dict[str, float] | None = None,
) -> Dict[str, Any]:
    """
    Compute net tax payable after ITC utilization.

    Table 6 = Table 3.1 (Outward) + Table 3.1(d) (RCM) − ITC Utilized.

    If Table 4(C) net ITC < 0 for any head, that negative amount is added
    back to payable (per GST law: NET ITC cannot be negative for filing).

    Args:
        liability:              Total output tax liability {igst, cgst, sgst, cess}
        net_itc:                4(C) net ITC {igst, cgst, sgst, cess}
        itc_4b_negative_heads:  Heads where 4(C) was negative {head: abs_value}

    Returns:
        Full payment computation including utilization breakdown.
    """
    # Apply negative ITC heads as additional liability
    effective_liability = {
        "igst": _d(liability.get("igst", 0)),
        "cgst": _d(liability.get("cgst", 0)),
        "sgst": _d(liability.get("sgst", 0)),
        "cess": _d(liability.get("cess", 0)),
    }

    if itc_4b_negative_heads:
        for head, neg_amount in itc_4b_negative_heads.items():
            if head in effective_liability:
                effective_liability[head] += _d(neg_amount)

    effective_lib_dict = {k: _f(v) for k, v in effective_liability.items()}

    # Run utilization engine
    utilization = compute_itc_utilization(effective_lib_dict, net_itc)

    cash = utilization["cash_liability"]
    total_cash = cash["total"]

    # Law: final tax payable cannot be negative
    has_negative_output = any(
        _d(liability.get(h, 0)) < 0 for h in ("igst", "cgst", "sgst", "cess")
    )

    return {
        "gross_liability": {
            "igst": _f(effective_liability["igst"]),
            "cgst": _f(effective_liability["cgst"]),
            "sgst": _f(effective_liability["sgst"]),
            "cess": _f(effective_liability["cess"]),
            "total": _f(sum(effective_liability.values())),
        },
        "itc_utilized": utilization["itc_utilized"],
        "cash_liability": utilization["cash_liability"],
        "carry_forward": utilization["carry_forward"],
        "utilization_log": utilization["utilization_log"],
        "negative_output_tax_flag": has_negative_output,
        "total_payable": float(max(0, total_cash)),
    }


# ---------------------------------------------------------------------------
# Interest Calculator (Section 50, CGST Act)
# ---------------------------------------------------------------------------

ANNUAL_INTEREST_RATE = Decimal("0.18")  # 18% p.a.


def compute_interest(
    tax_amount: float,
    due_date: date,
    payment_date: date,
) -> Dict[str, Any]:
    """
    Calculate interest on delayed GST payment (Section 50, CGST Act).

    Interest = Tax Amount × 18% × (delay_days / 365)
    Per CBIC circular: interest charged from day after due date.

    Args:
        tax_amount:   Principal tax amount in rupees
        due_date:     Last day for filing (e.g., 20th of following month)
        payment_date: Actual payment/filing date

    Returns:
        dict with delay_days, interest_amount
    """
    delay_days = max(0, (payment_date - due_date).days)
    principal = _d(tax_amount)
    interest = (principal * ANNUAL_INTEREST_RATE * _d(delay_days)) / _d(365)

    return {
        "tax_amount": _f(principal),
        "due_date": due_date.isoformat(),
        "payment_date": payment_date.isoformat(),
        "delay_days": delay_days,
        "interest_rate_pct": float(ANNUAL_INTEREST_RATE * 100),
        "interest_amount": _f(_r(interest)),
    }


# ---------------------------------------------------------------------------
# Late Fee Calculator (Notification 51/2018, amnesty schemes)
# ---------------------------------------------------------------------------

LATE_FEE_PER_DAY = Decimal("50")       # ₹50/day for returns with tax
LATE_FEE_NIL_PER_DAY = Decimal("20")  # ₹20/day for nil returns
LATE_FEE_MAX = Decimal("10000")        # ₹10,000 cap (standard)


def compute_late_fee(
    due_date: date,
    filing_date: date,
    is_nil_return: bool = False,
) -> Dict[str, Any]:
    """
    Calculate late fee for delayed GSTR-3B filing.

    Args:
        due_date:     Due date for filing (20th of following month)
        filing_date:  Actual date of filing
        is_nil_return: Whether it is a nil return (lower fee rate)

    Returns:
        dict with delay_days, cgst_fee, sgst_fee, total_fee
    """
    delay_days = max(0, (filing_date - due_date).days)
    rate = LATE_FEE_NIL_PER_DAY if is_nil_return else LATE_FEE_PER_DAY
    total = min(_d(delay_days) * rate, LATE_FEE_MAX)

    # Split equally between CGST and SGST (IGST not applicable for late fee)
    cgst_fee = _r(total / 2)
    sgst_fee = _r(total / 2)

    return {
        "due_date": due_date.isoformat(),
        "filing_date": filing_date.isoformat(),
        "delay_days": delay_days,
        "rate_per_day": _f(rate),
        "cgst_late_fee": _f(cgst_fee),
        "sgst_late_fee": _f(sgst_fee),
        "total_late_fee": _f(total),
        "is_nil_return": is_nil_return,
    }


# ---------------------------------------------------------------------------
# Complete GSTR-3B Tax Computation (orchestrator)
# ---------------------------------------------------------------------------

def compute_gstr3b_tax(
    outward_supplies: Dict[str, Any],
    rcm_liability: Dict[str, Any],
    itc_4a: Dict[str, Any],
    itc_4b: Dict[str, Any],
    nil_return: bool = False,
    filing_date: date | None = None,
    return_period: str = "",
) -> Dict[str, Any]:
    """
    Full GSTR-3B tax computation orchestrator.

    Steps:
      1. Aggregate total liability (3.1 outward + 3.1(d) RCM)
      2. Compute 4(C) Net ITC = 4(A) − 4(B)
      3. Apply ITC utilization order
      4. Compute cash liability
      5. Compute interest & late fee (if filing date provided)

    Args:
        outward_supplies: {igst, cgst, sgst, cess} — sum of 3.1(a) to 3.1(e)
        rcm_liability:    {igst, cgst, sgst, cess} — 3.1(d)
        itc_4a:           ITC Available {igst, cgst, sgst, cess}
        itc_4b:           ITC Reversed  {igst, cgst, sgst, cess}
        nil_return:       Whether this is a NIL return
        filing_date:      Actual filing date (for interest/fee calculation)
        return_period:    "MMYYYY" format, used to derive due date

    Returns:
        Full computation result dict.
    """
    if nil_return:
        # For nil returns, all payable = 0
        zero = {"igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0, "total": 0.0}
        return {
            "nil_return": True,
            "total_liability": zero,
            "net_itc_4c": {**zero, "negative_heads": {}},
            "itc_utilized": zero,
            "cash_liability": zero,
            "carry_forward": zero,
            "utilization_log": [],
            "total_payable": 0.0,
            "negative_output_tax_flag": False,
            "interest": None,
            "late_fee": None,
        }

    # Step 1: Total liability = outward + RCM
    total_liability = {
        head: _f(_d(outward_supplies.get(head, 0)) + _d(rcm_liability.get(head, 0)))
        for head in ("igst", "cgst", "sgst", "cess")
    }
    total_liability["total"] = _f(sum(_d(v) for v in total_liability.values() if isinstance(v, float)))

    # Step 2: 4(C) Net ITC
    net_itc_result = compute_4c_net_itc(itc_4a, itc_4b)
    negative_heads = net_itc_result.get("negative_heads", {})

    # Net ITC dict (clamped to 0 for utilization — negatives go to liability)
    net_itc_for_util = {
        head: max(0.0, net_itc_result.get(head, 0.0))
        for head in ("igst", "cgst", "sgst", "cess")
    }

    # Step 3 & 4: Utilize ITC and compute cash liability
    payable = compute_net_tax_payable(total_liability, net_itc_for_util, negative_heads)

    # Step 5: Interest & late fee
    interest_data = None
    late_fee_data = None

    if filing_date and return_period and len(return_period) == 6:
        try:
            month = int(return_period[:2])
            year = int(return_period[2:])
            # Due date for GSTR-3B: 20th of following month
            next_month = month + 1 if month < 12 else 1
            next_year = year if month < 12 else year + 1
            due_date = date(next_year, next_month, 20)

            if filing_date > due_date:
                total_cash = payable["cash_liability"]["total"]
                interest_data = compute_interest(total_cash, due_date, filing_date)
                late_fee_data = compute_late_fee(due_date, filing_date, nil_return)
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not compute interest/late fee: {e}")

    return {
        "nil_return": False,
        "total_liability": total_liability,
        "net_itc_4c": net_itc_result,
        "itc_utilized": payable["itc_utilized"],
        "cash_liability": payable["cash_liability"],
        "carry_forward": payable["carry_forward"],
        "utilization_log": payable["utilization_log"],
        "gross_liability": payable["gross_liability"],
        "total_payable": payable["total_payable"],
        "negative_output_tax_flag": payable["negative_output_tax_flag"],
        "interest": interest_data,
        "late_fee": late_fee_data,
    }
