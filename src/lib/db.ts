import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "./supabase/server";
import {
  AuthenticatedActor,
  Organization,
  OrganizationMember,
  Profile,
  Property,
  PropertyMember,
  PropertyService,
  PropertyServiceAvailability,
  PropertyServiceBlackout,
  PublicPropertyServiceView,
  PublicPropertyView,
  RequestStatus,
  ServiceCatalogItem,
  ServiceCategory,
  ServiceRequest,
} from "./types";
import {
  CustomCatalogServiceSchema,
  findPotentialDuplicateCatalogServices,
  GuestServiceRequestInputSchema,
  PropertyInputSchema,
  PropertyServiceUpdateSchema,
  validateServiceScheduleAndCalculateTotal,
} from "./validation";
import {
  buildWhatsAppRequestMessage,
  isDemoPlaceholderPhone,
  normalizePhoneNumber,
  resolveWhatsAppRecipient,
} from "./whatsapp";
import { fetchHostawayListings } from "./hostaway";

// Simple in-memory rate limiter for public guest requests (per IP / fingerprint)
const guestRequestRateMap = new Map<string, number[]>();

function checkRateLimit(fingerprint: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (guestRequestRateMap.get(fingerprint) || []).filter(
    (t) => t > windowStart
  );
  if (timestamps.length >= maxPerMinute) {
    guestRequestRateMap.set(fingerprint, timestamps);
    return false;
  }
  timestamps.push(now);
  guestRequestRateMap.set(fingerprint, timestamps);
  return true;
}

// ---------------------------------------------------------------------------
// Supabase (PostgreSQL) access helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface DbResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
}

const UNIQUE_VIOLATION = "23505";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * All data access goes through the Supabase service-role client. Authorization
 * is enforced in this module (actor / organization / property checks) before
 * any query runs, and public guest queries project only safe fields.
 */
function sb(): SupabaseClient {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return client;
}

function unwrap<T>(res: DbResult<T>, context: string): T {
  if (res.error) {
    throw new Error(`Database error (${context}): ${res.error.message}`);
  }
  return res.data;
}

const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const toHHmm = (value: unknown): string => String(value ?? "").slice(0, 5);

function mapAvailability(row: Row): PropertyServiceAvailability {
  return {
    id: row.id as string,
    property_service_id: row.property_service_id as string,
    weekday: Number(row.weekday),
    start_time: toHHmm(row.start_time),
    end_time: toHHmm(row.end_time),
    is_available: Boolean(row.is_available),
  };
}

function mapBlackout(row: Row): PropertyServiceBlackout {
  return {
    id: row.id as string,
    property_service_id: row.property_service_id as string,
    unavailable_date: String(row.unavailable_date),
    reason: (row.reason as string) || "",
  };
}

function mapPropertyService(row: Row): PropertyService {
  return { ...row, price: toNumberOrNull(row.price) } as unknown as PropertyService;
}

function mapCatalogItem(row: Row): ServiceCatalogItem {
  return {
    ...row,
    suggested_price: toNumberOrNull(row.suggested_price),
  } as unknown as ServiceCatalogItem;
}

function mapServiceRequest(row: Row): ServiceRequest {
  return {
    ...row,
    unit_price_snapshot: toNumberOrNull(row.unit_price_snapshot),
    estimated_total: toNumberOrNull(row.estimated_total),
    guest_note: (row.guest_note as string) || "",
    manager_notes: (row.manager_notes as string) || "",
    resolved_whatsapp_label: (row.resolved_whatsapp_label as string) || "",
  } as unknown as ServiceRequest;
}

async function fetchPropertyById(id: string): Promise<Property | null> {
  if (!isUuid(id)) return null;
  const data = unwrap(
    await sb().from("properties").select("*").eq("id", id).maybeSingle(),
    "load property"
  );
  return (data as Property | null) ?? null;
}

async function fetchPropertyServiceById(
  id: string
): Promise<PropertyService | null> {
  if (!isUuid(id)) return null;
  const data = unwrap(
    await sb().from("property_services").select("*").eq("id", id).maybeSingle(),
    "load property service"
  );
  return data ? mapPropertyService(data as Row) : null;
}

async function fetchAvailabilityAndBlackouts(serviceIds: string[]) {
  if (serviceIds.length === 0) {
    return {
      availability: [] as PropertyServiceAvailability[],
      blackouts: [] as PropertyServiceBlackout[],
    };
  }
  const [availRes, blackoutRes] = await Promise.all([
    sb()
      .from("property_service_availability")
      .select("*")
      .in("property_service_id", serviceIds)
      .order("weekday", { ascending: true }),
    sb()
      .from("property_service_blackouts")
      .select("*")
      .in("property_service_id", serviceIds)
      .order("unavailable_date", { ascending: true }),
  ]);
  return {
    availability: (unwrap(availRes, "load availability") as Row[]).map(
      mapAvailability
    ),
    blackouts: (unwrap(blackoutRes, "load blackouts") as Row[]).map(
      mapBlackout
    ),
  };
}

async function fetchCategories(): Promise<ServiceCategory[]> {
  const data = unwrap(
    await sb()
      .from("service_categories")
      .select("*")
      .order("display_order", { ascending: true }),
    "load categories"
  );
  return data as ServiceCategory[];
}

/** Global starter templates + THIS organization's custom services ONLY. */
async function fetchVisibleCatalog(
  organizationId: string
): Promise<ServiceCatalogItem[]> {
  const data = unwrap(
    await sb()
      .from("service_catalog")
      .select("*")
      .or(`is_global_template.eq.true,organization_id.eq.${organizationId}`)
      .order("created_at", { ascending: true }),
    "load catalogue"
  );
  return (data as Row[]).map(mapCatalogItem);
}

function defaultAvailabilityRows(propertyServiceId: string) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    property_service_id: propertyServiceId,
    weekday,
    start_time: "08:00",
    end_time: "20:00",
    is_available: true,
  }));
}

function generateReferenceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let referenceCode = "SB-";
  for (let i = 0; i < 6; i++) {
    referenceCode += chars.charAt(crypto.randomInt(chars.length));
  }
  return referenceCode;
}

// ---------------------------------------------------------------------------
// Authentication & authorization
// ---------------------------------------------------------------------------

/**
 * Resolves the currently authenticated user (Supabase Auth session cookie),
 * their active organization, role, and assigned property IDs.
 * Returns null when nobody is signed in or the account is not linked to an
 * active organization membership.
 */
export async function getCurrentActor(): Promise<AuthenticatedActor | null> {
  let userId: string | undefined;
  try {
    const authClient = await createSupabaseServerClient();
    if (!authClient) return null;
    const { data } = await authClient.auth.getUser();
    userId = data?.user?.id;
  } catch {
    return null;
  }
  if (!userId) return null;

  const client = sb();

  const profile = unwrap(
    await client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    "load profile"
  ) as Profile | null;
  if (!profile) return null;

  const membershipRows = unwrap(
    await client
      .from("organization_members")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1),
    "load membership"
  ) as OrganizationMember[];
  const membership = membershipRows[0];
  if (!membership) return null;

  const orgRow = unwrap(
    await client
      .from("organizations")
      .select("*")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    "load organization"
  ) as Row | null;
  if (!orgRow) return null;
  const organization = mapOrganization(orgRow);

  let assignedPropertyIds: string[];
  if (membership.role === "admin") {
    const props = unwrap(
      await client
        .from("properties")
        .select("id")
        .eq("organization_id", organization.id),
      "load organization properties"
    ) as { id: string }[];
    assignedPropertyIds = props.map((p) => p.id);
  } else {
    const assigned = unwrap(
      await client
        .from("property_members")
        .select("property_id")
        .eq("organization_id", organization.id)
        .eq("user_id", userId),
      "load property assignments"
    ) as { property_id: string }[];
    assignedPropertyIds = assigned.map((pm) => pm.property_id);
  }

  return { user: profile, organization, membership, assignedPropertyIds };
}

/**
 * Server-side permission check: can this actor manage the given property?
 */
export function canActorManageProperty(
  actor: AuthenticatedActor,
  property: Pick<Property, "id" | "organization_id">
): boolean {
  if (property.organization_id !== actor.organization.id) {
    return false;
  }
  if (actor.membership.role === "admin") {
    return true;
  }
  return actor.assignedPropertyIds.includes(property.id);
}

export function assertCanManageProperty(
  actor: AuthenticatedActor | null,
  property: Pick<Property, "id" | "organization_id"> | undefined | null
): asserts actor is AuthenticatedActor {
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (!property) {
    throw new Error("Not Found: Property does not exist.");
  }
  if (!canActorManageProperty(actor, property)) {
    throw new Error(
      "Forbidden: You do not have permission to access or modify this property."
    );
  }
}

export function assertOrgAdmin(
  actor: AuthenticatedActor | null
): asserts actor is AuthenticatedActor {
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (actor.membership.role !== "admin") {
    throw new Error(
      "Forbidden: Only organization administrators can perform this action."
    );
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Returns dashboard data scoped strictly to the actor's organization and property assignments.
 */
export async function getDashboardData() {
  const actor = await getCurrentActor();
  if (!actor) {
    return null;
  }

  const client = sb();
  const orgId = actor.organization.id;

  const orgProperties = unwrap(
    await client
      .from("properties")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    "load properties"
  ) as Property[];

  // Filter properties by organization AND role/assignment
  const accessibleProperties = orgProperties.filter((p) =>
    canActorManageProperty(actor, p)
  );
  const accessiblePropertyIds = accessibleProperties.map((p) => p.id);

  const [
    categories,
    catalogServices,
    serviceRows,
    requestRows,
    memberRows,
    propertyMemberRows,
  ] = await Promise.all([
    fetchCategories(),
    fetchVisibleCatalog(orgId),
    accessiblePropertyIds.length
      ? client
          .from("property_services")
          .select("*")
          .in("property_id", accessiblePropertyIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] as Row[], error: null }),
    accessiblePropertyIds.length
      ? client
          .from("service_requests")
          .select("*")
          .in("property_id", accessiblePropertyIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Row[], error: null }),
    client
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    client.from("property_members").select("*").eq("organization_id", orgId),
  ]);

  const propertyServices = (
    unwrap(serviceRows as DbResult<Row[]>, "load property services") as Row[]
  ).map(mapPropertyService);
  const requests = (
    unwrap(requestRows as DbResult<Row[]>, "load service requests") as Row[]
  ).map(mapServiceRequest);
  const members = unwrap(
    memberRows as DbResult<OrganizationMember[]>,
    "load team members"
  ) as OrganizationMember[];
  const propertyMembers = unwrap(
    propertyMemberRows as DbResult<PropertyMember[]>,
    "load team assignments"
  ) as PropertyMember[];

  const { availability, blackouts } = await fetchAvailabilityAndBlackouts(
    propertyServices.map((ps) => ps.id)
  );

  const memberUserIds = members.map((m) => m.user_id);
  const profiles = memberUserIds.length
    ? (unwrap(
        await client.from("profiles").select("*").in("id", memberUserIds),
        "load team profiles"
      ) as Profile[])
    : [];

  // Team members in this organization
  const orgMembers = members.map((m) => {
    const profile = profiles.find((p) => p.id === m.user_id);
    const assignedIds = propertyMembers
      .filter((pm) => pm.user_id === m.user_id)
      .map((pm) => pm.property_id);
    return {
      ...m,
      profile: profile || {
        id: m.user_id,
        email: m.invited_email || "unknown@staybeldi.ma",
        full_name: m.invited_email || "Invited Member",
        avatar_url: null,
        preferred_language: "en" as const,
        created_at: m.created_at,
        updated_at: m.updated_at,
      },
      assignedPropertyIds: assignedIds,
    };
  });

  // Compute real overview metrics
  const publishedIds = new Set(
    accessibleProperties.filter((p) => p.status === "published").map((p) => p.id)
  );
  const activePropertiesCount = publishedIds.size;
  const activePropertyServicesCount = propertyServices.filter(
    (ps) => ps.is_active && publishedIds.has(ps.property_id)
  ).length;
  const requestsPreparedCount = requests.filter(
    (r) => r.status === "prepared"
  ).length;
  const confirmedRequests = requests.filter(
    (r) => r.status === "confirmed" || r.status === "completed"
  );
  const confirmedRequestsCount = confirmedRequests.length;
  const estimatedConfirmedValue = confirmedRequests.reduce(
    (sum, r) => sum + (Number(r.estimated_total) || 0),
    0
  );

  return {
    actor,
    categories,
    properties: accessibleProperties,
    allOrgPropertiesCount: orgProperties.length,
    propertyServices,
    availability,
    blackouts,
    catalogServices,
    requests,
    orgMembers,
    metrics: {
      activePropertiesCount,
      activePropertyServicesCount,
      requestsPreparedCount,
      confirmedRequestsCount,
      estimatedConfirmedValue,
      currency: actor.organization.default_currency || "MAD",
    },
  };
}

/**
 * Retrieves a single property and its attached services for authorized management.
 * Enforces property-specific manager permissions on the server.
 */
export async function getAuthorizedPropertyDetail(propertyId: string) {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  const property = await fetchPropertyById(propertyId);
  if (!property) {
    throw new Error("Not Found: Property does not exist.");
  }

  assertCanManageProperty(actor, property);

  const client = sb();
  const serviceRows = unwrap(
    await client
      .from("property_services")
      .select("*")
      .eq("property_id", property.id)
      .order("display_order", { ascending: true }),
    "load property services"
  ) as Row[];
  const propertyServices = serviceRows.map(mapPropertyService);

  const { availability, blackouts } = await fetchAvailabilityAndBlackouts(
    propertyServices.map((ps) => ps.id)
  );

  const services = propertyServices.map((ps) => ({
    ...ps,
    effectiveRecipient: resolveWhatsAppRecipient(property, ps),
    availability: availability
      .filter((a) => a.property_service_id === ps.id)
      .sort((a, b) => a.weekday - b.weekday),
    blackouts: blackouts
      .filter((b) => b.property_service_id === ps.id)
      .sort((a, b) => a.unavailable_date.localeCompare(b.unavailable_date)),
  }));

  const [catalogServices, categories, requestRows] = await Promise.all([
    fetchVisibleCatalog(actor.organization.id),
    fetchCategories(),
    client
      .from("service_requests")
      .select("*")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false }),
  ]);

  const requests = (
    unwrap(requestRows as DbResult<Row[]>, "load service requests") as Row[]
  ).map(mapServiceRequest);

  return {
    actor,
    property,
    services,
    catalogServices,
    categories,
    requests,
  };
}

/**
 * Public Guest Query: Returns published properties (safe public fields only)
 * for the landing page showcase.
 */
export async function getPublishedPropertiesPreview(
  limit = 6
): Promise<PublicPropertyView[]> {
  const rows = unwrap(
    await sb()
      .from("properties")
      .select(
        "id, name, slug, description_en, description_fr, welcome_message_en, welcome_message_fr, property_type, city, map_url, photos, features, timezone, currency, status"
      )
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(limit),
    "load published properties preview"
  ) as PublicPropertyView[];
  return rows;
}

/**
 * Public Guest Query: Returns ONLY published property information and active public service fields.
 * Strips all WhatsApp phone numbers (`default_whatsapp`, `whatsapp_override`), `organization_id`,
 * and internal fields from the returned payload.
 */
export async function getPublicPropertyBySlug(slug: string): Promise<{
  property: PublicPropertyView;
  services: PublicPropertyServiceView[];
  categories: ServiceCategory[];
} | null> {
  const cleanSlug = slug.trim().toLowerCase();
  const client = sb();

  const property = unwrap(
    await client
      .from("properties")
      .select("*")
      .eq("slug", cleanSlug)
      .eq("status", "published")
      .maybeSingle(),
    "load public property"
  ) as Property | null;

  if (!property) {
    return null;
  }

  // Strictly project only safe public fields (no default_whatsapp, no organization_id)
  const publicProperty: PublicPropertyView = {
    id: property.id,
    name: property.name,
    slug: property.slug,
    description_en: property.description_en,
    description_fr: property.description_fr,
    welcome_message_en: property.welcome_message_en,
    welcome_message_fr: property.welcome_message_fr,
    property_type: property.property_type,
    city: property.city,
    map_url: property.map_url,
    photos: property.photos,
    features: property.features,
    timezone: property.timezone,
    currency: property.currency,
    status: property.status,
  };

  const activeServices = (
    unwrap(
      await client
        .from("property_services")
        .select("*")
        .eq("property_id", property.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      "load public services"
    ) as Row[]
  ).map(mapPropertyService);

  const { availability, blackouts } = await fetchAvailabilityAndBlackouts(
    activeServices.map((ps) => ps.id)
  );

  // Project only safe public service fields (no whatsapp_override, no organization_id)
  const publicServices: PublicPropertyServiceView[] = activeServices.map(
    (ps) => ({
      id: ps.id,
      property_id: ps.property_id,
      category_key: ps.category_key,
      name_en: ps.name_en,
      name_fr: ps.name_fr,
      description_en: ps.description_en,
      description_fr: ps.description_fr,
      conditions_en: ps.conditions_en,
      conditions_fr: ps.conditions_fr,
      image_url: ps.image_url,
      pricing_mode: ps.pricing_mode,
      price: ps.price,
      currency: ps.currency,
      pricing_unit: ps.pricing_unit,
      min_quantity: ps.min_quantity,
      max_quantity: ps.max_quantity,
      advance_notice_hours: ps.advance_notice_hours,
      requires_time_slot: ps.requires_time_slot,
      display_order: ps.display_order,
      availability: availability
        .filter((a) => a.property_service_id === ps.id)
        .sort((a, b) => a.weekday - b.weekday),
      blackouts: blackouts
        .filter((b) => b.property_service_id === ps.id)
        .sort((a, b) => a.unavailable_date.localeCompare(b.unavailable_date)),
    })
  );

  return {
    property: publicProperty,
    services: publicServices,
    categories: await fetchCategories(),
  };
}

// ---------------------------------------------------------------------------
// Property writes
// ---------------------------------------------------------------------------

/**
 * Creates a new property in the actor's organization.
 */
export async function createPropertyRecord(
  rawInput: unknown
): Promise<Property> {
  const actor = await getCurrentActor();
  assertOrgAdmin(actor);

  const parsed = PropertyInputSchema.parse(rawInput);
  const client = sb();

  const existingSlug = unwrap(
    await client
      .from("properties")
      .select("id")
      .eq("slug", parsed.slug.toLowerCase())
      .limit(1),
    "check property slug"
  ) as { id: string }[];
  if (existingSlug.length > 0) {
    throw new Error(
      `A property with the public slug "${parsed.slug}" already exists. Please choose a unique slug.`
    );
  }

  const normalizedPhone = normalizePhoneNumber(parsed.default_whatsapp);
  if (!normalizedPhone.isValid) {
    throw new Error(normalizedPhone.error || "Invalid default WhatsApp number.");
  }

  const now = new Date().toISOString();
  const res = await client
    .from("properties")
    .insert({
      organization_id: actor.organization.id,
      name: parsed.name,
      slug: parsed.slug.toLowerCase(),
      description_en: parsed.description_en,
      description_fr: parsed.description_fr,
      welcome_message_en:
        parsed.welcome_message_en ||
        `Welcome to ${parsed.name}! Browse our curated extra services below and request any item via WhatsApp.`,
      welcome_message_fr:
        parsed.welcome_message_fr ||
        `Bienvenue à ${parsed.name} ! Découvrez nos prestations à la carte ci-dessous et réservez sur WhatsApp.`,
      property_type: parsed.property_type,
      city: parsed.city,
      map_url: parsed.map_url || null,
      photos:
        parsed.photos.length > 0
          ? parsed.photos
          : [
              "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
            ],
      features: parsed.features,
      default_whatsapp: normalizedPhone.e164,
      default_whatsapp_label: parsed.default_whatsapp_label || "Primary Host",
      is_demo_contact:
        Boolean(parsed.is_demo_contact) ||
        isDemoPlaceholderPhone(normalizedPhone.e164),
      timezone: parsed.timezone || "Africa/Casablanca",
      currency: parsed.currency || "MAD",
      status: parsed.status,
      created_by: actor.user.id,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (res.error?.code === UNIQUE_VIOLATION) {
    throw new Error(
      `A property with the public slug "${parsed.slug}" already exists. Please choose a unique slug.`
    );
  }
  return unwrap(res, "create property") as Property;
}

/**
 * Updates an existing property (enforces property-level authorization).
 */
export async function updatePropertyRecord(
  propertyId: string,
  rawInput: unknown
): Promise<Property> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  const existing = await fetchPropertyById(propertyId);
  if (!existing) {
    throw new Error("Not Found: Property does not exist.");
  }

  assertCanManageProperty(actor, existing);

  const parsed = PropertyInputSchema.parse(rawInput);
  const client = sb();

  const slugCollision = unwrap(
    await client
      .from("properties")
      .select("id")
      .eq("slug", parsed.slug.toLowerCase())
      .neq("id", propertyId)
      .limit(1),
    "check property slug"
  ) as { id: string }[];
  if (slugCollision.length > 0) {
    throw new Error(
      `Another property is already using the slug "${parsed.slug}".`
    );
  }

  const normalizedPhone = normalizePhoneNumber(parsed.default_whatsapp);
  if (!normalizedPhone.isValid) {
    throw new Error(normalizedPhone.error || "Invalid default WhatsApp number.");
  }

  const res = await client
    .from("properties")
    .update({
      name: parsed.name,
      slug: parsed.slug.toLowerCase(),
      description_en: parsed.description_en,
      description_fr: parsed.description_fr,
      welcome_message_en: parsed.welcome_message_en,
      welcome_message_fr: parsed.welcome_message_fr,
      property_type: parsed.property_type,
      city: parsed.city,
      map_url: parsed.map_url || null,
      photos: parsed.photos.length > 0 ? parsed.photos : existing.photos,
      features: parsed.features,
      default_whatsapp: normalizedPhone.e164,
      default_whatsapp_label:
        parsed.default_whatsapp_label || existing.default_whatsapp_label,
      is_demo_contact:
        Boolean(parsed.is_demo_contact) ||
        isDemoPlaceholderPhone(normalizedPhone.e164),
      timezone: parsed.timezone || "Africa/Casablanca",
      currency: parsed.currency || "MAD",
      status: parsed.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId)
    .eq("organization_id", actor.organization.id)
    .select("*")
    .single();

  if (res.error?.code === UNIQUE_VIOLATION) {
    throw new Error(
      `Another property is already using the slug "${parsed.slug}".`
    );
  }
  return unwrap(res, "update property") as Property;
}

// ---------------------------------------------------------------------------
// Property service writes
// ---------------------------------------------------------------------------

/**
 * Attaches one or more catalogue services (global templates or organization custom services)
 * to a property as independent property-service records with default availability windows.
 */
export async function attachCatalogServicesToProperty(
  propertyId: string,
  catalogServiceIds: string[]
): Promise<PropertyService[]> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  const property = await fetchPropertyById(propertyId);
  if (!property) {
    throw new Error("Not Found: Property does not exist.");
  }

  assertCanManageProperty(actor, property);

  const client = sb();
  const now = new Date().toISOString();

  const visibleCatalog = await fetchVisibleCatalog(actor.organization.id);

  const lastService = unwrap(
    await client
      .from("property_services")
      .select("display_order")
      .eq("property_id", propertyId)
      .order("display_order", { ascending: false })
      .limit(1),
    "load display order"
  ) as { display_order: number }[];
  let maxOrder = lastService[0]?.display_order ?? 0;

  const newServiceRows: Row[] = [];

  for (const catalogId of catalogServiceIds) {
    const template = visibleCatalog.find((sc) => sc.id === catalogId);
    if (!template) {
      throw new Error(
        `Catalogue service "${catalogId}" was not found or belongs to another organization.`
      );
    }

    maxOrder += 1;

    // Activate immediately only if pricing & property default WhatsApp are valid
    const canAutoActivate =
      Boolean(property.default_whatsapp) &&
      (template.default_pricing_mode === "quote" ||
        (template.suggested_price !== null && template.suggested_price >= 0));

    newServiceRows.push({
      property_id: property.id,
      organization_id: actor.organization.id,
      catalog_service_id: template.id,
      category_key: template.category_key,
      name_en: template.name_en,
      name_fr: template.name_fr || template.name_en,
      description_en: template.description_en,
      description_fr: template.description_fr || template.description_en,
      conditions_en: `Minimum advance notice: ${template.default_advance_notice_hours}h. Subject to host confirmation.`,
      conditions_fr: `Préavis minimum : ${template.default_advance_notice_hours}h. Sous réserve de confirmation par l'hôte.`,
      image_url: template.default_image_url,
      is_active: canAutoActivate,
      pricing_mode: template.default_pricing_mode,
      price:
        template.default_pricing_mode === "fixed"
          ? template.suggested_price ?? 150
          : null,
      currency: property.currency || "MAD",
      pricing_unit: template.default_pricing_unit,
      min_quantity: template.default_min_quantity,
      max_quantity: template.default_max_quantity,
      advance_notice_hours: template.default_advance_notice_hours,
      requires_time_slot: template.requires_time_slot,
      display_order: maxOrder,
      whatsapp_override: null,
      whatsapp_override_label: null,
      is_demo_override_contact: false,
      created_at: now,
      updated_at: now,
    });
  }

  if (newServiceRows.length === 0) {
    return [];
  }

  const created = (
    unwrap(
      await client.from("property_services").insert(newServiceRows).select("*"),
      "attach services"
    ) as Row[]
  ).map(mapPropertyService);

  // Seed 7 weekday availability windows for each new property service
  const availabilityRes = await client
    .from("property_service_availability")
    .insert(created.flatMap((svc) => defaultAvailabilityRows(svc.id)));
  if (availabilityRes.error) {
    // Roll back so we never leave services without availability windows
    await client
      .from("property_services")
      .delete()
      .in(
        "id",
        created.map((svc) => svc.id)
      );
    throw new Error(
      `Database error (seed availability): ${availabilityRes.error.message}`
    );
  }

  return created.sort((a, b) => a.display_order - b.display_order);
}

/**
 * Creates a custom service in the organization's reusable catalogue (with duplicate name warning)
 * and optionally attaches it to a property.
 */
export async function createCustomCatalogService(
  rawInput: unknown,
  attachToPropertyId?: string | null
): Promise<{
  status: "duplicate_warning" | "created";
  duplicates?: { id: string; name_en: string; name_fr: string; is_global_template: boolean }[];
  catalogService?: ServiceCatalogItem;
  attachedPropertyService?: PropertyService;
}> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }

  const parsed = CustomCatalogServiceSchema.parse(rawInput);
  const client = sb();

  let attachProperty: Property | null = null;
  if (attachToPropertyId) {
    attachProperty = await fetchPropertyById(attachToPropertyId);
    assertCanManageProperty(actor, attachProperty);
  }

  // Check for duplicate names in global templates + this organization's custom catalogue
  const visibleCatalog = await fetchVisibleCatalog(actor.organization.id);

  if (!parsed.ignore_duplicate_warning) {
    const duplicates = findPotentialDuplicateCatalogServices(
      parsed.name_en,
      parsed.name_fr,
      visibleCatalog
    );
    if (duplicates.length > 0) {
      return {
        status: "duplicate_warning",
        duplicates,
      };
    }
  }

  const now = new Date().toISOString();
  let createdCatalogItem: ServiceCatalogItem | undefined;

  if (parsed.save_to_org_catalog) {
    createdCatalogItem = mapCatalogItem(
      unwrap(
        await client
          .from("service_catalog")
          .insert({
            organization_id: actor.organization.id,
            is_global_template: false,
            category_key: parsed.category_key,
            name_en: parsed.name_en,
            name_fr: parsed.name_fr || parsed.name_en,
            description_en: parsed.description_en,
            description_fr: parsed.description_fr || parsed.description_en,
            default_image_url: parsed.default_image_url || null,
            default_pricing_mode: parsed.default_pricing_mode,
            suggested_price:
              parsed.default_pricing_mode === "fixed"
                ? parsed.suggested_price ?? 200
                : null,
            default_currency: parsed.default_currency || "MAD",
            default_pricing_unit: parsed.default_pricing_unit,
            default_min_quantity: parsed.default_min_quantity,
            default_max_quantity: parsed.default_max_quantity,
            default_advance_notice_hours: parsed.default_advance_notice_hours,
            requires_time_slot: parsed.requires_time_slot,
            recommended_property_types: [
              "apartment",
              "villa",
              "riad",
              "studio",
              "other",
            ],
            recommended_features: [],
            created_by: actor.user.id,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single(),
        "create catalogue service"
      ) as Row
    );
  }

  let attachedPropertyService: PropertyService | undefined;

  if (attachToPropertyId && attachProperty) {
    if (createdCatalogItem) {
      const attached = await attachCatalogServicesToProperty(
        attachToPropertyId,
        [createdCatalogItem.id]
      );
      attachedPropertyService = attached[0];
    } else {
      // Property-only service without saving to org catalogue
      const lastService = unwrap(
        await client
          .from("property_services")
          .select("display_order")
          .eq("property_id", attachToPropertyId)
          .order("display_order", { ascending: false })
          .limit(1),
        "load display order"
      ) as { display_order: number }[];
      const maxOrder = lastService[0]?.display_order ?? 0;

      attachedPropertyService = mapPropertyService(
        unwrap(
          await client
            .from("property_services")
            .insert({
              property_id: attachProperty.id,
              organization_id: actor.organization.id,
              catalog_service_id: null,
              category_key: parsed.category_key,
              name_en: parsed.name_en,
              name_fr: parsed.name_fr || parsed.name_en,
              description_en: parsed.description_en,
              description_fr: parsed.description_fr || parsed.description_en,
              conditions_en: "",
              conditions_fr: "",
              image_url: parsed.default_image_url || null,
              is_active: false,
              pricing_mode: parsed.default_pricing_mode,
              price:
                parsed.default_pricing_mode === "fixed"
                  ? parsed.suggested_price ?? 200
                  : null,
              currency: attachProperty.currency || "MAD",
              pricing_unit: parsed.default_pricing_unit,
              min_quantity: parsed.default_min_quantity,
              max_quantity: parsed.default_max_quantity,
              advance_notice_hours: parsed.default_advance_notice_hours,
              requires_time_slot: parsed.requires_time_slot,
              display_order: maxOrder + 1,
              whatsapp_override: null,
              whatsapp_override_label: null,
              is_demo_override_contact: false,
              created_at: now,
              updated_at: now,
            })
            .select("*")
            .single(),
          "create property service"
        ) as Row
      );

      const availabilityRes = await client
        .from("property_service_availability")
        .insert(defaultAvailabilityRows(attachedPropertyService.id));
      if (availabilityRes.error) {
        await client
          .from("property_services")
          .delete()
          .eq("id", attachedPropertyService.id);
        throw new Error(
          `Database error (seed availability): ${availabilityRes.error.message}`
        );
      }
    }
  }

  return {
    status: "created",
    catalogService: createdCatalogItem,
    attachedPropertyService,
  };
}

/**
 * Updates a property-specific service record without ever mutating other properties
 * or the reusable catalogue template.
 */
export async function updatePropertyServiceRecord(
  propertyServiceId: string,
  rawInput: unknown
): Promise<PropertyService> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }

  const existingService = await fetchPropertyServiceById(propertyServiceId);
  if (!existingService) {
    throw new Error("Property service not found.");
  }

  const property = await fetchPropertyById(existingService.property_id);
  if (!property) {
    throw new Error("Not Found: Property does not exist.");
  }

  assertCanManageProperty(actor, property);

  const parsed = PropertyServiceUpdateSchema.parse(rawInput);
  const client = sb();

  let normalizedOverride: string | null = null;
  if (parsed.whatsapp_override && parsed.whatsapp_override.trim().length > 0) {
    const check = normalizePhoneNumber(parsed.whatsapp_override);
    if (!check.isValid) {
      throw new Error(check.error || "Invalid WhatsApp override phone number.");
    }
    normalizedOverride = check.e164;
  }

  // Ensure effective recipient is valid before activating
  if (parsed.is_active) {
    const effective = resolveWhatsAppRecipient(property, {
      whatsapp_override: normalizedOverride,
      whatsapp_override_label: parsed.whatsapp_override_label || null,
      is_demo_override_contact: Boolean(parsed.is_demo_override_contact),
    });
    if (!effective.internationalDigits) {
      throw new Error(
        "Cannot activate service without a valid WhatsApp recipient (override or property default)."
      );
    }
  }

  const updatedService = mapPropertyService(
    unwrap(
      await client
        .from("property_services")
        .update({
          name_en: parsed.name_en,
          name_fr: parsed.name_fr || parsed.name_en,
          description_en: parsed.description_en,
          description_fr: parsed.description_fr || parsed.description_en,
          conditions_en: parsed.conditions_en,
          conditions_fr: parsed.conditions_fr || parsed.conditions_en,
          category_key: parsed.category_key,
          image_url: parsed.image_url || null,
          is_active: parsed.is_active,
          pricing_mode: parsed.pricing_mode,
          price: parsed.pricing_mode === "fixed" ? parsed.price : null,
          currency: parsed.currency || property.currency || "MAD",
          pricing_unit: parsed.pricing_unit,
          min_quantity: parsed.min_quantity,
          max_quantity: parsed.max_quantity,
          advance_notice_hours: parsed.advance_notice_hours,
          requires_time_slot: parsed.requires_time_slot,
          display_order: parsed.display_order,
          whatsapp_override: normalizedOverride,
          whatsapp_override_label: normalizedOverride
            ? parsed.whatsapp_override_label || "Service Provider Override"
            : null,
          is_demo_override_contact: normalizedOverride
            ? Boolean(parsed.is_demo_override_contact) ||
              isDemoPlaceholderPhone(normalizedOverride)
            : false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", propertyServiceId)
        .select("*")
        .single(),
      "update property service"
    ) as Row
  );

  // Update weekday availability if provided
  if (parsed.availability && parsed.availability.length > 0) {
    const windows = new Map<string, Row>();
    for (const win of parsed.availability) {
      windows.set(`${win.weekday}|${win.start_time}|${win.end_time}`, {
        property_service_id: propertyServiceId,
        weekday: win.weekday,
        start_time: win.start_time,
        end_time: win.end_time,
        is_available: win.is_available,
      });
    }
    unwrap(
      await client
        .from("property_service_availability")
        .delete()
        .eq("property_service_id", propertyServiceId),
      "replace availability"
    );
    unwrap(
      await client
        .from("property_service_availability")
        .insert(Array.from(windows.values())),
      "save availability"
    );
  }

  // Update blackout dates if provided
  if (parsed.blackouts) {
    const blackoutRows = new Map<string, Row>();
    for (const blk of parsed.blackouts) {
      blackoutRows.set(blk.unavailable_date, {
        property_service_id: propertyServiceId,
        unavailable_date: blk.unavailable_date,
        reason: blk.reason || "",
      });
    }
    unwrap(
      await client
        .from("property_service_blackouts")
        .delete()
        .eq("property_service_id", propertyServiceId),
      "replace blackouts"
    );
    if (blackoutRows.size > 0) {
      unwrap(
        await client
          .from("property_service_blackouts")
          .insert(Array.from(blackoutRows.values())),
        "save blackouts"
      );
    }
  }

  return updatedService;
}

/**
 * Deletes a property service from a property.
 */
export async function deletePropertyServiceRecord(
  propertyServiceId: string
): Promise<void> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  const existing = await fetchPropertyServiceById(propertyServiceId);
  if (!existing) {
    throw new Error("Property service not found.");
  }
  const property = await fetchPropertyById(existing.property_id);
  assertCanManageProperty(actor, property);

  // Availability windows and blackout dates are removed via ON DELETE CASCADE
  unwrap(
    await sb().from("property_services").delete().eq("id", propertyServiceId),
    "delete property service"
  );
}

// ---------------------------------------------------------------------------
// Guest service requests
// ---------------------------------------------------------------------------

type GuestServiceRequestResult = {
  request: {
    id: string;
    reference_code: string;
    property_name: string;
    service_name: string;
    guest_name: string;
    requested_date: string;
    requested_time: string | null;
    quantity: number;
    pricing_unit: PropertyService["pricing_unit"];
    pricing_mode: PropertyService["pricing_mode"];
    estimated_total: number | null;
    currency: string;
    status: RequestStatus;
    whatsapp_handoff_at: string;
    is_demo_recipient: boolean;
    recipient_label: string;
    used_override_recipient: boolean;
  };
  whatsappMessage: string;
  waMeUrl: string;
};

function buildGuestRequestResult(
  req: ServiceRequest,
  recipientDigits: string
): GuestServiceRequestResult {
  const { messageText, waMeUrl } = buildWhatsAppRequestMessage(
    {
      propertyName: req.property_name_snapshot,
      serviceName: req.service_name_snapshot,
      guestName: req.guest_name,
      requestedDate: req.requested_date,
      requestedTime: req.requested_time,
      quantity: req.quantity,
      pricingUnit: req.pricing_unit_snapshot,
      pricingMode: req.pricing_mode_snapshot,
      estimatedTotal: req.estimated_total,
      currency: req.currency,
      note: req.guest_note,
      referenceCode: req.reference_code,
      locale: req.guest_locale,
    },
    recipientDigits
  );

  return {
    request: {
      id: req.id,
      reference_code: req.reference_code,
      property_name: req.property_name_snapshot,
      service_name: req.service_name_snapshot,
      guest_name: req.guest_name,
      requested_date: req.requested_date,
      requested_time: req.requested_time,
      quantity: req.quantity,
      pricing_unit: req.pricing_unit_snapshot,
      pricing_mode: req.pricing_mode_snapshot,
      estimated_total: req.estimated_total,
      currency: req.currency,
      status: req.status,
      whatsapp_handoff_at: req.whatsapp_handoff_at || req.created_at,
      is_demo_recipient: req.is_demo_recipient,
      recipient_label: req.resolved_whatsapp_label,
      used_override_recipient: req.used_override_recipient,
    },
    whatsappMessage: messageText,
    waMeUrl,
  };
}

async function findRequestByIdempotencyKey(
  key: string
): Promise<ServiceRequest | null> {
  const data = unwrap(
    await sb()
      .from("service_requests")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle(),
    "check idempotency key"
  );
  return data ? mapServiceRequest(data as Row) : null;
}

function resultForExistingRequest(
  existingReq: ServiceRequest
): GuestServiceRequestResult {
  return buildGuestRequestResult(
    existingReq,
    existingReq.resolved_whatsapp_number.replace(/\D/g, "")
  );
}

/**
 * Validated Server Action for Public Guest Service Requests:
 * - Enforces rate limiting and idempotency key deduplication
 * - Validates date, weekday, time window, blackouts, advance notice, and quantity in property timezone
 * - Calculates total exclusively from server-side property_services price
 * - Resolves the effective WhatsApp recipient (override -> property default) on the server
 * - Saves the request record with status 'prepared' and handoff timestamp
 * - Returns the request reference, formatted message, and wa.me click-to-chat URL
 */
export async function createGuestServiceRequest(
  rawInput: unknown,
  clientFingerprint = "anonymous-guest"
): Promise<GuestServiceRequestResult> {
  if (!checkRateLimit(clientFingerprint, 12)) {
    throw new Error(
      "Too many service requests submitted in a short period. Please wait a minute and try again."
    );
  }

  const parsed = GuestServiceRequestInputSchema.parse(rawInput);
  const client = sb();

  // Check idempotency key first to avoid duplicate request creation on repeated clicks
  if (parsed.idempotency_key) {
    const existingReq = await findRequestByIdempotencyKey(
      parsed.idempotency_key
    );
    if (existingReq) {
      return resultForExistingRequest(existingReq);
    }
  }

  const property = unwrap(
    await client
      .from("properties")
      .select("*")
      .eq("slug", parsed.property_slug.trim().toLowerCase())
      .eq("status", "published")
      .maybeSingle(),
    "load published property"
  ) as Property | null;
  if (!property) {
    throw new Error("Published property not found.");
  }

  const serviceRow = isUuid(parsed.property_service_id)
    ? unwrap(
        await client
          .from("property_services")
          .select("*")
          .eq("id", parsed.property_service_id)
          .eq("property_id", property.id)
          .eq("is_active", true)
          .maybeSingle(),
        "load service"
      )
    : null;
  if (!serviceRow) {
    throw new Error("Active service not found for this property.");
  }
  const activeService = mapPropertyService(serviceRow as Row);

  const { availability, blackouts } = await fetchAvailabilityAndBlackouts([
    activeService.id,
  ]);

  // Authoritative server-side schedule & price validation
  const validation = validateServiceScheduleAndCalculateTotal({
    property,
    service: activeService,
    availability,
    blackouts,
    requestedDate: parsed.requested_date,
    requestedTime: parsed.requested_time || null,
    quantity: parsed.quantity,
  });

  if (!validation.valid) {
    throw new Error(validation.error || "Invalid service request parameters.");
  }

  // Resolve effective WhatsApp recipient on the server
  const recipient = resolveWhatsAppRecipient(property, activeService);

  const nowIso = new Date().toISOString();

  // Generate unique SB-XXXXXX reference code (retry on the rare collision)
  let saved: ServiceRequest | null = null;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    const res = await client
      .from("service_requests")
      .insert({
        reference_code: generateReferenceCode(),
        organization_id: property.organization_id,
        property_id: property.id,
        property_service_id: activeService.id,
        property_name_snapshot: property.name,
        service_name_snapshot: activeService.name_en,
        category_key_snapshot: activeService.category_key,
        pricing_mode_snapshot: activeService.pricing_mode,
        unit_price_snapshot: activeService.price,
        pricing_unit_snapshot: activeService.pricing_unit,
        currency: activeService.currency || property.currency || "MAD",
        guest_name: parsed.guest_name.trim(),
        requested_date: parsed.requested_date,
        requested_time: parsed.requested_time?.trim() || null,
        quantity: parsed.quantity,
        estimated_total: validation.estimatedTotal,
        guest_note: parsed.guest_note?.trim() || "",
        guest_locale: parsed.guest_locale,
        resolved_whatsapp_number: recipient.e164,
        resolved_whatsapp_label: recipient.label,
        used_override_recipient: recipient.source === "service_override",
        is_demo_recipient: recipient.isDemoContact,
        status: "prepared",
        whatsapp_handoff_at: nowIso,
        manager_notes: "",
        idempotency_key: parsed.idempotency_key || null,
        client_fingerprint: clientFingerprint,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (!res.error) {
      saved = mapServiceRequest(res.data as Row);
      break;
    }

    if (res.error.code === UNIQUE_VIOLATION) {
      // Either a concurrent duplicate submit (same idempotency key) or a
      // reference-code collision. Resolve the first, retry the second.
      if (parsed.idempotency_key) {
        const existingReq = await findRequestByIdempotencyKey(
          parsed.idempotency_key
        );
        if (existingReq) {
          return resultForExistingRequest(existingReq);
        }
      }
      continue;
    }

    throw new Error(`Database error (save request): ${res.error.message}`);
  }

  if (!saved) {
    throw new Error("Could not generate a unique request reference. Please try again.");
  }

  return buildGuestRequestResult(saved, recipient.internationalDigits);
}

/**
 * Updates a service request status and manager notes (enforces property management permission).
 */
export async function updateServiceRequestStatus(
  requestId: string,
  newStatus: RequestStatus,
  managerNotes?: string
): Promise<ServiceRequest> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (!isUuid(requestId)) {
    throw new Error("Service request not found.");
  }

  const client = sb();
  const existingRow = unwrap(
    await client
      .from("service_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle(),
    "load service request"
  );
  if (!existingRow) {
    throw new Error("Service request not found.");
  }
  const existingReq = mapServiceRequest(existingRow as Row);

  const property = await fetchPropertyById(existingReq.property_id);
  assertCanManageProperty(actor, property);

  const nowIso = new Date().toISOString();
  const updated = unwrap(
    await client
      .from("service_requests")
      .update({
        status: newStatus,
        manager_notes:
          managerNotes !== undefined ? managerNotes : existingReq.manager_notes,
        status_updated_at: nowIso,
        status_updated_by: actor.user.id,
        updated_at: nowIso,
      })
      .eq("id", requestId)
      .select("*")
      .single(),
    "update service request"
  );
  return mapServiceRequest(updated as Row);
}

// ---------------------------------------------------------------------------
// Team & organization
// ---------------------------------------------------------------------------

/**
 * Updates property assignments for a property manager in the organization (Admin only).
 */
export async function updateManagerPropertyAssignments(
  targetUserId: string,
  propertyIds: string[]
) {
  const actor = await getCurrentActor();
  assertOrgAdmin(actor);

  const client = sb();
  const orgId = actor.organization.id;

  const targetMember = isUuid(targetUserId)
    ? unwrap(
        await client
          .from("organization_members")
          .select("id")
          .eq("organization_id", orgId)
          .eq("user_id", targetUserId)
          .maybeSingle(),
        "load team member"
      )
    : null;
  if (!targetMember) {
    throw new Error("Team member not found in your organization.");
  }

  // Validate all propertyIds belong to this organization
  const requestedIds = Array.from(new Set(propertyIds.filter(isUuid)));
  const validOrgProps = requestedIds.length
    ? (unwrap(
        await client
          .from("properties")
          .select("id")
          .eq("organization_id", orgId)
          .in("id", requestedIds),
        "validate properties"
      ) as { id: string }[])
    : [];
  const filteredIds = validOrgProps.map((p) => p.id);

  const existing = unwrap(
    await client
      .from("property_members")
      .select("property_id")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId),
    "load current assignments"
  ) as { property_id: string }[];

  // Add new assignments first, then remove stale ones, so a failure never
  // leaves a manager with fewer properties than before.
  if (filteredIds.length > 0) {
    unwrap(
      await client.from("property_members").upsert(
        filteredIds.map((pid) => ({
          property_id: pid,
          user_id: targetUserId,
          organization_id: orgId,
        })),
        { onConflict: "property_id,user_id", ignoreDuplicates: true }
      ),
      "save assignments"
    );
  }

  const staleIds = existing
    .map((pm) => pm.property_id)
    .filter((pid) => !filteredIds.includes(pid));
  if (staleIds.length > 0) {
    unwrap(
      await client
        .from("property_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", targetUserId)
        .in("property_id", staleIds),
      "remove assignments"
    );
  }

  return filteredIds;
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 14; i++) {
    pwd += chars.charAt(crypto.randomInt(chars.length));
  }
  return pwd;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const client = sb();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(`Auth error (look up user): ${error.message}`);
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Adds a member to the organization (Admin only). If the email has no account
 * yet, a confirmed Supabase Auth user is created with a one-time temporary
 * password that is returned so the admin can hand it to the new member.
 */
export async function inviteOrganizationMember(input: {
  full_name: string;
  email: string;
  role: "admin" | "property_manager";
  assignedPropertyIds?: string[];
}) {
  const actor = await getCurrentActor();
  assertOrgAdmin(actor);

  const client = sb();
  const orgId = actor.organization.id;
  const cleanEmail = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();

  let profile = unwrap(
    await client
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle(),
    "look up profile"
  ) as Profile | null;

  let temporaryPassword: string | undefined;
  let createdAuthUserId: string | null = null;

  if (!profile) {
    let authUserId: string | null = null;
    const password = generateTemporaryPassword();
    const { data: created, error: createErr } =
      await client.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createErr) {
      // Account may already exist in Auth without a profile row
      authUserId = await findAuthUserIdByEmail(cleanEmail);
      if (!authUserId) {
        throw new Error(`Could not create the user account: ${createErr.message}`);
      }
    } else {
      authUserId = created.user.id;
      createdAuthUserId = authUserId;
      temporaryPassword = password;
    }

    const insertRes = await client
      .from("profiles")
      .insert({
        id: authUserId,
        email: cleanEmail,
        full_name: fullName,
        preferred_language: "en",
      })
      .select("*")
      .single();

    if (insertRes.error) {
      if (createdAuthUserId) {
        await client.auth.admin.deleteUser(createdAuthUserId);
      }
      throw new Error(`Database error (create profile): ${insertRes.error.message}`);
    }
    profile = insertRes.data as Profile;
  }

  const existingMembership = unwrap(
    await client
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", profile.id)
      .maybeSingle(),
    "check membership"
  );
  if (existingMembership) {
    throw new Error("This user is already a member of your organization.");
  }

  const membershipRes = await client
    .from("organization_members")
    .insert({
      organization_id: orgId,
      user_id: profile.id,
      role: input.role,
      invited_email: cleanEmail,
      is_active: true,
    })
    .select("*")
    .single();
  if (membershipRes.error) {
    if (createdAuthUserId) {
      // Cascades to the profile row created above
      await client.auth.admin.deleteUser(createdAuthUserId);
    }
    throw new Error(
      `Database error (add member): ${membershipRes.error.message}`
    );
  }
  const newMembership = membershipRes.data as OrganizationMember;

  if (input.role === "property_manager" && input.assignedPropertyIds?.length) {
    await updateManagerPropertyAssignments(
      profile.id,
      input.assignedPropertyIds
    );
  }

  return { profile, membership: newMembership, temporaryPassword };
}

/**
 * Updates organization settings (Admin only).
 */
export async function updateOrganizationSettings(input: {
  name: string;
  contact_email?: string;
  default_currency: string;
  default_timezone: string;
  default_language: "en" | "fr" | "ar";
}) {
  const actor = await getCurrentActor();
  assertOrgAdmin(actor);

  const res = await sb()
    .from("organizations")
    .update({
      name: input.name.trim(),
      contact_email: input.contact_email?.trim() || null,
      default_currency: input.default_currency.trim().toUpperCase(),
      default_timezone: input.default_timezone.trim(),
      default_language: input.default_language,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actor.organization.id)
    .select("*")
    .maybeSingle();

  const updatedRow = unwrap(res, "update organization") as Row | null;
  if (!updatedRow) throw new Error("Organization not found.");
  return mapOrganization(updatedRow);
}

function mapOrganization(row: Row): Organization {
  const { hostaway_api_key, ...rest } = row;
  return {
    ...(rest as unknown as Organization),
    hostaway_account_id:
      (row.hostaway_account_id as string | null) ||
      process.env.HOSTAWAY_ACCOUNT_ID ||
      null,
    has_hostaway_api_key: Boolean(
      hostaway_api_key || process.env.HOSTAWAY_API_KEY
    ),
    hostaway_last_synced_at:
      (row.hostaway_last_synced_at as string | null) ?? null,
  };
}

/**
 * Syncs all listings from the organization's Hostaway account into Supabase:
 * - Authenticates with Hostaway API (using provided, saved, or environment credentials)
 * - Imports property details, photos, city, map coordinates, and amenities/features
 * - Upserts properties by (organization_id, hostaway_listing_id) so re-syncing updates
 *   existing listings without duplicating them or breaking existing QR slugs
 */
export async function syncPropertiesFromHostaway(input: {
  accountId?: string;
  apiKey?: string;
  defaultWhatsapp?: string;
}): Promise<{
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  properties: Property[];
  lastSyncedAt: string;
}> {
  const actor = await getCurrentActor();
  assertOrgAdmin(actor);

  const client = sb();
  const orgId = actor.organization.id;

  const orgRow = unwrap(
    await client
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single(),
    "load organization credentials"
  ) as Row;

  const accountId = (
    input.accountId?.trim() ||
    (orgRow.hostaway_account_id as string | null) ||
    process.env.HOSTAWAY_ACCOUNT_ID ||
    ""
  ).trim();

  const apiKey = (
    input.apiKey?.trim() ||
    (orgRow.hostaway_api_key as string | null) ||
    process.env.HOSTAWAY_API_KEY ||
    ""
  ).trim();

  if (!accountId || !apiKey) {
    throw new Error(
      "Please enter your Hostaway Account ID and API Key to connect your listings."
    );
  }

  let fallbackWhatsapp = "+212600000099";
  if (input.defaultWhatsapp && input.defaultWhatsapp.trim().length > 0) {
    const check = normalizePhoneNumber(input.defaultWhatsapp);
    if (!check.isValid) {
      throw new Error(
        check.error || "Invalid default WhatsApp number for synced properties."
      );
    }
    fallbackWhatsapp = check.e164;
  }

  // Fetch and normalize all listings from Hostaway API
  const listings = await fetchHostawayListings({ accountId, apiKey });

  // Load existing properties in this organization, all global slugs, and starter catalogue
  const [orgPropsRes, allSlugsRes, visibleCatalog] = await Promise.all([
    client.from("properties").select("*").eq("organization_id", orgId),
    client.from("properties").select("slug"),
    fetchVisibleCatalog(orgId),
  ]);

  const orgProps = unwrap(orgPropsRes, "load org properties") as Property[];
  const takenSlugs = new Set(
    (unwrap(allSlugsRes, "load slugs") as { slug: string }[]).map((r) =>
      r.slug.toLowerCase()
    )
  );

  if (
    fallbackWhatsapp === "+212600000099" &&
    orgProps[0]?.default_whatsapp
  ) {
    fallbackWhatsapp = orgProps[0].default_whatsapp;
  }

  const nowIso = new Date().toISOString();
  let createdCount = 0;
  let updatedCount = 0;
  const syncedProperties: Property[] = [];

  for (const item of listings) {
    const existing =
      orgProps.find(
        (p) => p.hostaway_listing_id === item.hostaway_listing_id
      ) ||
      orgProps.find(
        (p) =>
          !p.hostaway_listing_id &&
          p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );

    if (existing) {
      // Update property details, photos, city, map_url, and features from Hostaway
      // while preserving slug, status, and existing WhatsApp routing.
      const updated = unwrap(
        await client
          .from("properties")
          .update({
            hostaway_listing_id: item.hostaway_listing_id,
            name: item.name,
            city: item.city,
            property_type: item.property_type,
            description_en: item.description_en,
            description_fr: item.description_fr,
            photos: item.photos.length > 0 ? item.photos : existing.photos,
            features: item.features,
            map_url: item.map_url ?? existing.map_url,
            timezone: item.timezone || existing.timezone,
            currency: item.currency || existing.currency,
            updated_at: nowIso,
          })
          .eq("id", existing.id)
          .eq("organization_id", orgId)
          .select("*")
          .single(),
        "update synced property"
      ) as Property;

      updatedCount += 1;
      syncedProperties.push(updated);
      continue;
    }

    // Ensure unique slug across all properties
    let uniqueSlug = item.slug;
    let suffix = 2;
    while (takenSlugs.has(uniqueSlug.toLowerCase())) {
      uniqueSlug = `${item.slug}-${suffix++}`;
    }
    takenSlugs.add(uniqueSlug.toLowerCase());

    let whatsappE164 = fallbackWhatsapp;
    if (
      (!input.defaultWhatsapp || !input.defaultWhatsapp.trim()) &&
      item.contact_phone
    ) {
      const parsedPhone = normalizePhoneNumber(item.contact_phone);
      if (parsedPhone.isValid) {
        whatsappE164 = parsedPhone.e164;
      }
    }

    const created = unwrap(
      await client
        .from("properties")
        .insert({
          organization_id: orgId,
          hostaway_listing_id: item.hostaway_listing_id,
          name: item.name,
          slug: uniqueSlug.toLowerCase(),
          description_en: item.description_en,
          description_fr: item.description_fr,
          welcome_message_en: item.welcome_message_en,
          welcome_message_fr: item.welcome_message_fr,
          property_type: item.property_type,
          city: item.city,
          map_url: item.map_url,
          photos: item.photos,
          features: item.features,
          default_whatsapp: whatsappE164,
          default_whatsapp_label: "Primary Host",
          is_demo_contact: isDemoPlaceholderPhone(whatsappE164),
          timezone: item.timezone,
          currency: item.currency,
          status: "published",
          created_by: actor.user.id,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single(),
      "insert synced property"
    ) as Property;

    // Auto-attach recommended starter catalogue services based on property type & features
    const matchingTemplates = visibleCatalog
      .filter(
        (tpl) =>
          tpl.is_global_template &&
          (tpl.recommended_property_types || []).includes(created.property_type)
      )
      .map((tpl) => {
        const recFeats = tpl.recommended_features || [];
        const featMatches = recFeats.filter((f) =>
          (created.features || []).includes(f)
        ).length;
        const score = recFeats.length === 0 ? 2 : featMatches * 4;
        return { tpl, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.tpl.id);

    if (matchingTemplates.length > 0) {
      await attachCatalogServicesToProperty(created.id, matchingTemplates);
    }

    createdCount += 1;
    syncedProperties.push(created);
  }

  // Persist credentials and sync timestamp on the organization
  unwrap(
    await client
      .from("organizations")
      .update({
        hostaway_account_id: accountId,
        hostaway_api_key: apiKey,
        hostaway_last_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", orgId),
    "save Hostaway sync metadata"
  );

  return {
    syncedCount: syncedProperties.length,
    createdCount,
    updatedCount,
    properties: syncedProperties,
    lastSyncedAt: nowIso,
  };
}
