-- =============================================================================
-- StayBeldi - Hostaway PMS Integration Columns
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS hostaway_listing_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS properties_org_hostaway_listing_id_key
  ON public.properties (organization_id, hostaway_listing_id)
  WHERE hostaway_listing_id IS NOT NULL;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS hostaway_account_id TEXT,
  ADD COLUMN IF NOT EXISTS hostaway_api_key TEXT,
  ADD COLUMN IF NOT EXISTS hostaway_last_synced_at TIMESTAMPTZ;
