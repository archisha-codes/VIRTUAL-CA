/**
 * GSTR1 Tabs Component
 * 
 * Tabbed navigation for GSTR-1 return sections.
 */

import { cn } from '@/lib/utils';

export type GSTR1TabId = 'b2b' | 'b2cl' | 'b2cs' | 'cdnr' | 'cnds' | 'hsn' | 'docs' | 'summary';

export interface GSTR1Tab {
  id: GSTR1TabId;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface GSTR1TabsProps {
  data?: Record<string, unknown> | null;
  activeTab?: GSTR1TabId;
  onTabChange?: (tabId: GSTR1TabId) => void;
  className?: string;
}

// Tab configuration with icons
export const GSTR1_TAB_CONFIG: Array<{ id: GSTR1TabId; label: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { id: 'summary', label: 'Summary', icon: BarChart3Icon },
  { id: 'b2b', label: 'B2B', icon: BuildingIcon },
  { id: 'b2cl', label: 'B2CL', icon: TruckIcon },
  { id: 'b2cs', label: 'B2CS', icon: PackageIcon },
  { id: 'cdnr', label: 'CDNR', icon: FileTextIcon },
  { id: 'cnds', label: 'CNDS', icon: RotateCcwIcon },
  { id: 'hsn', label: 'HSN', icon: TagIcon },
  { id: 'docs', label: 'Docs', icon: FileIcon },
];

export function GSTR1Tabs({ data, activeTab = 'summary', onTabChange, className }: GSTR1TabsProps) {
  // Generate tabs from data keys if data is provided
  const tabs: GSTR1Tab[] = data ? GSTR1_TAB_CONFIG.filter(tab => {
    // Check if data exists for this tab
    const tabData = data[tab.id];
    if (Array.isArray(tabData)) {
      return tabData.length > 0;
    }
    return tabData !== undefined && tabData !== null;
  }).map(tab => {
    const tabData = data[tab.id];
    let count: number | undefined;
    
    if (Array.isArray(tabData)) {
      count = tabData.length;
    } else if (tabData && typeof tabData === 'object' && 'totalInvoices' in tabData) {
      count = (tabData as { totalInvoices: number }).totalInvoices;
    }
    
    return { ...tab, count };
  }) : GSTR1_TAB_CONFIG.map(tab => ({ ...tab, count: undefined }));

  return (
    <div className={cn("flex border-b border-slate-200 dark:border-slate-700", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              "hover:text-slate-900 dark:hover:text-slate-100",
              isActive
                ? "border-corporate-primary text-corporate-primary"
                : "border-transparent text-slate-600 dark:text-slate-400"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-1 px-2 py-0.5 text-xs rounded-full",
                  isActive
                    ? "bg-corporate-primary/10 text-corporate-primary"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Default tabs configuration
export const DEFAULT_GSTR1_TABS: GSTR1Tab[] = [
  { id: 'summary', label: 'Summary', icon: BarChart3Icon },
  { id: 'b2b', label: 'B2B', icon: BuildingIcon },
  { id: 'b2cl', label: 'B2CL', icon: TruckIcon },
  { id: 'b2cs', label: 'B2CS', icon: PackageIcon },
  { id: 'cdnr', label: 'CDNR', icon: FileTextIcon },
  { id: 'hsn', label: 'HSN', icon: TagIcon },
  { id: 'docs', label: 'Docs', icon: FileIcon },
];

// Icons
function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16.5 9.4l-9-5.19" />
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M13 2v7h7" />
    </svg>
  );
}

function RotateCcwIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
