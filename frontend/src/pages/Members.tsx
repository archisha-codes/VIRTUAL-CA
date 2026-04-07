import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MembershipRole, Profile, Membership } from '@/integrations/supabase/types';
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

interface MemberWithProfile extends Membership {
  profile?: Profile | null;
  email?: string;
}

// Demo members for when Supabase is unavailable
const DEMO_MEMBERS: MemberWithProfile[] = [
  {
    id: 'demo-member-1',
    user_id: 'user-1',
    org_id: 'demo-org-id',
    role: 'owner',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: {
      id: 'profile-1',
      user_id: 'user-1',
      full_name: 'Demo User',
      email: 'demo@virtualca.in',
      phone: '+919999999999',
      company_name: 'Demo Company',
      active_entity: 'demo-org-id',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    email: 'demo@virtualca.in',
  },
  {
    id: 'demo-member-2',
    user_id: 'user-2',
    org_id: 'demo-org-id',
    role: 'admin',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    profile: {
      id: 'profile-2',
      user_id: 'user-2',
      full_name: 'John Smith',
      email: 'john@virtualca.in',
      phone: '+918888888888',
      company_name: 'Demo Company',
      active_entity: 'demo-org-id',
      avatar_url: null,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    email: 'john@virtualca.in',
  },
  {
    id: 'demo-member-3',
    user_id: 'user-3',
    org_id: 'demo-org-id',
    role: 'member',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    profile: {
      id: 'profile-3',
      user_id: 'user-3',
      full_name: 'Jane Doe',
      email: 'jane@virtualca.in',
      phone: '+917777777777',
      company_name: 'Demo Company',
      active_entity: 'demo-org-id',
      avatar_url: null,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    email: 'jane@virtualca.in',
  },
];

export default function Members() {
  const { user, currentOrganization, isDemoMode, hasRole } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('member');
  const [inviting, setInviting] = useState(false);

  // Check if user can manage members (owner or admin)
  const canManageMembers = hasRole(['owner', 'admin']);
  const isOwner = hasRole(['owner']);

  useEffect(() => {
    loadMembers();
  }, [currentOrganization?.id]);

  const loadMembers = async () => {
    if (!currentOrganization?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // In demo mode, use demo members
    if (isDemoMode) {
      setMembers(DEMO_MEMBERS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch members with their profiles
      // This would be a Supabase query in production
      const response = await fetch(
        `/api/orgs/${currentOrganization.id}/members`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      
      const data = await response.json();
      
      if (data) {
        setMembers(data as MemberWithProfile[]);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !currentOrganization?.id) return;

    setInviting(true);
    try {
      // In demo mode, simulate adding a member
      if (isDemoMode) {
        const newMember: MemberWithProfile = {
          id: `demo-member-${Date.now()}`,
          user_id: `user-${Date.now()}`,
          org_id: currentOrganization.id,
          role: inviteRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profile: {
            id: `profile-${Date.now()}`,
            user_id: `user-${Date.now()}`,
            full_name: inviteEmail.split('@')[0],
            email: inviteEmail,
            phone: null,
            company_name: currentOrganization.name,
            active_entity: currentOrganization.id,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          email: inviteEmail,
        };
        setMembers([...members, newMember]);
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        setIsAddDialogOpen(false);
        return;
      }

      // In production, call API to invite member
      const response = await fetch(`/api/orgs/${currentOrganization.id}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setIsAddDialogOpen(false);
      loadMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: MembershipRole) => {
    try {
      // In demo mode, update locally
      if (isDemoMode) {
        setMembers(members.map(m => 
          m.id === memberId ? { ...m, role: newRole } : m
        ));
        toast.success('Role updated successfully');
        return;
      }

      // In production, call API
      const response = await fetch(`/api/orgs/${currentOrganization?.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const handleRemoveMember = async (memberId: string) => {
    try {
      // In demo mode, update locally
      if (isDemoMode) {
        setMembers(members.filter(m => m.id !== memberId));
        toast.success('Member removed successfully');
        return;
      }

      // In production, call API
      const response = await fetch(`/api/orgs/${currentOrganization?.id}/members/${memberId}`, {
        method: 'DELETE',
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

  const getRoleBadgeColor = (role: MembershipRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'member':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!currentOrganization) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Organization Selected
            </h2>
            <p className="text-gray-500">
              Please select or create an organization to manage members.
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
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-500 mt-1">
            Manage members and their roles for {currentOrganization.name}
          </p>
        </div>
        
        {canManageMembers && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization. They will receive an email to accept the invitation.
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
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as MembershipRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          Member
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Admins can manage members and organization settings. Members can only access data.
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
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
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
              ? 'You are the owner of this organization' 
              : 'You can view members but only owners can manage them'}
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
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No members yet
              </h3>
              <p className="text-gray-500">
                Invite your first team member to get started.
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
                          {member.profile?.full_name?.[0]?.toUpperCase() || 
                           member.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.profile?.full_name || member.email?.split('@')[0] || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.email || member.profile?.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageMembers && member.role !== 'owner' ? (
                        <Select 
                          value={member.role} 
                          onValueChange={(value) => handleRoleChange(member.id, value as MembershipRole)}
                        >
                          <SelectTrigger className={`w-28 ${getRoleBadgeColor(member.role)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <Shield className="mr-2 h-4 w-4 inline" />
                              Admin
                            </SelectItem>
                            <SelectItem value="member">
                              <Users className="mr-2 h-4 w-4 inline" />
                              Member
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(member.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageMembers && member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRoleChange(member.id, member.role === 'admin' ? 'member' : 'admin')}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Change to {member.role === 'admin' ? 'Member' : 'Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleRemoveMember(member.id)}
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
