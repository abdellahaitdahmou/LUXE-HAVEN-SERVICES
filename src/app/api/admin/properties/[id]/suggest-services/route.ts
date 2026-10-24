import { NextRequest, NextResponse } from "next/server";
import { generateServiceSuggestionsForProperty } from "@/lib/ai-suggestions";
import { getAuthorizedPropertyDetail } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const detail = await getAuthorizedPropertyDetail(id);

    let bodyOverrides: Partial<{
      property_type: typeof detail.property.property_type;
      city: string;
      features: string[];
    }> = {};
    try {
      bodyOverrides = await req.json();
    } catch {
      // Optional body
    }

    const alreadyAttachedCatalogIds = detail.services
      .map((s) => s.catalog_service_id)
      .filter((cid): cid is string => Boolean(cid));

    const alreadyAttachedNames = detail.services.map((s) => s.name_en);

    const suggestions = await generateServiceSuggestionsForProperty({
      property: {
        id: detail.property.id,
        name: detail.property.name,
        property_type:
          bodyOverrides.property_type || detail.property.property_type,
        city: bodyOverrides.city || detail.property.city,
        features: bodyOverrides.features || detail.property.features,
        description_en: detail.property.description_en,
      },
      availableCatalog: detail.catalogServices,
      alreadyAttachedCatalogIds,
      alreadyAttachedNames,
    });

    return NextResponse.json(suggestions);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to generate service suggestions.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
