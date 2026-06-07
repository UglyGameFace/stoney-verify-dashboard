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
  deleted_at?: string | null;
};

type StaffDirectoryRow = {
  staff_id?: string | null;
  user_id?: string | null;
  discord_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  staff_name?: string | null;
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

function getCurrentAssigneeId(ticket: TicketRow | null | undefined): string {
  return normalizeString(ticket?.assigned_to || ticket?.claimed_by);
}

function getCurrentAssigneeName(ticket: TicketRow | null | undefined): string {
  return normalizeString(ticket?.assigned_to_name || ticket?.claimed_by_name);
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
    deleted_at: ticket?.deleted_at || null,
  };
}

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).eq("guild_id", guildId).single();
  if (error || !data) return null;
  return data as TicketRow;
}

async function resolveAssigneeIdentity(supabase: ReturnType<typeof createServerSupabase>, guildId: string, rawAssignee: string): Promise<{ assigneeId: string; assigneeName: string }> {
  const clean = normalizeString(rawAssignee);
  if (!clean) return { assigneeId: "", assigneeName: "" };
  const candidateColumns = ["staff_id", "user_id", "discord_id"];
  for (const column of candidateColumns) {
    try {
      const { data, error } = await supabase.from("staff_metrics").select("*").eq("guild_id", guildId).eq(column, clean).limit(1).maybeSingle();
      if (!error && data) {
        const row = data as StaffDirectoryRow;
        return {
          assigneeId: normalizeString(row?.staff_id) || normalizeString(row?.discord_id) || normalizeString(row?.user_id) || clean,
          assigneeName: normalizeString(row?.staff_name) || normalizeString(row?.display_name) || normalizeString(row?.username) || clean,
        };
      }
    } catch {}
  }
  return { assigneeId: clean, assigneeName: clean };
}

async function createActivityFeedEvent(supabase: ReturnType<typeof createServerSupabase>, ticket: TicketRow, actorId: string | null, actorName: string, previousAssigneeId: string | null, previousAssigneeName: string | null, nextAssigneeId: string, nextAssigneeName: string, reason: string): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id);
  if (!guildId) return;
  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_transferred",
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
      title: "Ticket Transferred",
      description: `${actorName} transferred ticket ${ticket?.ticket_number || ticket?.id || ""} to ${nextAssigneeName}`.trim(),
      reason: reason || null,
      metadata: { ticket_id: ticket?.id || null, ticket_number: ticket?.ticket_number || null, previous_assignee_id: previousAssigneeId || null, previous_assignee_name: previousAssigneeName || null, next_assignee_id: nextAssigneeId || null, next_assignee_name: nextAssigneeName || null, staff_id: actorId || null, staff_name: actorName, reason: reason || null, source: "dashboard_transfer_route" },
    });
  } catch {}
}

async function createSystemNote(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, actorId: string | null, actorName: string, nextAssigneeName: string, reason: string): Promise<void> {
  const content = reason ? `Ticket transferred to ${nextAssigneeName}. Reason: ${reason}` : `Ticket transferred to ${nextAssigneeName}.`;
  try {
    await supabase.from("ticket_notes").insert({ ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch {
    try {
      await supabase.from("ticket_notes").insert({ ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content, created_at: new Date().toISOString() });
    } catch {}
  }
}

export async function POST(request: Request, context: { params: { id?: string } }) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) return buildJsonResponse({ error: "Select a server before transferring a ticket.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", error_code: "invalid_request", selectedGuildId: guildId }, 400, session);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, session);

    const status = getTicketStatus(ticket);
    if (status === "closed" || status === "deleted") return buildJsonResponse({ error: `Cannot transfer a ${status} ticket.`, selectedGuildId: guildId }, 409, session);

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    if (!actorId) return buildJsonResponse({ error: "Missing staff identity.", selectedGuildId: guildId }, 401, session);

    const body = (await request.json().catch(() => ({}))) as { assigned_to?: string; reason?: string };
    const rawNextAssignee = normalizeString(body?.assigned_to);
    const reason = normalizeMultiline(body?.reason);
    if (!rawNextAssignee) return buildJsonResponse({ error: "assigned_to is required.", error_code: "invalid_request", selectedGuildId: guildId }, 400, session);

    const { assigneeId, assigneeName } = await resolveAssigneeIdentity(supabase, guildId, rawNextAssignee);
    if (!assigneeId) return buildJsonResponse({ error: "Could not resolve transfer target.", selectedGuildId: guildId }, 400, session);

    const previousAssigneeId = getCurrentAssigneeId(ticket) || null;
    const previousAssigneeName = getCurrentAssigneeName(ticket) || null;

    if (previousAssigneeId === assigneeId && status === "claimed") {
      return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(ticket), staffId: actorId, staffName: actorName, alreadyAssignedToTarget: true }, 200, session);
    }

    const nowIso = new Date().toISOString();
    const { data: updatedTicket, error: updateError } = await supabase
      .from("tickets")
      .update({ assigned_to: assigneeId, claimed_by: assigneeId, assigned_to_name: assigneeName, claimed_by_name: assigneeName, status: "claimed", updated_at: nowIso, last_activity_at: nowIso })
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (updateError || !updatedTicket) return buildJsonResponse({ error: updateError?.message || "Failed to transfer ticket.", selectedGuildId: guildId }, 500, session);

    const transferredTicket = updatedTicket as TicketRow;
    await Promise.allSettled([
      createActivityFeedEvent(supabase, transferredTicket, actorId, actorName, previousAssigneeId, previousAssigneeName, assigneeId, assigneeName, reason),
      createSystemNote(supabase, ticketId, actorId, actorName, assigneeName, reason),
    ]);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(transferredTicket), staffId: actorId, staffName: actorName, nextAssigneeId: assigneeId, nextAssigneeName: assigneeName, alreadyAssignedToTarget: false }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
