// app/api/decision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  token?: string;
  decision?: string; // "APPROVED" | "DENIED" | "RESUBMIT REQUESTED" | etc
};

function normalizeDecision(d: string) {
  const s = (d || "").trim().toUpperCase();
  if (!s) return "PENDING";
  if (s === "APPROVE") return "APPROVED";
  if (s === "DENY") return "DENIED";
  if (s === "RESUBMIT") return "RESUBMIT REQUESTED";
  return s;
}

function auditActionFromDecision(decision: string) {
  if (decision.startsWith("APPROVED")) return "approve_token";
  if (decision.startsWith("DENIED")) return "deny_token";
  if (decision.startsWith("RESUBMIT")) return "resubmit_token";
  return "set_decision";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const decision = normalizeDecision(String(body.decision || ""));
  const decidedAt = new Date().toISOString();

  // Mark "used" for final decisions only
  const isFinal = decision.startsWith("APPROVED") || decision.startsWith("DENIED");

  // If resubmit: keep token not-used so it can be used again (and allow new uploads)
  const usedValue = isFinal ? true : false;

  const { error: updErr } = await sb
    .from("verification_tokens")
    .update({
      decision,
      decided_by: session.userId,
      decided_at: decidedAt,
      used: usedValue,
      updated_at: decidedAt,
    })
    .eq("token", token);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Audit log uses YOUR schema: action, token, staff_id, meta, created_at(auto)
  const action = auditActionFromDecision(decision);
  const { error: auditErr } = await sb.from("audit_logs").insert([
    {
      action,
      token,
      staff_id: session.userId,
      meta: {
        decision,
        staff_username: session.username,
      },
    },
  ]);

  // Don’t fail the main action if audit insert fails
  if (auditErr) {
    return NextResponse.json({ success: true, auditWarning: auditErr.message });
  }

  return NextResponse.json({ success: true });
}
