/**
 * Email Configuration Page
 * Configure email notifications and alerts
 */

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Loader2,
  Shield,
  ShieldAlert,
  Plus,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function EmailConfiguration() {
  const { getEmailConfiguration, updateEmailConfiguration } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailConfig, setEmailConfig] = useState<{
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    from_email?: string;
    from_name?: string;
    is_active?: boolean;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
  });
  const isAdmin = isOrganizationAdmin();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getEmailConfiguration();
      setEmailConfig(data);
      if (data) {
        setFormData({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_username: data.smtp_username || '',
          smtp_password: '',
          from_email: data.from_email || '',
          from_name: data.from_name || '',
        });
      }
    } catch (error) {
      console.error('Failed to load email configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    try {
      await updateEmailConfiguration({
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_username: formData.smtp_username,
        smtp_password: formData.smtp_password || undefined,
        from_email: formData.from_email,
        from_name: formData.from_name,
        is_active: true,
      });
      toast({
        title: 'Success',
        description: 'Email configuration saved',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save email configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Email Configuration</h2>
          <p className="text-sm text-slate-500">Configure email notifications and alerts</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-sm text-slate-500 mb-4">
              You do not have permission to configure email settings. Contact your workspace admin.
            </p>
            <Badge variant="outline" className="bg-amber-50 text-amber-700">
              <Shield className="h-3 w-3 mr-1" />
              Admin Access Required
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email Configuration</h2>
        <p className="text-sm text-slate-500">Configure email notifications and alerts</p>
      </div>

      {!emailConfig?.is_active && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Email Configuration</h3>
            <p className="text-sm text-slate-500 mb-4">
              Set up email configuration to receive notifications and alerts
            </p>
            <Button onClick={() => setEmailConfig({ is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Setup Email
            </Button>
          </CardContent>
        </Card>
      )}

      {emailConfig?.is_active && (
        <Card>
          <CardHeader>
            <CardTitle>SMTP Settings</CardTitle>
            <CardDescription>Configure your mail server settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  placeholder="smtp.example.com"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                  placeholder="587"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_username">SMTP Username</Label>
                <Input
                  id="smtp_username"
                  value={formData.smtp_username}
                  onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
                  placeholder="user@example.com"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <div className="relative">
                  <Input
                    id="smtp_password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.smtp_password}
                    onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                    placeholder={emailConfig ? '••••••••' : 'Enter password'}
                    disabled={!isAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  placeholder="noreply@yourcompany.com"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  placeholder="Your Company Name"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={emailConfig.is_active}
                  disabled={!isAdmin}
                />
                <Label>Email notifications enabled</Label>
              </div>
              {isAdmin && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
