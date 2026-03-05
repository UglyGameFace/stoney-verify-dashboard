// app/api/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Staff stats derived from audit log.
 * Works even if you don't have a dedicated stats table.
 */
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();

  // Try common audit tables
  const candidates = ["audit_logs", "verification_audit_logs", "stoney_audit_logs"];
  let data: any[] | null = null;

  for (const table of candidates) {
    const res = await sb.from(table as any).select("*").order("at", { ascending: false }).limit(1000);
    if (!res.error) {
      data = res.data as any[];
      break;
    }
  }

  const rows = (data || []) as any[];

  const agg = new Map<string, { actor_id: string | null; actor_name: string | null; approvals: number; denials: number; resubmits: number; total: number }>();

  for (const r of rows) {
    const actor_id = (r.actor_id ?? r.staff_id ?? r.actorId ?? null) as string | null;
    const actor_name = (r.actor_name ?? r.staff_name ?? r.actorName ?? null) as string | null;
    const action = String(r.action ?? r.type ?? "").toUpperCase();

    const key = actor_id || actor_name || "unknown";
    const cur = agg.get(key) || { actor_id, actor_name, approvals: 0, denials: 0, resubmits: 0, total: 0 };

    if (action.includes("APPROV")) cur.approvals += 1;
    else if (action.includes("DENY")) cur.denials += 1;
    else if (action.includes("RESUBMIT")) cur.resubmits += 1;

    cur.total += 1;
    agg.set(key, cur);
  }

  return NextResponse.json({ rows: Array.from(agg.values()) });
}
