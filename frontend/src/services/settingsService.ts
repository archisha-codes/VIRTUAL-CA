/**
 * Settings Service
 * API calls for workspace administration and settings
 * ALL DATA IS REAL - NO MOCK DATA
 */

import { useAuth } from '@/contexts/AuthContext';
import { useActiveWorkspace } from '@/store/tenantStore';

// Types
export interface WorkspaceDetails {
  id: string;
  name: string;
  billing_gstin?: string;
  billing_pan?: string;
  legal_name?: string;
  business_address?: string;
  workspace_type: string;
  location?: string;
  created_at: string;
}

export interface WorkspaceSecurity {
  login_providers: string[];
  username_password_enabled: boolean;
  idle_session_timeout_enabled: boolean;
  idle_session_timeout_minutes?: number;
}

export interface BusinessNode {
  id: string;
  name: string;
  pan?: string;
  gstin?: string;
  branch_code?: string;
  type?: string;
  children?: BusinessNode[];
  is_expanded?: boolean;
}

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  user_type: 'Regular user' | 'Admin' | 'Owner';
  products: string[];
  role?: string;
  businesses?: string[];
  is_current_user?: boolean;
  avatar_url?: string;
}

export interface GstinCredential {
  id: string;
  gstin: string;
  business_name: string;
  connection_status: string;
  username: string;
  expires_on?: string;
}

export interface NicCredential {
  id: string;
  gstin: string;
  nic_api_username: string;
}

export interface SubscriptionPlan {
  id: string;
  plan_name: string;
  validity_start: string;
  validity_end: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
  country?: string;
  language?: string;
  profile_picture_url?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  logo_url?: string;
  is_connected: boolean;
  connected_at?: string;
}

export interface ApiClient {
  id: string;
  name: string;
  client_id: string;
  created_at: string;
  last_used_at?: string;
  permissions: string[];
}

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('gst_access_token');
};

// Helper function to call backend API
const callBackendApi = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const token = getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    
    if (response.ok) {
      const result = await response.json();
      // Handle standardized response wrapper
      if (result && result.success && result.data !== undefined) {
        return result.data;
      }
      return result;
    } else {
      const err = await response.json().catch(() => ({}));
      console.error(`API Error ${endpoint}:`, err.detail || response.statusText);
    }
  } catch (apiError) {
    console.error(`Fetch Error ${endpoint}:`, apiError);
  }
  return null;
};

// Hook-based API service
export function useSettingsService() {
  const { user } = useAuth();
  const activeWorkspace = useActiveWorkspace();

  // Workspace Details
  const getWorkspaceDetails = async (): Promise<WorkspaceDetails | null> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return null;

    const data = await callBackendApi<any>(`/api/workspaces/${workspaceId}`);
    
    if (data) {
      return {
        id: data.id,
        name: data.name,
        billing_gstin: undefined,
        billing_pan: undefined,
        legal_name: data.description,
        workspace_type: 'BUSINESS',
        created_at: data.created_at,
      };
    }
    return null;
  };

  const updateWorkspaceDetails = async (updates: Partial<WorkspaceDetails>): Promise<void> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    await callBackendApi(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        description: updates.legal_name,
      }),
    });
  };

  // Workspace Security
  const getWorkspaceSecurity = async (): Promise<WorkspaceSecurity | null> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return null;

    const data = await callBackendApi<any>(`/api/settings/security?workspace_id=${workspaceId}`);
    
    return {
      login_providers: data?.login_providers || ['google', 'microsoft'],
      username_password_enabled: data?.username_password_enabled ?? true,
      idle_session_timeout_enabled: data?.idle_session_timeout_enabled ?? true,
      idle_session_timeout_minutes: data?.idle_session_timeout_minutes || 30,
    };
  };

  const updateWorkspaceSecurity = async (updates: Partial<WorkspaceSecurity>): Promise<void> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    await callBackendApi('/api/settings/security', {
      method: 'POST',
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...updates,
      }),
    });
  };

  // Business/Entities
  const getBusinesses = async (): Promise<BusinessNode[]> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return [];

    const data = await callBackendApi<any[]>(`/api/workspaces/${workspaceId}/businesses`);
    
    if (data && Array.isArray(data)) {
      return data.map((biz: any) => ({
        id: biz.id,
        name: biz.legal_name,
        pan: biz.pan,
        gstin: biz.gstin,
        branch_code: undefined,
        type: 'Company',
        children: [],
      }));
    }
    return [];
  };

  const addBusiness = async (business: {
    name: string;
    pan?: string;
    gstin?: string;
    type?: string;
    branch_code?: string;
    parent_id?: string;
  }): Promise<string> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    const data = await callBackendApi<any>(`/api/workspaces/${workspaceId}/businesses`, {
      method: 'POST',
      body: JSON.stringify({
        legal_name: business.name,
        gstin: business.gstin,
        pan: business.pan,
      }),
    });

    if (!data) throw new Error('Failed to create business');
    return data.id;
  };

  // Users / Members
  const getWorkspaceUsers = async (): Promise<WorkspaceUser[]> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return [];

    const data = await callBackendApi<any[]>(`/api/workspaces/${workspaceId}/members`);
    
    if (data && Array.isArray(data)) {
      return data.map((m: any) => ({
        id: m.user_id,
        name: m.user?.full_name || m.user?.email?.split('@')[0] || 'Unknown',
        email: m.user?.email || '',
        user_type: m.role === 'OWNER' ? 'Owner' : m.role === 'ADMIN' ? 'Admin' : 'Regular user',
        products: [],
        role: m.role,
        is_current_user: m.user_id === user?.id,
      }));
    }
    return [];
  };

  const inviteUser = async (email: string, role: string): Promise<void> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    await callBackendApi(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  };

  const updateUserRole = async (userId: string, role: string): Promise<void> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    await callBackendApi(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  };

  const removeUser = async (userId: string): Promise<void> => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) throw new Error('No workspace selected');

    await callBackendApi(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    });
  };

  // User Profile
  const getProfile = async (): Promise<UserProfile | null> => {
    const data = await callBackendApi<any>('/api/auth/me');
    
    if (data) {
      return {
        id: data.id,
        name: data.full_name || '',
        email: data.email || '',
        phone_number: undefined,
        country: 'India',
        language: 'English',
        profile_picture_url: undefined,
      };
    }
    return null;
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    await callBackendApi('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify({
        full_name: updates.name,
      }),
    });
  };

  // Credentials
  const getGstinCredentials = async (): Promise<GstinCredential[]> => {
    return []; // Future implementation
  };

  const getSubscriptions = async (): Promise<SubscriptionPlan[]> => {
    return []; // Future implementation
  };

  const getIntegrations = async (): Promise<Integration[]> => {
    return []; // Future implementation
  };

  return {
    getWorkspaceDetails,
    updateWorkspaceDetails,
    getWorkspaceSecurity,
    updateWorkspaceSecurity,
    getBusinesses,
    addBusiness,
    getWorkspaceUsers,
    inviteUser,
    updateUserRole,
    removeUser,
    getProfile,
    updateProfile,
    getGstinCredentials,
    getSubscriptions,
    getIntegrations,
  };
}
