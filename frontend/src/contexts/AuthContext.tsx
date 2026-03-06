import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  gstin: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo user for testing when Supabase is unavailable
const DEMO_USER: User = {
  id: 'demo-user-id',
  email: 'demo@virtualca.in',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEMO_PROFILE: Profile = {
  id: 'demo-profile-id',
  user_id: 'demo-user-id',
  full_name: 'Demo User',
  company_name: 'Demo Company Pvt Ltd',
  gstin: '29ABCDE1234F1Z5',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Supabase session fetch error:', error.message);
        // Don't fail hard - allow demo mode
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('Failed to connect to Supabase:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
      } else if (error?.code === 'PGRST116') {
        // Profile doesn't exist yet, create one
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: user?.user_metadata?.full_name || '',
            company_name: null,
            gstin: null,
          })
          .select()
          .single();

        if (!createError && newProfile) {
          setProfile(newProfile);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch profile:', err);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('Signup error:', error.message);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Improve error handling with specific error messages
        console.error('Login error:', error.message);
        
        // Provide more helpful error messages based on error type
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
          return { error: new Error('Unable to connect to authentication service. Please check your internet connection or try again later.') };
        }
        
        if (error.message.includes('Invalid login credentials')) {
          return { error: new Error('Invalid email or password. Please check your credentials and try again.') };
        }
        
        if (error.message.includes('User not found')) {
          return { error: new Error('No account found with this email. Please sign up first.') };
        }
        
        if (error.message.includes('Email not confirmed')) {
          return { error: new Error('Please confirm your email address before signing in.') };
        }
        
        if (error.message.includes('Too many requests')) {
          return { error: new Error('Too many login attempts. Please wait a few minutes and try again.') };
        }
        
        // Return the original error for unknown cases
        return { error };
      }

      // If login successful but no user returned, something is wrong
      if (!data.user) {
        throw new Error('Login failed: No user returned');
      }

      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('Login error:', error.message);
      
      // Handle any unexpected errors
      return { error: new Error(error.message || 'An unexpected error occurred during login. Please try again.') };
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsDemoMode(false);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const loginAsDemo = async () => {
    // Enable demo mode
    setIsDemoMode(true);
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    
    // Create a mock session
    const mockSession: Session = {
      access_token: 'demo-token',
      refresh_token: 'demo-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: DEMO_USER,
    } as Session;
    
    setSession(mockSession);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user && !isDemoMode) return { error: new Error('No user logged in') };

    if (isDemoMode) {
      // Update demo profile locally
      setProfile(prev => prev ? { ...prev, ...data } : null);
      return { error: null };
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: user!.id,
          ...data,
        });

      if (!error) {
        setProfile(prev => prev ? { ...prev, ...data } : null);
      }
      return { error: error as Error | null };
    }

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('user_id', user!.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      isDemoMode,
      signUp, 
      signIn, 
      signOut, 
      updateProfile,
      loginAsDemo 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
