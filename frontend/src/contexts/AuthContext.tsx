import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type {
  AuthContextType,
  AuthResult,
  Profile,
  OrganizationWithRole,
  GSTProfile,
  OnboardingStep,
  MembershipRole,
  CreateGstProfileInput,
} from '@/integrations/supabase/types';

// =====================================================
// LOCAL STORAGE KEYS
// =====================================================

const AUTH_MODE_KEY = 'auth_mode';
const DEMO_USER_KEY = 'demo_user';
const DEMO_SESSION_KEY = 'demo_session';

// =====================================================
// AUTH CONTEXT
// =====================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo mode initialization helper
const loadDemoSessionFromStorage = (): { user: User | null; session: Session | null; profile: Profile | null; organization: OrganizationWithRole | null; gstProfiles: GSTProfile[] } | null => {
  try {
    const authMode = localStorage.getItem(AUTH_MODE_KEY);
    if (authMode !== 'demo') return null;
    
    const userStr = localStorage.getItem(DEMO_USER_KEY);
    const sessionStr = localStorage.getItem(DEMO_SESSION_KEY);
    
    if (!userStr || !sessionStr) return null;
    
    const user = JSON.parse(userStr) as User;
    const session = JSON.parse(sessionStr) as Session;
    const profileStr = localStorage.getItem('demo_profile');
    const organizationStr = localStorage.getItem('demo_organization');
    const gstProfilesStr = localStorage.getItem('demo_gst_profiles');
    
    return {
      user,
      session,
      profile: profileStr ? JSON.parse(profileStr) : null,
      organization: organizationStr ? JSON.parse(organizationStr) : null,
      gstProfiles: gstProfilesStr ? JSON.parse(gstProfilesStr) : [],
    };
  } catch {
    console.error('Failed to load demo session from storage');
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Organization State
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithRole | null>(null);
  const [gstProfiles, setGstProfiles] = useState<GSTProfile[]>([]);
  const [currentGstProfile, setCurrentGstProfile] = useState<GSTProfile | null>(null);

  // Onboarding State
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStepState] = useState<OnboardingStep>('welcome');
  const [onboardingData, setOnboardingData] = useState({
    orgName: '',
    gstin: '',
    stateCode: '',
  });

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const loadUserOrganizations = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_organizations', {
        user_uuid: userId,
      });

      if (error) throw error;
      
      const orgs: OrganizationWithRole[] = data || [];
      setOrganizations(orgs);
      
      // Set first org as current if none selected
      if (orgs.length > 0 && !currentOrganization) {
        setCurrentOrganization(orgs[0]);
      }
      
      return orgs;
    } catch (err) {
      console.error('Failed to load organizations:', err);
      return [];
    }
  }, [currentOrganization]);

  const loadGstProfiles = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_org_gst_profiles', {
        org_uuid: orgId,
      });

      if (error) throw error;
      
      const profiles: GSTProfile[] = data || [];
      setGstProfiles(profiles);
      
      // Set primary profile as current
      const primary = profiles.find(p => p.is_primary);
      if (primary) {
        setCurrentGstProfile(primary);
      } else if (profiles.length > 0) {
        setCurrentGstProfile(profiles[0]);
      }
      
      return profiles;
    } catch (err) {
      console.error('Failed to load GST profiles:', err);
      return [];
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Failed to load profile:', err);
      return null;
    }
  }, []);

  // =====================================================
  // AUTH EFFECTS
  // =====================================================

  // Initialize demo session from localStorage if available
  useEffect(() => {
    const demoSession = loadDemoSessionFromStorage();
    if (demoSession) {
      setIsDemoMode(true);
      setUser(demoSession.user);
      setSession(demoSession.session);
      setProfile(demoSession.profile);
      if (demoSession.organization) {
        setCurrentOrganization(demoSession.organization);
        setOrganizations([demoSession.organization]);
      }
      setGstProfiles(demoSession.gstProfiles);
      if (demoSession.gstProfiles.length > 0) {
        setCurrentGstProfile(demoSession.gstProfiles[0]);
      }
      setIsOnboarding(false);
      setOnboardingStepState('welcome');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Skip Supabase initialization if not configured
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, starting in offline mode');
      setLoading(false);
      return;
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isDemoMode) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    // Check for existing session - Phase 3 fix
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isDemoMode, loadUserProfile]);

  // Load GST profiles when org changes
  useEffect(() => {
    if (currentOrganization && !isDemoMode) {
      loadGstProfiles(currentOrganization.id);
    }
  }, [currentOrganization, isDemoMode, loadGstProfiles]);

  // Check onboarding status - only run once when user data changes
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  useEffect(() => {
    if (initialCheckDone) return;
    
    if (user && organizations.length === 0 && !isDemoMode) {
      setIsOnboarding(true);
      setOnboardingStepState('create-org');
    } else if (user && organizations.length > 0 && gstProfiles.length === 0 && !isDemoMode) {
      setIsOnboarding(true);
      setOnboardingStepState('add-gstin');
    } else {
      setIsOnboarding(false);
      setOnboardingStepState('welcome');
    }
    
    setInitialCheckDone(true);
  }, [user, organizations.length, gstProfiles.length, isDemoMode, initialCheckDone]);

  // =====================================================
  // AUTH METHODS
  // =====================================================

  const signUp = async (email: string, password: string, fullName: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Authentication service is not configured. Please use Demo Mode.') };
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('Signup error:', error.message);
      return { error };
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Authentication service is not configured. Please use Demo Mode.') };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Login failed: No user returned');

      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('Login error:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        return { error: new Error('Unable to connect. Please use Demo Mode.') };
      }
      
      if (error.message.includes('Invalid login credentials')) {
        return { error: new Error('Invalid email or password.') };
      }
      
      return { error };
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'github'): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('OAuth is not configured. Please use Demo Mode.') };
    }

    try {
      const origin = window.location.origin;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/dashboard`,
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('OAuth error:', error.message);
      return { error };
    }
  };

  const signOut = async (): Promise<void> => {
    // Clear demo mode from localStorage
    if (isDemoMode) {
      localStorage.removeItem(AUTH_MODE_KEY);
      localStorage.removeItem(DEMO_USER_KEY);
      localStorage.removeItem(DEMO_SESSION_KEY);
      localStorage.removeItem('demo_profile');
      localStorage.removeItem('demo_organization');
      localStorage.removeItem('demo_gst_profiles');
    }

    if (isDemoMode) {
      resetToInitialState();
      return;
    }

    await supabase.auth.signOut();
    resetToInitialState();
  };

  const resetToInitialState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsDemoMode(false);
    setOrganizations([]);
    setCurrentOrganization(null);
    setGstProfiles([]);
    setCurrentGstProfile(null);
    setIsOnboarding(false);
    setOnboardingStepState('welcome');
    setOnboardingData({ orgName: '', gstin: '', stateCode: '' });
    setInitialCheckDone(false);
  };

  const loginAsDemo = async (): Promise<void> => {
    // Create demo user dynamically
    const demoUser: User = {
      id: `demo-user-${Date.now()}`,
      email: 'demo@virtualca.in',
      app_metadata: {},
      user_metadata: { full_name: 'Demo User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;

    const demoProfile: Profile = {
      id: `demo-profile-${Date.now()}`,
      user_id: demoUser.id,
      full_name: 'Demo User',
      email: 'demo@virtualca.in',
      phone: null,
      company_name: 'Demo Company Pvt Ltd',
      active_entity: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const demoOrganization: OrganizationWithRole = {
      id: `demo-org-${Date.now()}`,
      name: 'Demo Company Pvt Ltd',
      created_by: demoUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: 'owner',
      membership_id: `demo-membership-${Date.now()}`,
    };

    const demoGstProfile: GSTProfile = {
      id: `demo-gst-${Date.now()}`,
      org_id: demoOrganization.id,
      gstin: '29ABCDE1234F1Z5',
      legal_name: 'Demo Company Pvt Ltd',
      trade_name: 'Demo Company',
      state_code: '29',
      address: '123 Business Street, Bangalore',
      email: 'demo@virtualca.in',
      phone: '+919999999999',
      is_primary: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setIsDemoMode(true);
    setUser(demoUser);
    setProfile(demoProfile);
    setOrganizations([demoOrganization]);
    setCurrentOrganization(demoOrganization);
    setGstProfiles([demoGstProfile]);
    setCurrentGstProfile(demoGstProfile);
    
    // Demo mode - skip onboarding
    setIsOnboarding(false);
    setOnboardingStepState('welcome');
    
    // Create mock session
    const mockSession: Session = {
      access_token: 'demo-token',
      refresh_token: 'demo-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: demoUser,
    } as Session;
    
    setSession(mockSession);
    
    // Store in localStorage for persistence
    localStorage.setItem(AUTH_MODE_KEY, 'demo');
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(mockSession));
    localStorage.setItem('demo_profile', JSON.stringify(demoProfile));
    localStorage.setItem('demo_organization', JSON.stringify(demoOrganization));
    localStorage.setItem('demo_gst_profiles', JSON.stringify([demoGstProfile]));
  };

  // =====================================================
  // PROFILE METHODS
  // =====================================================

  const updateProfile = async (data: Partial<Profile>): Promise<AuthResult> => {
    if (!user && !isDemoMode) {
      return { error: new Error('No user logged in') };
    }

    if (isDemoMode) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('user_id', user!.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...data } : null);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =====================================================
  // ORGANIZATION METHODS
  // =====================================================

  const createOrganization = async (name: string): Promise<AuthResult> => {
    if (!user && !isDemoMode) {
      return { error: new Error('No user logged in') };
    }

    if (isDemoMode) {
      const newOrg: OrganizationWithRole = {
        id: `demo-org-${Date.now()}`,
        name,
        created_by: user?.id || 'demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'owner',
        membership_id: `demo-membership-${Date.now()}`,
      };
      setOrganizations(prev => [...prev, newOrg]);
      setCurrentOrganization(newOrg);
      setGstProfiles([]);
      setCurrentGstProfile(null);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.rpc('create_organization_with_owner', {
        org_name: name,
        user_uuid: user!.id,
      });

      if (error) throw error;

      // Reload organizations
      const orgs = await loadUserOrganizations(user!.id);
      
      // Set newly created org as current
      const newOrg = orgs.find(o => o.id === data);
      if (newOrg) {
        setCurrentOrganization(newOrg);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const switchOrganization = async (orgId: string): Promise<void> => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      // GST profiles will be loaded by the useEffect
    }
  };

  // =====================================================
  // GST PROFILE METHODS
  // =====================================================

  const createGstProfile = async (data: CreateGstProfileInput): Promise<AuthResult> => {
    if (!currentOrganization && !isDemoMode) {
      return { error: new Error('No organization selected') };
    }

    if (isDemoMode) {
      const newProfile: GSTProfile = {
        id: `demo-gst-${Date.now()}`,
        org_id: currentOrganization?.id || 'demo-org',
        gstin: data.gstin,
        legal_name: data.legal_name || null,
        trade_name: data.trade_name || null,
        state_code: data.state_code,
        address: data.address || null,
        email: data.email || null,
        phone: data.phone || null,
        is_primary: data.is_primary || gstProfiles.length === 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setGstProfiles(prev => [...prev, newProfile]);
      if (newProfile.is_primary) {
        setCurrentGstProfile(newProfile);
      }
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('gst_profiles')
        .insert({
          org_id: currentOrganization!.id,
          gstin: data.gstin,
          legal_name: data.legal_name,
          trade_name: data.trade_name,
          state_code: data.state_code,
          address: data.address,
          email: data.email,
          phone: data.phone,
          is_primary: data.is_primary || gstProfiles.length === 0,
        });

      if (error) throw error;

      // Reload GST profiles
      await loadGstProfiles(currentOrganization!.id);
      
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const setPrimaryGstProfile = async (profileId: string): Promise<void> => {
    if (isDemoMode) {
      setGstProfiles(prev => prev.map(p => ({
        ...p,
        is_primary: p.id === profileId,
      })));
      const profile = gstProfiles.find(p => p.id === profileId);
      if (profile) {
        setCurrentGstProfile({ ...profile, is_primary: true });
      }
      return;
    }

    try {
      // First, unset all primary flags for this org
      await supabase
        .from('gst_profiles')
        .update({ is_primary: false })
        .eq('org_id', currentOrganization!.id);

      // Then set the new primary
      await supabase
        .from('gst_profiles')
        .update({ is_primary: true })
        .eq('id', profileId);

      // Reload profiles
      await loadGstProfiles(currentOrganization!.id);
    } catch (err) {
      console.error('Failed to set primary GST profile:', err);
    }
  };

  // =====================================================
  // ONBOARDING METHODS
  // =====================================================

  const handleSetOnboardingStep = (step: OnboardingStep): void => {
    setOnboardingStepState(step);
  };

  const completeOnboarding = async (): Promise<void> => {
    setIsOnboarding(false);
    setOnboardingStepState('welcome');
  };

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  const hasRole = (roles: MembershipRole[]): boolean => {
    if (!currentOrganization && !isDemoMode) return false;
    return roles.includes(currentOrganization?.role as MembershipRole);
  };

  const isOrganizationOwner = (): boolean => {
    return hasRole(['owner']);
  };

  const isOrganizationAdmin = (): boolean => {
    return hasRole(['owner', 'admin']);
  };

  // =====================================================
  // PROVIDER VALUE
  // =====================================================

  const value: AuthContextType = {
    // Auth state
    user,
    session,
    profile,
    loading,
    isDemoMode,
    
    // Organization state
    organizations,
    currentOrganization,
    gstProfiles,
    currentGstProfile,
    
    // Onboarding state
    isOnboarding,
    currentStep: onboardingStep,
    orgName: onboardingData.orgName,
    gstin: onboardingData.gstin,
    stateCode: onboardingData.stateCode,
    
    // Auth methods
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    loginAsDemo,
    
    // Profile methods
    updateProfile,
    
    // Organization methods
    createOrganization,
    switchOrganization,
    
    // GST Profile methods
    createGstProfile,
    setPrimaryGstProfile,
    
    // Onboarding methods
    setOnboardingStep: handleSetOnboardingStep,
    completeOnboarding,
    
    // Utility methods
    hasRole,
    isOrganizationOwner,
    isOrganizationAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
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
