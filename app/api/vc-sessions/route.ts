import { withAdmin } from "@/lib/api";

const TABLE_CANDIDATES = [
  "vc_sessions",
  "verification_vc_sessions",
];

export async function GET() {
  return withAdmin(async (sb) => {

    for (const table of TABLE_CANDIDATES) {
      const { data, error } = await sb
        .from(table as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);

      if (!error) {
        const rows = (data || []).map((r: any) => ({
          id: r.id ?? null,
          token: r.token ?? null,
          user_id: r.user_id ?? r.requester_id ?? null,
          staff_id: r.staff_id ?? r.started_by ?? null,
          guild_id: r.guild_id ?? null,
          ticket_channel_id: r.ticket_channel_id ?? r.channel_id ?? null,
          vc_channel_id: r.vc_channel_id ?? null,
          status: r.status ?? "active",
          started_at: r.started_at ?? null,
          ended_at: r.ended_at ?? null,
        }));

        return { table, rows };
      }
    }

    return { table: null, rows: [] };
  });
}
