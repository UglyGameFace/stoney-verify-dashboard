import Sidebar from "@/components/Sidebar"
import DashboardClient from "@/components/DashboardClient"
import { createServerSupabase } from "@/lib/supabase-server"
import { sortTickets, derivePriority } from "@/lib/priority"
import { getSession } from "@/lib/auth-server"
import { env } from "@/lib/env"

async function getDashboardData() {
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

  return {
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
  }
}

function getEmptyDashboard(errorMessage = "") {
  return {
    tickets: [],
    events: errorMessage ? [{ id: "bootstrap-error", title: "Dashboard bootstrap issue", description: errorMessage, created_at: new Date().toISOString() }] : [],
    roles: [],
    metrics: [],
    categories: [],
    counts: {
      openTickets: 0,
      warnsToday: 0,
      raidAlerts: 0,
      fraudFlags: 0
    }
  }
}

export default async function HomePage() {
  let data = getEmptyDashboard()
  let session = null

  try {
    ;[data, session] = await Promise.all([getDashboardData(), getSession()])
  } catch (error) {
    data = getEmptyDashboard(error.message || "Failed to load dashboard data.")
    session = null
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <DashboardClient initialData={data} staffName={session?.user?.username || env.defaultStaffName} />
      </main>
    </div>
  )
}
