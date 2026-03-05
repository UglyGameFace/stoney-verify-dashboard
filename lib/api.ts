import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wrapper for API routes that need Supabase admin.
 */
export async function withAdmin(
  fn: (sb: SupabaseClient) => Promise<any>
) {
  try {
    const sb = requireSupabaseAdmin();
    const data = await fn(sb);

    return NextResponse.json(
      { ok: true, ...data },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 200 }
    );
  }
}
