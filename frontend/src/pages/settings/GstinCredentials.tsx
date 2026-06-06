/**
 * GSTIN Credentials Page
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Loader2,
  Key,
  CheckCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, GstinCredential } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function GstinCredentials() {
  const { getGstinCredentials, updateGstinCredential, createGstinCredential, deleteGstinCredential } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<GstinCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCredential, setNewCredential] = useState({ gstin: '', username: '', password: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getGstinCredentials();
      setCredentials(data);
    } catch (error) {
      console.error('Failed to load GSTIN credentials:', error);
      toast({ title: 'Error', description: 'Failed to load credentials', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCredential.gstin || !newCredential.username || !newCredential.password) return;
    
    setAdding(true);
    try {
      await createGstinCredential(newCredential.gstin, newCredential.username, newCredential.password);
      toast({ title: 'Credential added successfully' });
      setShowAddForm(false);
      setNewCredential({ gstin: '', username: '', password: '' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add credential', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    
    try {
      await deleteGstinCredential(id);
      toast({ title: 'Credential deleted' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete credential', variant: 'destructive' });
    }
  };

  const filteredCredentials = credentials.filter(cred => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cred.gstin.toLowerCase().includes(term) ||
      cred.username.toLowerCase().includes(term) ||
      cred.business_name.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    if (status === 'Active') {
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
    }
    if (status.includes('till')) {
      return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">GSTIN Credentials</h2>
        <p className="text-sm text-slate-500">Manage GSTIN login credentials for GST portal access</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search GSTIN / Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {isOrganizationAdmin() && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">Add GSTIN Credential</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">GSTIN</label>
                <Input
                  value={newCredential.gstin}
                  onChange={(e) => setNewCredential({ ...newCredential, gstin: e.target.value.toUpperCase() })}
                  placeholder="29ABCDE1234F1Z5"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <Input
                  value={newCredential.username}
                  onChange={(e) => setNewCredential({ ...newCredential, username: e.target.value })}
                  placeholder="GST Portal Username"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Password</label>
                <Input
                  type="password"
                  value={newCredential.password}
                  onChange={(e) => setNewCredential({ ...newCredential, password: e.target.value })}
                  placeholder="GST Portal Password"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding || !newCredential.gstin || !newCredential.username || !newCredential.password}>
                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Credential
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : filteredCredentials.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm ? 'No credentials match your search' : 'No GSTIN credentials configured'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">GSTIN</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Business Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Username</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredentials.map((cred) => (
                    <tr key={cred.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-sm">{cred.gstin}</td>
                      <td className="py-3 px-4">{cred.business_name}</td>
                      <td className="py-3 px-4">{getStatusBadge(cred.connection_status)}</td>
                      <td className="py-3 px-4 text-sm">{cred.username}</td>
                      <td className="py-3 px-4 text-right">
                        {isOrganizationAdmin() && (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm">
                              Update
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(cred.id)}
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
    </div>
  );
}
