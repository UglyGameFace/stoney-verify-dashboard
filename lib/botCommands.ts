import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BotCommandAction =
  | "create_ticket"
  | "close_ticket"
  | "delete_ticket"
  | "reopen_ticket"
  | "assign_ticket"
  | "sync_members"
  | "reconcile_departed_members"
  | "sync_role_members"
  | "sync_active_tickets"
  | "portal_ticket_reply";

export type BotCommandRow = {
  id: string;
  guild_id: string;
  action: BotCommandAction;
  payload: Record<string, Json>;
  status: "pending" | "processing" | "completed" | "failed";
  result: Record<string, Json>;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  picked_up_at: string | null;
  completed_at: string | null;
};

let supabase: SupabaseClient | null = null;

function requireEnv(name: string, value: string | undefined): string {
  const out = (value || "").trim();
  if (!out) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return out;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullable(value: unknown): string | null {
  const out = normalizeString(value);
  return out || null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;

  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(text)) return true;
  if (["0", "false", "no", "n", "off"].includes(text)) return false;

  return fallback;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const cleaned = value
    .map((item) => normalizeString(item))
    .filter(Boolean);

  return cleaned.length ? cleaned : null;
}

function getGuildId(): string {
  return requireEnv(
    "DISCORD_GUILD_ID or GUILD_ID or NEXT_PUBLIC_DISCORD_GUILD_ID",
    process.env.DISCORD_GUILD_ID ||
      process.env.GUILD_ID ||
      process.env.NEXT_PUBLIC_DISCORD_GUILD_ID
  );
}

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  );

  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE",
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

async function insertCommand(
  action: BotCommandAction,
  payload: Record<string, Json>,
  requestedBy?: string | null
): Promise<BotCommandRow> {
  const sb = getSupabase();
  const guildId = getGuildId();

  const { data, error } = await sb
    .from("bot_commands")
    .insert({
      guild_id: guildId,
      action,
      payload,
      requested_by: normalizeNullable(requestedBy),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to insert bot command");
  }

  return data as BotCommandRow;
}

export async function queueCreateTicket(input: {
  userId: string;
  category?: string;
  priority?: string;
  openingMessage?: string;
  ghost?: boolean;
  allowDuplicate?: boolean;
  requestedBy?: string | null;
  parentCategoryId?: string | null;
  staffRoleIds?: string[] | null;
  entryMethod?: string | null;
  verificationSource?: string | null;
  sourceTicketId?: string | null;
  verificationTicketId?: string | null;
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  vouchedBy?: string | null;
  vouchedByName?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  entryReason?: string | null;
  approvalReason?: string | null;
}) {
  const userId = normalizeString(input.userId);
  if (!userId) {
    throw new Error("Missing userId");
  }

  return insertCommand(
    "create_ticket",
    {
      user_id: userId,
      category: normalizeString(input.category) || "support",
      priority: normalizeString(input.priority) || "medium",
      opening_message: normalizeString(input.openingMessage),
      ghost: normalizeBoolean(input.ghost, false),
      allow_duplicate: normalizeBoolean(input.allowDuplicate, false),
      parent_category_id: normalizeNullable(input.parentCategoryId),
      staff_role_ids: normalizeStringArray(input.staffRoleIds),
      entry_method: normalizeNullable(input.entryMethod),
      verification_source: normalizeNullable(input.verificationSource),
      source_ticket_id: normalizeNullable(input.sourceTicketId),
      verification_ticket_id: normalizeNullable(input.verificationTicketId),
      invited_by: normalizeNullable(input.invitedBy),
      invited_by_name: normalizeNullable(input.invitedByName),
      invite_code: normalizeNullable(input.inviteCode),
      vouched_by: normalizeNullable(input.vouchedBy),
      vouched_by_name: normalizeNullable(input.vouchedByName),
      approved_by: normalizeNullable(input.approvedBy),
      approved_by_name: normalizeNullable(input.approvedByName),
      entry_reason: normalizeNullable(input.entryReason),
      approval_reason: normalizeNullable(input.approvalReason),
    },
    input.requestedBy
  );
}

export async function queueCloseTicket(input: {
  channelId: string;
  reason?: string;
  staffId?: string | null;
  requestedBy?: string | null;
}) {
  const channelId = normalizeString(input.channelId);
  if (!channelId) {
    throw new Error("Missing channelId");
  }

  return insertCommand(
    "close_ticket",
    {
      channel_id: channelId,
      reason: normalizeString(input.reason) || "Resolved",
      staff_id: normalizeNullable(input.staffId),
    },
    input.requestedBy
  );
}

export async function queueDeleteTicket(input: {
  channelId: string;
  ghost?: boolean;
  forceTranscript?: boolean;
  reason?: string;
  staffId?: string | null;
  requestedBy?: string | null;
}) {
  const channelId = normalizeString(input.channelId);
  if (!channelId) {
    throw new Error("Missing channelId");
  }

  return insertCommand(
    "delete_ticket",
    {
      channel_id: channelId,
      ghost: normalizeBoolean(input.ghost, false),
      force_transcript: normalizeBoolean(input.forceTranscript, false),
      reason: normalizeString(input.reason) || "Deleted from dashboard",
      staff_id: normalizeNullable(input.staffId),
    },
    input.requestedBy
  );
}

export async function queueReopenTicket(input: {
  channelId: string;
  requestedBy?: string | null;
}) {
  const channelId = normalizeString(input.channelId);
  if (!channelId) {
    throw new Error("Missing channelId");
  }

  return insertCommand(
    "reopen_ticket",
    {
      channel_id: channelId,
    },
    input.requestedBy
  );
}

export async function queueAssignTicket(input: {
  channelId: string;
  staffId: string;
  requestedBy?: string | null;
}) {
  const channelId = normalizeString(input.channelId);
  const staffId = normalizeString(input.staffId);

  if (!channelId) {
    throw new Error("Missing channelId");
  }

  if (!staffId) {
    throw new Error("Missing staffId");
  }

  return insertCommand(
    "assign_ticket",
    {
      channel_id: channelId,
      staff_id: staffId,
    },
    input.requestedBy
  );
}

export async function queueSyncMembers(input?: {
  requestedBy?: string | null;
}) {
  return insertCommand("sync_members", {}, input?.requestedBy);
}

export async function queueReconcileDepartedMembers(input?: {
  requestedBy?: string | null;
}) {
  return insertCommand("reconcile_departed_members", {}, input?.requestedBy);
}

export async function queueSyncRoleMembers(input: {
  roleId: string;
  requestedBy?: string | null;
}) {
  const roleId = normalizeString(input.roleId);
  if (!roleId) {
    throw new Error("Missing roleId");
  }

  return insertCommand(
    "sync_role_members",
    {
      role_id: roleId,
    },
    input.requestedBy
  );
}

export async function queueSyncActiveTickets(input?: {
  requestedBy?: string | null;
  includeClosedVisibleChannels?: boolean;
  dryRun?: boolean;
}) {
  return insertCommand(
    "sync_active_tickets",
    {
      include_closed_visible_channels: normalizeBoolean(
        input?.includeClosedVisibleChannels,
        true
      ),
      dry_run: normalizeBoolean(input?.dryRun, false),
    },
    input?.requestedBy
  );
}

export async function queuePortalTicketReply(input: {
  ticketId: string;
  channelId: string;
  userId: string;
  username?: string | null;
  content: string;
  messageId?: string | null;
  requestedBy?: string | null;
}) {
  const ticketId = normalizeString(input.ticketId);
  const channelId = normalizeString(input.channelId);
  const userId = normalizeString(input.userId);
  const content = normalizeString(input.content);

  if (!ticketId) {
    throw new Error("Missing ticketId");
  }
  if (!channelId) {
    throw new Error("Missing channelId");
  }
  if (!userId) {
    throw new Error("Missing userId");
  }
  if (!content) {
    throw new Error("Missing content");
  }

  return insertCommand(
    "portal_ticket_reply",
    {
      ticket_id: ticketId,
      channel_id: channelId,
      user_id: userId,
      username: normalizeNullable(input.username),
      content,
      message_id: normalizeNullable(input.messageId),
    },
    input.requestedBy ?? userId
  );
}

export async function getBotCommand(
  commandId: string
): Promise<BotCommandRow | null> {
  const id = normalizeString(commandId);
  if (!id) {
    throw new Error("Missing commandId");
  }

  const sb = getSupabase();

  const { data, error } = await sb
    .from("bot_commands")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BotCommandRow | null) ?? null;
}
