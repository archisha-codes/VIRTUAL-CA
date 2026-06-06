-- =====================================================
-- MULTI-TENTANT GST SAAS PLATFORM - SUPABASE SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    billing_gstin TEXT,
    billing_pan TEXT,
    legal_name TEXT,
    business_address TEXT,
    workspace_type TEXT DEFAULT 'Business',
    location TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- =====================================================
-- MEMBERSHIPS TABLE (User-Organization Relationship)
-- =====================================================
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, org_id)
);

-- Indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_org_id ON memberships(org_id);

-- =====================================================
-- GST PROFILES TABLE (Multiple GSTIN per Organization)
-- =====================================================
CREATE TABLE IF NOT EXISTS gst_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gstin TEXT NOT NULL,
    legal_name TEXT,
    trade_name TEXT,
    state_code TEXT NOT NULL,
    address TEXT,
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, gstin)
);

-- Indexes
CREATE INDEX idx_gst_profiles_org_id ON gst_profiles(org_id);
CREATE INDEX idx_gst_profiles_gstin ON gst_profiles(gstin);

-- =====================================================
-- PROFILES TABLE (Extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USER PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    default_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can see their own organizations
CREATE POLICY "Users can view their organizations" ON organizations
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own organizations" ON organizations
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their organizations" ON organizations
    FOR UPDATE USING (created_by = auth.uid());

-- Memberships: Users can see their memberships
CREATE POLICY "Users can view their memberships" ON memberships
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert memberships" ON memberships
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their memberships" ON memberships
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their memberships" ON memberships
    FOR DELETE USING (user_id = auth.uid());

-- GST Profiles: Org members can view/edit
CREATE POLICY "Org members can view gst profiles" ON gst_profiles
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Org members can insert gst profiles" ON gst_profiles
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

CREATE POLICY "Org members can update gst profiles" ON gst_profiles
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

CREATE POLICY "Org members can delete gst profiles" ON gst_profiles
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- Profiles: Users can view/edit their own profile
CREATE POLICY "Users can view their profile" ON profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their profile" ON profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

-- User Preferences
CREATE POLICY "Users can view their preferences" ON user_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their preferences" ON user_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their preferences" ON user_preferences
    FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, full_name)
    VALUES (NEW.id, NEW.id, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get user's organizations with membership details
CREATE OR REPLACE FUNCTION public.get_user_organizations(user_uuid UUID)
RETURNS TABLE (
    org_id UUID,
    org_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        m.role,
        m.created_at
    FROM organizations o
    JOIN memberships m ON m.org_id = o.id
    WHERE m.user_id = user_uuid
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get organization's GST profiles
CREATE OR REPLACE FUNCTION public.get_org_gst_profiles(org_uuid UUID)
RETURNS TABLE (
    id UUID,
    gstin TEXT,
    legal_name TEXT,
    trade_name TEXT,
    state_code TEXT,
    is_primary BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gp.id,
        gp.gstin,
        gp.legal_name,
        gp.trade_name,
        gp.state_code,
        gp.is_primary,
        gp.is_active
    FROM gst_profiles gp
    WHERE gp.org_id = org_uuid
    ORDER BY gp.is_primary DESC, gp.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create organization with owner membership (transactional)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    org_name TEXT,
    user_uuid UUID
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create organization
    INSERT INTO organizations (name, created_by)
    VALUES (org_name, user_uuid)
    RETURNING id INTO new_org_id;
    
    -- Add owner membership
    INSERT INTO memberships (user_id, org_id, role)
    VALUES (user_uuid, new_org_id, 'owner');
    
    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add member to organization
CREATE OR REPLACE FUNCTION public.add_org_member(
    org_uuid UUID,
    user_uuid UUID,
    member_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO memberships (user_id, org_id, role)
    VALUES (user_uuid, org_uuid, member_role)
    ON CONFLICT (user_id, org_id) DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- NOTE: Run these manually if needed for testing
-- INSERT INTO organizations (name, created_by) VALUES ('Demo Org', 'user-uuid-here');
-- INSERT INTO gst_profiles (org_id, gstin, legal_name, state_code, is_primary) 
-- VALUES ('org-uuid-here', '29ABCDE1234F1Z5', 'Demo Company Pvt Ltd', '29', true);
