-- =====================================================
-- PHASE 1: DATABASE SETUP
-- Run this SQL in Supabase Dashboard > SQL Editor
-- =====================================================

-- Enable UUID and crypto extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
create table public.profiles (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade unique,
    full_name text,
    email text,
    phone text,
    company_name text,
    active_entity text,
    avatar_url text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- =====================================================
-- UPLOADS TABLE
-- =====================================================
create table public.uploads (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    file_name text,
    file_path text,
    template_type text,
    status text,
    created_at timestamp with time zone default now()
);

-- =====================================================
-- USER SETTINGS TABLE
-- =====================================================
create table public.user_settings (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade unique,
    locale text default 'en',
    time_zone text default 'Asia/Kolkata',
    notifications boolean default true,
    theme text default 'default',
    created_at timestamp with time zone default now()
);

-- =====================================================
-- ENTITIES TABLE (Organizations)
-- =====================================================
create table public.entities (
    id uuid primary key default uuid_generate_v4(),
    entity_name text,
    gstin text,
    owner_user_id uuid references auth.users(id) on delete cascade,
    created_at timestamp with time zone default now()
);

-- =====================================================
-- MEMBERS TABLE
-- =====================================================
create table public.members (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    entity_id uuid references public.entities(id) on delete cascade,
    role text default 'viewer',
    created_at timestamp with time zone default now()
);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================
create table public.subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    plan text,
    status text,
    created_at timestamp with time zone default now()
);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
create table public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    action text,
    details jsonb,
    created_at timestamp with time zone default now()
);

-- =====================================================
-- PHASE 2: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Profiles RLS
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
    for select using (auth.uid() = user_id);

create policy "profiles_insert" on public.profiles
    for insert with check (auth.uid() = user_id);

create policy "profiles_update" on public.profiles
    for update using (auth.uid() = user_id);

-- Uploads RLS
alter table public.uploads enable row level security;

create policy "uploads_select" on public.uploads
    for select using (auth.uid() = user_id);

create policy "uploads_insert" on public.uploads
    for insert with check (auth.uid() = user_id);

create policy "uploads_delete" on public.uploads
    for delete using (auth.uid() = user_id);

-- User Settings RLS
alter table public.user_settings enable row level security;

create policy "user_settings_select" on public.user_settings
    for select using (auth.uid() = user_id);

create policy "user_settings_insert" on public.user_settings
    for insert with check (auth.uid() = user_id);

create policy "user_settings_update" on public.user_settings
    for update using (auth.uid() = user_id);

-- Entities RLS
alter table public.entities enable row level security;

create policy "entities_select" on public.entities
    for select using (auth.uid() = owner_user_id);

create policy "entities_insert" on public.entities
    for insert with check (auth.uid() = owner_user_id);

create policy "entities_update" on public.entities
    for update using (auth.uid() = owner_user_id);

create policy "entities_delete" on public.entities
    for delete using (auth.uid() = owner_user_id);

-- Members RLS
alter table public.members enable row level security;

create policy "members_select" on public.members
    for select using (
        user_id = auth.uid() or 
        entity_id in (select id from entities where owner_user_id = auth.uid())
    );

create policy "members_insert" on public.members
    for insert with check (
        entity_id in (select id from entities where owner_user_id = auth.uid())
    );

create policy "members_update" on public.members
    for update using (
        entity_id in (select id from entities where owner_user_id = auth.uid())
    );

create policy "members_delete" on public.members
    for delete using (
        entity_id in (select id from entities where owner_user_id = auth.uid())
    );

-- Subscriptions RLS
alter table public.subscriptions enable row level security;

create policy "subscriptions_select" on public.subscriptions
    for select using (auth.uid() = user_id);

create policy "subscriptions_insert" on public.subscriptions
    for insert with check (auth.uid() = user_id);

create policy "subscriptions_update" on public.subscriptions
    for update using (auth.uid() = user_id);

-- Audit Logs RLS
alter table public.audit_logs enable row level security;

create policy "audit_logs_select" on public.audit_logs
    for select using (auth.uid() = user_id);

create policy "audit_logs_insert" on public.audit_logs
    for insert with check (auth.uid() = user_id);

-- =====================================================
-- TRIGGER: Auto-create profile on signup
-- =====================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name');
    
    insert into public.user_settings (user_id)
    values (new.id);
    
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
create index idx_uploads_user_id on public.uploads(user_id);
create index idx_uploads_created_at on public.uploads(created_at desc);
create index idx_entities_owner_user_id on public.entities(owner_user_id);
create index idx_members_user_id on public.members(user_id);
create index idx_members_entity_id on public.members(entity_id);
create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
