import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/db";

export async function GET() {
  try {
    const data = await getDashboardData();
    if (!data) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in." },
        { status: 401 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load dashboard data.",
      },
      { status: 500 }
    );
  }
}
