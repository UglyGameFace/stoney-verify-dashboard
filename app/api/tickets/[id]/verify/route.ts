import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
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
  verification_ticket_id?: string | null;
  source_ticket_id?: string | null;
};

type BotCommandInsertRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ExistingCommandRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  payload?: JsonRecord | null;
};

type RequestBody = {
  action?: string | null;
  reason?: string | null;
  role_id?: string | null;
  staff_id?: string | null;
};

type JsonRecord = Record<string, unknown>;

type MemberContextRow = {
  invited_by?: string | null;
  invited_by_name?: string | null;
  invite_code?: string | null;
  vouched_by?: string | null;
  vouched_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  verification_ticket_id?: string | null;
  source_ticket_id?: string | null;
  entry_method?: string | null;
  join_source?: string | null;
  verification_source?: string | null;
  entry_reason?: string | null;
  approval_reason?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
};

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

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = normalizeString(value);
    if (text) return text;
  }
  return "";
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
  refreshedTokens: RefreshedTokens = null
): NextResponse {
  const response = NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function buildErrorResponse(
  message: string,
  status = 500,
  refreshedTokens: RefreshedTokens = null
): NextResponse {
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

async function getMemberContextSafe(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  userId: string
): Promise<MemberContextRow | null> {
  if (!guildId || !userId) return null;

  try {
    const { data, error } = await supabase
      .from("guild_members")
      .select(
        [
          "invited_by",
          "invited_by_name",
          "invite_code",
          "vouched_by",
          "vouched_by_name",
          "approved_by",
          "approved_by_name",
          "verification_ticket_id",
          "source_ticket_id",
          "entry_method",
          "join_source",
          "verification_source",
          "entry_reason",
          "approval_reason",
          "avatar_url",
          "display_name",
          "username",
        ].join(",")
      )
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return safeObject<MemberContextRow>(data);
  } catch {
    return null;
  }
}

async function findPendingVerificationCommand(
  supabase: ReturnType<typeof createServerSupabase>,
  args: {
    guildId: string;
    commandAction: string;
    ticketId: string;
    userId: string;
  }
): Promise<ExistingCommandRow | null> {
  try {
    const { data, error } = await supabase
      .from("bot_commands")
      .select("id,status,created_at,payload")
      .eq("guild_id", args.guildId)
      .eq("action", args.commandAction)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) return null;

    const rows = safeArray<ExistingCommandRow>(data);
    return (
      rows.find((row) => {
        const payload = safeObject(row?.payload);
        const payloadTicketId = normalizeString(payload?.ticket_id);
        const payloadUserId = normalizeString(payload?.user_id);
        return payloadTicketId === args.ticketId && (!args.userId || payloadUserId === args.userId);
      }) || null
    );
  } catch {
    return null;
  }
}

function buildVerificationCommandPayload(args: {
  action: string;
  commandAction: string;
  guildId: string;
  ticketId: string;
  channelId: string;
  userId: string;
  username: string;
  staffId: string;
  staffName: string;
  reason: string;
  roleId: string;
  memberContext: MemberContextRow | null;
}): JsonRecord {
  const memberContext = args.memberContext || {};
  const existingApprovedBy = normalizeString(memberContext?.approved_by);
  const existingApprovedByName = normalizeString(memberContext?.approved_by_name);

  const approvedBy =
    args.action === "approve"
      ? args.staffId
      : existingApprovedBy || null;

  const approvedByName =
    args.action === "approve"
      ? args.staffName
      : existingApprovedByName || null;

  const verificationTicketId = firstNonEmpty(
    memberContext?.verification_ticket_id,
    args.ticketId
  );

  const sourceTicketId = firstNonEmpty(
    memberContext?.source_ticket_id,
    args.ticketId
  );

  const verificationSource = firstNonEmpty(
    memberContext?.verification_source,
    `dashboard_ticket_verify_${args.action}`
  );

  const entryMethod = firstNonEmpty(memberContext?.entry_method, "verification");
  const joinSource = firstNonEmpty(memberContext?.join_source, entryMethod);
  const entryReason = firstNonEmpty(memberContext?.entry_reason);
  const approvalReason = firstNonEmpty(
    memberContext?.approval_reason,
    args.action === "approve" ? args.reason : ""
  );

  const nestedMemberSnapshot: JsonRecord = {
    invited_by: normalizeString(memberContext?.invited_by) || null,
    invited_by_name: normalizeString(memberContext?.invited_by_name) || null,
    invite_code: normalizeString(memberContext?.invite_code) || null,
    vouched_by: normalizeString(memberContext?.vouched_by) || null,
    vouched_by_name: normalizeString(memberContext?.vouched_by_name) || null,
    approved_by: approvedBy,
    approved_by_name: approvedByName,
    verification_ticket_id: verificationTicketId || null,
    source_ticket_id: sourceTicketId || null,
    entry_method: entryMethod || null,
    join_source: joinSource || null,
    verification_source: verificationSource || null,
    entry_reason: entryReason || null,
    approval_reason: approvalReason || null,
    avatar_url: normalizeString(memberContext?.avatar_url) || null,
    display_name: normalizeString(memberContext?.display_name) || null,
    username: normalizeString(memberContext?.username) || null,
  };

  return {
    ticket_id: args.ticketId,
    channel_id: args.channelId || null,
    user_id: args.userId || null,
    username: args.username,
    requester_id: args.staffId,
    staff_id: args.staffId,
    staff_name: args.staffName,
    reason: args.reason,
    role_id: args.roleId || null,
    source: "dashboard_ticket_verify",
    verification_ticket_id: verificationTicketId || null,
    source_ticket_id: sourceTicketId || null,
    invited_by: normalizeString(memberContext?.invited_by) || null,
    invited_by_name: normalizeString(memberContext?.invited_by_name) || null,
    invite_code: normalizeString(memberContext?.invite_code) || null,
    vouched_by: normalizeString(memberContext?.vouched_by) || null,
    vouched_by_name: normalizeString(memberContext?.vouched_by_name) || null,
    approved_by: approvedBy,
    approved_by_name: approvedByName,
    entry_method: entryMethod || null,
    join_source: joinSource || null,
    verification_source: verificationSource || null,
    entry_reason: entryReason || null,
    approval_reason: approvalReason || null,
    member_snapshot: nestedMemberSnapshot,
    dashboard_context: {
      command_action: args.commandAction,
      dashboard_action: args.action,
      queued_from: "app/api/tickets/[id]/verify/route.ts",
    },
  };
}

export async function POST(
  request: Request,
  context: { params: { id?: string } }
) {
  let refreshedTokens: RefreshedTokens = null;

  try {
    const auth = await requireStaffSessionForRoute();
    const session = auth?.session as SessionLike | undefined;
    refreshedTokens = (auth?.refreshedTokens as RefreshedTokens) ?? null;

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

    const existingPending = await findPendingVerificationCommand(supabase, {
      guildId,
      commandAction,
      ticketId,
      userId,
    });

    if (existingPending) {
      return buildJsonResponse(
        {
          ok: true,
          duplicate: true,
          action,
          ticketId,
          commandId: normalizeString(existingPending.id) || null,
          message: `${buildHumanMessage(action, username)} Already queued.`,
        },
        200,
        refreshedTokens
      );
    }

    const memberContext = userId
      ? await getMemberContextSafe(supabase, guildId, userId)
      : null;

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
        firstNonEmpty(memberContext?.entry_method)
          ? `Entry Method: ${firstNonEmpty(memberContext?.entry_method)}`
          : "",
        firstNonEmpty(memberContext?.join_source)
          ? `Join Source: ${firstNonEmpty(memberContext?.join_source)}`
          : "",
        firstNonEmpty(memberContext?.verification_source)
          ? `Verification Source: ${firstNonEmpty(memberContext?.verification_source)}`
          : "",
        firstNonEmpty(memberContext?.invited_by_name, memberContext?.invited_by)
          ? `Invited By: ${firstNonEmpty(memberContext?.invited_by_name, memberContext?.invited_by)}`
          : "",
        firstNonEmpty(memberContext?.vouched_by_name, memberContext?.vouched_by)
          ? `Vouched By: ${firstNonEmpty(memberContext?.vouched_by_name, memberContext?.vouched_by)}`
          : "",
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
    if (noteResult.ok === false) {
      noteWarning =
        noteResult.error?.message ||
        "Ticket note could not be saved, but verification continued.";
    }

    const commandPayload = buildVerificationCommandPayload({
      action,
      commandAction,
      guildId,
      ticketId,
      channelId,
      userId,
      username,
      staffId,
      staffName,
      reason,
      roleId,
      memberContext,
    });

    const { data: commandRow, error: commandError } = await supabase
      .from("bot_commands")
      .insert({
        guild_id: guildId,
        action: commandAction,
        status: "pending",
        payload: commandPayload,
        requested_by: staffId,
        created_at: nowIso,
      })
      .select("id,status,created_at")
      .single();

    if (commandError) {
      return buildErrorResponse(
        commandError.message || "Failed to queue verification command.",
        500,
        refreshedTokens
      );
    }

    const command = (commandRow as BotCommandInsertRow | null) || null;

    await supabase
      .from("tickets")
      .update({
        updated_at: nowIso,
      })
      .eq("id", ticketId);

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
        invited_by: firstNonEmpty(memberContext?.invited_by) || null,
        invited_by_name: firstNonEmpty(memberContext?.invited_by_name) || null,
        invite_code: firstNonEmpty(memberContext?.invite_code) || null,
        vouched_by: firstNonEmpty(memberContext?.vouched_by) || null,
        vouched_by_name: firstNonEmpty(memberContext?.vouched_by_name) || null,
        entry_method: firstNonEmpty(memberContext?.entry_method) || null,
        join_source: firstNonEmpty(memberContext?.join_source) || null,
        verification_source: firstNonEmpty(memberContext?.verification_source) || null,
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
