import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_MESSAGE_LENGTH = 4000;
const DISCORD_MESSAGE_LIMIT = 2000;
const MAX_ATTACHMENTS = 10;

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

type DiscordMessageResponse = {
  id?: string;
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

async function fetchTicketOrNull(supabase: ReturnType<typeof createServerSupabase>, ticketId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error || !data) return null;
  return data as TicketRow;
}

function buildDiscordReplyPayload(args: {
  message: string;
  attachments: NormalizedAttachment[];
  actorName: string | null;
  ticket: TicketRow;
}) {
  const { message, attachments, actorName, ticket } = args;

  const attachmentLines = attachments.map((item) => {
    const name = normalizeString(item?.name) || "attachment";
    return `• ${name}: ${item.url}`;
  });

  const header = `💬 Staff Reply from ${actorName || "Staff"}`;
  const ticketLine = ticket?.ticket_number
    ? `Ticket #${ticket.ticket_number}`
    : ticket?.id
      ? `Ticket ${ticket.id}`
      : "Ticket Reply";

  const parts = [header, ticketLine, "", message];

  if (attachmentLines.length) {
    parts.push("", "Attachments:", ...attachmentLines);
  }

  return parts.join("\n").trim();
}

function chunkDiscordMessage(content: string, limit = DISCORD_MESSAGE_LIMIT): string[] {
  const text = normalizeString(content);
  if (!text) return [];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n\n", limit);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", limit);
    if (splitAt <= 0) splitAt = limit;

    const chunk = remaining.slice(0, splitAt).trim();
    chunks.push(chunk || remaining.slice(0, limit));
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

async function postDiscordMessage(channelId: string, content: string) {
  const token = process.env.DISCORD_TOKEN || env?.discordToken || "";

  if (!token || !channelId || !content) {
    return { ok: false, error: "Missing Discord token, channel, or content." };
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
      cache: "no-store",
    });

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      return {
        ok: false,
        error: normalizeString(json?.message) || `Discord API error ${response.status}`,
      };
    }

    return { ok: true, data: json as DiscordMessageResponse };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to reach Discord API.",
    };
  }
}

async function mirrorReplyToDiscord(args: {
  ticket: TicketRow;
  actorName: string | null;
  message: string;
  attachments: NormalizedAttachment[];
}) {
  const { ticket, actorName, message, attachments } = args;

  const channelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);
  if (!channelId) {
    return {
      mirroredToDiscord: false,
      mirroredMessageIds: [] as string[],
      mirrorError: "Ticket is not linked to a Discord channel.",
      discordMessages: [] as DiscordMessageResponse[],
    };
  }

  const payload = buildDiscordReplyPayload({
    message,
    attachments,
    actorName,
    ticket,
  });

  const chunks = chunkDiscordMessage(payload);
  const sent: DiscordMessageResponse[] = [];

  for (const chunk of chunks) {
    const result = await postDiscordMessage(channelId, chunk);

    if (!result.ok) {
      return {
        mirroredToDiscord: sent.length > 0,
        mirroredMessageIds: sent.map((row) => normalizeString(row.id)).filter(Boolean),
        mirrorError: result.error || "Failed to mirror reply to Discord.",
        discordMessages: sent,
      };
    }

    sent.push(result.data as DiscordMessageResponse);
  }

  return {
    mirroredToDiscord: sent.length > 0,
    mirroredMessageIds: sent.map((row) => normalizeString(row.id)).filter(Boolean),
    mirrorError: "",
    discordMessages: sent,
  };
}

async function insertDashboardStaffMessages(
  supabase: ReturnType<typeof createServerSupabase>,
  ticket: TicketRow,
  actorId: string | null,
  actorName: string | null,
  message: string,
  attachments: NormalizedAttachment[],
  discordMessages: DiscordMessageResponse[]
) {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  const channelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);

  if (!guildId || !channelId || !safeArray(discordMessages).length) return;

  const rows = discordMessages.map((discordMessage, index) => ({
    guild_id: guildId,
    channel_id: channelId,
    message_id: normalizeString(discordMessage?.id) || `${Date.now()}-${index}`,
    author_id: actorId || "",
    author_name: actorName || "Dashboard Staff",
    display_name: actorName || "Dashboard Staff",
    avatar_url: null,
    content:
      discordMessages.length === 1
        ? message
        : index === 0
          ? message
          : `Continued reply segment ${index + 1}`,
    attachments,
    embeds: [],
  }));

  try {
    await supabase.from("dashboard_staff_messages").insert(rows);
  } catch {
    // best-effort only
  }
}

async function createAuditEvent(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string,
  actorName: string | null,
  preview: string
) {
  try {
    await supabase.from("audit_events").insert({
      title: "Staff reply sent",
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
  message: string,
  attachments: NormalizedAttachment[],
  mirroredToDiscord: boolean
) {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  if (!guildId) return;

  const metadata = {
    ticket_id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    attachment_count: attachments.length,
    attachments,
    mirrored_to_discord: mirroredToDiscord,
    staff_id: actorId || null,
    staff_name: actorName || null,
    source: "dashboard_ticket_reply",
  };

  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_reply_sent",
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
      title: "Staff Reply Sent",
      description: `${actorName || "Staff"} replied to ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      reason: truncateText(message, 240),
      search_text: [
        "ticket reply",
        actorName,
        actorId,
        ticket?.id,
        ticket?.ticket_number,
        ticket?.username,
        ticket?.user_id,
        ticket?.channel_name,
        message,
      ]
        .filter(Boolean)
        .join(" "),
      metadata,
    });
  } catch {
    // best-effort only
  }
}

async function bumpTicketUpdatedAt(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string
) {
  try {
    await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);
  } catch {
    // best-effort only
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
      return buildJsonResponse(
        { error: "Missing ticket id." },
        400,
        refreshedTokens
      );
    }

    const body = safeObject<{ message?: string; attachments?: AttachmentInput[] }>(
      await request.json().catch(() => ({}))
    );

    const message = normalizeMultiline(body?.message);
    const attachments = normalizeAttachments(body?.attachments);

    if (!message) {
      return buildJsonResponse(
        { error: "Reply message cannot be empty." },
        400,
        refreshedTokens
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return buildJsonResponse(
        { error: `Reply is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` },
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

    const { actorId, actorName } = getActorIdentity(session as SessionLike);

    const { data, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_id: actorId || "",
        author_name: actorName,
        content: message,
        message_type: "staff",
        attachments,
        source: "dashboard",
      })
      .select("*")
      .single();

    if (error || !data) {
      return buildJsonResponse(
        { error: error?.message || "Failed to save reply." },
        500,
        refreshedTokens
      );
    }

    const mirrorResult = await mirrorReplyToDiscord({
      ticket,
      actorName,
      message,
      attachments,
    });

    await Promise.allSettled([
      bumpTicketUpdatedAt(supabase, ticketId),
      createAuditEvent(supabase, ticketId, actorName, truncateText(message, 180)),
      createActivityFeedEvent(
        supabase,
        ticket,
        actorId,
        actorName,
        message,
        attachments,
        mirrorResult.mirroredToDiscord
      ),
      insertDashboardStaffMessages(
        supabase,
        ticket,
        actorId,
        actorName,
        message,
        attachments,
        mirrorResult.discordMessages || []
      ),
    ]);

    return buildJsonResponse(
      {
        ok: true,
        message: mapTicketMessage(data as TicketMessageRow),
        mirroredToDiscord: mirrorResult.mirroredToDiscord,
        mirroredMessageIds: mirrorResult.mirroredMessageIds || [],
        mirrorError: mirrorResult.mirrorError || "",
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
