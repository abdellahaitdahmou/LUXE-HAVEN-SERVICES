import { z } from "zod";
import {
  Property,
  PropertyService,
  PropertyServiceAvailability,
  PropertyServiceBlackout,
} from "./types";
import { normalizePhoneNumber, resolveWhatsAppRecipient } from "./whatsapp";

export const PropertyTypeEnum = z.enum([
  "apartment",
  "villa",
  "riad",
  "studio",
  "other",
]);

export const PropertyStatusEnum = z.enum(["draft", "published", "archived"]);

export const PricingModeEnum = z.enum(["fixed", "quote"]);

export const PricingUnitEnum = z.enum([
  "per_booking",
  "per_person",
  "per_hour",
  "per_night",
  "per_item",
]);

export const RequestStatusEnum = z.enum([
  "prepared",
  "confirmed",
  "declined",
  "completed",
  "cancelled",
]);

export const PropertyInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Property name must be at least 2 characters.")
    .max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens."
    ),
  description_en: z.string().trim().max(2000).default(""),
  description_fr: z.string().trim().max(2000).default(""),
  welcome_message_en: z.string().trim().max(600).default(""),
  welcome_message_fr: z.string().trim().max(600).default(""),
  property_type: PropertyTypeEnum,
  city: z.string().trim().min(2, "City is required.").max(80),
  map_url: z
    .string()
    .trim()
    .url("Map link must be a valid URL.")
    .optional()
    .or(z.literal("")),
  photos: z.array(z.string().url()).default([]),
  features: z.array(z.string().trim()).default([]),
  default_whatsapp: z
    .string()
    .trim()
    .refine((val) => normalizePhoneNumber(val).isValid, {
      message:
        "Default host WhatsApp must be a valid international number (e.g. +212612345678).",
    }),
  default_whatsapp_label: z.string().trim().max(100).optional().default("Primary Host"),
  is_demo_contact: z.boolean().optional().default(false),
  timezone: z.string().trim().min(2).default("Africa/Casablanca"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Currency must be a 3-letter ISO code (e.g. MAD).")
    .default("MAD"),
  status: PropertyStatusEnum.default("draft"),
});

export const CustomCatalogServiceSchema = z
  .object({
    category_key: z.string().trim().min(2, "Category is required."),
    name_en: z
      .string()
      .trim()
      .min(2, "Service name (EN) must be at least 2 characters.")
      .max(120),
    name_fr: z.string().trim().max(120).default(""),
    description_en: z.string().trim().max(1000).default(""),
    description_fr: z.string().trim().max(1000).default(""),
    default_image_url: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal(""))
      .nullable(),
    default_pricing_mode: PricingModeEnum.default("fixed"),
    suggested_price: z.number().min(0).nullable().optional(),
    default_currency: z.string().trim().length(3).default("MAD"),
    default_pricing_unit: PricingUnitEnum.default("per_booking"),
    default_min_quantity: z.number().int().min(1).default(1),
    default_max_quantity: z.number().int().min(1).default(10),
    default_advance_notice_hours: z.number().int().min(0).max(720).default(12),
    requires_time_slot: z.boolean().default(true),
    save_to_org_catalog: z.boolean().default(true),
    ignore_duplicate_warning: z.boolean().optional().default(false),
  })
  .refine((data) => data.default_max_quantity >= data.default_min_quantity, {
    message: "Maximum quantity must be greater than or equal to minimum quantity.",
    path: ["default_max_quantity"],
  });

export const AvailabilityWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
  is_available: z.boolean(),
});

export const BlackoutDateSchema = z.object({
  unavailable_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  reason: z.string().trim().max(200).optional().default(""),
});

export const PropertyServiceUpdateSchema = z
  .object({
    name_en: z.string().trim().min(2, "Display name is required.").max(120),
    name_fr: z.string().trim().max(120).default(""),
    description_en: z.string().trim().max(1500).default(""),
    description_fr: z.string().trim().max(1500).default(""),
    conditions_en: z.string().trim().max(1000).default(""),
    conditions_fr: z.string().trim().max(1000).default(""),
    category_key: z.string().trim().min(2),
    image_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
    is_active: z.boolean(),
    pricing_mode: PricingModeEnum,
    price: z.number().min(0).nullable(),
    currency: z.string().trim().length(3).default("MAD"),
    pricing_unit: PricingUnitEnum,
    min_quantity: z.number().int().min(1),
    max_quantity: z.number().int().min(1),
    advance_notice_hours: z.number().int().min(0).max(720),
    requires_time_slot: z.boolean(),
    display_order: z.number().int().min(0).default(0),
    whatsapp_override: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .nullable()
      .refine(
        (val) => !val || val.trim() === "" || normalizePhoneNumber(val).isValid,
        {
          message:
            "WhatsApp override must be a valid international number (e.g. +212612345678) or left blank to use the property default.",
        }
      ),
    whatsapp_override_label: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal(""))
      .nullable(),
    is_demo_override_contact: z.boolean().optional().default(false),
    availability: z.array(AvailabilityWindowSchema).optional(),
    blackouts: z.array(BlackoutDateSchema).optional(),
  })
  .refine((data) => data.max_quantity >= data.min_quantity, {
    message: "Maximum quantity must be greater than or equal to minimum quantity.",
    path: ["max_quantity"],
  })
  .refine(
    (data) => {
      if (data.is_active && data.pricing_mode === "fixed") {
        return data.price !== null && data.price !== undefined && data.price >= 0;
      }
      return true;
    },
    {
      message:
        "A valid price is required before activating a fixed-price service.",
      path: ["price"],
    }
  );

export const GuestServiceRequestInputSchema = z.object({
  property_slug: z.string().trim().min(1),
  property_service_id: z.string().trim().min(1),
  guest_name: z
    .string()
    .trim()
    .min(2, "Please enter your name (at least 2 characters).")
    .max(100),
  requested_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid date (YYYY-MM-DD)."),
  requested_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Please select a valid time (HH:mm).")
    .optional()
    .or(z.literal(""))
    .nullable(),
  quantity: z.number().int().min(1, "Quantity must be at least 1."),
  guest_note: z.string().trim().max(500).optional().default(""),
  guest_locale: z.enum(["en", "fr", "ar"]).default("en"),
  idempotency_key: z.string().trim().max(120).optional().nullable(),
});

/**
 * Returns the current local date/time components in the specified IANA timezone
 * (defaults to Africa/Casablanca).
 */
export function getNowInTimezone(timezone = "Africa/Casablanca"): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isoDate: string;
  epochMs: number;
} {
  const now = new Date();
  let tz = timezone;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: tz });
  } catch {
    tz = "Africa/Casablanca";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const getPart = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour") % 24;
  const minute = getPart("minute");

  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;

  const pseudoUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  return {
    year,
    month,
    day,
    hour,
    minute,
    isoDate,
    epochMs: pseudoUtcMs,
  };
}

/**
 * Validates requested date, weekday, blackout dates, time window, advance notice,
 * quantity, and recipient configuration, then computes the authoritative server-side total.
 */
export function validateServiceScheduleAndCalculateTotal(params: {
  property: Property;
  service: PropertyService;
  availability: PropertyServiceAvailability[];
  blackouts: PropertyServiceBlackout[];
  requestedDate: string; // YYYY-MM-DD
  requestedTime?: string | null; // HH:mm
  quantity: number;
}): {
  valid: boolean;
  error?: string;
  estimatedTotal: number | null;
} {
  const {
    property,
    service,
    availability,
    blackouts,
    requestedDate,
    requestedTime,
    quantity,
  } = params;

  if (property.status !== "published") {
    return {
      valid: false,
      error: "This property is not currently published for guest requests.",
      estimatedTotal: null,
    };
  }

  if (!service.is_active) {
    return {
      valid: false,
      error: "This service is not currently active.",
      estimatedTotal: null,
    };
  }

  // Verify WhatsApp recipient is resolvable
  const recipient = resolveWhatsAppRecipient(property, service);
  if (!recipient.internationalDigits) {
    return {
      valid: false,
      error: "No valid WhatsApp recipient is configured for this service.",
      estimatedTotal: null,
    };
  }

  // 1. Validate quantity bounds
  if (quantity < service.min_quantity || quantity > service.max_quantity) {
    return {
      valid: false,
      error: `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`,
      estimatedTotal: null,
    };
  }

  // 2. Parse requested date
  const [reqYear, reqMonth, reqDay] = requestedDate.split("-").map(Number);
  if (!reqYear || !reqMonth || !reqDay) {
    return {
      valid: false,
      error: "Invalid requested date format.",
      estimatedTotal: null,
    };
  }

  const nowLocal = getNowInTimezone(property.timezone || "Africa/Casablanca");
  if (requestedDate < nowLocal.isoDate) {
    return {
      valid: false,
      error: `Requested date (${requestedDate}) cannot be in the past (${property.timezone}).`,
      estimatedTotal: null,
    };
  }

  // 3. Check blackout dates
  const blackoutMatch = blackouts.find(
    (b) => b.unavailable_date === requestedDate
  );
  if (blackoutMatch) {
    return {
      valid: false,
      error: `This service is unavailable on ${requestedDate}${
        blackoutMatch.reason ? ` (${blackoutMatch.reason})` : ""
      }.`,
      estimatedTotal: null,
    };
  }

  // 4. Check weekday availability (0 = Sunday ... 6 = Saturday)
  const dateUtc = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));
  const weekday = dateUtc.getUTCDay();
  const dayRule = availability.find((a) => a.weekday === weekday);

  if (dayRule && !dayRule.is_available) {
    const dayNames = [
      "Sundays",
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
    ];
    return {
      valid: false,
      error: `This service is not available on ${dayNames[weekday]}.`,
      estimatedTotal: null,
    };
  }

  // 5. Check time slot & window when requires_time_slot is enabled
  let effectiveHour = 9;
  let effectiveMinute = 0;

  if (service.requires_time_slot) {
    if (!requestedTime || !/^\d{2}:\d{2}$/.test(requestedTime.trim())) {
      return {
        valid: false,
        error: "Please select a valid time for this service.",
        estimatedTotal: null,
      };
    }

    const cleanTime = requestedTime.trim();
    const [h, m] = cleanTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return {
        valid: false,
        error: "Selected time is out of valid 24-hour range.",
        estimatedTotal: null,
      };
    }
    effectiveHour = h;
    effectiveMinute = m;

    if (dayRule && dayRule.is_available) {
      const startHHMM = dayRule.start_time.slice(0, 5);
      const endHHMM = dayRule.end_time.slice(0, 5);
      if (cleanTime < startHHMM || cleanTime > endHHMM) {
        return {
          valid: false,
          error: `Requested time (${cleanTime}) must be within the available local window (${startHHMM} – ${endHHMM} ${property.timezone}).`,
          estimatedTotal: null,
        };
      }
    }
  } else if (requestedTime && /^\d{2}:\d{2}$/.test(requestedTime.trim())) {
    const [h, m] = requestedTime.trim().split(":").map(Number);
    effectiveHour = h;
    effectiveMinute = m;
  }

  // 6. Check minimum advance notice in the property's timezone
  const requestedEpochMs = Date.UTC(
    reqYear,
    reqMonth - 1,
    reqDay,
    effectiveHour,
    effectiveMinute,
    0
  );
  const diffHours = (requestedEpochMs - nowLocal.epochMs) / (1000 * 60 * 60);

  if (diffHours < service.advance_notice_hours) {
    return {
      valid: false,
      error: `This service requires at least ${service.advance_notice_hours} hours advance notice (Property timezone: ${property.timezone}).`,
      estimatedTotal: null,
    };
  }

  // 7. Calculate authoritative total from server-side property-service price
  let estimatedTotal: number | null = null;
  if (service.pricing_mode === "fixed") {
    if (service.price === null || service.price === undefined || service.price < 0) {
      return {
        valid: false,
        error: "Service price configuration is incomplete.",
        estimatedTotal: null,
      };
    }
    estimatedTotal = Number((Number(service.price) * quantity).toFixed(2));
  }

  return {
    valid: true,
    estimatedTotal,
  };
}

/**
 * Checks if a custom service name closely matches an existing service in the
 * global templates or the organization's custom catalogue.
 */
export function findPotentialDuplicateCatalogServices(
  candidateNameEn: string,
  candidateNameFr: string,
  existingItems: { id: string; name_en: string; name_fr: string; is_global_template: boolean }[]
) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const targetEn = norm(candidateNameEn);
  const targetFr = norm(candidateNameFr || "");

  return existingItems.filter((item) => {
    const itemEn = norm(item.name_en);
    const itemFr = norm(item.name_fr || "");
    if (!targetEn) return false;
    if (itemEn === targetEn || (targetFr && itemFr === targetFr)) return true;
    if (
      targetEn.length >= 5 &&
      (itemEn.includes(targetEn) || targetEn.includes(itemEn))
    ) {
      return true;
    }
    return false;
  });
}
