import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wrap a route handler that needs Supabase Admin.
 * - If Supabase env vars are missing, returns a nice JSON response instead of crashing.
 * - Makes TypeScript happy (sb is NEVER null inside the handler).
 */
export async function withAdmin<T>(
  fn: (sb: SupabaseClient) => Promise<T>
) {
  try {
    const sb = requireSupabaseAdmin();
    const data = await fn(sb);
    return NextResponse.json({ ok: true, ...data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 200 }
    );
  }
}

/**
 * Same as withAdmin, but returns raw NextResponse if you want full control.
 */
export async function withAdminResponse(
  fn: (sb: SupabaseClient) => Promise<Response>
) {
  try {
    const sb = requireSupabaseAdmin();
    return await fn(sb);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 200 }
    );
  }
}
