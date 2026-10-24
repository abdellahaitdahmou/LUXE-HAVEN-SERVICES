import {
  AISuggestionItem,
  AISuggestionResponse,
  Property,
  ServiceCatalogItem,
} from "./types";

/**
 * Generates contextual service suggestions for a property on the server.
 * 1. Matches against existing catalogue services (global templates + org custom catalogue) first.
 * 2. Proposes new property-tailored services that are NOT yet attached to the property.
 * 3. Uses server-side AI API (AI_API_KEY) when configured; falls back cleanly to
 *    clearly labelled rule-based suggestions when the key is missing or the request fails.
 * 4. Never activates services automatically, never invents availability, and never publishes prices without explicit user configuration.
 */
export async function generateServiceSuggestionsForProperty(params: {
  property: Pick<
    Property,
    "id" | "name" | "property_type" | "city" | "features" | "description_en"
  >;
  availableCatalog: ServiceCatalogItem[];
  alreadyAttachedCatalogIds: string[];
  alreadyAttachedNames: string[];
}): Promise<AISuggestionResponse> {
  const {
    property,
    availableCatalog,
    alreadyAttachedCatalogIds,
    alreadyAttachedNames,
  } = params;

  const attachedIdSet = new Set(alreadyAttachedCatalogIds);
  const attachedNameSet = new Set(
    alreadyAttachedNames.map((n) => n.toLowerCase().trim())
  );

  const aiKey = process.env.AI_API_KEY?.trim();
  const aiBaseUrl =
    process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const aiModel = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

  if (aiKey && aiKey.length > 5) {
    try {
      const catalogContext = availableCatalog.map((c) => ({
        id: c.id,
        source: c.is_global_template ? "global_template" : "org_catalog",
        name_en: c.name_en,
        name_fr: c.name_fr,
        category_key: c.category_key,
        description_en: c.description_en,
      }));

      const prompt = `You are a Moroccan hospitality concierge advisor for LUXE HAVEN.
Property Name: ${property.name}
Property Type: ${property.property_type}
City / Location: ${property.city}, Morocco
Features: ${property.features.join(", ") || "standard"}
Already attached services: ${alreadyAttachedNames.join(", ") || "none"}

Existing Catalogue Services to match first:
${JSON.stringify(catalogContext)}

Return a JSON object with a "suggestions" array of 4 to 5 relevant extra services for this property that are NOT already attached.
Match existing catalogue services first (include their "matched_catalog_id") before proposing 1 or 2 new tailored services ("matched_catalog_id": null).
Do NOT invent confirmed provider availability or auto-publish prices.
Each item must have:
- matched_catalog_id (string or null)
- name_en, name_fr
- category_key (one of: transport, food_drinks, cleaning, wellness, activities, property_extras)
- description_en, description_fr
- reason_en, reason_fr (brief explanation of why it suits a ${property.property_type} in ${property.city} with features [${property.features.join(", ")}])`;

      const res = await fetch(`${aiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You output valid JSON only with a top-level 'suggestions' array.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
            const mapped: AISuggestionItem[] = parsed.suggestions.map(
              (item: Record<string, unknown>, idx: number) => {
                const matched = availableCatalog.find(
                  (c) =>
                    c.id === item.matched_catalog_id ||
                    c.name_en.toLowerCase() ===
                      String(item.name_en || "").toLowerCase()
                );

                return {
                  id: `ai-sug-${idx}-${Date.now()}`,
                  matched_catalog_id: matched ? matched.id : null,
                  match_source: matched
                    ? matched.is_global_template
                      ? "global_template"
                      : "org_catalog"
                    : "new_ai_proposal",
                  name_en: matched ? matched.name_en : String(item.name_en || "Custom Service"),
                  name_fr: matched
                    ? matched.name_fr
                    : String(item.name_fr || item.name_en || "Service sur mesure"),
                  category_key: matched
                    ? matched.category_key
                    : String(item.category_key || "activities"),
                  description_en: matched
                    ? matched.description_en
                    : String(item.description_en || ""),
                  description_fr: matched
                    ? matched.description_fr
                    : String(item.description_fr || item.description_en || ""),
                  reason_en: String(
                    item.reason_en ||
                      `Tailored for your ${property.property_type} in ${property.city}.`
                  ),
                  reason_fr: String(
                    item.reason_fr ||
                      `Adapté à votre ${property.property_type} à ${property.city}.`
                  ),
                  default_pricing_mode: matched
                    ? matched.default_pricing_mode
                    : "quote",
                  suggested_price: matched ? matched.suggested_price : null,
                  default_pricing_unit: matched
                    ? matched.default_pricing_unit
                    : "per_person",
                  requires_time_slot: matched ? matched.requires_time_slot : true,
                  default_advance_notice_hours: matched
                    ? matched.default_advance_notice_hours
                    : 24,
                };
              }
            );

            return {
              provider: "ai",
              property_id: property.id,
              suggestions: mapped,
            };
          }
        }
      }
    } catch (err) {
      return buildRuleBasedSuggestions({
        property,
        availableCatalog,
        attachedIdSet,
        attachedNameSet,
        fallbackReason:
          err instanceof Error
            ? `AI request failed (${err.message}); showing rule-based suggestions.`
            : "AI request failed; showing rule-based suggestions.",
      });
    }
  }

  return buildRuleBasedSuggestions({
    property,
    availableCatalog,
    attachedIdSet,
    attachedNameSet,
    fallbackReason:
      "AI_API_KEY is not configured in environment variables — using deterministic rule-based hospitality suggestions.",
  });
}

function buildRuleBasedSuggestions(params: {
  property: Pick<
    Property,
    "id" | "name" | "property_type" | "city" | "features" | "description_en"
  >;
  availableCatalog: ServiceCatalogItem[];
  attachedIdSet: Set<string>;
  attachedNameSet: Set<string>;
  fallbackReason: string;
}): AISuggestionResponse {
  const {
    property,
    availableCatalog,
    attachedIdSet,
    attachedNameSet,
    fallbackReason,
  } = params;

  const features = new Set(property.features.map((f) => f.toLowerCase()));
  const cityLower = property.city.toLowerCase();
  const isCoastal =
    features.has("beach_proximity") ||
    features.has("surf_rack") ||
    cityLower.includes("agadir") ||
    cityLower.includes("tamraght") ||
    cityLower.includes("taghazout") ||
    cityLower.includes("essaouira");

  const suggestions: AISuggestionItem[] = [];

  // Score unattached catalogue items based on property type, features, and location
  const scoredCatalog = availableCatalog
    .filter(
      (c) =>
        !attachedIdSet.has(c.id) &&
        !attachedNameSet.has(c.name_en.toLowerCase().trim())
    )
    .map((c) => {
      let score = 1;
      let reasonEn = `High-demand guest service for ${property.property_type} stays in ${property.city}.`;
      let reasonFr = `Prestation très demandée pour un séjour en ${property.property_type} à ${property.city}.`;

      if (c.recommended_property_types.includes(property.property_type)) {
        score += 2;
      }

      const matchedFeatures = c.recommended_features.filter((f) =>
        features.has(f.toLowerCase())
      );
      if (matchedFeatures.length > 0) {
        score += matchedFeatures.length * 4;
        reasonEn = `Matches your property's ${matchedFeatures
          .join(" & ")
          .replace(/_/g, " ")} feature in ${property.city}.`;
        reasonFr = `Correspond aux équipements (${matchedFeatures.join(
          ", "
        )}) de votre logement à ${property.city}.`;
      }

      if (
        isCoastal &&
        (c.name_en.toLowerCase().includes("surf") ||
          c.name_en.toLowerCase().includes("dunes"))
      ) {
        score += 5;
        reasonEn = `Ideal for coastal guests staying near the beach in ${property.city}.`;
        reasonFr = `Idéal pour les voyageurs séjournant près de l'océan à ${property.city}.`;
      }

      if (
        (property.property_type === "villa" ||
          property.property_type === "riad") &&
        (c.category_key === "wellness" || c.name_en.toLowerCase().includes("chef"))
      ) {
        score += 4;
        reasonEn = `Elevates private ${property.property_type} hospitality in ${property.city}.`;
        reasonFr = `Valorise l'expérience privée de votre ${property.property_type} à ${property.city}.`;
      }

      return { item: c, score, reasonEn, reasonFr };
    })
    .sort((a, b) => b.score - a.score);

  // Pick top 4 existing catalogue matches first
  for (const match of scoredCatalog.slice(0, 4)) {
    const c = match.item;
    suggestions.push({
      id: `rule-cat-${c.id}`,
      matched_catalog_id: c.id,
      match_source: c.is_global_template ? "global_template" : "org_catalog",
      name_en: c.name_en,
      name_fr: c.name_fr || c.name_en,
      category_key: c.category_key,
      description_en: c.description_en,
      description_fr: c.description_fr || c.description_en,
      reason_en: match.reasonEn,
      reason_fr: match.reasonFr,
      default_pricing_mode: c.default_pricing_mode,
      suggested_price: c.suggested_price,
      default_pricing_unit: c.default_pricing_unit,
      requires_time_slot: c.requires_time_slot,
      default_advance_notice_hours: c.default_advance_notice_hours,
    });
  }

  // Also propose 2 tailored new services based on location & property features
  if (isCoastal) {
    const nameEn = `Private Coastal Quad & Argan Forest Ride (${property.city})`;
    if (!attachedNameSet.has(nameEn.toLowerCase())) {
      suggestions.push({
        id: "rule-new-coastal-quad",
        matched_catalog_id: null,
        match_source: "new_ai_proposal",
        name_en: nameEn,
        name_fr: `Balade Privée en Quad Côte & Forêt d'Arganiers (${property.city})`,
        category_key: "activities",
        description_en:
          "Guided 2-hour off-road quad adventure along coastal trails and argan groves with hotel pickup.",
        description_fr:
          "Excursion guidée de 2h en quad sur les pistes côtières et forêts d'arganiers avec prise en charge au logement.",
        reason_en: `Proposed specifically for adventure-seeking coastal guests in ${property.city}.`,
        reason_fr: `Suggéré spécifiquement pour les séjours côtiers à ${property.city}.`,
        default_pricing_mode: "quote",
        suggested_price: null,
        default_pricing_unit: "per_person",
        requires_time_slot: true,
        default_advance_notice_hours: 24,
      });
    }
  } else {
    const nameEn = `Artisan Medina Souk & Craft Private Guide (${property.city})`;
    if (!attachedNameSet.has(nameEn.toLowerCase())) {
      suggestions.push({
        id: "rule-new-medina-guide",
        matched_catalog_id: null,
        match_source: "new_ai_proposal",
        name_en: nameEn,
        name_fr: `Visite Privée des Souks & Artisans (${property.city})`,
        category_key: "activities",
        description_en:
          "Half-day private cultural walk with a licensed local historian exploring authentic workshops and souks.",
        description_fr:
          "Demi-journée avec guide officiel à la découverte des ateliers d'artisans et des souks.",
        reason_en: `Tailored for cultural travellers staying at a ${property.property_type} in ${property.city}.`,
        reason_fr: `Pensé pour les voyageurs séjournant en ${property.property_type} à ${property.city}.`,
        default_pricing_mode: "quote",
        suggested_price: null,
        default_pricing_unit: "per_booking",
        requires_time_slot: true,
        default_advance_notice_hours: 24,
      });
    }
  }

  if (features.has("kitchen")) {
    const groceryName = "Pre-Arrival Beldi Pantry & Fresh Fruit Basket";
    if (!attachedNameSet.has(groceryName.toLowerCase())) {
      suggestions.push({
        id: "rule-new-pantry-pack",
        matched_catalog_id: null,
        match_source: "new_ai_proposal",
        name_en: groceryName,
        name_fr: "Panier d'Arrivée Beldi & Fruits Frais du Marché",
        category_key: "food_drinks",
        description_en:
          "Stock your kitchen before check-in with organic olive oil, amlou, Souss honey, seasonal fruits, mint, tea, and bottled water.",
        description_fr:
          "Votre cuisine garnie avant votre arrivée : huile d'olive, amlou, miel local, fruits de saison, menthe fraîche et eau minérale.",
        reason_en:
          "Suits properties equipped with a kitchen so arriving guests have immediate local essentials.",
        reason_fr:
          "Idéal pour les logements dotés d'une cuisine afin d'accueillir les voyageurs dès l'arrivée.",
        default_pricing_mode: "fixed",
        suggested_price: 280,
        default_pricing_unit: "per_booking",
        requires_time_slot: false,
        default_advance_notice_hours: 24,
      });
    }
  }

  return {
    provider: "rule_based_fallback",
    fallback_reason: fallbackReason,
    property_id: property.id,
    suggestions: suggestions.slice(0, 6),
  };
}
