import { createServerSupabase } from "@/lib/supabase-server"
import { sortTickets, derivePriority } from "@/lib/priority"

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const [
      { data: tickets },
      { data: events },
      { data: roles },
      { data: metrics },
      { data: categories },
      { count: openTickets },
      { count: warnsToday },
      { count: raidAlerts },
      { count: fraudFlags }
    ] = await Promise.all([
      supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("guild_roles").select("*").order("position", { ascending: false }).limit(40),
      supabase.from("staff_metrics").select("*").order("tickets_handled", { ascending: false }).limit(10),
      supabase.from("ticket_categories").select("*").order("name", { ascending: true }),
      supabase.from("tickets").select("*", { head: true, count: "exact" }).eq("status", "open"),
      supabase.from("warns").select("*", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("raid_events").select("*", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("verification_flags").select("*", { head: true, count: "exact" }).eq("flagged", true)
    ])

    return Response.json({
      tickets: sortTickets((tickets || []).map((ticket) => ({ ...ticket, priority: ticket.priority || derivePriority(ticket) }))),
      events: events || [],
      roles: roles || [],
      metrics: metrics || [],
      categories: categories || [],
      counts: {
        openTickets: openTickets || 0,
        warnsToday: warnsToday || 0,
        raidAlerts: raidAlerts || 0,
        fraudFlags: fraudFlags || 0
      }
    })
  } catch (error) {
    return Response.json({ error: error.message || "Failed to load dashboard." }, { status: 500 })
  }
}
