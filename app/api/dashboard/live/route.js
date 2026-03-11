import { createServerSupabase } from "@/lib/supabase-server"
import { sortTickets, derivePriority } from "@/lib/priority"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const guildId = env.guildId || "demo"

    const [
      { data: tickets, error: ticketsError },
      { data: events, error: eventsError },
      { data: roles, error: rolesError },
      { data: metrics, error: metricsError },
      { data: categories, error: categoriesError },
      { count: openTickets, error: openError },
      { count: warnsToday, error: warnsError },
      { count: raidAlerts, error: raidsError },
      { count: fraudFlags, error: fraudError }
    ] = await Promise.all([
      supabase.from("tickets").select("*").eq("guild_id", guildId).order("created_at", { ascending: false }).limit(40),
      supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("guild_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }).limit(40),
      supabase.from("staff_metrics").select("*").eq("guild_id", guildId).order("tickets_handled", { ascending: false }).limit(10),
      supabase.from("ticket_categories").select("*").eq("guild_id", guildId).order("name", { ascending: true }),
      supabase.from("tickets").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).eq("status", "open"),
      supabase.from("warns").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("raid_events").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("verification_flags").select("*", { head: true, count: "exact" }).eq("guild_id", guildId).eq("flagged", true)
    ])

    const firstError =
      ticketsError ||
      eventsError ||
      rolesError ||
      metricsError ||
      categoriesError ||
      openError ||
      warnsError ||
      raidsError ||
      fraudError

    if (firstError) {
      throw new Error(firstError.message || "Failed to load dashboard.")
    }

    return new Response(
      JSON.stringify({
        tickets: sortTickets(
          (tickets || []).map((ticket) => ({
            ...ticket,
            priority: ticket.priority || derivePriority(ticket)
          }))
        ),
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
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load dashboard." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    )
  }
}
