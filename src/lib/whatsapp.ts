import { formatPricingUnitLabel } from "./i18n";
import { PricingMode, PricingUnit, Property, PropertyService, SupportedLocale } from "./types";

/**
 * Normalizes an international phone number string into E.164 format (+digits)
 * and digits-only format for wa.me links.
 * Supports Moroccan (+212...) and international numbers.
 */
export function normalizePhoneNumber(raw: string): {
  isValid: boolean;
  e164: string;
  internationalDigits: string;
  error?: string;
} {
  if (!raw || typeof raw !== "string") {
    return {
      isValid: false,
      e164: "",
      internationalDigits: "",
      error: "Phone number is required.",
    };
  }

  // Strip spaces, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-().]/g, "");

  // Convert 00 prefix to +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If Moroccan local mobile format 06... or 07..., convert to +2126... or +2127...
  if (/^0[567]\d{8}$/.test(cleaned)) {
    cleaned = "+212" + cleaned.slice(1);
  }

  const digitsOnly = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  if (!/^[1-9]\d{7,14}$/.test(digitsOnly)) {
    return {
      isValid: false,
      e164: "",
      internationalDigits: "",
      error:
        "Must be a valid international phone number (e.g. +212612345678, 8–15 digits).",
    };
  }

  return {
    isValid: true,
    e164: `+${digitsOnly}`,
    internationalDigits: digitsOnly,
  };
}

/**
 * Checks whether a phone number is a seeded demo placeholder (+212600000...)
 * so external handoff can be safely disabled for unconfigured demo contacts.
 */
export function isDemoPlaceholderPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("212600000") || digits.startsWith("000000");
}

export interface ResolvedWhatsAppRecipient {
  source: "service_override" | "property_default";
  e164: string;
  internationalDigits: string;
  label: string;
  isDemoContact: boolean;
}

/**
 * Resolves the effective WhatsApp recipient according to priority:
 * 1. Property-service WhatsApp override
 * 2. Property default host WhatsApp number
 */
export function resolveWhatsAppRecipient(
  property: Pick<
    Property,
    "default_whatsapp" | "default_whatsapp_label" | "is_demo_contact"
  >,
  propertyService?: Pick<
    PropertyService,
    "whatsapp_override" | "whatsapp_override_label" | "is_demo_override_contact"
  > | null
): ResolvedWhatsAppRecipient {
  if (
    propertyService?.whatsapp_override &&
    propertyService.whatsapp_override.trim().length > 0
  ) {
    const normalized = normalizePhoneNumber(propertyService.whatsapp_override);
    if (normalized.isValid) {
      return {
        source: "service_override",
        e164: normalized.e164,
        internationalDigits: normalized.internationalDigits,
        label:
          propertyService.whatsapp_override_label?.trim() ||
          "Service Provider Override",
        isDemoContact:
          Boolean(propertyService.is_demo_override_contact) ||
          isDemoPlaceholderPhone(normalized.e164),
      };
    }
  }

  const normalizedDefault = normalizePhoneNumber(property.default_whatsapp);
  return {
    source: "property_default",
    e164: normalizedDefault.isValid
      ? normalizedDefault.e164
      : property.default_whatsapp,
    internationalDigits: normalizedDefault.isValid
      ? normalizedDefault.internationalDigits
      : property.default_whatsapp.replace(/\D/g, ""),
    label: property.default_whatsapp_label?.trim() || "Property Host (Default)",
    isDemoContact:
      Boolean(property.is_demo_contact) ||
      isDemoPlaceholderPhone(property.default_whatsapp),
  };
}

export interface WhatsAppMessagePayload {
  propertyName: string;
  serviceName: string;
  guestName: string;
  requestedDate: string; // YYYY-MM-DD
  requestedTime?: string | null; // HH:mm
  quantity: number;
  pricingUnit: PricingUnit;
  pricingMode: PricingMode;
  estimatedTotal: number | null;
  currency: string;
  note?: string | null;
  referenceCode: string;
  locale?: SupportedLocale;
}

/**
 * Formats YYYY-MM-DD into human-readable "22 October 2026"
 */
export function formatHumanDate(
  isoDate: string,
  locale: SupportedLocale = "en"
): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const [year, month, day] = parts;
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB";
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);
}

/**
 * Builds the structured WhatsApp request text and encoded click-to-chat URL:
 * https://wa.me/{internationalDigits}?text={encodedMessage}
 */
export function buildWhatsAppRequestMessage(
  payload: WhatsAppMessagePayload,
  internationalDigits: string
): {
  messageText: string;
  waMeUrl: string;
} {
  const unitLabel = formatPricingUnitLabel(
    payload.pricingUnit,
    "en",
    payload.quantity
  );
  const formattedDate = formatHumanDate(payload.requestedDate, "en");

  const totalLine =
    payload.pricingMode === "fixed" && payload.estimatedTotal !== null
      ? `Estimated total: ${Number(payload.estimatedTotal)} ${payload.currency}`
      : `Estimated total: Quote required (${payload.currency})`;

  const lines: string[] = [
    "Hello, I would like to request a service.",
    "",
    `Property: ${payload.propertyName}`,
    `Service: ${payload.serviceName}`,
    `Guest: ${payload.guestName.trim()}`,
    `Date: ${formattedDate}`,
  ];

  if (payload.requestedTime && payload.requestedTime.trim().length > 0) {
    lines.push(`Time: ${payload.requestedTime.trim()}`);
  }

  lines.push(`Quantity: ${payload.quantity} ${unitLabel}`);
  lines.push(totalLine);

  if (payload.note && payload.note.trim().length > 0) {
    lines.push(`Note: ${payload.note.trim()}`);
  }

  lines.push(`Request reference: ${payload.referenceCode}`);
  lines.push("");
  lines.push("Please confirm availability and the final price.");

  const messageText = lines.join("\n");
  const cleanDigits = internationalDigits.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(messageText);
  const waMeUrl = `https://wa.me/${cleanDigits}?text=${encodedMessage}`;

  return {
    messageText,
    waMeUrl,
  };
}
