/**
 * API Clients Page
 */

import { useState, useEffect } from 'react';
import { 
  Code, 
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, ApiClient } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function ApiClients() {
  const { getApiClients, createApiClient, revokeApiClient } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getApiClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to load API clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newClientName) return;
    
    setCreating(true);
    try {
      await createApiClient(newClientName, ['read', 'write']);
      toast({ title: 'API client created successfully' });
      setShowCreateForm(false);
      setNewClientName('');
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create API client', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API client?')) return;
    
    try {
      await revokeApiClient(id);
      toast({ title: 'API client revoked' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revoke API client', variant: 'destructive' });
    }
  };

  const handleCopy = (clientId: string) => {
    navigator.clipboard.writeText(clientId);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Clients</h2>
          <p className="text-sm text-slate-500">Manage API client credentials for programmatic access</p>
        </div>
        {isOrganizationAdmin() && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Client
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">Create New API Client</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="My API Client"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newClientName}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No API clients configured
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Client ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Permissions</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Created</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{client.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                            {client.client_id}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCopy(client.client_id)}
                          >
                            {copiedId === client.client_id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {client.permissions.map((perm) => (
                            <span 
                              key={perm}
                              className="text-xs bg-slate-100 px-2 py-1 rounded capitalize"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(client.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOrganizationAdmin() && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRevoke(client.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
