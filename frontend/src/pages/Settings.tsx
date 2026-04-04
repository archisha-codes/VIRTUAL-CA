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
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  entity_name: z.string().min(2, 'Entity name is required'),
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
  
  const { user, profile, isDemoMode } = useAuth();
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
              Entities
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
  const { user, profile, isDemoMode } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || (isDemoMode ? 'Demo User' : ''),
      company_name: profile?.company_name || '',
      phone: profile?.phone || '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (isDemoMode) {
      toast({ title: 'Demo Mode', description: 'Changes disabled in demo mode' });
      return;
    }

    if (!isSupabaseConfigured) {
      toast({ title: 'Error', description: 'Supabase not configured', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          full_name: data.full_name,
          company_name: data.company_name,
          phone: data.phone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
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
            <Button type="submit" disabled={isLoading || isDemoMode}>
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
  const { user, isDemoMode } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: PasswordFormData) => {
    if (isDemoMode) {
      toast({ title: 'Demo Mode', description: 'Password change disabled in demo mode' });
      return;
    }

    if (!isSupabaseConfigured) {
      toast({ title: 'Error', description: 'Supabase not configured', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

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
            <Button type="submit" disabled={isLoading || isDemoMode}>
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
// ENTITIES TAB
// =====================================================

function EntitiesTab() {
  const { user, isDemoMode } = useAuth();
  const { toast } = useToast();
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: { entity_name: '', gstin: '' },
  });

  useEffect(() => {
    loadEntities();
  }, [user]);

  const loadEntities = async () => {
    if (isDemoMode) {
      setEntities([{ id: 'demo', entity_name: 'Demo Company', gstin: '29ABCDE1234F1Z5' }]);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase!.from('entities').select('*').eq('owner_user_id', user!.id);
      setEntities(data || []);
    } catch (error) {
      console.error('Failed to load entities:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EntityFormData) => {
    if (isDemoMode) {
      toast({ title: 'Demo Mode', description: 'Entity creation disabled in demo mode' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('entities').insert({
        entity_name: data.entity_name,
        gstin: data.gstin.toUpperCase(),
        owner_user_id: user!.id,
      });

      if (error) throw error;

      toast({ title: 'Entity created', description: 'New entity has been added.' });
      form.reset();
      setShowForm(false);
      loadEntities();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create entity', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) return;

    try {
      await supabase.from('entities').delete().eq('id', id);
      toast({ title: 'Entity deleted' });
      loadEntities();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete entity', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entities</CardTitle>
        <CardDescription>Manage your business entities (Organizations)</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="mb-4">
            <Plus className="mr-2 h-4 w-4" />
            Add Entity
          </Button>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6 p-4 bg-slate-50 rounded-lg">
              <FormField control={form.control} name="entity_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Name</FormLabel>
                  <FormControl><Input placeholder="ABC Company" {...field} /></FormControl>
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
                <Button type="submit" disabled={isSaving || isDemoMode}>
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
            {entities.map((entity) => (
              <div key={entity.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{entity.entity_name}</p>
                  <p className="text-sm text-slate-500 font-mono">{entity.gstin}</p>
                </div>
                {!isDemoMode && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(entity.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            {entities.length === 0 && !loading && (
              <p className="text-center text-slate-500 py-4">No entities found. Add one to get started.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// NOTIFICATIONS TAB
// =====================================================

function NotificationsTab() {
  const { user, isDemoMode } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    notifications: true,
    email_alerts: true,
    sms_alerts: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_settings')
        .select('notifications')
        .eq('user_id', user!.id)
        .single();
      
      if (data) {
        setSettings(prev => ({ ...prev, notifications: data.notifications }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof typeof settings) => {
    if (isDemoMode) return;

    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));

    try {
      await supabase.from('user_settings').upsert({
        user_id: user!.id,
        notifications: newValue,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Manage how you receive alerts</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
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
                disabled={isDemoMode}
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
                disabled={isDemoMode}
                className="h-5 w-5"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
