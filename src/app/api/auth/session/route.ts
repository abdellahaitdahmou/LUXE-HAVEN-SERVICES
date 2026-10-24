import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the currently authenticated actor (Supabase Auth session).
 * Sign-in itself happens in the browser via Supabase Auth; this route only
 * reports session state and handles sign-out.
 */
export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ authenticated: false, actor: null });
  }
  return NextResponse.json({ authenticated: true, actor });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "logout") {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 400 }
    );
  }
}
