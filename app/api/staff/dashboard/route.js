import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function rows(queryFactory) {
  try {
    const response = await queryFactory();
    return Array.isArray(response?.data) ? response.data : [];
  } catch {
    return [];
  }
}

async function count(queryFactory) {
  try {
    const response = await queryFactory();
    return Number(response?.count || 0);
  } catch {
    return 0;
  }
}

function normalizeMember(member) {
  return {
    ...member,
    guild_id: member?.guild_id || null,
    user_id: member?.user_id || null,
    username: member?.username || null,
    display_name: member?.display_name || member?.username || member?.user_id || "Member",
    avatar_url: member?.avatar_url || null,
    role_ids: safeArray(member?.role_ids),
    role_names: safeArray(member?.role_names),
    roles: safeArray(member?.roles),
    in_guild: member?.in_guild !== false,
    has_staff_role: Boolean(member?.has_staff_role),
    has_verified_role: Boolean(member?.has_verified_role),
    has_unverified: Boolean(member?.has_unverified),
    role_state: member?.role_state || "unknown",
  };
}

function normalizeTicket(ticket) {
  return {
    ...ticket,
    id: ticket?.id || null,
    guild_id: ticket?.guild_id || null,
    user_id: ticket?.user_id || null,
    username: ticket?.username || null,
    title: ticket?.title || ticket?.channel_name || "Ticket",
    category: ticket?.category || ticket?.matched_category_name || null,
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
  };
}

function normalizeCategory(category) {
  return {
    ...category,
    id: category?.id || null,
    guild_id: category?.guild_id || null,
    name: category?.name || "Support",
    slug: category?.slug || "support",
    intake_type: category?.intake_type || "general",
    button_label: category?.button_label || `Open ${String(category?.name || "Support").trim()} Ticket`,
    staff_role_ids: safeArray(category?.staff_role_ids),
    staff_role_names: safeArray(category?.staff_role_names),
    match_keywords: safeArray(category?.match_keywords),
    form_questions: safeArray(category?.form_questions),
  };
}

export async function GET() {
  let session = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);

    if (!guildId) {
      return dashboardAuthJson({ ok: false, error: "Select a server before opening the staff dashboard.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }

    const supabase = createServerSupabase();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [ticketsRaw, categoriesRaw, membersRaw, rolesRaw, metricsRaw, recentJoinsRaw, warnsToday, raidAlerts, fraudFlags] = await Promise.all([
      rows(() => supabase.from("tickets").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(300)),
      rows(() => supabase.from("ticket_categories").select("*").eq("guild_id", guildId).order("sort_order", { ascending: true }).order("name", { ascending: true })),
      rows(() => supabase.from("guild_members").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(500)),
      rows(() => supabase.from("guild_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }).limit(120)),
      rows(() => supabase.from("staff_metrics").select("*").eq("guild_id", guildId).order("tickets_handled", { ascending: false }).limit(50)),
      rows(() => supabase.from("member_joins").select("*").eq("guild_id", guildId).order("joined_at", { ascending: false }).limit(50)),
      count(() => supabase.from("warns").select("*", { count: "exact", head: true }).eq("guild_id", guildId).gte("created_at", since24h)),
      count(() => supabase.from("raid_events").select("*", { count: "exact", head: true }).eq("guild_id", guildId).gte("created_at", since24h)),
      count(() => supabase.from("verification_flags").select("*", { count: "exact", head: true }).eq("guild_id", guildId).eq("flagged", true)),
    ]);

    const tickets = safeArray(ticketsRaw).map(normalizeTicket);
    const members = safeArray(membersRaw).map(normalizeMember);
    const categories = safeArray(categoriesRaw).map(normalizeCategory);
    const activeTickets = tickets.filter((ticket) => ["open", "claimed"].includes(clean(ticket.status).toLowerCase()));

    return dashboardAuthJson({
      ok: true,
      selectedGuildId: guildId,
      generated_at: new Date().toISOString(),
      staffUserId: session.user.discord_id,
      viewer: {
        id: session.user.discord_id,
        discord_id: session.user.discord_id,
        username: session.user.username,
        display_name: session.member.display_name,
        avatar_url: session.user.avatar_url,
        isStaff: true,
        isServerManager: session.isServerManager,
        access_label: session.member.access_label,
        role_names: session.member.roles,
      },
      tickets,
      activeTickets,
      categories,
      roles: safeArray(rolesRaw),
      metrics: safeArray(metricsRaw),
      guildMembers: members,
      members,
      memberRows: members,
      recentJoins: safeArray(recentJoinsRaw),
      events: [],
      warns: [],
      raids: [],
      fraud: [],
      fraudFlagsList: [],
      memberCounts: {
        tracked: members.length,
        active: members.filter((member) => member.in_guild).length,
        former: members.filter((member) => !member.in_guild).length,
        pendingVerification: members.filter((member) => member.has_unverified).length,
        verified: members.filter((member) => member.has_verified_role).length,
        staff: members.filter((member) => member.has_staff_role).length,
      },
      counts: {
        openTickets: activeTickets.length,
        warnsToday,
        raidAlerts,
        fraudFlags,
      },
    }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
