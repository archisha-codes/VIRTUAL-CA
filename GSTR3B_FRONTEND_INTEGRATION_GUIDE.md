# GSTR-3B Frontend Integration Guide

## Overview

This guide explains how to integrate the GSTR-3B auto-population frontend components into your React application. All components work together to provide:

- ✅ Auto-population from backend API
- ✅ Saved state protection (no overwrite of user-entered data)
- ✅ Variance detection with 10% configurable threshold
- ✅ Non-blocking warning notifications
- ✅ GST-compliant decimal precision (2 places)
- ✅ Status flag display ("Not filed", "Not generated")
- ✅ Contextual tooltips for RCM guidance
- ✅ Full edit capability for all fields

## Architecture

```
GSTR3BAutoPopulationForm (Main Component)
├── useGSTR3BForm (Composite Hook)
│   ├── useGSTR3BAutoPopulate (Fetch backend data)
│   ├── useVarianceDetection (Track changes)
│   ├── useSavedState (Load/save localStorage)
│   └── useGSTR3BFormState (Manage form state)
├── UI Components (GSTR3BUI.tsx)
│   ├── ToastContainer (Non-blocking alerts)
│   ├── VarianceWarningModal (Detailed variance review)
│   ├── EditField (Individual field with edit capability)
│   ├── StatusBadge (Show filing status)
│   ├── SectionHeader (Section titles with status)
│   ├── SupplyTableDisplay (Table data display)
│   ├── LoadingSkeleton (Loading state)
│   ├── ErrorDisplay (Error state)
│   └── InfoBanner (Contextual information)
└── Utilities (gstr3b.utils.ts)
    ├── calculateVariancePercentage (Variance math)
    ├── formatCurrencyValue (2-decimal formatting)
    ├── checkSavedState (Read localStorage)
    ├── mergeSavedWithAutoPopulated (Smart merge logic)
    └── getStatusMessage (Status flag logic)
```

## File Structure

```
frontend/
├── src/
│   ├── types/
│   │   └── gstr3b.types.ts          # TypeScript interfaces
│   ├── hooks/
│   │   └── useGSTR3B.ts             # Custom hooks
│   ├── utils/
│   │   └── gstr3b.utils.ts          # Utility functions
│   └── components/
│       └── GSTR3B/
│           ├── GSTR3BAutoPopulationForm.tsx   # Main form component
│           └── GSTR3BUI.tsx                   # UI components library
```

## Quick Start

### 1. Import the Main Form Component

```tsx
import GSTR3BAutoPopulationForm from './components/GSTR3B/GSTR3BAutoPopulationForm';

function MyComponent() {
  const [gstin] = useState('27AAHFU5055K1Z0');
  const [returnPeriod] = useState('202401');

  return (
    <GSTR3BAutoPopulationForm
      gstin={gstin}
      returnPeriod={returnPeriod}
      onSave={async (data) => {
        // Save to backend
        console.log('Saving:', data);
      }}
      onSubmit={async (data) => {
        // File GSTR-3B
        console.log('Filing:', data);
      }}
      varianceThreshold={10}  // 10% - configurable
    />
  );
}
```

### 2. Component Props

```typescript
interface GSTR3BFormProps {
  gstin: string;                          // GSTIN number
  returnPeriod: string;                   // Format: YYYYMM
  initialSavedState?: LocalGSTR3BState;   // Existing saved state (optional)
  onSave?: (data: GSTR3BAutoPopulateResponse) => Promise<void>;
  onSubmit?: (data: GSTR3BAutoPopulateResponse) => Promise<void>;
  varianceThreshold?: number;             // Default: 10
}
```

## Features Explained

### 1. Auto-Population Flow

```
User Opens Form
    ↓
useGSTR3BAutoPopulate fetches: GET /api/v1/gstr3b/auto-populate/{gstin}/{returnPeriod}
    ↓
Backend returns GSTR3BAutoPopulateResponse with:
  - filing_status: { gstr1_filed, gstr2b_generated }
  - section_3_1: { table_3_1_a through e }
  - section_3_2: Interstate supplies
  - section_4: ITC details
  - tax_summary: Totals
    ↓
useSavedState checks localStorage for existing saved values
    ↓
mergeSavedWithAutoPopulated: If user had saved values before,
  merge them (saved values take precedence - NO OVERWRITE)
    ↓
Form renders with merged data
```

### 2. Status Flags

```typescript
// If gstr1_filed = false
→ Outward supply tables (3.1a-e, 3.2) show "Not filed"
→ User cannot edit these fields (read-only)

// If gstr2b_generated = false
→ ITC fields (section 4) show "Not generated"
→ User cannot edit these fields (read-only)
```

Example in code:
```tsx
const statusMessage = getStatusMessage(
  gstr1_filed,      // false
  gstr2b_generated, // true
  "3.1.a"           // table type
);
// Returns: "Not filed"
```

### 3. Variance Detection

**Threshold**: 10% (configurable)

```typescript
// When user edits a field:
variance% = Math.abs((newValue - originalValue) / originalValue) * 100

// If variance% > 10%:
if (variance% > 20%) {
  // High-risk: Show modal for confirmation
  showVarianceModal();
} else {
  // Normal: Show toast warning (auto-dismisses)
  showToastWarning();
}
```

**Important**: Variance warnings are **non-blocking**
- User can continue editing
- User can save without reverting
- Only provides guidance

### 4. Saved State Protection

LocalStorage Key: `gstr3b_saved_{gstin}_{returnPeriod}`

```javascript
// Example: GSTIN 27AAHFU5055K1Z0, Period 202401
localStorage key: "gstr3b_saved_27AAHFU5055K1Z0_202401"

Stored value:
{
  data: {
    section_3_1: { /* user-edited values */ },
    section_3_2: { /* user-edited values */ },
    ...
  },
  timestamp: "2024-01-15T10:30:00Z"
}
```

**Flow**:
1. Form loads auto-populated data from backend
2. Check localStorage for saved values
3. For each field: if saved value exists → use it (ignore auto-populated)
4. Display merged result to user
5. User edits → new edits merge with existing saved values
6. Save button → overwrites localStorage with new values

### 5. Toast Notifications (Non-Blocking)

```tsx
// Variance warning toast
{
  id: 'variance_123',
  type: 'warning',
  message: 'Table 3.1(a) - Taxable Value: Value changed by 15%. Please review.',
  duration: 6000  // Auto-dismiss after 6 seconds
}
```

Features:
- Stacks vertically at top-right
- Auto-dismisses after 6 seconds
- User can manually close
- Does NOT block filing
- Multiple toasts can show simultaneously

### 6. RCM Tooltip (Table 3.1(d))

```
⚠️ Important: System values do NOT include:
1. Supplies from unregistered persons liable to RCM
2. Import of services

You must manually add these if applicable.
```

This tooltip appears when hovering over the info icon next to Table 3.1(d) label.

## Data Flow Diagram

```
Backend API
   │
   └─→ GET /api/v1/gstr3b/auto-populate/{gstin}/{period}
       Returns: GSTR3BAutoPopulateResponse
       ↓
   useGSTR3BAutoPopulate Hook
   ├─ loading: boolean
   ├─ error: string | null
   └─ data: GSTR3BAutoPopulateResponse
       ↓
   useSavedState Hook
   ├─ Checks localStorage
   ├─ Returns: savedData, hasSavedData
       ↓
   Merge Logic (mergeSavedWithAutoPopulated)
   ├─ If savedData exists: use it
   ├─ Else: use autoPopulated
       ↓
   useGSTR3BFormState Hook
   ├─ currentFormValues
   ├─ isDirty
   ├─ varianceAlerts
       ↓
   Form Rendering
   ├─ Show status badges (Filed/Not filed)
   ├─ Show supply tables
   ├─ Show edit fields
       ↓
   User Interaction
   ├─ Click field → Enter edit mode
   ├─ Type new value
   ├─ Blur → Save change
   │   ├─ Calculate variance
   │   ├─ If variance > 10% → Show toast/modal
   │   └─ Update formState
       ↓
   Save Actions
   ├─ localStorage.setItem(key, data)
   ├─ Call onSave handler
```

## Variance Detection Examples

### Example 1: Within Threshold

```
Original: 100,000
User enters: 105,000
Variance: (105,000 - 100,000) / 100,000 * 100 = 5%
Threshold: 10%
Result: ✅ No warning (5% < 10%)
```

### Example 2: At Threshold

```
Original: 100,000
User enters: 110,000
Variance: 10%
Threshold: 10%
Result: ⚠️ Toast warning (10% ≥ 10%)
```

### Example 3: Exceeds Threshold

```
Original: 100,000
User enters: 125,000
Variance: 25%
Threshold: 10%
Result: 🔴 Modal confirmation (25% > 10%)
```

### Example 4: Zero Original Value

```
Original: 0
User enters: 50,000
Variance: Edge case handled
Result: ⚠️ Show warning (any non-zero from zero is significant)
```

## Status Message Logic

```typescript
function getStatusMessage(
  gstr1Filed: boolean,
  gstr2bGenerated: boolean,
  tableType: string
): string {
  // Outward supply tables
  if (['3.1.a', '3.1.b', '3.1.c', '3.1.e', '3.2'].includes(tableType)) {
    return gstr1Filed ? 'Filed' : 'Not filed';
  }
  
  // Inward supply / ITC tables
  if (['3.1.d', '4.a', '4.b', '4.c'].includes(tableType)) {
    return gstr2bGenerated ? 'Generated' : 'Not generated';
  }
  
  return 'Unknown';
}
```

## Common Issues & Solutions

### Issue 1: Data not appearing after backend is ready

**Solution**: Check status flags
```tsx
// If you see "Not filed" and "Not generated":
// - Backend is still processing
// - Wait and retry
// - Check gstr1_filed and gstr2b_generated flags
```

### Issue 2: Saved values disappearing on refresh

**Solution**: Check localStorage
```javascript
// Verify localStorage key exists:
// "gstr3b_saved_{gstin}_{returnPeriod}"

// Check browser DevTools:
// F12 → Application → Local Storage
```

### Issue 3: Variance warning not appearing

**Solution**: Check variance threshold
```tsx
// Default threshold is 10%
// Make sure actual variance exceeds threshold

const variance = Math.abs((newValue - originalValue) / originalValue) * 100;
console.log(`Variance: ${variance}% vs Threshold: 10%`);

// If variance < 10%, no warning appears (by design)
```

### Issue 4: Form appears read-only

**Solution**: Check status flags
```typescript
// Read-only happens when:
if (!gstr1_filed) {
  // Outward tables are read-only
}
if (!gstr2bGenerated) {
  // ITC tables are read-only
}

// Solution: File GSTR-1 or wait for GSTR-2B generation
```

## API Endpoints Expected

```
GET /api/v1/gstr3b/auto-populate/{gstin}/{return_period}

Response (202 OK):
{
  "metadata": {
    "gstin": "27AAHFU5055K1Z0",
    "return_period": "202401",
    "generation_timestamp": "2024-01-15T10:30:00Z"
  },
  "filing_status": {
    "gstr1_filed": true,
    "gstr2b_generated": true
  },
  "section_3_1": {
    "table_3_1_a": {
      "taxable_value": 500000,
      "igst": 0,
      "cgst": 45000,
      "sgst": 45000,
      "cess": 0,
      "invoice_count": 50,
      "credit_note_count": 2,
      "status": "Filed"
    },
    ...
  },
  ...
}
```

## TypeScript Support

All components are fully typed:

```typescript
// Form Props
GSTR3BFormProps

// State
GSTR3BAutoPopulateResponse
SupplyTable
VarianceAlert
FormState

// Hook Returns
useGSTR3BForm returns:
{
  backendData: GSTR3BAutoPopulateResponse | null,
  formState: Ref<GSTR3BAutoPopulateResponse | null>,
  varianceAlerts: VarianceAlert[],
  isDirty: boolean,
  loading: boolean,
  error: string | null,
  handleFieldChange: (path: string, value: number) => void,
  handleSave: (onSave?: Function) => Promise<void>,
  handleReset: () => void,
}
```

## Performance Considerations

1. **Debounce field changes** (optional):
```tsx
const debouncedFieldChange = useCallback(
  debounce((path: string, value: number) => {
    handleFieldChange(path, value);
  }, 300),
  []
);
```

2. **Lazy load sections**:
```tsx
// Load sections only when visible (if form is very long)
const [expandedSections, setExpandedSections] = useState({
  section_3_1: true,
  section_4: false,
});
```

3. **Memoize components**:
```tsx
const SupplyTableMemo = React.memo(SupplyTableDisplay);
```

## Browser Compatibility

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (iOS 14+)
- ✅ Mobile browsers (responsive design)

Requires:
- localStorage API support
- ES2016+ JavaScript
- React 16.8+ (hooks)
- TypeScript 4.0+ (if using TS)

## Testing

### Unit Test Example

```typescript
describe('GSTR3BAutoPopulationForm', () => {
  it('should show Not filed when gstr1_filed is false', () => {
    const mockData = {
      filing_status: { gstr1_filed: false, gstr2b_generated: true }
    };
    // Test rendering
  });

  it('should detect variance > 10%', () => {
    const variance = calculateVariancePercentage(100, 115);
    expect(variance).toBeGreaterThan(10);
  });

  it('should protect saved values from overwrite', () => {
    const saved = { taxable_value: 500 };
    const autoPopulated = { taxable_value: 1000 };
    const merged = mergeSavedWithAutoPopulated(autoPopulated, saved);
    expect(merged.taxable_value).toBe(500);
  });
});
```

## Deployment Checklist

- [ ] All TypeScript types imported correctly
- [ ] API endpoint URL configured (baseUrl in useGSTR3BAutoPopulate)
- [ ] localStorage keys match backend expectations
- [ ] CORS headers configured if backend is different domain
- [ ] Error handling tested
- [ ] Variance threshold validated (10% or custom)
- [ ] Save/Submit handlers implemented
- [ ] Status flags logic verified
- [ ] Decimal precision tested (2 places)
- [ ] Mobile responsiveness tested
- [ ] Browser compatibility confirmed

## Support & Troubleshooting

For issues:
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Check localStorage state (DevTools)
4. Verify GSTIN and return period format
5. Check status flags (gstr1_filed, gstr2b_generated)
6. Review variance calculation math
7. Test with sample data first

---

**Created**: 2024-01-15  
**Version**: 1.0  
**Maintained by**: Team  
**Last Updated**: 2024-01-15
