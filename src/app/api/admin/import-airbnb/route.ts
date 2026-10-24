import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor, getDashboardData } from "@/lib/db";
import { fetchAirbnbListing } from "@/lib/airbnb";

export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url : "";
    if (!url.trim()) {
      return NextResponse.json(
        { error: "Please paste an Airbnb listing link." },
        { status: 400 }
      );
    }

    const listing = await fetchAirbnbListing(url);

    // Make the suggested slug unique within the organization.
    const dashboard = await getDashboardData();
    const taken = new Set(
      (dashboard?.properties || []).map((p) => p.slug.toLowerCase())
    );
    let slug = listing.slug;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${listing.slug}-${n++}`;
    }

    return NextResponse.json({ listing: { ...listing, slug } });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to import from Airbnb.",
      },
      { status: 422 }
    );
  }
}
