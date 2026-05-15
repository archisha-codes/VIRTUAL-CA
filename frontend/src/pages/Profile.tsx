import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Camera } from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, updateProfile, loading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
    },
  });

  // Update form when user loads
  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name || '',
      });
    }
  }, [user, form]);

  // Save profile
  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: data.full_name,
      });

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-corporate-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="hover:bg-slate-100 dark:hover:bg-slate-800">
          ← Back to Dashboard
        </Button>
      </div>

      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-corporate-primary" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Manage your personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Avatar Section (Simplified) */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                <span className="text-3xl font-bold text-corporate-primary">
                  {avatarLetter}
                </span>
              </div>
              <div className="absolute bottom-0 right-0 bg-corporate-primary text-white p-1.5 rounded-full cursor-not-allowed opacity-50">
                <Camera className="h-4 w-4" />
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Profile picture uploads coming soon
            </p>
          </div>

          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</p>
            <p className="text-slate-900 dark:text-slate-100">{user?.email}</p>
            <p className="text-xs text-slate-500 mt-1 italic">Email cannot be changed</p>
          </div>

          {/* Profile Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="bg-white dark:bg-slate-900" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-corporate-primary hover:bg-corporate-primaryHover text-white shadow-md transition-all active:scale-[0.98]"
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
