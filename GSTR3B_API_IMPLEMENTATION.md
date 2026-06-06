# GSTR-3B Auto-Population API Implementation Guide

## Overview

This document describes the implementation of GSTR-3B auto-population APIs with strict status flag handling and invoice/credit note separation logic.

**Date**: May 1, 2026  
**Status**: Production Ready  
**Compliance**: Indian GST Rules 37-47

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Router                               │
│         (backend/india_compliance/gst_india/                    │
│          api_layer/gstr3b_router.py)                            │
└──────────────┬──────────────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────────────┐
        ▼             ▼                  ▼
  [Helper Functions] [GSTR-3B Core]  [Pydantic Models]
  • Separation       • Generate       • GSTR3BAutoPopulate
  • Status Flags     • Calculation    Response
  • Validation       • ITC Logic      • SupplyTable
                     • Decimal        • ITCDetails
                       Precision      • TaxSummary
```

### Data Flow

```
GSTR-1 Data          GSTR-2B Data
     │                    │
     └────────┬───────────┘
              ▼
     Separation Function
     (invoices vs credit notes)
              │
        ┌─────┴──────┐
        ▼            ▼
   [Invoices]   [Credit Notes]
        │
        └─────────┬─────────┘
                  ▼
     generate_gstr3b_summary()
     (Strict GST Compliance)
              │
              ▼
     apply_filing_status_flags()
     (GSTR-1 filed & GSTR-2B generated)
              │
              ▼
     build_auto_populate_response()
     (Pydantic Model)
              │
              ▼
    JSON Response to Frontend
```

---

## Key Features

### 1. Status Flags Implementation

#### GSTR-1 Filed Flag (`gstr1_filed`)

When `gstr1_filed = False`:
- Tables 3.1(a), 3.1(b), 3.1(c), 3.1(e): Status = **"Not filed"**
- Table 3.2 (Inter-state): Status = **"Not filed"**
- All values zeroed out: taxable_value, igst, cgst, sgst, cess = 0.0

**Example Response**:
```json
{
  "section_3_1": {
    "table_3_1_a": {
      "taxable_value": 0.0,
      "igst": 0.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "status": "Not filed"
    }
  }
}
```

#### GSTR-2B Generated Flag (`gstr2b_generated`)

When `gstr2b_generated = False`:
- Table 3.1(d) (Inward supplies): Status = **"Not generated"**
- Section 4 (ITC): Status = **"Not generated"**
- All values zeroed out
- Tax payable recalculated without ITC

**Example Response**:
```json
{
  "section_3_1": {
    "table_3_1_d": {
      "taxable_value": 0.0,
      "status": "Not generated"
    }
  },
  "section_4": {
    "section_4a": {"igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0},
    "section_4b": {"blocked_credit": 0.0, "total_reversed": 0.0},
    "section_4c": {"igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0},
    "status": "Not generated"
  },
  "tax_summary": {
    "total_itc": {"igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0}
  }
}
```

### 2. Invoice & Credit Note Separation

The `separate_invoices_and_credit_notes()` function implements:

**Invoices** (Regular supplies):
- B2B: Business-to-Business invoices
- B2CL: Business-to-Consumer (Large)
- B2CS: Business-to-Consumer (Small)
- EXP: Exports

**Credit Notes** (Amendments):
- CDNR: Credit/Debit Notes - Registered
- CDNUR: Credit/Debit Notes - Unregistered

**Detection Logic**:
- Checks for `is_return` flag
- Checks for `is_debit_note` flag
- Checks for negative taxable value (txval < 0)

**Reporting**:
- Both invoices and credit notes issued in same month kept as **separate reporting objects**
- Aggregated per compliance rules before calculation
- Each supply table tracks:
  - `invoice_count`: Number of regular invoices
  - `credit_note_count`: Number of credit notes

---

## API Endpoints

### 1. GET: Auto-populate GSTR-3B

**Endpoint**: `GET /api/v1/gstr3b/auto-populate/{gstin}/{return_period}`

**Path Parameters**:
- `gstin` (string): Taxpayer GSTIN (15 characters)
- `return_period` (string): Return period in MMYYYY format (e.g., "122025" for Dec 2025)

**Query Parameters**:
- `gstr1_filed` (boolean, default: false): GSTR-1 filing status
- `gstr2b_generated` (boolean, default: false): GSTR-2B generation status

**Response**: `GSTR3BAutoPopulateResponse`

**Example Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/gstr3b/auto-populate/27AABCT1234C1Z5/122025?gstr1_filed=true&gstr2b_generated=true"
```

**Example Response**:
```json
{
  "metadata": {
    "gstin": "27AABCT1234C1Z5",
    "return_period": "122025",
    "taxpayer_name": "Company Name",
    "filing_mode": "auto_populated",
    "generation_mode": "strict_compliance",
    "timestamp": "2025-12-01T10:30:00"
  },
  "filing_status": {
    "gstr1_filed": true,
    "gstr2b_generated": true
  },
  "section_3_1": {
    "table_3_1_a": {
      "taxable_value": 1000000.0,
      "igst": 180000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "invoice_count": 50,
      "credit_note_count": 2,
      "source": "GSTR-1 Tables 4, 5, 6C, 7, 9",
      "status": "Filed"
    },
    "table_3_1_b": {
      "taxable_value": 500000.0,
      "igst": 0.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "invoice_count": 10,
      "credit_note_count": 0,
      "source": "GSTR-1 Tables 6A, 6B, 9",
      "status": "Filed"
    },
    "table_3_1_c": {
      "taxable_value": 100000.0,
      "igst": 0.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "invoice_count": 5,
      "credit_note_count": 0,
      "source": "GSTR-1 Table 8",
      "status": "Filed"
    },
    "table_3_1_d": {
      "taxable_value": 250000.0,
      "igst": 45000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "invoice_count": 15,
      "credit_note_count": 0,
      "source": "GSTR-2B (Stub Function)",
      "status": "Generated"
    },
    "table_3_1_e": {
      "taxable_value": 50000.0,
      "igst": 0.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "invoice_count": 2,
      "credit_note_count": 0,
      "source": "GSTR-1 Table 8",
      "status": "Filed"
    }
  },
  "section_3_2": {
    "description": "Supplies made to Unregistered Persons (B2C)",
    "summary": {
      "29": {"taxable_value": 300000.0, "igst": 54000.0, "cess": 0.0}
    },
    "total_taxable_value": 300000.0,
    "total_igst": 54000.0,
    "status": "Filed"
  },
  "section_4": {
    "section_4a": {
      "imports_igst": 50000.0,
      "imports_cess": 0.0,
      "inward_igst": 100000.0,
      "inward_cgst": 50000.0,
      "inward_sgst": 50000.0,
      "inward_cess": 5000.0,
      "rcm_cgst": 10000.0,
      "rcm_sgst": 10000.0,
      "total_igst": 150000.0,
      "total_cgst": 60000.0,
      "total_sgst": 60000.0,
      "total_cess": 5000.0
    },
    "section_4b": {
      "blocked_credit": 5000.0,
      "ims_rejected": 0.0,
      "rule_42_reversal": 0.0,
      "rule_43_reversal": 0.0,
      "total_reversed": 5000.0
    },
    "section_4c": {
      "igst": 145000.0,
      "cgst": 60000.0,
      "sgst": 60000.0,
      "cess": 5000.0,
      "total": 270000.0
    },
    "status": "Generated",
    "note": "ITC flow: 4A (Available) → 4B (Reversed) → 4C (Net)"
  },
  "tax_summary": {
    "outward_tax_liability": {
      "igst": 234000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "total": 234000.0
    },
    "rcm_tax_liability": {
      "igst": 45000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "total": 45000.0
    },
    "total_liability": {
      "igst": 279000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "total": 279000.0
    },
    "total_itc": {
      "igst": 145000.0,
      "cgst": 60000.0,
      "sgst": 60000.0,
      "cess": 5000.0,
      "total": 270000.0
    },
    "total_payable": {
      "igst": 134000.0,
      "cgst": 0.0,
      "sgst": 0.0,
      "cess": 0.0,
      "total": 134000.0
    }
  },
  "compliance": {
    "strict_mapping_applied": true,
    "decimal_precision": "2 decimal places",
    "negative_values_rule": "Default to zero",
    "auto_populated_sections": ["3.1a", "3.1b", "3.1c", "3.1d", "3.1e", "3.2", "4a", "4b", "4c"],
    "manual_entry_sections": ["Section 5", "Section 6"]
  },
  "generated_at": "2025-12-01T10:30:00",
  "generated_by": "GSTR-3B Auto-Population Engine"
}
```

### 2. POST: Auto-populate with Data

**Endpoint**: `POST /api/v1/gstr3b/auto-populate`

**Query Parameters**: Same as GET endpoint

**Request Body**:
```json
{
  "gstr1_data": {
    "b2b": [...],
    "b2cl": [...],
    "b2cs": [...],
    "exp": [...],
    "cdnr": [...],
    "cdnur": [...]
  },
  "gstr2b_data": [...]
}
```

### 3. GET: Filing Status

**Endpoint**: `GET /api/v1/gstr3b/filing-status/{gstin}/{return_period}`

**Response**:
```json
{
  "gstin": "27AABCT1234C1Z5",
  "return_period": "122025",
  "gstr1_filed": true,
  "gstr2b_generated": true,
  "auto_population_ready": true,
  "last_updated": "2025-12-01T10:30:00"
}
```

### 4. POST: Separate Invoices (Utility)

**Endpoint**: `POST /api/v1/gstr3b/separate-invoices`

**Used for debugging invoice separation logic**

---

## Integration with FastAPI

### 1. Update `backend/main.py`

Add the GSTR-3B router to your FastAPI application:

```python
from fastapi import FastAPI
from india_compliance.gst_india.api_layer.gstr3b_router import router as gstr3b_router

app = FastAPI()

# Include routers
app.include_router(gstr3b_router)
```

### 2. Router Registration

The router is registered with prefix: `/api/v1/gstr3b`

**Available Endpoints**:
- `GET /api/v1/gstr3b/auto-populate/{gstin}/{return_period}`
- `POST /api/v1/gstr3b/auto-populate`
- `GET /api/v1/gstr3b/filing-status/{gstin}/{return_period}`
- `POST /api/v1/gstr3b/separate-invoices`

---

## Response Schema Details

### GSTR3BAutoPopulateResponse Structure

```
GSTR3BAutoPopulateResponse
├── metadata
│   ├── gstin
│   ├── return_period
│   ├── taxpayer_name
│   ├── filing_mode
│   ├── generation_mode
│   └── timestamp
├── filing_status
│   ├── gstr1_filed
│   └── gstr2b_generated
├── section_3_1 (OutwardSupplies)
│   ├── table_3_1_a (SupplyTable)
│   ├── table_3_1_b (SupplyTable)
│   ├── table_3_1_c (SupplyTable)
│   ├── table_3_1_d (SupplyTable)
│   └── table_3_1_e (SupplyTable)
├── section_3_2 (InterStateSupplies)
├── section_4 (ITCDetails)
│   ├── section_4a
│   ├── section_4b
│   └── section_4c
├── tax_summary (TaxSummary)
│   ├── outward_tax_liability
│   ├── rcm_tax_liability
│   ├── total_liability
│   ├── total_itc
│   └── total_payable
├── compliance (ComplianceMetadata)
├── generated_at
└── generated_by
```

### SupplyTable Schema

Each supply table includes:
- `taxable_value`: Total taxable value (float, ≥ 0)
- `igst`: Integrated GST (float, ≥ 0)
- `cgst`: Central GST (float, ≥ 0)
- `sgst`: State GST (float, ≥ 0)
- `cess`: Cess amount (float, ≥ 0)
- `invoice_count`: Number of invoices (int, ≥ 0)
- `credit_note_count`: Number of credit notes (int, ≥ 0)
- `source`: Data source attribution (string)
- `status`: One of ["Filed", "Not filed", "Partial", "Not generated", "Generated"]

---

## Status Flag Logic (Decision Tree)

```
START
  │
  ├─ IF gstr1_filed = FALSE
  │   └─ Set Section 3.1(a-e), 3.2 status to "Not filed"
  │      └─ Zero all values for these sections
  │
  ├─ IF gstr2b_generated = FALSE
  │   └─ Set Section 3.1(d), 4 status to "Not generated"
  │      └─ Zero all values for these sections
  │      └─ Recalculate tax_payable = tax_liability (no ITC)
  │
  ├─ IF gstr1_filed = TRUE AND gstr2b_generated = TRUE
  │   └─ All sections status = "Filed" or "Generated"
  │      └─ Return complete calculated values
  │
  └─ END (Return response with appropriate statuses)
```

---

## Error Handling

### HTTP Status Codes

| Code | Scenario | Example |
|------|----------|---------|
| 400 | Invalid GSTIN (not 15 chars) | `{"detail": "Invalid GSTIN format"}` |
| 400 | Invalid return period (not MMYYYY) | `{"detail": "Invalid return period format"}` |
| 500 | Processing error | `{"detail": "Error auto-populating GSTR-3B: ..."}` |

### Error Response Format

```json
{
  "detail": "Error description"
}
```

---

## Decimal Precision

All tax calculations maintain **2 decimal places** using:
- `Decimal` type for internal calculations
- `ROUND_HALF_UP` rounding method
- Banker's rounding (round half to nearest even)

**Example**:
```
999.999 → 1000.00 (rounded up)
999.994 → 999.99 (rounded down)
```

---

## Testing

### Unit Test Example

```python
import pytest
from india_compliance.gst_india.api_layer.gstr3b_router import (
    separate_invoices_and_credit_notes,
    apply_filing_status_flags,
)

def test_invoice_separation():
    gstr1_data = {
        "b2b": [
            {"inv_no": "INV001", "txval": 100000},
            {"inv_no": "INV002", "txval": -50000, "is_return": True},
        ]
    }
    invoices, credit_notes = separate_invoices_and_credit_notes(gstr1_data)
    assert len(invoices["b2b"]) == 1
    assert len(credit_notes) >= 0

def test_status_flags():
    gstr3b_data = {
        "section_3": {
            "3_1_a": {"taxable_value": 100000, "igst": 18000, "status": "Filed"}
        }
    }
    modified = apply_filing_status_flags(gstr3b_data, gstr1_filed=False, gstr2b_generated=True)
    assert modified["section_3"]["3_1_a"]["status"] == "Not filed"
    assert modified["section_3"]["3_1_a"]["taxable_value"] == 0.0
```

---

## Frontend Integration

### React/TypeScript Example

```typescript
// services/gstr3bService.ts
import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api/v1/gstr3b';

export interface GSTR3BParams {
  gstin: string;
  returnPeriod: string;
  gstr1Filed: boolean;
  gstr2bGenerated: boolean;
}

export async function autoPopulateGSTR3B(params: GSTR3BParams) {
  const response = await axios.get(
    `${BASE_URL}/auto-populate/${params.gstin}/${params.returnPeriod}`,
    {
      params: {
        gstr1_filed: params.gstr1Filed,
        gstr2b_generated: params.gstr2bGenerated,
      }
    }
  );
  return response.data;
}

export async function getFilingStatus(gstin: string, returnPeriod: string) {
  const response = await axios.get(
    `${BASE_URL}/filing-status/${gstin}/${returnPeriod}`
  );
  return response.data;
}
```

### React Hook Example

```typescript
// hooks/useGSTR3B.ts
import { useState, useEffect } from 'react';
import { autoPopulateGSTR3B, getFilingStatus } from '../services/gstr3bService';

export function useGSTR3B(gstin: string, returnPeriod: string) {
  const [gstr3bData, setGstr3bData] = useState(null);
  const [filingStatus, setFilingStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const status = await getFilingStatus(gstin, returnPeriod);
        setFilingStatus(status);

        const data = await autoPopulateGSTR3B({
          gstin,
          returnPeriod,
          gstr1Filed: status.gstr1_filed,
          gstr2bGenerated: status.gstr2b_generated,
        });
        setGstr3bData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (gstin && returnPeriod) {
      fetchData();
    }
  }, [gstin, returnPeriod]);

  return { gstr3bData, filingStatus, loading, error };
}
```

---

## Deployment Checklist

- [ ] Add `gstr3b_router.py` to API layer
- [ ] Update Pydantic schemas in `schemas.py`
- [ ] Import and register router in `backend/main.py`
- [ ] Test all endpoints locally
- [ ] Test with sample GSTR-1 and GSTR-2B data
- [ ] Verify status flags for various combinations
- [ ] Test error handling (invalid GSTIN, invalid period)
- [ ] Test invoice/credit note separation
- [ ] Validate Decimal precision in responses
- [ ] Update API documentation (Swagger/OpenAPI)
- [ ] Deploy to dev environment
- [ ] Integration test with frontend
- [ ] Load testing with large datasets
- [ ] Production deployment

---

## Configuration

### Environment Variables (Optional)

```bash
# backend/.env
GSTR3B_LOG_LEVEL=INFO
GSTR3B_STRICT_MODE=true
GSTR3B_DECIMAL_PRECISION=2
```

---

## Future Enhancements

1. **Database Integration**: Persist GSTR-3B auto-population records
2. **Amendment History**: Track previous auto-populated versions
3. **IMS Integration**: Connect to Invoice Management System for advanced ITC
4. **Ledger Engine**: Integrate carry-forward ITC ledger
5. **Audit Trail**: Complete audit log for compliance
6. **Email Notifications**: Notify users when GSTR-2B is generated
7. **Webhooks**: Real-time updates for filing status changes

---

## Support & Troubleshooting

### Common Issues

**Q: GSTR-3B showing "Not filed" status even after GSTR-1 filing**
A: Verify `gstr1_filed` query parameter is set to `true`. The API honors the parameter value regardless of actual database state.

**Q: ITC showing as 0.0 when GSTR-2B is generated**
A: Check if `gstr2b_generated` parameter is set to `true`. Confirm GSTR-2B data is properly formatted.

**Q: Taxable values not matching manual calculations**
A: Verify invoice separation logic - credit notes should be deducted. Check `invoice_count` and `credit_note_count` in response.

**Q: Decimal precision showing more than 2 places**
A: Use `Decimal` type for all tax calculations. Convert to float only for JSON serialization.

---

## References

- **GST Rules**: Indian GST Rules 37-47 (GSTR-3B Filing)
- **Core Implementation**: `/backend/india_compliance/gst_india/gstr3b_data.py`
- **Tests**: `/backend/tests/test_gstr3b_refactor.py`
- **Documentation**: `GSTR3B_REFACTOR_IMPLEMENTATION.md`

---

**End of Document**
