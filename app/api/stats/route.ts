import { withAdmin } from "@/lib/api";

export async function GET() {
  return withAdmin(async (sb) => {
    const pending = await sb
      .from("verification_tokens")
      .select("*", { count: "exact", head: true })
      .eq("used", false)
      .eq("decision", "PENDING");

    const submitted = await sb
      .from("verification_tokens")
      .select("*", { count: "exact", head: true })
      .eq("submitted", true);

    const approved = await sb
      .from("verification_tokens")
      .select("*", { count: "exact", head: true })
      .eq("decision", "APPROVED");

    const denied = await sb
      .from("verification_tokens")
      .select("*", { count: "exact", head: true })
      .eq("decision", "DENIED");

    const kickTimers = await sb
      .from("verification_kick_timers")
      .select("*", { count: "exact", head: true });

    return {
      pending: pending.count ?? 0,
      submitted: submitted.count ?? 0,
      approved: approved.count ?? 0,
      denied: denied.count ?? 0,
      kickTimers: kickTimers.count ?? 0,
      liveEvents: 0,
      vcSessions: 0,
    };
  });
}
