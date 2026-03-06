import { withAdmin } from "@/lib/api";

export async function GET() {
  return withAdmin(async (sb) => {
    const [
      pending,
      submitted,
      approved,
      denied,
      kickTimers,
      verifiedConflicts,
      missingVerified,
      missingUnverified,
      boosterOnly,
      staffConflicts,
      vcSessions,
    ] = await Promise.all([
      sb.from("verification_tokens").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("verification_tokens").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      sb.from("verification_tokens").select("*", { count: "exact", head: true }).eq("status", "approved"),
      sb.from("verification_tokens").select("*", { count: "exact", head: true }).eq("status", "denied"),
      sb.from("verification_kick_timers").select("*", { count: "exact", head: true }),
      sb.from("guild_members").select("*", { count: "exact", head: true }).eq("role_state", "verified_conflict"),
      sb.from("guild_members").select("*", { count: "exact", head: true }).eq("role_state", "missing_verified_role"),
      sb.from("guild_members").select("*", { count: "exact", head: true }).eq("role_state", "missing_unverified"),
      sb.from("guild_members").select("*", { count: "exact", head: true }).eq("role_state", "booster_only"),
      sb.from("guild_members").select("*", { count: "exact", head: true }).eq("role_state", "staff_conflict"),
      sb.from("vc_verify_sessions").select("*", { count: "exact", head: true }).in("status", ["PENDING", "ACTIVE"]),
    ]);

    return {
      ok: true,
      pending: pending.count ?? 0,
      submitted: submitted.count ?? 0,
      approved: approved.count ?? 0,
      denied: denied.count ?? 0,
      kickTimers: kickTimers.count ?? 0,
      liveEvents: 0,
      vcSessions: vcSessions.count ?? 0,
      roleConflicts: verifiedConflicts.count ?? 0,
      missingVerifiedRole: missingVerified.count ?? 0,
      missingUnverified: missingUnverified.count ?? 0,
      boosterOnly: boosterOnly.count ?? 0,
      staffConflicts: staffConflicts.count ?? 0,
    };
  });
}
