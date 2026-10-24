import type { PropertyType } from "./types";
import { slugify } from "./airbnb";

const HOSTAWAY_API_BASE = "https://api.hostaway.com/v1";

export interface HostawayCredentials {
  accountId: string;
  apiKey: string;
}

export interface HostawayNormalizedListing {
  hostaway_listing_id: string;
  name: string;
  slug: string;
  city: string;
  property_type: PropertyType;
  description_en: string;
  description_fr: string;
  welcome_message_en: string;
  welcome_message_fr: string;
  photos: string[];
  features: string[];
  map_url: string | null;
  timezone: string;
  currency: string;
  contact_phone: string | null;
}

const FEATURE_PATTERNS: [string, RegExp][] = [
  ["pool", /\b(pool|piscine|swimming)\b/i],
  ["hammam", /\b(hammam|spa|sauna|steam\s*room)\b/i],
  ["kitchen", /\b(kitchen|kitchenette|cuisine|cooking|oven|stove)\b/i],
  ["wifi", /\b(wi-?fi|internet|wireless|broadband)\b/i],
  [
    "air_conditioning",
    /\b(air[- ]?conditioning|a\/c|ac\b|climatisation|cooling)\b/i,
  ],
  ["terrace", /\b(terrace|rooftop|balcony|patio|terrasse|veranda)\b/i],
  ["garden", /\b(garden|backyard|courtyard|jardin|yard)\b/i],
  ["parking", /\b(parking|garage|carport)\b/i],
  [
    "beach_proximity",
    /\b(beach|beachfront|waterfront|seaside|sea\s*view|ocean\s*view|oceanfront|plage)\b/i,
  ],
  ["surf_rack", /\b(surf|surfboard)\b/i],
];

function detectPropertyType(text: string): PropertyType {
  const t = text.toLowerCase();
  if (/\briad\b|\bdar\b/.test(t)) return "riad";
  if (/\bstudio\b|\bloft\b/.test(t)) return "studio";
  if (/\b(villa|house|home|bungalow|chalet|cottage|townhouse|kasbah)\b/.test(t))
    return "villa";
  if (
    /\b(apartment|apt|condo|flat|aparthotel|penthouse|rental\s*unit|suite)\b/.test(
      t
    )
  ) {
    return "apartment";
  }
  return "apartment";
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractFeatures(
  name: string,
  description: string,
  amenities: unknown[]
): string[] {
  const amenityNames = amenities
    .map((a) => {
      if (!a || typeof a !== "object") return "";
      const rec = a as Record<string, unknown>;
      return String(rec.amenityName || rec.name || "");
    })
    .filter(Boolean)
    .join(" ");

  const corpus = `${name} ${description} ${amenityNames}`;
  return FEATURE_PATTERNS.filter(([, re]) => re.test(corpus)).map(
    ([key]) => key
  );
}

function extractPhotos(rawListing: Record<string, unknown>): string[] {
  const urls: string[] = [];

  if (Array.isArray(rawListing.listingImages)) {
    const sorted = [...(rawListing.listingImages as Record<string, unknown>[])]
      .filter((img) => img && typeof img.url === "string")
      .sort(
        (a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
      );
    for (const img of sorted) {
      const u = String(img.url).trim();
      if (/^https?:\/\//i.test(u) && !urls.includes(u)) {
        urls.push(u);
      }
    }
  }

  if (
    urls.length === 0 &&
    typeof rawListing.thumbnailUrl === "string" &&
    /^https?:\/\//i.test(rawListing.thumbnailUrl)
  ) {
    urls.push(rawListing.thumbnailUrl.trim());
  }

  return urls.slice(0, 15);
}

/**
 * Exchanges a Hostaway Account ID and API Key for a Bearer access token.
 */
export async function getHostawayAccessToken(
  creds: HostawayCredentials
): Promise<string> {
  const accountId = creds.accountId.trim();
  const apiKey = creds.apiKey.trim();

  if (!accountId || !apiKey) {
    throw new Error("Hostaway Account ID and API Key are required.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: accountId,
    client_secret: apiKey,
    scope: "general",
  });

  let res: Response;
  try {
    res = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Could not reach the Hostaway API. Please check your internet connection."
    );
  }

  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!res.ok || !payload) {
    const msg =
      typeof payload?.message === "string"
        ? payload.message
        : `Hostaway authentication failed (HTTP ${res.status}). Check your Account ID and API Key.`;
    throw new Error(msg);
  }

  const result = payload.result as Record<string, unknown> | undefined;
  const token =
    typeof payload.access_token === "string"
      ? payload.access_token
      : typeof result?.access_token === "string"
      ? result.access_token
      : "";

  if (!token) {
    throw new Error(
      "Hostaway did not return an access token. Verify your Account ID and API Key."
    );
  }

  return token;
}

/**
 * Normalizes a raw Hostaway listing object into StayBeldi's property structure.
 */
export function normalizeHostawayListing(
  raw: Record<string, unknown>
): HostawayNormalizedListing | null {
  const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  if (!id) return null;

  const rawName = String(
    raw.name ||
      raw.externalListingName ||
      raw.internalListingName ||
      `Property ${id}`
  ).trim();
  const name = rawName.slice(0, 120);

  const city = String(
    raw.city || raw.state || raw.publicAddress || raw.country || "Morocco"
  )
    .trim()
    .slice(0, 80);

  const rawDesc = stripHtml(
    String(raw.description || raw.summary || raw.houseManual || "")
  );
  const description = (
    rawDesc ||
    `${name} in ${city}. Browse our curated in-stay services and experiences.`
  ).slice(0, 2000);

  const typeHint = [
    raw.propertyTypeName,
    raw.roomType,
    raw.internalListingName,
    rawName,
    description.slice(0, 300),
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ");

  const property_type = detectPropertyType(typeHint);
  const amenities = Array.isArray(raw.listingAmenities)
    ? raw.listingAmenities
    : [];
  const features = extractFeatures(name, description, amenities);
  const photos = extractPhotos(raw);

  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const map_url =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  const timezone =
    typeof raw.timeZoneName === "string" && raw.timeZoneName.includes("/")
      ? raw.timeZoneName.trim()
      : "Africa/Casablanca";

  const currency =
    typeof raw.currencyCode === "string" &&
    /^[A-Z]{3}$/i.test(raw.currencyCode.trim())
      ? raw.currencyCode.trim().toUpperCase()
      : "MAD";

  const contactPhone =
    typeof raw.contactPhone === "string" && raw.contactPhone.trim()
      ? raw.contactPhone.trim()
      : typeof raw.phone === "string" && raw.phone.trim()
      ? raw.phone.trim()
      : null;

  return {
    hostaway_listing_id: id,
    name,
    slug: slugify(name) || `property-${id}`,
    city: city || "Morocco",
    property_type,
    description_en: description,
    description_fr: description,
    welcome_message_en: `Welcome to ${name}! Browse our curated extra services below and request any item via WhatsApp.`,
    welcome_message_fr: `Bienvenue à ${name} ! Découvrez nos prestations à la carte ci-dessous et réservez sur WhatsApp.`,
    photos:
      photos.length > 0
        ? photos
        : [
            "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
          ],
    features,
    map_url,
    timezone,
    currency,
    contact_phone: contactPhone,
  };
}

/**
 * Fetches all listings from the authenticated Hostaway account and normalizes them.
 */
export async function fetchHostawayListings(
  creds: HostawayCredentials
): Promise<HostawayNormalizedListing[]> {
  const token = await getHostawayAccessToken(creds);

  const allRaw: Record<string, unknown>[] = [];
  const limit = 200;
  let offset = 0;

  for (let page = 0; page < 10; page++) {
    let res: Response;
    try {
      res = await fetch(
        `${HOSTAWAY_API_BASE}/listings?limit=${limit}&offset=${offset}&includeResources=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        }
      );
    } catch {
      throw new Error("Failed while fetching listings from Hostaway.");
    }

    const payload = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!res.ok || !payload) {
      throw new Error(
        `Hostaway listings request failed (HTTP ${res.status}).`
      );
    }

    const batch = Array.isArray(payload.result)
      ? (payload.result as Record<string, unknown>[])
      : [];

    allRaw.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return allRaw
    .map(normalizeHostawayListing)
    .filter((item): item is HostawayNormalizedListing => item !== null);
}
