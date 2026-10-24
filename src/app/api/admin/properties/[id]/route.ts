import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getAuthorizedPropertyDetail,
  updatePropertyRecord,
} from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const detail = await getAuthorizedPropertyDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch property detail.";
    const status = msg.startsWith("Forbidden:")
      ? 403
      : msg.startsWith("Unauthorized:")
      ? 401
      : msg.startsWith("Not Found:")
      ? 404
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = await updatePropertyRecord(id, body);
    return NextResponse.json({ property: updated });
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
      err instanceof Error ? err.message : "Failed to update property.";
    const status = msg.startsWith("Forbidden:")
      ? 403
      : msg.startsWith("Unauthorized:")
      ? 401
      : msg.startsWith("Not Found:")
      ? 404
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
