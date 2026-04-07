/**
 * NIC Credentials Page
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Loader2,
  Trash2,
  Key
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, NicCredential } from '@/services/settingsService';

export default function NicCredentials() {
  const { getNicCredentials, addNicCredential, deleteNicCredential } = useSettingsService();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<NicCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCredential, setNewCredential] = useState({ gstin: '', nicUsername: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getNicCredentials();
      setCredentials(data);
    } catch (error) {
      console.error('Failed to load NIC credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCredential.gstin || !newCredential.nicUsername) return;
    
    try {
      await addNicCredential(newCredential.gstin, newCredential.nicUsername);
      toast({ title: 'NIC credential added' });
      setShowAddForm(false);
      setNewCredential({ gstin: '', nicUsername: '' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add credential', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    
    try {
      await deleteNicCredential(id);
      toast({ title: 'Credential deleted' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete credential', variant: 'destructive' });
    }
  };

  const filteredCredentials = credentials.filter(cred => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return cred.gstin.toLowerCase().includes(term) || cred.nic_api_username.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">NIC Credentials</h2>
        <p className="text-sm text-slate-500">Manage NIC API credentials for e-Waybill and e-Invoice</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search GSTIN/PAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add NIC Credentials
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">Add NIC Credential</h3>
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
                <label className="block text-sm font-medium mb-1">NIC API Username</label>
                <Input
                  value={newCredential.nicUsername}
                  onChange={(e) => setNewCredential({ ...newCredential, nicUsername: e.target.value })}
                  placeholder="NIC_USER_001"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Add</Button>
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
          ) : filteredCredentials.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm ? 'No credentials match your search' : 'No NIC credentials configured'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">GSTIN</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">NIC API Username</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredentials.map((cred) => (
                    <tr key={cred.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-sm">{cred.gstin}</td>
                      <td className="py-3 px-4">{cred.nic_api_username}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(cred.id)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
