import { NextRequest, NextResponse } from "next/server";
import { getPublicPropertyBySlug } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const data = await getPublicPropertyBySlug(slug);
    if (!data) {
      return NextResponse.json(
        { error: "Published property not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load property page.",
      },
      { status: 500 }
    );
  }
}
