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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

// =====================================================
// SCHEMAS
// =====================================================

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

// =====================================================
// AUTH PAGE COMPONENT
// =====================================================

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { signIn, signUp, signInWithOAuth, user, loginAsDemo, isOnboarding } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  // Redirect if already logged in and not onboarding
  useEffect(() => {
    if (user && !isOnboarding) {
      navigate('/dashboard');
    }
  }, [user, isOnboarding, navigate]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured) {
      toast({
        title: 'OAuth not configured',
        description: 'Please use Demo Mode to explore the app.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(provider);
    const { error } = await signInWithOAuth(provider);
    setIsLoading(null);

    if (error) {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onLogin = async (data: LoginFormData) => {
    setIsLoading('email');
    const { error } = await signIn(data.email, data.password);
    setIsLoading(null);

    if (error) {
      // Check for network errors and suggest demo mode
      if (error.message.includes('Failed to fetch') || error.message.includes('network') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
        toast({
          title: 'Connection unavailable',
          description: 'Unable to connect to authentication service. Please use Demo Mode to explore the app.',
          variant: 'destructive',
        });
        // Offer to switch to demo mode
        if (confirm('Would you like to switch to Demo Mode instead?')) {
          handleDemoLogin();
        }
      } else {
        toast({
          title: 'Login failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      // Navigation will happen via useEffect
    }
  };

  const onSignup = async (data: SignupFormData) => {
    setIsLoading('email');
    const { error } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(null);

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'This email is already registered. Please login instead.';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
        message = 'Unable to connect. Please use Demo Mode to explore the app.';
      }
      toast({
        title: 'Signup failed',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account before logging in.',
      });
      setActiveTab('login');
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading('demo');
    try {
      await loginAsDemo();
      toast({
        title: 'Welcome to Demo Mode!',
        description: 'You are now exploring the app with sample data.',
      });
      navigate('/dashboard');
    } catch (err) {
      toast({
        title: 'Demo Error',
        description: 'Failed to start demo mode. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(null);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  const showOAuthButtons = isSupabaseConfigured;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-olive-50 via-white to-burgundy-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-olive-600 to-burgundy-700 mb-4">
            <span className="text-2xl font-bold text-white">V</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Virtual CA</h1>
          <p className="text-slate-600 mt-2">
            Automate your GST compliance with ease
          </p>
        </div>

        {/* Auth Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-md glass">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
            </CardTitle>
            <CardDescription className="text-center">
              {activeTab === 'login' 
                ? 'Enter your credentials to access your account' 
                : 'Enter your details to get started'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                {/* OAuth Buttons */}
                {showOAuthButtons && (
                  <div className="space-y-3 mb-4">
                    <Button 
                      variant="outline" 
                      className="w-full border-2 border-slate-200 hover:bg-slate-50"
                      onClick={() => handleOAuthLogin('google')}
                      disabled={!!isLoading}
                    >
                      {isLoading === 'google' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      Login with Google
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full border-2 border-slate-200 hover:bg-slate-50"
                      onClick={() => handleOAuthLogin('github')}
                      disabled={!!isLoading}
                    >
                      {isLoading === 'github' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      )}
                      Login with GitHub
                    </Button>
                  </div>
                )}

                {/* Divider */}
                {showOAuthButtons && (
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">Or continue with</span>
                    </div>
                  </div>
                )}

                {/* Email Login Form */}
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input placeholder="••••••••" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
                      disabled={!!isLoading || !isSupabaseConfigured}
                    >
                      {isLoading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Mail className="mr-2 h-4 w-4" />
                      {isSupabaseConfigured ? 'Login with Email' : 'Email Login Unavailable'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input placeholder="••••••••" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input placeholder="••••••••" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
                      disabled={!!isLoading || !isSupabaseConfigured}
                    >
                      {isLoading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isSupabaseConfigured ? 'Create Account' : 'Signup Unavailable'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>

            {/* Login link for signup tab */}
            {activeTab === 'signup' && (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="text-olive-600 hover:text-olive-700 font-medium"
                  >
                    Login
                  </button>
                </p>
              </div>
            )}

            {/* Demo Mode Button */}
            <div className="mt-6 p-4 bg-gradient-to-r from-olive-50 to-burgundy-50 rounded-lg border border-olive-200">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-3">
                  Want to explore first?
                </p>
                <Button 
                  variant="outline" 
                  className="w-full border-olive-300 text-olive-700 hover:bg-olive-100 hover:text-olive-800"
                  onClick={handleDemoLogin}
                  disabled={!!isLoading}
                >
                  {isLoading === 'demo' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Try Demo Mode
                </Button>
                <p className="text-xs text-slate-500 mt-2">
                  No account needed • Sample data included
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Button 
            variant="link" 
            onClick={() => navigate('/')}
            className="text-slate-600"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
