/**
 * User Access Management Page
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Loader2,
  Mail,
  UserCog,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, WorkspaceUser } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function UserAccess() {
  const { getWorkspaceUsers, inviteUser, updateUserRole, removeUser } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getWorkspaceUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (email: string, role: string) => {
    try {
      await inviteUser(email, role, ['GSTR-1', 'GSTR-3B']);
      toast({ title: 'User invited successfully' });
      setShowInviteModal(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to invite user',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    
    try {
      await removeUser(userId);
      toast({ title: 'User removed successfully' });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove user',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">User Access Management</h2>
        <p className="text-sm text-slate-500">Manage workspace users and their access</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {isOrganizationAdmin() && (
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite New User
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm ? 'No users match your search' : 'No users in this workspace'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Name & Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">User Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Products</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Role</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-corporate-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-corporate-primary">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">
                              {user.name}
                              {user.is_current_user && (
                                <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.user_type === 'Owner' ? 'default' : 'outline'}>
                          {user.user_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.products.map((product) => (
                            <Badge key={product} variant="secondary" className="text-xs">
                              {product}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm capitalize">{user.role || user.user_type.toLowerCase()}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!user.is_current_user && isOrganizationAdmin() && (
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemove(user.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}

// Simple Invite Modal
function InviteUserModal({ 
  onClose, 
  onInvite 
}: { 
  onClose: () => void; 
  onInvite: (email: string, role: string) => void 
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onInvite(email, role);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Invite New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-300"
            >
              <option value="user">Regular User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
