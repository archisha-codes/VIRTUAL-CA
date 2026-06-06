/**
 * GSTR3BITCUtilizationPanel — Visual ITC utilization breakdown
 *
 * Displays the Section 49 CGST Act utilization order:
 *   IGST ITC → IGST → CGST → SGST
 *   CGST ITC → CGST only
 *   SGST ITC → SGST only
 *   CESS ITC → CESS only
 *
 * Shows utilized amounts, cash liability, carry-forward, and the
 * audit log of steps performed by the engine.
 */

import React, { useState } from 'react';
import { ArrowRight, Wallet, TrendingDown, TrendingUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GSTR3BComputation, TaxHeads } from '@/hooks/useGSTR3BCompute';

interface Props {
  computation: GSTR3BComputation | null;
  isLoading?: boolean;
  className?: string;
}

function fmt(n: number): string {
  if (n === 0) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function HeadBadge({ label, value, variant = 'neutral' }: {
  label: string;
  value: number;
  variant?: 'positive' | 'negative' | 'neutral' | 'cash';
}) {
  const cls =
    variant === 'positive' ? 'bg-green-500/10 text-green-500 border-green-400/30' :
    variant === 'negative' ? 'bg-red-500/10 text-red-500 border-red-400/30' :
    variant === 'cash'     ? 'bg-amber-500/10 text-amber-600 border-amber-400/30' :
    'bg-muted text-muted-foreground border-border';

  return (
    <div className={cn('flex flex-col items-center px-3 py-2 rounded-lg border text-center min-w-[80px]', cls)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest mb-1">{label}</span>
      <span className="text-[13px] font-bold font-mono">{fmt(value)}</span>
    </div>
  );
}

function TaxRow({ label, heads, variant }: { label: string; heads: TaxHeads; variant?: 'positive' | 'negative' | 'cash' | 'neutral' }) {
  const total = (heads.igst ?? 0) + (heads.cgst ?? 0) + (heads.sgst ?? 0) + (heads.cess ?? 0);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[12px] text-muted-foreground w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        {heads.igst > 0 && <HeadBadge label="IGST" value={heads.igst} variant={variant} />}
        {heads.cgst > 0 && <HeadBadge label="CGST" value={heads.cgst} variant={variant} />}
        {heads.sgst > 0 && <HeadBadge label="SGST" value={heads.sgst} variant={variant} />}
        {heads.cess > 0 && <HeadBadge label="CESS" value={heads.cess} variant={variant} />}
        {total === 0 && <span className="text-[12px] text-muted-foreground italic">Nil</span>}
      </div>
      {total > 0 && (
        <span className="ml-auto text-[12px] font-semibold text-foreground font-mono shrink-0">
          {fmt(total)}
        </span>
      )}
    </div>
  );
}

export function GSTR3BITCUtilizationPanel({ computation, isLoading = false, className }: Props) {
  const [logExpanded, setLogExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('animate-pulse rounded-xl border border-border bg-card p-6', className)}>
        <div className="h-4 w-40 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-muted/60 rounded" />)}
        </div>
      </div>
    );
  }

  if (!computation) {
    return (
      <div className={cn('rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center', className)}>
        <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Run compute to see ITC utilization breakdown</p>
      </div>
    );
  }

  const { totalLiability, netItc4c, itcUtilized, cashLiability, carryForward, utilizationLog, totalPayable, negativeOutputTaxFlag, interest, lateFee } = computation;

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">ITC Utilization — Section 49 CGST Act</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="px-2 py-0.5 rounded-full border border-border bg-background">
            CGST ↔ SGST cross-use: <strong className="text-red-500">Blocked</strong>
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-1 divide-y divide-border/50">
        {/* Gross Liability */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pt-1">
            <TrendingUp className="inline h-3 w-3 mr-1" />Output Tax Liability (Table 6)
          </p>
          <TaxRow label="Total Liability" heads={totalLiability} />
        </div>

        {/* ITC Available (4C) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pt-3">
            <TrendingDown className="inline h-3 w-3 mr-1" />Net ITC Available (Table 4C)
          </p>
          <TaxRow label="4(A) − 4(B)" heads={netItc4c} variant="positive" />
          {Object.keys(netItc4c.negativeHeads ?? {}).length > 0 && (
            <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-600">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              <span>
                Negative net ITC in {Object.keys(netItc4c.negativeHeads).map(h => h.toUpperCase()).join(', ')} — added to Tax Payable (per GST law).
              </span>
            </div>
          )}
        </div>

        {/* Utilization Order */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pt-3">
            <ArrowRight className="inline h-3 w-3 mr-1" />ITC Utilized (in Order)
          </p>
          <TaxRow label="Utilized against liability" heads={itcUtilized} variant="positive" />

          {/* Utilization Log */}
          {utilizationLog.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setLogExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400"
              >
                {logExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {logExpanded ? 'Hide' : 'Show'} utilization order steps ({utilizationLog.length})
              </button>
              {logExpanded && (
                <ol className="mt-2 space-y-1 pl-2">
                  {utilizationLog.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="shrink-0 text-[10px] w-4 text-center font-bold text-foreground">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Cash Liability */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pt-3">
            Cash Ledger Payment Required
          </p>
          <TaxRow label="Cash liability" heads={cashLiability} variant="cash" />
        </div>

        {/* Carry Forward */}
        {(carryForward.igst + carryForward.cgst + carryForward.sgst + carryForward.cess) > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pt-3">
              Unused ITC — Carry Forward to Next Period
            </p>
            <TaxRow label="Carry forward" heads={carryForward} variant="neutral" />
          </div>
        )}

        {/* Interest & Late Fee */}
        {(interest || lateFee) && (
          <div className="pt-3 space-y-2">
            {interest && interest.delayDays > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-amber-400/30 bg-amber-500/5 text-[12px]">
                <div>
                  <p className="font-semibold text-amber-600">Interest (Section 50)</p>
                  <p className="text-muted-foreground text-[11px]">{interest.delayDays} days late × 18% p.a.</p>
                </div>
                <span className="font-bold text-amber-600 font-mono">{fmt(interest.interestAmount)}</span>
              </div>
            )}
            {lateFee && lateFee.delayDays > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-400/30 bg-red-500/5 text-[12px]">
                <div>
                  <p className="font-semibold text-red-500">Late Fee</p>
                  <p className="text-muted-foreground text-[11px]">{lateFee.delayDays} days × ₹{lateFee.ratePerDay}/day (CGST + SGST)</p>
                </div>
                <span className="font-bold text-red-500 font-mono">{fmt(lateFee.totalLateFee)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Total Payable Footer */}
      <div className={cn(
        'flex items-center justify-between px-5 py-4 border-t border-border',
        totalPayable === 0 ? 'bg-green-500/5' : 'bg-amber-500/5'
      )}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Net Tax Payable (Cash)</p>
          {negativeOutputTaxFlag && (
            <p className="text-[10px] text-amber-600 mt-0.5">⚠ Output tax was negative — clamped to 0 per GST law</p>
          )}
        </div>
        <div className="text-right">
          <p className={cn(
            'text-2xl font-bold font-mono',
            totalPayable === 0 ? 'text-green-500' : 'text-foreground'
          )}>
            {totalPayable === 0 ? 'NIL' : fmt(totalPayable)}
          </p>
          {totalPayable === 0 && (
            <p className="text-[10px] text-green-500 mt-0.5">Full liability offset by ITC</p>
          )}
        </div>
      </div>
    </div>
  );
}
