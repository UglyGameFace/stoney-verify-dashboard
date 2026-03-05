import { withAdmin } from "@/lib/api";

const TABLE_CANDIDATES = [
  "transcripts",
  "ticket_transcripts",
  "verification_transcripts",
];

export async function GET() {
  return withAdmin(async (sb) => {

    for (const table of TABLE_CANDIDATES) {
      const { data, error } = await sb
        .from(table as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error) {
        const rows = (data || []).map((r: any) => ({
          id: r.id ?? null,
          ticket_channel_id: r.ticket_channel_id ?? r.channel_id ?? null,
          ticket_name: r.ticket_name ?? r.channel_name ?? null,
          url: r.url ?? r.html_url ?? null,
          created_at: r.created_at ?? null,
        }));

        return { table, rows };
      }
    }

    return { table: null, rows: [] };
  });
}
