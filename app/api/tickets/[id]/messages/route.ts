import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;
const CLOSED_STATUSES = new Set(["closed", "deleted"]);

type RefreshedTokens = unknown;

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

type AttachmentInput = {
  name?: string | null;
  url?: string | null;
};

type NormalizedAttachment = {
  name: string;
  url: string;
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
  updated_at?: string | null;
};

type TicketMessageRow = {
  id?: string | null;
  ticket_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  content?: string | null;
  message_type?: string | null;
  attachments?: unknown;
  source?: string | null;
  created_at?: string | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeMultiline(value: unknown): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function safeObject<T extends object = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function truncateText(value: unknown, max = 240): string {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function normalizeAttachments(rawAttachments: unknown): NormalizedAttachment[] {
  const out: NormalizedAttachment[] = [];

  for (const row of safeArray<AttachmentInput>(rawAttachments).slice(0, MAX_ATTACHMENTS)) {
    const item = safeObject<AttachmentInput>(row);
    const url = normalizeString(item?.url);
    if (!url) continue;

    out.push({
      name: normalizeString(item?.name) || "attachment",
      url,
    });
  }

  return out;
}

function getActorIdentity(session: SessionLike | null | undefined) {
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
      env?.defaultStaffName ||
      "Dashboard Staff",
  };
}

function mapTicketMessage(row: TicketMessageRow) {
  return {
    id: row?.id || null,
    ticket_id: row?.ticket_id || null,
    author_id: row?.author_id || null,
    author_name: row?.author_name || null,
    content: row?.content || "",
    message_type: row?.message_type || "staff",
    attachments: safeArray(row?.attachments),
    source: row?.source || null,
    created_at: row?.created_at || null,
  };
}

function getTicketStatus(ticket: TicketRow | null | undefined): string {
  return normalizeString(ticket?.status).toLowerCase();
}

function ticketIsReplyable(ticket: TicketRow | null | undefined): boolean {
  return !CLOSED_STATUSES.has(getTicketStatus(ticket));
}

async function fetchTicketOrNull(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string
): Promise<TicketRow | null> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error || !data) return null;
  return data as TicketRow;
}

async function bumpTicketFreshness(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string
): Promise<void> {
  try {
    await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", ticketId);
  } catch {
    try {
      await supabase
        .from("tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);
    } catch {
      // best-effort only
    }
  }
}

async function createAuditEvent(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string,
  actorName: string | null,
  preview: string
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      title: "Ticket reply added",
      description: `${actorName || "Staff"} replied to ticket ${ticketId}: ${preview}`,
      event_type: "ticket_reply",
      related_id: ticketId,
    });
  } catch {
    // best-effort only
  }
}

async function createActivityFeedEvent(
  supabase: ReturnType<typeof createServerSupabase>,
  ticket: TicketRow,
  actorId: string | null,
  actorName: string | null,
  content: string,
  attachments: NormalizedAttachment[]
): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  if (!guildId) return;

  const metadata = {
    ticket_id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    ticket_status: ticket?.status || null,
    attachment_count: attachments.length,
    attachments,
    staff_id: actorId || null,
    staff_name: actorName || null,
    source: "dashboard_messages_route",
  };

  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_reply_added",
      source: "dashboard",
      actor_user_id: actorId || null,
      actor_name: actorName || null,
      target_user_id: normalizeString(ticket?.user_id) || null,
      target_name: normalizeString(ticket?.username) || null,
      channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      channel_name: ticket?.channel_name || null,
      ticket_id: ticket?.id || null,
      related_table: "ticket_messages",
      related_id: ticket?.id || null,
      title: "Ticket Reply Added",
      description: `${actorName || "Staff"} added a message to ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      reason: truncateText(content, 240),
      search_text: [
        "ticket message",
        actorName,
        actorId,
        ticket?.id,
        ticket?.ticket_number,
        ticket?.username,
        ticket?.user_id,
        ticket?.channel_name,
        ticket?.status,
        content,
      ]
        .filter(Boolean)
        .join(" "),
      metadata,
    });
  } catch {
    // best-effort only
  }
}

export async function GET(
  _request: Request,
  context: { params: { id?: string } }
) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);

    if (!ticketId) {
      return buildJsonResponse({ error: "Missing ticket id." }, 400, refreshedTokens);
    }

    const ticket = await fetchTicketOrNull(supabase, ticketId);
    if (!ticket) {
      return buildJsonResponse({ error: "Ticket not found." }, 404, refreshedTokens);
    }

    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      return buildJsonResponse({ error: error.message }, 500, refreshedTokens);
    }

    return buildJsonResponse(
      {
        ok: true,
        ticket: {
          id: ticket?.id || null,
          ticket_number: ticket?.ticket_number || null,
          status: ticket?.status || null,
          channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
          channel_name: ticket?.channel_name || null,
          user_id: ticket?.user_id || null,
          username: ticket?.username || null,
        },
        messages: safeArray<TicketMessageRow>(data).map(mapTicketMessage),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id?: string } }
) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);

    if (!ticketId) {
      return buildJsonResponse({ error: "Missing ticket id." }, 400, refreshedTokens);
    }

    const body = safeObject<{ content?: string; message?: string; message_type?: string; attachments?: AttachmentInput[] }>(
      await request.json().catch(() => ({}))
    );

    const content = normalizeMultiline(body?.content || body?.message);
    const messageType = normalizeString(body?.message_type || "staff").toLowerCase() || "staff";
    const attachments = normalizeAttachments(body?.attachments);

    if (!content) {
      return buildJsonResponse({ error: "Message content cannot be empty." }, 400, refreshedTokens);
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return buildJsonResponse(
        { error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` },
        400,
        refreshedTokens
      );
    }

    const ticket = await fetchTicketOrNull(supabase, ticketId);
    if (!ticket) {
      return buildJsonResponse({ error: "Ticket not found." }, 404, refreshedTokens);
    }

    if (!ticketIsReplyable(ticket)) {
      return buildJsonResponse(
        { error: `Cannot add messages to a ${getTicketStatus(ticket) || "closed"} ticket.` },
        409,
        refreshedTokens
      );
    }

    const { actorId, actorName } = getActorIdentity(session as SessionLike);

    const { data, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_id: actorId || "",
        author_name: actorName,
        content,
        message_type: messageType,
        attachments,
        source: "dashboard",
      })
      .select("*")
      .single();

    if (error || !data) {
      return buildJsonResponse(
        { error: error?.message || "Failed to save message." },
        500,
        refreshedTokens
      );
    }

    await Promise.allSettled([
      bumpTicketFreshness(supabase, ticketId),
      createAuditEvent(supabase, ticketId, actorName, truncateText(content, 180)),
      createActivityFeedEvent(supabase, ticket, actorId, actorName, content, attachments),
    ]);

    return buildJsonResponse(
      {
        ok: true,
        message: mapTicketMessage(data as TicketMessageRow),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    );
  }
}
