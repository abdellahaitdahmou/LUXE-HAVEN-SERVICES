import { NextRequest, NextResponse } from "next/server";
import { updateServiceRequestStatus } from "@/lib/db";
import { RequestStatusEnum } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const status = RequestStatusEnum.parse(body.status);
    const updated = await updateServiceRequestStatus(
      id,
      status,
      body.manager_notes
    );
    return NextResponse.json({ request: updated });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to update request status.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
