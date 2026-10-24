import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  deletePropertyServiceRecord,
  updatePropertyServiceRecord,
} from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await context.params;
    const body = await req.json();
    const updated = await updatePropertyServiceRecord(
      serviceId,
      body
    );
    return NextResponse.json({ service: updated });
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
      err instanceof Error ? err.message : "Failed to update property service.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await context.params;
    await deletePropertyServiceRecord(serviceId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to remove property service.";
    const status = msg.startsWith("Forbidden:") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
