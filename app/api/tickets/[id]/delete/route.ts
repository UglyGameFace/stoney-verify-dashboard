import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
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
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  transcript_url?: string | null;
  transcript_message_id?: string | null;
  transcript_channel_id?: string | null;
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

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens = null
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
    deleted_by: ticket?.deleted_by || null,
    deleted_by_name: ticket?.deleted_by_name || null,
    transcript_url: ticket?.transcript_url || null,
    transcript_message_id: ticket?.transcript_message_id || null,
    transcript_channel_id: ticket?.transcript_channel_id || null,
  };
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

async function createAuditEvent(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string,
  staffName: string,
  ticket: TicketRow,
  reason: string
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      title: "Ticket deleted",
      description: `${staffName} deleted ticket ${ticket?.ticket_number || ticketId}: ${reason}`,
      event_type: "ticket_deleted",
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
  actorName: string,
  reason: string
): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  if (!guildId) return;

  const metadata = {
    ticket_id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    ticket_status: ticket?.status || null,
    deleted_reason: reason,
    transcript_url: ticket?.transcript_url || null,
    transcript_message_id: ticket?.transcript_message_id || null,
    transcript_channel_id: ticket?.transcript_channel_id || null,
    staff_id: actorId || null,
    staff_name: actorName,
    source: "dashboard_delete_route",
  };

  try {
    await supabase.from("activity_feed_events").insert({
      guild_id: guildId,
      event_family: "ticket",
      event_type: "ticket_deleted",
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
      title: "Ticket Deleted",
      description: `${actorName} deleted ticket ${ticket?.ticket_number || ticket?.id || ""}`.trim(),
      reason,
      search_text: [
        "ticket deleted",
        actorName,
        actorId,
        ticket?.id,
        ticket?.ticket_number,
        ticket?.username,
        ticket?.user_id,
        ticket?.channel_name,
        reason,
      ]
        .filter(Boolean)
        .join(" "),
      metadata,
    });
  } catch {
    // best-effort only
  }
}

async function createSystemNote(
  supabase: ReturnType<typeof createServerSupabase>,
  ticketId: string,
  actorId: string | null,
  actorName: string,
  reason: string
): Promise<void> {
  try {
    await supabase.from("ticket_notes").insert({
      ticket_id: ticketId,
      staff_id: actorId || "",
      staff_name: actorName,
      content: `Ticket deleted from dashboard${reason ? ` • Reason: ${reason}` : ""}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch {
    try {
      await supabase.from("ticket_notes").insert({
        ticket_id: ticketId,
        staff_id: actorId || "",
        staff_name: actorName,
        content: `Ticket deleted from dashboard${reason ? ` • Reason: ${reason}` : ""}`,
        created_at: new Date().toISOString(),
      });
    } catch {
      // best-effort only
    }
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

    const ticket = await fetchTicketOrNull(supabase, ticketId);
    if (!ticket) {
      return buildJsonResponse({ error: "Ticket not found." }, 404, refreshedTokens);
    }

    const status = getTicketStatus(ticket);
    const { actorId, actorName } = getActorIdentity(session as SessionLike);

    if (!actorId) {
      return buildJsonResponse({ error: "Missing staff identity." }, 401, refreshedTokens);
    }

    if (status === "deleted") {
      return buildJsonResponse(
        {
          ok: true,
          ticket: mapTicket(ticket),
          staffId: actorId,
          staffName: actorName,
          alreadyDeleted: true,
        },
        200,
        refreshedTokens
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
      transcript_url?: string;
      transcript_message_id?: string | number;
      transcript_channel_id?: string | number;
    };

    const reason = normalizeMultiline(body?.reason) || "Deleted by staff";
    const transcriptUrl = normalizeString(body?.transcript_url) || null;
    const transcriptMessageId = normalizeString(body?.transcript_message_id) || null;
    const transcriptChannelId = normalizeString(body?.transcript_channel_id) || null;

    const nowIso = new Date().toISOString();

    const { data: updatedTicket, error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "deleted",
        deleted_at: nowIso,
        deleted_by: actorId,
        deleted_by_name: actorName,
        closed_at: ticket?.closed_at || nowIso,
        closed_by: ticket?.closed_by || actorId,
        closed_reason: reason,
        transcript_url: transcriptUrl || ticket?.transcript_url || null,
        transcript_message_id: transcriptMessageId || ticket?.transcript_message_id || null,
        transcript_channel_id: transcriptChannelId || ticket?.transcript_channel_id || null,
        updated_at: nowIso,
        last_activity_at: nowIso,
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (updateError || !updatedTicket) {
      return buildJsonResponse(
        { error: updateError?.message || "Failed to delete ticket." },
        500,
        refreshedTokens
      );
    }

    const deletedTicket = updatedTicket as TicketRow;

    await Promise.allSettled([
      createAuditEvent(supabase, ticketId, actorName, deletedTicket, reason),
      createActivityFeedEvent(supabase, deletedTicket, actorId, actorName, reason),
      createSystemNote(supabase, ticketId, actorId, actorName, reason),
    ]);

    return buildJsonResponse(
      {
        ok: true,
        ticket: mapTicket(deletedTicket),
        staffId: actorId,
        staffName: actorName,
        alreadyDeleted: false,
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Failed to delete ticket" },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    );
  }
}
