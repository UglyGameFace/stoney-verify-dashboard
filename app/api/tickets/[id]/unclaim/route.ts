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
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
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
  ticket: TicketRow
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      title: "Ticket unclaimed",
      description: `${staffName} unclaimed ticket ${ticket?.ticket_number || ticketId}`,
      event_type: "ticket_unclaimed",
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
  previousAssigneeId: string | null,
  previousAssigneeName: string | null
): Promise<void> {
  const guildId = normalizeString(ticket?.guild_id || env?.guildId || "");
  if (!guildId) return;

  const metadata = {
    ticket_id: ticket?.id || null,
    ticket_number: ticket?.ticket_number || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    ticket_status: ticket?.status || null,
    previous_assignee_id: previousAssigneeId || null,
    previous_assignee_name: previousAssigneeName || null,
    staff_id: actorId || null,
    staff_name: actorName,
    source: "dashboard_unclaim_route",
  };

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
      reason: null,
      search_text: [
        "ticket unclaimed",
        actorName,
        actorId,
        ticket?.id,
        ticket?.ticket_number,
        ticket?.username,
        ticket?.user_id,
        ticket?.channel_name,
        previousAssigneeId,
        previousAssigneeName,
      ]
        .filter(Boolean)
        .join(" "),
      metadata,
    });
  } catch {
    // best-effort only
  }
}

async function updateStaffMetrics(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  staffId: string | null,
  staffName: string
): Promise<void> {
  if (!guildId || !staffId) return;

  try {
    await supabase.from("staff_metrics").upsert(
      {
        guild_id: guildId,
        staff_id: staffId,
        staff_name: staffName,
        last_active: new Date().toISOString(),
      },
      { onConflict: "guild_id,staff_id" }
    );
  } catch {
    // best-effort only
  }
}

export async function POST(
  _request: Request,
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
    if (status === "closed" || status === "deleted") {
      return buildJsonResponse(
        { error: `Cannot unclaim a ${status} ticket.` },
        409,
        refreshedTokens
      );
    }

    const { actorId, actorName } = getActorIdentity(session as SessionLike);
    if (!actorId) {
      return buildJsonResponse({ error: "Missing staff identity." }, 401, refreshedTokens);
    }

    const currentAssigneeId = getCurrentAssigneeId(ticket);
    const currentAssigneeName =
      normalizeString(ticket?.assigned_to_name || ticket?.claimed_by_name) || null;

    if (status !== "claimed" || !currentAssigneeId) {
      return buildJsonResponse(
        {
          ok: true,
          ticket: mapTicket(ticket),
          staffId: actorId,
          staffName: actorName,
          alreadyUnclaimed: true,
        },
        200,
        refreshedTokens
      );
    }

    const { data, error } = await supabase
      .from("tickets")
      .update({
        claimed_by: null,
        assigned_to: null,
        claimed_by_name: null,
        assigned_to_name: null,
        status: "open",
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error || !data) {
      return buildJsonResponse(
        { error: error?.message || "Failed to unclaim ticket." },
        500,
        refreshedTokens
      );
    }

    const updatedTicket = data as TicketRow;

    await Promise.allSettled([
      createAuditEvent(supabase, ticketId, actorName, updatedTicket),
      createActivityFeedEvent(
        supabase,
        updatedTicket,
        actorId,
        actorName,
        currentAssigneeId,
        currentAssigneeName
      ),
      updateStaffMetrics(
        supabase,
        normalizeString(updatedTicket?.guild_id),
        actorId,
        actorName
      ),
    ]);

    return buildJsonResponse(
      {
        ok: true,
        ticket: mapTicket(updatedTicket),
        staffId: actorId,
        staffName: actorName,
        alreadyUnclaimed: false,
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
