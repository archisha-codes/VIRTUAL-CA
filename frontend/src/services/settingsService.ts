/**
 * Settings Service
 * API calls for workspace administration and settings
 * ALL DATA IS REAL - NO MOCK DATA
 */

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
      // Handle direct response or wrapped response
      if (result && result.data !== undefined) {
        return result.data;
      }
      return result;
    }
  } catch (apiError) {
    console.warn(`Backend API not available for ${endpoint}:`, apiError);
  }
  return null;
};

// Hook-based API service
export function useSettingsService() {
  const { user, currentOrganization } = useAuth();

  // Workspace Details
  const getWorkspaceDetails = async (): Promise<WorkspaceDetails | null> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any>(
      workspaceId ? `/api/settings/workspace?workspace_id=${workspaceId}` : '/api/settings/workspace'
    );
    
    if (backendData) {
      return {
        id: backendData.id,
        name: backendData.name,
        billing_gstin: backendData.pan, // Using PAN as billing
        billing_pan: backendData.pan,
        legal_name: backendData.description,
        workspace_type: 'BUSINESS',
        created_at: backendData.created_at,
      };
    }

    // Fallback to Supabase
    if (!currentOrganization) {
      console.warn('No organization selected');
      return null;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', currentOrganization.id)
      .single();

    if (error) {
      console.error('Failed to get workspace details:', error);
      throw error;
    }
    
    return data;
  };

  const updateWorkspaceDetails = async (updates: Partial<WorkspaceDetails>): Promise<void> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrganization.id);

    if (error) {
      console.error('Failed to update workspace details:', error);
      throw error;
    }
  };

  // Workspace Security
  const getWorkspaceSecurity = async (): Promise<WorkspaceSecurity | null> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any>(
      workspaceId ? `/api/settings/security?workspace_id=${workspaceId}` : '/api/settings/security'
    );
    
    if (backendData) {
      return {
        login_providers: backendData.login_providers || ['google', 'microsoft'],
        username_password_enabled: backendData.username_password_enabled ?? true,
        idle_session_timeout_enabled: backendData.idle_session_timeout_enabled ?? true,
        idle_session_timeout_minutes: backendData.idle_session_timeout_minutes || 30,
      };
    }

    // Fallback to Supabase
    if (!currentOrganization) return null;

    const { data, error } = await supabase
      .from('workspace_security')
      .select('*')
      .eq('workspace_id', currentOrganization.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No security settings exist yet, return defaults
        return {
          login_providers: ['google', 'microsoft'],
          username_password_enabled: true,
          idle_session_timeout_enabled: true,
          idle_session_timeout_minutes: 30,
        };
      }
      console.error('Failed to get workspace security:', error);
      throw error;
    }
    
    return data;
  };

  const updateWorkspaceSecurity = async (updates: Partial<WorkspaceSecurity>): Promise<void> => {
    const workspaceId = currentOrganization?.id;
    
    // Try backend API first
    const backendResponse = await callBackendApi<any>(
      '/api/settings/security',
      {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...updates,
        }),
      }
    );
    
    if (backendResponse) {
      return;
    }

    // Fallback to Supabase
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('workspace_security')
      .upsert({
        workspace_id: currentOrganization.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id'
      });

    if (error) {
      console.error('Failed to update workspace security:', error);
      throw error;
    }
  };

  // Business/Entities
  const getBusinesses = async (): Promise<BusinessNode[]> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any[]>(
      workspaceId ? `/api/settings/businesses?workspace_id=${workspaceId}` : '/api/settings/businesses'
    );
    
    if (backendData && Array.isArray(backendData) && backendData.length > 0) {
      return backendData.map((biz: any) => ({
        id: biz.id,
        name: biz.name,
        pan: biz.pan,
        gstin: biz.gstin,
        branch_code: undefined,
        type: 'Company',
        children: [],
      }));
    }

    // Fallback to Supabase
    if (!user) throw new Error('No user logged in');

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get businesses:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to tree structure
    const businessMap = new Map<string, BusinessNode>();
    const roots: BusinessNode[] = [];

    data?.forEach(business => {
      businessMap.set(business.id, {
        id: business.id,
        name: business.name,
        pan: business.pan,
        gstin: business.gstin,
        branch_code: business.branch_code,
        type: business.type,
        children: [],
      });
    });

    data?.forEach(business => {
      const node = businessMap.get(business.id)!;
      if (business.parent_id && businessMap.has(business.parent_id)) {
        businessMap.get(business.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const addBusiness = async (business: {
    name: string;
    pan?: string;
    gstin?: string;
    type?: string;
    branch_code?: string;
    parent_id?: string;
  }): Promise<string> => {
    if (!user || !currentOrganization) throw new Error('No user or organization');

    const { data, error } = await supabase
      .from('businesses')
      .insert({
        owner_user_id: user.id,
        workspace_id: currentOrganization.id,
        parent_id: business.parent_id || null,
        name: business.name,
        pan: business.pan || null,
        gstin: business.gstin || null,
        type: business.type || 'Company',
        branch_code: business.branch_code || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add business:', error);
      throw error;
    }

    return data.id;
  };

  // Users
  const getWorkspaceUsers = async (): Promise<WorkspaceUser[]> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any[]>(
      workspaceId ? `/api/settings/users?workspace_id=${workspaceId}` : '/api/settings/users'
    );
    
    if (backendData && Array.isArray(backendData) && backendData.length > 0) {
      return backendData.map((u: any) => ({
        id: u.id || u.user_id,
        name: u.name || u.email?.split('@')[0],
        email: u.email || '',
        user_type: u.role === 'owner' ? 'Owner' : u.role === 'admin' ? 'Admin' : 'Regular user',
        products: u.products || [],
        role: u.role,
        is_current_user: u.user_id === user?.id,
      }));
    }

    // Fallback to Supabase
    if (!currentOrganization) throw new Error('No organization selected');

    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', currentOrganization.id);

    if (error) {
      console.error('Failed to get workspace users:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return (data || []).map(member => ({
      id: member.id,
      user_id: member.user_id,
      name: member.full_name || member.email?.split('@')[0] || 'Unknown',
      email: member.email || '',
      user_type: member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Regular user',
      products: member.products || [],
      role: member.role,
      is_current_user: member.user_id === user?.id,
      businesses: member.business_ids || [],
    }));
  };

  const inviteUser = async (email: string, role: string, products: string[]): Promise<void> => {
    if (!currentOrganization || !user) throw new Error('No organization or user');

    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: currentOrganization.id,
        user_id: user.id, // In real app, this would create invitation
        full_name: email.split('@')[0],
        email,
        role: role as 'owner' | 'admin' | 'member',
        products,
        invited_by: user.id,
        invitation_status: 'pending',
      });

    if (error) {
      console.error('Failed to invite user:', error);
      throw error;
    }
  };

  const updateUserRole = async (userId: string, role: string): Promise<void> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('organization_id', currentOrganization.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  };

  const removeUser = async (userId: string): Promise<void> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', currentOrganization.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to remove user:', error);
      throw error;
    }
  };

  // GSTIN Credentials
  const getGstinCredentials = async (): Promise<GstinCredential[]> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any[]>(
      workspaceId ? `/api/settings/gstin-credentials?workspace_id=${workspaceId}` : '/api/settings/gstin-credentials'
    );
    
    if (backendData && Array.isArray(backendData)) {
      return backendData.map((cred: any) => ({
        id: cred.id,
        gstin: cred.gstin,
        business_name: cred.business_name || '',
        connection_status: cred.status || 'active',
        username: cred.username,
        expires_on: cred.last_authenticated || cred.expires_on,
      }));
    }

    // Fallback to Supabase
    if (!currentOrganization) return [];

    const { data, error } = await supabase
      .from('gstin_credentials')
      .select('*')
      .eq('workspace_id', currentOrganization.id);

    if (error) {
      console.error('Failed to get GSTIN credentials:', error);
      throw error;
    }
    
    return data || [];
  };

  const createGstinCredential = async (gstin: string, username: string, password: string): Promise<string> => {
    const workspaceId = currentOrganization?.id;
    
    // Try backend API first
    const backendData = await callBackendApi<any>(
      '/api/settings/gstin-credentials',
      {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          gstin,
          username,
          password,
        }),
      }
    );
    
    if (backendData) {
      return backendData.id;
    }

    // Fallback to Supabase
    if (!currentOrganization) throw new Error('No organization selected');

    const { data, error } = await supabase
      .from('gstin_credentials')
      .insert({
        workspace_id: currentOrganization.id,
        gstin,
        username,
        password,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create GSTIN credential:', error);
      throw error;
    }

    return data.id;
  };

  const updateGstinCredential = async (id: string, updates: Partial<GstinCredential>): Promise<void> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendResponse = await callBackendApi<any>(
      `/api/settings/gstin-credentials/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...updates,
          workspace_id: workspaceId,
        }),
      }
    );
    
    if (backendResponse) {
      return;
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from('gstin_credentials')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to update GSTIN credential:', error);
      throw error;
    }
  };

  const deleteGstinCredential = async (id: string): Promise<void> => {
    // Try backend API first
    const backendResponse = await callBackendApi<any>(
      `/api/settings/gstin-credentials/${id}`,
      { method: 'DELETE' }
    );
    
    if (backendResponse || backendResponse === null) {
      return;
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from('gstin_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete GSTIN credential:', error);
      throw error;
    }
  };

  // NIC Credentials
  const getNicCredentials = async (): Promise<NicCredential[]> => {
    if (!currentOrganization) return [];

    const { data, error } = await supabase
      .from('nic_credentials')
      .select('*')
      .eq('workspace_id', currentOrganization.id);

    if (error) {
      console.error('Failed to get NIC credentials:', error);
      throw error;
    }
    return data || [];
  };

  const addNicCredential = async (gstin: string, nicUsername: string): Promise<void> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('nic_credentials')
      .insert({
        workspace_id: currentOrganization.id,
        gstin,
        nic_api_username: nicUsername,
      });

    if (error) {
      console.error('Failed to add NIC credential:', error);
      throw error;
    }
  };

  const deleteNicCredential = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('nic_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete NIC credential:', error);
      throw error;
    }
  };

  // Subscriptions
  const getSubscriptions = async (): Promise<SubscriptionPlan[]> => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any[]>(
      workspaceId ? `/api/settings/subscriptions?workspace_id=${workspaceId}` : '/api/settings/subscriptions'
    );
    
    if (backendData && Array.isArray(backendData)) {
      return backendData.map((sub: any) => ({
        id: sub.id,
        plan_name: sub.plan || sub.planName,
        validity_start: sub.start_date || sub.startDate,
        validity_end: sub.end_date || sub.endDate,
        status: sub.status === 'active' ? 'Active' : sub.status === 'expiring' ? 'Expiring Soon' : 'Expired',
      }));
    }

    // Fallback to Supabase
    if (!currentOrganization) return [];

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', currentOrganization.id)
      .order('validity_start', { ascending: false });

    if (error) {
      console.error('Failed to get subscriptions:', error);
      throw error;
    }
    return data || [];
  };

  // User Profile
  const getProfile = async (): Promise<UserProfile | null> => {
    // Try backend API first
    const backendData = await callBackendApi<any>('/api/settings/profile');
    
    if (backendData) {
      return {
        id: backendData.id,
        name: backendData.name || '',
        email: backendData.email || user?.email || '',
        phone_number: backendData.phone,
        country: 'India',
        language: 'English',
        profile_picture_url: undefined,
      };
    }

    // Fallback to Supabase
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }

    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.full_name || '',
      email: user.email || '',
      phone_number: profile.phone || undefined,
      country: 'India',
      language: 'English',
      profile_picture_url: profile.avatar_url || undefined,
    };
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.name,
        phone: updates.phone_number,
        avatar_url: updates.profile_picture_url,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  // Integrations
  const getIntegrations = async (): Promise<Integration[]> => {
    // Get all available integrations
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('is_active', true);

    if (intError) {
      console.error('Failed to get integrations:', intError);
      throw intError;
    }

    const connections: Record<string, boolean> = {};
    
    // Get connections if workspace exists
    if (currentOrganization) {
      const { data: conns } = await supabase
        .from('integration_connections')
        .select('integration_id, is_connected, connected_at')
        .eq('workspace_id', currentOrganization.id);

      if (conns) {
        conns.forEach(c => {
          connections[c.integration_id] = c.is_connected;
        });
      }
    }

    return (integrations || []).map(int => ({
      id: int.id,
      name: int.name,
      description: int.description || '',
      logo_url: int.logo_url || undefined,
      is_connected: connections[int.id] || false,
    }));
  };

  const toggleIntegration = async (integrationId: string, connect: boolean): Promise<void> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('integration_connections')
      .upsert({
        integration_id: integrationId,
        workspace_id: currentOrganization.id,
        is_connected: connect,
        connected_at: connect ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'integration_id,workspace_id'
      });

    if (error) {
      console.error('Failed to toggle integration:', error);
      throw error;
    }
  };

  // API Clients
  const getApiClients = async (): Promise<ApiClient[]> => {
    if (!currentOrganization) return [];

    const { data, error } = await supabase
      .from('api_clients')
      .select('*')
      .eq('workspace_id', currentOrganization.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get API clients:', error);
      throw error;
    }
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      client_id: c.client_id,
      created_at: c.created_at,
      last_used_at: c.last_used_at,
      permissions: c.permissions,
    }));
  };

  const createApiClient = async (name: string, permissions: string[]): Promise<string> => {
    if (!currentOrganization) throw new Error('No organization selected');

    const clientId = 'client_' + Math.random().toString(36).substring(2, 15);
    const clientSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const { data, error } = await supabase
      .from('api_clients')
      .insert({
        workspace_id: currentOrganization.id,
        name,
        client_id: clientId,
        client_secret: clientSecret,
        permissions,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create API client:', error);
      throw error;
    }
    return data.id;
  };

  const revokeApiClient = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('api_clients')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to revoke API client:', error);
      throw error;
    }
  };

  // Email Configuration
  const getEmailConfiguration = async () => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any>(
      workspaceId ? `/api/settings/email-configuration?workspace_id=${workspaceId}` : '/api/settings/email-configuration'
    );
    
    if (backendData) {
      return backendData;
    }

    // Fallback to Supabase
    if (!currentOrganization) return null;

    const { data, error } = await supabase
      .from('email_configurations')
      .select('*')
      .eq('workspace_id', currentOrganization.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to get email configuration:', error);
      throw error;
    }
    return data;
  };

  const updateEmailConfiguration = async (config: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    smtp_password?: string;
    from_email?: string;
    from_name?: string;
    is_active?: boolean;
  }): Promise<void> => {
    const workspaceId = currentOrganization?.id;
    
    // Try backend API first
    const backendResponse = await callBackendApi<any>(
      '/api/settings/email-configuration',
      {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...config,
        }),
      }
    );
    
    if (backendResponse) {
      return;
    }

    // Fallback to Supabase
    if (!currentOrganization) throw new Error('No organization selected');

    const { error } = await supabase
      .from('email_configurations')
      .upsert({
        workspace_id: currentOrganization.id,
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_username: config.smtp_username,
        smtp_password: config.smtp_password,
        from_email: config.from_email,
        from_name: config.from_name,
        is_active: config.is_active ?? true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id'
      });

    if (error) {
      console.error('Failed to update email configuration:', error);
      throw error;
    }
  };

  // DSC Configuration
  const getDscConfiguration = async () => {
    // Try backend API first
    const workspaceId = currentOrganization?.id;
    const backendData = await callBackendApi<any>(
      workspaceId ? `/api/settings/dsc?workspace_id=${workspaceId}` : '/api/settings/dsc'
    );
    
    if (backendData) {
      return backendData;
    }

    // Fallback to Supabase
    if (!currentOrganization) return null;

    const { data, error } = await supabase
      .from('dsc_configurations')
      .select('*')
      .eq('workspace_id', currentOrganization.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Failed to get DSC configuration:', error);
      throw error;
    }
    return data;
  };

  const createDscConfiguration = async (dscData: {
    name: string;
    certificate_file?: string;
    password?: string;
  }): Promise<string> => {
    const workspaceId = currentOrganization?.id;
    
    // Try backend API first
    const backendData = await callBackendApi<any>(
      '/api/settings/dsc',
      {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...dscData,
        }),
      }
    );
    
    if (backendData) {
      return backendData.id;
    }

    // Fallback to Supabase
    if (!currentOrganization) throw new Error('No organization selected');

    const { data, error } = await supabase
      .from('dsc_configurations')
      .insert({
        workspace_id: currentOrganization.id,
        name: dscData.name,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create DSC configuration:', error);
      throw error;
    }

    return data.id;
  };

  const deleteDscConfiguration = async (id: string): Promise<void> => {
    // Try backend API first
    const backendResponse = await callBackendApi<any>(
      `/api/settings/dsc/${id}`,
      { method: 'DELETE' }
    );
    
    if (backendResponse || backendResponse === null) {
      return;
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from('dsc_configurations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete DSC configuration:', error);
      throw error;
    }
  };

  return {
    // Workspace
    getWorkspaceDetails,
    updateWorkspaceDetails,
    getWorkspaceSecurity,
    updateWorkspaceSecurity,
    
    // Businesses
    getBusinesses,
    addBusiness,
    
    // Users
    getWorkspaceUsers,
    inviteUser,
    updateUserRole,
    removeUser,
    
    // GSTIN Credentials
    getGstinCredentials,
    createGstinCredential,
    updateGstinCredential,
    deleteGstinCredential,
    
    // NIC Credentials
    getNicCredentials,
    addNicCredential,
    deleteNicCredential,
    
    // Subscriptions
    getSubscriptions,
    
    // Profile
    getProfile,
    updateProfile,
    
    // Integrations
    getIntegrations,
    toggleIntegration,
    
    // API Clients
    getApiClients,
    createApiClient,
    revokeApiClient,

    // DSC & Email
    getDscConfiguration,
    createDscConfiguration,
    deleteDscConfiguration,
    getEmailConfiguration,
    updateEmailConfiguration,
  };
}
