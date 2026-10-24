import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createPropertyRecord, getDashboardData } from "@/lib/db";

export async function GET(req: NextRequest) {
  const data = await getDashboardData();
  if (!data) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ properties: data.properties });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await createPropertyRecord(body);
    return NextResponse.json({ property: created }, { status: 201 });
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
      err instanceof Error ? err.message : "Failed to create property.";
    const status = msg.startsWith("Forbidden:")
      ? 403
      : msg.startsWith("Unauthorized:")
      ? 401
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
