import { User, Session } from '@supabase/supabase-js';

// =====================================================
// ENUMS
// =====================================================

export type MembershipRole = 'owner' | 'admin' | 'member';

export type OnboardingStep = 
  | 'welcome'
  | 'create-org'
  | 'add-gstin'
  | 'complete';

// =====================================================
// DATABASE TABLES
// =====================================================

export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
  updated_at: string;
}

export interface GSTProfile {
  id: string;
  org_id: string;
  gstin: string;
  legal_name: string | null;
  trade_name: string | null;
  state_code: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  active_entity: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: 'light' | 'dark';
  notifications_enabled: boolean;
  default_org_id: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// VIEW/JOIN TYPES
// =====================================================

export interface OrganizationWithRole extends Organization {
  role: MembershipRole;
  membership_id: string;
}

export interface GSTProfileWithOrg extends GSTProfile {
  org_name: string;
}

// =====================================================
// AUTH CONTEXT TYPES
// =====================================================

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
}

export interface OrganizationState {
  organizations: OrganizationWithRole[];
  currentOrganization: OrganizationWithRole | null;
  gstProfiles: GSTProfile[];
  currentGstProfile: GSTProfile | null;
}

export interface OnboardingState {
  isOnboarding: boolean;
  currentStep: OnboardingStep;
  orgName: string;
  gstin: string;
  stateCode: string;
}

// =====================================================
// FULL AUTH CONTEXT TYPE
// =====================================================

export interface AuthContextType extends AuthState, OrganizationState, OnboardingState {
  // Auth methods
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<AuthResult>;
  signOut: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  
  // Profile methods
  updateProfile: (data: Partial<Profile>) => Promise<AuthResult>;
  
  // Organization methods
  createOrganization: (name: string) => Promise<AuthResult>;
  switchOrganization: (orgId: string) => Promise<void>;
  
  // GST Profile methods
  createGstProfile: (data: CreateGstProfileInput) => Promise<AuthResult>;
  setPrimaryGstProfile: (profileId: string) => Promise<void>;
  
  // Onboarding methods
  setOnboardingStep: (step: OnboardingStep) => void;
  completeOnboarding: () => Promise<void>;
  
  // Utility methods
  hasRole: (roles: MembershipRole[]) => boolean;
  isOrganizationOwner: () => boolean;
  isOrganizationAdmin: () => boolean;
}

export interface AuthResult {
  error: Error | null;
  data?: unknown;
}

// =====================================================
// INPUT TYPES
// =====================================================

export interface CreateGstProfileInput {
  gstin: string;
  legal_name?: string;
  trade_name?: string;
  state_code: string;
  address?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
}

export interface CreateOrganizationInput {
  name: string;
  gstin?: string;
  state_code?: string;
}

// =====================================================
// DATABASE (for Supabase Client)
// =====================================================

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id'>>;
      };
      memberships: {
        Row: Membership;
        Insert: Omit<Membership, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Membership, 'id'>>;
      };
      gst_profiles: {
        Row: GSTProfile;
        Insert: Omit<GSTProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GSTProfile, 'id'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserPreferences, 'id'>>;
      };
    };
    Functions: {
      get_user_organizations: {
        Args: { user_uuid: string };
        Returns: OrganizationWithRole[];
      };
      get_org_gst_profiles: {
        Args: { org_uuid: string };
        Returns: GSTProfile[];
      };
      create_organization_with_owner: {
        Args: { org_name: string; user_uuid: string };
        Returns: string;
      };
      add_org_member: {
        Args: { org_uuid: string; user_uuid: string; member_role: string };
        Returns: boolean;
      };
    };
  };
};

// =====================================================
// DEMO DATA
// =====================================================

export const DEMO_USER: User = {
  id: 'demo-user-id',
  email: 'demo@virtualca.in',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

export const DEMO_PROFILE: Profile = {
  id: 'demo-profile-id',
  user_id: 'demo-user-id',
  full_name: 'Demo User',
  phone: null,
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_ORGANIZATION: OrganizationWithRole = {
  id: 'demo-org-id',
  name: 'Demo Company Pvt Ltd',
  created_by: 'demo-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  role: 'owner',
  membership_id: 'demo-membership-id',
};

export const DEMO_GST_PROFILE: GSTProfile = {
  id: 'demo-gst-id',
  org_id: 'demo-org-id',
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

export const DEMO_ORGANIZATIONS: OrganizationWithRole[] = [DEMO_ORGANIZATION];
export const DEMO_GST_PROFILES: GSTProfile[] = [DEMO_GST_PROFILE];
