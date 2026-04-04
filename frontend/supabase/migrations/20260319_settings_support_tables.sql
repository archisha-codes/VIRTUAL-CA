-- Migration: Support Chat and Settings Tables
-- Created: 2026-03-19

BEGIN;

-- =====================================================
-- Add columns to organizations table
-- =====================================================
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_gstin TEXT,
ADD COLUMN IF NOT EXISTS billing_pan TEXT,
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS workspace_type TEXT DEFAULT 'Business',
ADD COLUMN IF NOT EXISTS location TEXT;

-- =====================================================
-- SUPPORT CHAT TABLES
-- =====================================================

-- Support Conversations
CREATE TABLE IF NOT EXISTS support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user conversations
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_workspace_id ON support_conversations(workspace_id);

-- Support Messages
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    text TEXT NOT NULL,
    feedback TEXT CHECK (feedback IN ('like', 'dislike', NULL)),
    is_truncated BOOLEAN DEFAULT false,
    citations JSONB DEFAULT '[]'::jsonb,
    suggested_actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for conversation messages
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id);

-- =====================================================
-- SETTINGS TABLES
-- =====================================================

-- Workspace Security Settings
CREATE TABLE IF NOT EXISTS workspace_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    login_providers TEXT[] DEFAULT ARRAY['google', 'microsoft', 'username_password'],
    username_password_enabled BOOLEAN DEFAULT true,
    idle_session_timeout_enabled BOOLEAN DEFAULT true,
    idle_session_timeout_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id)
);

-- Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    pan TEXT,
    gstin TEXT,
    branch_code TEXT,
    type TEXT CHECK (type IN ('Company', 'Partnership', 'Proprietorship', 'HUF', 'Trust', 'Other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for businesses
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_workspace_id ON businesses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_businesses_parent_id ON businesses(parent_id);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    products TEXT[] DEFAULT '{}'::text[],
    business_ids UUID[] DEFAULT '{}'::uuid[],
    invited_by UUID REFERENCES auth.users(id),
    invitation_status TEXT DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

-- GSTIN Credentials
CREATE TABLE IF NOT EXISTS gstin_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gstin TEXT NOT NULL,
    business_name TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT,
    connection_status TEXT DEFAULT 'Active' CHECK (connection_status IN ('Active', 'Inactive', 'Expired', 'Locked')),
    expires_on DATE,
    last_authenticated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, gstin)
);

CREATE INDEX IF NOT EXISTS idx_gstin_credentials_workspace_id ON gstin_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gstin_credentials_gstin ON gstin_credentials(gstin);

-- NIC Credentials
CREATE TABLE IF NOT EXISTS nic_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gstin TEXT NOT NULL,
    nic_api_username TEXT NOT NULL,
    nic_api_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, gstin)
);

CREATE INDEX IF NOT EXISTS idx_nic_credentials_workspace_id ON nic_credentials(workspace_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    plan_type TEXT CHECK (plan_type IN ('Professional', 'Enterprise', 'Basic')),
    validity_start DATE NOT NULL,
    validity_end DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Expired', 'Cancelled')),
    amount DECIMAL(12, 2),
    currency TEXT DEFAULT 'INR',
    billing_cycle TEXT DEFAULT 'Annual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id);

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    category TEXT CHECK (category IN ('ERP', 'Accounting', 'Banking', 'E-commerce', 'Other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Integration Connections
CREATE TABLE IF NOT EXISTS integration_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_connected BOOLEAN DEFAULT false,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(integration_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_workspace_id ON integration_connections(workspace_id);

-- API Clients
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL,
    permissions TEXT[] DEFAULT ARRAY['read']::text[],
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_clients_workspace_id ON api_clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_clients_client_id ON api_clients(client_id);

-- DSC Configuration
CREATE TABLE IF NOT EXISTS dsc_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dsc_provider TEXT,
    certificate_serial TEXT,
    certificate_subject TEXT,
    certificate_valid_from DATE,
    certificate_valid_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsc_configurations_workspace_id ON dsc_configurations(workspace_id);

-- Email Configuration
CREATE TABLE IF NOT EXISTS email_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_username TEXT,
    smtp_encrypted_password TEXT,
    from_email TEXT,
    from_name TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_email_configurations_workspace_id ON email_configurations(workspace_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE gstin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE nic_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsc_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;

-- Support Conversations Policies
DROP POLICY IF EXISTS "Users can view their conversations" ON support_conversations;
CREATE POLICY "Users can view their conversations" ON support_conversations
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert conversations" ON support_conversations;
CREATE POLICY "Users can insert conversations" ON support_conversations
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their conversations" ON support_conversations;
CREATE POLICY "Users can update their conversations" ON support_conversations
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their conversations" ON support_conversations;
CREATE POLICY "Users can delete their conversations" ON support_conversations
    FOR DELETE USING (user_id = auth.uid());

-- Support Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON support_messages;
CREATE POLICY "Users can view messages in their conversations" ON support_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM support_conversations WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages" ON support_messages;
CREATE POLICY "Users can insert messages" ON support_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT id FROM support_conversations WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their message feedback" ON support_messages;
CREATE POLICY "Users can update their message feedback" ON support_messages
    FOR UPDATE USING (
        conversation_id IN (
            SELECT id FROM support_conversations WHERE user_id = auth.uid()
        )
    );

-- Workspace Security Policies
DROP POLICY IF EXISTS "Org members can view workspace security" ON workspace_security;
CREATE POLICY "Org members can view workspace security" ON workspace_security
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage workspace security" ON workspace_security;
CREATE POLICY "Org admins can manage workspace security" ON workspace_security
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Businesses Policies
DROP POLICY IF EXISTS "Users can view their businesses" ON businesses;
CREATE POLICY "Users can view their businesses" ON businesses
    FOR SELECT USING (
        owner_user_id = auth.uid() OR 
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert businesses" ON businesses;
CREATE POLICY "Users can insert businesses" ON businesses
    FOR INSERT WITH CHECK (
        owner_user_id = auth.uid() OR 
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can update their businesses" ON businesses;
CREATE POLICY "Users can update their businesses" ON businesses
    FOR UPDATE USING (
        owner_user_id = auth.uid() OR 
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can delete their businesses" ON businesses;
CREATE POLICY "Users can delete their businesses" ON businesses
    FOR DELETE USING (
        owner_user_id = auth.uid() OR 
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Organization Members Policies
DROP POLICY IF EXISTS "Org members can view other members" ON organization_members;
CREATE POLICY "Org members can view other members" ON organization_members
    FOR SELECT USING (
        organization_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage members" ON organization_members;
CREATE POLICY "Org admins can manage members" ON organization_members
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- GSTIN Credentials Policies
DROP POLICY IF EXISTS "Org members can view GSTIN credentials" ON gstin_credentials;
CREATE POLICY "Org members can view GSTIN credentials" ON gstin_credentials
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage GSTIN credentials" ON gstin_credentials;
CREATE POLICY "Org admins can manage GSTIN credentials" ON gstin_credentials
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- NIC Credentials Policies
DROP POLICY IF EXISTS "Org members can view NIC credentials" ON nic_credentials;
CREATE POLICY "Org members can view NIC credentials" ON nic_credentials
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage NIC credentials" ON nic_credentials;
CREATE POLICY "Org admins can manage NIC credentials" ON nic_credentials
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Subscriptions Policies
DROP POLICY IF EXISTS "Org members can view subscriptions" ON subscriptions;
CREATE POLICY "Org members can view subscriptions" ON subscriptions
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org owners can manage subscriptions" ON subscriptions;
CREATE POLICY "Org owners can manage subscriptions" ON subscriptions
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Integrations Policies
DROP POLICY IF EXISTS "Anyone can view integrations" ON integrations;
CREATE POLICY "Anyone can view integrations" ON integrations
    FOR SELECT USING (is_active = true);

-- Integration Connections Policies
DROP POLICY IF EXISTS "Org members can view integration connections" ON integration_connections;
CREATE POLICY "Org members can view integration connections" ON integration_connections
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage integration connections" ON integration_connections;
CREATE POLICY "Org admins can manage integration connections" ON integration_connections
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- API Clients Policies
DROP POLICY IF EXISTS "Org members can view API clients" ON api_clients;
CREATE POLICY "Org members can view API clients" ON api_clients
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage API clients" ON api_clients;
CREATE POLICY "Org admins can manage API clients" ON api_clients
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- DSC Configuration Policies
DROP POLICY IF EXISTS "Org members can view DSC configuration" ON dsc_configurations;
CREATE POLICY "Org members can view DSC configuration" ON dsc_configurations
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage DSC configuration" ON dsc_configurations;
CREATE POLICY "Org admins can manage DSC configuration" ON dsc_configurations
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Email Configuration Policies
DROP POLICY IF EXISTS "Org members can view email configuration" ON email_configurations;
CREATE POLICY "Org members can view email configuration" ON email_configurations
    FOR SELECT USING (
        workspace_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Org admins can manage email configuration" ON email_configurations;
CREATE POLICY "Org admins can manage email configuration" ON email_configurations
    FOR ALL USING (
        workspace_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =====================================================
-- SEED DATA FOR INTEGRATIONS
-- =====================================================
INSERT INTO integrations (name, description, category) VALUES
    ('Tally', 'Connect with Tally ERP for seamless data sync', 'ERP'),
    ('SAP', 'Connect with SAP Business One', 'ERP'),
    ('Zoho', 'Connect with Zoho Books', 'Accounting'),
    ('QuickBooks', 'Connect with QuickBooks Online', 'Accounting'),
    ('Amazon', 'Connect with Amazon Seller Central', 'E-commerce'),
    ('Flipkart', 'Connect with Flipkart Seller Hub', 'E-commerce')
ON CONFLICT (name) DO NOTHING;

COMMIT;
