import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = String(formData.get("folder") || "properties").replace(
      /[^a-z0-9_-]/gi,
      ""
    );

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed formats: JPEG, PNG, WebP, AVIF.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 5MB maximum upload limit." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload into an organization-isolated path:
    // {organization_id}/{folder}/{timestamp}-{filename}
    // The actor was authenticated and resolved above, so the server-side
    // service-role client performs the write into that organization's folder.
    const supabase = createSupabaseServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase Storage is not configured." },
        { status: 500 }
      );
    }
    const bucketName =
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "staybeldi-media";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${actor.organization.id}/${folder}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Image upload failed: ${uploadErr.message}` },
        { status: 502 }
      );
    }

    const { data: pubData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);
    return NextResponse.json({
      url: pubData.publicUrl,
      storagePath,
      provider: "supabase_storage",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Image upload failed.",
      },
      { status: 500 }
    );
  }
}
