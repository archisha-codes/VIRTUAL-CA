/**
 * useGSTR3BCompute — ITC utilization computation hook
 *
 * Calls POST /api/gstr3b/compute which runs the full ITC utilization engine
 * (Section 49, CGST Act order) and returns cash liability, carry-forward,
 * utilization log, and auto-validated result.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxHeads {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total?: number;
}

export interface ITCUtilizationResult {
  itcUtilized: TaxHeads;
  cashLiability: TaxHeads;
  carryForward: TaxHeads;
  utilizationLog: string[];
  totalPayable: number;
  negativeOutputTaxFlag: boolean;
  interest: {
    taxAmount: number;
    dueDate: string;
    paymentDate: string;
    delayDays: number;
    interestRatePct: number;
    interestAmount: number;
  } | null;
  lateFee: {
    dueDate: string;
    filingDate: string;
    delayDays: number;
    ratePerDay: number;
    cgstLateFee: number;
    sgstLateFee: number;
    totalLateFee: number;
  } | null;
}

export interface NetITC4C {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
  negativeHeads: Record<string, number>;
}

export interface GSTR3BComputation {
  nilReturn: boolean;
  totalLiability: TaxHeads;
  netItc4c: NetITC4C;
  itcUtilized: TaxHeads;
  cashLiability: TaxHeads;
  carryForward: TaxHeads;
  utilizationLog: string[];
  grossLiability?: TaxHeads;
  totalPayable: number;
  negativeOutputTaxFlag: boolean;
  interest: ITCUtilizationResult['interest'];
  lateFee: ITCUtilizationResult['lateFee'];
}

export interface ComputeResult {
  computation: GSTR3BComputation;
  computedData: Record<string, unknown>;
  validation: {
    isValid: boolean;
    canProceed: boolean;
    canFile: boolean;
    errorCount: number;
    warningCount: number;
    errors: Array<{ code: string; message: string; section: string }>;
    warnings: Array<{ code: string; message: string; section: string }>;
  };
  sectionState: {
    table_3_enabled: boolean;
    table_4_enabled: boolean;
    table_5_enabled: boolean;
    table_6_enabled: boolean;
  };
  draftSaved: boolean;
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function callCompute(payload: {
  gstin: string;
  ret_period: string;
  outward_supplies: Record<string, number>;
  rcm_liability: Record<string, number>;
  itc_4a: Record<string, number>;
  itc_4b: Record<string, number>;
  nil_return?: boolean;
  gstr2b_import_id?: string;
  workspace_id?: string;
  auto_save?: boolean;
}): Promise<ComputeResult> {
  const resp = await fetch(`${API_URL}/api/gstr3b/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Computation request failed');
  }

  const json = await resp.json();
  const c = json.computation ?? {};
  const v = json.validation ?? {};

  const computation: GSTR3BComputation = {
    nilReturn: c.nil_return ?? false,
    totalLiability: normalizeHeads(c.total_liability),
    netItc4c: {
      igst: Number(c.net_itc_4c?.igst ?? 0),
      cgst: Number(c.net_itc_4c?.cgst ?? 0),
      sgst: Number(c.net_itc_4c?.sgst ?? 0),
      cess: Number(c.net_itc_4c?.cess ?? 0),
      total: Number(c.net_itc_4c?.total ?? 0),
      negativeHeads: (c.net_itc_4c?.negative_heads ?? {}) as Record<string, number>,
    },
    itcUtilized: normalizeHeads(c.itc_utilized),
    cashLiability: normalizeHeads(c.cash_liability),
    carryForward: normalizeHeads(c.carry_forward),
    utilizationLog: c.utilization_log ?? [],
    grossLiability: normalizeHeads(c.gross_liability),
    totalPayable: c.total_payable ?? 0,
    negativeOutputTaxFlag: c.negative_output_tax_flag ?? false,
    interest: c.interest ?? null,
    lateFee: c.late_fee ?? null,
  };

  return {
    computation,
    computedData: json.computed_data ?? {},
    validation: {
      isValid: v.is_valid ?? true,
      canProceed: v.can_proceed ?? true,
      canFile: v.can_file ?? false,
      errorCount: v.error_count ?? 0,
      warningCount: v.warning_count ?? 0,
      errors: v.errors ?? [],
      warnings: v.warnings ?? [],
    },
    sectionState: {
      table_3_enabled: json.section_state?.table_3_enabled ?? true,
      table_4_enabled: json.section_state?.table_4_enabled ?? true,
      table_5_enabled: json.section_state?.table_5_enabled ?? true,
      table_6_enabled: json.section_state?.table_6_enabled ?? true,
    },
    draftSaved: json.draft_saved ?? false,
  };
}

function normalizeHeads(d: Record<string, unknown> | undefined): TaxHeads {
  if (!d) return { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 };
  return {
    igst: Number(d.igst ?? 0),
    cgst: Number(d.cgst ?? 0),
    sgst: Number(d.sgst ?? 0),
    cess: Number(d.cess ?? 0),
    total: Number(d.total ?? 0),
  };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

/**
 * Hook to compute GSTR-3B with full ITC utilization engine.
 * Invalidates the validation query cache after each compute.
 *
 * Usage:
 *   const { mutate: compute, data, isPending } = useGSTR3BCompute();
 *   compute({ gstin, retPeriod, outwardSupplies, itc4a, itc4b });
 */
export function useGSTR3BCompute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      gstin: string;
      retPeriod: string;
      outwardSupplies: Record<string, number>;
      rcmLiability?: Record<string, number>;
      itc4a: Record<string, number>;
      itc4b?: Record<string, number>;
      nilReturn?: boolean;
      gstr2bImportId?: string;
      workspaceId?: string;
      autoSave?: boolean;
    }) =>
      callCompute({
        gstin: params.gstin,
        ret_period: params.retPeriod,
        outward_supplies: params.outwardSupplies,
        rcm_liability: params.rcmLiability ?? { igst: 0, cgst: 0, sgst: 0, cess: 0 },
        itc_4a: params.itc4a,
        itc_4b: params.itc4b ?? { igst: 0, cgst: 0, sgst: 0, cess: 0 },
        nil_return: params.nilReturn ?? false,
        gstr2b_import_id: params.gstr2bImportId,
        workspace_id: params.workspaceId,
        auto_save: params.autoSave ?? true,
      }),

    onSuccess: (_data, variables) => {
      // Invalidate validation cache so the validation hook re-runs with new data
      queryClient.invalidateQueries({
        queryKey: ['gstr3b-validation', variables.gstin, variables.retPeriod],
      });
    },
  });
}

// ─── File 3B mutation ─────────────────────────────────────────────────────────

async function callFile(payload: {
  gstin: string;
  ret_period: string;
  workspace_id: string;
  gstr3b_data: Record<string, unknown>;
  otp?: string;
}) {
  const resp = await fetch(`${API_URL}/api/gstr3b/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await resp.json();
  if (!resp.ok && !json.success) {
    throw new Error(json.detail ?? json.message ?? 'Filing failed');
  }
  return json as {
    success: boolean;
    filed: boolean;
    message: string;
    arn?: string;
    filed_at?: string;
    blocking_reasons?: string[];
    warnings?: Array<{ message: string }>;
  };
}

/**
 * Hook to file GSTR-3B via the gate-validated filing endpoint.
 * The endpoint runs full validation before filing — hard errors block the request.
 */
export function useGSTR3BFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      gstin: string;
      retPeriod: string;
      workspaceId: string;
      gstr3bData: Record<string, unknown>;
      otp?: string;
    }) =>
      callFile({
        gstin: params.gstin,
        ret_period: params.retPeriod,
        workspace_id: params.workspaceId,
        gstr3b_data: params.gstr3bData,
        otp: params.otp,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gstr3b-data', variables.gstin] });
      queryClient.invalidateQueries({ queryKey: ['gstr3b-validation'] });
    },
  });
}
