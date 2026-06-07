import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionLike = {
  user?: { discord_id?: string | null; id?: string | null; username?: string | null; name?: string | null } | null;
  discordUser?: { id?: string | null; username?: string | null } | null;
};

type TicketRow = {
  id?: string | null;
  ticket_number?: number | null;
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  status?: string | null;
  claimed_by?: string | null;
  assigned_to?: string | null;
  claimed_by_name?: string | null;
  assigned_to_name?: string | null;
  closed_by?: string | null;
  closed_reason?: string | null;
  closed_at?: string | null;
};

type StaffMetricRow = {
  guild_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  tickets_handled?: number | null;
  approvals?: number | null;
  denials?: number | null;
  avg_response_minutes?: number | null;
  last_active?: string | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeMultiline(value: unknown): string {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function buildJsonResponse(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  return dashboardAuthJson(payload, status, session);
}

function getActorIdentity(session: SessionLike | null | undefined) {
  return {
    actorId: normalizeString(session?.user?.discord_id) || normalizeString(session?.user?.id) || normalizeString(session?.discordUser?.id) || null,
    actorName: normalizeString(session?.user?.username) || normalizeString(session?.discordUser?.username) || normalizeString(session?.user?.name) || env?.defaultStaffName || "Dashboard Staff",
  };
}

function getTicketStatus(ticket: TicketRow | null | undefined): string {
  return normalizeString(ticket?.status).toLowerCase();
}

function mapTicket(ticket: TicketRow | null | undefined) {
  return {
    id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    guild_id: ticket?.guild_id || null,
    user_id: ticket?.user_id || null,
    username: ticket?.username || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    status: ticket?.status || null,
    claimed_by: ticket?.claimed_by || null,
    assigned_to: ticket?.assigned_to || null,
    claimed_by_name: ticket?.claimed_by_name || null,
    assigned_to_name: ticket?.assigned_to_name || null,
    closed_by: ticket?.closed_by || null,
    closed_reason: ticket?.closed_reason || null,
    closed_at: ticket?.closed_at || null,
  };
}

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).eq("guild_id", guildId).single();
  if (error || !data) return null;
  return data as TicketRow;
}

async function fetchStaffMetricOrNull(supabase: ReturnType<typeof createServerSupabase>, guildId: string, staffId: string): Promise<StaffMetricRow | null> {
  const { data } = await supabase.from("staff_metrics").select("*").eq("guild_id", guildId).eq("staff_id", staffId).maybeSingle();
  return (data as StaffMetricRow | null) || null;
}

async function createActivityFeedEvent(supabase: ReturnType<typeof createServerSupabase>, ticket: TicketRow, actorId: string | null, actorName: string, reason: string): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id);
  if (!guildId) return;
  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_closed",
      source: "dashboard",
      actor_user_id: actorId || null,
      actor_name: actorName,
      target_user_id: normalizeString(ticket?.user_id) || null,
      target_name: normalizeString(ticket?.username) || null,
      channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      channel_name: ticket?.channel_name || null,
      ticket_id: ticket?.id || null,
      related_table: "tickets",
      related_id: ticket?.id || null,
      title: "Ticket Closed",
      description: `${actorName} closed ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      reason,
      metadata: {
        ticket_id: ticket?.id || null,
        ticket_number: ticket?.ticket_number || null,
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
        channel_name: ticket?.channel_name || null,
        ticket_status: ticket?.status || null,
        closed_reason: reason,
        staff_id: actorId || null,
        staff_name: actorName,
        source: "dashboard_close_route",
      },
    });
  } catch {}
}

async function updateStaffMetrics(supabase: ReturnType<typeof createServerSupabase>, guildId: string, staffId: string | null, staffName: string): Promise<void> {
  if (!guildId || !staffId) return;
  const metric = await fetchStaffMetricOrNull(supabase, guildId, staffId);
  try {
    await supabase.from("staff_metrics").upsert({ guild_id: guildId, staff_id: staffId, staff_name: staffName, tickets_handled: Number(metric?.tickets_handled || 0) + 1, approvals: Number(metric?.approvals || 0), denials: Number(metric?.denials || 0), avg_response_minutes: Number(metric?.avg_response_minutes || 0), last_active: new Date().toISOString() }, { onConflict: "guild_id,staff_id" });
  } catch {}
}

export async function POST(request: Request, context: { params: { id?: string } }) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) return buildJsonResponse({ error: "Select a server before closing a ticket.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", error_code: "invalid_request", selectedGuildId: guildId }, 400, session);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, session);

    const status = getTicketStatus(ticket);
    if (status === "deleted") return buildJsonResponse({ error: "Cannot close a deleted ticket.", selectedGuildId: guildId }, 409, session);

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    if (!actorId) return buildJsonResponse({ error: "Missing staff identity.", selectedGuildId: guildId }, 401, session);

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = normalizeMultiline(body?.reason) || "Closed by staff";

    if (status === "closed") return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(ticket), staffId: actorId, staffName: actorName, alreadyClosed: true }, 200, session);

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("tickets")
      .update({ status: "closed", closed_by: actorId, closed_reason: reason, closed_at: nowIso, updated_at: nowIso, last_activity_at: nowIso })
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (error || !data) return buildJsonResponse({ error: error?.message || "Failed to close ticket.", selectedGuildId: guildId }, 500, session);

    const updatedTicket = data as TicketRow;
    await Promise.allSettled([
      createActivityFeedEvent(supabase, updatedTicket, actorId, actorName, reason),
      updateStaffMetrics(supabase, guildId, actorId, actorName),
    ]);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(updatedTicket), staffId: actorId, staffName: actorName, alreadyClosed: false }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
