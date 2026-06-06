import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, User as UserIcon, ShieldCheck } from 'lucide-react';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { signIn, signUp, signInDev, user } = useAuth();
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

  // Redirect once authenticated
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const onLogin = async (data: LoginFormData) => {
    setIsLoading('email');
    const { error } = await signIn(data.email, data.password);
    setIsLoading(null);

    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
    }
  };

  const onSignup = async (data: SignupFormData) => {
    setIsLoading('signup');
    const { error } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(null);

    if (error) {
      let msg = error.message;
      if (msg.toLowerCase().includes('already')) {
        msg = 'This email is already registered. Please log in instead.';
      }
      toast({ title: 'Sign up failed', description: msg, variant: 'destructive' });
    } else {
      toast({ title: 'Account created!', description: "You're now logged in." });
    }
  };

  const onDevLogin = async () => {
    setIsLoading('dev');
    const { error } = await signInDev();
    setIsLoading(null);

    if (error) {
      toast({ title: 'Dev login failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Development Mode', description: 'Logged in as Dev Admin.' });
    }
  };

  const showDevLogin = import.meta.env.VITE_DEV_MODE === 'true';

  // ─── UI ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-olive-50 via-white to-burgundy-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-olive-600 to-burgundy-700 mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">V</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Virtual CA</h1>
          <p className="text-slate-500 mt-1 text-sm">Automate your GST compliance with ease</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
            </CardTitle>
            <CardDescription className="text-center">
              {activeTab === 'login'
                ? 'Enter your credentials to access your account'
                : 'Fill in the details below to get started'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* ─── Login Tab ──────────────────────────────────────────── */}
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="you@example.com"
                                type="email"
                                className="pl-9"
                                {...field}
                              />
                            </div>
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
                            <div className="relative">
                              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="••••••••"
                                type="password"
                                className="pl-9"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
                      disabled={!!isLoading}
                    >
                      {isLoading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Login with Email
                    </Button>

                    {showDevLogin && (
                      <>
                        <div className="relative my-2">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-400">or</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-dashed border-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={onDevLogin}
                          disabled={!!isLoading}
                        >
                          {isLoading === 'dev' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="mr-2 h-4 w-4" />
                          )}
                          Dev Login (Bypass Auth)
                        </Button>
                      </>
                    )}
                  </form>
                </Form>
              </TabsContent>

              {/* ─── Signup Tab ─────────────────────────────────────────── */}
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
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input placeholder="Jane Doe" className="pl-9" {...field} />
                            </div>
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
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="you@example.com"
                                type="email"
                                className="pl-9"
                                {...field}
                              />
                            </div>
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
                            <div className="relative">
                              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="Min. 8 characters"
                                type="password"
                                className="pl-9"
                                {...field}
                              />
                            </div>
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
                            <div className="relative">
                              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="••••••••"
                                type="password"
                                className="pl-9"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-olive-600 to-burgundy-700 hover:from-olive-700 hover:to-burgundy-800"
                      disabled={!!isLoading}
                    >
                      {isLoading === 'signup' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </Form>

                <p className="mt-4 text-center text-sm text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="text-olive-600 hover:text-olive-700 font-medium"
                  >
                    Login
                  </button>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="link" onClick={() => navigate('/')} className="text-slate-500">
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
