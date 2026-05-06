import { useEffect } from 'react';
import { Building2, Store, ChevronDown, Check, Loader2, ArrowRight } from 'lucide-react';
import { useTenantStore, useActiveWorkspace, useActiveBusiness } from '@/store/tenantStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TenantSelector() {
  const { 
    workspaces, 
    businesses, 
    activeWorkspaceId, 
    activeBusinessId, 
    isLoading, 
    fetchWorkspaces,
    setActiveWorkspace,
    setActiveBusiness 
  } = useTenantStore();

  const activeWorkspace = useActiveWorkspace();
  const activeBusiness = useActiveBusiness();

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  if (isLoading && workspaces.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Workspace Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium max-w-[120px] truncate">
              {activeWorkspace?.name || 'Select Workspace'}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces (CA Firms)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.length === 0 && (
            <div className="p-2 text-xs text-slate-500 italic">No workspaces found</div>
          )}
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className={cn("text-sm", activeWorkspaceId === ws.id && "font-bold")}>
                  {ws.name}
                </span>
              </div>
              {activeWorkspaceId === ws.id && (
                <Check className="h-4 w-4 text-purple-600" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeWorkspaceId && <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}

      {/* Business Selector (Cascading) */}
      {activeWorkspaceId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Store className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium max-w-[150px] truncate">
                {activeBusiness?.legal_name || 'Select Client'}
              </span>
              {activeBusiness && (
                <Badge variant="secondary" className="ml-1 font-mono text-[10px] h-4 px-1">
                  {activeBusiness.gstin}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Client Businesses</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {businesses.length === 0 && (
              <div className="p-2 text-xs text-slate-500 italic">No businesses found in this workspace</div>
            )}
            {businesses.map((biz) => (
              <DropdownMenuItem
                key={biz.id}
                onClick={() => setActiveBusiness(biz.id)}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className={cn("text-sm", activeBusinessId === biz.id && "font-bold")}>
                    {biz.legal_name}
                  </span>
                  <span className="text-xs text-slate-500">{biz.gstin}</span>
                </div>
                {activeBusinessId === biz.id && (
                  <Check className="h-4 w-4 text-indigo-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
