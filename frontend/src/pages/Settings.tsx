import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTenantStore } from '@/store/tenantStore';
import { getAuthHeaders } from '@/lib/api';
import { Loader2, Save, Plus, Trash2, Users, Key, User, Bell } from 'lucide-react';

// Schemas
const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  company_name: z.string().optional(),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const entitySchema = z.object({
  legal_name: z.string().min(2, 'Legal name is required'),
  gstin: z.string().length(15, 'GSTIN must be 15 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type EntityFormData = z.infer<typeof entitySchema>;

// =====================================================
// SETTINGS PAGE
// =====================================================

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  
  const { user } = useAuth();
  const { toast } = useToast();

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-4xl mx-auto animate-fade-in">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Password
            </TabsTrigger>
            <TabsTrigger value="entities" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Businesses
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="password">
            <PasswordTab />
          </TabsContent>

          <TabsContent value="entities">
            <EntitiesTab />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// PROFILE TAB
// =====================================================

function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      company_name: '', // We don't have this in user model yet
      phone: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name || '',
        company_name: '',
        phone: '',
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const { error } = await updateProfile({
        full_name: data.full_name,
      });

      if (error) throw error;

      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="company_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl><Input placeholder="ABC Pvt Ltd" {...field} /></FormControl>
                <FormDescription>Firm or company name</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input placeholder="+91 9876543210" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// =====================================================
// PASSWORD TAB
// =====================================================

function PasswordTab() {
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await changePassword(data.currentPassword, data.newPassword);

      if (error) throw error;

      toast({ title: 'Password updated', description: 'Your password has been changed.' });
      form.reset();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update password', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="currentPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="newPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// =====================================================
// ENTITIES TAB (Now Businesses in Workspace)
// =====================================================

function EntitiesTab() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useTenantStore();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const form = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: { legal_name: '', gstin: '' },
  });

  useEffect(() => {
    if (activeWorkspaceId) {
      loadBusinesses();
    } else {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  const loadBusinesses = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/businesses?workspace_id=${activeWorkspaceId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data || []);
      }
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EntityFormData) => {
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/businesses?workspace_id=${activeWorkspaceId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: data.legal_name,
          gstin: data.gstin.toUpperCase(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create business');
      }

      toast({ title: 'Business added', description: 'New business has been added to your workspace.' });
      form.reset();
      setShowForm(false);
      loadBusinesses();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add business', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/businesses/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast({ title: 'Business deleted' });
      loadBusinesses();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete business', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Businesses</CardTitle>
        <CardDescription>Manage businesses in your active workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="mb-4">
            <Plus className="mr-2 h-4 w-4" />
            Add Business
          </Button>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <FormField control={form.control} name="legal_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl><Input placeholder="ABC Pvt Ltd" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="gstin" render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="29ABCDE1234F1Z5" 
                      {...field} 
                      className="uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <div className="space-y-2">
            {businesses.map((business) => (
              <div key={business.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <p className="font-medium">{business.legal_name}</p>
                  <p className="text-sm text-slate-500 font-mono">{business.gstin}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(business.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            {businesses.length === 0 && !loading && (
              <p className="text-center text-slate-500 py-4">No businesses found. Add one to get started.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// NOTIFICATIONS TAB (Simplified)
// =====================================================

function NotificationsTab() {
  const [settings, setSettings] = useState({
    notifications: true,
    email_alerts: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    // In a real app, save to backend
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Manage how you receive alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-slate-500">Receive in-app notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={() => handleToggle('notifications')}
              className="h-5 w-5"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Alerts</p>
              <p className="text-sm text-slate-500">Receive important updates via email</p>
            </div>
            <input
              type="checkbox"
              checked={settings.email_alerts}
              onChange={() => handleToggle('email_alerts')}
              className="h-5 w-5"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
