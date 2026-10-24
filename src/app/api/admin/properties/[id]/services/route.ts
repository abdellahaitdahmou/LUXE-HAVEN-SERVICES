import { NextRequest, NextResponse } from "next/server";
import {
  attachCatalogServicesToProperty,
  createCustomCatalogService,
} from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    // Case 1: Attach existing catalogue service IDs
    if (Array.isArray(body.catalogServiceIds)) {
      const created = await attachCatalogServicesToProperty(
        id,
        body.catalogServiceIds
      );
      return NextResponse.json({ services: created }, { status: 201 });
    }

    // Case 2: Explicitly add a new AI-proposed service (configured by user before activation)
    if (body.customProposal) {
      const res = await createCustomCatalogService(
        {
          ...body.customProposal,
          ignore_duplicate_warning: true,
        },
        id
      );
      return NextResponse.json(res, { status: 201 });
    }

    return NextResponse.json(
      { error: "Provide catalogServiceIds or customProposal." },
      { status: 400 }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to attach services.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
