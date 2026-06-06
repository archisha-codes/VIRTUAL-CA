import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import { useTenantStore } from '@/store/tenantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Building2,
  Users,
  FileText,
  Settings,
  Plus,
  Trash2,
  Edit,
  MoreVertical,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Globe,
  Shield,
  Loader2,
  Send,
  GitCompare,
  Star,
} from 'lucide-react';

// ─── Zod Schemas ────────────────────────────────────────────────────────────
const workspaceSchema = z.object({
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter.'),
  name: z.string().min(2, 'Workspace name must be at least 2 characters.'),
  description: z.string().optional(),
});
type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

const gstinSchema = z.object({
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format.'),
  legal_name: z.string().min(2, 'Legal name is required.'),
  trade_name: z.string().optional(),
  state: z.string().min(2, 'State is required.'),
  registration_type: z.enum(['regular', 'composition', 'sez', 'isd']),
  category: z.string().default('b2b'),
});
type GSTINFormValues = z.infer<typeof gstinSchema>;

// Backend UserRole enum: OWNER | ADMIN | MEMBER
const memberSchema = z.object({
  user_id: z.string().email('Invalid email address format.'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER'], { errorMap: () => ({ message: "Role must be OWNER, ADMIN, or MEMBER." }) }),
  gstin_access: z.array(z.string()).default([]),
});
type MemberFormValues = z.infer<typeof memberSchema>;

// Types
interface Workspace {
  id: string;
  pan: string;
  name: string;
  description?: string;
  gstin_count: number;
  active_gstin_count: number;
  member_count: number;
  owner_id: string;
  created_at: string;
}

interface GSTIN {
  id: string;
  gstin: string;
  legal_name: string;
  trade_name?: string;
  state: string;
  status: 'active' | 'inactive' | 'cancelled';
  registration_type: string;
  category: string;
  is_default: boolean;
}

interface Member {
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  gstin_access: string[];
  can_manage_members: boolean;
  can_file_returns: boolean;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface WorkspaceDetails extends Workspace {
  members: Member[];
  gstins: GSTIN[];
  settings: {
    default_return_type: string;
    auto_reconciliation: boolean;
    consolidated_filing: boolean;
    timezone: string;
  };
  is_active: boolean;
}

interface ConsolidatedMetrics {
  total_gstins: number;
  active_gstins: number;
  inactive_gstins: number;
  total_taxable_value: number;
  total_igst: number;
  total_cgst: number;
  total_sgst: number;
  total_cess: number;
  total_liability: number;
  total_itc: number;
  filed_returns: number;
  pending_returns: number;
  overdue_returns: number;
  period: string;
  by_state: Record<string, { taxable_value: number; igst: number; cgst: number; sgst: number; cess: number }>;
  by_category: Record<string, { taxable_value: number; igst: number; cgst: number; sgst: number; cess: number }>;
}

const API_BASE = '/api';

// Generate last 12 months as [{ value: 'YYYY-MM', label: 'Month YYYY' }]
const getLast12Months = (): { value: string; label: string }[] => {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }
  return months;
};
const PERIOD_OPTIONS = getLast12Months();


export default function Workspaces() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    workspaces,
    activeWorkspaceId,
    isLoading,
    fetchWorkspaces: fetchGlobalWorkspaces,
    setActiveWorkspace,
    setActiveBusiness,
  } = useTenantStore();

  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetails | null>(null);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'overview');
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGSTINDialog, setShowGSTINDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [metrics, setMetrics] = useState<ConsolidatedMetrics | null>(null);
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0].value);

  // Confirmation dialog state for destructive actions
  const [pendingDeleteGstinId, setPendingDeleteGstinId] = useState<string | null>(null);
  const [pendingDeleteMember, setPendingDeleteMember] = useState<Member | null>(null);
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<string | null>(null);
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);

  // Per-form submission loading flags
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [isAddingGstin, setIsAddingGstin] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // react-hook-form instances
  const wsForm = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { pan: '', name: '', description: '' },
  });
  const gstinForm = useForm<GSTINFormValues>({
    resolver: zodResolver(gstinSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { gstin: '', legal_name: '', trade_name: '', state: '', registration_type: 'regular', category: 'b2b' },
  });
  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { user_id: '', role: 'MEMBER', gstin_access: [] },
  });

  // ─── Component init ────────────────────────────────────────────────────────
  const navigate = useNavigate();

  // INR formatter — Indian Numbering System (e.g. ₹1,50,000.00)
  const formatINR = (value: number): string =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);

  // Compare GSTINs dialog state
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  // Toggle GSTIN selection for comparison (max 3)
  const toggleCompareId = (id: string) => {
    setSelectedCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  // Report navigation helpers
  const navigateToReport = (type: string) => {
    navigate(`/reports?type=${type}&ws=${activeWorkspaceId ?? ''}`);
  };

  // Send Reminders mock
  const sendReminders = () => {
    console.info('[Workspaces] Dispatching email reminders to clients for pending returns');
    toast({ title: 'Reminders Dispatched', description: 'Email reminders have been sent to all pending return owners.' });
  };

  // Bulk File Returns
  const bulkFileReturns = () => {
    if (!metrics || metrics.pending_returns === 0) {
      toast({ title: 'All Returns Filed', description: 'All returns are already filed for this period.' });
      return;
    }
    navigate('/filing/bulk');
  };

  // Compare GSTINs submit
  const handleCompareGstins = () => {
    console.info('[Workspaces] GSTIN comparison triggered', selectedCompareIds);
    toast({ title: 'Comparison Initiating…', description: 'Comparison feature initiating...' });
    setShowCompareDialog(false);
    setSelectedCompareIds([]);
  };

  // Helper to update URL search params
  const updateSearchParams = useCallback(
    (wsId: string, tab: string) => {
      setSearchParams({ ws: wsId, tab }, { replace: true });
    },
    [setSearchParams]
  );

  // On mount: fetch workspaces, then resolve active workspace from URL or store
  useEffect(() => {
    const run = async () => {
      await fetchGlobalWorkspaces();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After workspaces load, sync URL <-> store
  useEffect(() => {
    if (isLoading || workspaces.length === 0) return;

    const urlWs = searchParams.get('ws');
    const urlTab = searchParams.get('tab') || 'overview';

    let targetId: string;
    if (urlWs && workspaces.some((w) => w.id === urlWs)) {
      targetId = urlWs;
    } else if (activeWorkspaceId && workspaces.some((w) => w.id === activeWorkspaceId)) {
      targetId = activeWorkspaceId;
    } else {
      targetId = workspaces[0].id;
    }

    setActiveWorkspace(targetId);
    setActiveTab(urlTab);
    updateSearchParams(targetId, urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, workspaces.length]);

  // Fetch details + metrics whenever active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchWorkspaceDetails(activeWorkspaceId);
      fetchMetrics(activeWorkspaceId);
    }
  }, [activeWorkspaceId, period]);

  const handleWorkspaceSelect = (ws: Workspace) => {
    setActiveWorkspace(ws.id);
    updateSearchParams(ws.id, activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (activeWorkspaceId) updateSearchParams(activeWorkspaceId, tab);
  };

  const fetchWorkspaceDetails = async (workspaceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}`, {
        headers: await getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedWorkspace(data);
      }
    } catch (error) {
      console.error('Failed to fetch workspace details:', error);
    }
  };

  const fetchMetrics = async (workspaceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/consolidated/summary/${period}`, {
        headers: await getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  // Helper: parse FastAPI error detail (handles string or list shapes)
  const parseApiError = (errorData: any, fallback: string): string => {
    if (!errorData?.detail) return fallback;
    if (typeof errorData.detail === 'string') return errorData.detail;
    if (Array.isArray(errorData.detail)) {
      return errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
    }
    return fallback;
  };

  const createWorkspace = async (payload: WorkspaceFormValues) => {
    if (!user) return;
    console.info('[Workspaces] Attempting to create workspace with payload:', payload);
    setIsCreatingWs(true);
    try {
      const response = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({ title: 'Workspace Created', description: `"${payload.name}" is ready.` });
        setShowCreateDialog(false);
        wsForm.reset();
        await fetchGlobalWorkspaces();
        setActiveWorkspace(data.id);
        updateSearchParams(data.id, activeTab);
      } else {
        const msg = parseApiError(data, 'Failed to create workspace');
        const title = response.status === 409 ? 'Conflict' : response.status === 422 ? 'Validation Error' : 'Error';
        toast({ title, description: msg, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] createWorkspace network error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsCreatingWs(false);
    }
  };

  const addGSTIN = async (payload: GSTINFormValues) => {
    if (!selectedWorkspace || !user) {
      toast({ title: 'Error', description: 'No active workspace selected.', variant: 'destructive' });
      return;
    }
    console.info('[Workspaces] Attempting to add GSTIN with payload:', payload);
    setIsAddingGstin(true);
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/gstins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({ title: 'GSTIN Added', description: `${payload.gstin} registered successfully.` });
        setShowGSTINDialog(false);
        gstinForm.reset();
        fetchWorkspaceDetails(selectedWorkspace.id);
      } else {
        const msg = parseApiError(data, 'Failed to add GSTIN');
        const title = response.status === 409 ? 'Conflict' : response.status === 422 ? 'Validation Error' : 'Error';
        toast({ title, description: msg, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] addGSTIN network error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsAddingGstin(false);
    }
  };

  const addMember = async (payload: MemberFormValues) => {
    if (!selectedWorkspace || !user) return;
    console.info('[Workspaces] Attempting to add member with payload:', payload);
    setIsAddingMember(true);
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({
          email: payload.user_id,
          role: payload.role,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({ title: 'Member Added', description: `${payload.user_id} added to workspace.` });
        setShowMemberDialog(false);
        memberForm.reset();
        fetchWorkspaceDetails(selectedWorkspace.id);
      } else {
        const msg = parseApiError(data, 'Failed to add member');
        const title = response.status === 409 ? 'Conflict' : response.status === 422 ? 'Validation Error' : 'Error';
        toast({ title, description: msg, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] addMember network error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsAddingMember(false);
    }
  };

  const confirmRemoveGSTIN = async () => {
    if (!pendingDeleteGstinId || !selectedWorkspace || !user) return;
    const gstinId = pendingDeleteGstinId;
    setPendingDeleteGstinId(null);
    setIsTableRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/gstins/${gstinId}?workspace_id=${selectedWorkspace.id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        // Optimistically remove from local state, then re-fetch for accuracy
        setSelectedWorkspace((prev) =>
          prev ? { ...prev, gstins: prev.gstins?.filter((g) => g.id !== gstinId) ?? [] } : prev
        );
        toast({ title: 'GSTIN Removed', description: 'The GSTIN has been unregistered from this workspace.' });
        fetchWorkspaceDetails(selectedWorkspace.id);
      } else {
        const data = await response.json().catch(() => ({}));
        toast({ title: 'Error', description: parseApiError(data, 'Failed to remove GSTIN'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] removeGSTIN error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsTableRefreshing(false);
    }
  };

  const confirmRemoveMember = async () => {
    if (!pendingDeleteMember || !selectedWorkspace || !user) return;
    const memberToRemove = pendingDeleteMember;
    setPendingDeleteMember(null);
    setIsTableRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/members/${memberToRemove.user_id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        setSelectedWorkspace((prev) =>
          prev ? { ...prev, members: prev.members?.filter((m) => m.user_id !== memberToRemove.user_id) ?? [] } : prev
        );
        toast({
          title: 'Member Removed',
          description: `${memberToRemove.user?.email || memberToRemove.user_id} has been removed from the workspace.`,
        });
        fetchWorkspaceDetails(selectedWorkspace.id);
      } else {
        const data = await response.json().catch(() => ({}));
        toast({ title: 'Error', description: parseApiError(data, 'Failed to remove member'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] removeMember error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsTableRefreshing(false);
    }
  };

  const makeGSTINDefault = async (businessId: string) => {
    if (!selectedWorkspace || !user) return;
    setIsTableRefreshing(true);
    try {
      const response = await fetch(
        `${API_BASE}/workspaces/${selectedWorkspace.id}/gstins/${businessId}/default`,
        {
          method: 'POST',
          headers: await getAuthHeaders(),
        }
      );
      if (response.ok) {
        toast({ title: 'Default GSTIN Updated', description: 'The default GSTIN has been updated.' });
        fetchWorkspaceDetails(selectedWorkspace.id);
      } else {
        const data = await response.json().catch(() => ({}));
        toast({ title: 'Error', description: parseApiError(data, 'Failed to update default GSTIN'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] makeGSTINDefault error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsTableRefreshing(false);
    }
  };

  const confirmDeleteWorkspace = async () => {
    if (!pendingDeleteWorkspaceId || !user) return;
    const wsId = pendingDeleteWorkspaceId;
    setPendingDeleteWorkspaceId(null);
    try {
      const response = await fetch(`${API_BASE}/workspaces/${wsId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        toast({ title: 'Workspace Deleted', description: 'The workspace has been successfully deleted.' });
        
        // Save current workspaces before fetching update
        const remaining = workspaces.filter((w) => w.id !== wsId);
        
        // Fetch workspaces in store
        await fetchGlobalWorkspaces();
        
        // Navigate or update selection
        if (remaining.length > 0) {
          setActiveWorkspace(remaining[0].id);
          updateSearchParams(remaining[0].id, activeTab);
        } else {
          setActiveWorkspace(null);
          updateSearchParams('', activeTab);
          setSelectedWorkspace(null);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        toast({ title: 'Error', description: parseApiError(data, 'Failed to delete workspace'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] deleteWorkspace error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    }
  };

  const switchGSTIN = async (gstin: { id: string; trade_name?: string; legal_name: string }) => {
    if (!selectedWorkspace || !user) return;
    try {
      const response = await fetch(
        `${API_BASE}/workspaces/${selectedWorkspace.id}/switch-gstin?user_id=${user.id}&gstin_id=${gstin.id}`,
        { method: 'POST', headers: await getAuthHeaders() }
      );
      if (response.ok) {
        console.info('[Workspaces] Switched active GSTIN to:', gstin.id);
        setActiveBusiness(gstin.id);
        toast({
          title: 'Context Switched',
          description: `Active context is now "${gstin.trade_name || gstin.legal_name}".`,
        });
      } else {
        const data = await response.json().catch(() => ({}));
        toast({ title: 'Error', description: parseApiError(data, 'Failed to switch GSTIN'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('[Workspaces] switchGSTIN error:', error);
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' });
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-500';
      case 'ADMIN': return 'bg-blue-500';
      case 'MEMBER': return 'bg-green-500';
      default:      return 'bg-gray-500';
    }
  };

  if (isLoading && workspaces.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
        </div>
        {/* Workspace cards skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[200px] rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-24 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && workspaces.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workspaces</h1>
            <p className="text-muted-foreground">Manage your multi-GSTIN workspaces</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-12 w-12 text-primary/50" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold">No workspaces yet</h2>
            <p className="text-muted-foreground max-w-sm">
              Create your first workspace to start managing multiple GSTINs under a single PAN.
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={wsForm.handleSubmit(createWorkspace, (errors) => console.error('[Workspaces] Form validation failed:', errors))}>
                <DialogHeader>
                  <DialogTitle>Create New Workspace</DialogTitle>
                  <DialogDescription>
                    Create a workspace to manage multiple GSTINs under a single PAN
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-pan">PAN Number</Label>
                    <Input
                      id="ws-pan"
                      placeholder="AAAAA1234A"
                      {...wsForm.register('pan')}
                      onChange={(e) => wsForm.setValue('pan', e.target.value.toUpperCase(), { shouldValidate: true })}
                      className={wsForm.formState.errors.pan ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {wsForm.formState.errors.pan && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {wsForm.formState.errors.pan.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Workspace Name</Label>
                    <Input
                      id="ws-name"
                      placeholder="My Company Workspace"
                      {...wsForm.register('name')}
                      className={wsForm.formState.errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {wsForm.formState.errors.name && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {wsForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-description">Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="ws-description"
                      placeholder="Optional description"
                      {...wsForm.register('description')}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); wsForm.reset(); }}>Cancel</Button>
                  <Button type="submit" disabled={isCreatingWs}>
                    {isCreatingWs ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground">Manage your multi-GSTIN workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedWorkspace && (
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
              onClick={() => setPendingDeleteWorkspaceId(selectedWorkspace.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Workspace
            </Button>
          )}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={wsForm.handleSubmit(createWorkspace, (errors) => console.error('[Workspaces] Form validation failed:', errors))}>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a workspace to manage multiple GSTINs under a single PAN
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-pan">PAN Number</Label>
                  <Input
                    id="ws-pan"
                    placeholder="AAAAA1234A"
                    {...wsForm.register('pan')}
                    onChange={(e) => wsForm.setValue('pan', e.target.value.toUpperCase(), { shouldValidate: true })}
                    className={wsForm.formState.errors.pan ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {wsForm.formState.errors.pan && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {wsForm.formState.errors.pan.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input
                    id="ws-name"
                    placeholder="My Company Workspace"
                    {...wsForm.register('name')}
                    className={wsForm.formState.errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {wsForm.formState.errors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {wsForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-description">Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="ws-description"
                    placeholder="Optional description"
                    {...wsForm.register('description')}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); wsForm.reset(); }}>Cancel</Button>
                <Button type="submit" disabled={isCreatingWs}>
                  {isCreatingWs ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      {/* Workspace Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {workspaces.map((ws) => (
          <Card
            key={ws.id}
            className={`cursor-pointer transition-all hover:shadow-md min-w-[200px] ${
              activeWorkspaceId === ws.id ? 'border-primary ring-2 ring-primary' : ''
            }`}
            onClick={() => handleWorkspaceSelect(ws)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Building2 className="h-5 w-5 text-primary" />
                <Badge variant="outline">{ws.active_gstin_count}/{ws.gstin_count} GSTINs</Badge>
              </div>
              <h3 className="font-semibold mt-2">{ws.name}</h3>
              <p className="text-sm text-muted-foreground">{ws.pan}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedWorkspace ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gstins">GSTINs</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total GSTINs</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.total_gstins || selectedWorkspace.gstin_count}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.active_gstins || selectedWorkspace.active_gstin_count} active
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tax Liability</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatINR(metrics?.total_liability || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">For {period}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ITC Claimed</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatINR(metrics?.total_itc || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Input Tax Credit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Filing Status</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    (metrics?.overdue_returns ?? 0) > 0
                      ? 'text-destructive'
                      : (metrics?.filed_returns ?? 0) > 0 && (metrics?.pending_returns ?? 0) === 0
                        ? 'text-green-600 dark:text-green-400'
                        : ''
                  }`}>
                    {metrics?.filed_returns || 0}
                  </div>
                  <p className={`text-xs ${
                    (metrics?.overdue_returns ?? 0) > 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {metrics?.pending_returns || 0} pending
                    {(metrics?.overdue_returns ?? 0) > 0 && (
                      <span className="ml-1 font-semibold">, {metrics!.overdue_returns} overdue</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-4">
              <Label>Period:</Label>
              <Select
                value={period}
                onValueChange={(val) => {
                  setPeriod(val);
                  if (activeWorkspaceId) fetchMetrics(activeWorkspaceId);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {/* State-wise Summary */}
            {metrics?.by_state && Object.keys(metrics.by_state).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>State-wise Summary</CardTitle>
                  <CardDescription>Tax liability by state for {period}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Taxable Value</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(metrics.by_state).map(([state, data]) => (
                        <TableRow key={state}>
                          <TableCell className="font-medium">{state}</TableCell>
                          <TableCell className="text-right">₹{data.taxable_value.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{data.igst.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{data.cgst.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{data.sgst.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold">
                            ₹{(data.igst + data.cgst + data.sgst + data.cess).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* GSTINs Tab */}
          <TabsContent value="gstins">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>GSTIN Registrations</CardTitle>
                  <CardDescription>Manage GSTINs in this workspace</CardDescription>
                </div>
                <Dialog open={showGSTINDialog} onOpenChange={setShowGSTINDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add GSTIN
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={gstinForm.handleSubmit(addGSTIN, (errors) => console.error('[Workspaces] Form validation failed:', errors))}>
                      <DialogHeader>
                        <DialogTitle>Add GSTIN</DialogTitle>
                        <DialogDescription>Add a new GSTIN registration to this workspace</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="g-gstin">GSTIN</Label>
                          <Input
                            id="g-gstin"
                            placeholder="27AAAAA1234A1Z1"
                            {...gstinForm.register('gstin')}
                            onChange={(e) => gstinForm.setValue('gstin', e.target.value.toUpperCase(), { shouldValidate: true })}
                            className={gstinForm.formState.errors.gstin ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {gstinForm.formState.errors.gstin && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {gstinForm.formState.errors.gstin.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="g-legal">Legal Name</Label>
                          <Input
                            id="g-legal"
                            placeholder="Company Private Limited"
                            {...gstinForm.register('legal_name')}
                            className={gstinForm.formState.errors.legal_name ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {gstinForm.formState.errors.legal_name && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {gstinForm.formState.errors.legal_name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="g-trade">Trade Name <span className="text-muted-foreground">(optional)</span></Label>
                          <Input id="g-trade" placeholder="Company Name" {...gstinForm.register('trade_name')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="g-state">State</Label>
                          <Input
                            id="g-state"
                            placeholder="Maharashtra"
                            {...gstinForm.register('state')}
                            className={gstinForm.formState.errors.state ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {gstinForm.formState.errors.state && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {gstinForm.formState.errors.state.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Registration Type</Label>
                          <Controller
                            control={gstinForm.control}
                            name="registration_type"
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="regular">Regular</SelectItem>
                                  <SelectItem value="composition">Composition</SelectItem>
                                  <SelectItem value="sez">SEZ</SelectItem>
                                  <SelectItem value="isd">ISD</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setShowGSTINDialog(false); gstinForm.reset(); }}>Cancel</Button>
                        <Button type="submit" disabled={isAddingGstin}>
                          {isAddingGstin ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : 'Add GSTIN'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">GSTIN</TableHead>
                      <TableHead className="w-[220px]">Legal Name</TableHead>
                      <TableHead className="w-[160px]">State</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[120px]">Default</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWorkspace.gstins?.map((gstin) => (
                      <TableRow key={gstin.id}>
                        <TableCell 
                          className="font-mono cursor-pointer hover:text-primary transition-colors hover:underline"
                          onClick={() => switchGSTIN(gstin)}
                          title="Switch context to this GSTIN"
                        >
                          {gstin.gstin}
                        </TableCell>
                        <TableCell>{gstin.legal_name}</TableCell>
                        <TableCell>{gstin.state}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{gstin.registration_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(gstin.status)}>
                            {gstin.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {gstin.is_default ? (
                            <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1 w-fit cursor-default">
                              <CheckCircle className="h-3 w-3" />
                              Default
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => makeGSTINDefault(gstin.id)}
                              title="Set as Default GSTIN"
                              className="text-muted-foreground hover:text-primary p-1 h-auto"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {gstin.is_default ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                      <Button variant="ghost" size="sm" disabled>
                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>Default GSTIN cannot be deleted.</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPendingDeleteGstinId(gstin.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!selectedWorkspace.gstins || selectedWorkspace.gstins.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No GSTINs added yet. Click "Add GSTIN" to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Workspace Members</CardTitle>
                  <CardDescription>Manage team members and their access</CardDescription>
                </div>
                <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={memberForm.handleSubmit(addMember, (errors) => console.error('[Workspaces] Form validation failed:', errors))}>
                      <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                        <DialogDescription>Add a new member to this workspace</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="m-email">Email Address</Label>
                          <Input
                            id="m-email"
                            placeholder="user@example.com"
                            type="email"
                            {...memberForm.register('user_id')}
                            className={memberForm.formState.errors.user_id ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {memberForm.formState.errors.user_id && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {memberForm.formState.errors.user_id.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Controller
                            control={memberForm.control}
                            name="role"
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OWNER">Owner</SelectItem>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="MEMBER">Member</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setShowMemberDialog(false); memberForm.reset(); }}>Cancel</Button>
                        <Button type="submit" disabled={isAddingMember}>
                          {isAddingMember ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : 'Add Member'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Email / ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>GSTIN Access</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWorkspace.members?.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell className="font-medium">{member.user?.email || member.user_id}</TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(member.role)}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.gstin_access.length > 0 
                            ? member.gstin_access.length + ' GSTINs'
                            : 'All GSTINs'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {member.can_manage_members && <Badge variant="outline">Manage</Badge>}
                            {member.can_file_returns && <Badge variant="outline">File</Badge>}
                            {member.can_file_returns && <Badge variant="outline">View</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.role === 'OWNER' ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0}>
                                    <Button variant="ghost" size="sm" disabled>
                                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Workspace Owner cannot be removed.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteMember(member)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!selectedWorkspace.members || selectedWorkspace.members.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No members added yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inter-State Summary</CardTitle>
                  <CardDescription>Distribution of inter-state supplies</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigateToReport('interstate')}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Liability</CardTitle>
                  <CardDescription>Total tax liability across all GSTINs</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigateToReport('liability')}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ITC Summary</CardTitle>
                  <CardDescription>Input Tax Credit across all GSTINs</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => navigateToReport('itc')}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compare GSTINs</CardTitle>
                  <CardDescription>Compare performance across GSTINs</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => { setSelectedCompareIds([]); setShowCompareDialog(true); }}
                    disabled={!selectedWorkspace?.gstins?.length}
                  >
                    <GitCompare className="mr-2 h-4 w-4" />
                    Compare
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Operations */}
            <Card>
              <CardHeader>
                <CardTitle>Bulk Operations</CardTitle>
                <CardDescription>Perform operations across all GSTINs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button onClick={bulkFileReturns}>
                    <FileText className="mr-2 h-4 w-4" />
                    Bulk File Returns
                    {(metrics?.pending_returns ?? 0) > 0 && (
                      <Badge className="ml-2 bg-orange-500 text-white text-xs">{metrics!.pending_returns}</Badge>
                    )}
                  </Button>
                  <Button variant="outline" onClick={sendReminders}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Reminders
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Workspaces</h3>
            <p className="text-muted-foreground mb-4">Create a workspace to get started</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      )}
      {/* ── Compare GSTINs Dialog ──────────────────────────────────────── */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compare GSTINs</DialogTitle>
            <DialogDescription>
              Select 2–3 GSTINs to compare their performance side by side.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {selectedWorkspace?.gstins?.length ? (
              selectedWorkspace.gstins.map((g) => {
                const checked = selectedCompareIds.includes(g.id);
                const disabled = !checked && selectedCompareIds.length >= 3;
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary bg-primary/5'
                        : disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleCompareId(g.id)}
                    />
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-semibold">{g.gstin}</span>
                      <span className="text-xs text-muted-foreground">{g.legal_name}</span>
                    </div>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No GSTINs available to compare.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>Cancel</Button>
            <Button
              disabled={selectedCompareIds.length < 2}
              onClick={handleCompareGstins}
            >
              <GitCompare className="mr-2 h-4 w-4" />
              Compare {selectedCompareIds.length > 0 ? `(${selectedCompareIds.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation: Remove GSTIN ─────────────────────────────────── */}
      <AlertDialog open={!!pendingDeleteGstinId} onOpenChange={(open) => { if (!open) setPendingDeleteGstinId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove GSTIN?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently unregister the GSTIN from this workspace. All associated filing history will be retained, but the GSTIN will no longer be accessible here. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemoveGSTIN}
            >
              Yes, Remove GSTIN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation: Remove Member ─────────────────────────────────── */}
      <AlertDialog open={!!pendingDeleteMember} onOpenChange={(open) => { if (!open) setPendingDeleteMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold">{pendingDeleteMember?.user?.email || pendingDeleteMember?.user_id}</span> from the workspace? They will lose all access to this workspace immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemoveMember}
            >
              Yes, Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation: Delete Workspace ───────────────────────────────── */}
      <AlertDialog open={!!pendingDeleteWorkspaceId} onOpenChange={(open) => { if (!open) setPendingDeleteWorkspaceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the workspace <span className="font-semibold">"{selectedWorkspace?.name}"</span>? All associated GSTINs, member invites, tax filings, and data will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteWorkspace}
            >
              Yes, Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
