/**
 * useGSTR3BValidation — Debounced validation hook
 *
 * Calls POST /api/gstr3b/validate on every data change (500ms debounce).
 * Returns typed errors/warnings/info + canProceed + canFile flags.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
  section: string;
  field?: string;
  value?: number | string | null;
  expected?: number | string | null;
}

export interface ValidationState {
  isValid: boolean;
  canProceed: boolean;
  canFile: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface SectionState {
  table_3_enabled: boolean;
  table_4_enabled: boolean;
  table_5_enabled: boolean;
  table_6_enabled: boolean;
  nil_return: boolean;
}

export interface GSTR3BValidationResult {
  validation: ValidationState;
  sectionState: SectionState;
  isLoading: boolean;
}

// ─── Empty defaults ───────────────────────────────────────────────────────────

const EMPTY_VALIDATION: ValidationState = {
  isValid: true,
  canProceed: true,
  canFile: false, // default false until validated
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  errors: [],
  warnings: [],
  info: [],
};

const ENABLED_SECTIONS: SectionState = {
  table_3_enabled: true,
  table_4_enabled: true,
  table_5_enabled: true,
  table_6_enabled: true,
  nil_return: false,
};

// ─── API call ─────────────────────────────────────────────────────────────────

async function callValidate(payload: {
  gstin: string;
  ret_period: string;
  gstr3b_data: Record<string, unknown>;
  nil_return?: boolean;
  gstr1_reference?: Record<string, unknown>;
  gstr2b_reference?: Record<string, unknown>;
  override_flags?: Record<string, unknown>;
  previous_period_liability?: Record<string, unknown>;
}): Promise<{ validation: ValidationState; sectionState: SectionState }> {
  const resp = await fetch(`${API_URL}/api/gstr3b/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Validation request failed');
  }

  const json = await resp.json();
  const v = json.validation ?? {};

  const validation: ValidationState = {
    isValid: v.is_valid ?? true,
    canProceed: v.can_proceed ?? true,
    canFile: v.can_file ?? false,
    errorCount: v.error_count ?? 0,
    warningCount: v.warning_count ?? 0,
    infoCount: v.info_count ?? 0,
    errors: v.errors ?? [],
    warnings: v.warnings ?? [],
    info: v.info ?? [],
  };

  const sectionState: SectionState = {
    table_3_enabled: json.section_state?.table_3_enabled ?? true,
    table_4_enabled: json.section_state?.table_4_enabled ?? true,
    table_5_enabled: json.section_state?.table_5_enabled ?? true,
    table_6_enabled: json.section_state?.table_6_enabled ?? true,
    nil_return: json.section_state?.nil_return ?? false,
  };

  return { validation, sectionState };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

/**
 * Debounced GSTR-3B validation hook.
 *
 * Usage:
 *   const { validation, sectionState, isLoading } = useGSTR3BValidation({
 *     gstin: '07AADCB1626P1ZJ',
 *     retPeriod: '032026',
 *     data: { ... gstr3b fields ... },
 *     nilReturn: false,
 *   });
 *
 * @param debounceMs  Milliseconds to debounce (default 500)
 */
export function useGSTR3BValidation(
  params: {
    gstin?: string;
    retPeriod?: string;
    data?: Record<string, unknown>;
    nilReturn?: boolean;
    gstr1Reference?: Record<string, unknown>;
    gstr2bReference?: Record<string, unknown>;
    overrideFlags?: Record<string, unknown>;
    previousPeriodLiability?: Record<string, unknown>;
  },
  debounceMs = 500
): GSTR3BValidationResult {
  const { gstin, retPeriod, data, nilReturn = false } = params;
  const [debouncedData, setDebouncedData] = useState(data);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce data changes
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedData(data);
    }, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [data, debounceMs]);

  const enabled = !!(gstin && retPeriod && debouncedData);

  const query = useQuery({
    queryKey: ['gstr3b-validation', gstin, retPeriod, nilReturn, debouncedData],
    queryFn: () =>
      callValidate({
        gstin: gstin!,
        ret_period: retPeriod!,
        gstr3b_data: debouncedData ?? {},
        nil_return: nilReturn,
        gstr1_reference: params.gstr1Reference,
        gstr2b_reference: params.gstr2bReference,
        override_flags: params.overrideFlags,
        previous_period_liability: params.previousPeriodLiability,
      }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    validation: query.data?.validation ?? EMPTY_VALIDATION,
    sectionState: query.data?.sectionState ?? ENABLED_SECTIONS,
    isLoading: query.isFetching,
  };
}

// ─── Imperative mutation (for on-demand validation) ───────────────────────────

/**
 * Returns a `validate` function that can be called imperatively,
 * e.g. on "Proceed" button click before advancing steps.
 */
export function useGSTR3BValidateMutation() {
  return useMutation({
    mutationFn: (payload: Parameters<typeof callValidate>[0]) => callValidate(payload),
  });
}
