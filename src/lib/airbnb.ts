import type { PropertyType } from "./types";

export interface AirbnbImportResult {
  source_url: string;
  name: string;
  slug: string;
  city: string;
  property_type: PropertyType;
  description_en: string;
  description_fr: string;
  photos: string[];
  features: string[];
  map_url: string | null;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Only Airbnb hosts (and its official short-link domain) may be fetched, so the
 * import endpoint cannot be abused as a generic server-side request proxy.
 */
export function isAllowedAirbnbHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    /^(www\.|[a-z]{2}\.)?airbnb\.[a-z.]{2,6}$/.test(h) ||
    h === "abnb.me" ||
    h === "www.abnb.me"
  );
}

export function parseAirbnbUrl(
  raw: string
): { url: string; roomId: string | null } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (!isAllowedAirbnbHost(parsed.hostname)) return null;

  const roomMatch = parsed.pathname.match(/\/rooms\/(?:plus\/)?(\d+)/);
  if (roomMatch) {
    // Strip tracking params and locale prefixes; keep the canonical English page.
    return {
      url: `https://www.airbnb.com/rooms/${roomMatch[1]}`,
      roomId: roomMatch[1],
    };
  }
  // Short links (abnb.me) are resolved by following redirects.
  if (parsed.hostname.toLowerCase().endsWith("abnb.me")) {
    return { url: parsed.toString(), roomId: null };
  }
  return null;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getMeta(html: string, key: string): string {
  const tags = html.match(/<meta\s[^>]*>/gi) || [];
  for (const tag of tags) {
    const keyMatch = tag.match(/(?:property|name)="([^"]+)"/i);
    if (keyMatch && keyMatch[1].toLowerCase() === key) {
      const content = tag.match(/content="([^"]*)"/i);
      if (content) return decodeEntities(content[1]).trim();
    }
  }
  return "";
}

function getJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let fallback: Record<string, unknown> | null = null;
  while ((match = re.exec(html))) {
    try {
      const json = JSON.parse(match[1]);
      const items: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : [json];
      for (const item of items) {
        if (item && typeof item === "object") {
          if (item["@type"] === "VacationRental") return item;
          fallback = fallback || item;
        }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return fallback;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function detectPropertyType(label: string): PropertyType {
  const t = label.toLowerCase();
  if (/riad/.test(t)) return "riad";
  if (/studio|loft/.test(t)) return "studio";
  if (/villa|house|home|bungalow|chalet|cottage/.test(t)) return "villa";
  if (/apartment|rental unit|condo|flat|aparthotel|penthouse/.test(t))
    return "apartment";
  return "other";
}

const FEATURE_KEYWORDS: [string, RegExp][] = [
  ["pool", /\b(pool|piscine)\b/i],
  ["hammam", /\bhammam\b/i],
  ["kitchen", /\b(kitchen|cuisine)\b/i],
  ["wifi", /\b(wi-?fi|internet)\b/i],
  ["air_conditioning", /\b(air[- ]?conditioning|a\/c|climatisation)\b/i],
  ["terrace", /\b(terrace|rooftop|terrasse)\b/i],
  ["garden", /\b(garden|jardin)\b/i],
  ["parking", /\b(parking|garage)\b/i],
  ["beach_proximity", /\b(beach|seaside|sea view|ocean|plage)\b/i],
  ["surf_rack", /\bsurf\b/i],
];

function detectFeatures(text: string): string[] {
  return FEATURE_KEYWORDS.filter(([, re]) => re.test(text)).map(([key]) => key);
}

function cleanPhotoUrl(url: string): string {
  return decodeEntities(url);
}

/**
 * Parses an Airbnb listing page into the fields our property form needs.
 * Throws an Error with a user-friendly message when nothing usable is found.
 */
export function parseAirbnbListing(
  html: string,
  sourceUrl: string
): AirbnbImportResult {
  const ld = getJsonLd(html);
  const ogTitle = getMeta(html, "og:title");
  const ogDescription = getMeta(html, "og:description");
  const ogImage = getMeta(html, "og:image");
  const metaDescription = getMeta(html, "description");

  // On Airbnb room pages: og:description holds the host's listing title and
  // og:title holds "<Type> in <City> · ★rating · beds · baths".
  const ldName = typeof ld?.name === "string" ? ld.name : "";
  const name = (ldName || ogDescription || ogTitle).trim();
  if (!name) {
    throw new Error(
      "Could not read this Airbnb listing. Make sure the link is a public listing (airbnb.com/rooms/...)."
    );
  }

  const ldAddress = (ld?.address || {}) as Record<string, unknown>;
  let city =
    typeof ldAddress.addressLocality === "string"
      ? ldAddress.addressLocality
      : "";
  if (!city) {
    const cityMatch = ogTitle.match(/\bin\s+(.+?)\s*(?:[·•\u00b7\u2022]|$)/i);
    if (cityMatch) city = cityMatch[1];
  }
  city = city.trim();

  const typeLabel = ogTitle.split(/\s+in\s+/i)[0] || "";
  const property_type = detectPropertyType(typeLabel || name);

  const rawDescription =
    (typeof ld?.description === "string" ? ld.description : "") ||
    metaDescription ||
    "";
  const description = rawDescription.replace(/\s+\n/g, "\n").trim().slice(0, 2000);

  let photos: string[] = [];
  if (Array.isArray(ld?.image)) {
    photos = (ld!.image as unknown[])
      .filter((i): i is string => typeof i === "string")
      .map(cleanPhotoUrl);
  } else if (typeof ld?.image === "string") {
    photos = [cleanPhotoUrl(ld.image)];
  }
  if (photos.length === 0 && ogImage) {
    photos = [ogImage];
  }
  photos = photos.filter((p) => /^https?:\/\//.test(p)).slice(0, 10);

  const lat = Number(ld?.latitude);
  const lng = Number(ld?.longitude);
  const map_url =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  return {
    source_url: sourceUrl,
    name: name.slice(0, 120),
    slug: slugify(name) || "property",
    city: city.slice(0, 80),
    property_type,
    description_en: description,
    // Airbnb serves one language per request; reuse it so the guest page isn't empty.
    description_fr: description,
    photos,
    features: detectFeatures(`${name} ${description}`),
    map_url,
  };
}

export async function fetchAirbnbListing(
  rawUrl: string
): Promise<AirbnbImportResult> {
  const target = parseAirbnbUrl(rawUrl);
  if (!target) {
    throw new Error(
      "Please paste a valid Airbnb listing link (e.g. https://www.airbnb.com/rooms/12345678)."
    );
  }

  let res: Response;
  try {
    res = await fetch(target.url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Could not reach Airbnb. Check your connection or try again in a moment."
    );
  }

  // After redirects (short links), make sure we ended up on Airbnb.
  try {
    if (!isAllowedAirbnbHost(new URL(res.url).hostname)) {
      throw new Error("bad host");
    }
  } catch {
    throw new Error("That link does not lead to an Airbnb listing.");
  }

  if (!res.ok) {
    throw new Error(
      `Airbnb returned an error (${res.status}). The listing may be unavailable or private.`
    );
  }

  const html = await res.text();
  const finalUrl = parseAirbnbUrl(res.url)?.url || target.url;
  return parseAirbnbListing(html, finalUrl);
}
