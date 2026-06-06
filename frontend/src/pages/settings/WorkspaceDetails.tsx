/**
 * Workspace Details Page
 */

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Copy, 
  Check,
  Loader2,
  Save
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, WorkspaceDetails as WorkspaceDetailsType } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function WorkspaceDetails() {
  const { getWorkspaceDetails, updateWorkspaceDetails } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<WorkspaceDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    business_address: '',
    billing_gstin: '',
    billing_pan: '',
    workspace_type: '',
    location: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getWorkspaceDetails();
      if (data) {
        setWorkspace(data);
        setFormData({
          name: data.name || '',
          legal_name: data.legal_name || '',
          business_address: data.business_address || '',
          billing_gstin: data.billing_gstin || '',
          billing_pan: data.billing_pan || '',
          workspace_type: data.workspace_type || '',
          location: data.location || '',
        });
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workspace details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkspaceDetails(formData);
      toast({ title: 'Workspace updated successfully' });
      setIsEditing(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update workspace',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    if (workspace?.id) {
      navigator.clipboard.writeText(workspace.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Workspace</h2>
          <p className="text-sm text-slate-500">View and manage workspace settings</p>
        </div>
        {isOrganizationAdmin() && !isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Workspace Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Workspace ID */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium text-slate-500">Workspace ID</p>
              <p className="font-mono text-sm">{workspace?.id}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopyId}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Created Date */}
          <div className="py-3 border-b">
            <p className="text-sm font-medium text-slate-500">Created On</p>
            <p className="text-sm">
              {workspace?.created_at 
                ? new Date(workspace.created_at).toLocaleDateString() 
                : '-'}
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Workspace Name
              </label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              ) : (
                <p className="text-sm">{workspace?.name || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Workspace Type
              </label>
              {isEditing ? (
                <Input
                  value={formData.workspace_type}
                  onChange={(e) => setFormData({ ...formData, workspace_type: e.target.value })}
                />
              ) : (
                <p className="text-sm">{workspace?.workspace_type || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Legal Name
              </label>
              {isEditing ? (
                <Input
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                />
              ) : (
                <p className="text-sm">{workspace?.legal_name || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Location
              </label>
              {isEditing ? (
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              ) : (
                <p className="text-sm">{workspace?.location || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Billing GSTIN
              </label>
              {isEditing ? (
                <Input
                  value={formData.billing_gstin}
                  onChange={(e) => setFormData({ ...formData, billing_gstin: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              ) : (
                <p className="text-sm font-mono">{workspace?.billing_gstin || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Billing PAN
              </label>
              {isEditing ? (
                <Input
                  value={formData.billing_pan}
                  onChange={(e) => setFormData({ ...formData, billing_pan: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              ) : (
                <p className="text-sm font-mono">{workspace?.billing_pan || '-'}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Business Address
              </label>
              {isEditing ? (
                <Input
                  value={formData.business_address}
                  onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                />
              ) : (
                <p className="text-sm">{workspace?.business_address || '-'}</p>
              )}
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
