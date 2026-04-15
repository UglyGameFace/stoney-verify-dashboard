import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshedTokens = unknown;

type SessionLike = {
  user?: {
    id?: string | null;
    user_id?: string | null;
    discord_id?: string | null;
    username?: string | null;
    name?: string | null;
    display_name?: string | null;
    global_name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
  staffUser?: {
    id?: string | null;
    user_id?: string | null;
    discord_id?: string | null;
    username?: string | null;
    name?: string | null;
    display_name?: string | null;
    global_name?: string | null;
  } | null;
};

type TicketRow = {
  id?: string | null;
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  title?: string | null;
  status?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  updated_at?: string | null;
  closed_reason?: string | null;
  closed_by?: string | null;
  owner_display_name?: string | null;
};

type BotCommandInsertRow = {
  id?: string | null;
};

type RequestBody = {
  action?: string | null;
  reason?: string | null;
  role_id?: string | null;
  staff_id?: string | null;
};

type JsonRecord = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function safeObject<T extends object = JsonRecord>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

function getSessionUser(session: SessionLike | null | undefined) {
  return session?.user || session?.discordUser || session?.staffUser || null;
}

function getStaffId(session: SessionLike | null | undefined): string {
  const user = getSessionUser(session);

  return normalizeString(
    user?.id ||
      (user as { user_id?: string | null })?.user_id ||
      (user as { discord_id?: string | null })?.discord_id ||
      session?.discordUser?.id ||
      ""
  );
}

function getStaffName(session: SessionLike | null | undefined): string {
  const user = getSessionUser(session) as
    | {
        global_name?: string | null;
        display_name?: string | null;
        username?: string | null;
        name?: string | null;
      }
    | null
    | undefined;

  return normalizeString(
    user?.global_name ||
      user?.display_name ||
      user?.username ||
      user?.name ||
      session?.discordUser?.username ||
      env.defaultStaffName ||
      "Dashboard Staff"
  );
}

function buildJsonResponse(
  data: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
) {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function buildErrorResponse(
  message: string,
  status = 500,
  refreshedTokens: RefreshedTokens | null = null
) {
  return buildJsonResponse({ error: message }, status, refreshedTokens);
}

function buildCommandAction(action: string): string {
  switch (action) {
    case "approve":
      return "approve_verification";
    case "deny":
      return "deny_verification";
    case "remove_unverified":
      return "remove_unverified_role";
    case "repost_verify_ui":
      return "repost_verify_ui";
    default:
      return "";
  }
}

function buildHumanMessage(action: string, username: string): string {
  switch (action) {
    case "approve":
      return `Verification approval queued for ${username || "member"}.`;
    case "deny":
      return `Verification denial queued for ${username || "member"}.`;
    case "remove_unverified":
      return `Unverified-role removal queued for ${username || "member"}.`;
    case "repost_verify_ui":
      return `Verify UI repost queued for ${username || "member"}.`;
    default:
      return "Verification action queued.";
  }
}

function buildReason(action: string, requestedReason: unknown): string {
  const explicit = normalizeString(requestedReason);
  if (explicit) return explicit;

  switch (action) {
    case "deny":
      return "Denied by staff review";
    case "remove_unverified":
      return "Unverified role cleanup requested by staff review";
    case "repost_verify_ui":
      return "Verify UI repost requested by staff review";
    case "approve":
    default:
      return "Approved by staff review";
  }
}

function buildNoteLines(args: {
  action: string;
  staffName: string;
  staffId: string;
  reason: string;
  roleId: string;
  extra: string[];
}) {
  const lines = [
    "Verification action requested from dashboard.",
    `Action: ${args.action}`,
    `Staff: ${args.staffName} (${args.staffId})`,
    `Reason: ${args.reason}`,
  ];

  if (args.roleId) {
    lines.push(`Role ID: ${args.roleId}`);
  }

  for (const item of args.extra) {
    const line = normalizeString(item);
    if (line) lines.push(line);
  }

  return lines;
}

async function parseRequestBody(request: Request): Promise<RequestBody> {
  try {
    const body = await request.json();
    return safeObject<RequestBody>(body);
  } catch {
    return {};
  }
}

async function insertTicketNoteSafe(
  supabase: ReturnType<typeof createServerSupabase>,
  payload: {
    ticket_id: string;
    staff_id: string;
    staff_name: string;
    content: string;
    created_at: string;
  }
): Promise<{ ok: true } | { ok: false; error: { message?: string } | null }> {
  const attempts = [
    {
      ticket_id: payload.ticket_id,
      staff_id: payload.staff_id,
      staff_name: payload.staff_name,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      staff_id: payload.staff_id,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      content: payload.content,
    },
  ];

  let lastError: { message?: string } | null = null;

  for (const candidate of attempts) {
    const { error } = await supabase.from("ticket_notes").insert(candidate);
    if (!error) {
      return { ok: true };
    }
    lastError = error;
  }

  return { ok: false, error: lastError };
}

async function insertActivityEventSafe(
  supabase: ReturnType<typeof createServerSupabase>,
  payload: {
    guild_id: string;
    title: string;
    description: string;
    event_type: string;
    actor_user_id: string;
    actor_name: string;
    target_user_id: string | null;
    target_name: string;
    ticket_id: string;
    channel_id: string | null;
    metadata: JsonRecord;
    created_at: string;
  }
): Promise<void> {
  const baseCandidate = {
    guild_id: payload.guild_id,
    title: payload.title,
    description: payload.description,
    event_family: "ticket",
    event_type: payload.event_type,
    source: "dashboard_ticket_verify",
    actor_user_id: payload.actor_user_id,
    actor_name: payload.actor_name,
    target_user_id: payload.target_user_id,
    target_name: payload.target_name,
    ticket_id: payload.ticket_id,
    channel_id: payload.channel_id,
    metadata: payload.metadata || {},
    created_at: payload.created_at,
  };

  const attempts = [
    baseCandidate,
    { ...baseCandidate, metadata: undefined },
    {
      guild_id: payload.guild_id,
      title: payload.title,
      description: payload.description,
      event_type: payload.event_type,
      source: "dashboard_ticket_verify",
      actor_user_id: payload.actor_user_id,
      actor_name: payload.actor_name,
      target_user_id: payload.target_user_id,
      target_name: payload.target_name,
      ticket_id: payload.ticket_id,
      channel_id: payload.channel_id,
      created_at: payload.created_at,
    },
    {
      guild_id: payload.guild_id,
      title: payload.title,
      description: payload.description,
      event_type: payload.event_type,
      ticket_id: payload.ticket_id,
      created_at: payload.created_at,
    },
  ];

  for (const candidate of attempts) {
    try {
      const { error } = await supabase.from("activity_feed_events").insert(candidate);
      if (!error) return;
    } catch {
      // best-effort only
    }
  }
}

export async function POST(
  request: Request,
  context: { params: { id?: string } }
) {
  let refreshedTokens: RefreshedTokens | null = null;

  try {
    const auth = await requireStaffSessionForRoute();
    const session = auth?.session as SessionLike | undefined;
    refreshedTokens = auth?.refreshedTokens ?? null;

    const supabase = createServerSupabase();
    const body = await parseRequestBody(request);

    const ticketId = normalizeString(context?.params?.id);
    if (!ticketId) {
      return buildErrorResponse("Missing ticket id.", 400, refreshedTokens);
    }

    const action = normalizeLower(body?.action);
    const supportedActions = new Set([
      "approve",
      "deny",
      "remove_unverified",
      "repost_verify_ui",
    ]);

    if (!supportedActions.has(action)) {
      return buildErrorResponse(
        "Unsupported verification action.",
        400,
        refreshedTokens
      );
    }

    const staffId = normalizeString(body?.staff_id) || getStaffId(session);
    const staffName = getStaffName(session);
    const reason = buildReason(action, body?.reason);
    const roleId = normalizeString(body?.role_id);

    if (!staffId) {
      return buildErrorResponse("Missing staff identity.", 401, refreshedTokens);
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return buildErrorResponse(
        ticketError?.message || "Ticket not found.",
        404,
        refreshedTokens
      );
    }

    const typedTicket = ticket as TicketRow;

    const guildId = normalizeString(
      env.guildId || env.discordGuildId || typedTicket?.guild_id || ""
    );
    if (!guildId) {
      return buildErrorResponse(
        "Missing Discord guild id in environment.",
        500,
        refreshedTokens
      );
    }

    const ticketStatus = normalizeLower(typedTicket?.status);
    if (ticketStatus === "deleted") {
      return buildErrorResponse(
        "Cannot run verification actions on a deleted ticket.",
        409,
        refreshedTokens
      );
    }

    const userId = normalizeString(typedTicket?.user_id);
    if (!userId && action !== "repost_verify_ui") {
      return buildErrorResponse(
        "Ticket is missing user_id.",
        400,
        refreshedTokens
      );
    }

    const channelId = normalizeString(
      typedTicket?.channel_id || typedTicket?.discord_thread_id
    );
    const username =
      normalizeString(typedTicket?.username) ||
      normalizeString(typedTicket?.owner_display_name) ||
      normalizeString(typedTicket?.title) ||
      "member";

    const commandAction = buildCommandAction(action);
    if (!commandAction) {
      return buildErrorResponse(
        "Could not resolve verification command.",
        400,
        refreshedTokens
      );
    }

    const nowIso = new Date().toISOString();

    const noteLines = buildNoteLines({
      action,
      staffName,
      staffId,
      reason,
      roleId,
      extra: [
        `Ticket ID: ${ticketId}`,
        channelId ? `Channel ID: ${channelId}` : "",
        userId ? `User ID: ${userId}` : "",
      ],
    });

    const noteResult = await insertTicketNoteSafe(supabase, {
      ticket_id: ticketId,
      staff_id: staffId,
      staff_name: staffName,
      content: noteLines.join("\n"),
      created_at: nowIso,
    });

    let noteWarning: string | null = null;
    if (!noteResult.ok) {
      noteWarning =
        noteResult?.error?.message ||
        "Ticket note could not be saved, but verification continued.";
    }

    const commandPayload = {
      guild_id: guildId,
      action: commandAction,
      status: "pending",
      payload: {
        ticket_id: ticketId,
        channel_id: channelId || null,
        user_id: userId || null,
        username,
        requester_id: staffId,
        staff_id: staffId,
        staff_name: staffName,
        reason,
        role_id: roleId || null,
        source: "dashboard_ticket_verify",
      },
      created_at: nowIso,
    };

    const { data: commandRow, error: commandError } = await supabase
      .from("bot_commands")
      .insert(commandPayload)
      .select("id")
      .single();

    if (commandError) {
      return buildErrorResponse(
        commandError.message || "Failed to queue verification command.",
        500,
        refreshedTokens
      );
    }

    const command = commandRow as BotCommandInsertRow | null;

    if (action === "deny") {
      await supabase
        .from("tickets")
        .update({
          status: "closed",
          closed_reason: reason,
          closed_by: staffId,
          updated_at: nowIso,
        })
        .eq("id", ticketId);
    }

    if (action === "approve") {
      await supabase
        .from("tickets")
        .update({
          updated_at: nowIso,
        })
        .eq("id", ticketId);
    }

    await insertActivityEventSafe(supabase, {
      guild_id: guildId,
      title:
        action === "approve"
          ? "Verification Approved"
          : action === "deny"
            ? "Verification Denied"
            : action === "remove_unverified"
              ? "Unverified Role Removal Queued"
              : "Verify UI Repost Queued",
      description: reason,
      event_type: `verification_${action}`,
      actor_user_id: staffId,
      actor_name: staffName,
      target_user_id: userId || null,
      target_name: username,
      ticket_id: ticketId,
      channel_id: channelId || null,
      metadata: {
        command_id: command?.id || null,
        action,
        role_id: roleId || null,
      },
      created_at: nowIso,
    });

    return buildJsonResponse(
      {
        ok: true,
        action,
        ticketId,
        commandId: command?.id || null,
        noteWarning,
        message: buildHumanMessage(action, username),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const err = error as { status?: number; message?: string } | undefined;
    const status = err?.status || (err?.message === "Unauthorized" ? 401 : 500);

    return buildErrorResponse(
      err?.message || "Verification route failed.",
      status,
      refreshedTokens
    );
  }
}
