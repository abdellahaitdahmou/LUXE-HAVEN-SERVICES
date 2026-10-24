import { NextRequest, NextResponse } from "next/server";
import { syncPropertiesFromHostaway } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await syncPropertiesFromHostaway({
      accountId:
        typeof body?.accountId === "string" ? body.accountId : undefined,
      apiKey: typeof body?.apiKey === "string" ? body.apiKey : undefined,
      defaultWhatsapp:
        typeof body?.defaultWhatsapp === "string"
          ? body.defaultWhatsapp
          : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to sync from Hostaway.";
    const status = msg.startsWith("Forbidden:")
      ? 403
      : msg.startsWith("Unauthorized:")
      ? 401
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
