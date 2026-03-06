import { withAdmin } from "@/lib/api";

const VALID_STATUSES = new Set([
  "pending",
  "submitted",
  "approved",
  "denied",
  "resubmit",
  "used",
  "expired",
]);

function normalizeLegacyStatus(row: any) {
  const explicit = String(row?.status || "").trim().toLowerCase();
  if (VALID_STATUSES.has(explicit)) return explicit;

  const decision = String(row?.decision || "").trim().toUpperCase();
  const used = !!row?.used;
  const submitted = !!row?.submitted;
  const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : NaN;

  if (decision.startsWith("APPROVED")) return "approved";
  if (decision.startsWith("DENIED")) return "denied";
  if (decision.startsWith("RESUBMIT")) return "resubmit";
  if (submitted) return "submitted";
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) return "expired";
  if (used) return "used";
  return "pending";
}

export async function GET() {
  return withAdmin(async (sb) => {
    const [tokensRes, timersRes, membersRes, vcSessionsRes] = await Promise.all([
      sb.from("verification_tokens").select("token,status,decision,used,submitted,expires_at"),
      sb.from("verification_kick_timers").select("channel_id"),
      sb.from("guild_members").select("role_state"),
      sb.from("vc_verify_sessions").select("token,status"),
    ]);

    if (tokensRes.error) throw new Error(tokensRes.error.message);
    if (timersRes.error) throw new Error(timersRes.error.message);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (vcSessionsRes.error) throw new Error(vcSessionsRes.error.message);

    let pending = 0;
    let submitted = 0;
    let approved = 0;
    let denied = 0;

    for (const row of tokensRes.data || []) {
      const status = normalizeLegacyStatus(row);
      if (status === "pending") pending += 1;
      if (status === "submitted") submitted += 1;
      if (status === "approved") approved += 1;
      if (status === "denied") denied += 1;
    }

    let roleConflicts = 0;
    let missingVerifiedRole = 0;
    let missingUnverified = 0;
    let boosterOnly = 0;
    let staffConflicts = 0;

    for (const row of membersRes.data || []) {
      const roleState = String(row?.role_state || "").toLowerCase();
      if (roleState === "verified_conflict") roleConflicts += 1;
      if (roleState === "missing_verified_role") missingVerifiedRole += 1;
      if (roleState === "missing_unverified") missingUnverified += 1;
      if (roleState === "booster_only") boosterOnly += 1;
      if (roleState === "staff_conflict") staffConflicts += 1;
    }

    const vcSessions = (vcSessionsRes.data || []).filter((row: any) => {
      const status = String(row?.status || "").toUpperCase();
      return status === "PENDING" || status === "ACTIVE";
    }).length;

    return {
      pending,
      submitted,
      approved,
      denied,
      kickTimers: (timersRes.data || []).length,
      liveEvents: 0,
      vcSessions,
      roleConflicts,
      missingVerifiedRole,
      missingUnverified,
      boosterOnly,
      staffConflicts,
    };
  });
}
