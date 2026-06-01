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
  user?: {
    discord_id?: string | null;
    id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
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
  reopened_at?: string | null;
  deleted_at?: string | null;
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
    reopened_at: ticket?.reopened_at || null,
    deleted_at: ticket?.deleted_at || null,
  };
}

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).eq("guild_id", guildId).single();
  if (error || !data) return null;
  return data as TicketRow;
}

async function createAuditEvent(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, staffName: string, ticket: TicketRow): Promise<void> {
  try {
    await supabase.from("audit_events").insert({ title: "Ticket reopened", description: `${staffName} reopened ticket ${ticket?.ticket_number || ticketId}`, event_type: "ticket_reopened", related_id: ticketId });
  } catch {}
}

async function createActivityFeedEvent(supabase: ReturnType<typeof createServerSupabase>, ticket: TicketRow, actorId: string | null, actorName: string): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id);
  if (!guildId) return;
  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_reopened",
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
      title: "Ticket Reopened",
      description: `${actorName} reopened ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      metadata: { ticket_id: ticket?.id || null, ticket_number: ticket?.ticket_number || null, reopened_at: ticket?.reopened_at || null, staff_id: actorId || null, staff_name: actorName, source: "dashboard_reopen_route" },
    });
  } catch {}
}

async function createSystemNote(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, actorId: string | null, actorName: string): Promise<void> {
  try {
    await supabase.from("ticket_notes").insert({ ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content: "Ticket reopened from dashboard", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch {
    try {
      await supabase.from("ticket_notes").insert({ ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content: "Ticket reopened from dashboard", created_at: new Date().toISOString() });
    } catch {}
  }
}

export async function POST(_request: Request, context: { params: { id?: string } }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = selectedGuildId();

    if (!guildId) return buildJsonResponse({ error: "Select a server before reopening a ticket.", needsServerSelection: true }, 428, refreshedTokens);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", selectedGuildId: guildId }, 400, refreshedTokens);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, refreshedTokens);

    const status = getTicketStatus(ticket);
    if (status === "deleted") return buildJsonResponse({ error: "Cannot reopen a deleted ticket.", selectedGuildId: guildId }, 409, refreshedTokens);

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    if (!actorId) return buildJsonResponse({ error: "Missing staff identity.", selectedGuildId: guildId }, 401, refreshedTokens);

    if (status === "open" || status === "claimed") return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(ticket), staffId: actorId, staffName: actorName, alreadyOpen: true }, 200, refreshedTokens);

    const nowIso = new Date().toISOString();
    const { data: updatedTicket, error: updateError } = await supabase
      .from("tickets")
      .update({ status: "open", closed_by: null, closed_reason: null, closed_at: null, deleted_at: null, reopened_at: nowIso, updated_at: nowIso, last_activity_at: nowIso })
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (updateError || !updatedTicket) return buildJsonResponse({ error: updateError?.message || "Failed to reopen ticket.", selectedGuildId: guildId }, 500, refreshedTokens);

    const reopenedTicket = updatedTicket as TicketRow;
    await Promise.allSettled([createAuditEvent(supabase, ticketId, actorName, reopenedTicket), createActivityFeedEvent(supabase, reopenedTicket, actorId, actorName), createSystemNote(supabase, ticketId, actorId, actorName)]);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, ticket: mapTicket(reopenedTicket), staffId: actorId, staffName: actorName, alreadyOpen: false }, 200, refreshedTokens);
  } catch (error) {
    return buildJsonResponse({ error: error instanceof Error ? error.message : "Failed to reopen ticket" }, error instanceof Error && error.message === "Unauthorized" ? 401 : 500);
  }
}
