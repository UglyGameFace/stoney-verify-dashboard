import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshedTokens = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

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
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function selectedGuildId(): string {
  return normalizeString(getSelectedGuildId());
}

function buildJsonResponse(payload: Record<string, unknown>, status = 200, refreshedTokens: RefreshedTokens = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
  applyAuthCookies(response, refreshedTokens);
  return response;
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
  };
}

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).eq("guild_id", guildId).single();
  if (error || !data) return null;
  return data as TicketRow;
}

async function createActivityFeedEvent(supabase: ReturnType<typeof createServerSupabase>, ticket: TicketRow, actorId: string | null, actorName: string, previousAssigneeId: string | null, previousAssigneeName: string | null): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id);
  if (!guildId) return;
  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_unclaimed",
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
      title: "Ticket Unclaimed",
      description: `${actorName} unclaimed ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      metadata: {
        ticket_id: ticket?.id || null,
        ticket_number: ticket?.ticket_number || null,
        previous_assignee_id: previousAssigneeId || null,
        previous_assignee_name: previousAssigneeName || null,
        staff_id: actorId || null,
        staff_name: actorName,
        source: "dashboard_unclaim_route",
      },
    });
  } catch {}
}

async function updateStaffMetrics(supabase: ReturnType<typeof createServerSupabase>, guildId: string, staffId: string | null, staffName: string): Promise<void> {
  if (!guildId || !staffId) return;
  try {
    await supabase.from("staff_metrics").upsert({ guild_id: guildId, staff_id: staffId, staff_name: staffName, last_active: new Date().toISOString() }, { onConflict: "guild_id,staff_id" });
  } catch {}
}

export async function POST(_request: Request, context: { params: { id?: string } }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = selectedGuildId();

    if (!guildId) return buildJsonResponse({ error: "Select a server before unclaiming a ticket.", needsServerSelection: true }, 428, refreshedTokens);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", selectedGuildId: guildId }, 400, refreshedTokens);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, refreshedTokens);

    const status = getTicketStatus(ticket);
    if (status === "closed" || status === "deleted") return buildJsonResponse({ error: `Cannot unclaim a ${status} ticket.`, selectedGuildId: guildId }, 409, refreshedTokens);

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    if (!actorId) return buildJsonResponse({ error: "Missing staff identity.", selectedGuildId: guildId }, 401, refreshedTokens);

    const currentAssigneeId = getCurrentAssigneeId(ticket);
    const currentAssigneeName = normalizeString(ticket?.assigned_to_name || ticket?.claimed_by_name) || null;

    if (status !== "claimed" || !currentAssigneeId) {
      return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(ticket), staffId: actorId, staffName: actorName, alreadyUnclaimed: true }, 200, refreshedTokens);
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("tickets")
      .update({ claimed_by: null, assigned_to: null, claimed_by_name: null, assigned_to_name: null, status: "open", updated_at: nowIso, last_activity_at: nowIso })
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (error || !data) return buildJsonResponse({ error: error?.message || "Failed to unclaim ticket.", selectedGuildId: guildId }, 500, refreshedTokens);

    const updatedTicket = data as TicketRow;
    await Promise.allSettled([
      createActivityFeedEvent(supabase, updatedTicket, actorId, actorName, currentAssigneeId, currentAssigneeName),
      updateStaffMetrics(supabase, guildId, actorId, actorName),
    ]);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(updatedTicket), staffId: actorId, staffName: actorName, alreadyUnclaimed: false }, 200, refreshedTokens);
  } catch (error) {
    return buildJsonResponse({ error: error instanceof Error ? error.message : "Unauthorized" }, error instanceof Error && error.message === "Unauthorized" ? 401 : 500);
  }
}
