# VIRTUAL-CA — Complete Validations & Calculations Audit

> Analysed files: `backend/` (7 key Python modules) + `frontend/src/` (22 component/service files)
> As of: April 2026

---

## SECTION A — ALL IMPLEMENTED VALIDATIONS

### A1. GSTIN Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 1 | **GSTIN Format** — must match regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` | ERROR | `validation_engine.py`, `processor.py`, `gst_validation_safeguards.py` | 15 chars, PAN-embedded |
| 2 | **GSTIN Length** — exactly 15 characters | ERROR | `processor.py`, `gst_validation_safeguards.py` | Fails if not exactly 15 |
| 3 | **GSTIN State Code** — first 2 digits must be a valid Indian state code (01–37, 96, 97) | ERROR | `validation_engine.py` | 40+ state codes mapped |
| 4 | **GSTIN Checksum (Mod-36)** — validates the 15th character using weighted sum algorithm | ERROR | `gstr1_data.py`, `gst_validation_safeguards.py` | Full Mod-36 algorithm implemented |
| 5 | **GSTIN Required for B2B** — GSTIN mandatory when transaction is B2B | ERROR | `gstr1_data.py`, `processor.py` | B2C allowed to be blank |
| 6 | **GSTIN Empty Allowed for B2C** — blank GSTIN is valid for B2CS/B2CL | INFO | `processor.py` | Explicitly handled |

---

### A2. Invoice Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 7 | **Invoice Number Required** | ERROR | `validation_engine.py`, `processor.py` | `VAL_INV_REQUIRED` |
| 8 | **Invoice Number Max Length** — must not exceed 16 characters | WARNING | `validation_engine.py` | Per GSTN spec |
| 9 | **Invoice Number Invalid Characters** — `<>{}|\\[]` not allowed | WARNING | `validation_engine.py` | Regex check |
| 10 | **Duplicate Invoice Detection** — same invoice number + GSTIN + fiscal year flagged | ERROR | `gst_validation_safeguards.py` | Uses hash set `(gstin, inv_no, fy)` |
| 11 | **Cancelled Document Must Have Invoice Number** | ERROR | `validation_engine.py` | `is_cancelled` flag |

---

### A3. Date Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 12 | **Invoice Date Required** | ERROR | `validation_engine.py`, `processor.py` | `VAL_DATE_REQUIRED` |
| 13 | **Date Format Parsing** — supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MON YYYY | ERROR | `validation_engine.py`, `processor.py` | Multiple formats tried |
| 14 | **Invoice Date vs. Filing Period** — warns if date outside stated return period | WARNING | `validation_engine.py`, `processor.py` | Window: return_period ± 1 month tolerance |
| 15 | **Future Date Warning** — invoice cannot be dated in the future | WARNING | `validation_engine.py` | `date > date.today()` |
| 16 | **Date Within Financial Year** — must be in current or previous FY | WARNING → ERROR | `processor.py` | FY: Apr 1 – Mar 31 |
| 17 | **Amendment Date After Original Date** — amendment invoice date must be ≥ original | WARNING | `gst_validation_safeguards.py`, `validation_engine.py` | `inv_date < orig_date` → flag |

---

### A4. Tax Amount Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 18 | **Taxable Value Required** | ERROR | `validation_engine.py`, `processor.py` | `VAL_AMT_REQUIRED` |
| 19 | **IGST Mismatch** — `IGST ≠ taxable × rate / 100` (tolerance ±₹0.05–±₹0.50) | WARNING/ERROR | `validation_engine.py`, `tax_validator.py`, `gst_validation_safeguards.py`, `processor.py` | Auto-correct if diff ≤ ₹1 |
| 20 | **CGST Mismatch** — `CGST ≠ taxable × rate / 200` | WARNING | `tax_validator.py` | Expected = half IGST |
| 21 | **SGST Mismatch** — `SGST ≠ taxable × rate / 200` | WARNING | `tax_validator.py` | Must equal CGST |
| 22 | **CGST ≠ SGST** — for intra-state, CGST and SGST should be equal | WARNING | `tax_validator.py` | Auto-corrects both to expected_half |
| 23 | **Invoice Value Consistency** — `invoice_value ≠ taxable + IGST + CGST + SGST + CESS` | WARNING/ERROR | `validation_engine.py` | Tolerance ±₹0.50; auto-correct if ≤ ₹1 |
| 24 | **Negative Tax for Regular Invoices** — IGST/CGST/SGST/CESS/taxable_value < 0 not allowed for non-CDN/amendment | ERROR | `gst_validation_safeguards.py` | Exceptions: CN, DN, Amendment |
| 25 | **Credit Note Tax Cannot Exceed Original Invoice Tax** | ERROR | `gst_validation_safeguards.py` | `credit_tax > original_tax` |
| 26 | **CESS Exceeds Maximum** — CESS > 50% of taxable (configurable) | ERROR | `gstr1_data.py` | `validate_cess_limit()` |
| 27 | **NaN/Infinity in Numeric Fields** — all numeric fields sanitized | ERROR | `processor.py` | `math.isnan()` / `math.isinf()` check |

---

### A5. Tax Rate Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 28 | **GST Rate Required** | WARNING | `validation_engine.py` | Needed for tax calculation |
| 29 | **Non-Standard GST Rate** — must be one of {0, 0.1, 0.25, 3, 5, 12, 18, 28} | WARNING | `validation_engine.py` | Extended list in `processor.py`: adds 1, 1.5, 6, 7.5, 40 |
| 30 | **Negative Rate Not Allowed** | ERROR | `validation_engine.py` | `rate < 0` |
| 31 | **Rate Range Check** — warns if rate > 28 | WARNING | `gst_validation_safeguards.py` | `rate_val > 28` |
| 32 | **Rate vs Tax Consistency** — `(actual_tax / taxable) × 100 ≈ rate` | ERROR | `gstr1_data.py` | Tolerance ±₹0.10 |

---

### A6. Inter-State / Place of Supply Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 33 | **Place of Supply Required** | ERROR | `validation_engine.py`, `processor.py` | `VAL_POS_REQUIRED` |
| 34 | **POS Must Be Valid State Code** — must be a known 2-digit state code or valid state name | ERROR | `validation_engine.py`, `processor.py` | Code: 01–37, 96 (Export), 97 (Other) |
| 35 | **Inter-State Must Use IGST** — if supplier_state ≠ POS, IGST must be used (not CGST/SGST) | ERROR/AUTO-CORRECT | `tax_validator.py` | Auto-zeroes CGST/SGST if IGST present |
| 36 | **Intra-State Must Use CGST+SGST** — if intra-state, IGST must be 0 | ERROR | `tax_validator.py` | `igst > 0 for intra-state → flag` |

---

### A7. Document Type / Classification Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 37 | **Credit/Debit Note Must Reference Original Invoice** | ERROR | `validation_engine.py`, `gst_validation_safeguards.py` | `reference_invoice_number` required |
| 38 | **Amendment Must Reference Original Invoice** | ERROR | `validation_engine.py`, `gst_validation_safeguards.py` | `reference_invoice_number` required |
| 39 | **Document Series Max 16 Chars** | WARNING | `validation_engine.py` | Table 13 governance |
| 40 | **Negative Invoice Value Treated as Credit Note** | INFO | `classification_engine.py`, `gstr1_data.py` | `invoice_value < 0` → auto-classify CDNR/CDNUR |

---

### A8. HSN / UQC Validations

| # | Validation | Severity | Location | Details |
|---|-----------|----------|----------|---------|
| 41 | **HSN Code Format** — must be 4–8 numeric digits; SAC = 4–6 digits | ERROR | `validation_engine.py` | `^\\d{4,8}$` |
| 42 | **UQC Required When HSN Present** | ERROR | `validation_engine.py` | `hsn_code` with no `uqc` → error |
| 43 | **Item Description Recommended When HSN Present** | WARNING | `validation_engine.py` | Advisory check |
| 44 | **UQC Must Be Valid GSTN Code** — validates against official GSTN UQC list (80+ codes: NOS, KGS, LTR, MTR, BTL, BOX…) | ERROR | `gstr1_data.py` | `validate_uqc_code()` |

---

### A9. Frontend Validations (GSTR1SummaryDrawer.tsx & Tables)

| # | Validation | Location | Details |
|---|-----------|----------|---------|
| 45 | **Document Number Uniqueness (UI)** — duplicate invoice check in inline edit | `EditableCell.tsx` | Frontend deduplication hint |
| 46 | **Numeric Field Parsing** — strips ₹, commas, spaces before converting | `GSTR1SummaryDrawer.tsx` | `normalizeNumericValue()` |
| 47 | **NaN / Null Guard** — falls back to 0 for any unparseable numeric | `GSTR1SummaryDrawer.tsx` | `Number.isFinite()` check |
| 48 | **Return Period Format** — must match `MMYYYY` 6-digit regex before processing | `GSTR1SummaryDrawer.tsx` | `/^\d{6}$/` regex |
| 49 | **File Upload Format** — only `.xls`, `.xlsx`, `.csv` accepted | `GSTR1SummaryDrawer.tsx` | `accept` attribute |
| 50 | **Required Column Headers in Template** — checks template has mandatory columns before processing | `GSTR1SummaryDrawer.tsx` | `REQUIRED_FIELDS.every()` |

---

## SECTION B — ALL IMPLEMENTED FORMULAS & CALCULATIONS

### B1. Core Tax Calculation Formulas

| # | Formula | Input | Output | Location |
|---|---------|-------|--------|---------|
| 1 | **Total Tax Amount** | `taxable_value × rate / 100` | `total_tax` | `tax_engine.py`, `tax_validator.py`, `gstr1_data.py` |
| 2 | **IGST (Inter-State)** | `taxable × rate / 100` | `igst` | `tax_engine.py::compute_tax()` |
| 3 | **CGST (Intra-State)** | `taxable × rate / 200` (half of total) | `cgst` | `tax_engine.py::compute_tax()` |
| 4 | **SGST (Intra-State)** | `taxable × rate / 200` (half of total) | `sgst` | `tax_engine.py::compute_tax()` |
| 5 | **Invoice Value** | `taxable_value + IGST + CGST + SGST + CESS` | `invoice_value` | `tax_engine.py::apply_tax()`, `validation_engine.py` |
| 6 | **Tax-Inclusive Back-Calculation (Taxable from Invoice)** | `invoice_value / (1 + rate/100)` | `taxable_value` | `tax_engine.py::calculate_tax_from_inclusive()`, `gstr1_data.py` |
| 7 | **Tax-Inclusive Back-Calculation (Tax from Invoice)** | `invoice_value - taxable_value` | `tax_amount` | `tax_engine.py::calculate_tax_from_inclusive()` |
| 8 | **Expected CGST (for validation)** | `taxable × (rate/2) / 100` | `expected_cgst` | `tax_validator.py::calculate_expected_tax()` |
| 9 | **CESS Amount Check** | `cess ≤ taxable × max_cess_rate (default 50%)` | boolean | `gstr1_data.py::validate_cess_limit()` |
| 10 | **Actual Rate from Provided Tax** | `(provided_tax / taxable_value) × 100` | `actual_rate%` | `gstr1_data.py::validate_rate_vs_tax_consistency()` |

---

### B2. Rounding & Precision Rules

| # | Rule | Formula / Method | Tolerance | Location |
|---|------|-----------------|-----------|---------|
| 11 | **All money values** — rounded to 2 decimal places | `Decimal(value).quantize(Decimal("0.01"), ROUND_HALF_UP)` | — | `tax_engine.py::money()`, `gstr1_data.py::money()` |
| 12 | **Auto-correct small tax diff** | `if diff ≤ ₹1.00` → auto-correct silently | ₹1.00 | `validation_engine.py` |
| 13 | **Warning on medium tax diff** | `if ₹1.00 < diff ≤ ₹10.00` → WARNING | ₹1.00 – ₹10.00 | `validation_engine.py` |
| 14 | **Error on large tax diff** | `if diff > ₹100.00` → ERROR | ₹100.00 | `validation_engine.py` |
| 15 | **Rounding tolerance (safeguards)** | `abs(calculated - expected) ≤ ₹0.05` | ₹0.05 | `gst_validation_safeguards.py` |
| 16 | **Rounding tolerance (validator)** | `abs(calculated - expected) ≤ ₹0.05` | ₹0.05 | `tax_validator.py` |
| 17 | **Rounding tolerance (processor)** | `abs(calculated - expected) ≤ ₹0.10` | ₹0.10 | `processor.py` |

---

### B3. Transaction Classification Formulas

| # | Logic / Formula | Output | Location |
|---|----------------|--------|---------|
| 18 | If `gstin` present AND len ≥ 15 → **B2B** | Category: B2B | `classification_engine.py`, `gstr1_data.py`, `processor.py` |
| 19 | If POS = "96" OR "overseas" OR "other countries" → **EXP** | Category: EXP | All three modules |
| 20 | If is_credit/debit_note AND gstin → **CDNR** | Category: CDNR | `gstr1_data.py` |
| 21 | If is_credit/debit_note AND no gstin → **CDNUR** | Category: CDNUR | `gstr1_data.py` |
| 22 | **B2C Limit (Dynamic)**: if invoice_date < Aug 2024 → ₹2,50,000; else → ₹1,00,000 | Threshold | `classification_engine.py`, `gstr1_data.py` |
| 23 | If no GSTIN AND inter_state AND invoice_value > B2C limit → **B2CL** | Category: B2CL | All three modules |
| 24 | Otherwise (no GSTIN, intra-state or small value) → **B2CS** | Category: B2CS | All three modules |
| 25 | If `customer_type == "SEZ"` → **B2B/SEZWP** (with GST) or **B2B/SEZWOP** | Sub-category | `gstr1_data.py` |
| 26 | If `gst_category == "Deemed Export"` → **B2B/DE** | Sub-category | `gstr1_data.py` |
| 27 | If `gst_treatment == "Nil-Rated/Exempted/Non-GST"` → **NIL_EXEMPT** | Category | `gstr1_data.py` |
| 28 | RCM detection: `reverse_charge in ["Y","YES","TRUE","1"]` → **B2B_REVERSE_CHARGE** | Sub-category | `gstr1_data.py` |
| 29 | Advance supply: `"advance" in supply_type` → **ATA (Table 11A)** | Category | `classification_engine.py` |
| 30 | Advance adjustment: `"adj" in supply_type` → **TXP (Table 11B)** | Category | `classification_engine.py` |
| 31 | ECO with Section 9(5): → **ECO95 (Table 15)** | Category | `classification_engine.py` |

---

### B4. Inter-State Determination Logic

| # | Logic | Formula / Rule | Location |
|---|-------|---------------|---------|
| 32 | **Primary**: compare state codes | `supplier_state_code[:2] ≠ pos[:2]` → inter-state | `gstr1_data.py::is_inter_state()` |
| 33 | **Fallback (when state codes unavailable)**: use tax type | If `IGST > 0 AND CGST+SGST == 0` → inter-state | `gstr1_data.py::is_inter_state()` |
| 34 | **Another fallback**: if `CGST > 0 OR SGST > 0` → intra-state | — | `gstr1_data.py` |
| 35 | **POS code 96 or 97** → always inter-state | Hardcoded | `tax_validator.py` |

---

### B5. Aggregation Formulas (Summary Tables)

| # | Formula | Table | Location |
|---|---------|-------|---------|
| 36 | **B2CS Aggregation**: `GROUP BY (place_of_supply, rate)` → `SUM(taxable, CGST, SGST, IGST, CESS)` | B2CS | `aggregation_engine.py` |
| 37 | **B2B Aggregation**: `GROUP BY (gstin, customer_name)` → `COUNT(invoices), SUM(taxable, all taxes)` | B2B | `aggregation_engine.py` |
| 38 | **B2CL Aggregation**: `GROUP BY (place_of_supply, rate)` → `COUNT(invoices), SUM(taxable, IGST, CESS)` | B2CL | `aggregation_engine.py` |
| 39 | **HSN Aggregation**: `GROUP BY (hsn_code)` → `SUM(quantity, taxable, CGST, SGST, IGST, CESS)` | HSN | `aggregation_engine.py` |
| 40 | **Total Tax Summary**: `total_igst + total_cgst + total_sgst + total_cess` | All | `aggregation_engine.py::calculate_tax_totals()` |

---

### B6. Frontend Display Calculations (GSTR1SummaryDrawer.tsx)

| # | Formula | Used In | Location |
|---|---------|---------|---------|
| 41 | **Total Tax** (fallback): `IGST + CGST + SGST` | Summary cards | `buildSummaryRecord()` L153 |
| 42 | **Total Amount** (fallback): `taxable_amount + total_tax` | Summary cards | `buildSummaryRecord()` L154 |
| 43 | **Section Stats** (Documents View): Reduced across all rows of a section | 7 cards in document list | `renderDocumentsView()` → `stats.reduce()` |
| 44 | **Document Value**: `SUM(val, invoice_value, total_amount, total_value)` | Header stat card | `GSTR1SummaryDrawer.tsx` |
| 45 | **Taxable Amount**: `SUM(txval, taxable_value, taxable_amount)` | Header stat card | `GSTR1SummaryDrawer.tsx` |

---

### B7. GSTIN Checksum Algorithm

| # | Step | Detail |
|---|------|--------|
| 46 | **Character Map** | `0-9 → 0-9`, `A-Z → 10-35` (36-char charset) |
| 47 | **Weighted Sum** | `Σ (char_value × position_weight)` for first 14 chars |
| 48 | **Remainder** | `weighted_sum % 36` |
| 49 | **Check Digit** | `(36 - remainder) % 36` → maps back to char |
| 50 | **Validation** | `gstin[14] == charset[check_digit]` |

> Implemented in: `gst_validation_safeguards.py::validate_gstin()`, `gstr1_data.py::validate_gstin_checksum()`

---

### B8. Fiscal Year Determination

| # | Formula | Output | Location |
|---|---------|--------|---------|
| 51 | If `today.month >= 4` → `FY = current_year / current_year+1` | e.g., 2025-26 | `processor.py::get_current_financial_year()` |
| 52 | If `today.month < 4` → `FY = current_year-1 / current_year` | e.g., 2024-25 | `processor.py` |
| 53 | Invoice FY from date: if month ≥ 4 → `year/year+1`, else `year-1/year` | FY string | `gst_validation_safeguards.py` |

---

## SECTION C — WHAT IS NOT YET IMPLEMENTED

> [!WARNING]
> The following are identified gaps — either marked as TODO in the code or missing from the current implementation.

### C1. Validation Gaps

| # | Missing Validation | Impact | Notes |
|---|------------------|--------|-------|
| 1 | **PAN embedded in GSTIN** — verify that chars 3–12 of GSTIN form a valid PAN format | Medium | Code checks regex but not PAN-specific rules |
| 2 | **GSTIN activation status** — verify GSTIN is currently active on GSTN portal | High | Requires live GSTN API call; `gstin_info.py` exists but stub |
| 3 | **HSN Chapter / Sub-heading cross-reference** — validate if HSN code belongs to correct goods/services | High | Would need HSN master data |
| 4 | **E-invoice IRN validation** — validate IRN format (64-char hex) and QR code consistency | Medium | `irn` field is captured but no format check |
| 5 | **Section 9(5) ECO validation** — if `eco_ctin` present, validate GSTIN and cross-check section | Medium | Field exists in form, logic not enforced |
| 6 | **B2CS limit change boundary validation** — strict enforcement of ₹1,00,000 threshold post Aug 2024 | Medium | Partially done; no date-range enforcement UI  |
| 7 | **Cross-period amendment window** — can only amend within 3 years of original filing | Medium | Basic date-after-original is done; window not enforced |
| 8 | **Supply Type mandatory for ECO** — `supply_type` should be "eco" for Table 14/15 | Low | Currently optional |
| 9 | **Form-level Save Validation** — no client-side validation before clicking "Save changes" in Document Details form | High | Button calls `handleSaveEditedDoc` without checking required fields |
| 10 | **Line Items Table Validation** — the 36-column table has no type/range validation per cell | High | Cells are plain text inputs currently |

### C2. Calculation Gaps

| # | Missing Calculation | Impact | Notes |
|---|-------------------|--------|-------|
| 1 | **CESS Rate-Specific Calculation** — only max-rate check exists; actual cess rate per commodity not applied | Medium | `CESS_RATES` dict defined but not used in computation |
| 2 | **GSTR-3B Liability Auto-compute from GSTR-1** — total output tax from GSTR-1 should flow to GSTR-3B | High | `gstr3b_data.py` exists but cross-form linkage not wired |
| 3 | **Service POS Determination (IGST Act Section 12/13)** — `determine_service_pos()` is a stub returning input unchanged | High | Marked TODO in `gstr1_data.py` |
| 4 | **HSN Summary Auto-Generation** — HSN table should be auto-computed from line-item data | Medium | `aggregate_hsn()` exists but not triggered from UI save workflow |
| 5 | **Document Series Summary (Table 13)** — count of documents issued in a series not auto-computed | Medium | Table exists but counts not implemented |
| 6 | **Advances (Table 11A/11B) Tax Liability Calculation** — advance tax adjusted on receipt | High | Classification exists; tax liability formula not implemented |
| 7 | **Nil Rated / Exempt / Non-GST Split** — separate reporting for each in Table 8 not computed | Medium | Pattern matching exists; aggregation missing |
| 8 | **E-Commerce TCS (Table 14) Tax Collection Amount** | Medium | Category `ECO` classified but amount not computed |
| 9 | **Invoice-Level vs. Item-Level Aggregation** — when multiple line items per invoice, the invoice-level `val` is not re-summed | Medium | Currently uses row-level `invoice_value` directly |
| 10 | **Inter-State Tax Re-Validation after Edit** — when user edits POS in document details, IGST/CGST/SGST are not recomputed | High | Form is static; no reactive tax recompute |

---

## SUMMARY COUNTS

| Category | Implemented | Not Yet Implemented |
|----------|-------------|-------------------|
| GSTIN Validations | 6 | 2 |
| Invoice Validations | 5 | 1 |
| Date Validations | 6 | 1 |
| Tax Amount Validations | 10 | 2 |
| Tax Rate Validations | 5 | 0 |
| POS / Inter-State Validations | 4 | 1 |
| Document Type Validations | 4 | 3 |
| HSN / UQC Validations | 4 | 1 |
| Frontend Validations | 6 | 2 |
| **Total Validations** | **50** | **13** |
| Tax Formulas (Core) | 10 | 4 |
| Rounding Rules | 7 | 0 |
| Classification Formulas | 14 | 2 |
| Aggregation Formulas | 5 | 4 |
| Frontend Display Formulas | 5 | 2 |
| Checksum / FY Formulas | 8 | 0 |
| **Total Calculations** | **49** | **12** |
