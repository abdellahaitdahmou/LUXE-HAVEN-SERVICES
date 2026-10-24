export type OrgRole = "admin" | "property_manager";

export type PropertyType = "apartment" | "villa" | "riad" | "studio" | "other";

export type PropertyStatus = "draft" | "published" | "archived";

export type PricingMode = "fixed" | "quote";

export type PricingUnit =
  | "per_booking"
  | "per_person"
  | "per_hour"
  | "per_night"
  | "per_item";

export type RequestStatus =
  | "prepared"
  | "confirmed"
  | "declined"
  | "completed"
  | "cancelled";

export type SupportedLocale = "en" | "fr" | "ar";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  default_currency: string;
  default_timezone: string;
  default_language: SupportedLocale;
  contact_email: string | null;
  hostaway_account_id?: string | null;
  has_hostaway_api_key?: boolean;
  hostaway_last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  preferred_language: SupportedLocale;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  organization_id: string;
  hostaway_listing_id?: string | null;
  name: string;
  slug: string;
  description_en: string;
  description_fr: string;
  welcome_message_en: string;
  welcome_message_fr: string;
  property_type: PropertyType;
  city: string;
  map_url: string | null;
  photos: string[];
  features: string[];
  default_whatsapp: string;
  default_whatsapp_label: string | null;
  is_demo_contact: boolean;
  timezone: string;
  currency: string;
  status: PropertyStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyMember {
  id: string;
  property_id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  key: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  icon_name: string;
  display_order: number;
}

export interface ServiceCatalogItem {
  id: string;
  organization_id: string | null;
  is_global_template: boolean;
  category_key: string;
  name_en: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  default_image_url: string | null;
  default_pricing_mode: PricingMode;
  suggested_price: number | null;
  default_currency: string;
  default_pricing_unit: PricingUnit;
  default_min_quantity: number;
  default_max_quantity: number;
  default_advance_notice_hours: number;
  requires_time_slot: boolean;
  recommended_property_types: PropertyType[];
  recommended_features: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyServiceAvailability {
  id: string;
  property_service_id: string;
  weekday: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_available: boolean;
}

export interface PropertyServiceBlackout {
  id: string;
  property_service_id: string;
  unavailable_date: string; // YYYY-MM-DD
  reason: string;
}

export interface PropertyService {
  id: string;
  property_id: string;
  organization_id: string;
  catalog_service_id: string | null;
  category_key: string;
  name_en: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  conditions_en: string;
  conditions_fr: string;
  image_url: string | null;
  is_active: boolean;
  pricing_mode: PricingMode;
  price: number | null;
  currency: string;
  pricing_unit: PricingUnit;
  min_quantity: number;
  max_quantity: number;
  advance_notice_hours: number;
  requires_time_slot: boolean;
  display_order: number;
  whatsapp_override: string | null;
  whatsapp_override_label: string | null;
  is_demo_override_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequest {
  id: string;
  reference_code: string;
  organization_id: string;
  property_id: string;
  property_service_id: string | null;
  property_name_snapshot: string;
  service_name_snapshot: string;
  category_key_snapshot: string;
  pricing_mode_snapshot: PricingMode;
  unit_price_snapshot: number | null;
  pricing_unit_snapshot: PricingUnit;
  currency: string;
  guest_name: string;
  requested_date: string; // YYYY-MM-DD
  requested_time: string | null; // HH:mm
  quantity: number;
  estimated_total: number | null;
  guest_note: string;
  guest_locale: SupportedLocale;
  resolved_whatsapp_number: string;
  resolved_whatsapp_label: string;
  used_override_recipient: boolean;
  is_demo_recipient: boolean;
  status: RequestStatus;
  whatsapp_handoff_at: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  manager_notes: string;
  idempotency_key: string | null;
  client_fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Public Guest DTOs — Explicitly exclude default_whatsapp, whatsapp_override,
 * organization_id, and internal management metadata.
 */
export interface PublicPropertyView {
  id: string;
  name: string;
  slug: string;
  description_en: string;
  description_fr: string;
  welcome_message_en: string;
  welcome_message_fr: string;
  property_type: PropertyType;
  city: string;
  map_url: string | null;
  photos: string[];
  features: string[];
  timezone: string;
  currency: string;
  status: PropertyStatus;
}

export interface PublicPropertyServiceView {
  id: string;
  property_id: string;
  category_key: string;
  name_en: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  conditions_en: string;
  conditions_fr: string;
  image_url: string | null;
  pricing_mode: PricingMode;
  price: number | null;
  currency: string;
  pricing_unit: PricingUnit;
  min_quantity: number;
  max_quantity: number;
  advance_notice_hours: number;
  requires_time_slot: boolean;
  display_order: number;
  availability: PropertyServiceAvailability[];
  blackouts: PropertyServiceBlackout[];
}

export interface AISuggestionItem {
  id: string;
  matched_catalog_id: string | null;
  match_source: "global_template" | "org_catalog" | "new_ai_proposal";
  name_en: string;
  name_fr: string;
  category_key: string;
  description_en: string;
  description_fr: string;
  reason_en: string;
  reason_fr: string;
  default_pricing_mode: PricingMode;
  suggested_price: number | null;
  default_pricing_unit: PricingUnit;
  requires_time_slot: boolean;
  default_advance_notice_hours: number;
}

export interface AISuggestionResponse {
  provider: "ai" | "rule_based_fallback";
  fallback_reason?: string;
  property_id: string;
  suggestions: AISuggestionItem[];
}

export interface AuthenticatedActor {
  user: Profile;
  organization: Organization;
  membership: OrganizationMember;
  assignedPropertyIds: string[]; // For property_manager; Admin has access to all org properties
}
