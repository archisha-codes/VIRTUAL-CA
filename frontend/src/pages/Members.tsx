import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveWorkspace } from '@/store/tenantStore';
import { getAuthHeaders } from '@/lib/api';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Trash2, 
  Mail,
  Loader2,
  Users
} from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  created_at: string;
}

export default function Members() {
  const { user } = useAuth();
  const activeWorkspace = useActiveWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Check if user can manage members (owner or admin)
  const myRole = activeWorkspace?.my_role;
  const canManageMembers = myRole === 'OWNER' || myRole === 'ADMIN';
  const isOwner = myRole === 'OWNER';

  useEffect(() => {
    if (activeWorkspace?.id) {
      loadMembers();
    } else {
      setMembers([]);
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  const loadMembers = async () => {
    if (!activeWorkspace?.id) return;

    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/api/workspaces/${activeWorkspace.id}/members`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      
      const data = await response.json();
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !activeWorkspace?.id) return;

    setInviting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/workspaces/${activeWorkspace.id}/members`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to add member');
      }

      toast.success(`Member ${inviteEmail} added successfully`);
      setInviteEmail('');
      setIsAddDialogOpen(false);
      loadMembers();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast.error(error.message || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: string) => {
    if (!activeWorkspace?.id) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/workspaces/${activeWorkspace.id}/members/${memberUserId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      toast.success('Role updated successfully');
      loadMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!activeWorkspace?.id) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/workspaces/${activeWorkspace.id}/members/${memberUserId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      toast.success('Member removed successfully');
      loadMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'MEMBER':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!activeWorkspace) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Workspace Selected
            </h2>
            <p className="text-gray-500">
              Please select a workspace to manage members.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Members</h1>
          <p className="text-gray-500 mt-1">
            Manage members and their roles for {activeWorkspace.name}
          </p>
        </div>
        
        {canManageMembers && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Enter the email address of the person you want to add to this workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="role" className="text-sm font-medium">
                    Role
                  </label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">
                        <div className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="MEMBER">
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          Member
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Admins can manage members and workspace settings. Members can only access data.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Member
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            {isOwner 
              ? 'You are the owner of this workspace' 
              : `You are an ${myRole?.toLowerCase()} in this workspace`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                No members yet
              </h3>
              <p className="text-gray-500">
                Add your first team member to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {member.user?.full_name?.[0]?.toUpperCase() || 
                           member.user?.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {member.user?.full_name || member.user?.email?.split('@')[0] || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.user?.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageMembers && member.role !== 'OWNER' && member.user_id !== user?.id ? (
                        <Select 
                          value={member.role} 
                          onValueChange={(value) => handleRoleChange(member.user_id, value)}
                        >
                          <SelectTrigger className={`w-28 ${getRoleBadgeColor(member.role)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">
                              <Shield className="mr-2 h-4 w-4 inline" />
                              Admin
                            </SelectItem>
                            <SelectItem value="MEMBER">
                              <Users className="mr-2 h-4 w-4 inline" />
                              Member
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(member.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageMembers && member.role !== 'OWNER' && member.user_id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRoleChange(member.user_id, member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Change to {member.role === 'ADMIN' ? 'Member' : 'Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
