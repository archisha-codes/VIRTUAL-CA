import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workspace, Business } from '@/types/tenant';
import { fetchWorkspaces, fetchBusinesses as apiFetchBusinesses } from '@/lib/api';

interface TenantState {
  workspaces: Workspace[];
  businesses: Business[];
  activeWorkspaceId: string | null;
  activeBusinessId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchBusinesses: (workspaceId: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  setActiveBusiness: (id: string | null) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      businesses: [],
      activeWorkspaceId: null,
      activeBusinessId: null,
      isLoading: false,
      error: null,

      fetchWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
          const workspaces = await fetchWorkspaces();
          set({ workspaces, isLoading: false });
          
          const { activeWorkspaceId } = get();
          if (activeWorkspaceId) {
            const exists = workspaces.some((w: Workspace) => w.id === activeWorkspaceId);
            if (!exists) {
              set({ activeWorkspaceId: null, activeBusinessId: null, businesses: [] });
            } else {
              await get().fetchBusinesses(activeWorkspaceId);
            }
          }
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      fetchBusinesses: async (workspaceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const businesses = await apiFetchBusinesses(workspaceId);
          set({ businesses, isLoading: false });
          
          const { activeBusinessId } = get();
          if (activeBusinessId) {
            const exists = businesses.some((b: Business) => b.id === activeBusinessId);
            if (!exists) {
              set({ activeBusinessId: null });
            }
          }
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      setActiveWorkspace: (id: string | null) => {
        const currentId = get().activeWorkspaceId;
        if (id === currentId) return;

        set({ activeWorkspaceId: id, activeBusinessId: null, businesses: [] });
        if (id) {
          get().fetchBusinesses(id);
        }
      },

      setActiveBusiness: (id: string | null) => {
        set({ activeBusinessId: id });
      },

      reset: () => {
        set({
          workspaces: [],
          businesses: [],
          activeWorkspaceId: null,
          activeBusinessId: null,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'tenant-storage',
      partialize: (state) => ({ 
        activeWorkspaceId: state.activeWorkspaceId, 
        activeBusinessId: state.activeBusinessId 
      }),
    }
  )
);

// Helper selectors
export const useActiveWorkspace = () => {
  const { workspaces, activeWorkspaceId } = useTenantStore();
  return workspaces.find((w) => w.id === activeWorkspaceId) || null;
};

export const useActiveBusiness = () => {
  const { businesses, activeBusinessId } = useTenantStore();
  return businesses.find((b) => b.id === activeBusinessId) || null;
};
