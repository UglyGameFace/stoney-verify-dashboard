import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NOTE_LENGTH = 4000;

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
};

type TicketNoteRow = {
  id?: string | null;
  ticket_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  content?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeMultiline(value: unknown): string {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function truncateText(value: unknown, max = 180): string {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function safeObject<T extends object = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : ({} as T);
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

function mapNote(row: TicketNoteRow | null | undefined) {
  return {
    id: row?.id || null,
    ticket_id: row?.ticket_id || null,
    staff_id: row?.staff_id || null,
    staff_name: row?.staff_name || null,
    content: row?.content || "",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function getActorIdentity(session: SessionLike | null | undefined) {
  return {
    actorId: normalizeString(session?.user?.discord_id) || normalizeString(session?.user?.id) || normalizeString(session?.discordUser?.id) || null,
    actorName: normalizeString(session?.user?.username) || normalizeString(session?.discordUser?.username) || normalizeString(session?.user?.name) || env?.defaultStaffName || "Dashboard Staff",
  };
}

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).eq("guild_id", guildId).single();
  if (error || !data) return null;
  return data as TicketRow;
}

async function createActivityFeedEvent(supabase: ReturnType<typeof createServerSupabase>, ticket: TicketRow, actorId: string | null, actorName: string | null, noteContent: string): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id);
  if (!guildId) return;
  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_note_added",
      source: "dashboard",
      actor_user_id: actorId || null,
      actor_name: actorName || null,
      target_user_id: normalizeString(ticket?.user_id) || null,
      target_name: normalizeString(ticket?.username) || null,
      channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      channel_name: ticket?.channel_name || null,
      ticket_id: ticket?.id || null,
      related_table: "ticket_notes",
      related_id: ticket?.id || null,
      title: "Internal Note Added",
      description: `${actorName || "Staff"} added an internal note to ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      reason: truncateText(noteContent, 240),
      metadata: {
        ticket_id: ticket?.id || null,
        ticket_number: ticket?.ticket_number || null,
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
        channel_name: ticket?.channel_name || null,
        note_preview: truncateText(noteContent, 240),
        staff_id: actorId || null,
        staff_name: actorName || null,
        source: "dashboard_ticket_note",
      },
    });
  } catch {}
}

async function bumpTicketUpdatedAt(supabase: ReturnType<typeof createServerSupabase>, ticketId: string, guildId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await supabase.from("tickets").update({ updated_at: nowIso, last_activity_at: nowIso }).eq("id", ticketId).eq("guild_id", guildId);
  } catch {
    try {
      await supabase.from("tickets").update({ updated_at: nowIso }).eq("id", ticketId).eq("guild_id", guildId);
    } catch {}
  }
}

export async function GET(_request: Request, context: { params: { id?: string } }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = selectedGuildId();

    if (!guildId) return buildJsonResponse({ error: "Select a server before loading ticket notes.", needsServerSelection: true }, 428, refreshedTokens);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", selectedGuildId: guildId }, 400, refreshedTokens);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, refreshedTokens);

    const { data, error } = await supabase.from("ticket_notes").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false });
    if (error) return buildJsonResponse({ error: error.message || "Failed to load notes.", selectedGuildId: guildId }, 500, refreshedTokens);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, notes: Array.isArray(data) ? (data as TicketNoteRow[]).map(mapNote) : [] }, 200, refreshedTokens);
  } catch (error) {
    return buildJsonResponse({ error: error instanceof Error ? error.message : "Unauthorized" }, error instanceof Error && error.message === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request, context: { params: { id?: string } }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = selectedGuildId();

    if (!guildId) return buildJsonResponse({ error: "Select a server before adding a ticket note.", needsServerSelection: true }, 428, refreshedTokens);
    if (!ticketId) return buildJsonResponse({ error: "Missing ticket id.", selectedGuildId: guildId }, 400, refreshedTokens);

    const body = safeObject<{ content?: string }>(await request.json().catch(() => ({})));
    const content = normalizeMultiline(body?.content);
    if (!content) return buildJsonResponse({ error: "Note content is required.", selectedGuildId: guildId }, 400, refreshedTokens);
    if (content.length > MAX_NOTE_LENGTH) return buildJsonResponse({ error: `Note is too long. Maximum ${MAX_NOTE_LENGTH} characters.`, selectedGuildId: guildId }, 400, refreshedTokens);

    const ticket = await fetchTicketOrNull(supabase, ticketId, guildId);
    if (!ticket) return buildJsonResponse({ error: "Ticket not found.", selectedGuildId: guildId }, 404, refreshedTokens);

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    const nowIso = new Date().toISOString();
    const insertPayload = { ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content, created_at: nowIso, updated_at: nowIso };
    let data: TicketNoteRow | null = null;
    let error: { message?: string } | null = null;

    try {
      const response = await supabase.from("ticket_notes").insert(insertPayload).select("*").single();
      data = (response.data as TicketNoteRow | null) || null;
      error = response.error;
    } catch {
      const fallbackResponse = await supabase.from("ticket_notes").insert({ ticket_id: ticketId, staff_id: actorId || "", staff_name: actorName, content, created_at: nowIso }).select("*").single();
      data = (fallbackResponse.data as TicketNoteRow | null) || null;
      error = fallbackResponse.error;
    }

    if (error || !data) return buildJsonResponse({ error: error?.message || "Failed to save note.", selectedGuildId: guildId }, 500, refreshedTokens);

    await Promise.allSettled([bumpTicketUpdatedAt(supabase, ticketId, guildId), createActivityFeedEvent(supabase, ticket, actorId, actorName, content)]);

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, note: mapNote(data) }, 200, refreshedTokens);
  } catch (error) {
    return buildJsonResponse({ error: error instanceof Error ? error.message : "Unauthorized" }, error instanceof Error && error.message === "Unauthorized" ? 401 : 500);
  }
}
