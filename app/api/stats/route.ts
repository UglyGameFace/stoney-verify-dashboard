import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CountResult = { count: number | null; error: any };

async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;

  try {
    let q = sb.from(table as any).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const res = (await q) as CountResult;
    if (res?.error) return 0;
    return res?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase admin not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
        pending: 0,
        submitted: 0,
        approved: 0,
        denied: 0,
        kickTimers: 0,
        liveEvents: 0,
        vcSessions: 0,
      },
      { status: 200 }
    );
  }

  // ✅ These table names match your existing dashboard routes:
  // - verification_tokens (tokens)
  // - verification_kick_timers (timers)
  // - audit_logs (audit)
  //
  // If any table doesn't exist, we safely return 0 (no crashes, no build failures).

  const pending = await safeCount("verification_tokens", (q) =>
    q.eq("used", false).eq("decision", "PENDING")
  );

  const submitted = await safeCount("verification_tokens", (q) => q.eq("submitted", true));

  const approved = await safeCount("verification_tokens", (q) => q.eq("decision", "APPROVED"));

  const denied = await safeCount("verification_tokens", (q) => q.eq("decision", "DENIED"));

  const kickTimers = await safeCount("verification_kick_timers");

  // Live events + VC sessions are optional depending on your schema.
  // Keep as 0 unless you add tables later.
  const liveEvents = 0;
  const vcSessions = 0;

  return NextResponse.json(
    {
      ok: true,
      pending,
      submitted,
      approved,
      denied,
      kickTimers,
      liveEvents,
      vcSessions,
    },
    { status: 200 }
  );
}
