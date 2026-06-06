/**
 * DSC Configuration Page
 * Manage Digital Signature Certificates for GST filings
 */

import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Loader2,
  Plus,
  Trash2,
  Upload,
  FileKey
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

interface DscConfig {
  id: string;
  name: string;
  provider?: string;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export default function DscConfiguration() {
  const { getDscConfiguration, createDscConfiguration, deleteDscConfiguration } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dscConfig, setDscConfig] = useState<DscConfig | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDsc, setNewDsc] = useState({ name: '', provider: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDscConfiguration();
      setDscConfig(data);
    } catch (error) {
      console.error('Failed to load DSC configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newDsc.name) return;
    
    setSaving(true);
    try {
      await createDscConfiguration({
        name: newDsc.name,
        certificate_file: newDsc.provider,
      });
      toast({ title: 'DSC configuration added successfully' });
      setShowAddForm(false);
      setNewDsc({ name: '', provider: '' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add DSC configuration', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this DSC configuration?')) return;
    
    try {
      await deleteDscConfiguration(id);
      toast({ title: 'DSC configuration deleted' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete DSC configuration', variant: 'destructive' });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">DSC Configuration</h2>
        <p className="text-sm text-slate-500">Manage Digital Signature Certificates for GST filings</p>
      </div>

      {/* Empty State / Add Form */}
      {!dscConfig && !showAddForm && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No DSC Configured</h3>
            <p className="text-sm text-slate-500 mb-4">
              Set up your first digital signature certificate to sign GST returns
            </p>
            {isOrganizationAdmin() && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Setup Your First Signature
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add DSC Configuration</CardTitle>
            <CardDescription>Configure a new digital signature certificate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Certificate Name</label>
              <Input
                value={newDsc.name}
                onChange={(e) => setNewDsc({ ...newDsc, name: e.target.value })}
                placeholder="My Digital Signature"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Provider (Optional)</label>
              <Input
                value={newDsc.provider}
                onChange={(e) => setNewDsc({ ...newDsc, provider: e.target.value })}
                placeholder="e.g., eMudhra, Sify"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !newDsc.name}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Configuration */}
      {dscConfig && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileKey className="h-5 w-5" />
                Active Digital Signature Certificate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Certificate Name</p>
                    <p className="font-medium">{dscConfig.name}</p>
                  </div>
                </div>
                
                {dscConfig.valid_from && (
                  <div className="py-3 border-b">
                    <p className="text-sm font-medium text-slate-500">Valid From</p>
                    <p className="text-sm">{formatDate(dscConfig.valid_from)}</p>
                  </div>
                )}
                
                {dscConfig.valid_until && (
                  <div className="py-3 border-b">
                    <p className="text-sm font-medium text-slate-500">Valid Until</p>
                    <p className="text-sm">{formatDate(dscConfig.valid_until)}</p>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  {isOrganizationAdmin() && (
                    <Button 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(dscConfig.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Certificate
                    </Button>
                  )}
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Certificate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
