/**
 * Workspace Security Settings Page
 * Manage workspace security settings like 2FA, password policies, etc.
 */

import { useState } from 'react';
import { Shield, Lock, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function WorkspaceSecurity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [ipAddresses, setIpAddresses] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveSecurity = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Security settings saved',
        description: 'Your security settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save security settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workspace Security</h2>
        <p className="text-sm text-slate-500">Manage security settings for your workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your workspace by requiring 2FA for all members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Enable 2FA Requirement</p>
              <p className="text-sm text-slate-500">
                {twoFactorEnabled ? 'All workspace members must enable 2FA' : '2FA is optional for workspace members'}
              </p>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Session Settings
          </CardTitle>
          <CardDescription>Configure session timeout and auto-logout settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input id="session-timeout" type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} min="15" max="480" />
            <p className="text-sm text-slate-500">Users will be logged out after this period of inactivity</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            IP Whitelist
          </CardTitle>
          <CardDescription>Restrict access to specific IP addresses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Enable IP Whitelist</p>
              <p className="text-sm text-slate-500">
                {ipWhitelistEnabled ? 'Only specified IP addresses can access' : 'Access is allowed from any IP address'}
              </p>
            </div>
            <Switch checked={ipWhitelistEnabled} onCheckedChange={setIpWhitelistEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </CardTitle>
          <CardDescription>Manage API keys for your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input type={showApiKey ? 'text' : 'password'} value={import.meta.env.VITE_STRIPE_KEY} readOnly className="pr-10 font-mono" />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline">Regenerate</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSecurity} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Security Settings
        </Button>
      </div>
    </div>
  );
}
