import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createGuestServiceRequest } from "@/lib/db";

/**
 * Public visitors MUST NOT be able to list or read service requests.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Forbidden: Public visitors are not permitted to list or view guest service requests.",
    },
    { status: 403 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const forwardedFor =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "anonymous-guest";

    const result = await createGuestServiceRequest(body, forwardedFor);
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
    const message =
      err instanceof Error ? err.message : "Failed to prepare service request.";
    const status = message.toLowerCase().includes("too many") ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
