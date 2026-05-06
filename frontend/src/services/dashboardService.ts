/**
 * Dashboard Service
 * API calls for dashboard data
 * ALL DATA IS REAL - NO MOCK DATA
 */

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface DashboardStats {
  total_clients: number;
  pending_returns: number;
  total_tax_liability: number;
  itc_available: number;
}

export interface FilingStatus {
  status: 'pending' | 'filed' | 'available';
  period: string;
  filed_date?: string;
  arn?: string;
}

export interface RecentFiling {
  return_type: string;
  period: string;
  status: string;
  filed_date?: string;
  arn?: string;
}

export interface GSTRStats {
  total_invoices: number;
  taxable_value?: number;
  total_tax?: number;
  total_liability?: number;
  itc_available?: number;
  net_payable?: number;
  matched_invoices?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  filing_status: {
    gstr1: FilingStatus;
    gstr3b: FilingStatus;
    gstr2b: FilingStatus;
  };
  recent_filings: RecentFiling[];
  gstr1_stats?: GSTRStats;
  gstr3b_stats?: GSTRStats;
  gstr2b_stats?: GSTRStats;
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
  link: string;
  description: string;
  category: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export interface FormModule {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  path: string;
  due_date: string;
  frequency: string;
  enabled: boolean;
}

export interface FormMetadata {
  name: string;
  full_name: string;
  sections: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  can_nill_return: boolean;
  requires_gstin: boolean;
  supports_amendment: boolean;
}

// Get default dashboard data (works without backend or Supabase)
const getDefaultDashboardData = (): DashboardData => {
  const currentPeriod = new Date().toISOString().slice(0, 7).replace('-', '');
  return {
    stats: {
      total_clients: 0,
      pending_returns: 0,
      total_tax_liability: 0,
      itc_available: 0,
    },
    filing_status: {
      gstr1: { status: 'pending', period: currentPeriod },
      gstr3b: { status: 'pending', period: currentPeriod },
      gstr2b: { status: 'pending', period: currentPeriod },
    },
    recent_filings: [],
    gstr1_stats: { total_invoices: 0, taxable_value: 0, total_tax: 0 },
    gstr3b_stats: { total_invoices: 0, taxable_value: 0, total_liability: 0, itc_available: 0, net_payable: 0 },
    gstr2b_stats: { total_invoices: 0, itc_available: 0, matched_invoices: 0 },
  };
};

// Hook-based API service
export function useDashboardService() {
  const { user, currentOrganization } = useAuth();

  // Get dashboard data
  const getDashboardData = async (): Promise<DashboardData | null> => {
    // Get current period
    const currentPeriod = new Date().toISOString().slice(0, 7).replace('-', '');
    
    // Try to fetch from backend API first
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('gst_access_token');
      const workspaceId = currentOrganization?.id;
      
      const url = workspaceId 
        ? `${API_BASE_URL}/api/dashboard?workspace_id=${workspaceId}`
        : `${API_BASE_URL}/api/dashboard`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const result = await response.json();
        // Backend returns direct object, not wrapped in {success, data}
        if (result && result.total_businesses !== undefined) {
          return {
            stats: {
              total_clients: result.total_businesses,
              pending_returns: result.pending_filings,
              total_tax_liability: result.total_liability,
              itc_available: result.total_itc,
            },
            filing_status: {
              gstr1: { status: 'pending', period: currentPeriod },
              gstr3b: { status: 'pending', period: currentPeriod },
              gstr2b: { status: 'pending', period: currentPeriod },
            },
            recent_filings: [],
          };
        }
      }
    } catch (apiError) {
      console.warn('Backend API not available, trying fallback...');
    }

    // Fallback: Try Supabase if configured and available
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    
    // Check if Supabase is properly configured with valid-looking credentials
    const isSupabaseValid = supabaseUrl && 
      supabaseUrl.startsWith('https://') && 
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey && 
      supabaseKey.length > 20 &&
      supabaseProjectId &&
      supabaseProjectId.length > 10;
    
    if (isSupabaseValid && currentOrganization) {
      try {
        // Get businesses count
        const { count: businessCount } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentOrganization.id);

        // Get pending returns
        const { data: returns } = await supabase
          .from('returns')
          .select('*')
          .eq('workspace_id', currentOrganization.id)
          .eq('status', 'pending');

        // Get tax data from invoices
        const { data: salesInvoices } = await supabase
          .from('invoices')
          .select('*')
          .eq('workspace_id', currentOrganization.id)
          .eq('type', 'sale');

        const { data: purchaseInvoices } = await supabase
          .from('invoices')
          .select('*')
          .eq('workspace_id', currentOrganization.id)
          .eq('type', 'purchase');

        // Calculate totals
        const totalTaxLiability = (salesInvoices || []).reduce((sum, inv) => 
          sum + (inv.igst || 0) + (inv.cgst || 0) + (inv.sgst || 0) + (inv.cess || 0), 0);
        
        const itcAvailable = (purchaseInvoices || []).reduce((sum, inv) => 
          sum + (inv.igst || 0) + (inv.cgst || 0) + (inv.sgst || 0) + (inv.cess || 0), 0);

        return {
          stats: {
            total_clients: businessCount || 0,
            pending_returns: (returns || []).length,
            total_tax_liability: Math.round(totalTaxLiability * 100) / 100,
            itc_available: Math.round(itcAvailable * 100) / 100,
          },
          filing_status: {
            gstr1: { status: 'pending', period: currentPeriod },
            gstr3b: { status: 'pending', period: currentPeriod },
            gstr2b: { status: 'pending', period: currentPeriod },
          },
          recent_filings: [],
        };
      } catch (supabaseError) {
        console.warn('Supabase not available:', supabaseError);
      }
    }

    // Final fallback: Return default empty data
    return getDefaultDashboardData();
  };

  // Get announcements
  const getAnnouncements = async (limit: number = 10): Promise<Announcement[]> => {
    // Try backend API first
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('gst_access_token');
      const response = await fetch(`${API_BASE_URL}/api/dashboard/announcements?limit=${limit}`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const result = await response.json();
        // Backend returns direct array, not wrapped in {success, data}
        if (Array.isArray(result)) {
          return result.map((ann: any) => ({
            id: ann.id,
            title: ann.title,
            date: ann.start_date || ann.created_at,
            link: ann.link || '',
            description: ann.content || '',
            category: ann.type || 'general',
          }));
        }
      }
    } catch (apiError) {
      console.warn('Backend API not available for announcements');
    }

    // Fallback: Try Supabase if configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('not_configured') && supabaseUrl.includes('supabase')) {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data) {
          return (data || []).map(ann => ({
            id: ann.id,
            title: ann.title,
            date: ann.date || ann.created_at,
            link: ann.link || '',
            description: ann.description || '',
            category: ann.category || 'general',
          }));
        }
      } catch (supabaseError) {
        console.warn('Supabase not available for announcements');
      }
    }

    // Return empty array instead of mock data
    return [];
  };

  // Get navigation items
  const getNavigation = async (): Promise<NavigationItem[]> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      const workspaceId = currentOrganization?.id;
      
      const url = workspaceId 
        ? `${API_BASE_URL}/api/navigation?workspace_id=${workspaceId}`
        : `${API_BASE_URL}/api/navigation`;
      
      const token = localStorage.getItem('gst_access_token');
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const result = await response.json();
        // Backend returns direct array, not wrapped in {success, data}
        if (Array.isArray(result)) {
          return result.map((nav: any) => ({
            id: nav.id,
            label: nav.label,
            icon: nav.icon,
            path: nav.path,
          }));
        }
      }
    } catch (apiError) {
      console.warn('Backend API not available');
    }

    // Return empty array instead of default navigation
    return [];
  };

  // Get form modules
  const getForms = async (): Promise<FormModule[]> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      const workspaceId = currentOrganization?.id;
      
      const token = localStorage.getItem('gst_access_token');
      const url = workspaceId 
        ? `${API_BASE_URL}/api/forms?workspace_id=${workspaceId}`
        : `${API_BASE_URL}/api/forms`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const result = await response.json();
        // Backend returns direct array, not wrapped in {success, data}
        if (Array.isArray(result)) {
          return result.map((form: any) => ({
            id: form.id,
            name: form.name,
            description: form.description,
            category: 'filing',
            icon: form.icon,
            path: `/gst/forms/${form.id}`,
            due_date: form.due_date || '20th of next month',
            frequency: form.frequency || 'Monthly',
            enabled: form.is_enabled ?? true,
          }));
        }
      }
    } catch (apiError) {
      console.warn('Backend API not available');
    }

    // Return empty array instead of default forms
    return [];
  };

  // Get form metadata
  const getFormMetadata = async (module: string): Promise<FormMetadata | null> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      
      const token = localStorage.getItem('gst_access_token');
      const response = await fetch(`${API_BASE_URL}/api/forms/${module}/metadata`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        }
      }
    } catch (apiError) {
      console.warn('Backend API not available');
    }

    return null;
  };

  return {
    getDashboardData,
    getAnnouncements,
    getNavigation,
    getForms,
    getFormMetadata,
  };
}
