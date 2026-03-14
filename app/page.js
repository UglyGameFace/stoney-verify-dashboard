import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardClient from "@/components/DashboardClient";
import { createServerSupabase } from "@/lib/supabase-server";
import { sortTickets, derivePriority } from "@/lib/priority";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

async function getDashboardData() {
  const supabase = createServerSupabase();

  const [
    { data: tickets },
    { data: events },
    { data: roles },
    { data: metrics },
    { data: categories },
    { count: openTickets },
    { count: warnsToday },
    { count: raidAlerts },
    { count: fraudFlags },
  ] = await Promise.all([
    supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(40),
    supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("guild_roles").select("*").order("position", { ascending: false }).limit(40),
    supabase.from("staff_metrics").select("*").order("tickets_handled", { ascending: false }).limit(10),
    supabase.from("ticket_categories").select("*").order("name", { ascending: true }),
    supabase.from("tickets").select("*", { head: true, count: "exact" }).eq("status", "open"),
    supabase.from("warns").select("*", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("raid_events").select("*", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("verification_flags").select("*", { head: true, count: "exact" }).eq("flagged", true),
  ]);

  return {
    tickets: sortTickets(
      (tickets || []).map((ticket) => ({
        ...ticket,
        priority: ticket.priority || derivePriority(ticket),
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
      fraudFlags: fraudFlags || 0,
    },
  };
}

export default async function HomePage() {
  const session = await getSession();

  if (!session?.isStaff) {
    if (hasDiscordOAuthConfig()) {
      redirect(getDiscordLoginUrl());
    }

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#09090b",
          color: "white",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h1 style={{ marginTop: 0 }}>Login Required</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
            Discord staff login is required to use this dashboard.
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            OAuth configuration is currently missing or incomplete.
          </p>
        </div>
      </main>
    );
  }

  const data = await getDashboardData();

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <DashboardClient
          initialData={data}
          staffName={session?.user?.username || env.defaultStaffName}
        />
      </main>
    </div>
  );
}
