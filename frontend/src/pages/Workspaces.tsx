import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Shield
} from 'lucide-react';

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
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  gstin_access: string[];
  can_manage_members: boolean;
  can_file_returns: boolean;
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

// Local storage keys for demo mode
const DEMO_WORKSPACES_KEY = 'demo_workspaces';

// Helper to get demo workspaces from localStorage
const getDemoWorkspaces = (): Workspace[] => {
  try {
    const data = localStorage.getItem(DEMO_WORKSPACES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Helper to save demo workspaces to localStorage
const saveDemoWorkspaces = (workspaces: Workspace[]): void => {
  localStorage.setItem(DEMO_WORKSPACES_KEY, JSON.stringify(workspaces));
};

export default function Workspaces() {
  const { toast } = useToast();
  const { user, isDemoMode } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGSTINDialog, setShowGSTINDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [metrics, setMetrics] = useState<ConsolidatedMetrics | null>(null);
  const [period, setPeriod] = useState('2026-02');
  
  // Form states
  const [newWorkspace, setNewWorkspace] = useState({
    pan: '',
    name: '',
    description: ''
  });
  
  const [newGSTIN, setNewGSTIN] = useState({
    gstin: '',
    legal_name: '',
    trade_name: '',
    state: '',
    registration_type: 'regular',
    category: 'b2b'
  });
  
  const [newMember, setNewMember] = useState({
    user_id: '',
    role: 'viewer' as const,
    gstin_access: [] as string[]
  });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchWorkspaceDetails(selectedWorkspace.id);
      fetchMetrics(selectedWorkspace.id);
    }
  }, [selectedWorkspace, period]);

  const fetchWorkspaces = async () => {
    // Demo mode: use localStorage
    if (isDemoMode) {
      setError(null);
      const demoWorkspaces = getDemoWorkspaces();
      setWorkspaces(demoWorkspaces);
      if (demoWorkspaces.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(demoWorkspaces[0] as unknown as WorkspaceDetails);
      }
      setLoading(false);
      return;
    }

    if (!user) {
      setError('Please sign in to view workspaces');
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/workspaces?user_id=${user.id}`, {
        headers: await getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch workspaces');
      }
      
      const data = await response.json();
      setWorkspaces(data || []);
      
      if (data && data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0] as unknown as WorkspaceDetails);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch workspaces');
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
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

  const createWorkspace = async () => {
    // Demo mode: create workspace in localStorage
    if (isDemoMode) {
      const newWs: Workspace = {
        id: `demo-ws-${Date.now()}`,
        pan: newWorkspace.pan || 'DEMOPAN1234A',
        name: newWorkspace.name || 'Demo Workspace',
        description: newWorkspace.description || '',
        gstin_count: 0,
        active_gstin_count: 0,
        member_count: 1,
        owner_id: user?.id || 'demo-user',
        created_at: new Date().toISOString(),
      };
      
      const demoWorkspaces = getDemoWorkspaces();
      demoWorkspaces.push(newWs);
      saveDemoWorkspaces(demoWorkspaces);
      
      toast({
        title: 'Success',
        description: 'Workspace created successfully'
      });
      setShowCreateDialog(false);
      fetchWorkspaces();
      setNewWorkspace({ pan: '', name: '', description: '' });
      return;
    }

    if (!user) return;
    
    try {
      const response = await fetch(`${API_BASE}/workspaces?user_id=${user.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...await getAuthHeaders()
        },
        body: JSON.stringify(newWorkspace)
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Workspace created successfully'
        });
        setShowCreateDialog(false);
        fetchWorkspaces();
        setNewWorkspace({ pan: '', name: '', description: '' });
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workspace',
        variant: 'destructive'
      });
    }
  };

  const addGSTIN = async () => {
    // Demo mode: add GSTIN to localStorage
    if (isDemoMode && selectedWorkspace) {
      const newGstin: GSTIN = {
        id: `demo-gstin-${Date.now()}`,
        gstin: newGSTIN.gstin || '29ABCDE1234F1Z5',
        legal_name: newGSTIN.legal_name || 'Demo Legal Name',
        trade_name: newGSTIN.trade_name || 'Demo Trade Name',
        state: newGSTIN.state || 'Karnataka',
        status: 'active',
        registration_type: newGSTIN.registration_type || 'regular',
        category: newGSTIN.category || 'b2b',
        is_default: (selectedWorkspace as unknown as WorkspaceDetails).gstins?.length === 0,
      };
      
      const demoWorkspaces = getDemoWorkspaces();
      const wsIndex = demoWorkspaces.findIndex(ws => ws.id === selectedWorkspace.id);
      if (wsIndex >= 0) {
        if (!demoWorkspaces[wsIndex].gstins) {
          (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins = [];
        }
        (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins.push(newGstin);
        demoWorkspaces[wsIndex].gstin_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins?.length || 0);
        demoWorkspaces[wsIndex].active_gstin_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins?.filter(g => g.status === 'active').length || 0);
        saveDemoWorkspaces(demoWorkspaces);
      }
      
      toast({
        title: 'Success',
        description: 'GSTIN added successfully'
      });
      setShowGSTINDialog(false);
      fetchWorkspaceDetails(selectedWorkspace.id);
      setNewGSTIN({
        gstin: '',
        legal_name: '',
        trade_name: '',
        state: '',
        registration_type: 'regular',
        category: 'b2b'
      });
      return;
    }

    if (!selectedWorkspace || !user) return;
    
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/gstins?user_id=${user.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...await getAuthHeaders()
        },
        body: JSON.stringify(newGSTIN)
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'GSTIN added successfully'
        });
        setShowGSTINDialog(false);
        fetchWorkspaceDetails(selectedWorkspace.id);
        setNewGSTIN({
          gstin: '',
          legal_name: '',
          trade_name: '',
          state: '',
          registration_type: 'regular',
          category: 'b2b'
        });
      }
    } catch (error) {
      console.error('Failed to add GSTIN:', error);
      toast({
        title: 'Error',
        description: 'Failed to add GSTIN',
        variant: 'destructive'
      });
    }
  };

  const addMember = async () => {
    // Demo mode: add member to localStorage
    if (isDemoMode && selectedWorkspace) {
      const newMemberData: Member = {
        user_id: newMember.user_id || 'demo-member@example.com',
        role: newMember.role || 'viewer',
        gstin_access: newMember.gstin_access || [],
        can_manage_members: false,
        can_file_returns: false,
      };
      
      const demoWorkspaces = getDemoWorkspaces();
      const wsIndex = demoWorkspaces.findIndex(ws => ws.id === selectedWorkspace.id);
      if (wsIndex >= 0) {
        if (!demoWorkspaces[wsIndex].members) {
          (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members = [];
        }
        (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members.push(newMemberData);
        demoWorkspaces[wsIndex].member_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members?.length || 0);
        saveDemoWorkspaces(demoWorkspaces);
      }
      
      toast({
        title: 'Success',
        description: 'Member added successfully'
      });
      setShowMemberDialog(false);
      fetchWorkspaceDetails(selectedWorkspace.id);
      setNewMember({ user_id: '', role: 'viewer', gstin_access: [] });
      return;
    }

    if (!selectedWorkspace || !user) return;
    
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/members?user_id=${user.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...await getAuthHeaders()
        },
        body: JSON.stringify(newMember)
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Member added successfully'
        });
        setShowMemberDialog(false);
        fetchWorkspaceDetails(selectedWorkspace.id);
        setNewMember({ user_id: '', role: 'viewer', gstin_access: [] });
      }
    } catch (error) {
      console.error('Failed to add member:', error);
      toast({
        title: 'Error',
        description: 'Failed to add member',
        variant: 'destructive'
      });
    }
  };

  const removeGSTIN = async (gstinId: string) => {
    // Demo mode: remove GSTIN from localStorage
    if (isDemoMode && selectedWorkspace) {
      const demoWorkspaces = getDemoWorkspaces();
      const wsIndex = demoWorkspaces.findIndex(ws => ws.id === selectedWorkspace.id);
      if (wsIndex >= 0) {
        (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins = 
          ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins || []).filter(g => g.id !== gstinId);
        demoWorkspaces[wsIndex].gstin_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins?.length || 0);
        demoWorkspaces[wsIndex].active_gstin_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins?.filter(g => g.status === 'active').length || 0);
        saveDemoWorkspaces(demoWorkspaces);
      }
      
      toast({
        title: 'Success',
        description: 'GSTIN removed successfully'
      });
      fetchWorkspaceDetails(selectedWorkspace.id);
      return;
    }

    if (!selectedWorkspace || !user) return;
    
    try {
      const response = await fetch(`${API_BASE}/gstins/${gstinId}?user_id=${user.id}&workspace_id=${selectedWorkspace.id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'GSTIN removed successfully'
        });
        fetchWorkspaceDetails(selectedWorkspace.id);
      }
    } catch (error) {
      console.error('Failed to remove GSTIN:', error);
    }
  };

  const removeMember = async (userId: string) => {
    // Demo mode: remove member from localStorage
    if (isDemoMode && selectedWorkspace) {
      const demoWorkspaces = getDemoWorkspaces();
      const wsIndex = demoWorkspaces.findIndex(ws => ws.id === selectedWorkspace.id);
      if (wsIndex >= 0) {
        (demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members = 
          ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members || []).filter(m => m.user_id !== userId);
        demoWorkspaces[wsIndex].member_count = ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).members?.length || 0);
        saveDemoWorkspaces(demoWorkspaces);
      }
      
      toast({
        title: 'Success',
        description: 'Member removed successfully'
      });
      fetchWorkspaceDetails(selectedWorkspace.id);
      return;
    }

    if (!selectedWorkspace || !user) return;
    
    try {
      const response = await fetch(`${API_BASE}/workspaces/${selectedWorkspace.id}/members/${userId}?user_id=${user.id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Member removed successfully'
        });
        fetchWorkspaceDetails(selectedWorkspace.id);
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const switchGSTIN = async (gstinId: string) => {
    // Demo mode: switch GSTIN in localStorage
    if (isDemoMode && selectedWorkspace) {
      const demoWorkspaces = getDemoWorkspaces();
      const wsIndex = demoWorkspaces.findIndex(ws => ws.id === selectedWorkspace.id);
      if (wsIndex >= 0) {
        ((demoWorkspaces[wsIndex] as unknown as WorkspaceDetails).gstins || []).forEach(g => {
          g.is_default = g.id === gstinId;
        });
        saveDemoWorkspaces(demoWorkspaces);
      }
      
      toast({
        title: 'Success',
        description: 'GSTIN switched successfully'
      });
      return;
    }

    if (!selectedWorkspace || !user) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/workspaces/${selectedWorkspace.id}/switch-gstin?user_id=${user.id}&gstin_id=${gstinId}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'GSTIN switched successfully'
        });
      }
    } catch (error) {
      console.error('Failed to switch GSTIN:', error);
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
      case 'owner':
        return 'bg-purple-500';
      case 'admin':
        return 'bg-blue-500';
      case 'manager':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a workspace to manage multiple GSTINs under a single PAN
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pan">PAN Number</Label>
                <Input
                  id="pan"
                  placeholder="AAAAA1234A"
                  value={newWorkspace.pan}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, pan: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  placeholder="My Company Workspace"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={createWorkspace}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspace Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {workspaces.map((ws) => (
          <Card
            key={ws.id}
            className={`cursor-pointer transition-all hover:shadow-md min-w-[200px] ${
              selectedWorkspace?.id === ws.id ? 'border-primary ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedWorkspace(ws as unknown as WorkspaceDetails)}
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
        <Tabs defaultValue="overview" className="space-y-4">
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
                    ₹{((metrics?.total_liability || 0) / 100000).toFixed(2)}L
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For {period}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ITC Claimed</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{((metrics?.total_itc || 0) / 100000).toFixed(2)}L
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Input Tax Credit
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Filing Status</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.filed_returns || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.pending_returns || 0} pending, {metrics?.overdue_returns || 0} overdue
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-4">
              <Label>Period:</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-02">February 2026</SelectItem>
                  <SelectItem value="2026-01">January 2026</SelectItem>
                  <SelectItem value="2025-12">December 2025</SelectItem>
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
                    <DialogHeader>
                      <DialogTitle>Add GSTIN</DialogTitle>
                      <DialogDescription>
                        Add a new GSTIN registration to this workspace
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>GSTIN</Label>
                        <Input
                          placeholder="27AAAAA1234A1Z1"
                          value={newGSTIN.gstin}
                          onChange={(e) => setNewGSTIN({ ...newGSTIN, gstin: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Legal Name</Label>
                        <Input
                          placeholder="Company Private Limited"
                          value={newGSTIN.legal_name}
                          onChange={(e) => setNewGSTIN({ ...newGSTIN, legal_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trade Name</Label>
                        <Input
                          placeholder="Company Name"
                          value={newGSTIN.trade_name}
                          onChange={(e) => setNewGSTIN({ ...newGSTIN, trade_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          placeholder="Maharashtra"
                          value={newGSTIN.state}
                          onChange={(e) => setNewGSTIN({ ...newGSTIN, state: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Registration Type</Label>
                        <Select
                          value={newGSTIN.registration_type}
                          onValueChange={(value) => setNewGSTIN({ ...newGSTIN, registration_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="composition">Composition</SelectItem>
                            <SelectItem value="sez">SEZ</SelectItem>
                            <SelectItem value="isd">ISD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowGSTINDialog(false)}>Cancel</Button>
                      <Button onClick={addGSTIN}>Add GSTIN</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Legal Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWorkspace.gstins?.map((gstin) => (
                      <TableRow key={gstin.id}>
                        <TableCell className="font-mono">{gstin.gstin}</TableCell>
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
                          {gstin.is_default && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => switchGSTIN(gstin.id)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeGSTIN(gstin.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
                    <DialogHeader>
                      <DialogTitle>Add Member</DialogTitle>
                      <DialogDescription>
                        Add a new member to this workspace
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>User ID / Email</Label>
                        <Input
                          placeholder="user@example.com"
                          value={newMember.user_id}
                          onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={newMember.role}
                          onValueChange={(value: any) => setNewMember({ ...newMember, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowMemberDialog(false)}>Cancel</Button>
                      <Button onClick={addMember}>Add Member</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>GSTIN Access</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWorkspace.members?.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell className="font-medium">{member.user_id}</TableCell>
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
                          {member.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMember(member.user_id)}
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
                  <Button className="w-full">
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
                  <Button className="w-full">
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
                  <Button className="w-full">
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
                  <Button className="w-full">
                    <BarChart3 className="mr-2 h-4 w-4" />
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
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    Bulk File Returns
                  </Button>
                  <Button variant="outline">
                    <Clock className="mr-2 h-4 w-4" />
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
    </div>
  );
}
