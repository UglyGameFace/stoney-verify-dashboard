import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value) {
  return String(value || "").trim();
}

export async function POST() {
  let session = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before running raid check.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const supabase = createServerSupabase();
    const cutoff10 = new Date(Date.now() - 10 * 1000).toISOString();
    const cutoff30 = new Date(Date.now() - 30 * 1000).toISOString();

    const [last10, last30] = await Promise.all([
      supabase.from("member_joins").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).gte("joined_at", cutoff10),
      supabase.from("member_joins").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).gte("joined_at", cutoff30),
    ]);

    if (last10.error) throw new Error(last10.error.message || "Failed to check 10-second join window.");
    if (last30.error) throw new Error(last30.error.message || "Failed to check 30-second join window.");

    let severity = null;
    if ((last10.count || 0) >= 5) severity = "warning";
    if ((last30.count || 0) >= 15) severity = "critical";

    if (severity) {
      const { error } = await supabase.from("raid_events").insert({
        guild_id: guildId,
        join_count: Math.max(last10.count || 0, last30.count || 0),
        window_seconds: severity === "critical" ? 30 : 10,
        severity,
        summary: `${severity} raid alert triggered from join velocity`,
      });
      if (error) throw new Error(error.message || "Failed to record raid event.");
    }

    return dashboardAuthJson(
      {
        ok: true,
        selectedGuildId: guildId,
        last10s: last10.count || 0,
        last30s: last30.count || 0,
        severity,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
