/**
 * GSTR3BValidationBanner — Error / Warning / Info summary strip
 *
 * Renders a compact validation pill strip at the top of each GSTR-3B step.
 * Clicking a pill expands to show the full list of issues for that severity.
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationIssue } from '@/hooks/useGSTR3BValidation';

interface Props {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  info?: ValidationIssue[];
  isLoading?: boolean;
  className?: string;
}

type Panel = 'errors' | 'warnings' | 'info' | null;

export function GSTR3BValidationBanner({
  errors = [],
  warnings = [],
  info = [],
  isLoading = false,
  className,
}: Props) {
  const [open, setOpen] = useState<Panel>(null);

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasInfo = info.length > 0;
  const hasAnything = hasErrors || hasWarnings || hasInfo;

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2 text-[12px] text-muted-foreground animate-pulse', className)}>
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-ping" />
        Validating…
      </div>
    );
  }

  if (!hasAnything) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2 text-[12px] text-green-500', className)}>
        <span className="h-2 w-2 rounded-full bg-green-500" />
        All validations passed
      </div>
    );
  }

  const toggle = (panel: Panel) => setOpen(prev => prev === panel ? null : panel);

  return (
    <div className={cn('border-b border-border bg-card', className)}>
      {/* Pill strip */}
      <div className="flex items-center gap-2 px-5 py-2 flex-wrap">
        {hasErrors && (
          <button
            onClick={() => toggle('errors')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all',
              'bg-red-500/10 border-red-400/40 text-red-500 hover:bg-red-500/20',
              open === 'errors' && 'ring-1 ring-red-400'
            )}
          >
            <AlertCircle className="h-3 w-3" />
            {errors.length} Error{errors.length > 1 ? 's' : ''}
            {open === 'errors' ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </button>
        )}

        {hasWarnings && (
          <button
            onClick={() => toggle('warnings')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all',
              'bg-amber-500/10 border-amber-400/40 text-amber-500 hover:bg-amber-500/20',
              open === 'warnings' && 'ring-1 ring-amber-400'
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
            {open === 'warnings' ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </button>
        )}

        {hasInfo && (
          <button
            onClick={() => toggle('info')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all',
              'bg-blue-500/10 border-blue-400/40 text-blue-500 hover:bg-blue-500/20',
              open === 'info' && 'ring-1 ring-blue-400'
            )}
          >
            <Info className="h-3 w-3" />
            {info.length} Note{info.length > 1 ? 's' : ''}
            {open === 'info' ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </button>
        )}

        {open && (
          <button
            onClick={() => setOpen(null)}
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Collapse
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border px-5 pb-4 pt-3 max-h-72 overflow-y-auto">
          <IssueList
            issues={open === 'errors' ? errors : open === 'warnings' ? warnings : info}
            severity={open}
          />
        </div>
      )}
    </div>
  );
}

// ─── Issue List ───────────────────────────────────────────────────────────────

function IssueList({ issues, severity }: { issues: ValidationIssue[]; severity: Panel }) {
  const iconProps = { className: 'h-3.5 w-3.5 shrink-0 mt-0.5' };

  const icon =
    severity === 'errors' ? <AlertCircle {...iconProps} className={cn(iconProps.className, 'text-red-500')} /> :
    severity === 'warnings' ? <AlertTriangle {...iconProps} className={cn(iconProps.className, 'text-amber-500')} /> :
    <Info {...iconProps} className={cn(iconProps.className, 'text-blue-500')} />;

  const rowCls =
    severity === 'errors'   ? 'border-red-400/20 bg-red-500/5' :
    severity === 'warnings' ? 'border-amber-400/20 bg-amber-500/5' :
    'border-blue-400/20 bg-blue-500/5';

  return (
    <ul className="space-y-2">
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className={cn('flex gap-2.5 p-2.5 rounded-md border text-[12px]', rowCls)}>
          {icon}
          <div className="flex-1 min-w-0">
            <p className="text-foreground leading-snug">{issue.message}</p>
            <div className="flex items-center gap-3 mt-1 text-muted-foreground">
              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{issue.code}</span>
              {issue.section && (
                <span className="text-[10px]">Section: {issue.section}{issue.field ? `.${issue.field}` : ''}</span>
              )}
              {issue.value !== null && issue.value !== undefined && (
                <span className="text-[10px]">Got: <strong>{String(issue.value)}</strong></span>
              )}
              {issue.expected !== null && issue.expected !== undefined && (
                <span className="text-[10px]">Expected: <strong>{String(issue.expected)}</strong></span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
