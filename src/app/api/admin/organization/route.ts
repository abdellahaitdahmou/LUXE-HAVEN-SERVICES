import { NextRequest, NextResponse } from "next/server";
import { updateOrganizationSettings } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateOrganizationSettings(
      {
        name: body.name,
        contact_email: body.contact_email,
        default_currency: body.default_currency || "MAD",
        default_timezone: body.default_timezone || "Africa/Casablanca",
        default_language: body.default_language || "en",
      }
    );
    return NextResponse.json({ organization: updated });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to update organization settings.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
