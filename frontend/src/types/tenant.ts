export interface Workspace {
  id: string;
  name: string;
  description?: string;
  my_role?: string;
  member_count?: number;
  business_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  workspace_id: string;
  legal_name: string;
  trade_name?: string;
  gstin: string;
  pan?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantState {
  workspaces: Workspace[];
  businesses: Business[];
  activeWorkspaceId: string | null;
  activeBusinessId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed values
  activeWorkspace: Workspace | null;
  activeBusiness: Business | null;
  
  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchBusinesses: (workspaceId: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  setActiveBusiness: (id: string | null) => void;
  reset: () => void;
}
