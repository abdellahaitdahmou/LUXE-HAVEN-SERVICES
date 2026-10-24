import { NextRequest, NextResponse } from "next/server";
import {
  inviteOrganizationMember,
  updateManagerPropertyAssignments,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "update_assignments") {
      const updatedIds = await updateManagerPropertyAssignments(
        body.userId,
        Array.isArray(body.propertyIds) ? body.propertyIds : []
      );
      return NextResponse.json({ assignedPropertyIds: updatedIds });
    }

    if (body.action === "invite_member") {
      const invited = await inviteOrganizationMember(
        {
          full_name: body.full_name,
          email: body.email,
          role: body.role === "admin" ? "admin" : "property_manager",
          assignedPropertyIds: body.assignedPropertyIds || [],
        }
      );
      return NextResponse.json(invited, { status: 201 });
    }

    return NextResponse.json(
      { error: "Unsupported team action." },
      { status: 400 }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Team management operation failed.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
