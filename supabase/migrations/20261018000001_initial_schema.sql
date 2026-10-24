-- =============================================================================
-- StayBeldi - Full Database Schema & Row-Level Security (RLS) Migration
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- -----------------------------------------------------------------------------
-- 1. Enums & Custom Types
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE org_role AS ENUM ('admin', 'property_manager');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE property_type AS ENUM ('apartment', 'villa', 'riad', 'studio', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE property_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE pricing_mode AS ENUM ('fixed', 'quote');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE pricing_unit AS ENUM ('per_booking', 'per_person', 'per_hour', 'per_night', 'per_item');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('prepared', 'confirmed', 'declined', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Core Tables
-- -----------------------------------------------------------------------------

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug CITEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    default_currency TEXT NOT NULL DEFAULT 'MAD' CHECK (char_length(default_currency) = 3),
    default_timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'fr', 'ar')),
    contact_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email CITEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'fr', 'ar')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization Members
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'property_manager',
    invited_email CITEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

-- Properties
-- Note: default_whatsapp is stored here for server-side resolution and authorized management.
-- Public visitors access published property fields via public_properties_view or column-restricted RPCs
-- so internal host phone numbers and private metadata are never exposed to unauthenticated queries.
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug CITEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    description_en TEXT NOT NULL DEFAULT '',
    description_fr TEXT NOT NULL DEFAULT '',
    welcome_message_en TEXT NOT NULL DEFAULT '',
    welcome_message_fr TEXT NOT NULL DEFAULT '',
    property_type property_type NOT NULL DEFAULT 'apartment',
    city TEXT NOT NULL CHECK (char_length(trim(city)) >= 2),
    map_url TEXT,
    photos TEXT[] NOT NULL DEFAULT '{}',
    features TEXT[] NOT NULL DEFAULT '{}',
    default_whatsapp TEXT NOT NULL CHECK (default_whatsapp ~ '^\+?[1-9][0-9]{7,14}$'),
    default_whatsapp_label TEXT DEFAULT 'Primary Host',
    is_demo_contact BOOLEAN NOT NULL DEFAULT false,
    timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    currency TEXT NOT NULL DEFAULT 'MAD' CHECK (char_length(currency) = 3),
    status property_status NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Property Members (Assigns property managers to specific properties)
CREATE TABLE IF NOT EXISTS public.property_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_id, user_id)
);

-- Service Categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'),
    name_en TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    name_ar TEXT DEFAULT '',
    icon_name TEXT NOT NULL DEFAULT 'Sparkles',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Catalog (Global starter templates + Organization-owned custom services)
CREATE TABLE IF NOT EXISTS public.service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL organization_id indicates a global starter template;
    -- Non-null organization_id isolates custom services to that specific organization.
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    is_global_template BOOLEAN NOT NULL DEFAULT false,
    category_key TEXT NOT NULL REFERENCES public.service_categories(key) ON DELETE RESTRICT,
    name_en TEXT NOT NULL CHECK (char_length(trim(name_en)) >= 2),
    name_fr TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    description_fr TEXT NOT NULL DEFAULT '',
    default_image_url TEXT,
    default_pricing_mode pricing_mode NOT NULL DEFAULT 'fixed',
    suggested_price NUMERIC(10, 2) CHECK (suggested_price IS NULL OR suggested_price >= 0),
    default_currency TEXT NOT NULL DEFAULT 'MAD',
    default_pricing_unit pricing_unit NOT NULL DEFAULT 'per_booking',
    default_min_quantity INT NOT NULL DEFAULT 1 CHECK (default_min_quantity >= 1),
    default_max_quantity INT NOT NULL DEFAULT 10 CHECK (default_max_quantity >= default_min_quantity),
    default_advance_notice_hours INT NOT NULL DEFAULT 12 CHECK (default_advance_notice_hours >= 0),
    requires_time_slot BOOLEAN NOT NULL DEFAULT true,
    recommended_property_types property_type[] NOT NULL DEFAULT '{apartment,villa,riad,studio,other}',
    recommended_features TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT global_template_org_check CHECK (
        (is_global_template = true AND organization_id IS NULL) OR
        (is_global_template = false AND organization_id IS NOT NULL)
    )
);

-- Property Services (Property-specific copy & configuration of a service)
CREATE TABLE IF NOT EXISTS public.property_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    catalog_service_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
    category_key TEXT NOT NULL REFERENCES public.service_categories(key) ON DELETE RESTRICT,
    name_en TEXT NOT NULL CHECK (char_length(trim(name_en)) >= 2),
    name_fr TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    description_fr TEXT NOT NULL DEFAULT '',
    conditions_en TEXT NOT NULL DEFAULT '',
    conditions_fr TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    pricing_mode pricing_mode NOT NULL DEFAULT 'fixed',
    price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
    currency TEXT NOT NULL DEFAULT 'MAD' CHECK (char_length(currency) = 3),
    pricing_unit pricing_unit NOT NULL DEFAULT 'per_booking',
    min_quantity INT NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
    max_quantity INT NOT NULL DEFAULT 10 CHECK (max_quantity >= min_quantity),
    advance_notice_hours INT NOT NULL DEFAULT 12 CHECK (advance_notice_hours >= 0),
    requires_time_slot BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    -- Optional WhatsApp override for this specific service on this property
    whatsapp_override TEXT CHECK (whatsapp_override IS NULL OR whatsapp_override ~ '^\+?[1-9][0-9]{7,14}$'),
    whatsapp_override_label TEXT,
    is_demo_override_contact BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Ensure fixed-price active services have a valid price set
    CONSTRAINT valid_active_fixed_price CHECK (
        is_active = false OR pricing_mode = 'quote' OR (pricing_mode = 'fixed' AND price IS NOT NULL AND price >= 0)
    )
);

-- Property Service Availability (Weekdays and local time windows)
CREATE TABLE IF NOT EXISTS public.property_service_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_service_id UUID NOT NULL REFERENCES public.property_services(id) ON DELETE CASCADE,
    -- ISO weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME NOT NULL DEFAULT '08:00',
    end_time TIME NOT NULL DEFAULT '20:00',
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_window CHECK (end_time > start_time),
    UNIQUE (property_service_id, weekday, start_time, end_time)
);

-- Property Service Blackouts (Unavailable specific dates or ranges)
CREATE TABLE IF NOT EXISTS public.property_service_blackouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_service_id UUID NOT NULL REFERENCES public.property_services(id) ON DELETE CASCADE,
    unavailable_date DATE NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_service_id, unavailable_date)
);

-- Service Requests (Saved before WhatsApp handoff)
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code TEXT NOT NULL UNIQUE CHECK (reference_code ~ '^SB-[A-Z0-9]{6,10}$'),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    property_service_id UUID REFERENCES public.property_services(id) ON DELETE SET NULL,
    -- Snapshots at time of request
    property_name_snapshot TEXT NOT NULL,
    service_name_snapshot TEXT NOT NULL,
    category_key_snapshot TEXT NOT NULL,
    pricing_mode_snapshot pricing_mode NOT NULL,
    unit_price_snapshot NUMERIC(10, 2),
    pricing_unit_snapshot pricing_unit NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MAD',
    -- Guest input
    guest_name TEXT NOT NULL CHECK (char_length(trim(guest_name)) >= 2),
    requested_date DATE NOT NULL,
    requested_time TEXT,
    quantity INT NOT NULL CHECK (quantity >= 1),
    estimated_total NUMERIC(10, 2),
    guest_note TEXT DEFAULT '',
    guest_locale TEXT NOT NULL DEFAULT 'en',
    -- Routing & Status
    resolved_whatsapp_number TEXT NOT NULL,
    resolved_whatsapp_label TEXT DEFAULT '',
    used_override_recipient BOOLEAN NOT NULL DEFAULT false,
    is_demo_recipient BOOLEAN NOT NULL DEFAULT false,
    status request_status NOT NULL DEFAULT 'prepared',
    whatsapp_handoff_at TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ,
    status_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    manager_notes TEXT DEFAULT '',
    idempotency_key TEXT UNIQUE,
    client_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_members_org_user ON public.organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON public.properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON public.properties(slug);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_property_members_user ON public.property_members(user_id, property_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_org ON public.service_catalog(organization_id, category_key);
CREATE INDEX IF NOT EXISTS idx_property_services_prop ON public.property_services(property_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_service_avail_prop_service ON public.property_service_availability(property_service_id, weekday);
CREATE INDEX IF NOT EXISTS idx_service_blackouts_prop_service ON public.property_service_blackouts(property_service_id, unavailable_date);
CREATE INDEX IF NOT EXISTS idx_service_requests_org_status ON public.service_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_property ON public.service_requests(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_reference ON public.service_requests(reference_code);

-- -----------------------------------------------------------------------------
-- 4. Updated_at Trigger Function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_org_members_updated_at ON public.organization_members;
CREATE TRIGGER set_org_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_properties_updated_at ON public.properties;
CREATE TRIGGER set_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_service_catalog_updated_at ON public.service_catalog;
CREATE TRIGGER set_service_catalog_updated_at BEFORE UPDATE ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_property_services_updated_at ON public.property_services;
CREATE TRIGGER set_property_services_updated_at BEFORE UPDATE ON public.property_services FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_service_requests_updated_at ON public.service_requests;
CREATE TRIGGER set_service_requests_updated_at BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Security Helper Functions for Row-Level Security (RLS)
-- -----------------------------------------------------------------------------

-- Check if current authenticated user is an active member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = target_org_id
          AND om.user_id = auth.uid()
          AND om.is_active = true
    );
$$;

-- Check if current authenticated user is an active admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = target_org_id
          AND om.user_id = auth.uid()
          AND om.role = 'admin'
          AND om.is_active = true
    );
$$;

-- Check if current authenticated user can manage a specific property
-- (Either Organization Admin OR assigned Property Manager for that property)
CREATE OR REPLACE FUNCTION public.can_manage_property(target_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.properties p
        JOIN public.organization_members om
          ON om.organization_id = p.organization_id
        LEFT JOIN public.property_members pm
          ON pm.property_id = p.id AND pm.user_id = auth.uid()
        WHERE p.id = target_property_id
          AND om.user_id = auth.uid()
          AND om.is_active = true
          AND (om.role = 'admin' OR pm.id IS NOT NULL)
    );
$$;

-- -----------------------------------------------------------------------------
-- 6. Enable RLS & Define Policies
-- -----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_service_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_service_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Organizations Policies
CREATE POLICY "Org members can view their organizations"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (public.is_org_member(id));

CREATE POLICY "Org admins can update their organizations"
    ON public.organizations FOR UPDATE
    TO authenticated
    USING (public.is_org_admin(id))
    WITH CHECK (public.is_org_admin(id));

-- Profiles Policies
CREATE POLICY "Users can view profiles in their organizations or own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om1
            JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = public.profiles.id
        )
    );

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Organization Members Policies
CREATE POLICY "Org members can view organization memberships"
    ON public.organization_members FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Org admins can manage organization memberships"
    ON public.organization_members FOR ALL
    TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- Properties Policies
-- Note: Direct SELECT on public.properties is restricted to authorized org admins and assigned property managers
-- so that default_whatsapp and internal fields are NEVER exposed via direct anon table queries.
-- Public guest pages use the safe `public_properties_view` / RPC defined below.
CREATE POLICY "Authorized managers and admins can view properties"
    ON public.properties FOR SELECT
    TO authenticated
    USING (public.can_manage_property(id));

CREATE POLICY "Org admins can create properties"
    ON public.properties FOR INSERT
    TO authenticated
    WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Authorized managers and admins can update properties"
    ON public.properties FOR UPDATE
    TO authenticated
    USING (public.can_manage_property(id))
    WITH CHECK (public.can_manage_property(id));

CREATE POLICY "Org admins can delete properties"
    ON public.properties FOR DELETE
    TO authenticated
    USING (public.is_org_admin(organization_id));

-- Property Members Policies
CREATE POLICY "Org members can view property assignments"
    ON public.property_members FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Org admins can manage property assignments"
    ON public.property_members FOR ALL
    TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- Service Categories Policies (Publicly readable reference table)
CREATE POLICY "Anyone can view service categories"
    ON public.service_categories FOR SELECT
    TO anon, authenticated
    USING (true);

-- Service Catalog Policies
-- Global templates are readable by authenticated users; custom catalog items are strictly isolated to their organization.
CREATE POLICY "Org members can view global templates and own org catalog"
    ON public.service_catalog FOR SELECT
    TO authenticated
    USING (
        is_global_template = true OR
        (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    );

CREATE POLICY "Org members can create custom catalog services for their org"
    ON public.service_catalog FOR INSERT
    TO authenticated
    WITH CHECK (
        is_global_template = false AND
        organization_id IS NOT NULL AND
        public.is_org_member(organization_id)
    );

CREATE POLICY "Org members can update custom catalog services in their org"
    ON public.service_catalog FOR UPDATE
    TO authenticated
    USING (
        is_global_template = false AND
        organization_id IS NOT NULL AND
        public.is_org_member(organization_id)
    )
    WITH CHECK (
        is_global_template = false AND
        organization_id IS NOT NULL AND
        public.is_org_member(organization_id)
    );

CREATE POLICY "Org admins can delete custom catalog services in their org"
    ON public.service_catalog FOR DELETE
    TO authenticated
    USING (
        is_global_template = false AND
        organization_id IS NOT NULL AND
        public.is_org_admin(organization_id)
    );

-- Property Services Policies
-- Direct table access requires property management permissions (protects whatsapp_override).
CREATE POLICY "Authorized managers can view property services"
    ON public.property_services FOR SELECT
    TO authenticated
    USING (public.can_manage_property(property_id));

CREATE POLICY "Authorized managers can insert property services"
    ON public.property_services FOR INSERT
    TO authenticated
    WITH CHECK (public.can_manage_property(property_id));

CREATE POLICY "Authorized managers can update property services"
    ON public.property_services FOR UPDATE
    TO authenticated
    USING (public.can_manage_property(property_id))
    WITH CHECK (public.can_manage_property(property_id));

CREATE POLICY "Authorized managers can delete property services"
    ON public.property_services FOR DELETE
    TO authenticated
    USING (public.can_manage_property(property_id));

-- Property Service Availability Policies
CREATE POLICY "Public can view availability for active services on published properties"
    ON public.property_service_availability FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            JOIN public.properties p ON p.id = ps.property_id
            WHERE ps.id = property_service_id
              AND (
                  (ps.is_active = true AND p.status = 'published')
                  OR public.can_manage_property(p.id)
              )
        )
    );

CREATE POLICY "Authorized managers can manage service availability"
    ON public.property_service_availability FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            WHERE ps.id = property_service_id
              AND public.can_manage_property(ps.property_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            WHERE ps.id = property_service_id
              AND public.can_manage_property(ps.property_id)
        )
    );

-- Property Service Blackouts Policies
CREATE POLICY "Public can view blackouts for active services on published properties"
    ON public.property_service_blackouts FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            JOIN public.properties p ON p.id = ps.property_id
            WHERE ps.id = property_service_id
              AND (
                  (ps.is_active = true AND p.status = 'published')
                  OR public.can_manage_property(p.id)
              )
        )
    );

CREATE POLICY "Authorized managers can manage service blackouts"
    ON public.property_service_blackouts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            WHERE ps.id = property_service_id
              AND public.can_manage_property(ps.property_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.property_services ps
            WHERE ps.id = property_service_id
              AND public.can_manage_property(ps.property_id)
        )
    );

-- Service Requests Policies
-- Public users CANNOT list or read service_requests at all!
CREATE POLICY "Authorized managers can view requests for their properties"
    ON public.service_requests FOR SELECT
    TO authenticated
    USING (public.can_manage_property(property_id));

CREATE POLICY "Authorized managers can update request statuses for their properties"
    ON public.service_requests FOR UPDATE
    TO authenticated
    USING (public.can_manage_property(property_id))
    WITH CHECK (public.can_manage_property(property_id));

-- -----------------------------------------------------------------------------
-- 7. Safe Public Read Views (Excludes WhatsApp numbers & internal metadata)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_properties_view AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.description_en,
    p.description_fr,
    p.welcome_message_en,
    p.welcome_message_fr,
    p.property_type,
    p.city,
    p.map_url,
    p.photos,
    p.features,
    p.timezone,
    p.currency,
    p.status
FROM public.properties p
WHERE p.status = 'published';

GRANT SELECT ON public.public_properties_view TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_property_services_view AS
SELECT
    ps.id,
    ps.property_id,
    ps.category_key,
    ps.name_en,
    ps.name_fr,
    ps.description_en,
    ps.description_fr,
    ps.conditions_en,
    ps.conditions_fr,
    ps.image_url,
    ps.pricing_mode,
    ps.price,
    ps.currency,
    ps.pricing_unit,
    ps.min_quantity,
    ps.max_quantity,
    ps.advance_notice_hours,
    ps.requires_time_slot,
    ps.display_order
FROM public.property_services ps
JOIN public.properties p ON p.id = ps.property_id
WHERE p.status = 'published'
  AND ps.is_active = true;

GRANT SELECT ON public.public_property_services_view TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Supabase Storage Bucket & Policies for Property/Service Images
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'staybeldi-media',
    'staybeldi-media',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view public media images
CREATE POLICY "Public read access for staybeldi media"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'staybeldi-media');

-- Only authenticated organization members can upload images inside their organization folder:
-- Path convention: {organization_id}/{property_or_service_folder}/{filename}
CREATE POLICY "Authenticated org members can upload media to own org folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'staybeldi-media'
        AND (storage.foldername(name))[1] IS NOT NULL
        AND public.is_org_member(((storage.foldername(name))[1])::uuid)
    );

CREATE POLICY "Authenticated org members can update own org media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'staybeldi-media'
        AND (storage.foldername(name))[1] IS NOT NULL
        AND public.is_org_member(((storage.foldername(name))[1])::uuid)
    );

CREATE POLICY "Authenticated org admins can delete own org media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'staybeldi-media'
        AND (storage.foldername(name))[1] IS NOT NULL
        AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
    );
