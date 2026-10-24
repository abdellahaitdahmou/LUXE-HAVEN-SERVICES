import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCustomCatalogService, getDashboardData } from "@/lib/db";

export async function GET(req: NextRequest) {
  const data = await getDashboardData();
  if (!data) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    categories: data.categories,
    catalogServices: data.catalogServices,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { attachToPropertyId, ...serviceInput } = body;

    const result = await createCustomCatalogService(
      serviceInput,
      attachToPropertyId || null
    );

    if (result.status === "duplicate_warning") {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: err.errors.map((e) => e.message).join(" "),
          issues: err.errors,
        },
        { status: 400 }
      );
    }
    const msg =
      err instanceof Error ? err.message : "Failed to create custom service.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
