import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NOTE_LENGTH = 4000;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeMultiline(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function truncateText(value, max = 180) {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mapNote(row) {
  return {
    id: row?.id || null,
    ticket_id: row?.ticket_id || null,
    staff_id: row?.staff_id || null,
    staff_name: row?.staff_name || null,
    content: row?.content || "",
    created_at: row?.created_at || null,
  };
}

function buildJsonResponse(payload, status = 200, refreshedTokens = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function getActorIdentity(session) {
  return {
    actorId:
      normalizeString(session?.user?.discord_id) ||
      normalizeString(session?.user?.id) ||
      normalizeString(session?.discordUser?.id) ||
      null,
    actorName:
      normalizeString(session?.user?.username) ||
      normalizeString(session?.discordUser?.username) ||
      normalizeString(session?.user?.name) ||
      "Dashboard Staff",
  };
}

async function fetchTicketOrNull(supabase, ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error || !data) return null;
  return data;
}

async function createActivityFeedEvent(supabase, ticket, actorId, actorName, noteContent) {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  if (!guildId) return;

  const metadata = {
    ticket_id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    note_preview: truncateText(noteContent, 240),
    staff_id: actorId || null,
    staff_name: actorName || null,
    source: "dashboard_ticket_note",
  };

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
      search_text: [
        "ticket note",
        actorName,
        actorId,
        ticket?.id,
        ticket?.ticket_number,
        ticket?.username,
        ticket?.user_id,
        ticket?.channel_name,
        noteContent,
      ]
        .filter(Boolean)
        .join(" "),
      metadata,
    });
  } catch {
    // best-effort only
  }
}

async function createAuditEvent(supabase, ticketId, actorName) {
  try {
    await supabase.from("audit_events").insert({
      title: "Staff note added",
      description: `${actorName || "Staff"} added internal note to ticket ${ticketId}`,
      event_type: "ticket_note",
      related_id: ticketId,
    });
  } catch {
    // best-effort only
  }
}

async function bumpTicketUpdatedAt(supabase, ticketId) {
  try {
    await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);
  } catch {
    // best-effort only
  }
}

export async function GET(_request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(params?.id);

    if (!ticketId) {
      return buildJsonResponse(
        { error: "Missing ticket id." },
        400,
        refreshedTokens
      );
    }

    const ticket = await fetchTicketOrNull(supabase, ticketId);
    if (!ticket) {
      return buildJsonResponse(
        { error: "Ticket not found." },
        404,
        refreshedTokens
      );
    }

    const { data, error } = await supabase
      .from("ticket_notes")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (error) {
      return buildJsonResponse(
        { error: error.message || "Failed to load notes." },
        500,
        refreshedTokens
      );
    }

    return buildJsonResponse(
      {
        ok: true,
        notes: Array.isArray(data) ? data.map(mapNote) : [],
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return buildJsonResponse(
      { error: error?.message || "Unauthorized" },
      error?.message === "Unauthorized" ? 401 : 500
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(params?.id);

    if (!ticketId) {
      return buildJsonResponse(
        { error: "Missing ticket id." },
        400,
        refreshedTokens
      );
    }

    const body = safeObject(await request.json().catch(() => ({})));
    const content = normalizeMultiline(body?.content);

    if (!content) {
      return buildJsonResponse(
        { error: "Note content is required." },
        400,
        refreshedTokens
      );
    }

    if (content.length > MAX_NOTE_LENGTH) {
      return buildJsonResponse(
        { error: `Note is too long. Maximum ${MAX_NOTE_LENGTH} characters.` },
        400,
        refreshedTokens
      );
    }

    const ticket = await fetchTicketOrNull(supabase, ticketId);
    if (!ticket) {
      return buildJsonResponse(
        { error: "Ticket not found." },
        404,
        refreshedTokens
      );
    }

    const { actorId, actorName } = getActorIdentity(session);

    const insertPayload = {
      ticket_id: ticketId,
      staff_id: actorId || "",
      staff_name: actorName,
      content,
    };

    const { data, error } = await supabase
      .from("ticket_notes")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !data) {
      return buildJsonResponse(
        { error: error?.message || "Failed to save note." },
        500,
        refreshedTokens
      );
    }

    await Promise.allSettled([
      bumpTicketUpdatedAt(supabase, ticketId),
      createAuditEvent(supabase, ticketId, actorName),
      createActivityFeedEvent(supabase, ticket, actorId, actorName, content),
    ]);

    return buildJsonResponse(
      {
        ok: true,
        note: mapNote(data),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return buildJsonResponse(
      { error: error?.message || "Unauthorized" },
      error?.message === "Unauthorized" ? 401 : 500
    );
  }
}
